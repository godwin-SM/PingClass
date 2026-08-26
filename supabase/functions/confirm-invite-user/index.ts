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

    const { user_id } = await req.json();
    if (!user_id) {
      return json({ error: "user_id is required." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Only an admin of the target user's institute may confirm their invite.
    const { data: caller } = await admin
      .from("users")
      .select("role, institute_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!caller || caller.role !== "admin") {
      return json({ error: "Only an admin can confirm invitations." }, 403);
    }

    const { data: target } = await admin
      .from("users")
      .select("institute_id")
      .eq("id", user_id)
      .maybeSingle();
    if (!target || target.institute_id !== caller.institute_id) {
      return json({ error: "Not allowed to confirm this user." }, 403);
    }

    const { data, error } = await admin.auth.admin.updateUserById(user_id, {
      email_confirm: true,
    });
    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ success: true, user_id: data.user?.id });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
