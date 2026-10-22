/* Tests de l'interface (Playwright + serveur local simulé).
   Lancer : NODE_PATH=<modules playwright> node --test tests/interface.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { demarrer } = require('./serveur-local');

const PORT = 8765;
const URL = 'http://localhost:' + PORT + '/';
const CAPTURES = process.env.CAPTURES || path.join(__dirname, 'captures');
let navigateur, srv, g;

test.before(async () => {
  fs.mkdirSync(CAPTURES, { recursive: true });
  ({ serveur: srv, g } = await demarrer(PORT, '2026-10-22 07:40'));
  navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
});
test.after(async () => { await navigateur.close(); srv.close(); });

async function page(options) {
  const ctx = await navigateur.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR' }, options || {}));
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
  p.erreurs = erreurs;
  return p;
}

test('page publique : prénom, inscription, doublon, annulation', async () => {
  const p = await page();
  await p.goto(URL);
  await p.waitForSelector('.creneau');
  assert.equal(await p.locator('.demi').count(), 2);
  assert.match(await p.locator('.demi').first().innerText(), /Matin\s+jeudi 22 octobre/);

  await p.getByRole('button', { name: "S'inscrire à 8h30" }).click();
  await p.getByLabel('Prénom', { exact: true }).fill('Camila');
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForSelector('.creneau.moi');
  assert.match(await p.locator('#toast').textContent(), /Camila : inscrit\(e\) à 8h30/);
  assert.equal(await p.getByRole('button', { name: 'Déjà inscrit(e) à 8h30' }).count(), 3);
  assert.match(await p.locator('.bonjour').innerText(), /Bonjour Camila/);

  // d'autres personnes s'inscrivent (autre appareil)
  for (const n of ['Olivier', 'Nicolas']) g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M2', nom: n });
  g.__appel({ action: 'inscrire', demi: 'SOIR', creneauId: 'S1', nom: 'Fethallah' });
  await p.reload();
  await p.waitForSelector('.creneau.moi');
  await p.screenshot({ path: path.join(CAPTURES, '1-accueil-mobile.png'), fullPage: true });

  // annuler quelqu'un d'autre : confirmation
  await p.getByRole('button', { name: 'Annuler la réservation de Nicolas' }).click();
  assert.match(await p.locator('#confirmation-texte').innerText(), /Êtes-vous sûr de vouloir annuler la réservation de Nicolas \?/);
  await p.screenshot({ path: path.join(CAPTURES, '2-confirmation.png') });
  await p.getByRole('button', { name: 'Non' }).click();
  assert.equal(await p.getByRole('button', { name: 'Annuler la réservation de Nicolas' }).count(), 1);
  await p.getByRole('button', { name: 'Annuler la réservation de Nicolas' }).click();
  await p.getByRole('button', { name: 'Oui, annuler' }).click();
  await p.waitForFunction(() => !document.querySelector('[data-nom="Nicolas"]'));
  assert.match(await p.locator('#toast').textContent(), /Réservation de Nicolas annulée/);
  assert.equal(g.lire('Journal').filter(j => j.action === 'ANNULATION').length, 1);

  // le prénom est retenu
  await p.reload();
  await p.waitForSelector('.creneau');
  assert.match(await p.locator('.bonjour').innerText(), /Bonjour Camila/);
  assert.deepEqual(p.erreurs, []);
});

test('page publique : créneau complet et mode sombre, PC', async () => {
  for (let i = 1; i <= 8; i++) g.__appel({ action: 'inscrire', demi: 'MATIN', creneauId: 'M3', nom: 'Personne ' + i });
  const p = await page({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await p.goto(URL);
  await p.waitForSelector('.creneau.complet');
  assert.equal(await p.getByRole('button', { name: 'Complet' }).count(), 1);
  await p.screenshot({ path: path.join(CAPTURES, '3-accueil-pc-sombre.png'), fullPage: true });
  assert.deepEqual(p.erreurs, []);
});

test('vue chauffeur avec code', async () => {
  const p = await page();
  await p.goto(URL + 'chauffeur.html');
  await p.locator('#champ-pin').fill('0000');
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForFunction(() => /incorrect/.test(document.getElementById('erreur-pin').textContent));
  await p.locator('#champ-pin').fill(g.__props.PIN_CHAUFFEUR);
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForSelector('.ch-creneau');
  assert.match(await p.locator('#vue').innerText(), /Camila/);
  await p.screenshot({ path: path.join(CAPTURES, '4-chauffeur.png'), fullPage: true });
  assert.equal(await p.locator('button[data-annuler]').count(), 0, 'consultation seule');
  assert.deepEqual(p.erreurs.filter(e => !/Failed to load resource/.test(e)), []);
});

test('administration : onglets et actions', async () => {
  const p = await page({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(URL + 'admin.html');
  await p.locator('#champ-pin').fill(g.__props.PIN_ADMIN);
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.waitForSelector('#demis .creneau');
  // ajout d'un visiteur
  await p.getByLabel('Prénom à ajouter à 9h30').first().fill('Visiteur');
  await p.getByLabel('Prénom à ajouter à 9h30').first().press('Enter');
  await p.waitForFunction(() => /Visiteur/.test(document.getElementById('demis').innerText));
  await p.screenshot({ path: path.join(CAPTURES, '5-admin-inscriptions.png'), fullPage: true });

  for (const [onglet, fichier] of [['Créneaux', '6-admin-creneaux'], ['Fermetures', '7-admin-fermetures'],
    ['Statistiques', '8-admin-stats'], ['Journal', '9-admin-journal'], ['Réglages', '10-admin-reglages']]) {
    await p.getByRole('tab', { name: onglet }).click();
    await p.screenshot({ path: path.join(CAPTURES, fichier + '.png'), fullPage: true });
  }
  // fermeture
  await p.getByRole('tab', { name: 'Fermetures' }).click();
  await p.locator('#nf-date').fill('2026-12-24');
  await p.locator('#nf-motif').fill('Veille de Noël');
  await p.locator('#form-fermeture button').click();
  await p.waitForFunction(() => /Veille de Noël/.test(document.getElementById('liste-fermetures').innerText));
  // créneau désactivé
  await p.getByRole('tab', { name: 'Créneaux' }).click();
  const ligne = p.locator('.cr-ligne').nth(3);
  await ligne.locator('input[type=checkbox]').uncheck();
  await ligne.getByRole('button', { name: 'Enregistrer' }).click();
  await p.waitForFunction(() => /Créneau enregistré/.test(document.getElementById('toast').textContent));
  const etat = g.__appel({ action: 'etat' });
  assert.equal(etat.demis.find(d => d.demi === 'MATIN').creneaux.length, 3);
  assert.deepEqual(p.erreurs, []);
});
