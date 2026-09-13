import { createClient } from "jsr:@supabase/supabase-js@2";

// Maker-only WRITE endpoint for the PingClass CEO console (ceo-pingclass.html).
// Phase A writes are limited to bug-report triage (status transitions); review
// moderation already lives in `moderate-reviews` and is reused by the console.
// Every write is an explicit action in the whitelist below and is recorded in
// audit_log. Authorization is the caller's own JWT (verify_jwt = true on
// deploy); the gate below is strict: the signed-in user's email must match the
// owner email. Data access uses the service role.

const OWNER_EMAIL = "godwin2614@gmail.com";

const WINDOW_MS = 60 * 60 * 1000;
const USER_LIMIT = 90;
const IP_LIMIT = 150;
const buckets: Record<string, number[]> = {};
const bucketsIp: Record<string, number[]> = {};

function limited(map: Record<string, number[]>, key: string, limit: number, now: number): boolean {
  const ts = (map[key] || []).filter((t) => now - t < WINDOW_MS);
  if (ts.length >= limit) {
    map[key] = ts;
    return true;
  }
  ts.push(now);
  map[key] = ts;
  return false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const VALID_BUG_STATUS = ["open", "in_progress", "resolved", "ignored"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
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

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (limited(buckets, user.id, USER_LIMIT, Date.now()) || limited(bucketsIp, ip, IP_LIMIT, Date.now())) {
      return json({ error: "Too many requests. Try again later." }, 429);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: caller } = await admin
      .from("users")
      .select("id, email")
      .eq("id", user.id)
      .maybeSingle();
    if (!caller || caller.email !== OWNER_EMAIL) {
      return json({ error: "Only the PingClass owner can use this console." }, 403);
    }

    const body = (await req.json()) as { action?: unknown; id?: unknown; status?: unknown };
    const action = body.action;

    if (action === "update_bug_status") {
      const bugId = body.id;
      const status = body.status;
      if (typeof bugId !== "string" || !bugId) {
        return json({ error: "id is required." }, 400);
      }
      if (typeof status !== "string" || !VALID_BUG_STATUS.includes(status)) {
        return json({ error: "status must be one of: open, in_progress, resolved, ignored." }, 400);
      }

      const { data: existing } = await admin
        .from("bug_reports")
        .select("id, status")
        .eq("id", bugId)
        .maybeSingle();
      if (!existing) {
        return json({ error: "Bug report not found." }, 404);
      }
      if (existing.status === status) {
        return json({ bug: existing, unchanged: true });
      }

      const { data: updated, error: updErr } = await admin
        .from("bug_reports")
        .update({ status })
        .eq("id", bugId)
        .select()
        .maybeSingle();
      if (updErr) throw updErr;

      await admin.from("audit_log").insert({
        user_id: user.id,
        action: "UPDATE",
        table_name: "bug_reports",
        record_id: bugId,
        old_data: { status: existing.status },
        new_data: { status },
      });

      return json({ bug: updated });
    }

    return json({ error: "Unknown action." }, 400);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});