/* NAVETTE – service worker : rend l'application installable et affichable hors ligne.
   Stratégie « réseau d'abord » : la dernière version est toujours servie si le réseau répond. */
var CACHE = 'navette-0.1.0';
var FICHIERS = ['./', 'index.html', 'chauffeur.html', 'style.css', 'commun.js', 'accueil.js', 'chauffeur.js',
  'config.js', 'manifest.webmanifest', 'icons/icone.svg', 'icons/icone-192.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // API Google : jamais en cache
  e.respondWith(fetch(e.request).then(function (rep) {
    var copie = rep.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
    return rep;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
  }));
});
