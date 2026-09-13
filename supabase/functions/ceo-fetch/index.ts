import { createClient } from "jsr:@supabase/supabase-js@2";

// Maker-only READ endpoint for the PingClass CEO console (ceo-pingclass.html).
// Every payload shape is an explicit action in a read-only whitelist; there is
// no arbitrary query passthrough. Authorization is the caller's own JWT
// (verify_jwt = true on deploy); the gate below is strict: the signed-in user's
// email must match the owner email. Data access uses the service role.

const OWNER_EMAIL = "godwin2614@gmail.com";

const WINDOW_MS = 60 * 60 * 1000;
const USER_LIMIT = 120;
const IP_LIMIT = 200;
const buckets: Record<string, number[]> = {};
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

function countFor(list: unknown[] | null): number {
  return Array.isArray(list) ? list.length : 0;
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

    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    if (limited(buckets, user.id, USER_LIMIT, Date.now()) || limited(bucketsIp, ip, IP_LIMIT, Date.now())) {
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
      return json({ error: "Only the PingClass owner can open this console." }, 403);
    }

    const body = (await req.json()) as { action?: unknown; actionFilter?: unknown };
    const action = typeof body.action === "string" ? body.action : "";
    const actionFilter = typeof body.actionFilter === "string" ? body.actionFilter : "all";

    if (action === "overview") {
      const [
        institutes,
        students,
        batches,
        users,
        activeSubs,
        subsAll,
        paid,
        reviewsRows,
        bugRows,
        waitlist,
        pendingInvites,
        recentAudit,
      ] = await Promise.all([
        admin.from("institutes").select("id"),
        admin.from("students").select("id").is("deleted_at", null),
        admin.from("batches").select("id").is("deleted_at", null),
        admin.from("users").select("role").is("deleted_at", null).limit(2000),
        admin.from("subscriptions").select("amount").eq("status", "active"),
        admin.from("subscriptions").select("plan_id").eq("status", "active"),
        admin.from("payments").select("amount").eq("status", "paid").limit(5000),
        admin.from("reviews").select("status").limit(5000),
        admin.from("bug_reports").select("status").limit(5000),
        admin.from("waitlist").select("id"),
        admin.from("invite_tokens").select("id").eq("used", false),
        admin
          .from("audit_log")
          .select("id, user_id, action, table_name, record_id, old_data, new_data, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const usersByRole = { admin: 0, teacher: 0, parent: 0, other: 0 };
      for (const u of users.data ?? []) {
        if (u.role === "admin") usersByRole.admin += 1;
        else if (u.role === "teacher") usersByRole.teacher += 1;
        else if (u.role === "parent") usersByRole.parent += 1;
        else usersByRole.other += 1;
      }

      const reviewsMeta = { pending: 0, approved: 0, rejected: 0 };
      for (const r of reviewsRows.data ?? []) {
        const s = r.status as string;
        if (s in reviewsMeta) reviewsMeta[s as keyof typeof reviewsMeta] += 1;
      }

      const bugMeta = { open: 0, in_progress: 0, resolved: 0, ignored: 0 };
      for (const b of bugRows.data ?? []) {
        const s = b.status as string;
        if (s in bugMeta) bugMeta[s as keyof typeof bugMeta] += 1;
      }

      const subsPlan = { free: 0, basic: 0, pro: 0 };
      for (const s of subsAll.data ?? []) {
        const p = s.plan_id as string;
        if (p in subsPlan) subsPlan[p as keyof typeof subsPlan] += 1;
      }

      const mrr = (activeSubs.data ?? []).reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
      const collected = (paid.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

      const audit = [];
      for (const a of recentAudit.data ?? []) {
        audit.push({
          id: a.id,
          action: a.action,
          table_name: a.table_name,
          record_id: a.record_id,
          created_at: a.created_at,
          user_id: a.user_id,
          old_data: a.old_data,
          new_data: a.new_data,
        });
      }

      return json({
        overview: {
          institutes: countFor(institutes.data),
          students: countFor(students.data),
          batches: countFor(batches.data),
          users: countFor(users.data),
          usersByRole,
          activeSubs: countFor(activeSubs.data),
          subsPlan,
          mrr,
          collected,
          collectedCount: countFor(paid.data),
          reviews: countFor(reviewsRows.data),
          reviewsMeta,
          bugs: countFor(bugRows.data),
          bugMeta,
          waitlist: countFor(waitlist.data),
          pendingInvites: countFor(pendingInvites.data),
        },
        recentAudit: audit,
      });
    }

    if (action === "reviews") {
      const { data, error } = await admin
        .from("reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ reviews: data ?? [] });
    }

    if (action === "bugs") {
      let q = admin
        .from("bug_reports")
        .select("id, reporter_id, reporter_email, role, page, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (actionFilter !== "all") {
        q = q.eq("status", actionFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return json({ bugs: data ?? [] });
    }

    if (action === "institutes") {
      const { data, error } = await admin
        .from("institutes")
        .select("id, name, phone, email, address, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ownerIds = Array.from(new Set((data ?? []).map((i) => i.owner_id).filter(Boolean)));
      const owners: Record<string, string> = {};
      if (ownerIds.length) {
        const { data: ownerRows } = await admin.from("users").select("id, email, full_name").in("id", ownerIds);
        for (const o of ownerRows ?? []) owners[o.id] = o.email || o.full_name || "";
      }

      return json({
        institutes: (data ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          phone: i.phone,
          email: i.email,
          address: i.address,
          owner: owners[i.owner_id] ?? "",
          created_at: i.created_at,
        })),
      });
    }

    if (action === "users") {
      const { data, error } = await admin
        .from("users")
        .select("id, full_name, email, role, institute_id, created_at, deleted_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const instIds = Array.from(new Set((data ?? []).map((u) => u.institute_id).filter(Boolean)));
      const names: Record<string, string> = {};
      if (instIds.length) {
        const { data: instRows } = await admin.from("institutes").select("id, name").in("id", instIds);
        for (const i of instRows ?? []) names[i.id] = i.name;
      }

      return json({
        users: (data ?? []).map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          institute: names[u.institute_id] ?? "",
          deleted: u.deleted_at != null,
          created_at: u.created_at,
        })),
      });
    }

    if (action === "waitlist") {
      const { data, error } = await admin
        .from("waitlist")
        .select("id, email, source, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ waitlist: data ?? [] });
    }

    if (action === "leads") {
      const [{ data: waitlist }, { data: invites }] = await Promise.all([
        admin.from("waitlist").select("id, email, source, created_at").order("created_at", { ascending: false }).limit(200),
        admin
          .from("invite_tokens")
          .select("id, email, role, institute_id, used, expires_at, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const instIds = Array.from(new Set((invites ?? []).map((i) => i.institute_id).filter(Boolean)));
      const instNames: Record<string, string> = {};
      if (instIds.length) {
        const { data: instRows } = await admin.from("institutes").select("id, name").in("id", instIds);
        for (const i of instRows ?? []) instNames[i.id] = i.name;
      }

      return json({
        waitlist: waitlist ?? [],
        invites: (invites ?? []).map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          institute: instNames[i.institute_id] ?? "",
          used: i.used,
          expires_at: i.expires_at,
          created_at: i.created_at,
        })),
      });
    }

    if (action === "revenue") {
      const { data, error } = await admin
        .from("payments")
        .select("id, amount, status, paid_at, student_id, institute_id, batch_id, created_at")
        .in("status", ["paid"])
        .order("paid_at", { ascending: false })
        .limit(3000);
      if (error) throw error;

      const rows = data ?? [];

      const months: { key: string; label: string; sum: number; count: number }[] = [];
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        months.push({ key, label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), sum: 0, count: 0 });
      }
      const monthMap: Record<string, { sum: number; count: number }> = {};
      for (const m of months) monthMap[m.key] = m;

      let total = 0;
      let last30d = 0;
      let last90d = 0;
      const thirtyAgo = Date.now() - 30 * 24 * 3600 * 1000;
      const ninetyAgo = Date.now() - 90 * 24 * 3600 * 1000;

      for (const p of rows) {
        const amt = Number(p.amount ?? 0);
        total += amt;
        if (!p.paid_at) continue;
        const ts = new Date(p.paid_at + "T00:00:00Z").getTime();
        if (isNaN(ts)) continue;
        const key = String(p.paid_at).slice(0, 7);
        if (monthMap[key]) { monthMap[key].sum += amt; monthMap[key].count += 1; }
        if (ts >= thirtyAgo) last30d += amt;
        if (ts >= ninetyAgo) last90d += amt;
      }
      for (const m of months) { const b = monthMap[m.key]; m.sum = b.sum; m.count = b.count; }

      const recent = rows.slice(0, 60);
      const studentIds = Array.from(new Set(recent.map((p) => p.student_id).filter(Boolean)));
      const instIds = Array.from(new Set(recent.map((p) => p.institute_id).filter(Boolean)));
      const batchIds = Array.from(new Set(recent.map((p) => p.batch_id).filter(Boolean)));

      const [sRows, iRows, bRows] = await Promise.all([
        studentIds.length ? admin.from("students").select("id, full_name, deleted_at").in("id", studentIds) : Promise.resolve({ data: null }),
        instIds.length ? admin.from("institutes").select("id, name").in("id", instIds) : Promise.resolve({ data: null }),
        batchIds.length ? admin.from("batches").select("id, name, deleted_at").in("id", batchIds) : Promise.resolve({ data: null }),
      ]);
      const students: Record<string, string> = {};
      for (const s of sRows.data ?? []) students[s.id] = s.deleted_at ? (s.full_name || "") + " (deleted)" : s.full_name;
      const insts: Record<string, string> = {};
      for (const i of iRows.data ?? []) insts[i.id] = i.name;
      const blist: Record<string, string> = {};
      for (const b of bRows.data ?? []) blist[b.id] = b.deleted_at ? b.name + " (deleted)" : b.name;

      return json({
        revenue: { months, total, last30d, last90d, count: rows.length },
        payments: recent.map((p) => ({
          id: p.id,
          amount: Number(p.amount ?? 0),
          status: p.status,
          student: students[p.student_id] ?? "",
          institute: insts[p.institute_id] ?? "",
          batch: blist[p.batch_id] ?? "",
          paid_at: p.paid_at,
          created_at: p.created_at,
        })),
      });
    }

    if (action === "audit") {
      const { data, error } = await admin
        .from("audit_log")
        .select("id, user_id, action, table_name, record_id, old_data, new_data, created_at")
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;

      const userIds = Array.from(new Set((data ?? []).map((a) => a.user_id).filter(Boolean)));
      const emails: Record<string, string> = {};
      if (userIds.length) {
        const { data: userRows } = await admin.from("users").select("id, email").in("id", userIds);
        for (const u of userRows ?? []) emails[u.id] = u.email || "";
      }

      return json({
        audit: (data ?? []).map((a) => ({
          id: a.id,
          user_id: a.user_id,
          email: emails[a.user_id] ?? "",
          action: a.action,
          table_name: a.table_name,
          record_id: a.record_id,
          old_data: a.old_data,
          new_data: a.new_data,
          created_at: a.created_at,
        })),
      });
    }

    return json({ error: "Unknown action." }, 400);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});