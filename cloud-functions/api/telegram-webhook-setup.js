import {
  json,
  tg,
  cors,
  getValidatedOrigin,
  getTelegramBotToken,
  getTelegramWebhookUrl
} from "./_shared.js";

export async function onRequest({ request, env }) {
  const respond = (response) => cors(request, response, env);

  if (request.method === "OPTIONS") {
    return respond(new Response(null, { status: 204 }));
  }
  if (request.method !== "POST") {
    return respond(json({
      ok: false,
      error: "Gunakan POST ke /api/telegram-webhook-setup. Endpoint ini bukan halaman untuk dibuka langsung."
    }, 405));
  }

  const origin = getValidatedOrigin(request, env);
  if (!origin) {
    return respond(json({
      ok: false,
      error: "Origin ditolak. Gunakan halaman aplikasi dari domain yang sama atau daftarkan origin tambahan di ALLOWED_ORIGINS."
    }, 403));
  }

  let token;
  let webhookUrl;
  try {
    token = getTelegramBotToken(env);
    webhookUrl = getTelegramWebhookUrl(env);
  } catch (error) {
    return respond(json({ ok: false, error: String(error?.message || error) }, 503));
  }

  try {
    // Cek konfigurasi saat ini dahulu. Hindari setWebhook berulang jika sudah benar.
    const current = await tg(token, "getWebhookInfo", {});
    const previousWebhookUrl = String(current?.result?.url || "");
    const alreadyConfigured = previousWebhookUrl === webhookUrl;

    if (alreadyConfigured) {
      return respond(json({
        ok: true,
        alreadyConfigured: true,
        previousWebhookUrl,
        webhookUrl,
        webhookSource: "environment",
        message: "Webhook Telegram sudah mengarah ke alamat produksi yang benar."
      }));
    }

    const result = await tg(token, "setWebhook", {
      url: webhookUrl,
      secret_token: token.slice(-24),
      allowed_updates: ["callback_query"],
      drop_pending_updates: false
    });

    return respond(json({
      ok: true,
      alreadyConfigured: false,
      previousWebhookUrl,
      webhookUrl,
      webhookSource: "environment",
      result
    }));
  } catch (error) {
    return respond(json({
      ok: false,
      webhookUrl,
      error: String(error?.message || error).slice(0, 260)
    }, 502));
  }
}
