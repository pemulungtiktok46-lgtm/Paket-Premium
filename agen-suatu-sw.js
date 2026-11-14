/* Agen Suatu - Offline Order Queue / Background Sync
 * Harus berada satu direktori dengan HTML dan di-host melalui HTTPS.
 * Pengiriman POST hanya diulang untuk penolakan eksplisit Telegram 429.
 * Timeout/network error dianggap ambiguous (uncertain) agar tidak terjadi order ganda.
 */
'use strict';

const DB_NAME = 'AgenSuatuOrderQueueDB';
const STORE_NAME = 'orders';
const SETTINGS_STORE = 'settings';
const SYNC_TAG = 'agen-suatu-order-sync';
const AGEN_SW_BUILD = '2026-11-14-v15.3.6-realtime-history';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'orderId' });
      }
      if (!request.result.objectStoreNames.contains(SETTINGS_STORE)) {
        request.result.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka antrean transaksi.'));
    request.onblocked = () => reject(new Error('Database antrean sedang diblokir tab lain.'));
  });
}

async function getAllJobs() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error('Gagal membaca antrean.'));
  });
}

async function updateJob(orderId, updater) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(String(orderId));
    let result = null;
    request.onsuccess = () => {
      if (!request.result) return;
      result = { ...updater({ ...request.result }), queueUpdatedAt: new Date().toISOString() };
      if (result) store.put(result);
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Gagal memperbarui status antrean.'));
    tx.onabort = () => reject(tx.error || new Error('Pembaruan antrean dibatalkan.'));
  });
}

async function claimQueuedJob(orderId) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(String(orderId));
    let claimed = null;
    request.onsuccess = () => {
      const job = request.result;
      if (!job || job.status !== 'queued') return;
      if (Number(job.nextAttemptAt || 0) > Date.now()) return;
      claimed = { ...job, status: 'sending', sendingAt: Date.now(), queueUpdatedAt: new Date().toISOString(), attempts: (Number(job.attempts) || 0) + 1 };
      store.put(claimed);
    };
    tx.oncomplete = () => resolve(claimed);
    tx.onerror = () => reject(tx.error || new Error('Gagal mengunci antrean transaksi.'));
    tx.onabort = () => reject(tx.error || new Error('Kunci antrean dibatalkan.'));
  });
}

async function notifyClients(job) {
  try {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      client.postMessage({ type: 'AGEN_ORDER_QUEUE_UPDATED', orderId: job?.orderId || null, status: job?.status || null });
    }
  } catch (error) { /* status tetap aman di IndexedDB */ }
}

async function ensureBackgroundSync() {
  try {
    if (self.registration.sync && typeof self.registration.sync.register === 'function') {
      await self.registration.sync.register(SYNC_TAG);
    }
  } catch (error) { /* browser mungkin tidak menyediakan Background Sync */ }
}

