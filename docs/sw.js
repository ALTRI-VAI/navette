/* NAVETTE – service worker : application installable et affichable hors ligne.
   Stratégie « réseau d'abord » avec revalidation systématique (cache: 'no-cache') :
   une nouvelle version publiée sur GitHub est visible dès le chargement suivant,
   sans attendre l'expiration du cache du navigateur (10 min sur GitHub Pages). */
var VERSION = '0.1.1';
var CACHE = 'navette-' + VERSION;
var FICHIERS = ['./', 'index.html', 'chauffeur.html', 'style.css?v=' + VERSION, 'commun.js?v=' + VERSION,
  'accueil.js?v=' + VERSION, 'chauffeur.js?v=' + VERSION, 'config.js?v=' + VERSION,
  'manifest.webmanifest', 'icons/icone.svg', 'icons/icone-192.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // API Google : jamais en cache
  // Nouvelle requête vers la même adresse, en forçant la vérification auprès du serveur.
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (rep) {
    if (rep.ok) {
      var copie = rep.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
    }
    return rep;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); });
  }));
});
