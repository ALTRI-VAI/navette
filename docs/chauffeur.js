/* NAVETTE – vue chauffeur (consultation seule) */
(function () {
  'use strict';
  var N = window.Navette;
  var CLE_PIN = 'navette.pin.chauffeur';
  var pin = N.stockage.lire(CLE_PIN) || '';

  function afficherConnexion(message) {
    N.el('vue').hidden = true;
    N.el('connexion').hidden = false;
    N.el('erreur-pin').textContent = message || '';
    N.el('champ-pin').value = '';
    N.el('champ-pin').focus();
  }

  function charger(silencieux) {
    if (!pin) { afficherConnexion(); return Promise.resolve(); }
    return N.api('chauffeur', { pin: pin }).then(function (rep) {
      N.bandeau(null);
      N.el('connexion').hidden = true;
      N.el('vue').hidden = false;
      rendre(rep);
      N.majPied(N.heureLocale());
    }).catch(function (err) {
      if (/code|essais/i.test(err.message)) {
        pin = ''; N.stockage.effacer(CLE_PIN);
        afficherConnexion(err.message);
      } else if (!silencieux || !N.el('vue').hidden) {
        N.bandeau(err.message);
      }
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

  N.el('connexion').addEventListener('submit', function (e) {
    e.preventDefault();
    pin = N.el('champ-pin').value.trim();
    if (!pin) return;
    N.stockage.ecrire(CLE_PIN, pin);
    charger(false);
  });

  N.el('deconnexion').addEventListener('click', function () {
    pin = ''; N.stockage.effacer(CLE_PIN); afficherConnexion();
  });

  N.majPied();
  charger(false);
  N.actualisationAuto(function (s) { if (pin) charger(s); });
  N.enregistrerSW();
})();
