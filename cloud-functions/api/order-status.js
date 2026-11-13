import { json, readState, writeState, cors, getValidatedOrigin } from './_shared.js';

export async function onRequest({ request, env }) {
  const respond = (response) => cors(request, response, env);
  if (request.method === 'OPTIONS') {
    return respond( new Response(null, { status: 204 }));
  }

  if (!['GET', 'POST'].includes(request.method)) {
    return respond( json({ ok: false, error: 'Method tidak diizinkan' }, 405));
  }

  const origin = request.headers.get('origin');
  if (origin && !getValidatedOrigin(request, env)) {
    return respond( json({ ok: false, error: 'Origin ditolak.' }, 403));
  }

  try {
    const state = await readState();
    const deleted = new Set(
      (state.deletedOrderIds || [])
        .map(value => String(value || '').trim())
        .filter(Boolean)
    );

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const ids = [...new Set((url.searchParams.get('ids') || '').split(',').map(v => v.trim()).filter(Boolean))].slice(0, 100);
      const topupIds = [...new Set((url.searchParams.get('topupIds') || '').split(',').map(v => v.trim()).filter(Boolean))].slice(0, 100);
      const statuses = {};
      const topups = {};

      for (const id of ids) {
        const entry = state.orderStatuses?.[id];
        if (!deleted.has(id) && entry && typeof entry === 'object') {
          // Jangan kirim nomor telepon, mode pembayaran, atau metadata privat ke browser.
          const safeEntry = {};
          for (const field of ['status', 'handler', 'updatedAt', 'claimUpdateId', 'claimedAt', 'paymentMode', 'paymentStatus', 'paymentStatusSource', 'paymentUpdatedAt', 'paymentUpdateId']) {
            if (entry[field] !== undefined) safeEntry[field] = entry[field];
          }
          statuses[id] = safeEntry;
        }
      }

      for (const id of topupIds) {
        const entry = state.topups?.[id];
        if (entry && typeof entry === 'object') {
          const safeEntry = {};
          for (const field of ['status', 'nominal', 'bonusPoints', 'updatedAt']) {
            if (entry[field] !== undefined) safeEntry[field] = entry[field];
          }
          topups[id] = safeEntry;
        }
      }

      // Hanya kembalikan ID yang diminta browser tersebut, bukan seluruh daftar global.
      const deletedOrderIds = ids.filter(id => deleted.has(id));
      return respond(json({
        ok: true,
        statuses,
        topups,
        deletedOrderIds,
        serverTime: new Date().toISOString(),
        lastUpdateId: Number(state.lastUpdateId || 0),
        lastWebhookAt: String(state.lastWebhookAt || ""),
        lastWebhookUpdateId: Number(state.lastWebhookUpdateId || 0),
        lastWebhookAction: String(state.lastWebhookAction || "")
      }));
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return respond( json({ ok: false, error: 'Body harus berupa JSON yang valid' }, 400));
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return respond( json({ ok: false, error: 'Body JSON tidak valid' }, 400));
    }

    let deletedOrderIds = [];

    if (body.action === 'registerOrder' && body.orderId) {
      const id = String(body.orderId).trim().slice(0, 80);
      if (!id || deleted.has(id)) {
        return respond( json({ ok: true, ignored: true, deleted: true }));
      }

      const previous = state.orderStatuses[id] || {
        status: 'pending',
        updatedAt: new Date().toISOString()
      };
      const paymentMode = String(body.paymentMode || '').trim().toLowerCase();
      const customerPhone = String(body.customerPhone || '').replace(/\D/g, '').slice(0, 16);
      const createdAt = String(body.createdAt || '').trim().slice(0, 40);

      state.orderStatuses[id] = {
        ...previous,
        ...(paymentMode ? { paymentMode } : {}),
        ...(customerPhone ? { customerPhone } : {}),
        ...(createdAt && !previous.createdAt ? { createdAt } : {})
      };
    } else if (body.action === 'registerTopup' && body.requestId) {
      const id = String(body.requestId).trim().slice(0, 80);
      if (!id) return respond( json({ ok: false, error: 'ID top-up tidak valid' }, 400));
      state.topups[id] ||= {
        status: 'pending',
        nominal: Number(body.nominal) || 0,
        updatedAt: new Date().toISOString()
      };
    } else if (body.action === 'hideOrders') {
      const incoming = Array.isArray(body.orderIds) ? body.orderIds : [];
      const requested = new Set();
      for (const value of incoming.slice(0, 1000)) {
        const id = String(value || '').trim().slice(0, 80);
        if (id) requested.add(id);
      }

      // hideAll hanya berarti "hapus semua ID milik perangkat pemanggil".
      // Jangan pernah memperluasnya menjadi seluruh order di Blob karena Blob dipakai bersama.
      deletedOrderIds = Array.from(requested);
      for (const id of deletedOrderIds) {
        deleted.add(id);
        delete state.orderStatuses[id];
      }

      // Tombstone lama tetap dipertahankan agar polling lama tidak menghidupkan ulang pesanan.
      state.deletedOrderIds = Array.from(deleted);
    } else {
      return respond( json({ ok: false, error: 'Aksi tidak dikenal' }, 400));
    }

    await writeState(state);
    return respond( json({ ok: true, deletedOrderIds }));
  } catch (error) {
    return respond( json({
      ok: false,
      error: 'Penyimpanan belum siap. Pastikan Blob EdgeOne dapat diakses oleh Cloud Functions Node.js.',
      detail: String(error?.message || error).slice(0, 180)
    }, 503));
  }
}
