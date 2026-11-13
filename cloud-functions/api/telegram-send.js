import {json, cors, getAdminId, getValidatedOrigin} from './_shared.js';
export async function onRequest({request,env}) {
  const respond = (response) => cors(request, response, env);
  if(request.method==='OPTIONS') return respond(new Response(null,{status:204}));
  if(request.method!=='POST') return respond(json({ok:false,error:'Method tidak diizinkan'},405));
  const token=String(env?.TELEGRAM_BOT_TOKEN || '').trim(); if(!token) return respond(json({ok:false,error:'TELEGRAM_BOT_TOKEN belum diatur pada Environment Variables EdgeOne.'},503));
  const origin=request.headers.get('origin'); if(origin && !getValidatedOrigin(request, env)) return respond(json({ok:false,error:'Origin ditolak: host halaman tidak cocok dengan host backend.'},403));
  try {
    const adminId = getAdminId(env);
    const form=await request.formData();
    // Tujuan chat dipastikan dari Environment Variable server, bukan input browser.
    // Tujuan selalu diambil dari TELEGRAM_ADMIN_ID EdgeOne, abaikan input browser/worker.
    form.set('chat_id',adminId);
    const photo=form.get('photo'); if(!photo) return respond(json({ok:false,error:'Foto bukti tidak ditemukan'},400));
    let r;
    try { r=await fetch(`https://api.telegram.org/bot${token}/sendPhoto`,{method:'POST',body:form}); }
    catch(error) { const cause=error?.cause||{}; return respond(json({ok:false,error:`Koneksi EdgeOne ke api.telegram.org gagal: ${String(cause.code||cause.name||error.message||'fetch failed').slice(0,160)}`},502)); }
    const data=await r.json(); return respond(json(data,r.ok?200:502));
  } catch(e) { return respond(json({ok:false,error:String(e.message||e)},502)); }
}
