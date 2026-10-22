/**
 * NAVETTE – serveur (Google Apps Script lié au Google Sheet « NAVETTE-DATA »)
 *
 * Rôle : API JSON appelée par l'interface publiée sur GitHub Pages.
 * Données : onglets du Google Sheet (Creneaux, Inscriptions, Fermetures,
 * Comptage, Journal, Parametres). Codes PIN : propriétés du script.
 *
 * Première installation : exécuter la fonction installer() une fois
 * depuis l'éditeur Apps Script, puis déployer en « Application Web ».
 */

var VERSION = '0.1.0';
var TZ = 'Europe/Paris';

var ONGLETS = {
  Creneaux: ['id', 'demi', 'heure', 'capacite', 'actif', 'ordre'],
  Inscriptions: ['id', 'date', 'demi', 'creneauId', 'heure', 'nom', 'cle', 'creeLe'],
  Fermetures: ['date', 'motif'],
  Comptage: ['date', 'demi', 'heure', 'nb', 'capacite', 'source'],
  Journal: ['horodatage', 'action', 'date', 'demi', 'heure', 'nom', 'acteur', 'details'],
  Parametres: ['cle', 'valeur']
};

var PARAMS_DEFAUT = {
  BASCULE_MATIN: '10:30',
  BASCULE_SOIR: '19:00',
  RETENTION_JOURS: '7',
  LUNDI_PENTECOTE_FERIE: 'OUI',
  DERNIER_COMPTAGE_MATIN: '',
  DERNIER_COMPTAGE_SOIR: ''
};

var CRENEAUX_DEFAUT = [
  ['M1', 'MATIN', '08:00', 8, 'OUI', 1],
  ['M2', 'MATIN', '08:30', 8, 'OUI', 2],
  ['M3', 'MATIN', '09:00', 8, 'OUI', 3],
  ['M4', 'MATIN', '09:30', 8, 'OUI', 4],
  ['S1', 'SOIR', '17:00', 8, 'OUI', 1],
  ['S2', 'SOIR', '17:30', 8, 'OUI', 2],
  ['S3', 'SOIR', '18:00', 8, 'OUI', 3],
  ['S4', 'SOIR', '18:30', 8, 'OUI', 4]
];

var DEMIS = ['MATIN', 'SOIR'];
var MAX_ESSAIS_PIN = 5;

/* ------------------------------------------------------------------ */
/* Points d'entrée web                                                 */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'etat';
  return repondre(traiter(action === 'etat' ? { action: 'etat' } : { action: 'ping' }));
}

function doPost(e) {
  var requete;
  try {
    requete = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return repondre({ ok: false, erreur: 'Requête illisible.' });
  }
  return repondre(traiter(requete));
}

function repondre(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet))
    .setMimeType(ContentService.MimeType.JSON);
}

function traiter(req) {
  try {
    var action = String(req.action || '');
    var routes = {
      'ping': function () { return { version: VERSION }; },
      'etat': function () { return etatPublic(); },
      'inscrire': function () { return inscrire(req, 'public'); },
      'annuler': function () { return annuler(req, 'public'); },
      'chauffeur': function () { verifierPin('chauffeur', req.pin); return etatPublic(); },
      'admin.connexion': function () { verifierPin('admin', req.pin); return {}; },
      'admin.donnees': function () { verifierPin('admin', req.pin); return donneesAdmin(); },
      'admin.inscrire': function () { verifierPin('admin', req.pin); return inscrire(req, 'admin'); },
      'admin.annuler': function () { verifierPin('admin', req.pin); return annuler(req, 'admin'); },
      'admin.creneau': function () { verifierPin('admin', req.pin); return enregistrerCreneau(req.creneau || {}); },
      'admin.fermeture.ajouter': function () { verifierPin('admin', req.pin); return ajouterFermeture(req.date, req.motif); },
      'admin.fermeture.supprimer': function () { verifierPin('admin', req.pin); return supprimerFermeture(req.date); },
      'admin.reglages': function () { verifierPin('admin', req.pin); return enregistrerReglages(req.reglages || {}); },
      'admin.pin': function () { verifierPin('admin', req.pin); return changerPin(req.role, req.nouveau); }
    };
    if (!routes[action]) throw erreurMetier('Action inconnue.');
    var resultat = routes[action]() || {};
    resultat.ok = true;
    resultat.version = VERSION;
    return resultat;
  } catch (err) {
    if (err && err.metier) return { ok: false, erreur: err.message, version: VERSION };
    console.error(err && err.stack ? err.stack : err);
    return { ok: false, erreur: 'Erreur du serveur, réessayez dans un instant.', version: VERSION };
  }
}

