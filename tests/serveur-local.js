/* Serveur local de test : sert docs/ et simule l'API Apps Script.
   Usage : node tests/serveur-local.js [port]  (heure simulée : variable HEURE="2026-10-22 08:00") */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { creerEnvironnement } = require('./faux-apps-script');

function demarrer(port, heure) {
  const g = creerEnvironnement();
  g.__regler(heure || '2026-10-22 08:00');
  g.installer();
  const racine = path.join(__dirname, '..', 'docs');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const serveur = http.createServer((req, res) => {
    if (req.url.startsWith('/api')) {
      let corps = '';
      req.on('data', c => { corps += c; });
      req.on('end', () => {
        const sortie = g.doPost({ postData: { contents: corps } });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(sortie.contenu);
      });
      return;
    }
    if (req.url.startsWith('/config.js')) {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('window.NAVETTE_CONFIG = { API_URL: "http://localhost:' + port + '/api" };');
      return;
    }
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const fichier = path.join(racine, p);
    if (!fichier.startsWith(racine) || !fs.existsSync(fichier)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream' });
    fs.createReadStream(fichier).pipe(res);
  });
  return new Promise(r => serveur.listen(port, () => r({ serveur, g })));
}

module.exports = { demarrer };
if (require.main === module) {
  const port = +(process.argv[2] || 8080);
  demarrer(port, process.env.HEURE).then(({ g }) => {
    console.log('http://localhost:' + port + '  admin ' + g.__props.PIN_ADMIN + '  chauffeur ' + g.__props.PIN_CHAUFFEUR);
  });
}
