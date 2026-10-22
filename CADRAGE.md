# NAVETTE – Cadrage technique (v0.1.0)

_Mis à jour le 22/10/2026 – version 0.1.0 développée_

## 1. Décisions
| Sujet | Décision |
|---|---|
| Accès | Sans compte, ouvert à tous (salariés et visiteurs), depuis internet, mobile et PC |
| Hébergement | Interface sur GitHub Pages (dépôt public) ; serveur Google Apps Script + Google Sheets sur le compte Google personnel d'Alexis ; 0 € |
| Créneaux | Matin : 8h, 8h30, 9h, 9h30 · Soir : 17h, 17h30, 18h, 18h30 · 1 van, 8 places par créneau |
| Fenêtre d'inscription | Uniquement le prochain matin et le prochain soir ; pas d'heure limite, inscription possible même créneau commencé |
| Bascule | Matin à 10h30, soir à 19h, vers le prochain jour ouvré (week-ends et jours fériés sautés) |
| Annulation | Tout le monde peut annuler n'importe qui, après confirmation « Êtes-vous sûr de vouloir annuler la réservation de [Nom] ? », trace au journal |
| Nom | Prénom libre, mémorisé sur l'appareil, modifiable à tout moment |
| Rôles | Admin (Alexis) : gestion complète, code PIN · Chauffeur : consultation des listes, code PIN distinct |
| Conservation | Noms (inscriptions et journal) supprimés après 7 jours ; comptages conservés sans limite |
| Langue | Français uniquement |
| Hors périmètre v0.1 | Module vacances, liste d'attente, récurrence, notifications |

## 2. Architecture
```
[Smartphone / PC] → https://altri-vai.github.io/navette  (HTML/CSS/JS, installable PWA)
        │  requêtes HTTPS (JSON)
        ▼
[Google Apps Script – Web App « exécuter en tant que moi, accès : tout le monde »]
        │  LockService (pas de 9e place en cas d'inscriptions simultanées)
        ▼
[Google Sheet « Navette3000-DATA »]
   Creneaux | Inscriptions | Fermetures | Comptage | Journal | Parametres
```
- Codes PIN stockés dans les propriétés du script (jamais dans le dépôt public).
- Comptage écrit par un déclencheur quotidien, à partir des inscriptions conservées (aucun effacement).
- Purge des noms par un déclencheur nocturne.

## 3. Écrans v0.1.0
1. **Accueil (public)** : prénom mémorisé (modifiable) ; bloc « Matin – [date] » et bloc « Soir – [date] » ; 4 créneaux avec places restantes /8 et noms inscrits ; bouton S'inscrire ; ✕ à côté de chaque nom → confirmation → annulation.
2. **Chauffeur** (code PIN) : listes du prochain matin et du prochain soir, lecture seule, rafraîchissement automatique.
3. **Admin** (code PIN) : créneaux (heure, capacité, actif) ; fermetures exceptionnelles ; ajout/retrait d'un nom ; journal ; statistiques (moyennes par jour de semaine et par créneau, taux de remplissage) ; historique importé.

## 4. Règles métier
- Matin affiché : entre 00h et 10h30 un jour ouvré → ce matin ; sinon → matin du prochain jour ouvré.
- Soir affiché : avant 19h un jour ouvré → ce soir ; sinon → soir du prochain jour ouvré.
- Jours fériés français calculés automatiquement (dont Pâques, Ascension, Pentecôte) + fermetures saisies par l'admin.
- Créneau complet à 8 → inscription refusée.
- Anti-doublon : même prénom (sans tenir compte des majuscules ni des espaces) refusé sur deux créneaux de la même demi-journée, message « [Nom] est déjà inscrit(e) à 8h30 ».
- Saisie nettoyée : longueur max, pas de code HTML, pas de formule (« = », « + »… en début de nom).

## 5. Limites connues
- Pas de compte : rien n'empêche un faux nom ou une annulation abusive (le journal dissuade, il n'empêche pas).
- Temps de réponse de 0,5 à 2 s par action ; actualisation automatique environ toutes les 30 s.
- Quotas Google gratuits largement suffisants pour 30 à 100 utilisateurs/jour.
- Dépend du compte Google personnel d'Alexis : prévoir un second propriétaire du Sheet.
- Dépôt GitHub public : le code est visible, pas les données ni les codes.

## 6. Versionnage
- Dépôt GitHub `ALTRI-VAI/navette` (application « NAVETTE ») : `/docs` (interface publiée par GitHub Pages, qui n’accepte que la racine ou /docs), `/backend` (Apps Script), `CHANGELOG.md`, `FONCTIONNALITES.md`, `CADRAGE.md`.
- Numérotation MAJEUR.MINEUR.CORRECTIF : 0.1.0 = pilote, 1.0.0 = mise en service.
- Une étiquette Git par version ; même numéro dans la description du déploiement Apps Script ; version affichée en pied de page (interface + serveur).
- Un seul déploiement Apps Script, mis à jour par « Nouvelle version » (l'URL ne change pas) ; la description de chaque version Apps Script reprend le numéro (ex. v0.1.0). Les tests se font sur un serveur local simulé (`tests/`) avant chaque livraison.

## 7. Plan
1. v0.1.0 : backend, accueil, chauffeur, admin, import de l'historique COMPTE / ARCH-COMPTE (totaux par demi-journée) – **développée le 22/10/2026**.
2. Installation (INSTALLATION.md) puis tests par Alexis.
3. Pilote de 2 semaines en parallèle de l'ancien Sheet.
4. v1.0.0 : mise en service, désactivation de clearRangeMatin / clearRangeSoir, ancien Sheet en lecture seule.