function erreurMetier(message) {
  var e = new Error(message);
  e.metier = true;
  return e;
}

/* ------------------------------------------------------------------ */
/* Dates, jours ouvrés et jours fériés                                 */
/* ------------------------------------------------------------------ */

/** Horloge (remplaçable dans les tests). */
var horloge = function () { return new Date(); };

function maintenant() {
  var s = Utilities.formatDate(horloge(), TZ, 'yyyy-MM-dd HH:mm:ss');
  return { date: s.slice(0, 10), heure: s.slice(11, 16), complet: s };
}

function versUtc(dateStr) {
  var p = dateStr.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
}

function depuisUtc(d) {
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function ajouterJours(dateStr, n) {
  var d = versUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return depuisUtc(d);
}

/** 0 = dimanche … 6 = samedi */
function jourSemaine(dateStr) { return versUtc(dateStr).getUTCDay(); }

/** Date de Pâques (algorithme de Meeus / Jones / Butcher). */
function paques(annee) {
  var a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var mois = Math.floor((h + l - 7 * m + 114) / 31);
  var jour = ((h + l - 7 * m + 114) % 31) + 1;
  return annee + '-' + pad2(mois) + '-' + pad2(jour);
}

/** Jours fériés français d'une année : { 'yyyy-MM-dd': 'libellé' } */
function feriesAnnee(annee, lundiPentecote) {
  var p = paques(annee);
  var f = {};
  f[annee + '-01-01'] = 'Jour de l\'an';
  f[ajouterJours(p, 1)] = 'Lundi de Pâques';
  f[annee + '-05-01'] = 'Fête du Travail';
  f[annee + '-05-08'] = 'Victoire 1945';
  f[ajouterJours(p, 39)] = 'Ascension';
  if (lundiPentecote) f[ajouterJours(p, 50)] = 'Lundi de Pentecôte';
  f[annee + '-07-14'] = 'Fête nationale';
  f[annee + '-08-15'] = 'Assomption';
  f[annee + '-11-01'] = 'Toussaint';
  f[annee + '-11-11'] = 'Armistice 1918';
  f[annee + '-12-25'] = 'Noël';
  return f;
}

function motifFermeture(dateStr, ctx) {
  var js = jourSemaine(dateStr);
  if (js === 0 || js === 6) return 'Week-end';
  var annee = +dateStr.slice(0, 4);
  if (!ctx._feries[annee]) ctx._feries[annee] = feriesAnnee(annee, ctx.params.LUNDI_PENTECOTE_FERIE === 'OUI');
  if (ctx._feries[annee][dateStr]) return ctx._feries[annee][dateStr];
  if (ctx.fermetures[dateStr] !== undefined) return ctx.fermetures[dateStr] || 'Fermeture';
  return '';
}

function estOuvre(dateStr, ctx) { return motifFermeture(dateStr, ctx) === ''; }

function prochainOuvre(dateStr, ctx) {
  var d = dateStr;
  for (var i = 0; i < 120; i++) {
    d = ajouterJours(d, 1);
    if (estOuvre(d, ctx)) return d;
  }
  throw erreurMetier('Aucun jour ouvré trouvé dans les 120 prochains jours.');
}

/** Date du prochain matin / soir ouvert aux inscriptions. */
function dateCible(demi, maint, ctx) {
  var bascule = demi === 'MATIN' ? ctx.params.BASCULE_MATIN : ctx.params.BASCULE_SOIR;
  if (estOuvre(maint.date, ctx) && maint.heure < bascule) return maint.date;
  return prochainOuvre(maint.date, ctx);
}

/** La demi-journée est-elle terminée (bascule passée) ? */
function demiTerminee(dateStr, demi, maint, ctx) {
  var bascule = demi === 'MATIN' ? ctx.params.BASCULE_MATIN : ctx.params.BASCULE_SOIR;
  return dateStr < maint.date || (dateStr === maint.date && maint.heure >= bascule);
}

var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

function libelleDate(dateStr) {
  var d = versUtc(dateStr);
  return JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()];
}

/* ------------------------------------------------------------------ */
/* Accès au Google Sheet                                               */
/* ------------------------------------------------------------------ */

