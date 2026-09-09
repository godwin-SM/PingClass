import { createClient } from "jsr:@supabase/supabase-js@2";

const TABLES = [
  "users", "institutes", "students", "batches", "student_batches",
  "parent_student_links", "payments", "fees", "attendance", "announcements",
  "invite_tokens", "institute_settings", "notification_preferences",
  "notifications", "subscriptions", "push_subscriptions", "rate_limit_hits",
  "waitlist", "audit_log",
];

// UTF-8-safe base64 (btoa() itself rejects chars outside Latin-1, and
// snapshots contain arbitrary user text - names, addresses, messages).
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
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

// yyyyMMdd-HHmmss in UTC (edge sandbox clock); same shape the restore
// script uses to order snapshots (descending -> most recent first).
function stamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-secret",
      },
    });
  }

  const provided = req.headers.get("x-supabase-secret") ?? "";
  if (!provided || provided !== Deno.env.get("INTERNAL_SECRET")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Load GitHub credentials from Vault (service_role-only RPC).
  const [tokRes, repoRes] = await Promise.all([
    admin.rpc("get_secret", { name_to_get: "backup_github_token" }),
    admin.rpc("get_secret", { name_to_get: "backup_github_repo" }),
  ]);
  const gitToken = tokRes.data as string | null;
  const gitRepo = repoRes.data as string | null;
  if (!gitToken || !gitRepo) {
    return json({ error: "GitHub credentials missing in Vault" }, 500);
  }

  const ghHeaders = {
    Authorization: `Bearer ${gitToken}`,
    "User-Agent": "pingclass-backup",
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: ghHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`GitHub ${method} ${path}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  const stampNow = stamp();

  try {
    // 1. Dump every known public table (paginated, 1000 rows/req - same as the
    // PowerShell backup). Kept fully in memory; nothing written to disk.
    const files: Array<{ path: string; content: string }> = [];
    const counts: Record<string, number> = {};
    let totalRows = 0;

    for (const t of TABLES) {
      const rows: unknown[] = [];
      let offset = 0;
      const page = 1000;
      try {
        let fetched = page;
        while (fetched >= page && offset < 100000) {
          const r = await fetch(
            `${supabaseUrl}/rest/v1/${t}?select=*&limit=${page}&offset=${offset}`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
          );
          if (r.status === 404) throw new Error(`__skip__:${t}`);
          if (!r.ok) throw new Error(`${t}: HTTP ${r.status} ${await r.text()}`);
          const parsed = await r.json();
          const batch = Array.isArray(parsed) ? parsed : [];
          rows.push(...batch);
          fetched = batch.length;
          offset += fetched;
        }
      } catch (e) {
        if (String((e as Error).message).startsWith("__skip__")) continue; // table doesn't exist (yet)
        throw e;
      }

      counts[t] = rows.length;
      totalRows += rows.length;
      files.push({ path: `${t}.json`, content: JSON.stringify(rows) });
      console.log(`  ${t.padEnd(28)} ${rows.length} rows`);
    }

    const manifest = {
      timestamp: new Date().toISOString(),
      url: supabaseUrl,
      tables: counts,
      total_rows: totalRows,
    };
    files.push({ path: "_manifest.json", content: JSON.stringify(manifest) });

    // 2. Upload this snapshot as the ONLY commit on main (flat history).
    //    Each run squashes: the repo keeps exactly one snapshot dir (the newest),
    //    so it never accumulates a full dump per day. Orphan commit (no parents)
    //    + force ref update certifies the token can rewrite the branch - verified
    //    during the 2026-09-09 cleanup (single commit 591b7886).
    const branch = "main";

    const tree: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    for (const f of files) {
      const b64 = toBase64(f.content);
      const blob = await gh<{ sha: string }>("POST", `/repos/${gitRepo}/git/blobs`, { content: b64, encoding: "base64" });
      tree.push({ path: `${stampNow}/${f.path}`, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await gh<{ sha: string }>("POST", `/repos/${gitRepo}/git/trees`, { tree });
    const commit = await gh<{ sha: string }>("POST", `/repos/${gitRepo}/git/commits`, {
      message: `backup ${stampNow} (${totalRows} rows)`,
      tree: newTree.sha,
      parents: [],
    });
    await gh("PATCH", `/repos/${gitRepo}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });

    console.log(`Backup complete: GitHub:${stampNow} (${totalRows} rows, ${files.length - 1} tables)`);
    return json({ ok: true, snapshot: stampNow, total_rows: totalRows, tables: files.length - 1, commit: commit.sha });
  } catch (e) {
    console.error("backup-snapshot FAILED:", String((e as Error).message ?? e));
    return json({ ok: false, error: String((e as Error).message ?? e) }, 500);
  }
});