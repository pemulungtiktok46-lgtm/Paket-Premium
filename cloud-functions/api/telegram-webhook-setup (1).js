import {
  json,
  tg,
  cors,
  getValidatedOrigin,
  getTelegramBotToken,
  getAdminId,
  getTelegramWebhookUrl,
  getTelegramWebhookSecret
} from "./_shared.js";

export async function onRequest({ request, env }) {
  const respond = (response) => cors(request, response, env);
  const method = String(request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    return respond(new Response(null, { status: 204 }));
  }

  let token;
  let adminId;
  let webhookUrl;
  let webhookSecret;
  try {
    token = getTelegramBotToken(env);
    adminId = getAdminId(env);
    webhookUrl = getTelegramWebhookUrl(env);
    webhookSecret = getTelegramWebhookSecret(env);
  } catch (error) {
    return respond(json({
      ok: false,
      ready: false,
      error: String(error?.message || error)
    }, 503));
  }

  // GET hanya untuk pemeriksaan. Tidak menghubungi Telegram dan tidak membocorkan rahasia.
  if (method === "GET") {
    return respond(json({
      ok: true,
      ready: true,
      endpoint: "telegram-webhook-setup",
      method: "POST",
      telegramTokenConfigured: Boolean(token),
      telegramAdminIdConfigured: Boolean(adminId),
      telegramWebhookUrlConfigured: Boolean(webhookUrl),
      webhookUrl,
      message: "Konfigurasi siap. Gunakan POST dari halaman aplikasi untuk menyinkronkan webhook ke Telegram."
    }));
  }

  if (method !== "POST") {
    return respond(json({ ok: false, error: "Gunakan GET untuk memeriksa konfigurasi atau POST untuk memasang webhook." }, 405));
  }

  // Endpoint setup hanya menerima POST dari halaman aplikasi di origin yang diizinkan.
  const origin = request.headers.get("origin");
  if (!origin || !getValidatedOrigin(request, env)) {
    return respond(json({
      ok: false,
      error: "Origin ditolak. Jalankan setup dari halaman aplikasi pada domain proyek EdgeOne ini."
    }, 403));
  }

  try {
    const current = await tg(token, "getWebhookInfo", {});
    const info = current?.result || {};
    const previousWebhookUrl = String(info.url || "");
    const alreadyConfigured = previousWebhookUrl === webhookUrl;

    if (alreadyConfigured) {
      return respond(json({
        ok: true,
        alreadyConfigured: true,
        previousWebhookUrl,
        webhookUrl,
        webhookSource: "environment",
        pendingUpdateCount: Number(info.pending_update_count || 0),
        lastErrorDate: info.last_error_date || null,
        lastErrorMessage: info.last_error_message || null,
        message: info.last_error_message
          ? "URL webhook sudah benar, tetapi Telegram melaporkan kendala pengiriman callback. Periksa lastErrorMessage."
          : "Webhook Telegram sudah aktif pada URL dari Environment Variables."
      }));
    }

    const result = await tg(token, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["callback_query"],
      drop_pending_updates: false
    });

    return respond(json({
      ok: true,
      alreadyConfigured: false,
      previousWebhookUrl,
      webhookUrl,
      webhookSource: "environment",
      result,
      message: "Webhook Telegram berhasil diarahkan ke URL Environment Variables proyek ini."
    }));
  } catch (error) {
    return respond(json({
      ok: false,
      webhookUrl,
      error: String(error?.message || error).slice(0, 260)
    }, 502));
  }
}
