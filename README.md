# NAVETTE

Inscription quotidienne à la navette d'entreprise, depuis un smartphone ou un PC, sans compte.

- **Page publique** : https://altri-vai.github.io/navette/
- **Vue chauffeur** : https://altri-vai.github.io/navette/chauffeur.html (code chauffeur)
- **Administration** : https://altri-vai.github.io/navette/admin.html (code admin)

## Organisation

| Dossier / fichier | Contenu |
|---|---|
| `docs/` | Interface (HTML/CSS/JS) publiée par GitHub Pages |
| `docs/config.js` | Adresse du serveur Apps Script |
| `backend/Code.gs` | Serveur Google Apps Script (à coller dans le projet Apps Script du Google Sheet) |
| `backend/Historique.gs` | Historique importé de l'ancien fichier |
| `tests/` | Tests automatiques et serveur local de démonstration |
| `tools/` | Outil de génération de l'historique |
| `INSTALLATION.md` | Guide d'installation pas à pas |
| `CADRAGE.md` | Décisions et règles de fonctionnement |
| `FONCTIONNALITES.md` | Suivi des fonctionnalités (idée, développé, en production, abandonné) |
| `CHANGELOG.md` | Journal des versions |

## Fonctionnement

Interface statique (GitHub Pages) → API Google Apps Script → Google Sheet « NAVETTE-DATA ».
Aucune donnée n'est stockée dans ce dépôt ; les codes sont dans les propriétés du script Google.

## Tests (pour le développement)

```
node --test tests/backend.test.js        # serveur
node tests/serveur-local.js 8080         # démonstration locale complète (http://localhost:8080)
```
