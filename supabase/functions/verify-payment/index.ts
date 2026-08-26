import { createClient } from "jsr:@supabase/supabase-js@2";

// Razorpay secrets must be set via `supabase secrets set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET`.
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

// Server-side pricing (INR paise). Never trust client-sent amounts.
const PLANS: Record<string, { amount: number }> = {
  basic: { amount: 24900 },
  pro: { amount: 59900 },
};

const SUBSCRIPTION_DAYS = 30;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(RAZORPAY_KEY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = new TextEncoder().encode(`${orderId}|${paymentId}`);
  const mac = await crypto.subtle.sign("HMAC", key, data);
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
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

    const body = await req.json();
    const { plan_id, payment_id, order_id, signature } = body ?? {};

    if (!plan_id || !payment_id || !order_id || !signature) {
      return json({ error: "plan_id, payment_id, order_id and signature are required." }, 400);
    }

    const plan = PLANS[String(plan_id)];
    if (!plan) {
      return json({ error: "Invalid plan selected." }, 400);
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: "Payment verification is not configured." }, 500);
    }

    // Signature proves the payment belongs to an order created with our keys.
    const sigOk = await verifySignature(
      String(order_id),
      String(payment_id),
      String(signature)
    );
    if (!sigOk) {
      return json({ error: "Payment signature verification failed." }, 400);
    }

    // Verify the payment with Razorpay server-side.
    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(String(payment_id))}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        },
      }
    );

    if (!rzpRes.ok) {
      return json({ error: "Could not verify payment with Razorpay." }, 400);
    }

    const rzp = await rzpRes.json();
    if (rzp.status !== "captured") {
      return json({ error: "Payment has not been captured." }, 400);
    }
    if (Number(rzp.amount) !== plan.amount) {
      return json({ error: "Payment amount does not match the selected plan." }, 400);
    }
    if (rzp.order_id && rzp.order_id !== String(order_id)) {
      return json({ error: "Payment does not match the order." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("razorpay_payment_id", String(payment_id))
      .limit(1);

    if (existing && existing.length > 0) {
      return json({ error: "This payment has already been recorded." }, 400);
    }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      plan_id,
      amount: plan.amount / 100,
      razorpay_payment_id: payment_id,
      status: "active",
      expires_at: new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data: orderCol } = await supabaseAdmin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "subscriptions")
      .eq("column_name", "razorpay_order_id")
      .limit(1);

    if (orderCol && orderCol.length > 0) {
      insertPayload.razorpay_order_id = order_id;
    }

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ success: true, subscription: data });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