async function syncWalletSnapshot(job) {
  if (!job.walletApiBase || !job.walletMember || !job.walletStateAfter) {
    return { walletSynced: true, walletSyncPending: false, walletSyncConflict: false };
  }
  const base = String(job.walletApiBase).replace(/\/+$/, '');
  const member = encodeURIComponent(job.walletMember);
  const timeout = (url, options, ms = 12000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  try {
    const readResponse = await timeout(`${base}/state?member=${member}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const remotePayload = await readResponse.json();
    if (!readResponse.ok || remotePayload?.ok === false) throw new Error(remotePayload?.message || `HTTP ${readResponse.status}`);
    const remote = remotePayload.state || remotePayload.data?.state || null;
    const local = job.walletStateAfter;
    const orderId = String(job.orderId);
    const remoteLedger = Array.isArray(remote?.ledger) ? remote.ledger : [];
    const debitExists = remoteLedger.some(entry => entry && (entry.type === 'order_debit' || entry.type === 'point_debit') && (entry.reference === orderId || entry.id === orderId || entry.id === `PTD-${orderId}`));
    if (debitExists) return { walletSynced: true, walletSyncPending: false, walletSyncConflict: false };
    const remoteTime = Date.parse(remote?.updatedAt || '') || 0;
    const localTime = Date.parse(local?.updatedAt || '') || 0;
    // Jangan timpa data dompet server yang lebih baru dengan snapshot lama dari antrean.
    if (remote && remoteTime > localTime) {
      return { walletSynced: false, walletSyncPending: false, walletSyncConflict: true, walletSyncError: 'Data server lebih baru; perlu rekonsiliasi saldo.' };
    }
    const writeResponse = await timeout(`${base}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member: job.walletMember, state: local })
    }, 15000);
    const writePayload = await writeResponse.json();
    if (!writeResponse.ok || writePayload?.ok === false) throw new Error(writePayload?.message || `HTTP ${writeResponse.status}`);
    return { walletSynced: true, walletSyncPending: false, walletSyncConflict: false };
  } catch (error) {
    return { walletSynced: false, walletSyncPending: true, walletSyncConflict: false, walletSyncError: String(error?.message || error).slice(0, 160) };
  }
}

async function sendOneQueuedJob(orderId) {
  const job = await claimQueuedJob(orderId);
  if (!job) return;
  await notifyClients(job);

  if (!job.url || !job.fields || !job.photoBlob) {
    const failed = await updateJob(orderId, current => ({ ...current, status: 'failed', photoBlob: null, lastError: 'Data antrean tidak lengkap; pesan tidak dikirim.' }));
    if (failed) await notifyClients(failed);
    return;
  }

  if (self.navigator && self.navigator.onLine === false) {
    const queued = await updateJob(orderId, current => ({ ...current, status: 'queued', nextAttemptAt: 0, lastError: 'Perangkat sedang offline; menunggu jaringan.' }));
    if (queued) await notifyClients(queued);
    await ensureBackgroundSync();
    return;
  }

  try {
    const form = new FormData();
    for (const [key, value] of Object.entries(job.fields)) form.append(key, String(value));
    form.append('photo', job.photoBlob, job.photoName || 'order.jpg');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetch(job.url, { method: 'POST', body: form, signal: controller.signal, cache: 'no-store' });
    } finally { clearTimeout(timer); }
    let payload;
    try { payload = await response.json(); }
    catch (parseError) {
      const uncertain = await updateJob(orderId, current => ({ ...current, status: 'uncertain', photoBlob: null, lastError: 'Respons server tidak dapat dibaca; periksa Telegram admin sebelum mengulang.' }));
      if (uncertain) await notifyClients(uncertain);
      return;
    }

    if (response.ok && payload?.ok === true && payload?.result?.message_id) {
      // Simpan status sent SEBELUM sinkronisasi dompet. Jika sync saldo gagal,
      // proses berikutnya hanya mengulang PUT saldo, bukan POST foto Telegram.
      let sent = await updateJob(orderId, current => ({
        ...current,
        status: 'sent',
        photoBlob: null,
        messageId: payload.result.message_id,
        sentAt: new Date().toISOString(),
        lastError: '',
        walletSyncPending: Boolean(current.walletApiBase && current.walletStateAfter && !current.walletSynced)
      }));
      if (sent) {
        await notifyClients(sent);
        if (sent.walletSyncPending) {
          const walletResult = await syncWalletSnapshot(sent);
          sent = await updateJob(orderId, current => ({ ...current, ...walletResult }));
          if (sent) await notifyClients(sent);
          if (sent?.walletSyncPending) await ensureBackgroundSync();
        }
      }
      return;
    }

    // HTTP 429 / response ok:false adalah penolakan eksplisit Telegram, sehingga
    // request diketahui belum diterima dan aman dimasukkan kembali ke antrean.
    if (response.status === 429 || payload?.error_code === 429) {
      const queued = await updateJob(orderId, current => ({
        ...current,
        status: 'queued',
        nextAttemptAt: Date.now() + Math.max(1000, Number(payload?.parameters?.retry_after || 5) * 1000),
        lastError: 'Telegram membatasi laju kirim sementara (429). Akan dicoba kembali.'
      }));
      if (queued) await notifyClients(queued);
      await ensureBackgroundSync();
      return;
    }

    // HTTP 5xx / payload rusak bersifat ambigu: server/proxy mungkin sudah
    // memproses request sebelum gagal merespons. Jangan refund atau kirim ulang.
    if (response.status >= 500 || payload?.ok !== false) {
      const uncertain = await updateJob(orderId, current => ({
        ...current,
        status: 'uncertain',
        photoBlob: null,
        lastError: 'Server memberi respons yang tidak pasti. Periksa Telegram admin berdasarkan ID transaksi sebelum mengulang.'
      }));
      if (uncertain) await notifyClients(uncertain);
      return;
    }

    // Penolakan Telegram eksplisit 4xx selain 429: pesan tidak diterima.
    // Refund akan dilakukan halaman saat status antrean direkonsiliasi.
    const failed = await updateJob(orderId, current => ({
      ...current,
      status: 'failed',
      photoBlob: null,
      lastError: String(payload?.description || payload?.message || `Telegram menolak pengiriman (HTTP ${response.status}).`).slice(0, 180)
    }));
    if (failed) await notifyClients(failed);
  } catch (error) {
    // Fetch reject/timeout tidak membuktikan bahwa Telegram belum menerima pesan.
    // Status uncertain mencegah pengiriman ganda akibat retry yang tidak aman.
    const uncertain = await updateJob(orderId, current => ({
      ...current,
      status: 'uncertain',
      photoBlob: null,
      lastError: 'Koneksi/timeout setelah request dimulai. Cek ID transaksi di Telegram admin sebelum mengulang.'
    }));
    if (uncertain) await notifyClients(uncertain);
  }
}

