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

    // Telegram tidak mengembalikan secret_token melalui getWebhookInfo. Karena itu,
    // setWebhook dijalankan secara idempoten setiap setup dipanggil agar perubahan
    // URL maupun TELEGRAM_WEBHOOK_SECRET selalu tersinkron tanpa secret di browser.
    const result = await tg(token, "setWebhook", {
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["callback_query"],
      drop_pending_updates: false,
      max_connections: 40
    });

    const verified = await tg(token, "getWebhookInfo", {});
    const verifiedInfo = verified?.result || {};
    if (String(verifiedInfo.url || "") !== webhookUrl) {
      throw new Error("Telegram belum mengonfirmasi URL webhook yang diminta. Jalankan setup kembali.");
    }

    return respond(json({
      ok: true,
      alreadyConfigured: previousWebhookUrl === webhookUrl,
      previousWebhookUrl,
      webhookUrl,
      webhookSource: "environment",
      secretConfigured: true,
      pendingUpdateCount: Number(verifiedInfo.pending_update_count || 0),
      lastErrorDate: verifiedInfo.last_error_date || null,
      lastErrorMessage: verifiedInfo.last_error_message || null,
      result,
      message: verifiedInfo.last_error_message
        ? "Webhook tersimpan, tetapi Telegram melaporkan kendala callback. Periksa lastErrorMessage."
        : "Webhook Telegram berhasil disinkronkan dan diverifikasi dari Environment Variables."
    }));
  } catch (error) {
    return respond(json({
      ok: false,
      webhookUrl,
      error: String(error?.message || error).slice(0, 260)
    }, 502));
  }
}
