# Installation de NAVETTE (version 0.1.0)

Durée : environ 20 minutes. Deux parties : **Google** (le serveur et les données), puis **GitHub** (la page web).

---

## Partie 1 – Google (serveur + données)

### 1. Créer le Google Sheet
1. Sur https://drive.google.com : **Nouveau › Google Sheets › Feuille de calcul vierge**.
2. Renommez-le **NAVETTE-DATA** (en haut à gauche).

### 2. Coller le code du serveur
1. Dans ce Sheet : menu **Extensions › Apps Script**. Un nouvel onglet s'ouvre.
2. En haut à gauche, cliquez sur « Projet sans titre » et renommez-le **NAVETTE**.
3. Dans le fichier `Code.gs` affiché : effacez tout, puis collez le contenu du fichier `backend/Code.gs`.
4. Cliquez sur **＋** (à côté de « Fichiers ») › **Script**, nommez-le **Historique**, effacez son contenu et collez le contenu de `backend/Historique.gs`.
5. Cliquez sur l'icône **Enregistrer** (disquette).

### 3. Lancer l'installation (une seule fois)
1. En haut, dans la liste des fonctions, choisissez **installer**, puis cliquez sur **Exécuter**.
2. Google demande une autorisation (c'est normal : c'est votre propre script) :
   **Examiner les autorisations** › votre compte › « Google n'a pas validé cette application » ›
   **Paramètres avancés** › **Accéder à NAVETTE (non sécurisé)** › **Autoriser**.
3. Le **journal d'exécution** (en bas) affiche :
   ```
   Code ADMIN : ......
   Code CHAUFFEUR : ......
   ```
   **Notez ces deux codes.** Vous pourrez les changer plus tard dans l'administration.
4. Revenez sur le Sheet : 6 onglets ont été créés (Creneaux, Inscriptions, Fermetures, Comptage, Journal, Parametres).
   L'onglet « Feuille 1 » peut être supprimé. **Ne modifiez pas les onglets à la main** : tout se gère depuis l'administration.

### 4. Publier le serveur
1. Dans Apps Script : **Déployer › Nouveau déploiement**.
2. Roue dentée à côté de « Sélectionner le type » › **Application Web**.
3. Description : `v0.1.0` · Exécuter en tant que : **Moi** · Qui a accès : **Tout le monde**.
4. **Déployer**, puis copiez l'**URL de l'application Web** (elle se termine par `/exec`).
5. **Envoyez-moi cette URL** : je l'ajoute dans `docs/config.js` avant la mise en ligne.

---

## Partie 2 – GitHub (page web)

### 5. Envoyer les fichiers
1. Ouvrez https://github.com/ALTRI-VAI/navette › **Add file › Upload files**.
2. Dans l'Explorateur Windows, ouvrez le dossier `Navette3000\navette`, sélectionnez **tout son contenu**
   (dossiers `docs`, `backend`, `tests`, `tools` et les fichiers) et glissez-le dans la page GitHub.
3. En bas, « Commit changes » : titre `v0.1.0 – version pilote`, puis **Commit changes**.

### 6. Activer la publication du site
1. Dans le dépôt : **Settings › Pages**.
2. Source : **Deploy from a branch** · Branch : **main** · dossier **/docs** › **Save**.
3. Après 1 à 2 minutes, le site est en ligne : https://altri-vai.github.io/navette/

### 7. Marquer la version
1. Page du dépôt › **Releases** (colonne de droite) › **Create a new release**.
2. **Choose a tag** : tapez `v0.1.0` › « Create new tag ».
3. Titre : `v0.1.0 – Version pilote`. Description : copiez la section 0.1.0 de `CHANGELOG.md`.
4. **Publish release**.

---

## Partie 3 – Vérifications

1. Ouvrez https://altri-vai.github.io/navette/ sur votre téléphone : indiquez un prénom, inscrivez-vous, puis annulez.
2. Vérifiez dans le Sheet (onglets Inscriptions et Journal) que l'action apparaît.
3. Ouvrez `…/admin.html` avec le code admin : parcourez les onglets (l'historique apparaît dans Statistiques).
4. Ouvrez `…/chauffeur.html` avec le code chauffeur, puis transmettez ce lien et ce code au chauffeur.

**Installer l'application sur le téléphone** :
- Android (Chrome) : menu ⋮ › **Ajouter à l'écran d'accueil**.
- iPhone (Safari) : bouton Partager › **Sur l'écran d'accueil**.

---

## Mettre à jour le serveur (versions suivantes)

Après avoir collé un nouveau `Code.gs` : **Déployer › Gérer les déploiements › ✏️ (modifier) ›
Version : Nouvelle version › Déployer**. L'URL reste la même : rien à changer côté GitHub.
⚠️ Ne pas utiliser « Nouveau déploiement » : cela créerait une nouvelle URL.

## Pilote et mise en service

- Pendant le pilote, l'ancien Google Sheet continue de fonctionner normalement.
- À la mise en service (version 1.0.0) : dans l'ancien fichier, **Extensions › Apps Script › Déclencheurs** :
  supprimer ceux de `clearRangeMatin` et `clearRangeSoir`, puis passer le fichier en lecture seule.
- Pour compléter l'historique jusqu'au jour de la bascule, envoyez-moi une copie récente de l'ancien fichier.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| « Application non configurée » | L'URL du serveur n'est pas dans `docs/config.js` |
| « Pas de connexion au serveur » | Réseau, ou déploiement Apps Script non accessible à « Tout le monde » |
| « Onglet introuvable : lancez installer() » | L'étape 3 n'a pas été faite |
| Page GitHub introuvable (404) | Étape 6 non faite, ou attendre 2 minutes |
| Code refusé après plusieurs essais | Blocage de 15 minutes après 5 erreurs |