function classeur() { return SpreadsheetApp.getActiveSpreadsheet(); }

function feuille(nom) {
  var f = classeur().getSheetByName(nom);
  if (!f) throw erreurMetier('Onglet « ' + nom + ' » introuvable : lancez installer() dans Apps Script.');
  return f;
}

function normaliserCellule(valeur, colonne) {
  if (valeur instanceof Date) {
    if (colonne === 'date') return Utilities.formatDate(valeur, TZ, 'yyyy-MM-dd');
    if (colonne === 'heure') return Utilities.formatDate(valeur, TZ, 'HH:mm');
    return Utilities.formatDate(valeur, TZ, 'yyyy-MM-dd HH:mm:ss');
  }
  return valeur === null || valeur === undefined ? '' : String(valeur);
}

/** Lit un onglet et renvoie une liste d'objets (avec _ligne = n° de ligne). */
function lire(nom) {
  var entetes = ONGLETS[nom];
  var valeurs = feuille(nom).getDataRange().getValues();
  var lignes = [];
  for (var i = 1; i < valeurs.length; i++) {
    var vide = true, obj = { _ligne: i + 1 };
    for (var j = 0; j < entetes.length; j++) {
      obj[entetes[j]] = normaliserCellule(valeurs[i][j], entetes[j]);
      if (obj[entetes[j]] !== '') vide = false;
    }
    if (!vide) lignes.push(obj);
  }
  return lignes;
}

function versLigne(nom, obj) {
  return ONGLETS[nom].map(function (h) {
    var v = obj[h];
    return v === null || v === undefined ? '' : String(v);
  });
}

/** Écrit des lignes en format texte brut (évite les conversions et formules). */
function ecrireLignes(f, ligneDepart, lignes) {
  if (!lignes.length) return;
  var besoin = ligneDepart + lignes.length - 1;
  if (besoin > f.getMaxRows()) f.insertRowsAfter(f.getMaxRows(), besoin - f.getMaxRows() + 200);
  f.getRange(ligneDepart, 1, lignes.length, lignes[0].length)
    .setNumberFormat('@')
    .setValues(lignes);
}

function ajouter(nom, objets) {
  if (!Array.isArray(objets)) objets = [objets];
  var f = feuille(nom);
  ecrireLignes(f, f.getLastRow() + 1, objets.map(function (o) { return versLigne(nom, o); }));
}

function reecrire(nom, objets) {
  var f = feuille(nom);
  var derniere = f.getLastRow();
  if (derniere > 1) f.getRange(2, 1, derniere - 1, ONGLETS[nom].length).clearContent();
  ecrireLignes(f, 2, objets.map(function (o) { return versLigne(nom, o); }));
}

function mettreAJour(nom, obj) {
  ecrireLignes(feuille(nom), obj._ligne, [versLigne(nom, obj)]);
}

function lireParams() {
  var p = {};
  Object.keys(PARAMS_DEFAUT).forEach(function (k) { p[k] = PARAMS_DEFAUT[k]; });
  lire('Parametres').forEach(function (l) { if (l.cle) p[l.cle] = l.valeur; });
  return p;
}

function ecrireParam(cle, valeur) {
  var existant = lire('Parametres').filter(function (l) { return l.cle === cle; })[0];
  if (existant) { existant.valeur = valeur; mettreAJour('Parametres', existant); }
  else ajouter('Parametres', { cle: cle, valeur: valeur });
}

function chargerContexte() {
  var fermetures = {};
  lire('Fermetures').forEach(function (l) { if (l.date) fermetures[l.date] = l.motif; });
  var creneaux = lire('Creneaux').map(function (c) {
    return { id: c.id, demi: c.demi, heure: c.heure, capacite: Number(c.capacite) || 0,
      actif: c.actif === 'OUI', ordre: Number(c.ordre) || 0, _ligne: c._ligne };
  });
  creneaux.sort(function (a, b) { return a.heure < b.heure ? -1 : a.heure > b.heure ? 1 : a.ordre - b.ordre; });
  return { params: lireParams(), fermetures: fermetures, creneaux: creneaux, _feries: {} };
}

function journaliser(action, infos, acteur, details) {
  ajouter('Journal', {
    horodatage: maintenant().complet, action: action,
    date: infos.date || '', demi: infos.demi || '', heure: infos.heure || '', nom: infos.nom || '',
    acteur: acteur, details: details || ''
  });
}

