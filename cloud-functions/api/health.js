import { json, readState, getAdminId } from "./_shared.js";
import { readPushState } from "./_push.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "Gunakan GET" }, 405);
  }

  const telegramAdminIdConfigured = (() => {
    try { return Boolean(getAdminId(env)); }
    catch (_) { return false; }
  })();

  try {
    // Membaca state untuk memastikan Cloud Function dapat mengakses Blob.
    const state = await readState();
    const pushState = await readPushState();
    return json({
      ok: true,
      backend: "online",
      storage: "ready",
      telegramTokenConfigured: Boolean(env?.TELEGRAM_BOT_TOKEN),
      telegramAdminIdConfigured,
      telegramAdminIdSource: telegramAdminIdConfigured ? "environment" : "missing",
      webPushReady: Boolean(pushState?.vapidKeys?.publicKey && pushState?.vapidKeys?.privateKey),
      pushSubscribers: Object.keys(pushState?.subscriptions || {}).length,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return json({
      ok: false,
      backend: "online",
      storage: "error",
      telegramTokenConfigured: Boolean(env?.TELEGRAM_BOT_TOKEN),
      telegramAdminIdConfigured,
      telegramAdminIdSource: telegramAdminIdConfigured ? "environment" : "missing",
      webPushReady: false,
      error: String(error?.message || error).slice(0, 180)
    }, 503);
  }
}
