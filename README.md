# CS651-Project2-PlatePal
AI-powered food analysis web application using React, Express, Gemini, and Google Cloud

## Repository layout

| Folder | Contents |
| --- | --- |
| `frontend/` | PlatePal website, React components, styles, artwork, and Vite build configuration |
| `server/` | Express API, Firebase token verification, Firestore services, and the ADK service client |
| `documentation/` | Proposal, backend setup guides, shared analysis contract, and database schema |

Each application keeps its own `package.json`, lockfile, and environment configuration.
If the Python ADK service is added to this repository later, it can have its own
`agents/` directory and Python dependencies.

## Run the frontend

Use Node.js 22.12 or newer. From the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Home, About, Contact, App, and Sign In are included.
See [frontend/README.md](frontend/README.md) for the source layout and production build.

## Run the backend

In a separate terminal, from the repository root:

```bash
cd server
npm ci
cp .env.example .env
npm run dev
```

Configure the backend environment as described in
[the backend setup guide](documentation/BE-01-Backend-Setup.md).
The default health endpoint is `http://localhost:5001/api/health`.

## Frontend integration status

The frontend includes the current page designs, local photo/audio controls, and
Google Photos selection with thumbnails and a meal preview. Email/password
sign-in and account creation now use Firebase Authentication, with session
restoration, sign-out, and authorized backend profile initialization. Follow
[Firebase setup](documentation/FE-Firebase-Authentication.md) to run and test it.
Live analysis contract mapping and meal history still need to be connected.
The current API adapter needs to be aligned with the backend's shared contract; see
[the frontend integration notes](frontend/APP_INTEGRATION.md).
