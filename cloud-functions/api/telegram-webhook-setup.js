import { json, tg, cors, getValidatedOrigin } from "./_shared.js";

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Gunakan POST" }, 405);
  }

  // Endpoint hanya menerima pemanggilan dari halaman pada origin yang sama.
  // Kredensial bot tidak pernah dikirim ke browser; tetap dibaca dari Environment Variable.
  const origin = getValidatedOrigin(request);
  if (!origin) return cors(request, json({ ok: false, error: "Origin ditolak: host halaman tidak cocok dengan host backend." }, 403));

  const publicOrigin = new URL(origin);
  if (publicOrigin.protocol !== "https:") {
    return cors(request, json({ ok: false, error: "Webhook Telegram wajib menggunakan HTTPS." }, 400));
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return json({ ok: false, error: "TELEGRAM_BOT_TOKEN belum diatur pada server" }, 503);
  }

  // Ambil host dari Origin yang sudah tervalidasi. Jangan memakai X-Forwarded-Host
  // secara langsung karena header proxy bisa berisi host internal/daftar host.
  // Bila aplikasi punya beberapa alias domain, admin dapat mengunci satu URL produksi
  // melalui TELEGRAM_WEBHOOK_URL agar setiap alias tidak saling mengganti webhook.
  let webhookUrl = new URL("/api/telegram-webhook", publicOrigin).toString();
  let webhookSource = "request-origin";
  const configuredWebhookUrl = String(env.TELEGRAM_WEBHOOK_URL || "").trim();
  if (configuredWebhookUrl) {
    let configured;
    try {
      configured = new URL(configuredWebhookUrl);
    } catch (_) {
      return cors(request, json({
        ok: false,
        error: "TELEGRAM_WEBHOOK_URL bukan URL yang valid."
      }, 400));
    }
    if (
      configured.protocol !== "https:" ||
      configured.pathname !== "/api/telegram-webhook" ||
      configured.search || configured.hash || configured.username || configured.password
    ) {
      return cors(request, json({
        ok: false,
        error: "TELEGRAM_WEBHOOK_URL harus berupa URL HTTPS yang berakhir tepat di /api/telegram-webhook."
      }, 400));
    }
    webhookUrl = configured.toString();
    webhookSource = "environment";
  }

  try {
    // Selalu panggil setWebhook agar secret_token ikut diperbarui bila token bot
    // pernah diganti, walaupun URL webhook masih sama. Panggilan ini aman diulang.
    const current = await tg(token, "getWebhookInfo", {});
    const alreadyConfigured = String(current?.result?.url || "") === webhookUrl;
    const result = await tg(token, "setWebhook", {
      url: webhookUrl,
      secret_token: token.slice(-24),
      allowed_updates: ["callback_query"],
      drop_pending_updates: false
    });
    return cors(request, json({ ok: true, alreadyConfigured, webhookUrl, webhookSource, result }));
  } catch (error) {
    return cors(request, json({ ok: false, webhookUrl, error: String(error.message || error).slice(0, 180) }, 502));
  }
}
