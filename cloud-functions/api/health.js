import { json, readState, getAdminId, getTelegramBotToken, getTelegramWebhookUrl, getTelegramWebhookSecret, tg } from "./_shared.js";
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
  const telegramWebhookSecretReady = (() => {
    try { return Boolean(getTelegramWebhookSecret(env)); }
    catch (_) { return false; }
  })();

  let state = null;
  let telegramWebhookActive = false;
  let telegramWebhookPendingUpdates = null;
  let telegramWebhookLastError = null;
  let telegramApiReachable = false;
  try {
    // Membaca state untuk memastikan Cloud Function dapat mengakses Blob.
    state = await readState();
    const pushState = await readPushState();
    try {
      const token = getTelegramBotToken(env);
      const expectedUrl = getTelegramWebhookUrl(env);
      const remote = await tg(token, "getWebhookInfo", {}, 5000);
      const info = remote?.result || {};
      telegramApiReachable = true;
      telegramWebhookActive = String(info.url || "") === expectedUrl;
      telegramWebhookPendingUpdates = Number(info.pending_update_count || 0);
      telegramWebhookLastError = info.last_error_message || null;
    } catch (telegramError) {
      telegramWebhookLastError = String(telegramError?.message || telegramError).slice(0, 180);
    }
    return json({
      ok: true,
      backend: "online",
      storage: "ready",
      telegramTokenConfigured: Boolean(String(env?.TELEGRAM_BOT_TOKEN || "").trim()),
      telegramAdminIdConfigured,
      telegramAdminIdSource: telegramAdminIdConfigured ? "environment" : "missing",
      telegramWebhookConfigured,
      telegramWebhookSecretReady,
      telegramApiReachable,
      telegramWebhookActive,
      telegramWebhookPendingUpdates,
      telegramWebhookLastError,
      lastWebhookAt: String(state.lastWebhookAt || ""),
      lastWebhookUpdateId: Number(state.lastWebhookUpdateId || 0),
      lastWebhookAction: String(state.lastWebhookAction || ""),
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
      telegramWebhookSecretReady,
      telegramApiReachable,
      telegramWebhookActive,
      telegramWebhookPendingUpdates,
      telegramWebhookLastError,
      lastWebhookAt: String(state?.lastWebhookAt || ""),
      lastWebhookUpdateId: Number(state?.lastWebhookUpdateId || 0),
      lastWebhookAction: String(state?.lastWebhookAction || ""),
      webPushReady: false,
      error: String(error?.message || error).slice(0, 180)
    }, 503);
  }
}
