/* NAVETTE – page publique d'inscription */
(function () {
  'use strict';
  var N = window.Navette;
  var CLE_PRENOM = 'navette.prenom';
  var etat = null;
  var prenom = N.stockage.lire(CLE_PRENOM) || '';
  var apresPrenom = null;

  /* ---------- prénom ---------- */
  function majBonjour() {
    N.el('bonjour-texte').innerHTML = prenom
      ? 'Bonjour <strong>' + N.echapper(prenom) + '</strong>'
      : 'Bonjour ! Indiquez votre prénom pour vous inscrire.';
    N.el('btn-prenom').textContent = prenom ? 'modifier' : 'Indiquer mon prénom';
  }

  function ouvrirPrenom(suite) {
    apresPrenom = suite || null;
    N.el('champ-prenom').value = prenom;
    N.el('erreur-prenom').textContent = '';
    N.el('dialogue-prenom').showModal();
    N.el('champ-prenom').focus();
  }

  N.el('btn-prenom').addEventListener('click', function () { ouvrirPrenom(); });
  N.el('prenom-annuler').addEventListener('click', function () {
    apresPrenom = null;
    N.el('dialogue-prenom').close();
  });
  N.el('form-prenom').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = N.el('champ-prenom').value.replace(/\s+/g, ' ').trim();
    if (!v) { N.el('erreur-prenom').textContent = 'Indiquez votre prénom.'; return; }
    prenom = v;
    N.stockage.ecrire(CLE_PRENOM, prenom);
    N.el('dialogue-prenom').close();
    majBonjour();
    rendre();
    if (apresPrenom) { var f = apresPrenom; apresPrenom = null; f(); }
  });

  /* ---------- chargement ---------- */
  function charger(silencieux) {
    if (silencieux && N.estOccupe()) return Promise.resolve();
    return N.api('etat').then(function (rep) {
      etat = rep;
      N.bandeau(null);
      rendre();
      N.majPied(N.heureLocale());
    }).catch(function (err) {
      N.bandeau(err.message + (etat ? ' Les informations affichées peuvent ne pas être à jour.' : ''));
      if (!etat) N.el('demis').innerHTML = '';
    });
  }

  /* ---------- rendu ---------- */
  function rendre() {
    if (!etat) return;
    var moi = N.cleNom(prenom);
    var html = etat.demis.map(function (d) {
      var monCreneau = null;
      d.creneaux.forEach(function (c) {
        c.inscrits.forEach(function (i) { if (prenom && N.cleNom(i.nom) === moi) monCreneau = c; });
      });
      var total = d.creneaux.reduce(function (s, c) { return s + c.inscrits.length; }, 0);
      var cartes = d.creneaux.map(function (c) { return carte(d, c, monCreneau, moi); }).join('');
      return '<section class="demi" aria-labelledby="titre-' + d.demi + '">' +
        '<div class="demi-titre"><h2 id="titre-' + d.demi + '">' + (d.demi === 'MATIN' ? 'Matin' : 'Soir') + '</h2>' +
        '<span class="date">' + N.echapper(d.libelle) + '</span>' +
        '<span class="total">' + total + ' inscrit' + (total > 1 ? 's' : '') + '</span></div>' +
        '<div class="creneaux">' + (cartes || '<p class="aide">Aucun créneau.</p>') + '</div></section>';
    }).join('');
    N.el('demis').innerHTML = html;
  }

  function carte(d, c, monCreneau, moi) {
    var nb = c.inscrits.length;
    var rem = N.etatRemplissage(nb, c.capacite);
    var estMoi = monCreneau === c;
    var indexMoi = -1;
    var noms = c.inscrits.map(function (i, idx) {
      var mien = prenom && N.cleNom(i.nom) === moi;
      if (mien) indexMoi = idx;
      return '<li class="chip' + (mien ? ' moi' : '') + '"><span class="nom">' + N.echapper(i.nom) + '</span>' +
        '<button type="button" data-annuler="' + N.echapper(i.id) + '" data-nom="' + N.echapper(i.nom) + '" ' +
        'aria-label="Annuler la réservation de ' + N.echapper(i.nom) + '" title="Annuler">×</button></li>';
    }).join('');
    var h = N.formatHeure(c.heure);
    var bouton;
    if (estMoi) bouton = '<button type="button" class="btn btn-plein btn-inscrit" disabled>✓ Vous êtes inscrit(e) à ' + h + '</button>';
    else if (nb >= c.capacite) bouton = '<button type="button" class="btn btn-plein" disabled>Complet</button>';
    else if (monCreneau) bouton = '<button type="button" class="btn btn-plein" disabled>Déjà inscrit(e) à ' + N.formatHeure(monCreneau.heure) + '</button>';
    else bouton = '<button type="button" class="btn btn-plein btn-primaire" data-inscrire="' + N.echapper(c.id) +
      '" data-demi="' + d.demi + '" data-date="' + d.date + '" data-heure="' + h + '">S\'inscrire à ' + h + '</button>';

    return '<article class="creneau ' + rem.classe + (estMoi ? ' moi' : '') + '" aria-label="Départ ' + h + ', ' + rem.texte + '">' +
      '<div class="cr-tete"><span class="cr-heure">' + h + '</span>' +
      '<span class="cr-places">' + rem.texte + '</span>' +
      '<span class="cr-compte">' + nb + '/' + c.capacite + '</span></div>' +
      N.sieges(nb, c.capacite, indexMoi) +
      '<ul class="inscrits">' + noms + '</ul>' + bouton + '</article>';
  }

  /* ---------- actions ---------- */
  function apresAction(r) {
    if (r.ok) {
      etat = r.rep; rendre(); N.majPied(N.heureLocale());
      N.toast('✓ ' + r.rep.message);
    } else {
      if (!r.delai) N.toast(r.erreur, 'erreur');
      charger(false);
    }
  }

  function inscrire(bouton) {
    var donnees = { demi: bouton.dataset.demi, creneauId: bouton.dataset.inscrire, date: bouton.dataset.date };
    var lancer = function () {
      donnees.nom = prenom;
      N.executer('Inscription de ' + prenom + ' à ' + bouton.dataset.heure + ' en cours…', function () {
        return N.api('inscrire', donnees);
      }).then(apresAction);
    };
    if (!prenom) ouvrirPrenom(lancer); else lancer();
  }

  function annuler(bouton) {
    var nom = bouton.dataset.nom;
    N.confirmer('Êtes-vous sûr de vouloir annuler la réservation de ' + nom + ' ?', 'Oui, annuler').then(function (ok) {
      if (!ok) return;
      N.executer('Désinscription de ' + nom + ' en cours…', function () {
        return N.api('annuler', { id: bouton.dataset.annuler });
      }).then(apresAction);
    });
  }

  N.el('demis').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.inscrire) inscrire(b);
    else if (b.dataset.annuler) annuler(b);
  });

  /* ---------- démarrage ---------- */
  majBonjour();
  N.majPied();
  charger(false);
  N.actualisationAuto(charger);
  N.enregistrerSW();
})();
