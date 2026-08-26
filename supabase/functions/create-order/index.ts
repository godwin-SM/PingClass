import { createClient } from "jsr:@supabase/supabase-js@2";

// Razorpay secrets are injected via `supabase secrets set`.
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

// Server-side pricing (INR paise). Never trust client-sent amounts.
const PLANS: Record<string, { amount: number; name: string }> = {
  basic: { amount: 24900, name: "Basic" },
  pro: { amount: 59900, name: "Pro" },
};

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
    const { plan_id } = body ?? {};

    const plan = PLANS[String(plan_id ?? "")];
    if (!plan) {
      return json({ error: "Invalid plan selected." }, 400);
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ error: "Payments are not configured." }, 500);
    }

    // Create a Razorpay order server-side so the amount is locked before
    // checkout opens. Payments without an order are auto-refunded by Razorpay.
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: "INR",
        receipt: `pc_${Date.now()}`.slice(0, 56),
        notes: { plan_id, user_id: user.id, plan_name: plan.name },
      }),
    });

    const rzp = await rzpRes.json();
    if (!rzpRes.ok || !rzp.id) {
      return json({ error: "Could not create Razorpay order." }, 400);
    }

    return json({
      order_id: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
    });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
