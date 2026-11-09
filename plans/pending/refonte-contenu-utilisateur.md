# Refonte SkillForge : contenu 100 % importé par l'utilisateur

Demande (2026-11-09) : plus aucune leçon préchargée. Chaque utilisateur importe ses
fichiers, et les thèmes, chapitres et leçons découlent de ce qui est importé.
Refonte complète de l'interface et des fonctionnalités : bien agencée, fonctionnelle,
propre.

## Constat de départ (vérifié dans le code et la base de prod)

- La base de prod ne contient que les données de démo du seed : 5 domaines, 6 thèmes,
  5 livres, 10 leçons, 1 quiz, 5 tests de placement, tous au catalogue commun. Aucune
  session ni tentative de quiz réelle. Tout supprimer ne fait rien perdre.
- Le `.env` local pointe sur la base de **production** : développer dessus casserait le
  site en ligne à chaque changement de schéma.
- L'interface est dupliquée : chaque écran existe en version bureau (`src/app/(app)/…`)
  et en version mobile (`src/components/mobile/screens/…`), ~1 700 lignes en double,
  toutes en styles inline. Tailwind 4 et des composants shadcn sont installés mais
  presque pas utilisés.
- L'import passe par les routes `/api/admin/*` (analyse, domaines, thèmes,
  ingest-pdf) alors qu'il sert aux apprenants ; le navigateur enchaîne 4 types
  d'appels et la génération s'arrête si l'onglet se ferme, sans reprise possible.
- Les tests de placement, les ressources et les mises à jour de connaissances
  n'existent que via le seed.

## Thèse et architecture de l'information

**Thèse :** SkillForge transforme les livres et documents que tu importes en un
parcours quotidien de leçons et de quiz, à ton rythme.

**Vocabulaire fixe** (utilisé partout, de la navigation aux messages) :
- **Livre** : un fichier importé.
- **Thème** : une partie du livre (un ou plusieurs chapitres) détectée par l'IA ;
  validé par un quiz.
- **Leçon** : la séance du jour dans un thème.
- **Catégorie** : étiquette de classement attribuée automatiquement (ex. « Réseau »).

**Hiérarchie des données :** Livre → Thèmes → Leçons + Quiz. La catégorie est une
étiquette par utilisateur, créée automatiquement à l'import, jamais saisie de force.

**Navigation (apprenant) — une page = un travail :**

| Page | Travail de la page | Étape suivante |
| --- | --- | --- |
| Aujourd'hui (`/dashboard`) | Dire quoi faire maintenant : leçon du jour, série, progression. Vide → inviter à importer un premier livre. | Commencer la leçon / Importer |
| Bibliothèque (`/library`) | Lister mes livres et l'état de chacun (en génération, prêt, terminé). | Ouvrir un livre / Importer |
| Livre (`/library/[bookId]`) | Montrer les thèmes du livre, leur progression, et gérer le livre (renommer, supprimer, reprendre une génération). | Démarrer un thème |
| Importer (`/library/import`) | Transformer un fichier en parcours, en étapes : fichier → analyse → validation des thèmes → génération suivie. | Voir le livre |
| Thème (`/learn/[topicSlug]`) | Faire la leçon du jour, puis le quiz de validation. | Leçon suivante / Quiz |
| Révision (`/revision`) | Revoir les leçons déjà faites. | Ouvrir une leçon |
| Statistiques (`/stats`) | Montrer la régularité (30 jours). | — |
| Réglages (`/settings`) | Horaires des séances, notifications, mot de passe. | — |

**Admin (`/admin`) :** Profils (liste, mot de passe à réinitialiser, suppression),
Activité et usage (imports, appels IA). Plus de gestion de contenu : le contenu
appartient à chaque utilisateur.

## Phases

Toutes les phases se font sur la branche `refonte-contenu-utilisateur`, avec une base
Postgres locale (Docker) pour le développement. La prod n'est touchée qu'à la phase 7.

### Phase 0 : Fondations
Vérifié quand : l'appli démarre en local sur la base Docker ; le nouveau shell
(barre latérale bureau, barre d'onglets mobile) s'affiche sur les pages existantes ;
`npm run test`, `npx tsc --noEmit`, `npm run lint` passent.

#### Étape 0.1 : Environnement de dev isolé (S)
- Critères : Postgres local via Docker ; `.env.local` pointe dessus ; la prod n'est plus
  la base par défaut en local ; `README` à jour.
- Vérification : `npx prisma db push` sur la base locale.
- Fichiers : `docker-compose.yml`, `.env.example`, `README.md`.
- Bloquée par : aucune.

#### Étape 0.2 : Tokens de design et composants de base (M)
- Critères : tokens (couleurs, typo, espacements) déclarés en `@theme` Tailwind dans
  `globals.css`, avec l'identité éditoriale actuelle (papier, encre, ember ;
  Newsreader + IBM Plex Mono) ; composants `Button`, `Card`, `Field`, `PageHeader`,
  `EmptyState`, `ProgressBar`, `Badge`, `Dialog`, `Skeleton`.
