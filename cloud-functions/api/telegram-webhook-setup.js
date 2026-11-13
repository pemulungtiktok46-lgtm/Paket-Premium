import {
  json,
  tg,
  cors,
  getValidatedOrigin,
  TELEGRAM_WEBHOOK_ORIGIN
} from "./_shared.js";

const WEBHOOK_PATH = "/api/telegram-webhook";
const CANONICAL_WEBHOOK_URL = `${TELEGRAM_WEBHOOK_ORIGIN}${WEBHOOK_PATH}`;

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return cors(request, new Response(null, { status: 204 }));
  }
  if (request.method !== "POST") {
    return cors(request, json({
      ok: false,
      error: "Gunakan POST ke /api/telegram-webhook-setup. Endpoint ini bukan halaman untuk dibuka langsung."
    }, 405));
  }

  // Setup harus dipanggil oleh halaman aplikasi dari origin yang tervalidasi.
  // Token Telegram hanya dibaca di server, tidak pernah dikirim ke browser.
  const origin = getValidatedOrigin(request);
  if (!origin) {
    return cors(request, json({
      ok: false,
      error: "Origin ditolak. Buka aplikasi dari domain EdgeOne yang benar dan gunakan endpoint API same-origin."
    }, 403));
  }

  const pageOrigin = new URL(origin);
  if (pageOrigin.protocol !== "https:") {
    return cors(request, json({ ok: false, error: "Webhook Telegram wajib menggunakan HTTPS." }, 400));
  }

  const token = String(env?.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    return cors(request, json({ ok: false, error: "TELEGRAM_BOT_TOKEN belum diatur pada Environment Variables EdgeOne." }, 503));
  }

  // Domain callback dikunci ke domain produksi yang sudah dipilih.
  // Env var bersifat opsional; bila diisi, nilainya harus tepat agar konfigurasi
  // lama yang masih menunjuk alias/URL setup tidak diam-diam mengganti webhook.
  const configuredWebhookUrl = String(env?.TELEGRAM_WEBHOOK_URL || "").trim();
  let webhookUrl = CANONICAL_WEBHOOK_URL;
  let webhookSource = "fixed-production-domain";

  if (configuredWebhookUrl) {
    let configured;
    try {
      configured = new URL(configuredWebhookUrl);
    } catch (_) {
      return cors(request, json({
        ok: false,
        error: "TELEGRAM_WEBHOOK_URL tidak valid. Isi tepat: " + CANONICAL_WEBHOOK_URL
      }, 400));
    }

    if (
      configured.protocol !== "https:" ||
      configured.origin !== TELEGRAM_WEBHOOK_ORIGIN ||
      configured.pathname !== WEBHOOK_PATH ||
      configured.search || configured.hash || configured.username || configured.password
    ) {
      return cors(request, json({
        ok: false,
        error: "TELEGRAM_WEBHOOK_URL harus sama persis dengan " + CANONICAL_WEBHOOK_URL + ". Hapus atau perbaiki nilai lama di Environment Variables."
      }, 400));
    }

    webhookUrl = configured.toString();
    webhookSource = "environment-validated";
  }

  try {
    // Baca konfigurasi sebelumnya untuk diagnostik, lalu setWebhook dengan target
    // tetap. Operasi aman diulang dan tidak membuang update yang masih mengantre.
    const current = await tg(token, "getWebhookInfo", {});
    const previousWebhookUrl = String(current?.result?.url || "");
    const alreadyConfigured = previousWebhookUrl === webhookUrl;

    const result = await tg(token, "setWebhook", {
      url: webhookUrl,
      secret_token: token.slice(-24),
      allowed_updates: ["callback_query"],
      drop_pending_updates: false
    });

    return cors(request, json({
      ok: true,
      alreadyConfigured,
      previousWebhookUrl,
      webhookUrl,
      webhookSource,
      result
    }));
  } catch (error) {
    return cors(request, json({
      ok: false,
      webhookUrl,
      error: String(error?.message || error).slice(0, 220)
    }, 502));
  }
}
