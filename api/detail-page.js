// ==============================================
// DETAIL PAGE META DINAMIS — untuk preview WhatsApp/Facebook/dll.
// Hanya dipanggil oleh crawler (lihat vercel.json rewrite berbasis User-Agent).
// Pengunjung asli tetap mendapatkan detail.html statis biasa.
// ==============================================
const DATA_JSON_URL = 'https://raw.githubusercontent.com/mayachan-fm/Share/main/data.json';
function kirimHtml(res, status, html) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function potongTeks(value, maks) {
  const t = String(value || '').replace(/\s+/g, ' ').trim();
  return t.length > maks ? t.slice(0, maks - 1).trimEnd() + '…' : t;
}
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method tidak diizinkan.' });
  const slug = String(req.query?.slug || '').trim();
  const host = req.headers.host || 'mc-share.vercel.app';
  const urlDetail = `https://${host}/detail.html?slug=${encodeURIComponent(slug)}`;
  let item = null;
  try {
    const r = await fetch(DATA_JSON_URL, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === 'object' && data[slug]) item = data[slug];
    }
  } catch (_) { /* biarkan null, tampilkan meta generik */ }
  const nama = item ? String(item['nama file'] || 'Addon') : 'Kumpulan Addon Minecraft';
  const deskripsi = item
    ? potongTeks(item.description || 'Koleksi Addon & Mod Minecraft Bedrock terlengkap.', 160)
    : 'Koleksi Addon & Mod Minecraft Bedrock terlengkap. Temukan, bagikan, dan unduh berbagai addon dengan mudah.';
  const gambar = item && item['link gambar'] ? item['link gambar'] : `https://${host}/situs-logo.png`;
  const judul = item ? `${escapeHtml(nama)} | MC Addon Share` : 'Detail Addon | MC Addon Share';
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${judul}</title>
<link rel="canonical" href="${escapeHtml(urlDetail)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(urlDetail)}">
<!-- Open Graph (Facebook, WhatsApp, Telegram, dll.) -->
<meta property="og:site_name" content="MC Addon Share">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(urlDetail)}">
<meta property="og:title" content="${escapeHtml(nama)}">
<meta property="og:description" content="${escapeHtml(deskripsi)}">
<meta property="og:image" content="${escapeHtml(gambar)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(nama)}">
<meta name="twitter:description" content="${escapeHtml(deskripsi)}">
<meta name="twitter:image" content="${escapeHtml(gambar)}">
</head>
<body>
<p>Addon: <strong>${escapeHtml(nama)}</strong>. <a href="${escapeHtml(urlDetail)}">Buka halaman detail</a></p>
</body>
</html>`;
  kirimHtml(res, 200, html);
};
