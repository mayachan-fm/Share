const admin = require('firebase-admin');
function init(){
  if(admin.apps.length) return admin.app();
  const privateKey=String(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!process.env.FIREBASE_PROJECT_ID||!process.env.FIREBASE_CLIENT_EMAIL||!privateKey||!process.env.FIREBASE_DATABASE_URL) throw new Error('Konfigurasi Firebase Admin di Vercel belum lengkap.');
  return admin.initializeApp({credential:admin.credential.cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey}),databaseURL:process.env.FIREBASE_DATABASE_URL});
}
function send(res,status,body){return res.status(status).json(body);}
async function identity(req){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')){const e=new Error('Login diperlukan.');e.status=401;throw e;}
  const user=await admin.auth().verifyIdToken(h.slice(7).trim());
  const role=String((await admin.database().ref(`roles/${user.uid}`).once('value')).val()||'user').toLowerCase();
  return {...user,role};
}
function clean(v,max){return String(v??'').trim().slice(0,max);}
module.exports=async(req,res)=>{
  try{
    init();
    if(req.method==='POST'){
      const user=await identity(req); const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const slug=clean(body.slug,120), reason=clean(body.reason,80), message=clean(body.message,800);
      if(!slug||!reason||message.length<10) return send(res,400,{ok:false,error:'Pilih alasan dan tulis pesan minimal 10 karakter (maksimal 800).'});
      const catalogRes=await fetch(`${process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'https://mc-share.vercel.app'}/api/catalog?slug=${encodeURIComponent(slug)}`);
      if(!catalogRes.ok) return send(res,404,{ok:false,error:'Addon tidak ditemukan.'});
      const item=await catalogRes.json();
      const addon=item?.item||item;
      if(!addon||!addon.slug) return send(res,404,{ok:false,error:'Addon tidak ditemukan.'});
      const db=admin.database(), rateRef=db.ref(`batas_laporan/${user.uid}/${slug}`), now=Date.now();
      const rate=await rateRef.once('value');
      if(rate.exists() && now-Number(rate.val())<10*60*1000) return send(res,429,{ok:false,error:'Kamu baru saja melaporkan addon ini. Coba lagi dalam 10 menit.'});
      const reportRef=db.ref('laporan').push();
      await reportRef.set({id:reportRef.key,slug,namaAddon:clean(addon['nama file']||addon.nama||slug,180),reason,message,uid:user.uid,username:clean(user.name||user.email?.split('@')[0]||'Pengguna',80),email:clean(user.email||'',160),waktu:now,status:'belum_ditinjau'});
      await rateRef.set(now);
      return send(res,201,{ok:true,message:'Laporan berhasil dikirim.'});
    }
    if(req.method==='GET'||req.method==='PATCH'||req.method==='DELETE'){
      const user=await identity(req);
      if(user.role!=='owner') return send(res,403,{ok:false,error:'Hanya Owner yang dapat mengelola laporan.'});
      const db=admin.database();
      if(req.method==='GET'){
        const snap=await db.ref('laporan').orderByChild('waktu').limitToLast(300).once('value');
        const reports=Object.entries(snap.val()||{}).map(([id,item])=>({id,...item})).sort((a,b)=>(Number(b.waktu)||0)-(Number(a.waktu)||0));
        res.setHeader('Cache-Control','no-store'); return send(res,200,{ok:true,reports});
      }
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); const id=clean(body.id,180);
      if(!id||id.includes('/')) return send(res,400,{ok:false,error:'ID laporan tidak valid.'});
      const ref=db.ref(`laporan/${id}`); const snap=await ref.once('value'); if(!snap.exists()) return send(res,404,{ok:false,error:'Laporan tidak ditemukan.'});
      if(req.method==='DELETE'){await ref.remove();return send(res,200,{ok:true,message:'Laporan dihapus.'});}
      const status=clean(body.status,30); if(!['belum_ditinjau','sedang_diperiksa','selesai'].includes(status)) return send(res,400,{ok:false,error:'Status laporan tidak valid.'});
      await ref.update({status,ditinjauOleh:user.uid,diubahPada:Date.now()}); return send(res,200,{ok:true,message:'Status laporan diperbarui.'});
    }
    res.setHeader('Allow','GET, POST, PATCH, DELETE'); return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
  }catch(error){console.error('reports API error:',error);return send(res,Number(error.status)||500,{ok:false,error:error.message||'Terjadi kesalahan saat memproses laporan.'});}
};
