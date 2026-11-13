import { json, cors, getValidatedOrigin } from "./_shared.js";
import { ensureVapidKeys } from "./_push.js";

/**
 * Memberikan kunci VAPID PUBLIK kepada browser.
 * Private key tetap tersimpan di EdgeOne Blob dan tidak pernah dikirim ke client.
 */
export async function onRequest({ request, env }) {
  const respond = (response) => cors(request, response, env);
  if (request.method === "OPTIONS") {
    return respond( new Response(null, { status: 204 }));
  }

  if (request.method !== "GET") {
    return respond( json({ ok: false, error: "Gunakan GET" }, 405));
  }

  const origin = request.headers.get("origin");
  if (origin && !getValidatedOrigin(request, env)) {
    return respond( json({ ok: false, error: "Origin ditolak." }, 403));
  }

  try {
    const keys = await ensureVapidKeys();
    if (!keys?.publicKey) {
      throw new Error("Kunci Web Push belum berhasil dibuat.");
    }

    return respond( json({
      ok: true,
      publicKey: keys.publicKey,
      ready: true
    }));
  } catch (error) {
    return respond( json({
      ok: false,
      ready: false,
      error: String(error?.message || error).slice(0, 180)
    }, 503));
  }
}
