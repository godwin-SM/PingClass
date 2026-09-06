import { createClient } from "jsr:@supabase/supabase-js@2";

// Scheduled retention / cleanup job (invoked by pg_cron via the migration in
// migrations/20260814030000_retention_cron.sql). Requires the RETENTION_SECRET
// function secret. Safe by design:
//  - It never deletes student/attendance/fee records (financial records are kept
//    for 6 years under Indian tax law: IT Act 1961 s.44AA / Rule 6F; GST Act 2017 s.36).
//  - It only purges stale personal data: used/expired invite tokens (which hold
//    names + emails) and orphaned link rows pointing at deleted records.

const DAYS_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-secret",
      },
    });
  }

  const provided = req.headers.get("x-supabase-secret") ?? "";
  if (!provided || provided !== Deno.env.get("RETENTION_SECRET")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const summary: string[] = [];
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * DAYS_MS).toISOString();
  const cutoff90 = new Date(now.getTime() - 90 * DAYS_MS).toISOString();

  // 1. Used invite tokens older than 30 days (hold name + email).
  {
    const { data: rows } = await admin
      .from("invite_tokens")
      .select("id")
      .eq("used", true)
      .lt("created_at", cutoff30);
    if (rows && rows.length) {
      await admin.from("invite_tokens").delete().in("id", rows.map((r: { id: string }) => r.id));
      summary.push(`invite_tokens used>30d: ${rows.length}`);
    }
  }

  // 2. Expired, unused invite tokens older than 30 days.
  {
    const { data: rows } = await admin
      .from("invite_tokens")
      .select("id")
      .eq("used", false)
      .lt("expires_at", now.toISOString())
      .lt("created_at", cutoff30);
    if (rows && rows.length) {
      await admin.from("invite_tokens").delete().in("id", rows.map((r: { id: string }) => r.id));
      summary.push(`invite_tokens expired>30d: ${rows.length}`);
    }
  }

  // 3. Invite tokens created but never used and older than 90 days.
  {
    const { data: rows } = await admin
      .from("invite_tokens")
      .select("id")
      .eq("used", false)
      .lt("created_at", cutoff90);
    if (rows && rows.length) {
      await admin.from("invite_tokens").delete().in("id", rows.map((r: { id: string }) => r.id));
      summary.push(`invite_tokens stale>90d: ${rows.length}`);
    }
  }

  // 4. Orphaned parent_student_links (student or parent no longer exists).
  {
    const { data: links } = await admin.from("parent_student_links").select("id, student_id, parent_id");
    if (links && links.length) {
      const studentIds = [...new Set(links.map((l: { student_id: string }) => l.student_id))];
      const parentIds = [...new Set(links.map((l: { parent_id: string }) => l.parent_id))];
      const [{ data: students }, { data: parents }] = await Promise.all([
        admin.from("students").select("id").in("id", studentIds),
        admin.from("users").select("id").in("id", parentIds),
      ]);
      const okStudents = new Set((students || []).map((s: { id: string }) => s.id));
      const okParents = new Set((parents || []).map((u: { id: string }) => u.id));
      const orphans = links.filter(
        (l: { id: string; student_id: string; parent_id: string }) =>
          !okStudents.has(l.student_id) || !okParents.has(l.parent_id)
      );
      if (orphans.length) {
        await admin.from("parent_student_links").delete().in("id", orphans.map((o: { id: string }) => o.id));
        summary.push(`parent_student_links orphans: ${orphans.length}`);
      }
    }
  }

  // 5. Orphaned student_batches (student or batch no longer exists).
  {
    const { data: rows } = await admin.from("student_batches").select("id, student_id, batch_id");
    if (rows && rows.length) {
      const studentIds = [...new Set(rows.map((r: { student_id: string }) => r.student_id))];
      const batchIds = [...new Set(rows.map((r: { batch_id: string }) => r.batch_id))];
      const [{ data: students }, { data: batches }] = await Promise.all([
        admin.from("students").select("id").in("id", studentIds),
        admin.from("batches").select("id").in("id", batchIds),
      ]);
      const okStudents = new Set((students || []).map((s: { id: string }) => s.id));
      const okBatches = new Set((batches || []).map((b: { id: string }) => b.id));
      const orphans = rows.filter(
        (r: { id: string; student_id: string; batch_id: string }) =>
          !okStudents.has(r.student_id) || !okBatches.has(r.batch_id)
      );
      if (orphans.length) {
        await admin.from("student_batches").delete().in("id", orphans.map((o: { id: string }) => o.id));
        summary.push(`student_batches orphans: ${orphans.length}`);
      }
    }
  }

  console.log("retention-cleanup run:", summary.join("; ") || "nothing to purge");
  return json({ ok: true, summary });
});
