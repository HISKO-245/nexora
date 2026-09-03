const CACHE_NAME = 'nexora-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './details.html',
  './reader.html',
  './manifest.json'
];

// تثبيت Service Worker وحفظ الملفات الأساسية في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// تفعيل Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// جلب الملفات: تجربة الشبكة أولاً، وإن تعذرت يتم الاستعانة بالكاش (Network First with Cache Fallback)
self.addEventListener('fetch', (event) => {
  // نقوم بتجاهل الطلبات التي ليست من نوع GET أو طلبات Firebase الخارجية كي لا تعطل البيانات الحية
  if (event.request.method !== 'GET' || event.request.url.includes('firestore') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // إذا كان الرد سليمًا يتم تحديث نسخة الكاش
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // في حالة عدم توفر إنترنت يتم جلب الملف من الكاش المحلي
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
