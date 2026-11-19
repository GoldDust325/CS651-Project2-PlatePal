# PlatePal Project 2 — Firestore Data Access Security


- **Issue:** DB-03 (#13) — Enforce authenticated and user-scoped Firestore access
- **Owner:** Matthew Chou — Cloud & Database
- **Status:** Security design documented; live two-user API verification and production IAM configuration pending
- **Project:** `cs651-platepal-project2`

**Database:** `(default)`, Firestore Native, `us-west1`

## 1. Goal and architecture

PlatePal must prevent one signed-in user from reading, updating, or deleting another user's meal records. The intended data layout from DB-01 is:

```text
users/{firebaseAuthUid}
users/{firebaseAuthUid}/meals/{mealId}
```

The React frontend authenticates with Firebase Authentication, gets a Firebase **ID token**, and sends it to protected Express routes as `Authorization: Bearer <ID_TOKEN>`. BE-03 middleware (`server/middleware/verifyFirebaseToken.js`) verifies the token with Firebase Admin Auth and sets the trusted `req.user.uid`. The Express meal routes (BE-05, pending integration) must call DB-02 storage functions with **that verified UID only**. A UID from JSON, query parameters, or URL paths is never authority to select a user's records.

```text
React + Firebase sign-in
      |
      | Authorization: Bearer Firebase ID token
      v
Express route -> BE-03 verifyFirebaseToken -> req.user.uid
      |
      v
BE-05 meal route -> DB-02 Firestore service
      |
      v
users/{req.user.uid}/meals/{mealId}
```

## 2. Current code and responsibilities

- **BE-03**: `server/middleware/verifyFirebaseToken.js` verifies token signatures/validity via `verifyIdToken`, rejects missing/invalid/expired tokens, and creates the trusted request context.
- **DB-02**: `server/services/firestoreMeals.js` provides `saveMeal(uid, data)`, `listMeals(uid)`, `updateMeal(uid, mealId, data)`, and `deleteMeal(uid, mealId)`. Each operation builds its document path under `users/{uid}/meals`. It validates analysis payloads, requires `reviewed === true` for save/update, handles missing meal IDs, and limits stored source metadata.
- **BE-05 (integration pending)**: The Express route must pass **only `req.user.uid`** into DB-02 methods, after BE-03 authentication. The service's `uid` parameter is not itself an authentication boundary; the caller must be trusted.
- **DB-03**: Document and test the complete user-access boundary, including two-account attacks and Cloud IAM settings.
- **CL-04 (later)**: Configure the deployed service identity and production secrets.

### Required BE-05 integration pattern

The backend developer should wire protected routes using this pattern (illustrative only; not a claim that BE-05 is implemented):

```javascript
// After verifyFirebaseToken has run:
const uid = req.user.uid;   // verified by Firebase Admin
const meals = await listMeals(uid);

// NEVER use any of these as authorization to choose the Firestore path:
// req.body.uid, req.params.uid, req.query.uid
```

The same principle applies to `saveMeal`, `updateMeal`, and `deleteMeal`. When a meal ID does not exist beneath the **authenticated** user's path, return a safe not-found response instead of attempting another user's path. User preferences under `users/{uid}` must follow the same rule.

## 3. Firestore Security Rules and direct client access

**Architecture decision:** For the current PlatePal implementation, **all Firestore reads and writes go through authenticated Express endpoints**. The React frontend should not make direct Firestore document requests. Keep the Firestore production-mode, deny-all client rules in place:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

This ruleset blocks access through the Firebase web/mobile client SDKs. **Firebase Admin SDK/server libraries bypass Firestore Security Rules** and rely instead on Google Cloud IAM. It is therefore essential to verify Firebase ID tokens in Express and use `req.user.uid` for every user-scoped database operation.

If the team later decides to access Firestore directly from React, this architecture decision and rules must be reviewed and changed with additional rules testing. Do **not** loosen rules to `allow read, write: if true` just to make development easier.

## 4. IAM, credentials, and production deployment

- Local testing uses Google Cloud Application Default Credentials for the project `cs651-platepal-project2`; never commit the local ADC JSON, `.env`, Firebase service-account JSON, access tokens, or OAuth secrets.
- Cloud Run should use an explicitly assigned runtime service account, not a downloaded key file. Grant only the database access it needs; `roles/datastore.user` is a common read/write role for the Firestore-backed backend, subject to actual service requirements.
- Give the ADK service only the permissions it needs. The ADK service does not automatically need permission to read all meal records.
- Review Cloud Run invoker permissions separately from Firestore IAM. Firestore IAM authorizes the **backend identity**, but does not enforce which app user may access which meal; that isolation remains the responsibility of authenticated Express routes.
- Use secure configuration/Secret Manager for nonpublic values and redact secrets, token values, and raw media from logs.
- Production service-account creation, grants, and role verification are deferred to CL-04; **not yet verified**.

## 5. Test plan and evidence

The current DB-02 tests verify user-specific document paths with injected/mock database objects, and a local live Firestore script successfully saved, listed, edited, and deleted a temporary test meal using a developer's Admin credentials. BE-03 authentication tests use mocked Firebase token verification. **These are useful component tests but do not prove live cross-user API authorization.**

### Integration tests required when BE-05 and FE-09 are ready

Use two separate Firebase Authentication accounts with distinct real UIDs, **User A** and **User B**, and independent valid ID tokens. Through the Express HTTP endpoints:

| Case | Expected result | Status |
|---|---|---|
| Request `GET /api/meals` without a token | `401`; no data | Pending live API |
| Request with expired/forged token | `401`; no data | Pending live API |
| User A saves reviewed meal | Saved under A's UID | Pending live API |
| User B lists meals | Does not see A's meal | Pending live API |
| User B requests/edits/deletes A's meal ID | Not found/denied; A's record unchanged | Pending live API |
| User B sends `uid: A` in request body or query | Ignored for authorization; remains scoped to B | Pending live API |
| User A edits/deletes own meal | Successful; persisted | Pending live API |
| User A signs out/in again | Own records still available | Pending live API |
| Browser attempts direct Firestore read/write | Denied by rules | Pending explicit rules check |

Record the commands/HTTP status, redacted screenshots, test date, and pass/fail outcomes in the issue or a follow-up documentation update. Do not paste live ID tokens into GitHub.

### Suggested verification of current Firestore rules

In the Firebase Console, open **Firestore Database → Rules** for the `(default)` database. Verify the published rules deny all web/mobile client document reads and writes. Do not replace them unless the team's architecture changes.

## 6. Security checklist and acceptance status

- [x] DB-01 user-scoped schema documented.
- [x] BE-03 token verification middleware implemented (mock-tested).
- [x] DB-02 Firestore operations scoped to the UID argument (unit and local Admin SDK tests passed).
- [x] DB-02 `.env` file excluded from Git using `.gitignore`.
- [ ] Confirm published deny-all Firestore client rules in Firebase Console.
- [ ] Confirm BE-05 routes derive every UID exclusively from verified `req.user.uid`.
- [ ] Perform two-real-user cross-account HTTP tests for list/read/edit/delete and UID manipulation.
- [ ] Record redacted test evidence and remediate failures.
- [ ] Configure and verify Cloud Run service-account least-privilege IAM (CL-04).
- [ ] Verify credentials and secrets are absent from the committed repository and production logs.

**Do not close DB-03 until its cross-user authorization acceptance criteria and production access decisions are verified.**

## 7. Related work

- DB-01 (#11) — `documentation/firestore-schema.md`
- DB-02 (#12) — `server/services/firestoreMeals.js`
- DB-03 (#13) — this document
- BE-03 (#32) — `server/middleware/verifyFirebaseToken.js`
- BE-05 (#34) — Express meal routes (pending)
- FE-09 (#28) — real frontend Firebase sign-in (pending)
- CL-04 (#17) — Cloud IAM/secrets (pending)

## Official references

- Firebase, *Get started with Cloud Firestore Security Rules*: https://firebase.google.com/docs/firestore/security/get-started
- Firebase, *Fix insecure rules*: https://firebase.google.com/docs/firestore/security/insecure-rules
- Firebase, *IAM for Cloud Firestore*: https://firebase.google.com/docs/firestore/security/iam
- Google Cloud, *Firestore roles and permissions*: https://docs.cloud.google.com/iam/docs/roles-permissions/firestore
