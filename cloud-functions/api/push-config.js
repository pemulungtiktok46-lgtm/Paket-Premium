import { json, cors, getValidatedOrigin } from "./_shared.js";
import { ensureVapidKeys } from "./_push.js";

/**
 * Memberikan kunci VAPID PUBLIK kepada browser.
 * Private key tetap tersimpan di EdgeOne Blob dan tidak pernah dikirim ke client.
 */
export async function onRequest({ request }) {
  if (request.method === "OPTIONS") {
    return cors(request, new Response(null, { status: 204 }));
  }

  if (request.method !== "GET") {
    return cors(request, json({ ok: false, error: "Gunakan GET" }, 405));
  }

  const origin = request.headers.get("origin");
  if (origin && !getValidatedOrigin(request)) {
    return cors(request, json({ ok: false, error: "Origin ditolak." }, 403));
  }

  try {
    const keys = await ensureVapidKeys();
    if (!keys?.publicKey) {
      throw new Error("Kunci Web Push belum berhasil dibuat.");
    }

    return cors(request, json({
      ok: true,
      publicKey: keys.publicKey,
      ready: true
    }));
  } catch (error) {
    return cors(request, json({
      ok: false,
      ready: false,
      error: String(error?.message || error).slice(0, 180)
    }, 503));
  }
}