function verrouiller() {
  var verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw erreurMetier('Serveur occupé, réessayez dans un instant.');
  return verrou;
}

/* ------------------------------------------------------------------ */
/* Inscriptions                                                        */
/* ------------------------------------------------------------------ */

function nettoyerNom(nom) {
  var n = String(nom || '')
    .replace(/[<>"`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[=+\-@'\s]+/, '')
    .trim();
  if (n.length > 30) n = n.slice(0, 30).trim();
  if (!n) throw erreurMetier('Indiquez votre prénom.');
  return n;
}

function cleNom(nom) {
  var c = String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return c || String(nom).toLowerCase();
}

function construireEtat(ctx, maint, inscriptions) {
  var demis = DEMIS.map(function (demi) {
    var date = dateCible(demi, maint, ctx);
    var duJour = inscriptions.filter(function (i) { return i.date === date && i.demi === demi; });
    duJour.sort(function (a, b) { return a.creeLe < b.creeLe ? -1 : 1; });
    var creneaux = ctx.creneaux.filter(function (c) { return c.demi === demi && c.actif; }).map(function (c) {
      return {
        id: c.id, heure: c.heure, capacite: c.capacite,
        inscrits: duJour.filter(function (i) { return i.creneauId === c.id; })
          .map(function (i) { return { id: i.id, nom: i.nom }; })
      };
    });
    return { demi: demi, date: date, libelle: libelleDate(date), creneaux: creneaux };
  });
  demis.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.demi === 'MATIN' ? -1 : 1); });
  return { serveur: { date: maint.date, heure: maint.heure }, demis: demis };
}

function etatPublic() {
  return construireEtat(chargerContexte(), maintenant(), lire('Inscriptions'));
}

function inscrire(req, acteur) {
  var verrou = verrouiller();
  try {
    var demi = req.demi === 'SOIR' ? 'SOIR' : req.demi === 'MATIN' ? 'MATIN' : '';
    if (!demi) throw erreurMetier('Demi-journée inconnue.');
    var nom = nettoyerNom(req.nom);
    var ctx = chargerContexte();
    var maint = maintenant();
    var date = dateCible(demi, maint, ctx);
    if (req.date && req.date !== date) {
      throw erreurMetier('La liste est passée au ' + libelleDate(date) + '. Vérifiez puis réessayez.');
    }
    var creneau = ctx.creneaux.filter(function (c) { return c.id === req.creneauId && c.demi === demi && c.actif; })[0];
    if (!creneau) throw erreurMetier('Ce créneau n\'existe plus.');

    var inscriptions = lire('Inscriptions');
    var cle = cleNom(nom);
    var memeDemi = inscriptions.filter(function (i) { return i.date === date && i.demi === demi; });
    var doublon = memeDemi.filter(function (i) { return i.cle === cle; })[0];
    if (doublon) throw erreurMetier(doublon.nom + ' est déjà inscrit(e) à ' + formatHeure(doublon.heure) + '.');
    var occupes = memeDemi.filter(function (i) { return i.creneauId === creneau.id; }).length;
    if (occupes >= creneau.capacite) throw erreurMetier('Le créneau de ' + formatHeure(creneau.heure) + ' est complet.');

    var nouvelle = {
      id: Utilities.getUuid(), date: date, demi: demi, creneauId: creneau.id,
      heure: creneau.heure, nom: nom, cle: cle, creeLe: maint.complet
    };
    ajouter('Inscriptions', nouvelle);
    journaliser('INSCRIPTION', nouvelle, acteur);
    inscriptions.push(nouvelle);
    var etat = construireEtat(ctx, maint, inscriptions);
    etat.message = nom + ' : inscrit(e) à ' + formatHeure(creneau.heure) + ' – ' + libelleDate(date);
    return etat;
  } finally {
    verrou.releaseLock();
  }
}

function annuler(req, acteur) {
  var verrou = verrouiller();
  try {
    var ctx = chargerContexte();
    var maint = maintenant();
    var inscriptions = lire('Inscriptions');
    var cible = inscriptions.filter(function (i) { return i.id === req.id; })[0];
    if (!cible) throw erreurMetier('Cette réservation a déjà été annulée.');
    if (cible.date !== dateCible(cible.demi, maint, ctx)) throw erreurMetier('Cette réservation est archivée.');
    feuille('Inscriptions').deleteRow(cible._ligne);
    journaliser('ANNULATION', cible, acteur);
    inscriptions = inscriptions.filter(function (i) { return i.id !== cible.id; });
    var etat = construireEtat(ctx, maint, inscriptions);
    etat.message = 'Réservation de ' + cible.nom + ' annulée';
    return etat;
  } finally {
    verrou.releaseLock();
  }
}