- Vérification : page interne `/dev/ui` rendue dans l'aperçu, en clair et sur mobile.
- Fichiers : `src/app/globals.css`, `src/components/ui/*`, `src/lib/theme.ts`.
- Compétences : design-guide, frontend.
- Bloquée par : aucune.

#### Étape 0.3 : Shell responsive unique (M)
- Critères : un seul `AppShell` (barre latérale ≥ 768 px, barre d'onglets en dessous) ;
  `MobileShell`, `Sidebar`, `Header` remplacés ; recherche et déconnexion conservées ;
  signature SHJ discrète en pied de barre latérale et sur la page de connexion
  (fichiers du kit copiés dans `public/brand/`).
- Vérification : aperçu à 1280 px et 375 px.
- Fichiers : `src/components/layout/*`, `src/app/(app)/layout.tsx`.
- Bloquée par : 0.2.

### Phase 1 : Modèle de données sans catalogue
Vérifié quand : le schéma est appliqué en local ; plus aucune notion de catalogue
commun ; les tests d'accès passent.

#### Étape 1.1 : Schéma (M)
- Critères :
  - `ownerId` obligatoire sur Livre, Thème, Catégorie (ex-Domaine) et import.
  - `Topic.bookId` relie chaque thème à son livre.
  - Suppression de `PlacementTest`, `PlacementResult`, `Resource`, `KnowledgeUpdate`.
  - Nouveau modèle `ImportJob` qui garde le plan validé (thèmes, plages d'extraits,
    extrait courant) pour pouvoir reprendre.
  - Slugs uniques par utilisateur (`@@unique([ownerId, slug])`) au lieu de globaux.
- Vérification : `npx prisma db push` (local) + `npx tsc --noEmit`.
- Fichiers : `prisma/schema.prisma`, `prisma/seed.ts` (supprimé), `package.json`.
- Compétences : database-optimization.
- Bloquée par : 0.1.

#### Étape 1.2 : Règles d'accès simplifiées (S)
- Critères : `ownership.ts` réduit à « propriétaire ou admin » ; chaque route lit et
  écrit uniquement les données du profil connecté ; tests mis à jour.
- Vérification : `npm run test`.
- Fichiers : `src/lib/ownership.ts`, `src/lib/serverAuth.ts`, tests.
- Bloquée par : 1.1.

### Phase 2 : Import de bout en bout (risque principal, fait en premier)
Vérifié quand : en local, un PDF importé produit un livre, ses thèmes, des leçons et
un quiz par thème ; fermer l'onglet en pleine génération puis revenir permet de
reprendre là où elle s'était arrêtée.

#### Étape 2.1 : API d'import unifiée (M)
- Critères : routes `/api/imports` (créer à partir du fichier téléversé → analyse),
  `/api/imports/[id]/confirm` (crée livre, catégorie, thèmes, quiz),
  `/api/imports/[id]/step` (génère l'extrait suivant, idempotent),
  `GET /api/imports/[id]` (état) ; les anciennes routes `/api/admin/analyze-book`,
  `domains`, `topics`, `ingest-pdf` disparaissent.
- Vérification : tests unitaires des fonctions pures + import réel en local.
- Fichiers : `src/app/api/imports/**`, `src/lib/ingestion.ts`, `src/lib/importJob.ts`.
- Compétences : llm-app-security (prompt injection via le contenu du livre), secure-coding.
- Bloquée par : 1.2.

#### Étape 2.2 : Formats et garde-fous (S)
- Critères : PDF, TXT et Markdown acceptés ; taille max vérifiée côté serveur ;
  quota d'imports par utilisateur et par jour (valeur décidée au gate) ; message clair
  en cas de dépassement.
- Vérification : tests unitaires (quota, détection du format).
- Fichiers : `src/lib/ingestion.ts`, `src/lib/quota.ts`, `src/app/api/admin/blob-upload`.
- Bloquée par : 2.1.

#### Étape 2.3 : Écran Importer (M)
- Critères : parcours en 4 étapes (fichier → analyse → validation des thèmes →
  génération avec barre de progression par thème) ; reprise automatique d'un import
  inachevé ; avertissement si on quitte pendant la génération.
- Vérification : aperçu bureau et mobile, import réel d'un PDF.
- Fichiers : `src/app/(app)/library/import/page.tsx`, `src/components/import/*`.
- Bloquée par : 2.1, 0.3.

### Phase 3 : Bibliothèque et page Livre
Vérifié quand : la bibliothèque liste les livres avec leur état ; la page Livre montre
les thèmes et permet de reprendre, renommer, supprimer.

#### Étape 3.1 : Bibliothèque (S)
- Critères : grille de livres (titre, auteur, catégorie, thèmes, état, progression) ;
  état vide qui mène à l'import.
- Fichiers : `src/app/(app)/library/page.tsx`, `src/app/api/books/route.ts`.
- Bloquée par : 2.3.

#### Étape 3.2 : Page Livre (M)
- Critères : thèmes dans l'ordre avec progression et statut ; actions renommer,
  supprimer (avec confirmation), reprendre la génération ; démarrer un thème.
- Fichiers : `src/app/(app)/library/[bookId]/page.tsx`, `src/app/api/books/[id]/route.ts`.
- Bloquée par : 3.1.

### Phase 4 : Parcours d'apprentissage
Vérifié quand : depuis Aujourd'hui, on fait la leçon du jour, on la valide, on passe
le quiz et le thème se débloque/termine ; la série et les points se mettent à jour.

#### Étape 4.1 : Aujourd'hui (S)
- Critères : leçon du jour du thème actif, série, points, progression des livres ;
  état vide pour un nouvel utilisateur.
- Fichiers : `src/app/(app)/dashboard/page.tsx`, `src/app/api/today/route.ts`.
- Bloquée par : 3.2.

#### Étape 4.2 : Page Thème, leçon et quiz (M)
- Critères : route `/learn/[topicSlug]` ; contenu markdown lisible ; validation de la
  leçon ; quiz final ; règle « un thème actif à la fois » conservée et expliquée.
- Fichiers : `src/app/(app)/learn/**`, `src/components/learn/*`,
  `src/app/api/topics/[slug]`, `src/app/api/sessions/complete`, `src/app/api/quiz/**`.
- Bloquée par : 4.1.

### Phase 5 : Révision, Statistiques, Réglages
Vérifié quand : les trois pages utilisent les nouveaux composants, fonctionnent sur
mobile, et Réglages regroupe horaires, notifications et changement de mot de passe.

#### Étape 5.1 : Révision et Statistiques (S)
- Fichiers : `src/app/(app)/revision/page.tsx`, `src/app/(app)/stats/page.tsx`.
- Compétences : dataviz.
- Bloquée par : 0.3.

#### Étape 5.2 : Réglages (S)
- Critères : horaires + notifications (ex-Horaires) ; changement du mot de passe
  personnel ; `/schedule` redirige vers `/settings`.
- Fichiers : `src/app/(app)/settings/page.tsx`, `src/app/api/profile/**`.
- Bloquée par : 0.3.

### Phase 6 : Admin allégé
Vérifié quand : l'admin montre profils et activité/usage ; plus aucune page de gestion
de contenu.

#### Étape 6.1 : Profils et activité (S)
- Critères : liste des profils (livres, points, dernière activité), réinitialisation du
  mot de passe, suppression d'un profil et de ses données ; activité et nombre
  d'imports/appels IA.
- Fichiers : `src/app/admin/**`, `src/app/api/admin/**`.
- Bloquée par : 1.2.

### Phase 7 : Nettoyage, sécurité, mise en ligne
Vérifié quand : build de prod OK ; revue de sécurité sans faille bloquante ; aperçu
Vercel testé ; fusion dans `main` et prod migrée.

#### Étape 7.1 : Suppression du code mort (S)
- Critères : écrans mobiles dupliqués, pages admin de contenu, anciennes routes,
  seed, composants inutilisés supprimés (preuve d'inutilisation par recherche).
- Vérification : `npm run build`, `npm run lint`.
- Compétences : code-quality.
- Bloquée par : toutes les phases précédentes.

#### Étape 7.2 : Revue de sécurité et de code (S)
- Vérification : `securitymaxxing:diff` sur la branche, puis `/code-review`.
- Bloquée par : 7.1.

#### Étape 7.3 : Mise en ligne (S)
- Critères : aperçu Vercel de la branche testé ; base de prod vidée de la démo et
  schéma appliqué ; fusion dans `main` ; vérification sur le site en ligne.
- Bloquée par : 7.2.

## Journal des décisions

| Décision | Option retenue | Pourquoi |
| --- | --- | --- |
| Base de dev | Postgres local (Docker) | Le `.env` pointe sur la prod ; Docker est déjà installé, aucune action requise côté Neon. |
| Données de démo en prod | Supprimées à la mise en ligne | Aucune donnée réelle (0 session, 0 tentative) ; demandé explicitement. |
| Tests de placement | Supprimés | Ils n'existent que via le seed ; un livre importé n'en a pas. |
| Interface | Un seul composant responsive par écran | Supprime la duplication bureau/mobile qui fait diverger les deux versions. |
| Structure du contenu | Livre → Thèmes → Leçons + quiz ; catégorie automatique | Validé au gate (2026-11-09) : le parcours découle directement du fichier importé. |
| Interface | Garder l'identité éditoriale, l'améliorer, tout reconstruire en composants communs | Validé au gate. |
| Signature SHJ | Symbole « Signal » du kit SHJ, discret : pied de la barre latérale (« Un projet SHJ »), page de connexion, pied de l'admin | Demandé au gate. Couleurs du kit respectées (vert lagune #0B5D57, cuivre réservé à l'onde) ; coupe « petit » sous 32 px ; jamais déformé ni recoloré. Le favicon reste celui de SkillForge. |
| Coût IA | Clé Gemini serveur + quota de 3 livres par jour et par utilisateur + taille max ; clé personnelle optionnelle | Validé au gate. |
| Livraison | Branche `refonte-contenu-utilisateur` + aperçu Vercel, fusion dans `main` à la fin | Validé au gate. |
| Admin | Même coquille que l'app, lien « Administration » pour l'admin | Pas de second thème sombre à maintenir. |
| Recherche | Déplacée dans la page Révision | La barre de recherche d'en-tête disparaît avec l'en-tête. |
| Police du texte | Inter pour le corps, Newsreader pour les titres, Plex Mono pour les étiquettes | Lisibilité du corps de texte. |
| Accès au contenu | Strictement réservé au propriétaire, admin compris (ownership.ts supprimé) | Chacun ne voit que ses livres ; règle unique et simple. |
| Fichier importé | Déposé sous imports/<userId>/ sur Vercel Blob, relu puis supprimé par le serveur | Plus de suppression côté client non authentifiée ; un utilisateur ne peut pas importer le fichier d'un autre. |
| Clé Gemini personnelle | Gardée dans le navigateur, envoyée en en-tête, jamais stockée | Pas de secret utilisateur en base. |
| Surcharge Gemini (503) | Nouvel essai avec pause, puis modèle de secours (gemini-3.5-flash) ; côté navigateur, attente puis reprise ; jamais compté comme un échec | Vu en test : une surcharge passagère faisait sauter des jours. |
| Ordre des réponses du quiz | Mélangé à l'enregistrement | Vu en test : l'IA plaçait la bonne réponse au 2e rang 8 fois sur 12. |
| Adresse d'un thème | Nom du thème seul (suffixe si doublon) | Les adresses « livre + thème » étaient trop longues. |

## Pas encore spécifié

- Phase 7 : brouillard — l'ordre exact de la migration prod dépend de l'état de la
  prod au moment de la fusion.

## Toujours / Jamais

- Toujours : tout le contenu appartient à un utilisateur ; chaque écran fonctionne
  sur mobile et bureau ; erreurs affichées clairement ; tests à jour à chaque phase.
- Jamais : contenu préchargé ; développement contre la base de prod ; changement de
  la coquille Electron ; nouveau fournisseur d'IA (on garde Gemini).

## Avancement

| Phase | Statut |
| --- | --- |
| 0 Fondations | Fait (1d0e0ca) |
| 1 Modèle de données | Fait : schéma appliqué en local, anciennes routes supprimées |
| 2 Import | Fait : pipeline + écran d'import, vérifié sur un vrai PDF (analyse 4 thèmes / 14 jours, génération jour par jour) |
| 3 Bibliothèque | Fait : liste, détail, modification, suppression |
| 4 Apprentissage | Fait : Aujourd'hui, thème, leçons, quiz (échec puis réussite vérifiés) |
| 5 Révision, stats, réglages | Fait : recherche dans les leçons faites, statistiques 30 jours, réglages (profil, rythme, rappels, clé Gemini, mot de passe) |
| 6 Admin | Fait : une page /admin (profils, usage, activité), réinitialisation du mot de passe et suppression d'un profil vérifiées |
| 7 Nettoyage et mise en ligne | À faire |
