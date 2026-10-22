# NAVETTE – Suivi des fonctionnalités

États possibles : **Idée** · **Développé** · **En production** · **Abandonné**
Version courante de la solution : **0.1.0** (développée, en attente d'installation)
Architecture retenue : interface web sur GitHub Pages + Google Apps Script (API) + Google Sheets (données), compte Google personnel, 0 €. Détails : CADRAGE.md

| ID | Fonctionnalité | Priorité | État | Version | Notes |
|----|----------------|----------|------|---------|-------|
| F01 | Inscription en 2 clics (saisie du nom) sur le prochain créneau à venir (matin / soir) depuis mobile ou PC | MVP | Développé | 0.1.0 | Sans compte, ouvert à tous y compris visiteurs |
| F02 | Affichage des places restantes par créneau (van 8 places) | MVP | Développé | 0.1.0 | 4 créneaux matin + 4 soir, capacité paramétrable |
| F03 | Annulation d'une inscription | MVP | Développé | 0.1.0 | Tout le monde peut annuler n'importe qui, avec confirmation « Êtes-vous sûr de vouloir annuler la réservation de [Nom] ? » + trace au journal |
| F04 | Identification de l'utilisateur (lien magique e-mail ou SSO) | – | Abandonné | – | Décision : pas de compte, accès libre |
| F05 | Inscription pour les jours suivants (J+1 à J+7) | – | Abandonné | – | Décision : uniquement le prochain créneau à venir |
| F06 | Bascule automatique vers le créneau suivant (remplace l'effacement 10h30 / 19h) | MVP | Développé | 0.1.0 | Pas d'heure limite, inscription possible même créneau commencé |
| F07 | Admin : gestion des créneaux (heure, capacité, actif / inactif) | MVP | Développé | 0.1.0 | Matin 8h, 8h30, 9h, 9h30 · Soir 17h, 17h30, 18h, 18h30 · 8 places |
| F08 | Vue chauffeur : listes du prochain matin et du prochain soir, consultation seule, accès par code | MVP | Développé | 0.1.0 |  |
| F09 | Comptage automatique quotidien et historique conservé | MVP | Développé | 0.1.0 | Remplace COMPTE / ARCH-COMPTE |
| F10 | Tableau de statistiques (moyennes par jour de semaine, créneau, taux de remplissage) | MVP | Développé | 0.1.0 | Remplace l'onglet Stats |
| F11 | Calendrier des fermetures (jours fériés, ponts, fermeture site) | MVP | Développé | 0.1.0 |  |
| F12 | Interface bilingue FR / EN | – | Abandonné | – | Décision : FR uniquement |
| F13 | Inscriptions récurrentes (« tous les mardis et jeudis 8h30 / 17h30 ») | V2 | Idée | – |  |
| F14 | Liste d'attente automatique quand un créneau est complet | V2 | Idée | – |  |
| F15 | Notifications (rappel, confirmation, annulation de créneau) par e-mail / Teams | V2 | Idée | – | Coût / intégration à vérifier |
| F16 | Module « Présence vacances » (sondage été : Saclay / télétravail / vacances) avec calcul des navettes nécessaires | Plus tard | Idée | – | Pas nécessaire pour l'instant |
| F17 | Export CSV / Excel des inscriptions et statistiques | V2 | Idée | – |  |
| F18 | Message d'information / bandeau admin (retard, changement de véhicule) | V2 | Idée | – |  |
| F19 | Pointage à la montée (QR code ou coche chauffeur) pour mesurer les no-shows | V3 | Idée | – |  |
| F20 | Application installable sur smartphone (PWA, icône sur l'écran d'accueil) | MVP | Développé | 0.1.0 | Possible seulement si front sur GitHub Pages |
| F21 | Rôles admin (Alexis) et chauffeur, accès par code | MVP | Développé | 0.1.0 | Pas de compte : lien + code PIN |
| F22 | Journal des actions (qui a inscrit / annulé quoi, quand) | MVP | Développé | 0.1.0 | Dissuade les effacements abusifs |
| F23 | Anti-doublon : un même prénom une seule fois par demi-journée (matin ou soir) | MVP | Développé | 0.1.0 | Message « [Nom] est déjà inscrit(e) à 8h30 » |
| F24 | Purge des noms après 7 jours (inscriptions + journal), conservation des comptages seuls (RGPD) | MVP | Développé | 0.1.0 |  |
| F25 | Import de l'historique ARCH-COMPTE / COMPTE dans les nouvelles stats | MVP | Développé | 0.1.0 | Totaux par demi-journée (avr. 2024 → oct. 2026) ; détail par créneau non fiable dans l'ancien fichier, donc non importé |
| F26 | Bascule calculée à l'heure exacte (10h30 / 19h), indépendante du déclencheur Google | MVP | Développé | 0.1.0 | Les déclencheurs actuels partent entre 10h et 11h |
| F27 | Week-ends et jours fériés sautés dans le calcul du prochain jour ouvré | MVP | Développé | 0.1.0 | Fériés français calculés automatiquement (Pâques inclus) + fermetures ajoutées par l'admin |
| F28 | Plan de bascule : ancien Sheet en lecture seule, désactivation des déclencheurs clearRangeMatin / clearRangeSoir | MVP | Idée | – | À la mise en service |
| F29 | Mémorisation du prénom sur l'appareil, modifiable à tout moment | MVP | Développé | 0.1.0 | Stockage local du navigateur |
| F30 | Protection des saisies (injection de formule dans le Sheet, code HTML) | MVP | Développé | 0.1.0 | Sécurité |
| F31 | Affichage de la version (interface + serveur) en pied de page | MVP | Développé | 0.1.0 | Versionnage |

## Historique des versions
Voir CHANGELOG.md.
