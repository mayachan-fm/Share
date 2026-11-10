// Middleware Vercel — jalan SEBELUM file statis detail.html disajikan.
// Tugas: jika crawler (WA/FB/Telegram/dll) buka /detail.html?slug=xxx,
// rewrite internal ke /api/catalog?mode=og&slug=xxx agar dapat meta OG dinamis.
// Browser biasa tetap lanjut ke detail.html statis.
// TANPA import apapun (Web API murni) — aman untuk project tanpa Next.js.

const UA_CRAWLER = /facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Slackbot|Discordbot|redditbot|Googlebot|BingPreview|Applebot/i;

export default function middleware(req) {
  const ua = req.headers.get('user-agent') || '';
  if (!UA_CRAWLER.test(ua)) return; // browser biasa → lanjut ke detail.html statis

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || '';
  const target = new URL(
    `/api/catalog?mode=og&slug=${encodeURIComponent(slug)}`,
    url.origin
  );

  // Header khusus Vercel Middleware: rewrite internal (URL di browser tidak berubah).
  return new Response(null, {
    headers: { 'x-middleware-rewrite': target.toString() },
  });
}

export const config = {
  matcher: '/detail.html',
};
