import { createHash } from "node:crypto";
import { json, cors, readState, getValidatedOrigin } from "./_shared.js";
import { ensureVapidKeys, readPushState, writePushState } from "./_push.js";

function endpointKey(endpoint) {
  return createHash("sha256").update(String(endpoint)).digest("hex");
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return cors(request, new Response(null, { status: 204 }));
  if (request.method !== "POST") return cors(request, json({ ok: false, error: "Gunakan POST" }, 405));

  const requestOrigin = getValidatedOrigin(request);
  if (!requestOrigin) return cors(request, json({ ok: false, error: "Origin ditolak: host halaman tidak cocok dengan host backend." }, 403));

  try {
    const body = await request.json();
    const subscription = body?.subscription;
    const endpoint = String(subscription?.endpoint || "");
    const p256dh = String(subscription?.keys?.p256dh || "");
    const auth = String(subscription?.keys?.auth || "");
    const orderId = String(body?.orderId || "").trim().slice(0, 80);
    const requestId = String(body?.requestId || "").trim().slice(0, 80);

    if (!endpoint.startsWith("https://") || !p256dh || !auth || (!orderId && !requestId)) {
      return cors(request, json({ ok: false, error: "Data langganan atau ID transaksi tidak lengkap" }, 400));
    }

    const orderState = await readState();
    if (orderId && !orderState.orderStatuses?.[orderId]) {
      return cors(request, json({ ok: false, error: "ID pesanan belum terdaftar di server. Buka kembali transaksi lalu coba lagi." }, 404));
    }
    if (requestId && !orderState.topups?.[requestId]) {
      return cors(request, json({ ok: false, error: "ID top-up belum terdaftar di server. Kirim permintaan top-up terlebih dahulu." }, 404));
    }

    // Pastikan VAPID sudah tersimpan sebelum subscription disimpan.
    await ensureVapidKeys(`${requestOrigin}/`);
    const state = await readPushState();

    const key = endpointKey(endpoint);
    const current = state.subscriptions?.[key] || {};
    const orderIds = new Set(Array.isArray(current.orderIds) ? current.orderIds : []);
    const topupIds = new Set(Array.isArray(current.topupIds) ? current.topupIds : []);
    if (orderId) orderIds.add(orderId);
    if (requestId) topupIds.add(requestId);

    state.subscriptions ||= {};
    state.subscriptions[key] = {
      subscription: { endpoint, keys: { p256dh, auth } },
      orderIds: Array.from(orderIds).slice(-50),
      topupIds: Array.from(topupIds).slice(-50),
      updatedAt: new Date().toISOString()
    };

    await writePushState(state);
    return cors(request, json({
      ok: true,
      saved: true,
      orderLinked: Boolean(orderId),
      topupLinked: Boolean(requestId),
      message: "Notifikasi berhasil diaktifkan untuk transaksi ini."
    }));
  } catch (error) {
    return cors(request, json({
      ok: false,
      error: String(error?.message || error).slice(0, 180)
    }, 503));
  }
}
