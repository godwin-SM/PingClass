import { createClient } from "jsr:@supabase/supabase-js@2";

// Signed-in users report bugs from the in-app "Report a problem" dialog
// (admin/teacher/parent dashboards). The report is stored via the service role
// and forwarded to the PingClass owner mailbox as a best-effort email.
// verify_jwt = true on deploy: only a valid user session can submit.

const WINDOW_MS = 60 * 60 * 1000;
const USER_LIMIT = 5;
const IP_LIMIT = 30;
const buckets: Record<string, number[]> = {};
const bucketsIp: Record<string, number[]> = {};

const MAKER_EMAIL = "pingclassoff@gmail.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

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

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

async function notifyMaker(reporterEmail: string, role: string, page: string, message: string, resendKey: string): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr><td style="background-color:#0D3D37;padding:24px 32px;"><h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">PingClass</h1></td></tr>
          <tr><td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px;font-weight:600;">New bug report</h2>
            <table width="100%" cellpadding="8" cellspacing="0">
              <tr><td style="color:#6b7280;font-size:13px;width:90px;">Reporter</td><td style="color:#1a1a1a;font-size:14px;font-weight:600;">${escHtml(reporterEmail)}</td></tr>
              <tr><td style="color:#6b7280;font-size:13px;">Role</td><td style="color:#1a1a1a;font-size:14px;">${escHtml(role)}</td></tr>
              <tr><td style="color:#6b7280;font-size:13px;">Page</td><td style="color:#1a1a1a;font-size:14px;">${escHtml(page)}</td></tr>
            </table>
            <p style="margin:16px 0 8px;color:#6b7280;font-size:13px;">Message</p>
            <table width="100%" cellpadding="12" cellspacing="0" style="background-color:#f0fdfa;border-radius:8px;border:1px solid #99f6e4;">
              <tr><td style="color:#134e4a;font-size:15px;line-height:1.6;">${escHtml(message)}</td></tr>
            </table>
            <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">View and manage in the bug report console.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PingClass <notifications@onresend.com>",
      to: [MAKER_EMAIL],
      subject: `[Bug report] ${page || "unknown page"} · ${reporterEmail}`,
      html,
    }),
  });
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
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sign in required." }, 401);
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
      return json({ error: "Sign in required." }, 401);
    }

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (limited(buckets, user.id, USER_LIMIT, Date.now()) || limited(bucketsIp, ip, IP_LIMIT, Date.now())) {
      return json({ error: "Too many reports. Please try again later." }, 429);
    }

    const body = (await req.json()) as { message?: unknown; page?: unknown; role?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const page = typeof body.page === "string" ? body.page.trim().slice(0, 200) : "";
    const role = typeof body.role === "string" ? body.role.trim().slice(0, 32) : "user";

    if (message.length < 5 || message.length > 2000) {
      return json({ error: "Please describe the problem (5–2000 characters)." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: insertErr } = await admin.from("bug_reports").insert({
      reporter_id: user.id,
      reporter_email: user.email ?? null,
      role,
      page,
      message,
      status: "open",
    });
    if (insertErr) throw insertErr;

    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (resendKey) {
      try {
        await notifyMaker(user.email ?? "unknown", role, page, message, resendKey);
      } catch {
        // Notifications are best-effort; the stored report is the source of truth.
      }
    }

    return json({ ok: true });
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});