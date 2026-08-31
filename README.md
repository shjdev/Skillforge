# SkillForge

Application d'apprentissage quotidien structuré — leçons, quiz de validation, révision espacée et suivi de progression — construite avec Next.js 16, Prisma/PostgreSQL (Neon) et Zustand. L'interface s'adapte automatiquement (responsive) entre une mise en page desktop et une mise en page mobile dédiée selon la largeur d'écran.

## Démarrage

Nécessite une base [Neon](https://neon.tech) (gratuite) — créez un projet, récupérez les deux chaînes de connexion depuis Dashboard > Connect (l'une avec `-pooler` dans l'hôte pour `DATABASE_URL`, l'autre sans pour `DIRECT_URL`).

```bash
npm install
cp .env.example .env      # requis — DATABASE_URL et DIRECT_URL (Neon)
npm run db:push           # crée les tables sur la base Neon
npm run db:seed           # données de démonstration (domaines, thèmes, leçons)
npm run dev
```

En développement local, le plus simple est de créer une [branche Neon](https://neon.tech/docs/introduction/branching) dédiée (isolée de la production) plutôt qu'une base séparée.

Ouvrez [http://localhost:3000](http://localhost:3000). Réduisez la fenêtre du navigateur (ou ouvrez depuis un téléphone) pour voir la mise en page mobile — le contenu bascule en direct selon la largeur d'écran, sans redirection ni bouton.

L'espace admin est accessible depuis la barre latérale (« ATELIER → ADMIN ») ou directement sur `/admin/dashboard`.

## Tests

```bash
npm run test         # suite complète (vitest)
npm run test:watch   # mode watch
```

## Desktop shell (notifications OS réelles)

L'app peut aussi tourner dans une coquille Electron légère pour que les rappels de session déclenchent de vraies notifications de bureau au lieu des notifications navigateur. C'est un wrapper de dev uniquement — aucun packaging/installateur n'est configuré.

```bash
npm run dev        # terminal 1 — serveur Next.js
npm run electron    # terminal 2 — fenêtre desktop
```

`electron/main.js` charge `http://localhost:3000` (réessaie tant que le serveur de dev n'est pas prêt). Le processus principal interroge lui-même `/api/profile` toutes les 20s et déclenche des notifications OS natives quand un créneau de session est dû (`electron/scheduler.js` contient la logique pure de planification) — ça continue de fonctionner même fenêtre minimisée, puisque fermer la fenêtre la range dans la barre système au lieu de quitter l'app (utilisez le menu de la barre système, « Quitter », pour réellement fermer). Le polling côté renderer (`src/hooks/useNotificationScheduler.ts`) se désactive lui-même dans Electron pour éviter un rappel en double. `electron/preload.js` expose toujours `window.electronAPI.sendNotification` pour le bouton de test manuel de l'en-tête ; l'app se rabat sur l'API Notification du navigateur hors Electron.

## Génération de contenu par IA (optionnel)

Renseignez `GEMINI_API_KEY` dans `.env` (ou saisissez une clé directement dans l'écran d'import) pour activer l'analyse automatique de livres PDF : détection du titre/auteur/domaine, découpage en thèmes pédagogiques progressifs, puis génération des leçons et questions de quiz. Sans clé, l'import PDF ajoute seulement la référence du livre en base, sans génération.

## Déploiement public — protection par mot de passe

SkillForge n'a **aucun système de comptes** (profil unique, `DEFAULT_USER_ID` codé en dur). Avant de déployer sur une URL accessible publiquement, définissez `APP_PASSWORD` (et idéalement `AUTH_SECRET`, voir `.env.example`) : un écran `/login` protège alors toute l'app, y compris chaque route API — sans ça, n'importe qui trouvant l'URL peut utiliser le panneau admin (import PDF, consommant votre quota `GEMINI_API_KEY`) et modifier/supprimer tout le contenu. En local sans `APP_PASSWORD`, l'app reste ouverte sans friction.

## Structure

- `src/app/(app)` — espace apprenant (tableau de bord, atelier, bibliothèque, horaires, statistiques, révision)
- `src/app/admin` — console d'administration (import de contenu, gestion des cours/quiz/utilisateurs)
- `src/components/mobile` — écrans et coquille de la mise en page mobile, montés directement dans les mêmes routes que la version desktop via `useIsMobile()`
- `src/lib/ingestion.ts` — extraction PDF et découpage de texte, partagés entre l'analyse et la génération
- `prisma/schema.prisma` — modèle de données PostgreSQL (domaines, thèmes, leçons, quiz, progression, notifications…)
