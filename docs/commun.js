/* NAVETTE – fonctions communes (accueil, chauffeur, admin) */
(function () {
  'use strict';

  var VERSION_INTERFACE = '0.1.2';
  var ACTUALISATION_MS = 30000;
  var cfg0 = window.NAVETTE_CONFIG || {};
  var DELAI_MAX_MS = cfg0.DELAI_MAX_MS || 20000;   // au-delà : « Le serveur ne répond pas »
  var DUREE_SUCCES_MS = cfg0.DUREE_SUCCES_MS || 1000; // affichage de « C'est fait ! »
  var operationEnCours = false;

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

  // Actions de simple lecture : rejouées automatiquement si Google répond mal (F34).
  // Les inscriptions, annulations et actions d'administration ne sont JAMAIS rejouées.
  var LECTURES = { 'etat': true, 'chauffeur': true, 'admin.donnees': true, 'ping': true };
  var cfgEssais = (window.NAVETTE_CONFIG || {}).PAUSES_ESSAIS_MS;
  var PAUSES_ESSAIS_MS = Array.isArray(cfgEssais) ? cfgEssais : [1000, 3000];

  /** Un seul appel au serveur. Une erreur « technique » est marquée erreur.technique = true. */
  function appelUnique(corps) {
    var technique = function (message) { var e = new Error(message); e.technique = true; return e; };
    // Corps en texte brut : évite la requête préalable CORS, non gérée par Apps Script.
    return fetch(urlApi(), { method: 'POST', body: JSON.stringify(corps), redirect: 'follow', cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw technique('Serveur indisponible (' + r.status + ').');
        return r.json().catch(function () { throw technique('Réponse du serveur illisible.'); });
      }, function () {
        throw technique('Pas de connexion au serveur. Vérifiez votre réseau.');
      })
      .then(function (rep) {
        if (rep && rep.version) majVersionServeur(rep.version);
        if (!rep || !rep.ok) throw new Error((rep && rep.erreur) || 'Erreur inconnue.');
        return rep;
      });
  }

  function api(action, donnees) {
    if (!apiConfiguree()) {
      return Promise.reject(new Error('Application non configurée : adresse du serveur manquante (config.js).'));
    }
    var corps = Object.assign({ action: action }, donnees || {});
    var pauses = LECTURES[action] ? PAUSES_ESSAIS_MS : [];
    var essai = function (n) {
      return appelUnique(corps).catch(function (err) {
        if (!err.technique || n >= pauses.length) throw err;
        return new Promise(function (r) { setTimeout(r, pauses[n]); }).then(function () { return essai(n + 1); });
      });
    };
    return essai(0);
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

  /* ---------- fenêtre de confirmation / attente ----------
     Une seule fenêtre (#dialogue-confirmation) avec trois états :
     question (texte + Non/Oui), attente (roue + texte), résultat (succès ou échec). */
  function attendre(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function etatFenetre(mode, texte) {
    var question = mode === 'question';
    el('confirmation-texte').hidden = !question;
    el('confirmation-actions').hidden = !question;
    var a = el('confirmation-attente');
    a.hidden = question;
    a.className = 'attente ' + mode;
    el('attente-texte').textContent = question ? '' : texte;
  }

  function ouvrirFenetre() {
    var d = el('dialogue-confirmation');
    if (!d.open) d.showModal();
  }

  function fermerFenetre() {
    var d = el('dialogue-confirmation');
    if (d.open) d.close();
  }

  /** Pose une question. Non → ferme la fenêtre (false). Oui → la fenêtre reste ouverte (true). */
  function confirmer(texte, libelleOui) {
    return new Promise(function (resoudre) {
      var d = el('dialogue-confirmation');
      el('confirmation-texte').textContent = texte;
      el('confirmation-oui').textContent = libelleOui || 'Oui';
      etatFenetre('question');
      el('confirmation-oui').onclick = function () { resoudre(true); };
      el('confirmation-non').onclick = function () { fermerFenetre(); resoudre(false); };
      d.oncancel = function (e) { e.preventDefault(); fermerFenetre(); resoudre(false); };
      ouvrirFenetre();
      el('confirmation-non').focus();
    });
  }

  /**
   * Exécute une action serveur en affichant « … en cours » dans la fenêtre.
   * Résultat : { ok: true, rep } ou { ok: false, erreur, delai }.
   * Succès : « C'est fait ! » pendant 1 s. Délai dépassé : message puis fermeture.
   */
  function executer(texteAttente, fonction) {
    operationEnCours = true;
    var d = el('dialogue-confirmation');
    etatFenetre('attente', texteAttente);
    d.oncancel = function (e) { e.preventDefault(); }; // pas de fermeture par Échap pendant l'attente
    ouvrirFenetre();
    var minuteur;
    var delai = new Promise(function (_, rejeter) {
      minuteur = setTimeout(function () {
        var e = new Error('Le serveur ne répond pas. La liste va être rechargée.');
        e.delai = true;
        rejeter(e);
      }, DELAI_MAX_MS);
    });
    var fin = function (resultat, pause) {
      return attendre(pause).then(function () {
        fermerFenetre();
        operationEnCours = false;
        return resultat;
      });
    };
    return Promise.race([Promise.resolve().then(fonction), delai]).then(function (rep) {
      clearTimeout(minuteur);
      etatFenetre('succes', 'C\'est fait !');
      return fin({ ok: true, rep: rep }, DUREE_SUCCES_MS);
    }, function (err) {
      clearTimeout(minuteur);
      if (err && err.delai) {
        etatFenetre('echec', err.message);
        return fin({ ok: false, erreur: err.message, delai: true }, 2500);
      }
      return fin({ ok: false, erreur: (err && err.message) || 'Erreur inconnue.' }, 0);
    });
  }

  function estOccupe() { return operationEnCours; }

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

  /** Enregistre le service worker (application installable + mises à jour immédiates). */
  function enregistrerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    var avaitControleur = !!navigator.serviceWorker.controller;
    var recharge = false;
    // Nouvelle version installée : on recharge une fois, dès qu'aucune action n'est en cours.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!avaitControleur || recharge) return;
      recharge = true;
      var essayer = function () {
        if (operationEnCours || document.querySelector('dialog[open]')) { setTimeout(essayer, 1000); return; }
        location.reload();
      };
      essayer();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
    }).catch(function () { /* facultatif */ });
  }

  window.Navette = {
    VERSION_INTERFACE: VERSION_INTERFACE,
    stockage: stockage, api: api, apiConfiguree: apiConfiguree,
    echapper: echapper, formatHeure: formatHeure, cleNom: cleNom, el: el,
    toast: toast, bandeau: bandeau, confirmer: confirmer, executer: executer, estOccupe: estOccupe, majPied: majPied,
    actualisationAuto: actualisationAuto, heureLocale: heureLocale,
    etatRemplissage: etatRemplissage, sieges: sieges, enregistrerSW: enregistrerSW
  };
})();
