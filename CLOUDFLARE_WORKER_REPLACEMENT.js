const ALLOWED_ORIGINS = new Set([
  "https://aishfatimafeedback.in",
  "https://www.aishfatimafeedback.in"
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function reply(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" }
  });
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function verifyAdminToken(token, env) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if (header.alg !== "RS256" || !header.kid) return false;

    const projectId = env.FIREBASE_PROJECT_ID;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      payload.sub !== env.ADMIN_UID ||
      !payload.exp || payload.exp <= now ||
      !payload.iat || payload.iat > now + 60 ||
      !payload.auth_time || payload.auth_time > now + 60
    ) return false;

    const keyResponse = await fetch(
      "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      { cf: { cacheTtl: 3600, cacheEverything: true } }
    );
    if (!keyResponse.ok) return false;
    const keySet = await keyResponse.json();
    const jwk = keySet.keys.find(key => key.kid === header.kid);
    if (!jwk) return false;

    const publicKey = await crypto.subtle.importKey(
      "jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["verify"]
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
  } catch (_) {
    return false;
  }
}

async function makeSignature(params, secret) {
  const canonical = Object.keys(params).sort()
    .map(key => `${key}=${params[key]}`).join("&");
  const digest = await crypto.subtle.digest(
    "SHA-1", new TextEncoder().encode(canonical + secret)
  );
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function validPublicId(publicId, folder) {
  return typeof publicId === "string" &&
    publicId.startsWith(folder + "/") &&
    !publicId.includes("..") &&
    !publicId.includes("\\") &&
    publicId.length <= 400;
}

async function deleteCloudinaryAsset(resourceType, publicId, env) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await makeSignature(
    { public_id: publicId, timestamp },
    env.CLOUDINARY_API_SECRET
  );
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: env.CLOUDINARY_API_KEY,
    signature
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
    { method: "POST", body: form }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.result !== "ok") {
    throw new Error("Cloudinary could not confirm asset deletion.");
  }
  return result;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return reply(request, { error: "Origin not allowed" }, 403);
    }
    if (request.method === "GET") {
      return reply(request, {
        status: "Worker is active",
        message: "Firebase authenticated POST required for media operations"
      });
    }
    if (request.method !== "POST") return reply(request, { error: "Method not allowed" }, 405);

    try {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token || !(await verifyAdminToken(token, env))) {
        return reply(request, { error: "Admin authentication failed" }, 403);
      }

      const body = await request.json();
      const resourceType = body.resourceType;
      if (!["image", "video"].includes(resourceType)) {
        return reply(request, { error: "Invalid media type" }, 400);
      }
      const folder = resourceType === "image" ? "feedback-images" : "feedback-videos";

      if (body.action === "delete" || body.action === "delete-media") {
        if (!validPublicId(body.publicId, folder)) {
          return reply(request, { error: "Invalid Cloudinary public ID" }, 400);
        }
        await deleteCloudinaryAsset(resourceType, body.publicId, env);
        return reply(request, { result: "ok" });
      }

      if (body.action !== "sign-upload") {
        return reply(request, { error: "Invalid action" }, 400);
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await makeSignature({ folder, timestamp }, env.CLOUDINARY_API_SECRET);
      return reply(request, {
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        timestamp,
        folder,
        resourceType,
        signature
      });
    } catch (_) {
      return reply(request, { error: "Unable to complete secure media request" }, 500);
    }
  }
};
