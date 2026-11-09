# SkillForge

Chacun importe ses propres livres (PDF, TXT, Markdown) ; l'IA en tire un parcours
**Livre → Thèmes → Leçons** classé dans une catégorie automatique. On apprend un thème
à la fois, jour après jour (cours le matin, pratique le soir), et un quiz valide le thème.

Next.js 16, React 19, Prisma / PostgreSQL, Tailwind v4, Google Gemini, Vercel Blob.

## Démarrage en local

```bash
npm install
cp .env.example .env        # puis renseignez au moins DATABASE_URL, DIRECT_URL et GEMINI_API_KEY
docker compose up -d        # base PostgreSQL locale (port 55432), jamais la prod
npm run db:push             # crée les tables
npm run dev
```

Pour la base locale : `DATABASE_URL` et `DIRECT_URL` valent
`postgresql://skillforge:skillforge@127.0.0.1:55432/skillforge`.

Il n'y a aucun contenu préchargé : ouvrez [http://localhost:3000](http://localhost:3000)
et importez un premier livre depuis la Bibliothèque.

## Comment marche un import

1. Le fichier (40 Mo max) est envoyé sur Vercel Blob dans le dossier de l'utilisateur
   (ou directement au serveur en local sans Blob), puis le texte est extrait et découpé.
2. L'IA analyse le livre : titre, auteur, catégorie, thèmes et plan jour par jour.
   L'utilisateur relit et corrige avant de lancer la génération.
3. Le navigateur fait avancer la génération extrait par extrait (`/api/imports/[id]/step`).
   Chaque étape est rejouable ; une surcharge passagère de l'IA ne compte pas comme un échec,
   et un extrait qui échoue trois fois est ignoré. L'import peut être arrêté et repris.

Quota : 3 imports par jour et par utilisateur sur la clé du serveur (`IMPORT_DAILY_LIMIT`).
L'administrateur et toute personne qui saisit sa propre clé Gemini (Réglages) ne sont pas limités ;
cette clé reste dans le navigateur.

> La clé Gemini du serveur doit être sur un projet Google **avec facturation activée** :
> l'offre gratuite plafonne à environ 20 requêtes par jour, alors qu'un livre en demande
> une par jour de parcours (plus l'analyse).

## Tests et vérifications

```bash
npm run test     # vitest
npm run lint
npx tsc --noEmit
npm run build
```

## Déploiement (Vercel)

1. Variables d'environnement du projet : `DATABASE_URL`, `DIRECT_URL` (base de production),
   `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN` (créé avec un store Blob dans l'onglet Storage),
   `APP_PASSWORD`, `ADMIN_PASSWORD`, `AUTH_SECRET`.
2. Le build lance `prisma generate` (script `postinstall`). Il ne crée pas les tables :
   appliquez le schéma avec `npm run db:push` en visant la base de production.

## Accès et profils

- `APP_PASSWORD` sert de code d'invitation : un testeur entre son prénom et ce code, puis
  choisit un mot de passe personnel qui protège son espace.
- `ADMIN_PASSWORD` réserve `/admin` au propriétaire : profils, usage de l'IA, activité,
  réinitialisation d'un mot de passe, suppression d'un profil.
- Sans `APP_PASSWORD` (développement local), l'application est ouverte.
- Chaque livre, thème et leçon n'est visible que par son propriétaire.

## Application de bureau (facultatif)

`npm run electron` ouvre l'application dans une fenêtre Electron, pour des rappels de séance
en notifications système (le serveur `npm run dev` doit tourner). C'est un outil de
développement, sans installateur.

## Structure

- `src/app/(app)` : Aujourd'hui, Bibliothèque (livres, import), thème et leçons, Révision,
  Statistiques, Réglages.
- `src/app/admin` : console d'administration.
- `src/app/api` : routes JSON, toutes vérifiées côté serveur (propriétaire, rôle).
- `src/lib/import` : extraction de texte, prompts, appels Gemini, file de génération, quota.
- `src/lib` : logique métier (bibliothèque, apprentissage, statistiques, admin).
- `src/components` : écrans par domaine et kit d'interface (`components/ui`).
- `prisma/schema.prisma` : modèle de données.
