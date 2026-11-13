
import {
  json,
  readState,
  writeState,
  tg,
  getAdminId
} from './_shared.js';
import { sendOrderPush, sendTopupPush } from './_push.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST required' }, 405);
  }

  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return json({ ok: false, error: 'Bot token missing' }, 503);
  }

  let adminId;
  try { adminId = getAdminId(env); }
  catch (error) { return json({ ok: false, error: String(error.message || error) }, 503); }

  const secret = token.slice(-24);
  if (
    request.headers.get('x-telegram-bot-api-secret-token') !== secret
  ) {
    return json({ ok: false, error: 'Unauthorized' }, 403);
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const cq = update.callback_query;
  if (!cq) return json({ ok: true });

  const actor = String(cq.from?.id || '');
  const chat = String(cq.message?.chat?.id || '');

  if (actor !== adminId || chat !== adminId) {
    await tg(token, 'answerCallbackQuery', {
      callback_query_id: cq.id,
      text: 'Aksi hanya untuk admin terdaftar.',
      show_alert: true
    }).catch(() => {});

    return json({ ok: true });
  }

  // Hentikan spinner Telegram segera.
  await tg(token, 'answerCallbackQuery', {
    callback_query_id: cq.id,
    text: 'Perintah diterima. Server sedang memperbarui status.'
  }).catch(() => {});

  let s;
  try {
    s = await readState();

    if (!s || typeof s !== 'object') s = {};
    if (!s.orderStatuses) s.orderStatuses = {};
    if (!s.topups) s.topups = {};
    if (!Array.isArray(s.deletedOrderIds)) s.deletedOrderIds = [];
  } catch (error) {
    return json({
      ok: false,
      error: 'Gagal membaca penyimpanan server',
      detail: String(error.message || error)
    }, 500);
  }

  const data = String(cq.data || '');
  const now = new Date().toISOString();
  const updateId = Number(update.update_id || 0);

  let orderId = '';
  let status = '';
  let handler = '';
  let topupId = '';
  let topupStatus = '';
  let paymentStatus = '';
  let recognized = false;

  // ADMIN: PROSES PESANAN
  let m = data.match(/^proses_(torikul|widiya)_(.+)$/);

  if (m) {
    recognized = true;
    orderId = m[2];
    status = 'diproses';
    handler = m[1] === 'torikul' ? 'Torikul' : 'Widiya';

    const old = s.orderStatuses[orderId];

    if (
      old &&
      old.status &&
      !['pending', ''].includes(old.status)
    ) {
      return json({ ok: true, ignored: true });
    }

    s.orderStatuses[orderId] = {
      ...(old || {}),
      status,
      handler,
      updatedAt: now,
      claimUpdateId: updateId
    };
  }

  // ADMIN: PESANAN SELESAI
  m = data.match(/^selesai_(.+)$/);

  if (m) {
    recognized = true;
    orderId = m[1];
    status = 'sukses';

    const old = s.orderStatuses[orderId] || {};

    if (['sukses', 'gagal'].includes(old.status)) {
      return json({ ok: true, ignored: true });
    }

    s.orderStatuses[orderId] = {
      ...old,
      status,
      updatedAt: now
    };
  }

  // ADMIN: BATALKAN PESANAN
  m = data.match(/^tolak_(.+)$/);

  if (m) {
    recognized = true;
    orderId = m[1];
    status = 'gagal';

    const old = s.orderStatuses[orderId] || {};

    if (['sukses', 'gagal'].includes(old.status)) {
      return json({ ok: true, ignored: true });
    }

    s.orderStatuses[orderId] = {
      ...old,
      status,
      updatedAt: now
    };
  }

  // ADMIN: LUNASKAN TAGIHAN HUTANG (tidak mengubah status proses pesanan).
  m = data.match(/^lunas_(.+)$/);
  if (m) {
    recognized = true;
    orderId = m[1];
    const old = s.orderStatuses[orderId] || {};
    const messageText = String(cq.message?.caption || cq.message?.text || '');
    const captionSaysDebt = /<b>\s*Metode:\s*<\/b>\s*HUTANG/i.test(messageText);
    if (old.paymentMode !== 'hutang' && !captionSaysDebt) {
      return json({ ok: true, ignored: true, reason: 'Bukan transaksi hutang.' });
    }
    if (old.paymentStatus === 'lunas') return json({ ok: true, ignored: true, alreadyPaid: true });
    paymentStatus = 'lunas';
    s.orderStatuses[orderId] = {
      ...old,
      paymentMode: 'hutang',
      paymentStatus: 'lunas',
      paymentUpdatedAt: now,
      paymentUpdateId: updateId
    };
  }

  // ADMIN: TOPUP DISETUJUI
  m = data.match(/^topup_approve_(0|1000|2000|3000|4000|5000)_(.+)$/);

  if (m) {
    recognized = true;

    const bonusPoints = Number(m[1]);
    const id = m[2];
    topupId = id;
    topupStatus = 'sukses';
    const old = s.topups[id] || {};
    if (['sukses', 'ditolak'].includes(old.status)) {
      return json({ ok: true, ignored: true });
    }

    s.topups[id] = {
      ...old,
      status: 'sukses',
      nominal: Number(old.nominal) || 0,
      bonusPoints,
      updatedAt: now
    };
  }

  // ADMIN: TOPUP DITOLAK
  m = data.match(/^topup_reject_(.+)$/);

  if (m) {
    recognized = true;

    const id = m[1];
    topupId = id;
    topupStatus = 'ditolak';
    const old = s.topups[id] || {};
    if (['sukses', 'ditolak'].includes(old.status)) {
      return json({ ok: true, ignored: true });
    }

    s.topups[id] = {
      ...old,
      status: 'ditolak',
      updatedAt: now
    };
  }

  if (!recognized) {
    return json({ ok: true, ignored: true });
  }
  if (orderId && (s.deletedOrderIds || []).some(value => String(value) === String(orderId))) {
    return json({ ok: true, ignored: true, deleted: true });
  }

  // Simpan status ke server, bukan menunggu browser pelanggan.
  s.lastUpdateId = Math.max(
    Number(s.lastUpdateId || 0),
    updateId
  );

  try {
    await writeState(s);
  } catch (error) {
    return json({
      ok: false,
      error: 'Gagal menyimpan status ke Blob EdgeOne',
      detail: String(error.message || error)
    }, 500);
  }

  // Web Push dikirim dari server setelah status tersimpan. Jika push gagal,
  // keputusan Telegram tetap dianggap berhasil dan status tetap aman di Blob.
  if (orderId && status) {
    await sendOrderPush(orderId, status, handler, now).catch(error => {
      console.warn('Web Push pesanan gagal:', String(error?.message || error).slice(0, 160));
    });
  }
  if (topupId) {
    await sendTopupPush(topupId, topupStatus, now).catch(error => {
      console.warn('Web Push top-up gagal:', String(error?.message || error).slice(0, 160));
    });
  }

  // Perbarui tampilan pesan admin setelah penyimpanan berhasil. Baris aksi
  // lain (Lunaskan / Chat Pelanggan) tidak dibuang saat status berubah.
  if (orderId && cq.message?.chat?.id && cq.message?.message_id) {
    const original = String(cq.message.caption || cq.message.text || '');
    const oldRows = Array.isArray(cq.message.reply_markup?.inline_keyboard)
      ? cq.message.reply_markup.inline_keyboard : [];
    const oldButtons = oldRows.flat().filter(Boolean);
    const oldState = s.orderStatuses[orderId] || {};
    const currentStatus = status || String(oldState.status || 'pending');
    const currentPaymentStatus = paymentStatus || String(oldState.paymentStatus || '');
    const handlerName = String(oldState.handler || handler || '');

    const statusLabel = currentStatus === 'diproses'
      ? `⏳ DIPROSES OLEH ${handlerName || 'ADMIN'}`
      : currentStatus === 'sukses'
        ? '✅ TRANSAKSI SUKSES'
        : currentStatus === 'gagal'
          ? '❌ TRANSAKSI GAGAL / BATAL'
          : '';
    const paymentLabel = currentPaymentStatus === 'lunas' ? '💰 PEMBAYARAN: LUNAS' : '';
    const clean = original
      // Buang blok status lengkap versi baru agar setiap callback hanya menyisakan satu blok.
      .replace(/\n{1,2}━━━━━━━━━━━━━━━━━━\n🔔 <b>PEMBARUAN PESANAN<\/b>[\s\S]*$/i, '')
      .replace(/\n+📌 <b>STATUS SERVER:<\/b>[\s\S]*$/i, '')
      // Bersihkan label status dari format lama.
      .replace(/\n{1,2}(?:⏳ DIPROSES OLEH .*|✅ TRANSAKSI SUKSES|❌ TRANSAKSI GAGAL \/ BATAL).*$/i, '')
      .replace(/\n{1,2}💰 PEMBAYARAN: LUNAS\s*$/i, '')
      .replace(/\n⏳ <b>Status:<\/b>\s*MENUNGGU PROSES ADMIN/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n+$/g, '');
    const suffix = [statusLabel, paymentLabel].filter(Boolean).join('\n');
    const updatedText = [clean, suffix].filter(Boolean).join('\n\n');

    const chatButton = oldButtons.find(button =>
      /chat pelanggan/i.test(String(button.text || '')) && /^https:\/\/wa\.me\//i.test(String(button.url || ''))
    ) || oldButtons.find(button => /^https:\/\/wa\.me\//i.test(String(button.url || '')));
    let fallbackChatButton = null;
    if (!chatButton) {
      const phoneMatch = original.match(/No Tujuan:<\/b>\s*<code>([\s\S]*?)<\/code>/i);
      let digits = String(phoneMatch?.[1] || '').replace(/\D/g, '');
      if (digits.startsWith('0')) digits = '62' + digits.slice(1);
      else if (digits.startsWith('8')) digits = '62' + digits;
      if (/^62\d{8,13}$/.test(digits)) fallbackChatButton = { text: '💬 Chat Pelanggan', url: `https://wa.me/${digits}` };
    }

    const existingLunas = oldButtons.find(button =>
      /lunas/i.test(String(button.text || '')) || /^lunas_/i.test(String(button.callback_data || ''))
    );
    const isDebt = String(oldState.paymentMode || '').toLowerCase() === 'hutang'
      || /<b>\s*Metode:\s*<\/b>\s*HUTANG/i.test(original);

    const rows = [];
    if (currentStatus === 'diproses') {
      rows.push([
        { text: '✅ Selesai', callback_data: `selesai_${orderId}` },
        { text: '❌ Batalkan', callback_data: `tolak_${orderId}` }
      ]);
    } else if (currentStatus === 'pending') {
      const processRow = oldRows.find(row => Array.isArray(row) && row.some(button => /^proses_(torikul|widiya)_/.test(String(button?.callback_data || ''))));
      if (processRow) rows.push(processRow);
    } else {
      rows.push([{ text: statusLabel || 'Status diperbarui', callback_data: 'noop' }]);
    }

    if (isDebt) {
      rows.push([currentPaymentStatus === 'lunas' || existingLunas?.text?.includes('SUDAH LUNAS')
        ? { text: '✅ SUDAH LUNAS', callback_data: 'noop' }
        : { text: '💸 LUNASKAN', callback_data: `lunas_${orderId}` }]);
    } else if (existingLunas) {
      // Bila pesan lama sudah mempunyai tindakan lunas, jangan hilangkan barisnya.
      rows.push([existingLunas]);
    }
    const finalChatButton = chatButton || fallbackChatButton;
    if (finalChatButton) rows.push([{ text: '💬 Chat Pelanggan', url: finalChatButton.url }]);

    const payload = {
      chat_id: cq.message.chat.id,
      message_id: cq.message.message_id,
      reply_markup: { inline_keyboard: rows }
    };
    if (cq.message.photo) {
      payload.caption = updatedText.slice(0, 1024);
      await tg(token, 'editMessageCaption', payload).catch(() => {});
    } else {
      payload.text = updatedText.slice(0, 4096);
      await tg(token, 'editMessageText', payload).catch(() => {});
    }
  }

  return json({
    ok: true,
    saved: true,
    orderId,
    status,
    paymentStatus,
    topupId,
    topupStatus,
    updatedAt: now
  });
}
