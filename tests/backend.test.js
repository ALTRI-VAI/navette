/* Tests du serveur (backend/Code.gs) – lancer : node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { creerEnvironnement } = require('./faux-apps-script');

function installe(heure) {
  const g = creerEnvironnement();
  g.__regler(heure || '2026-10-22 08:00');
  g.installer();
  return g;
}
const L = (g, n) => JSON.parse(JSON.stringify(g.lire(n))); // tableaux du contexte vm → tableaux Node
const demi = (etat, d) => etat.demis.find(x => x.demi === d);
const pins = g => ({ admin: g.__props.PIN_ADMIN, chauffeur: g.__props.PIN_CHAUFFEUR });

test('installation : onglets, créneaux, codes, déclencheur, historique', () => {
  const g = installe();
  for (const o of ['Creneaux', 'Inscriptions', 'Fermetures', 'Comptage', 'Journal', 'Parametres']) assert.ok(g.__feuilles[o], o);
  assert.equal(L(g, 'Creneaux').length, 8);
  assert.match(g.__props.PIN_ADMIN, /^\d{6}$/);
  assert.equal(g.__declencheurs.length, 1);
  assert.equal(L(g, 'Comptage').length, g.HISTORIQUE.length);
  g.installer(); // relancer ne duplique rien
  assert.equal(L(g, 'Creneaux').length, 8);
  assert.equal(L(g, 'Comptage').length, g.HISTORIQUE.length);
  assert.equal(g.__declencheurs.length, 1);
});

test('jours fériés français', () => {
  const g = creerEnvironnement();
  assert.equal(g.paques(2026), '2026-04-05');
  assert.equal(g.paques(2027), '2027-03-28');
  const f = g.feriesAnnee(2026, true);
  assert.equal(f['2026-04-06'], 'Lundi de Pâques');
  assert.equal(f['2026-05-14'], 'Ascension');
  assert.equal(f['2026-05-25'], 'Lundi de Pentecôte');
  assert.equal(Object.keys(f).length, 11);
  assert.equal(Object.keys(g.feriesAnnee(2026, false)).length, 10);
});

test('bascule matin 10h30 / soir 19h, week-end et fériés sautés', () => {
  const g = installe('2026-10-22 08:00'); // jeudi
  const cas = [
    ['2026-10-22 08:00', '2026-10-22', '2026-10-22'],
    ['2026-10-22 10:29', '2026-10-22', '2026-10-22'],
    ['2026-10-22 10:30', '2026-10-23', '2026-10-22'],
    ['2026-10-22 18:59', '2026-10-23', '2026-10-22'],
    ['2026-10-22 19:00', '2026-10-23', '2026-10-23'],
    ['2026-10-23 19:00', '2026-10-26', '2026-10-26'], // vendredi soir → lundi
    ['2026-10-24 12:00', '2026-10-26', '2026-10-26'], // samedi
    ['2026-10-30 19:30', '2026-11-02', '2026-11-02'], // vendredi 30 → lundi 2 (1er nov. = dimanche)
    ['2026-11-10 20:00', '2026-11-12', '2026-11-12'], // 11 novembre férié sauté
    ['2026-11-11 09:00', '2026-11-12', '2026-11-12']  // un jour férié lui-même
  ];
  for (const [h, matin, soir] of cas) {
    g.__regler(h);
    const e = g.__appel({ action: 'etat' });
    assert.equal(demi(e, 'MATIN').date, matin, 'matin à ' + h);
    assert.equal(demi(e, 'SOIR').date, soir, 'soir à ' + h);
  }
  g.__regler('2026-10-22 14:00');
  const e = g.__appel({ action: 'etat' });
  assert.equal(e.demis[0].demi, 'SOIR', 'le soir du jour vient avant le matin du lendemain');
  assert.equal(demi(e, 'MATIN').libelle, 'vendredi 23 octobre');
});

test('changement heure été/hiver (25 octobre 2026)', () => {
  const g = installe('2026-10-23 19:30');
  const e = g.__appel({ action: 'etat' });
  assert.equal(demi(e, 'MATIN').date, '2026-10-26');
  g.__regler('2026-10-26 10:29');
  assert.equal(demi(g.__appel({ action: 'etat' }), 'MATIN').date, '2026-10-26');
});

test('fermeture ajoutée par l\'admin', () => {
  const g = installe('2026-10-22 08:00');
  const pin = pins(g).admin;
  assert.equal(g.__appel({ action: 'admin.fermeture.ajouter', pin, date: '2026-10-23', motif: 'Pont' }).ok, true);
  g.__regler('2026-10-22 20:00');
  assert.equal(demi(g.__appel({ action: 'etat' }), 'MATIN').date, '2026-10-26');
  assert.equal(g.__appel({ action: 'admin.fermeture.supprimer', pin, date: '2026-10-23' }).ok, true);
  assert.equal(demi(g.__appel({ action: 'etat' }), 'MATIN').date, '2026-10-23');
});

test('inscription, capacité 8, anti-doublon par demi-journée', () => {
  const g = installe('2026-10-22 07:00');
  const r1 = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M2', nom: ' Camila ', date: '2026-10-22' });
  assert.equal(r1.ok, true, r1.erreur);
  assert.match(r1.message, /Camila : inscrit\(e\) à 8h30/);
  assert.deepEqual(demi(r1, 'MATIN').creneaux[1].inscrits.map(i => i.nom), ['Camila']);

  const dbl = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M3', nom: 'camíla' });
  assert.equal(dbl.ok, false);
  assert.equal(dbl.erreur, 'Camila est déjà inscrit(e) à 8h30.');

  // même prénom le soir : autorisé
  assert.equal(g.__appel({ action: 'inscrire', demi: 'SOIR', creneauId: 'S1', nom: 'Camila' }).ok, true);

  for (let i = 1; i <= 8; i++) {
    const r = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'P' + i });
    assert.equal(r.ok, true, r.erreur);
  }
  const plein = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'Neuf' });
  assert.equal(plein.ok, false);
  assert.equal(plein.erreur, 'Le créneau de 8h est complet.');

  assert.equal(L(g, 'Journal').filter(j => j.action === 'INSCRIPTION').length, 10);
});

test('inscription possible même créneau commencé, refusée si la liste a basculé', () => {
  const g = installe('2026-10-22 09:50');
  assert.equal(g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'Retard', date: '2026-10-22' }).ok, true);
  g.__regler('2026-10-22 10:31');
  const r = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'Lent', date: '2026-10-22' });
  assert.equal(r.ok, false);
  assert.match(r.erreur, /passée au vendredi 23 octobre/);
});

test('nettoyage des prénoms (formules, HTML, vide)', () => {
  const g = installe('2026-10-22 07:00');
  const r = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: '=HYPERLINK("x")<b>Bob</b>' });
  assert.equal(r.ok, true, r.erreur);
  const nom = demi(r, 'MATIN').creneaux[0].inscrits[0].nom;
  assert.ok(!/[<>=]/.test(nom[0]) && !/[<>]/.test(nom), nom);
  assert.equal(g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: '   ' }).erreur, 'Indiquez votre prénom.');
  const long = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M2', nom: 'x'.repeat(80) });
  assert.equal(demi(long, 'MATIN').creneaux[1].inscrits[0].nom.length, 30);
});

test('annulation par n\'importe qui, tracée au journal', () => {
  const g = installe('2026-10-22 07:00');
  const r = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'Nicolas' });
  const id = demi(r, 'MATIN').creneaux[0].inscrits[0].id;
  const a = g.__appel({ action: 'annuler', id });
  assert.equal(a.ok, true);
  assert.equal(a.message, 'Réservation de Nicolas annulée');
  assert.equal(demi(a, 'MATIN').creneaux[0].inscrits.length, 0);
  assert.equal(g.__appel({ action: 'annuler', id }).erreur, 'Cette réservation a déjà été annulée.');
  const j = L(g, 'Journal').map(x => x.action);
  assert.deepEqual(j, ['INSCRIPTION', 'ANNULATION']);
});

test('annulation refusée une fois la liste archivée', () => {
  const g = installe('2026-10-22 07:00');
  const r = g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'Ana' });
  const id = demi(r, 'MATIN').creneaux[0].inscrits[0].id;
  g.__regler('2026-10-22 11:00');
  assert.equal(g.__appel({ action: 'annuler', id }).erreur, 'Cette réservation est archivée.');
});

test('codes PIN : chauffeur, admin, blocage après 5 erreurs, changement', () => {
  const g = installe();
  const p = pins(g);
  assert.equal(g.__appel({ action: 'chauffeur', pin: p.chauffeur }).ok, true);
  assert.equal(g.__appel({ action: 'chauffeur', pin: p.admin }).ok, true, 'le code admin ouvre la vue chauffeur');
  assert.equal(g.__appel({ action: 'admin.donnees', pin: p.chauffeur }).erreur, 'Code incorrect.');
  for (let i = 0; i < 4; i++) g.__appel({ action: 'admin.connexion', pin: '0000' });
  assert.equal(g.__appel({ action: 'admin.connexion', pin: '0000' }).erreur, 'Trop d\'essais. Réessayez dans 15 minutes.');
  assert.equal(g.__appel({ action: 'admin.connexion', pin: p.admin }).erreur, 'Trop d\'essais. Réessayez dans 15 minutes.');
  delete g.__cache.echecs_admin;
  assert.equal(g.__appel({ action: 'admin.pin', pin: p.admin, role: 'chauffeur', nouveau: '12' }).ok, false);
  assert.equal(g.__appel({ action: 'admin.pin', pin: p.admin, role: 'chauffeur', nouveau: '4321' }).ok, true);
  assert.equal(g.__appel({ action: 'chauffeur', pin: '4321' }).ok, true);
});

test('admin : créneaux, ajout/retrait de noms, réglages', () => {
  const g = installe('2026-10-22 07:00');
  const pin = pins(g).admin;
  assert.equal(g.__appel({ action: 'admin.creneau', pin, creneau: { id: 'M1', demi: 'MATIN', heure: '07:45', capacite: 9, actif: true } }).ok, true);
  assert.equal(g.__appel({ action: 'admin.creneau', pin, creneau: { id: 'M4', demi: 'MATIN', heure: '09:30', capacite: 8, actif: false } }).ok, true);
  assert.equal(g.__appel({ action: 'admin.creneau', pin, creneau: { demi: 'SOIR', heure: '19h', capacite: 8 } }).ok, true);
  assert.equal(g.__appel({ action: 'admin.creneau', pin, creneau: { demi: 'SOIR', heure: '25:00', capacite: 8 } }).ok, false);
  let e = g.__appel({ action: 'etat' });
  assert.deepEqual(demi(e, 'MATIN').creneaux.map(c => c.heure + '/' + c.capacite), ['07:45/9', '08:30/8', '09:00/8']);
  assert.deepEqual(demi(e, 'SOIR').creneaux.map(c => c.heure), ['17:00', '17:30', '18:00', '18:30', '19:00']);
  assert.equal(L(g, 'Creneaux').find(c => c.heure === '19:00').id, 'S5');

  const add = g.__appel({ action: 'admin.inscrire', pin, demi: 'SOIR', creneauId: 'S2', nom: 'Visiteur' });
  assert.equal(add.ok, true);
  assert.equal(L(g, 'Journal').slice(-1)[0].acteur, 'admin');

  assert.equal(g.__appel({ action: 'admin.reglages', pin, reglages: { BASCULE_MATIN: '11:00', BASCULE_SOIR: '19:00', LUNDI_PENTECOTE_FERIE: 'NON' } }).ok, true);
  g.__regler('2026-10-22 10:45');
  e = g.__appel({ action: 'etat' });
  assert.equal(demi(e, 'MATIN').date, '2026-10-22');
  const d = g.__appel({ action: 'admin.donnees', pin });
  assert.equal(d.ok, true);
  assert.equal(d.reglages.LUNDI_PENTECOTE_FERIE, 'NON');
  assert.ok(d.feries.length >= 9);
  assert.ok(d.stats.resume.MATIN.jours > 300);
});

test('tâche horaire : comptage des demi-journées terminées, purge à 7 jours', () => {
  const g = installe('2026-10-22 07:00'); // DERNIER_COMPTAGE = 21/10
  g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'A' });
  g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M1', nom: 'B' });
  g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M3', nom: 'C' });
  g.__appel({ action: 'inscrire', demi: 'SOIR', creneauId: 'S2', nom: 'A' });

  g.__regler('2026-10-22 10:00'); g.tacheHoraire();
  assert.equal(L(g, 'Comptage').filter(l => l.source === 'app').length, 0, 'rien avant la bascule');

  g.__regler('2026-10-22 11:05'); g.tacheHoraire();
  let app = L(g, 'Comptage').filter(l => l.source === 'app');
  assert.deepEqual(app.map(l => l.heure + '=' + l.nb), ['08:00=2', '08:30=0', '09:00=1', '09:30=0']);

  g.__regler('2026-10-22 12:05'); g.tacheHoraire();
  assert.equal(L(g, 'Comptage').filter(l => l.source === 'app').length, 4, 'pas de double comptage');

  // le trigger ne tourne pas pendant 5 jours (week-end inclus) : rattrapage
  g.__regler('2026-10-27 20:10'); g.tacheHoraire();
  app = L(g, 'Comptage').filter(l => l.source === 'app');
  const jours = [...new Set(app.map(l => l.date + ' ' + l.demi))];
  assert.deepEqual(jours, ['2026-10-22 MATIN', '2026-10-23 MATIN', '2026-10-26 MATIN', '2026-10-27 MATIN',
    '2026-10-22 SOIR', '2026-10-23 SOIR', '2026-10-26 SOIR', '2026-10-27 SOIR']);
  assert.equal(L(g, 'Inscriptions').length, 4, 'pas encore de purge');

  g.__regler('2026-10-30 02:00'); g.tacheHoraire();
  assert.equal(L(g, 'Inscriptions').length, 0, 'noms du 22/10 supprimés après 7 jours');
  assert.equal(L(g, 'Journal').filter(j => j.nom).length, 0, 'journal purgé');
  assert.equal(L(g, 'Comptage').filter(l => l.date === '2026-10-22' && l.source === 'app').length, 8, 'comptages conservés');

  // statistiques : l'historique du 22/10 n'est pas compté en double
  const st = g.__appel({ action: 'admin.donnees', pin: pins(g).admin }).stats;
  const j22 = st.serie.find(s => s.date === '2026-10-22');
  assert.equal(j22.MATIN, 3);
  assert.equal(j22.SOIR, 1);
  assert.ok(st.parCreneau.find(c => c.demi === 'MATIN' && c.heure === '08:00').moyenne > 0);
});

test('erreurs : action inconnue, corps illisible, onglet absent', () => {
  const g = installe();
  assert.equal(g.__appel({ action: 'pirate' }).erreur, 'Action inconnue.');
  assert.equal(JSON.parse(g.doPost({ postData: { contents: '{x' } }).contenu).ok, false);
  const vide = creerEnvironnement();
  assert.match(vide.__appel({ action: 'etat' }).erreur, /installer\(\)/);
  assert.equal(JSON.parse(g.doGet({ parameter: {} }).contenu).ok, true);
});
