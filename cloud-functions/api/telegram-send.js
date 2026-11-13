import {
  json,
  cors,
  getAdminId,
  getValidatedOrigin
} from './_shared.js';

/**
 * Endpoint pengiriman pesanan Agen Suatu.
 * GET  : pemeriksaan endpoint dan Environment Variables (tanpa membocorkan token).
 * POST : kirim foto + caption pesanan ke chat admin melalui Telegram sendPhoto.
 *
 * Environment Variables wajib:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_ADMIN_ID
 * TELEGRAM_WEBHOOK_URL tidak diperlukan untuk pengiriman pesan keluar.
 */
export async function onRequest({ request, env }) {
  const respond = (response) => cors(request, response, env);
  const method = String(request.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return respond(new Response(null, { status: 204 }));
  }

  const origin = request.headers.get('origin');
  if (origin && !getValidatedOrigin(request, env)) {
    return respond(json({
      ok: false,
      error: 'Origin ditolak: alamat halaman tidak cocok dengan host API ini.'
    }, 403));
  }

  const token = String(env?.TELEGRAM_BOT_TOKEN || '').trim();
  let adminId = '';
  let adminError = '';
  try {
    adminId = getAdminId(env);
  } catch (error) {
    adminError = String(error?.message || error);
  }

  // Pemeriksaan GET aman: hanya memberikan status konfigurasi, tidak mengirim pesan
  // dan tidak pernah mengembalikan token maupun ID chat lengkap.
  if (method === 'GET') {
    const ready = Boolean(token && adminId);
    return respond(json({
      ok: true,
      endpoint: 'telegram-send',
      method: 'POST',
      accepts: 'multipart/form-data',
      telegramTokenConfigured: Boolean(token),
      telegramAdminIdConfigured: Boolean(adminId),
      ready,
      message: ready
        ? 'Endpoint Telegram siap menerima pesanan.'
        : (!token
            ? 'Environment Variable TELEGRAM_BOT_TOKEN belum diisi.'
            : (adminError || 'TELEGRAM_ADMIN_ID belum valid.'))
    }));
  }

  if (method !== 'POST') {
    return respond(json({
      ok: false,
      error: 'Gunakan POST untuk mengirim pesanan atau GET untuk memeriksa konfigurasi.'
    }, 405));
  }

  if (!token) {
    return respond(json({
      ok: false,
      error: 'TELEGRAM_BOT_TOKEN belum diatur pada Environment Variables proyek EdgeOne ini.'
    }, 503));
  }

  if (!adminId) {
    return respond(json({
      ok: false,
      error: adminError || 'TELEGRAM_ADMIN_ID belum diatur dengan benar.'
    }, 503));
  }

  let form;
  try {
    form = await request.formData();
  } catch (error) {
    return respond(json({
      ok: false,
      error: 'Data pesanan bukan multipart/form-data yang valid.'
    }, 400));
  }

  const photo = form.get('photo');
  if (!photo || typeof photo.arrayBuffer !== 'function' || Number(photo.size || 0) < 1) {
    return respond(json({
      ok: false,
      error: 'Foto bukti pesanan tidak ditemukan atau kosong.'
    }, 400));
  }

  // Chat tujuan dikunci dari Environment Variable server, bukan input browser.
  form.set('chat_id', adminId);

  let telegramResponse;
  try {
    telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form
    });
  } catch (error) {
    const cause = error?.cause || {};
    const detail = [cause.code, cause.name, error?.message]
      .filter(Boolean).map(String).join(' / ').slice(0, 180);
    return respond(json({
      ok: false,
      error: `EdgeOne gagal terhubung ke api.telegram.org. ${detail || 'Periksa koneksi keluar server.'}`
    }, 502));
  }

  let telegramData;
  try {
    telegramData = await telegramResponse.json();
  } catch (_) {
    return respond(json({
      ok: false,
      error: `Telegram mengirim respons tidak valid (HTTP ${telegramResponse.status}).`
    }, 502));
  }

  if (!telegramResponse.ok || telegramData?.ok !== true) {
    return respond(json({
      ok: false,
      error: String(telegramData?.description || `Telegram HTTP ${telegramResponse.status}`).slice(0, 220),
      error_code: telegramData?.error_code || telegramResponse.status
    }, 502));
  }

  return respond(json(telegramData, 200));
}
