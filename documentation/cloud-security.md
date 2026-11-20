# PlatePal Project 2 — Cloud Security and Production Settings

**Issue:** CL-04 (#17) — Configure Cloud IAM, secrets, and production settings
**Project:** `cs651-platepal-project2`
**Region:** `us-west1` (Oregon)
**Status:** Baseline service identity, CORS, and budget configuration established; credentials, OAuth, ADK authorization, and integration tests remain pending.

## 1. Deployed services and security boundaries

| Service | Cloud Run name | Service identity | Access pattern |
| --- | --- | --- | --- |
| React/Vite frontend | `platepal-frontend` | `platepal-frontend@cs651-platepal-project2.iam.gserviceaccount.com` | Public static website; no direct Firestore Admin access |
| Node/Express backend | `platepal-backend` | `platepal-backend@cs651-platepal-project2.iam.gserviceaccount.com` | Public HTTPS entry point, with Firebase ID-token verification on protected API routes |
| Firestore | `(default)` database | Backend identity has `roles/datastore.user` | Server SDK accesses `users/{uid}/meals/{mealId}`; users must be scoped to the verified UID |
| Python ADK | Not deployed yet | To be determined | Prefer private Cloud Run service invoked by authenticated backend |

Frontend: `https://platepal-frontend-cgbwb6jlea-uw.a.run.app`
Backend health endpoint: `https://platepal-backend-1093919822699.us-west1.run.app/api/health`

**Important:** The current React interface does not yet implement live Firebase sign-in, and the backend protected routes still return `501 NOT_IMPLEMENTED` until the API integration is completed. Successfully loading the website or the health endpoint does not prove end-to-end authorization.

## 2. Verified IAM configuration

- Backend Cloud Run revision runs as `platepal-backend@cs651-platepal-project2.iam.gserviceaccount.com`.
- Frontend Cloud Run revision runs as `platepal-frontend@cs651-platepal-project2.iam.gserviceaccount.com`.
- Backend identity has the project-level `roles/datastore.user` role for Firestore reads and writes.
- A project IAM policy query returned no direct project-level roles for the frontend identity. It should not be granted Firestore permissions.
- Use service identity / Application Default Credentials. Do not download a service-account JSON key or put one in an image.

Verify identities:

```sh
gcloud run services describe platepal-backend --region us-west1 --format="value(spec.template.spec.serviceAccountName)"
gcloud run services describe platepal-frontend --region us-west1 --format="value(spec.template.spec.serviceAccountName)"
```

Verify backend Firestore role:

```sh
gcloud projects get-iam-policy cs651-platepal-project2 --flatten="bindings[].members" --filter="bindings.members:platepal-backend@cs651-platepal-project2.iam.gserviceaccount.com" --format="value(bindings.role)"
```

**To verify later:** Check resource-level grants, service-account impersonation permissions, and which identities can deploy or invoke Cloud Run. Apply only roles necessary for each service. The broad project-level Firestore role should be reviewed if access requirements change.

## 3. User authentication and Firestore isolation

1. React will sign in through Firebase Authentication and obtain a Firebase ID token.
2. React sends `Authorization: Bearer <Firebase ID token>` to Express protected routes.
3. `server/middleware/verifyFirebaseToken.js` verifies the token and supplies `req.user.uid`.
4. Express meal routes must call `saveMeal`, `listMeals`, `updateMeal`, and `deleteMeal` using **only** `req.user.uid`, never `req.body.uid`, `req.params.uid`, or `req.query.uid`.
5. Firestore storage paths must remain `users/{verifiedUid}/meals/{mealId}`.
6. Direct browser access to Firestore remains denied with the current production rules (`allow read, write: if false`). **Firebase Admin SDK bypasses Firestore Security Rules**, so Express authorization is essential.

**Pending:** Implement the actual Express meal routes (BE-05) and test users A and B with real Firebase tokens, checking unauthorized read, update, and delete attempts.

## 4. Production CORS configuration

The deployed backend has been configured with:

```text
ALLOWED_ORIGINS=https://platepal-frontend-cgbwb6jlea-uw.a.run.app
```

A request to `/api/health` containing this `Origin` header returned HTTP 200 and `access-control-allow-origin` matching the frontend origin.

Verify:

```sh
curl -i -H "Origin: https://platepal-frontend-cgbwb6jlea-uw.a.run.app" https://platepal-backend-1093919822699.us-west1.run.app/api/health
```

CORS is not authentication. Test unauthenticated protected routes independently. The current CORS allowlist does not include the local Vite development origin; add it carefully when local development must call the deployed backend. Never use an unrestricted wildcard origin for protected operations.

## 5. Secret Manager and future credentials

- `secretmanager.googleapis.com` is enabled.
- At the time of initial setup, `gcloud secrets list` returned zero secrets. This is expected because the team has not supplied final Gemini or Google Photos credentials.
- Keep private values out of Git, React `VITE_` variables, client bundles, static files, logs, Dockerfiles, and deployment documentation.
- Prefer Google-managed identity (ADC) when Gemini is accessed through Vertex AI / supported Google Cloud APIs, rather than creating an unnecessary static API key.
- If the final architecture requires a secret, create a named Secret Manager resource, add a version securely from a local protected source, grant `roles/secretmanager.secretAccessor` only on that secret to the specific backend/agent service account that needs it, and mount or inject it in Cloud Run without pasting the secret into shell history.
- Never attach the Secret Manager accessor role to the static frontend identity.
- For a private ADK Cloud Run service, grant the backend service identity the minimum required `roles/run.invoker` permission on the ADK service and generate a Google-signed ID token for its URL as the audience. This is **not yet implemented** in BE-07.

Secret names and their consumers must be agreed on by the backend and ADK owners before configuration. No real keys or secret values should appear in this document.

## 6. Google Photos OAuth and Firebase domains (pending)

- Confirm which OAuth client type and redirect / origin configuration will be used for Google Photos Picker.
- Register the actual PlatePal frontend domain in the appropriate Google Cloud OAuth configuration and in Firebase Authentication authorized domains when frontend login is enabled.
- Where Google OAuth APIs require authorized JavaScript origins, enter only the exact trusted origin; add redirect URIs only for flows that use redirects.
- Google OAuth client IDs may be public, but **client secrets, access tokens, and refresh tokens must not be shipped to React or stored in Firestore meal metadata**.
- Test Google Photos access with a user outside the developer team as requested in the professor's feedback.

## 7. Billing and logging

- Billing is enabled for `cs651-platepal-project2`.
- Two Cloud Run services are deployed with `--min-instances 0` and `--max-instances 1` as a cost-control starting point. These limits do not guarantee a particular monthly bill.
- Project owner reports creating a **$5 monthly budget** for only this project with actual-spend alerts at 50%, 90%, and 100%. Confirm the saved budget, recipients, and scope in Billing > Budgets & caps.
- **Budget alerts do not stop spending automatically.** Free-trial credit and savings settings can affect when alerts appear.
- Do not log Authorization headers, Google Photos OAuth tokens, API keys, entire meal images/audio, or raw user-provided sensitive data.
- Review Cloud Run logs only for status codes, request IDs, latencies, and safely redacted error details.

## 8. Secure build and source handling

- `.gitignore` excludes local `.env` files; `.env.example` contains placeholders only.
- Root and frontend `.gcloudignore` files exclude local `.env` files, node_modules, and unnecessary files from source deployment.
- Root `.dockerignore` excludes local credentials and build artifacts from backend Docker build context.
- Do not commit credentials or include them in a Vite `VITE_` environment variable; those variables are embedded in the browser bundle.
- Before new commits, review staged filenames (`git diff --cached --name-only`) and check for accidental keys or secret values. Conduct a project-wide secret review before final submission.

## 9. Acceptance evidence and remaining work

| Check | Status / evidence |
| --- | --- |
| Separate frontend/backend runtime service accounts | Verified with `gcloud run services describe` |
| Backend Firestore role | Verified: `roles/datastore.user` |
| Frontend no direct project-level roles returned | Verified by IAM policy query; broader audit pending |
| Production CORS origin | HTTP 200 and matching allow-origin header verified |
| Secret Manager API | Enabled; zero stored secrets at initial setup |
| Budget | Owner confirms created; saved scope/alerts to be independently checked |
| No credentials in any tracked file or frontend bundle | Not yet fully audited |
| Gemini and Photos credentials secure | Pending actual credential design and integration |
| Private ADK service-to-service auth | Pending AG-02 / BE-07 / CL-03 |
| Cross-user API authorization | Pending real Firebase users and BE-05 |
| End-to-end integration test | Pending CL-05 |

Keep CL-04 open until final secrets, permissions, OAuth configuration, security audit, and applicable integration tests are verified.