async function isAutomaticTelegramSyncEnabled() {
  try {
    const db = await openQueueDB();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(SETTINGS_STORE, 'readonly').objectStore(SETTINGS_STORE).get('autoTelegramSync');
      request.onsuccess = () => resolve(request.result ? request.result.value !== false : true);
      request.onerror = () => reject(request.error || new Error('Gagal membaca pengaturan Telegram otomatis.'));
    });
  } catch (_) { return true; }
}

async function processQueue(forceOrderId = null) {
  const autoEnabled = await isAutomaticTelegramSyncEnabled();
  const jobs = await getAllJobs();
  for (const job of jobs) {
    if (!job?.orderId) continue;
    if (job.status === 'sending' && Date.now() - Number(job.sendingAt || 0) > 120000) {
      const uncertain = await updateJob(job.orderId, current => current.status === 'sending'
        ? { ...current, status: 'uncertain', photoBlob: null, lastError: 'Worker berhenti saat pengiriman; hasil tidak diketahui. Verifikasi Telegram sebelum mengulang.' }
        : current);
      if (uncertain) await notifyClients(uncertain);
      continue;
    }
    if (job.status === 'sent' && job.walletSyncPending && !job.walletSyncConflict) {
      const walletResult = await syncWalletSnapshot(job);
      const updated = await updateJob(job.orderId, current => ({ ...current, ...walletResult }));
      if (updated) await notifyClients(updated);
      if (updated?.walletSyncPending) await ensureBackgroundSync();
      continue;
    }
    if (job.status === 'queued' && Number(job.nextAttemptAt || 0) <= Date.now() && (autoEnabled || String(job.orderId) === String(forceOrderId || ''))) {
      await sendOneQueuedJob(job.orderId);
    }
  }
}

