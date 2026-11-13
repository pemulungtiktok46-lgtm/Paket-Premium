import { getStore } from "@edgeone/pages-blob";

// ID admin wajib berasal dari Environment Variables EdgeOne.
// Tidak ada ID bawaan di source code agar konfigurasi hanya dikelola dari server.
export function getAdminId(env = {}) {
  const configured = String(env?.TELEGRAM_ADMIN_ID || "").trim();
  if (!configured) {
    throw new Error("TELEGRAM_ADMIN_ID belum diatur pada Environment Variables EdgeOne.");
  }
  if (!/^-?\d+$/.test(configured)) {
    throw new Error("TELEGRAM_ADMIN_ID harus berupa angka ID chat Telegram.");
  }
  return configured;
}
export const BLOB_STORE_NAME = "agen-suatu-state";
export const BLOB_KEY = "agen_suatu_state_v1";

const defaultState = () => ({
  orderStatuses: {},
  topups: {},
  deletedOrderIds: [],
  lastUpdateId: 0
});

function store() {
  // Blob namespace dibuat otomatis saat pertama kali dipanggil.
  return getStore({ name: BLOB_STORE_NAME, consistency: "strong" });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}


// Validasi Origin menggunakan host publik yang diterima oleh EdgeOne.
// Pada reverse proxy, request.url dapat berisi host internal; karena itu
// bandingkan Origin dengan Host / X-Forwarded-Host dari request masuk.
export function getValidatedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    const requestUrl = new URL(request.url);
    const originHost = parsed.host.toLowerCase();
    const hosts = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      requestUrl.host
    ].filter(Boolean).flatMap(value => String(value).split(",").map(v => v.trim().toLowerCase()));
    const forwardedProto = String(request.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    const expectedProto = forwardedProto || requestUrl.protocol.replace(":", "").toLowerCase();

    // Domain resmi deployment EdgeOne yang digunakan aplikasi ini.
    // Tetap gunakan allowlist spesifik; jangan menerima Origin sembarang.
    const allowedOrigins = new Set([
      "https://quick-peach-pjst192a-dpxbcjbh4uoc.edgeone.dev",
      "https://quick-peach-pjst192a.edgeone.dev",
      "https://quick-peach-pjst192a-dprftk32626j.edgeone.dev"
    ]);
    if (allowedOrigins.has(parsed.origin.toLowerCase())) return parsed.origin;

    const protocolAllowed = parsed.protocol.replace(":", "").toLowerCase() === expectedProto
      || (parsed.protocol === "https:" && expectedProto === "http" && hosts.includes(originHost));
    return protocolAllowed && hosts.includes(originHost) ? parsed.origin : null;
  } catch (_) { return null; }
}

export function cors(request, response) {
  const origin = getValidatedOrigin(request);
  const headers = new Headers(response.headers);
  if (origin) headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  headers.set("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,x-telegram-bot-api-secret-token");
  return new Response(response.body, { status: response.status, headers });
}

export async function readState() {
  const data = await store().get(BLOB_KEY, { type: "json", consistency: "strong" });
  if (!data || typeof data !== "object" || Array.isArray(data)) return defaultState();

  return {
    ...defaultState(),
    ...data,
    orderStatuses: data.orderStatuses && typeof data.orderStatuses === "object" ? data.orderStatuses : {},
    topups: data.topups && typeof data.topups === "object" ? data.topups : {},
    deletedOrderIds: Array.isArray(data.deletedOrderIds) ? data.deletedOrderIds : []
  };
}

export async function writeState(state) {
  await store().setJSON(BLOB_KEY, state);
}

export async function tg(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram HTTP ${response.status}`);
  }
  return data;
}
