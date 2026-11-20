# BE-02: Photo and Audio Analysis API

**Project:** PlatePal Project 2

**Developer:** Michelle Golden

**GitHub Issue:** #32

**Feature Branch:** `be-02-analysis`

**Status:** Implementation and automated tests complete; live integration pending

## Overview

BE-02 implements the authenticated Express endpoint for analyzing meal photos and optional audio recordings.

The endpoint receives multipart uploads, validates incoming media and companion preferences, converts accepted files into the BE-08 JSON format, and forwards the request through the existing BE-07 ADK client.

Results are returned to the frontend without automatically saving them to Firestore.

## API Endpoint

`POST /api/analyze`

### Authentication

Requires a valid Firebase ID token:

`Authorization: Bearer <firebase-id-token>`

Authentication is enforced using the shared BE-03 middleware.

### Request Format

Content-Type: `multipart/form-data`

| Field | Required | Description |
|---|---|---|
| photo | Yes | JPEG, PNG, or WebP meal image |
| audio | No | Optional supported audio recording |
| companionStyle | Yes | casual, strict, or athlete |
| audioDurationSeconds | When audio is included | Duration greater than 0 and at most 60 seconds |
| photoSource | No | local or google_photos; defaults to local |

### Media Validation

- Rejects missing or empty photos.
- Rejects empty audio recordings.
- Allows one photo and at most one audio file.
- Rejects unsupported MIME types.
- Enforces the configured per-file upload size limits.
- Validates companion style.
- Validates audio duration.

Default size limits:

- Photo: 10 MB
- Audio: 20 MB

These limits can be configured using `MAX_IMAGE_SIZE_MB` and `MAX_AUDIO_SIZE_MB`.

## ADK Integration

The endpoint calls `analyzeMeal()` from `server/services/adkClient.js`.

Accepted media is converted into the BE-08 request structure:

```json
{
  "schemaVersion": "1.0.0",
  "photo": {
    "source": "local",
    "mimeType": "image/jpeg",
    "data": "BASE64_IMAGE"
  },
  "audio": {
    "mimeType": "audio/webm",
    "data": "BASE64_AUDIO",
    "durationSeconds": 12
  },
  "companionStyle": "casual"
}
```

The `audio` property is omitted for photo-only submissions.

The BE-07 client validates ADK responses against the BE-08 response schema.

## Analysis Response

On success, the endpoint returns the ADK analysis response with HTTP 200.

The BE-08 response includes identified foods, nutritional estimates, image and audio evidence, conflicts, uncertainties, recommendation text, companion style, and review/correction metadata.

The analysis endpoint does not automatically save results to Firestore. Saving reviewed meals is handled separately by BE-05.

## Error Handling

| HTTP Status | Meaning |
|---|---|
| 400 | Invalid request, duplicate uploads, missing or empty media, invalid companion style or audio duration |
| 401 | Missing or invalid authentication |
| 413 | Upload exceeds configured size limit |
| 415 | Unsupported media type |
| 502 | ADK service failure or invalid ADK response |
| 503 | ADK service unavailable or not configured |
| 504 | ADK request timeout |

Server-side failures return safe generic messages.

## Automated Testing

Test file: `server/tests/analyze.test.js`

The endpoint currently has 16 passing automated tests covering:

- Authentication rejection
- Missing photo
- Photo-only analysis
- Photo and audio analysis
- Invalid companion style
- Invalid audio duration
- Missing audio duration
- Unsupported photo type
- Duplicate photo upload
- Oversized photo
- Empty photo
- Empty audio recording
- Simulated ADK service error
- Simulated ADK timeout
- Add Google Photos source accepted and Invalid photo source rejected to the test coverage list.

Full test results:

- BE-02 endpoint tests: 16 passed
- Node backend tests: 60 passed
- BE-08 JSON schema tests: 16 passed
- Total: 76 passed, 0 failed

Automated endpoint tests use mocked authentication and ADK responses.

## Pending Integration and Verification

1. Test with real Firebase ID tokens and actual uploaded media.
2. Verify photo-only and photo-plus-audio analysis against the deployed Python ADK service.
3. Confirm Cloud Run connectivity and service authentication where required.
4. Align frontend upload fields:
   - Frontend currently sends `image`; backend expects `photo`.
   - Frontend currently sends `companion`; backend expects `companionStyle`.
   - Frontend must supply `audioDurationSeconds` with audio.
5. Align frontend response handling with BE-08:
   - BE-08 uses `recommendation` as a string.
   - Existing frontend validation expects `recommendations` as an array.
6. Ensure frontend requests include Firebase Bearer tokens.
7. Align supported audio formats and upload size restrictions.
8. Verify real ADK error handling and malformed responses end to end.

## Related Components

- BE-01: Express server and shared middleware
- BE-03: Firebase Authentication
- BE-05: Meal CRUD and explicit saving
- BE-07: Express-to-ADK client
- BE-08: Shared JSON analysis contract

## Conclusion

BE-02's Express implementation and mocked automated tests are complete. Live integration, frontend alignment, and acceptance testing remain pending.
