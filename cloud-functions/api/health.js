import { json, readState, getAdminId, getTelegramWebhookUrl } from "./_shared.js";
import { readPushState } from "./_push.js";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return json({ ok: false, error: "Gunakan GET" }, 405);
  }

  const telegramAdminIdConfigured = (() => {
    try { return Boolean(getAdminId(env)); }
    catch (_) { return false; }
  })();
  const telegramWebhookConfigured = (() => {
    try { return Boolean(getTelegramWebhookUrl(env)); }
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
      telegramTokenConfigured: Boolean(String(env?.TELEGRAM_BOT_TOKEN || "").trim()),
      telegramAdminIdConfigured,
      telegramAdminIdSource: telegramAdminIdConfigured ? "environment" : "missing",
      telegramWebhookConfigured,
      webPushReady: Boolean(pushState?.vapidKeys?.publicKey && pushState?.vapidKeys?.privateKey),
      pushSubscribers: Object.keys(pushState?.subscriptions || {}).length,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return json({
      ok: false,
      backend: "online",
      storage: "error",
      telegramTokenConfigured: Boolean(String(env?.TELEGRAM_BOT_TOKEN || "").trim()),
      telegramAdminIdConfigured,
      telegramAdminIdSource: telegramAdminIdConfigured ? "environment" : "missing",
      telegramWebhookConfigured,
      webPushReady: false,
      error: String(error?.message || error).slice(0, 180)
    }, 503);
  }
}
