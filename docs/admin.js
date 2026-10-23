/* NAVETTE – administration */
(function () {
  'use strict';
  var N = window.Navette;
  var CLE_PIN = 'navette.pin.admin';
  var pin = N.stockage.lire(CLE_PIN) || '';
  var donnees = null;
  var e = N.echapper;

  /* ---------- connexion ---------- */
  function afficherConnexion(message) {
    N.el('vue').hidden = true;
    N.el('connexion').hidden = false;
    N.el('erreur-pin').textContent = message || '';
    N.el('champ-pin').value = '';
    N.el('champ-pin').focus();
  }

  function erreurAcces(err) {
    if (/code incorrect|essais/i.test(err.message)) {
      pin = ''; N.stockage.effacer(CLE_PIN);
      afficherConnexion(err.message);
      return true;
    }
    return false;
  }

  function appel(action, extra) {
    return N.api(action, Object.assign({ pin: pin }, extra || {}));
  }

  function charger(silencieux) {
    if (!pin) { afficherConnexion(); return Promise.resolve(); }
    if (silencieux) {
      // Pas d'actualisation automatique pendant une saisie (évite d'effacer le champ).
      var actif = document.activeElement;
      if (N.estOccupe() || (actif && /INPUT|SELECT|TEXTAREA/.test(actif.tagName) && N.el('vue').contains(actif))) return Promise.resolve();
    }
    return appel('admin.donnees').then(function (rep) {
      donnees = rep;
      N.bandeau(null);
      N.el('connexion').hidden = true;
      N.el('vue').hidden = false;
      toutRendre();
      N.majPied(N.heureLocale());
    }).catch(function (err) {
      if (!erreurAcces(err)) N.bandeau(err.message);
    });
  }

  /** Recharge les données d'administration et réaffiche tout. */
  function rafraichir() {
    return appel('admin.donnees').then(function (rep) {
      donnees = rep;
      toutRendre();
      N.majPied(N.heureLocale());
    });
  }

  /**
   * Exécute une action dans la fenêtre « … en cours » ; la fenêtre reste ouverte
   * jusqu'à ce que les données soient rechargées, puis affiche « C'est fait ! ».
   * Renvoie true si l'action a réussi.
   */
  function action(nom, extra, texteAttente, siReussi) {
    return N.executer(texteAttente, function () {
      return appel(nom, extra).then(function (rep) {
        if (siReussi) siReussi(rep);
        return rafraichir().then(function () { return rep; }, function () { return rep; });
      });
    }).then(function (r) {
      if (r.ok) {
        if (r.rep.message) N.toast('✓ ' + r.rep.message);
        return true;
      }
      if (!erreurAcces({ message: r.erreur })) {
        if (!r.delai) N.toast(r.erreur, 'erreur');
        charger(false);
      }
      return false;
    });
  }

  /* ---------- onglets ---------- */
  document.querySelector('.onglets').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-onglet]');
    if (!b) return;
    document.querySelectorAll('.onglets button').forEach(function (x) {
      x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      N.el('p-' + x.dataset.onglet).hidden = x !== b;
    });
  });

  function toutRendre() {
    rendreInscriptions();
    rendreCreneaux();
    rendreFermetures();
    rendreStats();
    rendreJournal();
    rendreReglages();
  }

  /* ---------- inscriptions ---------- */
  function rendreInscriptions() {
    N.el('demis').innerHTML = donnees.demis.map(function (d) {
      var total = d.creneaux.reduce(function (s, c) { return s + c.inscrits.length; }, 0);
      return '<section class="demi"><div class="demi-titre"><h2>' + (d.demi === 'MATIN' ? 'Matin' : 'Soir') + '</h2>' +
        '<span class="date">' + e(d.libelle) + '</span><span class="total">' + total + ' inscrits</span></div>' +
        '<div class="creneaux">' + d.creneaux.map(function (c) {
          var nb = c.inscrits.length;
          var rem = N.etatRemplissage(nb, c.capacite);
          var noms = c.inscrits.map(function (i) {
            return '<li class="chip"><span class="nom">' + e(i.nom) + '</span><button type="button" data-annuler="' +
              e(i.id) + '" data-nom="' + e(i.nom) + '" aria-label="Retirer ' + e(i.nom) + '">×</button></li>';
          }).join('');
          var ajout = nb < c.capacite
            ? '<form class="ajout-nom" data-demi="' + d.demi + '" data-creneau="' + e(c.id) + '" data-heure="' + N.formatHeure(c.heure) + '">' +
              '<input type="text" maxlength="30" placeholder="Ajouter un prénom" aria-label="Prénom à ajouter à ' + N.formatHeure(c.heure) + '">' +
              '<button type="submit" class="btn btn-primaire btn-petit">Ajouter</button></form>'
            : '';
          return '<article class="creneau ' + rem.classe + '"><div class="cr-tete"><span class="cr-heure">' + N.formatHeure(c.heure) + '</span>' +
            '<span class="cr-places">' + rem.texte + '</span><span class="cr-compte">' + nb + '/' + c.capacite + '</span></div>' +
            N.sieges(nb, c.capacite, -1) + '<ul class="inscrits">' + noms + '</ul>' + ajout + '</article>';
        }).join('') + '</div></section>';
    }).join('');
  }

  N.el('demis').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-annuler]');
    if (!b) return;
    N.confirmer('Êtes-vous sûr de vouloir annuler la réservation de ' + b.dataset.nom + ' ?', 'Oui, annuler').then(function (ok) {
      if (ok) action('admin.annuler', { id: b.dataset.annuler }, 'Désinscription de ' + b.dataset.nom + ' en cours…');
    });
  });
  N.el('demis').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target;
    var nom = f.querySelector('input').value.trim();
    if (!nom) return;
    action('admin.inscrire', { demi: f.dataset.demi, creneauId: f.dataset.creneau, nom: nom },
      'Inscription de ' + nom + ' à ' + f.dataset.heure + ' en cours…');
  });

  /* ---------- créneaux ---------- */
  function rendreCreneaux() {
    N.el('liste-creneaux').innerHTML = donnees.creneaux.map(function (c) {
      return '<form class="cr-ligne" data-id="' + e(c.id) + '" data-demi="' + c.demi + '">' +
        '<strong>' + (c.demi === 'MATIN' ? 'Matin' : 'Soir') + '</strong>' +
        '<input type="time" value="' + e(c.heure) + '" aria-label="Heure" required>' +
        '<input type="number" min="1" max="50" value="' + c.capacite + '" aria-label="Places" required>' +
        '<label class="case"><input type="checkbox"' + (c.actif ? ' checked' : '') + '> actif</label>' +
        '<button type="submit" class="btn btn-secondaire btn-petit">Enregistrer</button></form>';
    }).join('');
  }
  N.el('liste-creneaux').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target;
    var champs = f.querySelectorAll('input');
    action('admin.creneau', { creneau: {
      id: f.dataset.id, demi: f.dataset.demi, heure: champs[0].value, capacite: champs[1].value, actif: champs[2].checked
    } }, 'Enregistrement du créneau en cours…');
  });
  N.el('form-creneau').addEventListener('submit', function (ev) {
    ev.preventDefault();
    action('admin.creneau', { creneau: {
      demi: N.el('nc-demi').value, heure: N.el('nc-heure').value, capacite: N.el('nc-cap').value, actif: true
    } }, 'Ajout du créneau en cours…');
  });

  /* ---------- fermetures ---------- */
  function rendreFermetures() {
    N.el('liste-fermetures').innerHTML = donnees.fermetures.length
      ? donnees.fermetures.map(function (f) {
        return '<li><span><strong>' + e(f.libelle) + ' ' + f.date.slice(0, 4) + '</strong> – ' + e(f.motif) + '</span>' +
          '<button type="button" class="btn btn-secondaire btn-petit droite" data-supprimer="' + e(f.date) + '" data-libelle="' + e(f.libelle) + '">Supprimer</button></li>';
      }).join('')
      : '<li class="aide">Aucune fermeture ajoutée.</li>';
    N.el('liste-feries').innerHTML = donnees.feries.map(function (f) {
      return '<li><span>' + e(f.libelle) + ' ' + f.date.slice(0, 4) + '</span><span class="droite aide" style="margin:0">' + e(f.motif) + '</span></li>';
    }).join('');
  }
  N.el('liste-fermetures').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-supprimer]');
    if (!b) return;
    N.confirmer('Rouvrir la journée du ' + b.dataset.libelle + ' ?', 'Oui, rouvrir').then(function (ok) {
      if (ok) action('admin.fermeture.supprimer', { date: b.dataset.supprimer }, 'Réouverture de la journée en cours…');
    });
  });
  N.el('form-fermeture').addEventListener('submit', function (ev) {
    ev.preventDefault();
    action('admin.fermeture.ajouter', { date: N.el('nf-date').value, motif: N.el('nf-motif').value },
      'Ajout de la fermeture en cours…').then(function (ok) { if (ok) N.el('nf-motif').value = ''; });
  });

  /* ---------- statistiques ---------- */
  var periodeStats = '90';
  function fmt(v) { return v === null || v === undefined ? '–' : String(v).replace('.', ','); }

  function barres(liste, max) {
    return '<div class="barres">' + liste.map(function (x) {
      var pct = x.moyenne ? Math.round((x.moyenne / max) * 100) : 0;
      return '<div class="barre" title="' + e(x.etiquette) + ' : ' + fmt(x.moyenne) + ' en moyenne sur ' + x.jours + ' jour(s)">' +
        '<span>' + e(x.etiquette) + '</span><span class="piste"><span class="rempli" style="width:' + pct + '%"></span></span>' +
        '<span class="val">' + fmt(x.moyenne) + '</span></div>';
    }).join('') + '</div>';
  }

  function colonnes(serie, demi) {
    var max = Math.max.apply(null, serie.map(function (s) { return s[demi] || 0; }).concat([1]));
    var cols = serie.map(function (s) {
      var v = s[demi];
      if (v === null || v === undefined) return '<span class="col vide" title="' + e(s.libelle) + ' : pas de données"></span>';
      return '<span class="col" style="height:' + Math.max(Math.round((v / max) * 100), 2) + '%" title="' + e(s.libelle) + ' : ' + v + ' passagers"></span>';
    }).join('');
    var debut = serie.length ? serie[0].libelle : '', fin = serie.length ? serie[serie.length - 1].libelle : '';
    return '<div class="colonnes" role="img" aria-label="Passagers par jour, ' + (demi === 'MATIN' ? 'matin' : 'soir') + ', max ' + max + '">' + cols + '</div>' +
      '<div class="legende-axe"><span>' + e(debut) + '</span><span>max ' + max + '</span><span>' + e(fin) + '</span></div>';
  }

  function rendreStats() {
    var s = donnees.stats;
    if (!s) { N.el('stats').innerHTML = ''; return; }
    var parJour = periodeStats === '90' ? s.parJour90 : s.parJourTout;
    var maxJour = 1;
    ['MATIN', 'SOIR'].forEach(function (d) { parJour[d].forEach(function (x) { if (x.moyenne > maxJour) maxJour = x.moyenne; }); });
    var jourListe = function (d) {
      return parJour[d].map(function (x) { return { etiquette: x.jour, moyenne: x.moyenne, jours: x.jours }; });
    };

    var html = '<div class="tuiles">' +
      '<div class="tuile"><div class="valeur">' + fmt(s.resume.MATIN.moyenne30) + '</div><div class="etiquette">passagers / matin (30 j)</div></div>' +
      '<div class="tuile"><div class="valeur">' + fmt(s.resume.SOIR.moyenne30) + '</div><div class="etiquette">passagers / soir (30 j)</div></div>' +
      '<div class="tuile"><div class="valeur">' + fmt(s.resume.MATIN.moyenneTout) + ' / ' + fmt(s.resume.SOIR.moyenneTout) + '</div><div class="etiquette">matin / soir, tout l\'historique</div></div>' +
      '<div class="tuile"><div class="valeur">' + s.resume.MATIN.jours + '</div><div class="etiquette">jours comptés' + (s.depuis ? ' depuis le ' + e(s.depuis) : '') + '</div></div>' +
      '</div>';

    html += '<div class="section carte"><h2>Moyenne par jour de la semaine</h2>' +
      '<p class="sous-titre"><label class="case" style="display:inline-flex">Période : ' +
      '<select id="periode-stats" style="width:auto;min-height:40px">' +
      '<option value="90"' + (periodeStats === '90' ? ' selected' : '') + '>90 derniers jours</option>' +
      '<option value="tout"' + (periodeStats === 'tout' ? ' selected' : '') + '>Tout l\'historique</option></select></label></p>' +
      '<div class="duo"><div><h3>Matin</h3>' + barres(jourListe('MATIN'), maxJour) + '</div>' +
      '<div><h3>Soir</h3>' + barres(jourListe('SOIR'), maxJour) + '</div></div></div>';

    html += '<div class="section carte"><h2>30 derniers jours comptés</h2><p class="sous-titre">Total de passagers par demi-journée (survolez une barre pour le détail).</p>' +
      '<div class="duo"><div><h3>Matin</h3>' + colonnes(s.serie, 'MATIN') + '</div><div><h3>Soir</h3>' + colonnes(s.serie, 'SOIR') + '</div></div>' +
      '<details style="margin-top:12px"><summary>Voir en tableau</summary><div class="tableau-wrap"><table><thead><tr><th>Jour</th><th class="num">Matin</th><th class="num">Soir</th></tr></thead><tbody>' +
      s.serie.slice().reverse().map(function (x) {
        return '<tr><td>' + e(x.libelle) + ' ' + x.date.slice(0, 4) + '</td><td class="num">' + fmt(x.MATIN) + '</td><td class="num">' + fmt(x.SOIR) + '</td></tr>';
      }).join('') + '</tbody></table></div></details></div>';

    html += '<div class="section carte"><h2>Remplissage par créneau (90 jours)</h2>' +
      (s.parCreneau.length
        ? '<div class="tableau-wrap"><table><thead><tr><th>Créneau</th><th class="num">Moyenne</th><th class="num">Remplissage</th><th class="num">Jours</th></tr></thead><tbody>' +
          s.parCreneau.map(function (c) {
            return '<tr><td>' + (c.demi === 'MATIN' ? 'Matin ' : 'Soir ') + N.formatHeure(c.heure) + '</td><td class="num">' + fmt(c.moyenne) +
              '</td><td class="num">' + (c.taux === null ? '–' : c.taux + ' %') + '</td><td class="num">' + c.jours + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="aide">Disponible après les premiers jours d\'utilisation (l\'historique de l\'ancien fichier ne contient que les totaux).</p>') +
      '</div>';

    N.el('stats').innerHTML = html;
  }
  N.el('stats').addEventListener('change', function (ev) {
    if (ev.target.id === 'periode-stats') { periodeStats = ev.target.value; rendreStats(); }
  });

  /* ---------- journal ---------- */
  function rendreJournal() {
    N.el('journal').innerHTML = donnees.journal.length
      ? donnees.journal.map(function (j) {
        var creneau = j.demi ? (j.demi === 'MATIN' ? 'Matin ' : 'Soir ') + N.formatHeure(j.heure) : '';
        if (j.date) creneau += (creneau ? ' · ' : '') + j.date.slice(8, 10) + '/' + j.date.slice(5, 7);
        return '<tr><td>' + e(j.horodatage.slice(8, 10) + '/' + j.horodatage.slice(5, 7) + ' ' + j.horodatage.slice(11, 16)) + '</td>' +
          '<td><span class="badge ' + e(j.action) + '">' + e(j.action.toLowerCase()) + '</span></td>' +
          '<td>' + e(creneau) + '</td><td>' + e(j.nom) + '</td><td>' + e(j.acteur) + '</td><td>' + e(j.details) + '</td></tr>';
      }).join('')
      : '<tr><td colspan="6" class="aide">Aucune action.</td></tr>';
  }

  /* ---------- réglages ---------- */
  function rendreReglages() {
    var r = donnees.reglages;
    if (document.activeElement && N.el('form-reglages').contains(document.activeElement)) return;
    N.el('r-matin').value = r.BASCULE_MATIN;
    N.el('r-soir').value = r.BASCULE_SOIR;
    N.el('r-pentecote').checked = r.LUNDI_PENTECOTE_FERIE === 'OUI';
  }
  N.el('form-reglages').addEventListener('submit', function (ev) {
    ev.preventDefault();
    action('admin.reglages', { reglages: {
      BASCULE_MATIN: N.el('r-matin').value, BASCULE_SOIR: N.el('r-soir').value,
      LUNDI_PENTECOTE_FERIE: N.el('r-pentecote').checked ? 'OUI' : 'NON'
    } }, 'Enregistrement des réglages en cours…');
  });
  N.el('form-pin').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var role = N.el('p-role').value, nouveau = N.el('p-nouveau').value;
    action('admin.pin', { role: role, nouveau: nouveau }, 'Changement du code en cours…', function () {
      if (role === 'admin') { pin = nouveau; N.stockage.ecrire(CLE_PIN, pin); }
      N.el('p-nouveau').value = '';
    });
  });

  /* ---------- démarrage ---------- */
  N.el('connexion').addEventListener('submit', function (ev) {
    ev.preventDefault();
    pin = N.el('champ-pin').value.trim();
    if (!pin) return;
    N.stockage.ecrire(CLE_PIN, pin);
    charger(false);
  });
  N.el('deconnexion').addEventListener('click', function () {
    pin = ''; N.stockage.effacer(CLE_PIN); donnees = null; afficherConnexion();
  });

  N.majPied();
  charger(false);
  N.actualisationAuto(function (s) { if (pin) charger(s); });
})();
