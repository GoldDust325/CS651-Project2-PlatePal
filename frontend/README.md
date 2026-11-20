# PlatePal frontend

The Project 2 website uses Vite, React, and Bootstrap. The App and Sign In pages
render through React; Vite also builds the Home, About, and Contact pages.

## Local development

Use Node.js 22.12 or newer. From this directory:

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`. An environment file is not required to review the UI.
To configure an analysis endpoint later, copy `.env.example` to `.env` and follow
[APP_INTEGRATION.md](APP_INTEGRATION.md). Restart Vite after changing environment values.

## Source layout

| Path | Purpose |
| --- | --- |
| `index.html`, `about.html`, `contact.html` | Home, About, and Contact pages |
| `app.html`, `signin.html` | Entry pages for the React interfaces |
| `react/App.jsx`, `react/SignIn.jsx` | App and account page composition and state |
| `react/components/` | Reusable forms, companion slider, photo input, audio recorder, and result UI |
| `react/lib/` | Media validation and the analysis request adapter |
| `css/` | Shared and page-specific styles |
| `images/` | Branding, pixel artwork, and companion images |
| `js/` | Shared behavior for the HTML pages |
| `vite.config.js` | Build entries for all five pages |

The frontend includes the latest wider companion slider, all three pixel robot
designs, photo selection and drag-and-drop, microphone recording, audio uploads,
and playback. Microphone recording requires browser permission and localhost or HTTPS.

Google Photos selection is implemented and needs a public OAuth client ID and
the Express image-import endpoint. Follow [Google Photos setup](../documentation/FE-Google-Photos.md)
to enable it. The Google Photos button shows an availability message until configured.

Sign-in/account forms are currently UI demonstrations. Firebase authentication,
live meal-analysis integration, and meal-history UI are pending; see the
integration notes before testing the full system.

## Production build

```bash
npm run build
npm run preview
```

The generated website is in `dist/`; the preview runs at `http://localhost:4173`.
Dependencies, generated builds, and local environment files are excluded from Git.

The existing Dockerfile builds and serves this frontend independently. From the
repository root:

```bash
docker build -t platepal-frontend ./frontend
docker run --rm -p 8080:80 platepal-frontend
```
