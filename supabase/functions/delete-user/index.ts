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

    const { data: caller } = await admin
      .from("users")
      .select("id, role, institute_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!caller) return json({ error: "Profile not found." }, 403);
    if (caller.role !== "admin") {
      return json({ error: "Only an admin can remove members." }, 403);
    }

    const { data: target } = await admin
      .from("users")
      .select("id, role, institute_id")
      .eq("id", user_id)
      .maybeSingle();
    if (!target) return json({ error: "User not found." }, 404);
    if (target.institute_id !== caller.institute_id) {
      return json({ error: "Not allowed to remove this user." }, 403);
    }
    if (target.id === user.id) {
      return json({ error: "You cannot remove your own account." }, 400);
    }

    const { data: inst } = await admin
      .from("institutes")
      .select("owner_id")
      .eq("id", caller.institute_id)
      .maybeSingle();
    if (inst && inst.owner_id === user_id) {
      return json({ error: "The institute owner cannot be removed." }, 400);
    }

    // Clean up references, then remove profile + auth user (same as the old client flow).
    await admin.from("parent_student_links").delete().eq("parent_id", user_id);
    await admin.from("batches").update({ teacher_id: null }).eq("teacher_id", user_id);
    await admin.from("attendance").update({ marked_by: null }).eq("marked_by", user_id);

    const { error: delUsersErr } = await admin.from("users").delete().eq("id", user_id);
    if (delUsersErr) {
      return json({ error: delUsersErr.message }, 400);
    }

    const { error: delAuthErr } = await admin.auth.admin.deleteUser(user_id);
    if (delAuthErr) {
      return json({ error: delAuthErr.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