function formatHeure(h) {
  var p = String(h).split(':');
  return (+p[0]) + 'h' + (p[1] && p[1] !== '00' ? p[1] : '');
}

/* ------------------------------------------------------------------ */
/* Codes PIN                                                           */
/* ------------------------------------------------------------------ */

function verifierPin(role, pin) {
  var cache = CacheService.getScriptCache();
  var cleCache = 'echecs_' + role;
  var echecs = Number(cache.get(cleCache) || 0);
  if (echecs >= MAX_ESSAIS_PIN) throw erreurMetier('Trop d\'essais. Réessayez dans 15 minutes.');
  var props = PropertiesService.getScriptProperties();
  var attendu = props.getProperty(role === 'admin' ? 'PIN_ADMIN' : 'PIN_CHAUFFEUR');
  var admin = props.getProperty('PIN_ADMIN');
  var valide = pin && (String(pin) === attendu || (role === 'chauffeur' && String(pin) === admin));
  if (!valide) {
    cache.put(cleCache, String(echecs + 1), 900);
    throw erreurMetier('Code incorrect.');
  }
  if (echecs) cache.remove(cleCache);
}

function changerPin(role, nouveau) {
  if (role !== 'admin' && role !== 'chauffeur') throw erreurMetier('Rôle inconnu.');
  if (!/^\d{4,8}$/.test(String(nouveau || ''))) throw erreurMetier('Le code doit contenir 4 à 8 chiffres.');
  PropertiesService.getScriptProperties().setProperty(role === 'admin' ? 'PIN_ADMIN' : 'PIN_CHAUFFEUR', String(nouveau));
  journaliser('CODE', {}, 'admin', 'Code ' + role + ' modifié');
  return { message: 'Code ' + (role === 'admin' ? 'admin' : 'chauffeur') + ' modifié.' };
}

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

function donneesAdmin() {
  var ctx = chargerContexte();
  var maint = maintenant();
  var etat = construireEtat(ctx, maint, lire('Inscriptions'));

  var fermetures = Object.keys(ctx.fermetures)
    .filter(function (d) { return d >= ajouterJours(maint.date, -30); })
    .sort()
    .map(function (d) { return { date: d, libelle: libelleDate(d), motif: ctx.fermetures[d] }; });

  var feries = [];
  var annee = +maint.date.slice(0, 4);
  [annee, annee + 1].forEach(function (a) {
    var f = feriesAnnee(a, ctx.params.LUNDI_PENTECOTE_FERIE === 'OUI');
    Object.keys(f).forEach(function (d) {
      if (d >= maint.date && d <= ajouterJours(maint.date, 365)) feries.push({ date: d, libelle: libelleDate(d), motif: f[d] });
    });
  });
  feries.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

  var journal = lire('Journal').slice(-300).reverse().map(function (j) {
    return { horodatage: j.horodatage, action: j.action, date: j.date, demi: j.demi,
      heure: j.heure, nom: j.nom, acteur: j.acteur, details: j.details };
  });

  etat.creneaux = ctx.creneaux.map(function (c) {
    return { id: c.id, demi: c.demi, heure: c.heure, capacite: c.capacite, actif: c.actif };
  });
  etat.fermetures = fermetures;
  etat.feries = feries;
  etat.journal = journal;
  etat.reglages = {
    BASCULE_MATIN: ctx.params.BASCULE_MATIN,
    BASCULE_SOIR: ctx.params.BASCULE_SOIR,
    LUNDI_PENTECOTE_FERIE: ctx.params.LUNDI_PENTECOTE_FERIE,
    RETENTION_JOURS: ctx.params.RETENTION_JOURS
  };
  etat.stats = calculerStats(maint);
  return etat;
}

