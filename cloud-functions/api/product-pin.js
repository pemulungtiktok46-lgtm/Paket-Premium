import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@edgeone/pages-blob";
import { json, cors, getValidatedOrigin } from "./_shared.js";

const STORE_NAME = "agen-suatu-state";
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000;
const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const SESSION_COOKIE = "agenProductPinSession";

function getPinStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function pinMatches(provided, configured) {
  const left = Buffer.from(String(provided), "utf8");
  const right = Buffer.from(String(configured), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function readSessionCookie(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== SESSION_COOKIE) continue;
    const value = rest.join("=");
    return /^[a-f0-9]{48,64}$/i.test(value) ? value : "";
  }
  return "";
}

function withSessionCookie(response, sessionId) {
  const headers = new Headers(response.headers);
  headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${sessionId}; Max-Age=1800; Path=/api/product-pin; Secure; HttpOnly; SameSite=Lax`
  );
  return new Response(response.body, { status: response.status, headers });
}

function safeScope(value) {
  return value === "ewallet" ? "ewallet" : "product";
}

export async function onRequest({ request, env }) {
  const respond = (response, sessionId = "") => {
    const withCookie = sessionId ? withSessionCookie(response, sessionId) : response;
    return cors(request, withCookie, env);
  };

  if (request.method === "OPTIONS") {
    return respond(new Response(null, { status: 204 }));
  }
  if (!["GET", "POST"].includes(request.method)) {
    return respond(json({ ok: false, error: "Gunakan GET atau POST." }, 405));
  }

  const origin = request.headers.get("origin");
  if (origin && !getValidatedOrigin(request, env)) {
    return respond(json({ ok: false, error: "Origin ditolak." }, 403));
  }

  const productPin = String(env?.PRODUCT_PIN || "").trim();
  const ewalletPin = String(env?.EWALLET_PIN || "").trim();
  const productDigitsValid = /^\d{6}$/.test(productPin);
  const ewalletDigitsValid = /^\d{6}$/.test(ewalletPin);
  const pinsDistinct = productPin !== ewalletPin;
  const productReady = productDigitsValid && pinsDistinct;
  const ewalletReady = ewalletDigitsValid && pinsDistinct;

  if (request.method === "GET") {
    const allReady = productReady && ewalletReady;
    let lockInfo = { locked: false, lockUntil: null };
    const sessionId = readSessionCookie(request);
    if (sessionId) {
      try {
        const sessionHash = createHash("sha256").update(sessionId).digest("hex");
        const state = await getPinStore().get(`product_pin_global_lock_${sessionHash}`, { type: "json", consistency: "strong" });
        const lockUntil = Number(state?.lockUntil || 0);
        if (lockUntil > Date.now()) lockInfo = { locked: true, lockUntil };
      } catch (_) {
        // Status kesiapan PIN tetap dapat dibaca meskipun pembacaan status sesi sedang gagal.
      }
    }
    return respond(json({
      ok: true,
      endpoint: "product-pin",
      ready: allReady,
      productReady,
      ewalletReady,
      pinsDistinct,
      ...lockInfo,
      message: allReady
        ? "PIN produk dan E-Wallet siap."
        : "Atur PRODUCT_PIN dan EWALLET_PIN masing-masing tepat 6 digit dan gunakan nilai yang berbeda."
    }), sessionId);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return respond(json({ ok: false, error: "Data verifikasi tidak valid." }, 400));
  }

  const scope = safeScope(body?.scope);
  const configuredPin = scope === "ewallet" ? ewalletPin : productPin;
  const configured = scope === "ewallet" ? ewalletReady : productReady;
  const pin = String(body?.pin ?? "");
  const challengeId = String(body?.challengeId ?? "");

  if (!configured) {
    return respond(json({
      ok: false,
      error: scope === "ewallet"
        ? "PIN E-Wallet belum diaktifkan di server. Hubungi admin."
        : "PIN produk belum diaktifkan di server. Hubungi admin."
    }, 503));
  }
  if (!/^\d{6}$/.test(pin) || !/^[a-f0-9]{48,64}$/i.test(challengeId)) {
    return respond(json({ ok: false, error: "PIN harus 6 digit dan sesi verifikasi tidak valid." }, 400));
  }

  try {
    const sessionId = readSessionCookie(request) || challengeId;
    const sessionHash = createHash("sha256").update(sessionId).digest("hex");
    const globalLockKey = `product_pin_global_lock_${sessionHash}`;
    const attemptKey = `product_pin_attempt_global_${sessionHash}`;
    const store = getPinStore();
    const now = Date.now();

    const globalLock = await store.get(globalLockKey, { type: "json", consistency: "strong" });
    const lockUntil = Number(globalLock?.lockUntil || 0);
    if (lockUntil > now) {
      return respond(json({
        ok: true,
        valid: false,
        locked: true,
        lockUntil,
        remainingLockMs: lockUntil - now,
        attempts: MAX_ATTEMPTS,
        remainingAttempts: 0
      }), sessionId);
    }
    if (lockUntil && lockUntil <= now) {
      // Reset the shared attempt counter after the global cooldown expires.
      await store.setJSON(attemptKey, {
        attempts: 0,
        expiresAt: now + CHALLENGE_TTL_MS,
        resetAfterLockAt: new Date(now).toISOString()
      });
    }

    let state = await store.get(attemptKey, { type: "json", consistency: "strong" });
    if (!state || typeof state !== "object" || Number(state.expiresAt || 0) <= now) {
      state = { attempts: 0, expiresAt: now + CHALLENGE_TTL_MS };
    }
    const attempts = Math.max(0, Math.min(MAX_ATTEMPTS, Number(state.attempts) || 0));

    if (pinMatches(pin, configuredPin)) {
      await store.setJSON(attemptKey, {
        attempts: 0,
        verifiedAt: now,
        expiresAt: now + CHALLENGE_TTL_MS
      });
      return respond(json({
        ok: true,
        valid: true,
        locked: false,
        scope,
        remainingAttempts: MAX_ATTEMPTS
      }), sessionId);
    }

    const nextAttempts = attempts + 1;
    const shouldLock = nextAttempts >= MAX_ATTEMPTS;
    const nextLockUntil = shouldLock ? now + LOCKOUT_MS : 0;
    await store.setJSON(attemptKey, {
      attempts: nextAttempts,
      expiresAt: now + CHALLENGE_TTL_MS,
      updatedAt: new Date(now).toISOString()
    });
    if (shouldLock) {
      await store.setJSON(globalLockKey, {
        lockUntil: nextLockUntil,
        reason: "three_failed_pin_attempts",
        scope,
        updatedAt: new Date(now).toISOString()
      });
    }

    return respond(json({
      ok: true,
      valid: false,
      locked: shouldLock,
      lockUntil: nextLockUntil || null,
      attempts: nextAttempts,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextAttempts)
    }), sessionId);
  } catch (error) {
    return respond(json({
      ok: false,
      error: "Server verifikasi PIN belum siap. Coba kembali beberapa saat lagi."
    }, 503));
  }
}
