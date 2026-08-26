import { createClient } from "jsr:@supabase/supabase-js@2";

// Rate-limited email existence check.
//
// The old approach called a public Postgres RPC (`check_email_exists`) straight
// from the client, which let anyone enumerate registered emails with no
// throttling. This edge function adds simple per-IP + per-email rate limits so
// the endpoint can't be used for mass enumeration. Limits are held in memory,
// so they are per-instance (adequate for casual abuse; cold starts reset them).

const WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 120;
const EMAIL_LIMIT = 10;
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
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Invalid email." }, 400);
    }
    const normalized = email.trim().toLowerCase();

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const now = Date.now();
    if (limited(bucketsIp, ip, IP_LIMIT, now) || limited(buckets, normalized, EMAIL_LIMIT, now)) {
      return json({ error: "Too many attempts. Please try again later." }, 429);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data } = await admin
      .schema("auth")
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    return json({ exists: !!data });
  } catch {
    // Fail open — never block signup because the check itself errored.
    return json({ exists: false });
  }
});
