const admin = require('firebase-admin');
const { catatAktivitas } = require('../lib/activity');

const OWNER = 'mayachan-fm';
const REPO = 'Share';
const PATH = 'data.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

function getFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey || !process.env.FIREBASE_DATABASE_URL) throw new Error('Konfigurasi Firebase Admin di Vercel belum lengkap.');
  return admin.initializeApp({credential: admin.credential.cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey}),databaseURL:process.env.FIREBASE_DATABASE_URL});
}
function send(res,status,body){res.status(status).json(body);}
function cleanUrl(value){let url=String(value||'').trim();const markdown=url.match(/^\[.*?\]\((https?:\/\/[^\s)]+)\)$/i);if(markdown)url=markdown[1];if(url.startsWith('<')&&url.endsWith('>'))url=url.slice(1,-1).trim();return url;}
function validUrl(value){try{const u=new URL(cleanUrl(value));return ['http:','https:'].includes(u.protocol);}catch(_){return false;}}
function normalizeAddon(key,data){
  if(!/^[a-z0-9_-]{1,80}$/i.test(String(key||''))) throw new Error('Slug/ID addon tidak valid.');
  if(!data||typeof data!=='object') throw new Error('Data addon tidak valid.');
  const result={slug:String(key).trim(),'nama file':String(data['nama file']||'').trim(),'type file':String(data['type file']||'').trim(),kategori:String(data.kategori||'').trim(),'link gambar':cleanUrl(data['link gambar']),'link download':cleanUrl(data['link download']),'versi mc':String(data['versi mc']||'').trim(),ukuran:String(data.ukuran||'').trim(),'tanggal unggah':String(data['tanggal unggah']||'').trim(),description:String(data.description||'').trim()};
  if(!result['nama file']||result['nama file'].length>120||!result['type file']||result['type file'].length>40||!['addon','resource','peta','lainnya','apk'].includes(result.kategori.toLowerCase())||!result.description||result.description.length>1000) throw new Error(`Data addon "${key}" belum lengkap atau tidak valid.`);
  if(!validUrl(result['link gambar'])) throw new Error(`Link gambar untuk "${key}" tidak valid.`);
  if(!validUrl(result['link download'])) throw new Error(`Link download untuk "${key}" tidak valid.`);if(result['versi mc'].length>60||result.ukuran.length>30||result['tanggal unggah'].length>40) throw new Error(`Data addon "${key}" melebihi batas karakter.`);
  return result;
}
async function github(path,options={}){
  const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('GITHUB_TOKEN belum disetel di Vercel.');
  const response=await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})}});
  const text=await response.text();let body;try{body=JSON.parse(text);}catch(_){body={message:text};}
  if(!response.ok){const e=new Error(body.message||`GitHub API error ${response.status}`);e.status=response.status;throw e;}return body;
}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method tidak diizinkan.'});
  try{
    getFirebaseAdmin();const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return send(res,401,{ok:false,error:'Login diperlukan.'});
    const decoded=await admin.auth().verifyIdToken(h.slice(7).trim());const role=String((await admin.database().ref(`roles/${decoded.uid}`).once('value')).val()||'user').toLowerCase();
    if(!['admin','owner'].includes(role))return send(res,403,{ok:false,error:'Hanya Admin atau Owner yang boleh mengubah data.json.'});
    const key=String(req.body?.key||'').trim();const addon=normalizeAddon(key,req.body?.addon);
    const current=await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);if(!current.content||current.encoding!=='base64')throw new Error('GitHub tidak mengembalikan isi data.json yang bisa dibaca.');
    const jsonText=Buffer.from(current.content.replace(/\n/g,''),'base64').toString('utf8');let data;try{data=JSON.parse(jsonText);}catch(_){throw new Error('data.json di GitHub bukan JSON yang valid.');}
    if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Struktur data.json harus berupa object.');
    if(!Object.prototype.hasOwnProperty.call(data,key))return send(res,404,{ok:false,error:`Addon dengan slug "${key}" tidak ditemukan di data.json.`});
    data[key]=addon;
    const encoded=Buffer.from(JSON.stringify(data,null,2)+'\n','utf8').toString('base64');
    const updated=await github(`contents/${PATH}`,{method:'PUT',body:JSON.stringify({message:`Perbarui addon di data.json: ${addon['nama file']}`.slice(0,200),content:encoded,sha:current.sha,branch:BRANCH})});
    await catatAktivitas({decoded,role,aksi:'addon_edit',targetId:key,targetName:addon['nama file'],detail:'Mengedit data addon di data.json'});
    return send(res,200,{ok:true,role,slug:key,commitSha:updated.commit?.sha||null,commitUrl:updated.commit?.html_url||null});
  }catch(error){console.error('update-addon error:',error);const status=error.status===409?409:(error.code==='auth/id-token-expired'||error.code==='auth/argument-error'?401:500);return send(res,status,{ok:false,error:error.message||'Gagal memperbarui addon.'});}
};
