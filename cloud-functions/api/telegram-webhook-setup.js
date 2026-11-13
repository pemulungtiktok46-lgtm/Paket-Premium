import { createHash } from "node:crypto";
import { getStore } from "@edgeone/pages-blob";
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

const WEBHOOK_META_STORE = "agen-suatu-telegram-meta";
const WEBHOOK_META_KEY = "webhook_config_v1";
function webhookMetaStore() {
  return getStore({ name: WEBHOOK_META_STORE, consistency: "strong" });
}
async function readWebhookConfigHash() {
  const value = await webhookMetaStore().get(WEBHOOK_META_KEY, { type: "json", consistency: "strong" });
  return String(value?.configHash || "");
}
async function writeWebhookConfigHash(configHash) {
  await webhookMetaStore().setJSON(WEBHOOK_META_KEY, { configHash, updatedAt: new Date().toISOString() });
}

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

  // GET memeriksa endpoint callback aktif di Telegram. Tidak pernah mengembalikan token/secret.
  if (method === "GET") {
    try {
      const remote = await tg(token, "getWebhookInfo", {});
      const info = remote?.result || {};
      const active = String(info.url || "") === webhookUrl;
      return respond(json({
        ok: true,
        ready: true,
        connected: active,
        endpoint: "telegram-webhook-setup",
        method: "POST",
        telegramTokenConfigured: Boolean(token),
        telegramAdminIdConfigured: Boolean(adminId),
        telegramWebhookUrlConfigured: Boolean(webhookUrl),
        webhookUrl,
        activeWebhookUrl: String(info.url || ""),
        pendingUpdateCount: Number(info.pending_update_count || 0),
        lastErrorDate: info.last_error_date || null,
        lastErrorMessage: info.last_error_message || null,
        message: active ? "Webhook Telegram aktif dan URL sesuai Environment Variables." : "Webhook Telegram belum mengarah ke URL proyek ini. Jalankan POST untuk sinkronisasi."
      }));
    } catch (error) {
      return respond(json({ ok: false, ready: true, connected: false, error: String(error?.message || error).slice(0, 220) }, 502));
    }
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
    const configHash = createHash("sha256").update(`${webhookUrl}\n${webhookSecret}`).digest("hex");
    const previousConfigHash = await readWebhookConfigHash();
    const configUnchanged = previousConfigHash === configHash;
    const urlAlreadyMatches = previousWebhookUrl === webhookUrl;
    let result = { ok: true, description: "Webhook sudah sesuai; tidak perlu memasang ulang." };

    // Telegram tidak mengembalikan secret_token melalui getWebhookInfo.
    // Hash konfigurasi disimpan di Blob agar perubahan secret di Environment Variables
    // tetap terdeteksi tanpa pernah menyimpan atau mengirim secret mentah.
    if (!urlAlreadyMatches || !configUnchanged) {
      result = await tg(token, "setWebhook", {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["callback_query"],
        drop_pending_updates: false,
        max_connections: 1
      });
    }

    const verified = await tg(token, "getWebhookInfo", {});
    const verifiedInfo = verified?.result || {};
    if (String(verifiedInfo.url || "") !== webhookUrl) {
      throw new Error("Telegram belum mengonfirmasi URL webhook yang diminta. Periksa URL Environment Variables.");
    }

    await writeWebhookConfigHash(configHash);

    return respond(json({
      ok: true,
      connected: true,
      alreadyConfigured: urlAlreadyMatches && configUnchanged,
      webhookUpdated: !(urlAlreadyMatches && configUnchanged),
      previousWebhookUrl,
      webhookUrl,
      webhookSource: "environment",
      secretConfigured: true,
      pendingUpdateCount: Number(verifiedInfo.pending_update_count || 0),
      lastErrorDate: verifiedInfo.last_error_date || null,
      lastErrorMessage: verifiedInfo.last_error_message || null,
      result,
      message: verifiedInfo.last_error_message
        ? "Webhook aktif, tetapi Telegram melaporkan callback gagal. Periksa lastErrorMessage."
        : "Webhook Telegram aktif dan URL/secret sudah diverifikasi."
    }));
  } catch (error) {
    return respond(json({
      ok: false,
      webhookUrl,
      error: String(error?.message || error).slice(0, 260)
    }, 502));
  }
}
