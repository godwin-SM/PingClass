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
        "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PATCH, DELETE",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const method = req.method;

    // GET / - List user's notifications (paginated via limit/offset).
    // Returns total count and unread_count for the bell badge + history view.
    if (method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
      const unreadOnly = url.searchParams.get("unread") === "true";

      let query = admin
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.is("read_at", null);
      }

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 500);

      let unreadCount: number | null = null;
      if (!unreadOnly) {
        const { count: unread } = await admin
          .from("notifications")
          .select("id", { count: "exact" })
          .eq("user_id", user.id)
          .is("read_at", null);
        if (unread === null) unread = 0;
        unreadCount = unread;
      }

      return json({ notifications: data, total: count, unread_count: unreadCount });
    }

    // PATCH / - Mark as read
    if (method === "PATCH") {
      const body = await req.json();
      const { ids, markAll } = body;

      let query = admin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (markAll) {
        query = query.is("read_at", null);
      } else if (ids && ids.length > 0) {
        query = query.in("id", ids);
      } else {
        return json({ error: "Provide ids array or markAll: true" }, 400);
      }

      const { error } = await query;
      if (error) return json({ error: error.message }, 500);

      return json({ success: true });
    }

    // DELETE / - Delete notifications
    if (method === "DELETE") {
      const body = await req.json();
      const { ids } = body;

      if (!ids || ids.length === 0) {
        return json({ error: "Provide ids array" }, 400);
      }

      const { error } = await admin
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .in("id", ids);

      if (error) return json({ error: error.message }, 500);

      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});