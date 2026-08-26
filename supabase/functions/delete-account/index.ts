import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Best-effort delete so one missing column never aborts the whole cascade.
async function tryDelete(
  admin: ReturnType<typeof createClient>,
  table: string,
  filter: { col: string; value: string | string[] }
): Promise<void> {
  try {
    let q = admin.from(table).delete();
    q = Array.isArray(filter.value)
      ? q.in(filter.col, filter.value)
      : q.eq(filter.col, filter.value);
    await q;
  } catch {
    // continue cascade
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Authentication required." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) {
      return json({ error: "Authentication required." }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: caller } = await admin
      .from("users")
      .select("id, role, institute_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!caller) return json({ error: "Profile not found." }, 403);

    const { data: inst } = await admin
      .from("institutes")
      .select("owner_id, id")
      .eq("id", caller.institute_id)
      .maybeSingle();
    const isOwner = !!inst && inst.owner_id === user.id;

    if (!isOwner) {
      // Member (teacher / parent): delete their own record + references only.
      await tryDelete(admin, "parent_student_links", { col: "parent_id", value: user.id });
      await admin.from("batches").update({ teacher_id: null }).eq("teacher_id", user.id);
      await admin.from("attendance").update({ marked_by: null }).eq("marked_by", user.id);
      await tryDelete(admin, "users", { col: "id", value: user.id });
      await admin.auth.admin.deleteUser(user.id);
      return json({ success: true });
    }

    // Owner: full cascade for the whole institute.
    const instId = caller.institute_id;

    const { data: users } = await admin
      .from("users")
      .select("id")
      .eq("institute_id", instId);
    const userIds = (users || []).map((u: { id: string }) => u.id);

    const { data: students } = await admin
      .from("students")
      .select("id")
      .eq("institute_id", instId);
    const studentIds = (students || []).map((s: { id: string }) => s.id);

    const { data: batches } = await admin
      .from("batches")
      .select("id")
      .eq("institute_id", instId);
    const batchIds = (batches || []).map((b: { id: string }) => b.id);

    if (studentIds.length) {
      await tryDelete(admin, "student_batches", { col: "student_id", value: studentIds });
      await tryDelete(admin, "attendance", { col: "student_id", value: studentIds });
      await tryDelete(admin, "parent_student_links", { col: "student_id", value: studentIds });
      await tryDelete(admin, "payments", { col: "student_id", value: studentIds });
    }
    if (batchIds.length) {
      await tryDelete(admin, "attendance", { col: "batch_id", value: batchIds });
    }
    if (userIds.length) {
      await tryDelete(admin, "parent_student_links", { col: "parent_id", value: userIds });
    }
    await tryDelete(admin, "payments", { col: "institute_id", value: instId });
    await tryDelete(admin, "announcements", { col: "institute_id", value: instId });
    await tryDelete(admin, "invite_tokens", { col: "institute_id", value: instId });
    await tryDelete(admin, "institute_settings", { col: "institute_id", value: instId });
    await tryDelete(admin, "subscriptions", { col: "institute_id", value: instId });
    if (batchIds.length) await tryDelete(admin, "batches", { col: "id", value: batchIds });
    if (studentIds.length) await tryDelete(admin, "students", { col: "id", value: studentIds });
    await tryDelete(admin, "institutes", { col: "id", value: instId });
    if (userIds.length) await tryDelete(admin, "users", { col: "id", value: userIds });

    for (const uid of userIds) {
      await admin.auth.admin.deleteUser(uid);
    }

    return json({ success: true });
  } catch (err) {
    console.error("delete-account error", err);
    return json({ error: "Internal server error" }, 500);
  }
});
