# Journal des versions – NAVETTE

Numérotation MAJEUR.MINEUR.CORRECTIF :
- CORRECTIF (0.1.1) : correction sans changement visible de fonctionnement ;
- MINEUR (0.2.0) : nouvelle fonctionnalité ;
- MAJEUR (1.0.0) : mise en service officielle ou changement incompatible (ex. structure du Google Sheet).

Le numéro figure dans `docs/commun.js` (interface), `backend/Code.gs` (serveur), `package.json`,
et en pied de page de l'application. Chaque version publiée = une « Release » GitHub `vX.Y.Z`.

## [0.1.0] – 2026-10-22 – Version pilote

### Ajouté
- Page publique : inscription au prochain matin et au prochain soir, sans compte (F01, F02).
- 4 créneaux le matin (8h, 8h30, 9h, 9h30) et 4 le soir (17h, 17h30, 18h, 18h30), 8 places chacun.
- Style « cartes + sièges du van », mode sombre automatique, application installable sur smartphone (F20).
- Prénom retenu sur l'appareil, modifiable (F29).
- Annulation par n'importe qui avec confirmation « Êtes-vous sûr… ? » et trace au journal (F03, F22).
- Un même prénom une seule fois par demi-journée (F23).
- Bascule à l'heure exacte : matin à 10h30, soir à 19h ; week-ends et jours fériés sautés (F06, F26, F27).
- Vue chauffeur protégée par code, consultation seule (F08, F21).
- Administration protégée par code : inscriptions, créneaux, fermetures, statistiques, journal, réglages, codes (F07, F10, F11, F21).
- Comptage automatique toutes les heures et suppression des noms après 7 jours (F09, F24).
- Import de l'historique de l'ancien fichier : totaux par demi-journée d'avril 2024 au 21 octobre 2026 (F25).
- Protection des saisies : formules, HTML, longueur (F30) ; blocage 15 min après 5 codes erronés.
- Version affichée en pied de page (F31).
- Tests automatiques du serveur (`tests/backend.test.js`) et de l'interface (`tests/interface.test.js`).
