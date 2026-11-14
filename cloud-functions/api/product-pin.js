import { createHash, timingSafeEqual } from "node:crypto";
import { getStore } from "@edgeone/pages-blob";
import { json, cors, getValidatedOrigin } from "./_shared.js";

const STORE_NAME = "agen-suatu-state";
const MAX_ATTEMPTS = 3;
const CHALLENGE_TTL_MS = 15 * 60 * 1000;
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
    `${SESSION_COOKIE}=${sessionId}; Max-Age=900; Path=/api/product-pin; Secure; HttpOnly; SameSite=Lax`
  );
  return new Response(response.body, { status: response.status, headers });
}

export async function onRequest({ request, env }) {
  const respond = (response, sessionId = "") => {
    const withCookie = sessionId ? withSessionCookie(response, sessionId) : response;
    return cors(request, withCookie, env);
  };

  if (request.method === "OPTIONS") {
    return respond(new Response(null, { status: 204 }));
  }

  if (! ["GET", "POST"].includes(request.method)) {
    return respond(json({ ok: false, error: "Gunakan GET atau POST." }, 405));
  }

  const origin = request.headers.get("origin");
  if (origin && !getValidatedOrigin(request, env)) {
    return respond(json({ ok: false, error: "Origin ditolak." }, 403));
  }

  const configuredPin = String(env?.PRODUCT_PIN || "").trim();
  const configured = /^\d{6}$/.test(configuredPin);

  if (request.method === "GET") {
    return respond(json({
      ok: true,
      endpoint: "product-pin",
      ready: configured,
      message: configured ? "Verifikasi PIN produk siap." : "PRODUCT_PIN belum diatur dengan 6 digit di Environment Variables."
    }));
  }

  if (!configured) {
    return respond(json({
      ok: false,
      error: "PIN produk belum diaktifkan di server. Hubungi admin."
    }, 503));
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return respond(json({ ok: false, error: "Data verifikasi tidak valid." }, 400));
  }

  const pin = String(body?.pin ?? "");
  const challengeId = String(body?.challengeId ?? "");
  if (!/^\d{6}$/.test(pin) || !/^[a-f0-9]{48,64}$/i.test(challengeId)) {
    return respond(json({ ok: false, error: "PIN harus 6 digit dan sesi verifikasi tidak valid." }, 400));
  }

  try {
    // Cookie HttpOnly bertahan ketika localStorage dibersihkan. challengeId menjadi
    // fallback untuk browser yang belum mengirim cookie pada permintaan pertama.
    const sessionId = readSessionCookie(request) || challengeId;
    const challengeHash = createHash("sha256").update(sessionId).digest("hex");
    const key = `product_pin_challenge_${challengeHash}`;
    const pinStore = getPinStore();
    const now = Date.now();
    let state = await pinStore.get(key, { type: "json", consistency: "strong" });
    if (!state || typeof state !== "object" || Number(state.expiresAt || 0) <= now) {
      state = { attempts: 0, expiresAt: now + CHALLENGE_TTL_MS };
    }

    const attempts = Math.max(0, Math.min(MAX_ATTEMPTS, Number(state.attempts) || 0));
    if (attempts >= MAX_ATTEMPTS) {
      return respond(json({ ok: true, valid: false, locked: true, attempts: MAX_ATTEMPTS, remainingAttempts: 0 }), sessionId);
    }

    if (pinMatches(pin, configuredPin)) {
      // Catat sesi sukses singkat tanpa menyimpan PIN atau mengirim nilainya kembali.
      await pinStore.setJSON(key, {
        attempts: 0,
        verifiedAt: now,
        expiresAt: now + CHALLENGE_TTL_MS
      });
      return respond(json({ ok: true, valid: true, locked: false, remainingAttempts: MAX_ATTEMPTS }), sessionId);
    }

    const nextAttempts = attempts + 1;
    await pinStore.setJSON(key, {
      attempts: nextAttempts,
      expiresAt: now + CHALLENGE_TTL_MS,
      updatedAt: new Date(now).toISOString()
    });

    return respond(json({
      ok: true,
      valid: false,
      locked: nextAttempts >= MAX_ATTEMPTS,
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