function enregistrerCreneau(c) {
  var demi = c.demi === 'SOIR' ? 'SOIR' : c.demi === 'MATIN' ? 'MATIN' : '';
  if (!demi) throw erreurMetier('Choisissez matin ou soir.');
  var heure = String(c.heure || '').trim();
  if (/^\d{1,2}h\d{0,2}$/i.test(heure)) {
    var p = heure.toLowerCase().split('h');
    heure = pad2(+p[0]) + ':' + pad2(+(p[1] || 0));
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) throw erreurMetier('Heure invalide (format 08:30).');
  var capacite = Math.round(Number(c.capacite));
  if (!(capacite >= 1 && capacite <= 50)) throw erreurMetier('Capacité invalide (1 à 50).');
  var verrou = verrouiller();
  try {
    var lignes = lire('Creneaux');
    var existant = c.id ? lignes.filter(function (l) { return l.id === c.id; })[0] : null;
    var actif = c.actif === false || c.actif === 'NON' ? 'NON' : 'OUI';
    if (existant) {
      var avant = formatHeure(existant.heure) + ' / ' + existant.capacite + ' pl. / ' + existant.actif;
      existant.demi = demi; existant.heure = heure; existant.capacite = capacite; existant.actif = actif;
      mettreAJour('Creneaux', existant);
      journaliser('CRENEAU', { demi: demi, heure: heure }, 'admin',
        'Modifié : ' + avant + ' → ' + formatHeure(heure) + ' / ' + capacite + ' pl. / ' + actif);
    } else {
      var prefixe = demi === 'MATIN' ? 'M' : 'S';
      var n = 1;
      while (lignes.some(function (l) { return l.id === prefixe + n; })) n++;
      ajouter('Creneaux', { id: prefixe + n, demi: demi, heure: heure, capacite: capacite, actif: actif, ordre: n });
      journaliser('CRENEAU', { demi: demi, heure: heure }, 'admin', 'Créé : ' + capacite + ' places');
    }
  } finally {
    verrou.releaseLock();
  }
  return { message: 'Créneau enregistré.' };
}

function ajouterFermeture(date, motif) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw erreurMetier('Date invalide.');
  motif = String(motif || '').replace(/[<>"`\\]/g, '').replace(/^[=+\-@]+/, '').trim().slice(0, 60) || 'Fermeture';
  var lignes = lire('Fermetures');
  if (lignes.some(function (l) { return l.date === date; })) throw erreurMetier('Cette date est déjà fermée.');
  ajouter('Fermetures', { date: date, motif: motif });
  journaliser('FERMETURE', { date: date }, 'admin', 'Ajout : ' + motif);
  return { message: 'Fermeture du ' + libelleDate(date) + ' ajoutée.' };
}

function supprimerFermeture(date) {
  var cible = lire('Fermetures').filter(function (l) { return l.date === date; })[0];
  if (!cible) throw erreurMetier('Fermeture introuvable.');
  feuille('Fermetures').deleteRow(cible._ligne);
  journaliser('FERMETURE', { date: date }, 'admin', 'Suppression : ' + cible.motif);
  return { message: 'Fermeture du ' + libelleDate(date) + ' supprimée.' };
}

function enregistrerReglages(r) {
  var heureOk = function (h) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h)); };
  var changements = [];
  if (r.BASCULE_MATIN !== undefined) {
    if (!heureOk(r.BASCULE_MATIN)) throw erreurMetier('Heure de bascule du matin invalide.');
    ecrireParam('BASCULE_MATIN', r.BASCULE_MATIN); changements.push('matin ' + r.BASCULE_MATIN);
  }
  if (r.BASCULE_SOIR !== undefined) {
    if (!heureOk(r.BASCULE_SOIR)) throw erreurMetier('Heure de bascule du soir invalide.');
    ecrireParam('BASCULE_SOIR', r.BASCULE_SOIR); changements.push('soir ' + r.BASCULE_SOIR);
  }
  if (r.LUNDI_PENTECOTE_FERIE !== undefined) {
    var v = r.LUNDI_PENTECOTE_FERIE === true || r.LUNDI_PENTECOTE_FERIE === 'OUI' ? 'OUI' : 'NON';
    ecrireParam('LUNDI_PENTECOTE_FERIE', v); changements.push('Pentecôte fériée ' + v);
  }
  journaliser('REGLAGE', {}, 'admin', changements.join(', '));
  return { message: 'Réglages enregistrés.' };
}

/* ------------------------------------------------------------------ */
/* Statistiques                                                        */
/* ------------------------------------------------------------------ */

function moyenne(liste) {
  if (!liste.length) return null;
  var s = 0;
  liste.forEach(function (v) { s += v; });
  return Math.round((s / liste.length) * 10) / 10;
}

