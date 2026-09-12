import { createClient } from "jsr:@supabase/supabase-js@2";

// Maker-only endpoint for the review moderation queue: list all submissions,
// move a submission to approved/rejected/pending, or delete spam. This is the
// PingClass owner's private console — NOT exposed to institute owners.
// Authorization is the caller's own JWT (verify_jwt = true on deploy), and the
// gate below is strict: the signed-in user's email must match the owner email.
// Data access uses the service role.

const OWNER_EMAIL = "godwin2614@gmail.com";

const WINDOW_MS = 60 * 60 * 1000;
const USER_LIMIT = 120;
const IP_LIMIT = 200;
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

const VALID_STATUS = ["approved", "rejected", "pending"];

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
      return json({ error: "Only the PingClass owner can moderate reviews." }, 403);
    }

    const body = (await req.json()) as { action?: unknown; id?: unknown; status?: unknown };
    const action = body.action;

    if (action === "list") {
      const { data, error } = await admin
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ reviews: data ?? [] });
    }

    if (action === "update") {
      const reviewId = body.id;
      const status = body.status;
      if (typeof reviewId !== "string" || !reviewId) {
        return json({ error: "id is required." }, 400);
      }
      if (typeof status !== "string" || !VALID_STATUS.includes(status)) {
        return json({ error: "status must be approved, rejected or pending." }, 400);
      }
      const { data, error } = await admin
        .from("reviews")
        .update({ status })
        .eq("id", reviewId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Review not found." }, 404);
      return json({ review: data });
    }

    if (action === "delete") {
      const reviewId = body.id;
      if (typeof reviewId !== "string" || !reviewId) {
        return json({ error: "id is required." }, 400);
      }
      const { error } = await admin.from("reviews").delete().eq("id", reviewId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});