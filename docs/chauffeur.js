/* NAVETTE – vue chauffeur : consultation seule, sans code (depuis la v0.1.2) */
(function () {
  'use strict';
  var N = window.Navette;
  var dejaAffiche = false;

  // Le code chauffeur n'existe plus : on efface celui qui aurait été retenu sur l'appareil.
  N.stockage.effacer('navette.pin.chauffeur');

  function charger() {
    return N.api('etat').then(function (rep) {
      N.bandeau(null);
      rendre(rep);
      dejaAffiche = true;
      N.majPied(N.heureLocale());
    }).catch(function (err) {
      N.bandeau(err.message + (dejaAffiche ? ' Les listes affichées peuvent ne pas être à jour.' : ''));
      if (!dejaAffiche) N.el('demis').innerHTML = '';
    });
  }

  function rendre(etat) {
    N.el('demis').innerHTML = etat.demis.map(function (d) {
      var total = d.creneaux.reduce(function (s, c) { return s + c.inscrits.length; }, 0);
      return '<section class="demi"><div class="demi-titre"><h2>' + (d.demi === 'MATIN' ? 'Matin' : 'Soir') + '</h2>' +
        '<span class="date">' + N.echapper(d.libelle) + '</span><span class="total">' + total + ' passager' + (total > 1 ? 's' : '') + '</span></div>' +
        '<div class="creneaux">' + d.creneaux.map(function (c) {
          var liste = c.inscrits.length
            ? '<ol>' + c.inscrits.map(function (i) { return '<li>' + N.echapper(i.nom) + '</li>'; }).join('') + '</ol>'
            : '<p class="vide">Personne</p>';
          return '<article class="ch-creneau"><h3>' + N.formatHeure(c.heure) +
            '<span class="nb">' + c.inscrits.length + '/' + c.capacite + '</span></h3>' + liste + '</article>';
        }).join('') + '</div></section>';
    }).join('');
  }

  N.majPied();
  charger();
  N.actualisationAuto(function () { charger(); });
  N.enregistrerSW();
})();