function calculerStats(maint) {
  var lignes = lire('Comptage');
  var totaux = {};
  var parCreneau = {};
  var limite90 = ajouterJours(maint.date, -90);
  // Si l'application a compté une demi-journée, l'historique de l'ancien fichier est ignoré pour celle-ci.
  var compteApp = {};
  lignes.forEach(function (l) { if (l.source === 'app') compteApp[l.date + '|' + l.demi] = true; });
  lignes.forEach(function (l) {
    var nb = Number(l.nb) || 0;
    var k = l.date + '|' + l.demi;
    if (l.source !== 'app' && compteApp[k]) return;
    if (!totaux[k]) totaux[k] = { date: l.date, demi: l.demi, total: 0 };
    totaux[k].total += nb;
    if (l.source === 'app' && l.date >= limite90) {
      var kc = l.demi + '|' + l.heure;
      if (!parCreneau[kc]) parCreneau[kc] = { demi: l.demi, heure: l.heure, nbs: [], places: 0, occupees: 0 };
      parCreneau[kc].nbs.push(nb);
      parCreneau[kc].places += Number(l.capacite) || 0;
      parCreneau[kc].occupees += nb;
    }
  });
  var liste = Object.keys(totaux).map(function (k) { return totaux[k]; });

  var calcul = function (filtre) {
    var res = {};
    DEMIS.forEach(function (demi) {
      res[demi] = [1, 2, 3, 4, 5].map(function (js) {
        var vals = liste.filter(function (t) { return t.demi === demi && jourSemaine(t.date) === js && filtre(t); })
          .map(function (t) { return t.total; });
        return { jour: JOURS[js], moyenne: moyenne(vals), jours: vals.length };
      });
    });
    return res;
  };

  var resume = {};
  DEMIS.forEach(function (demi) {
    var tous = liste.filter(function (t) { return t.demi === demi; });
    var recents = tous.filter(function (t) { return t.date >= ajouterJours(maint.date, -30); });
    resume[demi] = { moyenne30: moyenne(recents.map(function (t) { return t.total; })),
      moyenneTout: moyenne(tous.map(function (t) { return t.total; })), jours: tous.length };
  });

  var dates = {};
  liste.forEach(function (t) {
    if (!dates[t.date]) dates[t.date] = { date: t.date, MATIN: null, SOIR: null };
    dates[t.date][t.demi] = t.total;
  });
  var serie = Object.keys(dates).sort().slice(-30).map(function (d) {
    return { date: d, libelle: libelleDate(d), MATIN: dates[d].MATIN, SOIR: dates[d].SOIR };
  });

  var creneaux = Object.keys(parCreneau).map(function (k) {
    var c = parCreneau[k];
    return { demi: c.demi, heure: c.heure, moyenne: moyenne(c.nbs), jours: c.nbs.length,
      taux: c.places ? Math.round((c.occupees / c.places) * 100) : null };
  }).sort(function (a, b) { return a.demi === b.demi ? (a.heure < b.heure ? -1 : 1) : (a.demi === 'MATIN' ? -1 : 1); });

  var premiere = liste.length ? liste.reduce(function (m, t) { return t.date < m ? t.date : m; }, liste[0].date) : null;
  return {
    resume: resume,
    parJour90: calcul(function (t) { return t.date >= limite90; }),
    parJourTout: calcul(function () { return true; }),
    parCreneau: creneaux,
    serie: serie,
    depuis: premiere ? libelleDate(premiere) + ' ' + premiere.slice(0, 4) : null
  };
}

/* ------------------------------------------------------------------ */
/* Tâche automatique (toutes les heures) : comptage puis purge         */
/* ------------------------------------------------------------------ */

function tacheHoraire() {
  var verrou = verrouiller();
  try {
    var ctx = chargerContexte();
    var maint = maintenant();
    compter(ctx, maint);
    purger(lireParams(), maint);
  } finally {
    verrou.releaseLock();
  }
}

