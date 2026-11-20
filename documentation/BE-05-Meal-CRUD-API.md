
# BE-05: Meal CRUD API

**Project:** PlatePal Project 2  
**Developer:** Michelle Golden  
**Component:** Express Backend & API  
**Related Issue:** #34  
**Implementation PR:** #49  
**Status:** Implementation complete; live integration testing pending

## 1. Overview

BE-05 implements authenticated Express API endpoints for saving,
retrieving, updating, and deleting meal records.

The API integrates with the DB-02 Firestore meal storage service
and uses the BE-03 Firebase authentication middleware.

Meal records are stored under the authenticated user's Firebase UID.

## 2. Files

| File | Purpose |
|---|---|
| `server/routes/meals.js` | Implements Meal CRUD endpoints |
| `server/index.js` | Registers routes and handles API errors |
| `server/services/firestoreMeals.js` | Existing DB-02 storage service |
| `server/tests/meals.test.js` | Automated endpoint tests |
| `server/package.json` | Test command and dependencies |

## 3. API Endpoints

### POST /api/meals

Saves a reviewed meal analysis.

Requires a valid Firebase Bearer token.

Request body:

```json
{
  "analysis": {
    "reviewed": true
  },
  "sourceMetadata": {}
}
```

The example illustrates the request structure only. A real
request must include a complete BE-08-compliant analysis object.

The Firestore service rejects unreviewed analyses and unresolved
image/audio conflicts.

**Success:** HTTP 201 with the generated meal ID.

### GET /api/meals

Returns meal history for the authenticated user.

**Success:** HTTP 200 with a `meals` array.

Records are retrieved from the current user's Firestore collection
and ordered by their saved timestamp.

### PATCH /api/meals/:id

Updates a previously saved meal.

The request must include a valid reviewed analysis. The existing
Firestore service validates the meal ID and updated analysis.

**Success:** HTTP 200 with the updated meal ID.

**Missing record:** HTTP 404.

### DELETE /api/meals/:id

Deletes an existing meal belonging to the authenticated user.

**Success:** HTTP 200 with the meal ID and `deleted: true`.

**Missing record:** HTTP 404.

## 4. Authentication and Security

All Meal CRUD routes use `verifyFirebaseToken`.

The middleware validates the Firebase ID token and supplies the
trusted user identity through `req.user.uid`.

The API does not use a UID supplied in the request body to select
the user's Firestore collection.

The DB-02 service stores records under:

`users/{uid}/meals/{mealId}`

This structure scopes meal operations to the authenticated user.

The service also excludes raw image/audio data and authorization
tokens from stored source metadata.

## 5. Validation and Error Handling

The existing Firestore service validates analysis data against
the BE-08 JSON schema.

It requires users to review results before saving and rejects
unresolved image/audio conflicts.

The Express error handler preserves recognized client error codes
while avoiding exposure of unexpected internal server errors.

Examples:

| Error code | HTTP status |
|---|---|
| `REVIEW_REQUIRED` | 400 |
| `INVALID_ANALYSIS` | 400 |
| `UNRESOLVED_CONFLICT` | 400 |
| `INVALID_ID` | 400 |
| `MEAL_NOT_FOUND` | 404 |

Missing or invalid Firebase authentication is rejected by the
authentication middleware.

## 6. Automated Testing

Supertest is used for Express endpoint testing.

The BE-05 route tests use mocked Firebase authentication and
mocked Firestore operations. They do not modify the live database.

Test coverage includes:

1. Rejecting unauthenticated meal requests.
2. Returning empty meal history.
3. Saving reviewed meals.
4. Rejecting unreviewed analyses.
5. Restricting meal history to the current user.
6. Updating an owned meal.
7. Rejecting another user's update request.
8. Rejecting another user's delete request.
9. Deleting an owned meal.
10. Returning 404 for missing meals.

### Test Results

| Test suite | Passed |
|---|---|
| BE-08 JSON contract | 16/16 |
| BE-03 authentication | 9/9 |
| DB-02 Firestore service | 8/8 |
| BE-07 ADK client | 7/7 |
| BE-05 Meal CRUD routes | 10/10 |
| **Total** | **50/50** |

Run all backend tests from the `server` directory:

```powershell
npm.cmd test
```

Run BE-05 tests individually:

```powershell
node --test tests/meals.test.js
```

## 7. Local Verification

The Express server started successfully on port 5000.

The `/api/health` endpoint returned a successful JSON response.

A request to `/api/meals` without a Firebase Bearer token
was rejected with `UNAUTHORIZED`.

These checks verify local startup and unauthenticated access
handling, not live authenticated CRUD functionality.

## 8. Pending Integration Testing

The following acceptance checks remain pending:

- Test real Firebase ID tokens with Express.
- Verify saving and retrieving meals through live Firestore.
- Confirm edited meal details survive reload.
- Test cross-user record access with two real accounts.
- Verify that unsaved analyses are not persisted by the frontend.
- Complete end-to-end React and Express integration.
- Test invalid IDs and authorization against live services.

## 9. Conclusion

BE-05 provides the authenticated Meal CRUD API implementation
and automated route-level tests.

All 50 backend automated tests passed during development.

Live Firebase, Firestore, and frontend integration testing
remains necessary before all acceptance criteria can be
considered complete.
