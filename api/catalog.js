const OWNER = 'mayachan-fm';
const REPO = 'Share';
const PATH = 'data.json';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

function send(res, status, body) {
  res.status(status).json(body);
}

async function github(path) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN belum disetel di Vercel.');

  const response = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10'
    }
  });

  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (_) { body = { message: text }; }

  if (!response.ok) {
    const error = new Error(body.message || `GitHub API error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, { ok: false, error: 'Method tidak diizinkan.' });
  }

  try {
    const current = await github(`contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`);
    if (!current.content || current.encoding !== 'base64') {
      throw new Error('GitHub tidak mengembalikan katalog yang bisa dibaca.');
    }

    const jsonText = Buffer.from(current.content.replace(/\n/g, ''), 'base64').toString('utf8');
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (_) {
      throw new Error('Katalog di GitHub bukan JSON yang valid.');
    }

    if (!data || Array.isArray(data) || typeof data !== 'object') {
      throw new Error('Struktur katalog harus berupa object.');
    }

    // Katalog memang dibutuhkan browser untuk pencarian/filter/detail.
    // Token GitHub tidak pernah dikirim ke client.
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, data);
  } catch (error) {
    return send(res, Number(error.status) || 500, {
      ok: false,
      error: error.message || 'Gagal memuat katalog.'
    });
  }
};
