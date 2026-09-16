const admin = require('firebase-admin');
function init(){
  if(admin.apps.length)return admin.app();
  const privateKey=String(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!process.env.FIREBASE_PROJECT_ID||!process.env.FIREBASE_CLIENT_EMAIL||!privateKey||!process.env.FIREBASE_DATABASE_URL)throw new Error('Konfigurasi Firebase Admin di Vercel belum lengkap.');
  return admin.initializeApp({credential:admin.credential.cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey}),databaseURL:process.env.FIREBASE_DATABASE_URL});
}
function send(res,status,body){res.status(status).json(body);}
module.exports=async(req,res)=>{
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
  try{
    init(); const h=req.headers.authorization||''; if(!h.startsWith('Bearer '))return send(res,401,{ok:false,error:'Login diperlukan.'});
    const decoded=await admin.auth().verifyIdToken(h.slice(7).trim());
    const role=String((await admin.database().ref(`roles/${decoded.uid}`).once('value')).val()||'user').toLowerCase();
    if(!['admin','owner'].includes(role))return send(res,403,{ok:false,error:'Hanya Admin atau Owner yang boleh melihat aktivitas.'});
    const snap=await admin.database().ref('aktivitas').orderByChild('waktu').limitToLast(100).once('value');
    const value=snap.val()||{}; let logs=Object.entries(value).map(([id,item])=>({id,...item}));
    logs.sort((a,b)=>(Number(b.waktu)||0)-(Number(a.waktu)||0));
    if(role==='admin')logs=logs.filter(item=>['addon_tambah','addon_edit','addon_hapus'].includes(String(item.aksi)));
    return send(res,200,{ok:true,role,logs});
  }catch(error){console.error('activity error:',error);let status=Number(error.status)||500;if(error.code==='auth/id-token-expired'||error.code==='auth/argument-error')status=401;return send(res,status,{ok:false,error:error.message||'Gagal memuat aktivitas.'});}
};
