# PlatePal Project 2 — Firestore Schema and User Profiles

**Issue:** DB-01 (#11) — Configure Firestore schema and user profiles  
**Component owner:** Matthew Chou — Cloud & Database  
**Status:** Database created; schema documented; live authentication/persistence integration pending  
**Firebase project ID:** `cs651-platepal-project2`  
**Firestore database:** `(default)` — Standard edition, Firestore Native, `us-west1`  

## 1. Purpose

PlatePal uses Cloud Firestore to save user profiles and **user-reviewed** meal analysis results. Each person's meals are stored under their Firebase Authentication UID so that meal history can be retrieved without mixing data between users. The Node/Express backend will use the Firebase Admin SDK for database access.

This document describes the intended Firestore structure. The shared analysis data contract remains `server/schemas/analysis.schema.json` (BE-08), version `1.0.0`. Firestore-specific metadata wraps that analysis rather than changing the shared contract.

## 2. Collection and document paths

```text
users/                            (collection)
  {uid}/                          (document; ID = verified Firebase Auth UID)
    displayName
    email
    companionStyle
    createdAt
    updatedAt
    meals/                        (subcollection)
      {mealId}/                   (document; generated unique ID)
        analysis                   (BE-08 analysisResponse object)
        sourceMetadata             (source information, not raw media)
        savedAt
        updatedAt
    goals/                        (subcollection; added for the ADK Planner)
      current/                    (single document)
        fitnessGoal                (lose_weight, maintain, build_muscle, improve_performance, eat_healthier)
        dailyTargets               (calories, proteinGrams, carbohydrateGrams, fatGrams, fiberGrams)
        weeklyGoals                (up to 3 strings)
        source                     (planner or user)
        updatedAt
```

`goals/current` is written only through `PUT /api/goals` (`server/services/firestoreGoals.js`) for the verified UID, after the user saves a meal. See `documentation/AG-ADK-Multi-Agent-Coach.md`.

**Important:** `meals` is a subcollection under `users/{uid}`, **not** a separate top-level collection. `test-user-001` and `test-meal-001` in the Firebase Console are temporary demonstration IDs. Actual profile document IDs must match the authenticated user's Firebase UID.

## 3. User profile fields — `users/{uid}`

| Field | Firestore type | Description |
|---|---|---|
| `displayName` | string | Optional friendly name; use a safe default if missing |
| `email` | string | Email provided by Firebase Authentication, when available |
| `companionStyle` | string | One of `casual`, `strict`, or `athlete` |
| `createdAt` | timestamp | Profile creation time |
| `updatedAt` | timestamp | Last profile/preference update |

The document ID is the UID; a duplicate `uid` field is not required. Firebase Authentication manages passwords and sign-in credentials. **Never store passwords in Firestore.** Profile fields must be created/updated only for the authenticated user, ideally through authorized Express endpoints. The frontend/authentication teammate (FE-09/FE-10) will coordinate profile creation and sign-in.

## 4. Meal record fields — `users/{uid}/meals/{mealId}`

| Field | Firestore type | Description |
|---|---|---|
| `analysis` | map | The complete validated BE-08 `analysisResponse` object after review |
| `sourceMetadata` | map | Non-sensitive photo/audio source information |
| `savedAt` | timestamp | When the user explicitly pressed **Save Results** |
| `updatedAt` | timestamp | Last saved edit |

### `analysis` follows the shared BE-08 response contract

The `analysis` map preserves these required fields: `schemaVersion`, `analysisId`, `createdAt`, `foods`, `imageEvidence`, `audioAssertions`, `conflicts`, `uncertainties`, `estimatedMacros`, `macroStatus`, `recommendation`, `companionStyle`, `reviewed`, `corrected`, and `corrections`.

- `foods[]`: each item has `foodId`, `name`, `quantity` (`amount`, `unit`), `estimatedMacros`, and `corrected`.
- `estimatedMacros`: `calories`, `proteinGrams`, `carbohydrateGrams`, `fatGrams` (nonnegative estimates).
- `conflicts[]`: image/audio disagreements, including `resolved`, and `resolution` when resolved.
- `corrections[]`: original and corrected food names/quantities.
- `macroStatus`: `estimated` or `pending_recalculation`.
- `reviewed` should be `true` before saving; **analysis results are not saved automatically**.

The BE-08 `analysis.createdAt` field is an ISO 8601 date-time string. Firestore `savedAt`, `updatedAt`, and profile timestamps are native Firestore timestamps; these are deliberately different fields/types.

### `sourceMetadata` (Firestore-only, proposed)

| Field | Type | Example |
|---|---|---|
| `photoSource` | string | `local` or `google_photos` |
| `photoMimeType` | string | `image/jpeg` |
| `hasAudio` | boolean | `false` |
| `audioMimeType` | string or null | `null` |
| `audioDurationSeconds` | number or null | `null` |

This metadata is **not** part of the BE-08 `analysisResponse` JSON schema. The backend must derive it from the incoming request, not trust arbitrary user-supplied database records. Do not store photo/audio Base64 strings, OAuth tokens, or credentials in Firestore just to implement meal history. Coordinate with BE-05/BE-08 before finalizing the persistence format.

## 5. Example reviewed meal (illustrative)

**Path:** `users/{actualFirebaseUid}/meals/test-meal-001`  
**Note:** `{actualFirebaseUid}` is a placeholder. The analysis values below are adapted from the valid BE-08 fixture with `reviewed` changed to `true` to illustrate a saveable result.

```json
{
  "analysis": {
    "schemaVersion": "1.0.0",
    "analysisId": "analysis-001",
    "createdAt": "2026-11-18T20:00:00Z",
    "foods": [
      {
        "foodId": "food-001",
        "name": "Grilled chicken",
        "quantity": { "amount": 150, "unit": "g" },
        "estimatedMacros": {
          "calories": 248,
          "proteinGrams": 46,
          "carbohydrateGrams": 0,
          "fatGrams": 5
        },
        "corrected": false
      }
    ],
    "imageEvidence": ["Image appears to contain grilled chicken."],
    "audioAssertions": [],
    "conflicts": [],
    "uncertainties": ["Portion size is estimated from the image."],
    "estimatedMacros": {
      "calories": 248,
      "proteinGrams": 46,
      "carbohydrateGrams": 0,
      "fatGrams": 5
    },
    "macroStatus": "estimated",
    "recommendation": "Consider adding vegetables for a balanced meal.",
    "companionStyle": "casual",
    "reviewed": true,
    "corrected": false,
    "corrections": []
  },
  "sourceMetadata": {
    "photoSource": "local",
    "photoMimeType": "image/jpeg",
    "hasAudio": false,
    "audioMimeType": null,
    "audioDurationSeconds": null
  }
}
```

`savedAt` and `updatedAt` are **Firestore timestamp fields**, created by the backend when writing the document; they are omitted from the JSON example above to avoid pretending that a JSON string is a Firestore timestamp.

## 6. Queries and indexes

Planned queries are scoped to the current user:

- List saved meals: read `users/{verifiedUid}/meals`, optionally ordered by `savedAt` descending.
- Retrieve one meal: read `users/{verifiedUid}/meals/{mealId}`.
- Retrieve preferences: read `users/{verifiedUid}`.

Use Firestore's default indexes initially. Only add custom/composite indexes if an implemented query actually requires one. No custom indexes have been documented as necessary yet.

## 7. Authentication and security

1. React obtains a Firebase Authentication ID token after sign-in.
2. Express BE-03 middleware verifies that token and sets `req.user.uid`.
3. The meal service (DB-02) builds Firestore paths using **only** the verified UID; never use a UID provided in a request body, query, or path to access another user's records.
4. The Express Cloud Run service uses a designated service account with only the permissions it needs.
5. Firestore production-mode client rules currently deny direct client read/write. **Admin SDK calls bypass Firestore Security Rules**, so backend authorization and IAM are required. If the architecture later includes direct React-to-Firestore access, design and test rules separately before allowing it.
6. Test with two distinct real Firebase accounts: User A must not list, read, update, or delete User B's meals.

Do not commit `.env`, secret keys, OAuth tokens, or service-account JSON to GitHub.

## 8. Setup completed and remaining integration

**Completed in Firebase Console (November 19, 2026):**
- Created Firebase project `cs651-platepal-project2`.
- Created the `(default)` Firestore Native database in `us-west1` in production mode.
- Created a temporary `users/test-user-001` profile with `displayName`, `email`, `companionStyle`, and `createdAt`.
- Created a nested `users/test-user-001/meals/test-meal-001` sample with a few representative fields.

**Still pending:**
- Have the team review this proposed schema and finalize any storage-specific metadata.
- Configure real Firebase Authentication and create profiles using actual UIDs.
- Implement the DB-02 service and BE-05 routes; test explicit save, list, update, and delete.
- Test persistence after page reload and test cross-user isolation (DB-03).
- Replace/delete temporary test records after live integration.

## 9. Related project files/issues

- BE-08: `server/schemas/analysis.schema.json` and `server/tests/analysis.fixtures.json`
- BE-03: `server/middleware/verifyFirebaseToken.js`
- DB-02: `server/services/firestoreMeals.js` (planned)
- BE-05: `server/routes/meals.js` (planned)
- FE-09/FE-10: Firebase Authentication sign-in and registration integration

---

**DB-01 acceptance note:** This document supplies a schema and full example reviewed analysis record. Actual authenticated UID enforcement and application-level save/history functionality are not yet verified and should not be marked complete until DB-02/DB-03 and backend/frontend integration tests succeed.