function compter(ctx, maint) {
  var inscriptions = lire('Inscriptions');
  var deja = {};
  lire('Comptage').forEach(function (l) { if (l.source === 'app') deja[l.date + '|' + l.demi] = true; });
  DEMIS.forEach(function (demi) {
    var cleParam = 'DERNIER_COMPTAGE_' + demi;
    var dernier = ctx.params[cleParam] || ajouterJours(maint.date, -1);
    var d = dernier, nouveauDernier = dernier, lignes = [];
    for (var i = 0; i < 60; i++) {
      d = ajouterJours(d, 1);
      if (!demiTerminee(d, demi, maint, ctx)) break;
      nouveauDernier = d;
      if (!estOuvre(d, ctx) || deja[d + '|' + demi]) continue;
      var duJour = inscriptions.filter(function (x) { return x.date === d && x.demi === demi; });
      ctx.creneaux.filter(function (c) {
        return c.demi === demi && (c.actif || duJour.some(function (x) { return x.creneauId === c.id; }));
      }).forEach(function (c) {
        lignes.push({ date: d, demi: demi, heure: c.heure, capacite: c.capacite, source: 'app',
          nb: duJour.filter(function (x) { return x.creneauId === c.id; }).length });
      });
    }
    if (lignes.length) ajouter('Comptage', lignes);
    if (nouveauDernier !== ctx.params[cleParam]) ecrireParam(cleParam, nouveauDernier);
  });
}

function purger(params, maint) {
  var jours = Number(params.RETENTION_JOURS) || 7;
  var limite = ajouterJours(maint.date, -jours);
  var inscriptions = lire('Inscriptions');
  var garder = inscriptions.filter(function (i) {
    var compte = i.date <= (params['DERNIER_COMPTAGE_' + i.demi] || '');
    return !(i.date < limite && compte);
  });
  if (garder.length !== inscriptions.length) reecrire('Inscriptions', garder);
  var journal = lire('Journal');
  var garderJ = journal.filter(function (j) { return j.horodatage.slice(0, 10) >= limite; });
  if (garderJ.length !== journal.length) reecrire('Journal', garderJ);
}

/* ------------------------------------------------------------------ */
/* Installation (à lancer une fois depuis l'éditeur)                   */
/* ------------------------------------------------------------------ */

function installer() {
  var ss = classeur();
  Object.keys(ONGLETS).forEach(function (nom) {
    var f = ss.getSheetByName(nom) || ss.insertSheet(nom);
    var entetes = ONGLETS[nom];
    f.getRange(1, 1, Math.min(f.getMaxRows(), 1000), entetes.length).setNumberFormat('@');
    f.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight('bold');
    f.setFrozenRows(1);
  });

  if (!lire('Creneaux').length) {
    ajouter('Creneaux', CRENEAUX_DEFAUT.map(function (c) {
      return { id: c[0], demi: c[1], heure: c[2], capacite: c[3], actif: c[4], ordre: c[5] };
    }));
  }

  var params = lireParams();
  var existants = {};
  lire('Parametres').forEach(function (l) { existants[l.cle] = true; });
  var hier = ajouterJours(maintenant().date, -1);
  Object.keys(PARAMS_DEFAUT).forEach(function (k) {
    if (!existants[k]) ecrireParam(k, k.indexOf('DERNIER_COMPTAGE') === 0 ? hier : params[k]);
  });

  var props = PropertiesService.getScriptProperties();
  var genere = function () { return String(Math.floor(100000 + Math.random() * 900000)); };
  if (!props.getProperty('PIN_ADMIN')) props.setProperty('PIN_ADMIN', genere());
  if (!props.getProperty('PIN_CHAUFFEUR')) props.setProperty('PIN_CHAUFFEUR', genere());

  var importes = importerHistorique();

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'tacheHoraire') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('tacheHoraire').timeBased().everyHours(1).create();

  var msg = 'NAVETTE ' + VERSION + ' installée.\n' +
    'Code ADMIN : ' + props.getProperty('PIN_ADMIN') + '\n' +
    'Code CHAUFFEUR : ' + props.getProperty('PIN_CHAUFFEUR') + '\n' +
    'Historique importé : ' + importes + ' lignes.\n' +
    'Étape suivante : Déployer > Nouveau déploiement > Application Web.';
  Logger.log(msg);
  return msg;
}

/** Importe l'historique de l'ancien fichier (constante HISTORIQUE, fichier Historique.gs). */
function importerHistorique() {
  if (typeof HISTORIQUE === 'undefined' || !HISTORIQUE.length) return 0;
  var deja = lire('Comptage').some(function (l) { return l.source === 'historique'; });
  if (deja) return 0;
  ajouter('Comptage', HISTORIQUE.map(function (h) {
    return { date: h[0], demi: h[1], heure: 'TOTAL', nb: h[2], capacite: '', source: 'historique' };
  }));
  return HISTORIQUE.length;
}
