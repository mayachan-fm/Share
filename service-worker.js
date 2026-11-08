/* =========================================================
   Service Worker — MC Addon Share (PWA)
   Versi cache: v1  (naikkan angkanya jika ingin paksa hapus cache lama)
   Strategi:
   - HTML / JS / CSS         = network-first (selalu fresh saat online,
                               fallback ke cache saat offline)
   - Gambar / font / ikon    = stale-while-revalidate (cepat, update di belakang)
   - /api/* & Firebase       = network-only (TIDAK pernah di-cache,
                               data unduhan/like/katalog selalu akurat)
   ========================================================= */

const CACHE_NAME = 'mcaddon-share-v1';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (daftarCache) {
        return Promise.all(
          daftarCache
            .filter(function (nama) { return nama !== CACHE_NAME; })
            .map(function (nama) { return caches.delete(nama); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

function adalahApiAtauFirebase(url) {
  return (
    url.pathname.indexOf('/api/') === 0 ||
    url.hostname.indexOf('firebaseio.com') !== -1 ||
    url.hostname.indexOf('firebasedatabase.app') !== -1 ||
    url.hostname.indexOf('googleapis.com') !== -1 ||
    url.hostname.indexOf('gstatic.com') !== -1
  );
}

function adalahAsetStatis(url) {
  return /\.(png|jpe?g|svg|gif|ico|webp|woff2?|ttf|eot|otf)$/i.test(url.pathname);
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // API & Firebase: selalu online, tidak disentuh cache
  if (adalahApiAtauFirebase(url)) return;

  // Gambar, font, ikon: cache-first + update di background (stale-while-revalidate)
  if (adalahAsetStatis(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(req).then(function (cacheRes) {
          var fetchPromise = fetch(req)
            .then(function (res) {
              if (res && res.status === 200) {
                cache.put(req, res.clone());
              }
              return res;
            })
            .catch(function () { return cacheRes; });
          return cacheRes || fetchPromise;
        });
      })
    );
    return;
  }

  // HTML, JS, CSS, dan lainnya: network-first, fallback cache (offline)
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cacheRes) {
          if (cacheRes) return cacheRes;
          // Saat offline & halaman belum ter-cache, fallback ke beranda yang ter-cache
          if (req.mode === 'navigate') return caches.match('/index.html');
          return cacheRes;
        });
      })
  );
});
