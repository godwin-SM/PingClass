import { createClient } from "jsr:@supabase/supabase-js@2";

// Public review submission for the landing page. Inserts into public.reviews
// with status='pending' so nothing is published before moderation. Writes only
// via the service role (anon/authenticated have no access to the table at all),
// with a light per-IP rate limit to keep spam out of the moderation queue.

const WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 5;
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

function clean(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

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
    const body = (await req.json()) as {
      authorName?: unknown;
      quote?: unknown;
      institute?: unknown;
      rating?: unknown;
    };

    const name = clean(body.authorName);
    const quote = clean(body.quote);
    const institute = clean(body.institute ?? "");
    const rating = Math.round(Number(body.rating ?? 5));

    if (name.length < 2 || name.length > 60) {
      return json({ error: "Please enter your name (2-60 characters)." }, 400);
    }
    if (quote.length < 10 || quote.length > 1000) {
      return json({ error: "Your review should be between 10 and 1000 characters." }, 400);
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return json({ error: "Rating must be between 1 and 5." }, 400);
    }
    const instituteVal = institute === "" ? null : institute;
    if (instituteVal !== null && instituteVal.length > 80) {
      return json({ error: "Institute name is too long (80 characters max)." }, 400);
    }

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const now = Date.now();
    if (limited(bucketsIp, ip, IP_LIMIT, now)) {
      return json({ error: "Too many reviews. Please try again later." }, 429);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error } = await admin.from("reviews").insert({
      author_name: name,
      quote,
      rating,
      institute: instituteVal,
      status: "pending",
    });
    if (error) throw error;

    return json({ ok: true });
  } catch {
    // Fail safe: never claim success when the insert may have failed.
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});