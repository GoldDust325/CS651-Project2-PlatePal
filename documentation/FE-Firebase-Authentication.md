# Firebase sign-in and account creation

Implements FE-09 (#28) and FE-10 (#29) using the existing PlatePal form design.

## Included behavior

- Sign in with an email address and password; Firebase manages credentials.
- Register with an email, password, and optional display name. The old demo
  `Login` username field is removed because this provider uses email addresses.
- Restore the session when navigating between `signin.html` and `app.html`.
- Default to the current browser tab's session. Selecting **Keep me signed in on
  this device** uses Firebase's persistent local session instead.
- Sign out from the React navigation. An account switch/sign-out clears the
  current App meal draft and Google Photos selection.
- Show friendly invalid-credential, duplicate-email, password, and network errors.
- Attach a current Firebase ID token to protected Express requests, refresh and
  retry once on 401, and end an invalid session if the retry is still rejected.

The Firebase login and Google Photos authorization remain separate. Firebase ID
tokens go to the protected Express API; Photos requests use their Google token.

## Firebase project setup

Project: `cs651-platepal-project2`. The **PlatePal Web** Firebase web app is
registered, and **Authentication → Sign-in method → Email/Password** is enabled.
The public web app configuration is in `frontend/react/lib/firebase.js` so that
the team can run the project without copying a new configuration file.
`VITE_FIREBASE_CONFIG` can override it with a complete JSON configuration.

No Firebase Admin key, service-account JSON, password, or OAuth secret belongs
in the frontend. Firestore's deny-all client rules remain appropriate: only the
backend accesses the database. No client Firestore SDK is used.

## Local run

Use Node.js 22.12 or newer. In one terminal:

```bash
cd server
npm ci
```

Set these values in an ignored `server/.env`:

```dotenv
PORT=5001
FIREBASE_PROJECT_ID=cs651-platepal-project2
```

The server also needs the team's existing Application Default Credentials to
write Firestore. On a developer machine, configure them if necessary with:

```bash
gcloud auth application-default login
npm start
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173/signin.html`. Vite proxies `/api` to the local backend.
The existing Google Photos client ID can still be set in `frontend/.env.local`.

To use a deployed backend instead, set `VITE_API_BASE_URL` before starting Vite
or building. The backend must include this change's `/api/profile` route and
allow the frontend's origin through `ALLOWED_ORIGINS`. The Docker build accepts
`VITE_API_BASE_URL` and the optional `VITE_FIREBASE_CONFIG` as build arguments.
Cloud Run's backend service identity needs Firestore access; it should not use
a downloaded service-account key.

## Profile initialization

After successful login/registration, and on restoring a session on the sign-in
page, React calls **POST `/api/profile`** through `authenticatedFetch`.
The only allowed body field is an optional `displayName` string (up to 100
characters). BE-03 verifies the ID token before the route runs.

The route derives the document ID and email from `req.user`, then creates
`users/{verifiedUid}` in a transaction if it is absent:

| Field | Initial value |
| --- | --- |
| `displayName` | Trimmed optional name, or an empty string |
| `email` | Email from the verified Firebase token |
| `companionStyle` | `casual` |
| `createdAt`, `updatedAt` | Firestore server timestamps |

An existing profile is preserved, including preferences and creation time.
Responses are `201` for a new profile and `200` for an existing profile, with
`{ "profileReady": true }`. Missing auth returns `401`; unexpected body fields
(including UID, email, and password) or malformed names return `400`.

If Firebase sign-in succeeds while the backend is unavailable, the page says
that the account is signed in and offers **Retry profile setup**. It does not
claim that a profile was saved. No duplicate Firebase account is created on retry.

## Verification

Run `npm test` in both `frontend/` and `server/`, and `npm run build` in
`frontend/`. Auth request tests cover restored sessions, ID headers, one-time
refresh, failed refresh, account switching, and network failures. Profile API
tests cover missing auth, verified identities, defaults, idempotence, input
rejection, and isolation between users. These tests use controlled dependencies.

An additional integration test uses the real Firebase client/Admin SDKs with
only the local Auth emulator and the `demo-platepal` project:

```bash
cd frontend
npm exec --yes --package=firebase-tools -- firebase emulators:exec --project demo-platepal --only auth --config tests/firebase-emulator.json 'node tests/firebase-auth.emulator.mjs'
```

It tests registration, display name, wrong-password rejection, later sign-in,
duplicate/weak-password rejection, distinct UIDs, the frontend bearer adapter
with the backend's real BE-03 verifier, and sign-out. It does not create users in
the shared Firebase project or prove production Firestore connectivity.

For the live browser check, create your own account using the form, continue to
the App, reload, sign out, try an incorrect password, then sign in correctly.
Verify that the account appears in Firebase Authentication and that Firestore
contains `users/{actualUid}`. Repeat sign-in and verify the profile creation time
and preferences are preserved. Test a second browser session separately.

## Remaining team integration

This change adds Firebase authorization to the analysis adapter, but leaves
the current analysis endpoint configuration, provisional upload/response field
mapping, ADK analysis, meal history, and review/correction controls to their
existing tasks. See `frontend/APP_INTEGRATION.md` for the remaining contract work.
The published Cloud Run services need the new source deployed before they
serve this interface and profile endpoint.

Official references:
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
