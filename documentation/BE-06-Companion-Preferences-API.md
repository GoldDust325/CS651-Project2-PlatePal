# BE-06: Companion Preferences API

**Project:** PlatePal Project 2

**Developer:** Michelle Golden

**Component:** Express Backend & API

**Related Issue:** #35

**Branch:** `be-06-preferences`

**Status:** Implemented; live integration testing pending

## 1. Overview

BE-06 implements an authenticated Express endpoint that allows
PlatePal users to update their preferred AI companion style.

The supported styles are Casual, Strict, and Athlete.

The preference is stored in the user's Firestore profile so that
it can be retrieved across application sessions.

## 2. Files

| File | Purpose |
|---|---|
| `server/routes/preferences.js` | Companion preference API |
| `server/index.js` | Route registration and authentication |
| `server/tests/preferences.test.js` | Automated API tests |
| `server/package.json` | Backend test configuration |
| `documentation/firestore-schema.md` | Existing user profile schema |

## 3. API Endpoint

### PATCH /api/preferences

Updates the authenticated user's companion style.

**Authentication:** Firebase ID token required.

Request header:

`Authorization: Bearer <Firebase_ID_Token>`

Example JSON request:

    {
      "companionStyle": "athlete"
    }

Successful response (HTTP 200):

    {
      "companionStyle": "athlete"
    }

Supported values:

- `casual`: Friendly and conversational recommendations.
- `strict`: Direct and structured recommendations.
- `athlete`: Fitness-oriented recommendations.

Only these three lowercase values are accepted.

## 4. Firebase Authentication

The endpoint uses the existing BE-03
`verifyFirebaseToken` middleware.

The middleware verifies the Firebase ID token and provides
the trusted identity through `req.user.uid`.

The endpoint never selects a Firestore user document using
a UID supplied in the request body.

Missing or invalid authentication is rejected before the
preference update is processed.

## 5. Firestore Integration

User profiles follow the existing DB-01 schema:

`users/{uid}`

The API updates these fields:

- `companionStyle`
- `updatedAt`

The `updatedAt` value uses a Firestore server timestamp.

The existing profile must already exist. If it does not,
the endpoint returns HTTP 404 rather than creating an
incomplete user profile.

Other fields, including `displayName`, `email`, and
`createdAt`, are preserved.

Profile creation is handled separately through the
Firebase registration integration.

## 6. Validation and Error Handling

| Condition | HTTP status | Error code |
|---|---|---|
| Successful update | 200 | None |
| Invalid or missing style | 400 | `INVALID_COMPANION_STYLE` |
| Missing user profile | 404 | `PROFILE_NOT_FOUND` |
| Missing authentication | 401 | `UNAUTHORIZED` |
| Unexpected server error | 500 | `INTERNAL_SERVER_ERROR` |

Authentication errors may have additional codes as defined
by the BE-03 middleware.

Unexpected internal error details are not exposed to the
frontend.

## 7. Automated Testing

BE-06 uses Supertest and Node.js's built-in test runner.

The tests use mocked Firebase authentication and an
in-memory Firestore implementation.

They do not modify the live Firebase database.

### BE-06 Test Coverage

1. Reject unauthenticated preference requests.
2. Accept Casual style.
3. Accept Strict style.
4. Accept Athlete style.
5. Reject unsupported companion styles.
6. Reject missing companion styles.
7. Reject updates to missing user profiles.
8. Preserve existing user profile fields.
9. Prevent changes to another user's profile.
10. Verify preference persistence within the mocked database.

### Test Results

| Test suite | Passed |
|---|---|
| BE-08 JSON contract | 16/16 |
| BE-03 Firebase authentication | 9/9 |
| DB-02 Firestore meals | 8/8 |
| BE-07 ADK client | 7/7 |
| BE-05 Meal CRUD API | 10/10 |
| BE-06 Companion Preferences API | 10/10 |
| **Total** | **60/60** |

Run all backend tests from the `server` directory:

    npm.cmd test

Run only BE-06 tests:

    node --test tests/preferences.test.js

## 8. Companion Recommendation Behavior

The saved companion style is intended to control the tone
and presentation of the AI companion's recommendations.

It must not change the underlying food identification or
estimated nutritional values.

The BE-06 endpoint stores the preference but does not
directly generate meal recommendations.

Passing the saved preference to the analysis/ADK workflow
requires integration with the relevant backend and
frontend components.

## 9. Pending Integration Testing

The following checks remain pending:

- Test authenticated requests with real Firebase ID tokens.
- Verify preference updates in the live Firestore database.
- Confirm the preference survives sign-out and sign-in.
- Test user isolation with two real Firebase accounts.
- Verify frontend preference selection and API integration.
- Confirm the saved style affects recommendation tone.
- Confirm companion style does not alter estimated macros.

## 10. Conclusion

BE-06 provides the authenticated Companion Preferences API
and automated route-level testing.

All 60 backend automated tests passed during development.

Live Firebase persistence, frontend integration, and
companion recommendation behavior must still be verified
before all acceptance criteria can be considered complete.
