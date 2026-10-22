/* Simulation minimale de Google Apps Script pour tester backend/Code.gs sous Node. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function creerFeuille(nom) {
  const f = { nom, cellules: [], maxRows: 1000, frozen: 0 };
  const lignesUtiles = () => {
    let n = f.cellules.length;
    while (n > 0 && (f.cellules[n - 1] || []).every(v => v === '' || v === undefined || v === null)) n--;
    return n;
  };
  const plage = (r, c, nr, nc) => ({
    getValues() {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const l = [];
        for (let j = 0; j < nc; j++) l.push(((f.cellules[r - 1 + i] || [])[c - 1 + j]) ?? '');
        out.push(l);
      }
      return out;
    },
    setValues(v) {
      if (r - 1 + nr > f.maxRows) throw new Error('Plage hors limites');
      for (let i = 0; i < nr; i++) {
        f.cellules[r - 1 + i] = f.cellules[r - 1 + i] || [];
        for (let j = 0; j < nc; j++) {
          const val = v[i][j];
          if (typeof val === 'string' && /^=/.test(val)) throw new Error('Formule écrite : ' + val);
          f.cellules[r - 1 + i][c - 1 + j] = val;
        }
      }
      return this;
    },
    clearContent() {
      for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
        if (f.cellules[r - 1 + i]) f.cellules[r - 1 + i][c - 1 + j] = '';
      }
      return this;
    },
    setNumberFormat() { return this; },
    setFontWeight() { return this; }
  });
  f.api = {
    getName: () => nom,
    getDataRange() {
      const n = Math.max(lignesUtiles(), 1);
      const nc = Math.max(1, ...f.cellules.slice(0, n).map(l => (l || []).length));
      return plage(1, 1, n, nc);
    },
    getRange: (r, c, nr = 1, nc = 1) => plage(r, c, nr, nc),
    getLastRow: () => lignesUtiles(),
    getMaxRows: () => f.maxRows,
    insertRowsAfter: (apres, n) => { f.maxRows += n; },
    deleteRow: r => { f.cellules.splice(r - 1, 1); },
    setFrozenRows: n => { f.frozen = n; }
  };
  return f;
}

function creerEnvironnement() {
  const feuilles = {};
  const props = {};
  const cache = {};
  const declencheurs = [];
  const journalLogs = [];
  const ss = {
    getSheetByName: n => (feuilles[n] ? feuilles[n].api : null),
    insertSheet: n => { feuilles[n] = creerFeuille(n); return feuilles[n].api; }
  };
  const formatDate = (d, tz, fmt) => {
    const p = {};
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
      .replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
  };
  const contexte = {
    console: { log: () => {}, error: (...a) => journalLogs.push(a.join(' ')) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); }
    }) },
    CacheService: { getScriptCache: () => ({
      get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; }
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate, getUuid: () => crypto.randomUUID() },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: s => ({ contenu: s, setMimeType() { return this; } })
    },
    ScriptApp: {
      getProjectTriggers: () => declencheurs.slice(),
      deleteTrigger: t => { declencheurs.splice(declencheurs.indexOf(t), 1); },
      newTrigger: nom => ({ timeBased: () => ({ everyHours: () => ({ create: () => {
        declencheurs.push({ getHandlerFunction: () => nom });
      } }) }) })
    },
    Logger: { log: m => journalLogs.push(m) }
  };
  vm.createContext(contexte);
  for (const fichier of ['Historique.gs', 'Code.gs']) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'backend', fichier), 'utf8');
    vm.runInContext(code, contexte, { filename: fichier });
  }
  contexte.__feuilles = feuilles;
  contexte.__props = props;
  contexte.__cache = cache;
  contexte.__declencheurs = declencheurs;
  contexte.__logs = journalLogs;
  /** Fixe l'heure de Paris, ex. regler('2026-10-22 09:15') */
  contexte.__regler = local => {
    // Heure de Paris → instant UTC (on teste les deux décalages possibles).
    for (const off of [1, 2]) {
      const d = new Date(local.replace(' ', 'T') + ':00Z');
      d.setUTCHours(d.getUTCHours() - off);
      if (formatDate(d, 'Europe/Paris', 'yyyy-MM-dd HH:mm') === local) {
        contexte.horloge = () => new Date(d.getTime());
        return;
      }
    }
    throw new Error('Heure invalide ' + local);
  };
  /** Appel comme le ferait l'interface. */
  contexte.__appel = req => JSON.parse(contexte.doPost({ postData: { contents: JSON.stringify(req) } }).contenu);
  return contexte;
}

module.exports = { creerEnvironnement };
