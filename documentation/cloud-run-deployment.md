# PlatePal Project 2 — Cloud Run Deployment and Rollback Guide

**Issue:** CL-02 (#15) — Deploy PlatePal Express/React application to Cloud Run
**Status:** Backend and frontend deployed; application integration tests still pending
**Google Cloud project:** `cs651-platepal-project2`
**Region:** `us-west1` (Oregon)
**Last verified by project team:** November 19, 2026

## 1. Current deployment architecture

Two separate Cloud Run services are deployed:

| Component | Cloud Run service | Source / container | Container port | Runtime service identity |
| --- | --- | --- | --- | --- |
| Express backend | `platepal-backend` | Root `Dockerfile` (Node.js 22) | `8080` | `platepal-backend@cs651-platepal-project2.iam.gserviceaccount.com` |
| React/Vite frontend | `platepal-frontend` | `frontend/Dockerfile` (Vite build, Apache HTTP Server) | `80` | `platepal-frontend@cs651-platepal-project2.iam.gserviceaccount.com` |

**Frontend URL:** https://platepal-frontend-cgbwb6jlea-uw.a.run.app
**Backend URL:** https://platepal-backend-1093919822699.us-west1.run.app
**Backend health check:** https://platepal-backend-1093919822699.us-west1.run.app/api/health

Both services were deployed using HTTPS and `--allow-unauthenticated`. The frontend serves public static assets. The Express backend exposes a public health check, but protected API routes still use Firebase bearer-token verification (`server/middleware/verifyFirebaseToken.js`). Public Cloud Run invoker access does **not** disable Express authorization.

**Verified:** Backend health endpoint returned HTTP 200 and `"status":"ok"`; the frontend homepage loaded in a browser. The complete sign-in, meal analysis, and saved-history workflows are **not yet verified**.

## 2. Prerequisites

- Install and sign in to the Google Cloud CLI; `gcloud auth login`.
- Confirm the selected project: `gcloud config set project cs651-platepal-project2`.
- Confirm billing is enabled. Billing and Artifact Registry/Cloud Build usage can incur charges.
- Enable Cloud Run, Cloud Build, Artifact Registry, and IAM APIs as needed:

```cmd
 gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com
```

- Obtain project permissions to build/deploy and `iam.serviceAccounts.actAs` on the relevant service account.
- Do not download or embed service-account keys in the Docker images. Cloud Run uses service identity / Application Default Credentials.

The backend service identity was given `roles/datastore.user` for Firestore. The frontend service identity should not receive Firestore permissions unless a new explicit server-side requirement calls for them.

## 3. Source upload protections

`gcloud run deploy --source` uploads source files before building. At the repository root, maintain `.gcloudignore` for the backend build:

```text
.git/
**/node_modules/
**/.env
**/.env.*
**/*service-account*.json
**/application_default_credentials.json
server/tests/
frontend/
documentation/
**/*.log
```

Inside `frontend/`, maintain a separate `.gcloudignore`:

```text
.git/
node_modules/
dist/
.env
.env.*
*.log
```

Before deployment, run `gcloud meta list-files-for-upload` **from the appropriate directory** and ensure private credentials, `.env` files and `node_modules` are absent. The backend build must still include the root `Dockerfile`, `server/index.js` and `server/package*.json`. The frontend build must include `frontend/Dockerfile`, package files, HTML files, source and assets.

**Do not commit credentials or local ADC files.** Cloud Run environment settings that are public identifiers (for example Firebase project ID) may be configured as environment variables. Use Secret Manager for actual secrets when those integrations are implemented (CL-04).

## 4. Reproduce the Express backend deployment

From the repository root (Windows Command Prompt):

```cmd
cd /d Z:\project\CS651-Project2-PlatePal
gcloud config set project cs651-platepal-project2
gcloud meta list-files-for-upload
gcloud run deploy platepal-backend --source . --region us-west1 --service-account platepal-backend@cs651-platepal-project2.iam.gserviceaccount.com --set-env-vars FIREBASE_PROJECT_ID=cs651-platepal-project2 --port 8080 --allow-unauthenticated --min-instances 0 --max-instances 1
```

**Caution:** `--set-env-vars` can replace existing environment-variable settings on redeployment. Before redeploying a fully integrated application, inspect current environment variables and preserve its `ALLOWED_ORIGINS`, ADK endpoint, and other required configuration. Secrets must not be typed directly into shell history.

Verify:

```cmd
gcloud run services describe platepal-backend --region us-west1 --format="value(status.url)"
```

Open the service URL followed by `/api/health`. A JSON response containing `"status":"ok"` confirms that the container responds. A 404 at the bare `/` path is expected because Express has no homepage route.

## 5. Reproduce the React frontend deployment

From the `frontend` folder:

```cmd
cd /d Z:\project\CS651-Project2-PlatePal\frontend
npm ci
npm run build
gcloud meta list-files-for-upload
gcloud run deploy platepal-frontend --source . --region us-west1 --port 80 --service-account platepal-frontend@cs651-platepal-project2.iam.gserviceaccount.com --allow-unauthenticated --min-instances 0 --max-instances 1
```

Retrieve URL:

```cmd
gcloud run services describe platepal-frontend --region us-west1 --format="value(status.url)"
```

Open the public website; verify its homepage, navigation, `app.html` and `signin.html`, plus image and stylesheet loading. Because the current frontend is a Vite multi-page build with several HTML entry points, testing page refresh on those actual HTML paths is appropriate; arbitrary client-side SPA path rewrites have **not** been established.

## 6. Frontend ↔ backend integration still required

This is **not yet a fully working ERN application**. Per `frontend/APP_INTEGRATION.md` and `server/index.js`:

- The frontend analysis adapter currently submits `image` / `companion`, while Express expects `photo` and the normalized BE-08 contract uses `companionStyle`.
- The frontend does not yet attach the Firebase ID token for protected API requests.
- The deployed Express analysis, meal history, and preference paths currently return `501 NOT_IMPLEMENTED` after authentication.
- The production frontend build currently has no confirmed live API URL configured.
- Express currently defaults to allowing `http://localhost:5173`; its `ALLOWED_ORIGINS` must include the deployed frontend origin before cross-origin browser API calls are tested.
- Google Photos Picker, full corrections, history, and the Python ADK agent integration still require teammates' work.

Coordinate changes with BE-02 / BE-05, FE-09/FE-10, and AG-02. Do not mark sign-in or real analysis complete based on the homepage alone.

After integration, verify: public homepage and app pages; browser refresh; login; authenticated API calls; correct CORS preflight; save/list/edit/delete meals; ADK analysis and error paths; and the absence of secrets in browser bundles.

## 7. View deployed revisions and roll back

Inspect revisions before changing traffic:

```cmd
gcloud run revisions list --service platepal-backend --region us-west1
gcloud run revisions list --service platepal-frontend --region us-west1
```

If a new revision breaks the app, roll back **one service at a time** to a previously working revision:

```cmd
gcloud run services update-traffic platepal-backend --region us-west1 --to-revisions REVISION_NAME=100
```

For frontend rollback, replace `platepal-backend` with `platepal-frontend`. Replace `REVISION_NAME` with a verified revision name from the corresponding revision list; do not use the literal placeholder. Verify health/page rendering afterward. Traffic can be restored to the latest revision using `--to-latest` after it is fixed.

Reference: https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration

## 8. Production security and operations follow-up (CL-04 / CL-05)

- Apply least-privilege IAM to runtime service accounts and minimize human deployment privileges.
- Keep Firebase/Gemini/Photos credentials out of source and images; store server secrets in Secret Manager.
- Configure OAuth authorized domains/redirect URIs and browser CORS for the **deployed** frontend URL.
- Set project billing budgets and alerts; note that alerts do not automatically stop spend.
- Inspect Cloud Run logs, error rates, traffic and revisions after deployment. Avoid recording tokens or meal media in logs.
- Verify Firebase UIDs with actual sign-ins and enforce user-scoped Firestore access in Express (DB-03).
- Recheck frontend `dist` contents and `.gcloudignore` on each redeploy, especially after API configuration changes.

## 9. Evidence and CL-02 acceptance status

**Confirmed from team deployment output:**

- `platepal-backend`: source image built, revision deployed and routed 100% of traffic; HTTPS `/api/health` returned `"status":"ok"`.
- `platepal-frontend`: source image built, revision deployed and routed 100% of traffic; HTTPS homepage visually loaded.
- Separate dedicated service identities created. Firestore access granted to the backend service identity.

**Not yet confirmed:** complete React-to-Express connection, production CORS, login, live meal analysis, saved meal history via authenticated routes, rollback exercise, and teammate reproducibility test. Keep CL-02 issue #15 open until these are verified.
