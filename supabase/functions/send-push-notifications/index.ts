import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Convert base64url string to ArrayBuffer
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert ArrayBuffer to base64url string
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Convert standard base64 to base64url
function base64ToBase64url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Convert VAPID keys from base64url to JWK format for @negrel/webpush
function convertVapidKeysToJWK(
  publicKeyBase64url: string,
  privateKeyBase64url: string
): { publicKey: JsonWebKey; privateKey: JsonWebKey } {
  // Public key: uncompressed P-256 = 0x04 + x(32) + y(32) = 65 bytes
  const publicKeyBuffer = base64urlToArrayBuffer(publicKeyBase64url);
  if (publicKeyBuffer.byteLength !== 65) {
    throw new Error(
      "Invalid public key length. Expected 65 bytes for uncompressed P-256 key."
    );
  }
  const publicKeyBytes = new Uint8Array(publicKeyBuffer);
  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);

  // Private key: raw 32-byte scalar
  const privateKeyBuffer = base64urlToArrayBuffer(privateKeyBase64url);

  const publicKeyJWK: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    x: arrayBufferToBase64url(x),
    y: arrayBufferToBase64url(y),
    key_ops: ["verify"],
    ext: true,
  };

  const privateKeyJWK: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    x: arrayBufferToBase64url(x),
    y: arrayBufferToBase64url(y),
    d: arrayBufferToBase64url(privateKeyBuffer),
    key_ops: ["sign"],
    ext: true,
  };

  return { publicKey: publicKeyJWK, privateKey: privateKeyJWK };
}

// Lazy-init push server (reuse across requests in same isolate)
let appServer: webpush.ApplicationServer | null = null;

async function getPushServer(
  supabase: ReturnType<typeof createClient>
): Promise<webpush.ApplicationServer> {
  if (appServer) return appServer;

  // Read VAPID keys from Supabase Vault via service-role-only RPC
  const { data: publicKey, error: pubErr } = await supabase.rpc("get_secret", {
    name_to_get: "VAPID_PUBLIC_KEY",
  });
  const { data: privateKey, error: privErr } = await supabase.rpc("get_secret", {
    name_to_get: "VAPID_PRIVATE_KEY",
  });

  if (pubErr || privErr) {
    throw new Error(
      "Failed to read VAPID keys from Vault: " +
        (pubErr?.message || "pub") +
        " / " +
        (privErr?.message || "priv")
    );
  }

  const publicKeyBase64 = (publicKey as string) ?? "";
  const privateKeyBase64 = (privateKey as string) ?? "";

  if (!publicKeyBase64 || !privateKeyBase64) {
    throw new Error("VAPID keys not configured in Vault");
  }

  const exportedKeys = convertVapidKeysToJWK(publicKeyBase64, privateKeyBase64);
  const vapidKeys = await webpush.importVapidKeys(exportedKeys, {
    extractable: false,
  });

  appServer = await webpush.ApplicationServer.new({
    contactInformation: "mailto:noreply@pingclass.in",
    vapidKeys,
  });

  return appServer;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Internal-only: must present the shared INTERNAL_SECRET.
    const provided = req.headers.get("x-supabase-secret") ?? "";
    if (!provided || provided !== Deno.env.get("INTERNAL_SECRET")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { user_id, title, body: notifBody, type, data } = body;

    if (!user_id || !title) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Check if user has push enabled
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("push_enabled")
      .eq("user_id", user_id)
      .maybeSingle();

    if (prefs && !prefs.push_enabled) {
      return json({ success: true, skipped: "push_disabled" });
    }

    // Get user's push subscriptions
    const { data: subs, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError || !subs || subs.length === 0) {
      return json({ success: true, skipped: "no_subscriptions" });
    }

    // Initialize push server
    const server = await getPushServer(supabase);

    const payload = JSON.stringify({
      title,
      body: notifBody,
      tag: `pingclass-${type}`,
      data: { type, ...data },
    });

    let sent = 0;
    let failed = 0;
    const toDelete: string[] = [];

    for (const sub of subs) {
      try {
        const pushSub: webpush.PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: base64ToBase64url(sub.p256dh),
            auth: base64ToBase64url(sub.auth),
          },
        };

        const subscriber = server.subscribe(pushSub);
        await subscriber.pushTextMessage(payload, {
          ttl: 86400,
          topic: `pingclass-${type}`,
        });
        sent++;
      } catch (e) {
        failed++;
        toDelete.push(sub.id);
      }
    }

    // Remove failed subscriptions
    if (toDelete.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", toDelete);
    }

    return json({ success: true, sent, failed, deleted: toDelete.length });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
