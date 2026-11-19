# PlatePal Project 2: Firebase ID Token Verification

**Developer:** Michelle Golden  
**Role:** Express Backend & API Developer  
**Issue:** #32 (BE-03)  
**Date:** November 18, 2026  
**Branch:** be-03-firebase-auth

## 1. Overview

The Firebase authentication middleware protects PlatePal's user-specific API endpoints through server-side Firebase ID token verification.

The middleware establishes a trusted user identity and prevents unauthenticated requests from accessing protected functionality.

## 2. Technologies

- Node.js
- Express.js
- Firebase Admin SDK
- Application Default Credentials (ADC)
- Node.js built-in testing framework
- PowerShell and curl
- Git and GitHub

## 3. Component Files

| File | Purpose |
|---|---|
| server/middleware/verifyFirebaseToken.js | Firebase authentication middleware |
| server/index.js | Express middleware integration |
| server/.env.example | Firebase environment configuration template |
| server/tests/auth.test.js | Automated authentication tests |
| server/package.json | Dependencies and testing commands |
| server/package-lock.json | Dependency version management |

## 4. Authentication Workflow

1. The user authenticates through Firebase Authentication.
2. Firebase issues an ID token.
3. React sends the ID token in the Authorization header.
4. Express extracts the Bearer token.
5. Firebase Admin verifies the token.
6. Verified user identity is assigned to req.user.
7. The authenticated request proceeds to the protected route.

Requests with missing, invalid, or expired tokens are rejected. Authentication service failures deny access.

## 5. Trusted User Context

The middleware establishes the following trusted request properties:

- req.user.uid
- req.user.email
- req.user.emailVerified

The verified Firebase UID must be used for user-specific database operations.

UID values supplied through the request body, URL parameters, or query string must not be trusted as authentication credentials.

## 6. Environment Configuration

The backend requires the following environment variable:

`FIREBASE_PROJECT_ID=`

The shared PlatePal Firebase project ID must be supplied before live authentication testing.

Firebase Admin uses Application Default Credentials rather than hardcoded service account credentials.

Private credentials and local environment files must never be committed to GitHub.

## 7. Protected API Endpoints

| Endpoint | Authentication |
|---|---|
| /api/health | Public |
| /api/analyze | Required |
| /api/meals | Required |
| /api/preferences | Required |

Protected endpoints currently return a 501 Not Implemented response after successful authentication until their individual route implementations are completed.

## 8. Authentication Error Handling

| HTTP Status | Error Code |
|---|---|
| 401 | UNAUTHORIZED |
| 401 | INVALID_TOKEN |
| 401 | TOKEN_EXPIRED |
| 503 | AUTH_SERVICE_UNAVAILABLE |

Authentication errors follow the shared structured API error format. Internal error details and credentials are not exposed to clients.

## 9. Manual API Testing

| Test Case | HTTP Status | Result |
|---|---|---|
| Public health endpoint | 200 | PASS |
| Missing authentication token | 401 | PASS |
| Incorrect authentication scheme | 401 | PASS |
| Firebase configuration unavailable | 503 | PASS |
| Empty Bearer token | 401 | PASS |
| Unauthorized analysis request | 401 | PASS |
| Unauthorized preferences request | 401 | PASS |
| Unauthenticated UID bypass attempt | 401 | PASS |

**Total:** 8  
**Passed:** 8  
**Failed:** 0

## 10. Automated Authentication Testing

| Test Case | Result |
|---|---|
| Missing authorization header | PASS |
| Incorrect authentication scheme | PASS |
| Empty Bearer token | PASS |
| Simulated valid Firebase token | PASS |
| Simulated invalid Firebase token | PASS |
| Simulated expired Firebase token | PASS |
| Simulated Firebase service failure | PASS |
| Trusted user identity extraction | PASS |
| Caller-provided UID manipulation | PASS |

**Total:** 9  
**Passed:** 9  
**Failed:** 0

Automated authentication tests use mocked Firebase verification responses. No authentication bypass is included in the application middleware.

## 11. Regression Testing

| Test Suite | Passed | Failed |
|---|---|---|
| BE-08 JSON contract | 16 | 0 |
| BE-03 authentication | 9 | 0 |
| Total | 25 | 0 |

All executed automated regression tests passed successfully.

## 12. Testing Commands

From the server directory:

Run authentication tests:

`npm run test:auth`

Run JSON contract tests:

`npm run test:contract`

Run all automated tests:

`npm test`

Windows PowerShell users may substitute npm.cmd for npm.

## 13. Security Considerations

- Server-side Firebase ID token verification
- Trusted UID extraction
- Default denial of unauthorized requests
- Structured authentication errors
- Protection of private credentials
- Rejection of caller-provided identity as authentication
- Secure handling of authentication service failures

## 14. Pending Integration

- Shared Firebase project configuration
- Real Firebase ID token verification
- Live invalid, forged, and expired token testing
- Frontend Firebase Authentication integration
- User-scoped Firestore authorization
- Cross-user record access testing
- Evaluation of token revocation checking

Related issues include DB-03 (#13) and FE-09 (#28).

## 15. Conclusion

The Firebase authentication middleware has been implemented and integrated into the Express backend.

All eight manual API tests and nine automated authentication tests passed. Regression testing also passed all 25 automated cases.

Final acceptance remains pending live Firebase authentication and cross-component authorization testing.