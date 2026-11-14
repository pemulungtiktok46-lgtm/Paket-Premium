import webpush from "web-push";
import { getStore } from "@edgeone/pages-blob";

const PUSH_STORE_NAME = "agen-suatu-web-push";
const PUSH_STORE_KEY = "web_push_state_v1";
const DEFAULT_VAPID_SUBJECT = "https://pages.edgeone.ai/";

function pushStore() {
  return getStore({ name: PUSH_STORE_NAME, consistency: "strong" });
}

export async function readPushState() {
  const data = await pushStore().get(PUSH_STORE_KEY, { type: "json", consistency: "strong" });
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { vapidKeys: null, subscriptions: {} };
  }
  return {
    vapidKeys: data.vapidKeys && typeof data.vapidKeys === "object" ? data.vapidKeys : null,
    subscriptions: data.subscriptions && typeof data.subscriptions === "object" && !Array.isArray(data.subscriptions)
      ? data.subscriptions
      : {}
  };
}

export async function writePushState(state) {
  await pushStore().setJSON(PUSH_STORE_KEY, {
    vapidKeys: state.vapidKeys || null,
    subscriptions: state.subscriptions || {}
  });
}

/**
 * VAPID pair is generated once and kept private in a dedicated EdgeOne Blob.
 * Only the public key is returned to browsers. No extra dashboard variable is
 * required for Web Push; Telegram's token remains in its existing environment variable.
 */
export async function ensureVapidKeys(subject = DEFAULT_VAPID_SUBJECT) {
  let state = await readPushState();
  if (state.vapidKeys?.publicKey && state.vapidKeys?.privateKey) {
    return state.vapidKeys;
  }

  const generated = webpush.generateVAPIDKeys();
  state.vapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: String(subject || DEFAULT_VAPID_SUBJECT),
    createdAt: new Date().toISOString()
  };
  await writePushState(state);

  // The owner should initialize this endpoint once before customers subscribe.
  state = await readPushState();
  return state.vapidKeys || {
    ...generated,
    subject: String(subject || DEFAULT_VAPID_SUBJECT)
  };
}

function payloadForOrder(orderId, status, handler, updatedAt) {
  const id = String(orderId || "");
  const body = status === "diproses"
    ? `Pesanan ${id} sedang diproses${handler ? ` oleh ${handler}` : ""}.`
    : status === "sukses"
      ? `Pesanan ${id} telah selesai.`
      : status === "gagal"
        ? `Pesanan ${id} dibatalkan oleh admin.`
        : `Status pesanan ${id} diperbarui.`;
  return {
    kind: "order",
    orderId: id,
    status: String(status || ""),
    handler: String(handler || ""),
    updatedAt: String(updatedAt || new Date().toISOString()),
    title: status === "diproses" ? "Agen Suatu • Pesanan Diproses" : status === "sukses" ? "Agen Suatu • Pesanan Selesai" : "Agen Suatu • Pesanan Gagal",
    body,
    tag: `agen-order-${id}-${status}`,
    url: "/",
    priority: "high",
    soundProfile: "urgent"
  };
}

function payloadForTopup(requestId, status, updatedAt) {
  const id = String(requestId || "");
  return {
    kind: "topup",
    requestId: id,
    status: String(status || ""),
    updatedAt: String(updatedAt || new Date().toISOString()),
    title: "Agen Suatu • Isi Saldo",
    body: status === "sukses"
      ? `Permintaan isi saldo ${id} telah disetujui admin.`
      : `Permintaan isi saldo ${id} ditolak admin.`,
    tag: `agen-topup-${id}-${status}`,
    url: "/",
    priority: "high",
    soundProfile: "urgent"
  };
}


function payloadForPayment(orderId, updatedAt) {
  const id=String(orderId||'');
  return {
    kind:'payment', orderId:id, status:'lunas', updatedAt:String(updatedAt||new Date().toISOString()),
    title:'Agen Suatu • Pembayaran Lunas',
    body:`Pembayaran transaksi ${id} telah dikonfirmasi lunas.`,
    tag:`agen-payment-${id}-lunas-${Date.now()}`, url:'/', priority:'high', soundProfile:'urgent'
  };
}

async function deliverPush(matchField, matchValue, payload) {
  if (!matchValue) return { sent: 0, stale: 0, skipped: true };

  const state = await readPushState();
  const keys = state.vapidKeys;
  if (!keys?.publicKey || !keys?.privateKey) {
    return { sent: 0, stale: 0, skipped: true, reason: "vapid-not-ready" };
  }

  webpush.setVapidDetails(
    keys.subject || DEFAULT_VAPID_SUBJECT,
    keys.publicKey,
    keys.privateKey
  );

  let sent = 0;
  let stale = 0;
  let changed = false;
  const targets = Object.entries(state.subscriptions || {}).filter(([, item]) => {
    const linked = Array.isArray(item?.[matchField]) ? item[matchField] : [];
    return linked.includes(String(matchValue)) && Boolean(item?.subscription?.endpoint);
  });

  // Jangan kirim satu per satu: beberapa perangkat/instalasi dapat diproses
  // bersamaan sehingga pelanggan tidak menunggu perangkat pelanggan lain.
  const results = await Promise.allSettled(targets.map(async ([key, item]) => {
    try {
      await webpush.sendNotification(item.subscription, JSON.stringify(payload), {
        TTL: 21600, // simpan hingga 6 jam saat perangkat sementara offline
        urgency: 'high'
      });
      return { key, ok: true };
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status || 0);
      return { key, ok: false, stale: statusCode === 404 || statusCode === 410, statusCode };
    }
  }));

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    if (result.value.ok) sent += 1;
    else if (result.value.stale) {
      delete state.subscriptions[result.value.key];
      stale += 1;
      changed = true;
    }
  }

  if (changed) await writePushState(state);
  return { sent, stale, skipped: false };
}

export function sendOrderPush(orderId, status, handler = "", updatedAt = "") {
  return deliverPush("orderIds", orderId, payloadForOrder(orderId, status, handler, updatedAt));
}

export function sendTopupPush(requestId, status, updatedAt = "") {
  return deliverPush("topupIds", requestId, payloadForTopup(requestId, status, updatedAt));
}

export function sendOrderPaymentPush(orderId, updatedAt = "") {
  return deliverPush("orderIds", orderId, payloadForPayment(orderId, updatedAt));
}
