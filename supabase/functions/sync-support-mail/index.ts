import { createClient } from "jsr:@supabase/supabase-js@2";

// Owner-only helper: mirrors inbound mail for the CEO console.
// Inbound email for support@pingclass.in is forwarded to the owner's Gmail by
// ImprovMX; this function pulls those messages via the Gmail REST API (OAuth2,
// refresh-token flow) into support_messages. HTTPS-only — no raw sockets.
//
// Secrets (Deno env): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN

const OWNER_EMAIL = "godwin2614@gmail.com";
const GMAIL_QUERY = "to:support@pingclass.in newer_than:365d";
const FETCH_LIMIT = 40;
const BODY_MAX = 4000;

const WINDOW_MS = 60 * 60 * 1000;
const SYNC_LIMIT = 60;
const buckets: Record<string, number[]> = {};

function limited(key: string, limit: number, now: number): boolean {
  const ts = (buckets[key] || []).filter((t) => now - t < WINDOW_MS);
  if (ts.length >= limit) {
    buckets[key] = ts;
    return true;
  }
  ts.push(now);
  buckets[key] = ts;
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

let tokenCache = { value: "", exp: 0 };

async function gmailToken(): Promise<string> {
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: Deno.env.get("GMAIL_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("GMAIL_CLIENT_SECRET") ?? "",
    refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "",
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error("Gmail OAuth failed (" + res.status + ")");
  }
  const j = await res.json();
  if (!j.access_token) throw new Error("Gmail OAuth: no access token");
  tokenCache = { value: j.access_token, exp: Date.now() + ((j.expires_in ?? 3600) - 120) * 1000 };
  return tokenCache.value;
}

async function gmailFetch(path: string, token: string) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    throw new Error("Gmail API " + res.status);
  }
  return res.json();
}

function decodeB64Url(s: string): string {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function flattenParts(p: any, out: any[] = []): any[] {
  if (!p) return out;
  if (Array.isArray(p.parts) && p.parts.length) {
    for (const q of p.parts) flattenParts(q, out);
  } else {
    out.push(p);
  }
  return out;
}

function extractText(msg: any): string {
  const parts = flattenParts(msg.payload);
  let plain = "";
  let html = "";
  for (const p of parts) {
    if (p.mimeType === "text/plain" && p.body && p.body.data) {
      plain = decodeB64Url(p.body.data);
      break;
    }
  }
  if (!plain) {
    for (const p of parts) {
      if (p.mimeType === "text/html" && p.body && p.body.data) {
        html = decodeB64Url(p.body.data);
        break;
      }
    }
    if (html) {
      plain = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ");
    }
  }
  return plain.replace(/\s+/g, " ").trim();
}

function header(msg: any, name: string): string {
  const n = name.toLowerCase();
  const h = (msg.payload && msg.payload.headers) || [];
  for (const x of h) {
    if (String(x.name || "").toLowerCase() === n) return x.value || "";
  }
  return "";
}

function parseSender(v: string): { name: string; email: string } {
  const m = /^"?([^"<]*)"?\s*<([^>]+)>/.exec(v || "");
  if (m) {
    return { name: m[1].trim(), email: m[2].trim() };
  }
  return { name: "", email: String(v || "").trim() };
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
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

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
    if (userErr || !user) return json({ error: "Authentication required." }, 401);

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (limited(user.id, SYNC_LIMIT, Date.now()) || limited("ip:" + ip, SYNC_LIMIT, Date.now())) {
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
      return json({ error: "Only the PingClass owner can access this." }, 403);
    }

    const body = (await req.json()) as { action?: string; id?: string; read?: boolean };
    const action = typeof body.action === "string" ? body.action : "";

    async function listMessages() {
      const { data, error } = await admin
        .from("support_messages")
        .select("id, gmail_message_id, gmail_thread_id, sender_name, sender_email, to_list, subject, snippet, body, message_id_header, in_reply_to, date, read")
        .order("date", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      const unread = (data ?? []).filter((m) => !m.read).length;
      return { support: data ?? [], unread };
    }

    if (action === "list") {
      return json(await listMessages());
    }

    if (action === "count") {
      const { count: unread } = await admin
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      const { count: total } = await admin
        .from("support_messages")
        .select("id", { count: "exact", head: true });
      return json({ unread: unread ?? 0, total: total ?? 0 });
    }

    if (action === "mark_read") {
      const id = typeof body.id === "string" ? body.id : "";
      const read = body.read === true;
      if (!id) return json({ error: "Missing message id." }, 400);
      const { error } = await admin
        .from("support_messages")
        .update({ read, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return json(await listMessages());
    }

    if (action === "sync") {
      if (!Deno.env.get("GMAIL_REFRESH_TOKEN")) {
        return json({ error: "Support mail sync is not configured yet." }, 503);
      }
      const token = await gmailToken();

      const { data: existing } = await admin.from("support_messages").select("gmail_message_id");
      const have = new Set((existing ?? []).map((r) => r.gmail_message_id));

      const params = new URLSearchParams({ q: GMAIL_QUERY, maxResults: String(FETCH_LIMIT), includeSpamTrash: "false" });
      const list = await gmailFetch("messages?" + params.toString(), token);
      const ids = (list.messages ?? []).map((m: any) => m.id).filter(Boolean);
      const fresh = ids.filter((id: string) => !have.has(id)).slice(0, FETCH_LIMIT);

      let added = 0;
      for (const gid of fresh) {
        const msg = await gmailFetch("messages/" + encodeURIComponent(gid) + "?format=full", token);
        const from = parseSender(header(msg, "From"));
        const toList = header(msg, "To");
        const subject = header(msg, "Subject");
        const bodyText = extractText(msg);
        const date = Number(msg.internalDate);
        const row = {
          gmail_message_id: gid,
          gmail_thread_id: msg.threadId || "",
          sender_name: from.name,
          sender_email: from.email,
          to_list: toList,
          subject,
          snippet: msg.snippet || "",
          body: bodyText.slice(0, BODY_MAX),
          message_id_header: header(msg, "Message-ID"),
          in_reply_to: header(msg, "In-Reply-To"),
          date: date ? new Date(date).toISOString() : null,
          read: false,
        };
        const { error } = await admin.from("support_messages").upsert(row, { onConflict: "gmail_message_id" });
        if (error) throw error;
        added += 1;
      }

      const out = await listMessages();
      return json({ sync: { added, checked: ids.length }, ...out });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return json({ error: message }, 500);
  }
});