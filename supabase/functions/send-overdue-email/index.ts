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

function buildEmailHtml(parentName: string, childName: string, amount: number, dueDate: string, daysOverdue: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#0D3D37;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">PingClass</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px;font-weight:600;">Fee Payment Overdue</h2>
              <p style="margin:0 0 16px;color:#4a4a4a;font-size:15px;line-height:1.6;">
                Hi ${parentName},
              </p>
              <p style="margin:0 0 24px;color:#4a4a4a;font-size:15px;line-height:1.6;">
                This is a reminder that a fee payment for <strong>${childName}</strong> is overdue.
              </p>
              <table width="100%" cellpadding="12" cellspacing="0" style="background-color:#fef2f2;border-radius:8px;border:1px solid #fecaca;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:14px;">Child</td>
                        <td style="padding:4px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${childName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:14px;">Amount</td>
                        <td style="padding:4px 0;color:#dc2626;font-size:14px;font-weight:600;text-align:right;">₹${amount.toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:14px;">Due Date</td>
                        <td style="padding:4px 0;color:#1a1a1a;font-size:14px;text-align:right;">${dueDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:14px;">Days Overdue</td>
                        <td style="padding:4px 0;color:#dc2626;font-size:14px;font-weight:600;text-align:right;">${daysOverdue} day${daysOverdue > 1 ? "s" : ""}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#4a4a4a;font-size:15px;line-height:1.6;">
                Please contact your institute to complete the payment.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                This is an automated notification from PingClass.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!resendKey) {
      return json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const body = await req.json();
    const { to, parentName, childName, amount, dueDate, daysOverdue } = body;

    if (!to || !parentName || !childName || !amount || !dueDate) {
      return json({ error: "Missing required fields" }, 400);
    }

    const html = buildEmailHtml(parentName, childName, amount, dueDate, daysOverdue);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "PingClass <notifications@onresend.com>",
        to: [to],
        subject: `Overdue fee alert — ₹${amount.toLocaleString("en-IN")} for ${childName}`,
        html
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return json({ error: `Resend error: ${error}` }, 500);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
