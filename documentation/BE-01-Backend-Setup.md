# PlatePal Project 2: Express Backend Setup

**Developer:** Michelle Golden  
**Role:** Express Backend & API Developer  
**Issue:** #30 (BE-01)  
**Date:** November 18, 2026  
**Branch:** backend-development

## 1. Overview

The Express backend provides the foundation for PlatePal Project 2. It establishes API routing, shared middleware, environment configuration, request validation, security controls, and structured error handling.

## 2. Technologies

- Node.js v24.21.0
- Express.js
- CORS
- dotenv
- Multer
- Git and GitHub

## 3. Backend Features

- Express server configuration
- Configurable CORS allowlist
- Environment variable management
- JSON and URL-encoded request limits
- Shared media upload middleware
- Individual media size validation
- Structured error responses
- Health check endpoint
- Protected route placeholders
- Disabled X-Powered-By response header
- Git exclusion of private environment files

## 4. Local Setup

Navigate to the server directory:

`cd server`

Install dependencies:

`npm install`

Create a `.env` file using `.env.example` as a template.

Start the development server:

`npm run dev`

For Windows PowerShell environments that restrict npm scripts, use `npm.cmd` instead of `npm`.

## 5. Environment Variables

| Variable | Default |
|---|---|
| PORT | 5000 |
| NODE_ENV | development |
| ALLOWED_ORIGINS | http://localhost:5173 |
| MAX_IMAGE_SIZE_MB | 10 |
| MAX_AUDIO_SIZE_MB | 20 |

Private environment files must not be committed to GitHub.

## 6. API Endpoints

| Method | Endpoint | Current Behavior |
|---|---|---|
| GET | /api/health | Public health check |
| POST | /api/analyze | Protected placeholder |
| GET | /api/meals | Protected placeholder |
| PATCH | /api/preferences | Protected placeholder |

Protected endpoints temporarily deny access until Firebase authentication is implemented.

## 7. Local Testing Results

| Test | HTTP Status | Result |
|---|---|---|
| Health endpoint | 200 | PASS |
| Nonexistent route | 404 | PASS |
| Allowed CORS origin | 200 | PASS |
| Unauthorized CORS origin | 403 | PASS |
| Protected analysis endpoint | 401 | PASS |
| Protected meal endpoint | 401 | PASS |
| Protected preferences endpoint | 401 | PASS |
| CORS preflight request | 204 | PASS |
| Malformed JSON | 400 | PASS |
| Oversized JSON | 413 | PASS |
| Server stability | 200 | PASS |
| Accepted image MIME type | 200 | PASS |
| Unsupported media type | 415 | PASS |
| Oversized image | 413 | PASS |
| Temporary endpoint removal | 404 | PASS |
| Final server health check | 200 | PASS |

**Total tests:** 16  
**Passed:** 16  
**Failed:** 0  
**Pass rate:** 100%

## 8. Security Configuration

- JSON request limit: 1 MB
- Image upload limit: 10 MB
- Audio upload limit: 20 MB
- Maximum upload count: two files
- Restricted declared media types
- Configurable CORS origins
- Structured error responses
- Default denial of access to protected endpoints
- Private environment file exclusion

## 9. Pending Integration

- Firebase ID token verification (BE-03)
- Analysis endpoint implementation (BE-02)
- Attachment of shared upload middleware to the analysis endpoint
- Audio upload testing and media content validation
- React development connectivity
- Deployed frontend connectivity

Image upload restrictions were tested using synthetic files through a temporary local endpoint. The temporary endpoint and generated test file were removed after testing.

## 10. Conclusion

The initial Express backend foundation has been implemented and locally tested. All 16 executed tests passed successfully. The backend is ready for subsequent component development and integration. Final acceptance remains pending frontend connectivity testing.