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

    const { token_id } = await req.json();
    if (!token_id) {
      return json({ error: "token_id is required." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: token } = await admin
      .from("invite_tokens")
      .select("id, email, institute_id, used")
      .eq("id", token_id)
      .maybeSingle();
    if (!token) return json({ error: "Invitation not found." }, 404);

    // Caller must be the invitee, or an admin of the invite's institute.
    const isInvitee =
      !!token.email &&
      !!user.email &&
      token.email.toLowerCase() === user.email.toLowerCase();

    if (!isInvitee) {
      const { data: caller } = await admin
        .from("users")
        .select("role, institute_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!caller || caller.role !== "admin" || caller.institute_id !== token.institute_id) {
        return json({ error: "Not authorized to use this invitation." }, 403);
      }
    }

    const { error: upErr } = await admin
      .from("invite_tokens")
      .update({ used: true })
      .eq("id", token_id);
    if (upErr) {
      return json({ error: upErr.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
