const BASE_URL = new URL('./', self.location.href);
const CACHE_PREFIX = 'monster-bopper:' + BASE_URL.pathname + ':';
const CACHE = CACHE_PREFIX + 'v10-20261002';
const GAME_FILES = ['./', './index.html', './three.module.js', './manifest.json', './icon-192.png', './icon-512.png'];
const GAME_URLS = new Set(GAME_FILES.map(path => new URL(path, BASE_URL).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(GAME_FILES.map(path => new Request(new URL(path, BASE_URL), {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  url.search = ''; url.hash = '';
  if (!GAME_URLS.has(url.href)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (!response.ok) throw new Error('Game unavailable');
      const cache = await caches.open(CACHE); await cache.put(new URL('./index.html', BASE_URL).href, response.clone()); return response;
    }).catch(async () => (await caches.open(CACHE)).match(new URL('./index.html', BASE_URL).href)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.href)) || fetch(request).then(async response => {
    if (response.ok) await cache.put(url.href, response.clone());
    return response;
  })));
});
