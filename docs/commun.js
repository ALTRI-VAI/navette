/* NAVETTE – fonctions communes (accueil, chauffeur, admin) */
(function () {
  'use strict';

  var VERSION_INTERFACE = '0.1.0';
  var ACTUALISATION_MS = 30000;

  /* ---------- stockage local (protégé : peut être indisponible) ---------- */
  var stockage = {
    lire: function (cle) { try { return window.localStorage.getItem(cle); } catch (e) { return null; } },
    ecrire: function (cle, val) { try { window.localStorage.setItem(cle, val); } catch (e) { /* ignoré */ } },
    effacer: function (cle) { try { window.localStorage.removeItem(cle); } catch (e) { /* ignoré */ } }
  };

  /* ---------- appel du serveur ---------- */
  function urlApi() {
    var cfg = window.NAVETTE_CONFIG || {};
    return cfg.API_URL || '';
  }

  function apiConfiguree() {
    var u = urlApi();
    return /^https?:\/\//.test(u);
  }

  function api(action, donnees) {
    if (!apiConfiguree()) {
      return Promise.reject(new Error('Application non configurée : adresse du serveur manquante (config.js).'));
    }
    var corps = Object.assign({ action: action }, donnees || {});
    // Corps en texte brut : évite la requête préalable CORS, non gérée par Apps Script.
    return fetch(urlApi(), { method: 'POST', body: JSON.stringify(corps), redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('Serveur indisponible (' + r.status + ').');
        return r.json();
      }, function () {
        throw new Error('Pas de connexion au serveur. Vérifiez votre réseau.');
      })
      .then(function (rep) {
        if (rep && rep.version) majVersionServeur(rep.version);
        if (!rep || !rep.ok) throw new Error((rep && rep.erreur) || 'Erreur inconnue.');
        return rep;
      });
  }

  /* ---------- utilitaires ---------- */
  function echapper(t) {
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatHeure(h) {
    var p = String(h || '').split(':');
    if (p.length < 2) return String(h || '');
    return (+p[0]) + 'h' + (p[1] !== '00' ? p[1] : '');
  }

  function cleNom(nom) {
    var c = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return c || String(nom || '').toLowerCase();
  }

  function el(id) { return document.getElementById(id); }

  /* ---------- pied de page : versions ---------- */
  var versionServeur = '';
  function majVersionServeur(v) { versionServeur = v; majPied(); }
  var derniereMaj = '';
  function majPied(heure) {
    if (heure) derniereMaj = heure;
    var p = el('pied-version');
    if (!p) return;
    p.textContent = 'NAVETTE v' + VERSION_INTERFACE +
      (versionServeur ? ' · serveur v' + versionServeur : '') +
      (derniereMaj ? ' · actualisé à ' + derniereMaj : '');
  }

  /* ---------- message bref ---------- */
  var minuteurToast = null;
  function toast(message, type) {
    var t = el('toast');
    if (!t) return;
    t.textContent = message;
    t.className = 'toast visible' + (type ? ' ' + type : '');
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(function () { t.className = 'toast'; }, type === 'erreur' ? 6000 : 3500);
  }

  /* ---------- bandeau d'erreur persistante ---------- */
  function bandeau(message) {
    var b = el('bandeau');
    if (!b) return;
    if (message) { b.textContent = message; b.hidden = false; }
    else { b.hidden = true; }
  }

  /* ---------- confirmation ---------- */
  function confirmer(texte, libelleOui) {
    return new Promise(function (resoudre) {
      var d = el('dialogue-confirmation');
      el('confirmation-texte').textContent = texte;
      el('confirmation-oui').textContent = libelleOui || 'Oui';
      var fermer = function (r) { d.close(); resoudre(r); };
      el('confirmation-oui').onclick = function () { fermer(true); };
      el('confirmation-non').onclick = function () { fermer(false); };
      d.oncancel = function (e) { e.preventDefault(); fermer(false); };
      d.showModal();
      el('confirmation-non').focus();
    });
  }

  /* ---------- actualisation périodique ---------- */
  function actualisationAuto(fonction) {
    var minuteur = null;
    var lancer = function () {
      clearInterval(minuteur);
      minuteur = setInterval(function () { if (!document.hidden) fonction(true); }, ACTUALISATION_MS);
    };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) fonction(true); });
    window.addEventListener('online', function () { fonction(true); });
    lancer();
  }

  function heureLocale() {
    var d = new Date();
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  /* ---------- rendu d'une carte de créneau (sièges + noms) ---------- */
  function etatRemplissage(nb, capacite) {
    var libres = Math.max(capacite - nb, 0);
    if (libres === 0) return { classe: 'complet', texte: 'Complet' };
    if (libres <= 2) return { classe: 'presque', texte: libres + (libres > 1 ? ' places' : ' place') };
    return { classe: 'libre', texte: libres + ' places' };
  }

  function sieges(nb, capacite, indexMoi) {
    var h = '';
    for (var i = 0; i < capacite; i++) {
      var c = i < nb ? (i === indexMoi ? 'siege moi' : 'siege occupe') : 'siege';
      h += '<span class="' + c + '"></span>';
    }
    return '<div class="sieges" aria-hidden="true">' + h + '</div>';
  }

  /** Enregistre le service worker (application installable). */
  function enregistrerSW() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* facultatif */ });
    }
  }

  window.Navette = {
    VERSION_INTERFACE: VERSION_INTERFACE,
    stockage: stockage, api: api, apiConfiguree: apiConfiguree,
    echapper: echapper, formatHeure: formatHeure, cleNom: cleNom, el: el,
    toast: toast, bandeau: bandeau, confirmer: confirmer, majPied: majPied,
    actualisationAuto: actualisationAuto, heureLocale: heureLocale,
    etatRemplissage: etatRemplissage, sieges: sieges, enregistrerSW: enregistrerSW
  };
})();
