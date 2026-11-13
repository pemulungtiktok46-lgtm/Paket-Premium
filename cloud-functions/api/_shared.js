import { getStore } from "@edgeone/pages-blob";

export const BLOB_STORE_NAME = "agen-suatu-state";
export const BLOB_KEY = "agen_suatu_state_v1";
export const TELEGRAM_WEBHOOK_PATH = "/api/telegram-webhook";

const defaultState = () => ({
  orderStatuses: {},
  topups: {},
  deletedOrderIds: [],
  lastUpdateId: 0,
  lastWebhookAt: '',
  lastWebhookUpdateId: 0,
  lastWebhookAction: '',
  telegramWebhookConfigHash: ''
});

function store() {
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

export function getTelegramBotToken(env = {}) {
  const token = String(env?.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum diatur pada Environment Variables EdgeOne.");
  return token;
}

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

/**
 * Satu-satunya alamat produksi Telegram berasal dari Environment Variables.
 * Wajib berupa HTTPS dan path callback yang tepat; tidak ada domain fallback di source.
 */
export function getTelegramWebhookUrl(env = {}) {
  const raw = String(env?.TELEGRAM_WEBHOOK_URL || "").trim();
  if (!raw) {
    throw new Error("TELEGRAM_WEBHOOK_URL belum diatur. Isi URL lengkap yang berakhir dengan /api/telegram-webhook.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new Error("TELEGRAM_WEBHOOK_URL bukan URL yang valid.");
  }

  if (
    url.protocol !== "https:" ||
    url.pathname !== TELEGRAM_WEBHOOK_PATH ||
    url.search || url.hash || url.username || url.password
  ) {
    throw new Error(`TELEGRAM_WEBHOOK_URL harus HTTPS dan berakhir tepat dengan ${TELEGRAM_WEBHOOK_PATH}.`);
  }

  return url.toString();
}

/**
 * Secret callback Telegram dikelola terpisah melalui Environment Variables.
 * Nilainya tidak pernah dikirim ke browser atau dimasukkan ke respons API.
 */
export function getTelegramWebhookSecret(env = {}) {
  const secret = String(env?.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET belum diatur pada Environment Variables EdgeOne.");
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET hanya boleh berisi huruf, angka, garis bawah, atau tanda hubung (1-256 karakter).");
  }
  return secret;
}

function configuredAllowedOrigins(env = {}) {
  const raw = String(env?.ALLOWED_ORIGINS || "");
  const origins = new Set();
  for (const item of raw.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(item);
      if (parsed.protocol === "https:" && parsed.origin === item.replace(/\/$/, "")) {
        origins.add(parsed.origin.toLowerCase());
      }
    } catch (_) {
      // Entri yang tidak valid diabaikan; tidak pernah memperluas akses.
    }
  }
  try {
    origins.add(new URL(getTelegramWebhookUrl(env)).origin.toLowerCase());
  } catch (_) {
    // Endpoint selain setup tetap dapat memvalidasi permintaan same-origin.
  }
  return origins;
}

/**
 * Origin diterima bila:
 * 1) tepat terdaftar di ALLOWED_ORIGINS / origin TELEGRAM_WEBHOOK_URL; atau
 * 2) same-origin dengan host yang sedang menerima request pada EdgeOne.
 * Dengan begitu alias EdgeOne tidak perlu ditulis satu per satu di source.
 */
export function getValidatedOrigin(request, env = {}) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return null;
    const normalizedOrigin = parsed.origin.toLowerCase();

    if (configuredAllowedOrigins(env).has(normalizedOrigin)) {
      return parsed.origin;
    }

    const requestUrl = new URL(request.url);
    const requestHosts = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
      requestUrl.host
    ].filter(Boolean).flatMap(value =>
      String(value).split(",").map(part => part.trim().toLowerCase())
    );

    // Origin dari browser wajib HTTPS. Host dibandingkan dengan host request
    // karena request.url pada reverse proxy kadang memakai protokol internal HTTP.
    return requestHosts.includes(parsed.host.toLowerCase()) ? parsed.origin : null;
  } catch (_) {
    return null;
  }
}

export function cors(request, response, env = {}) {
  const origin = getValidatedOrigin(request, env);
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

export async function tg(token, method, payload, timeoutMs = 8000) {
  const endpoint = `https://api.telegram.org/bot${token}/${method}`;
  let response;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(1500, Math.min(15000, Number(timeoutMs) || 8000))) : null;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      ...(controller ? { signal: controller.signal } : {})
    });
  } catch (error) {
    const cause = error?.cause || {};
    const detail = [cause.code, cause.name, error?.name === "AbortError" ? "timeout" : error?.message]
      .filter(Boolean).map(String).join(" / ").slice(0, 180);
    throw new Error(`Koneksi EdgeOne ke api.telegram.org gagal. Detail: ${detail || "fetch failed"}`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error(`Telegram mengirim respons yang bukan JSON (HTTP ${response.status}).`);
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram HTTP ${response.status}`);
  }
  return data;
}
