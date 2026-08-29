This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Desktop shell (real OS notifications)

The app can also run inside a thin Electron shell so session reminders fire as real desktop notifications instead of browser notifications. It's a dev-mode wrapper only — no installer/packaging is set up.

```bash
npm run dev        # terminal 1 — start the Next.js server
npm run electron    # terminal 2 — open it in a desktop window
```

`electron/main.js` loads `http://localhost:3000` (retrying until the dev server is up). The main process itself polls `/api/profile` every 20s and fires native OS notifications when a session slot is due (`electron/scheduler.js` holds the pure scheduling logic) — this keeps working even while the window is minimized, since closing the window hides it to the system tray instead of quitting the app (use the tray menu, or Cmd/Ctrl+Q equivalent via the tray's "Quitter", to actually exit). The renderer's own reminder polling (`src/hooks/useNotificationScheduler.ts`) skips itself when running inside Electron to avoid firing the same reminder twice. `electron/preload.js` still exposes `window.electronAPI.sendNotification` for the header's manual "test notification" button; the app falls back to the browser Notification API when not running in Electron.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