// Web Push: Service Worker menangani notifikasi meskipun tab tidak aktif/ditutup.
// Notifikasi sistem selalu ditampilkan agar Android/browser dapat memakai suara
// kanal notifikasi native. Halaman hanya menerima salinan event untuk sinkronisasi UI.
function agenPushVibration(status, kind) {
  const normalized = String(status || '').toLowerCase();
  if (kind === 'payment') return [600, 120, 600, 120, 1000, 180, 650];
  if (kind === 'topup') {
    return normalized === 'sukses'
      ? [420, 130, 420, 130, 850, 200, 520]
      : [650, 150, 650, 150, 1050, 220, 700];
  }
  if (normalized === 'gagal' || normalized === 'ditolak') {
    return [650, 140, 650, 140, 1050, 220, 700];
  }
  if (normalized === 'sukses') {
    return [520, 130, 520, 130, 900, 200, 560];
  }
  if (normalized === 'diproses') {
    return [380, 120, 520, 150, 760];
  }
  return [380, 130, 520, 150, 760];
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch (error) {
      try { payload = { body: event.data?.text?.() || '' }; } catch (_) {}
    }

    const kind = String(payload.kind || 'general').toLowerCase();
    const status = String(payload.status || '').toLowerCase();
    const importantStatus = ['diproses', 'sukses', 'gagal', 'ditolak', 'lunas'].includes(status);
    const updatedAt = Date.parse(String(payload.updatedAt || ''));
    const vibrationPattern = agenPushVibration(status, kind);
    const options = {
      body: String(payload.body || 'Ada pembaruan transaksi Anda.'),
      icon: new URL('./notification-icon.png', self.location.href).toString(),
      badge: new URL('./notification-badge.png', self.location.href).toString(),
      image: new URL('./notification-image.webp', self.location.href).toString(),
      lang: 'id-ID',
      dir: 'auto',
      tag: String(payload.tag || `agen-suatu-${kind}-${Date.now()}`),
      timestamp: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      data: { url: String(payload.url || '/'), kind, status, orderId: String(payload.orderId || ''), requestId: String(payload.requestId || '') },
      renotify: true,
      // false = izinkan suara kanal notifikasi sistem. Web tidak dapat memilih
      // file suara atau memaksa volume; pengaturan Android tetap berwenang.
      silent: false,
      vibrate: vibrationPattern,
      // Biarkan notifikasi penting terlihat sampai pengguna membukanya.
      requireInteraction: importantStatus || kind === 'topup' || kind === 'payment',
      actions: [{ action: 'open', title: 'Buka status' }, { action: 'dismiss', title: 'Tutup' }]
    };

    // Tampilkan notifikasi sistem meskipun aplikasi sedang di depan. Sebelumnya
    // kasus ini hanya postMessage ke tab sehingga suara native tidak selalu muncul.
    try {
      await self.registration.showNotification(String(payload.title || 'Agen Suatu • Pembaruan'), options);
    } catch (error) {
      // Lanjutkan sinkronisasi UI meski OS menolak tampilan notifikasi.
    }

    // Kirim event ke semua tab untuk memperbarui riwayat/layar tanpa membuat
    // notifikasi kedua dari halaman. Sistem operasi tetap menangani suara/getar.
    try {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: 'AGEN_PUSH_STATUS', payload });
      }
    } catch (_) {}
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil((async () => {
    const destination = new URL(String(event.notification.data?.url || '/'), self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && client.url !== destination.href) {
            try { await client.navigate(destination.href); } catch (_) {}
          }
          return;
        }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(destination.href);
  })());
});

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      client.postMessage({ type: 'AGEN_SW_ACTIVATED', version: AGEN_SW_BUILD });
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'AGEN_ORDER_QUEUE_PROCESS') return;
  const forceOrderId = event.data?.force === true ? String(event.data?.orderId || '') : null;
  event.waitUntil(processQueue(forceOrderId).catch(error => console.error('Agen Suatu queue worker:', error)));
});

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processQueue().catch(error => console.error('Agen Suatu background sync:', error)));
  }
});
