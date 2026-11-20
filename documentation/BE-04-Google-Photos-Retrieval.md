# BE-04: Authorized Google Photos Selected-Image Retrieval

**Project:** PlatePal Project 2
**Developer:** Michelle Golden
**GitHub Issue:** #33
**Branch:** `be-04-google-photos`
**Component:** `server/services/googlePhotos.js`
**Status:** Standalone service implemented and unit-tested. Live integration pending.

## 1. Overview

BE-04 implements a backend service for retrieving images explicitly selected by users through the Google Photos Picker API.

The service is designed to work with the existing PlatePal Express backend and BE-02 Photo and Audio Analysis API.

The implementation uses Google's authorized Picker session results rather than requesting unrestricted access to the user's Google Photos library.

## 2. Implemented Functionality

The service provides the exported function:

`retrieveSelectedGooglePhoto({ sessionId, mediaItemId, accessToken })`

The function performs the following operations:

1. Validates that a Google OAuth access token is supplied.
2. Validates the Picker session ID and requested media item ID.
3. Retrieves selected media metadata from the Google Photos Picker API.
4. Searches paginated results for the requested media item.
5. Confirms the item is a photo in the authorized selection.
6. Validates the declared image MIME type.
7. Validates the media download URL against the service's trusted-host restrictions.
8. Downloads the image using Google OAuth authorization.
9. Enforces the configured image-size limit.
10. Checks the downloaded image's file signature.
11. Returns the image Buffer and associated metadata.

## 3. Returned Data

On successful retrieval, the service returns an object containing:

- `buffer`: Downloaded image bytes as a Node.js Buffer.
- `mimetype`: Validated image MIME type.
- `size`: Downloaded image size in bytes.
- `source`: `google_photos`.

This format is intended to support subsequent integration with the existing BE-02 analysis pipeline.

## 4. Security and Validation

The implementation includes:

- OAuth access-token input validation.
- Selected-item verification using Picker session results.
- Pagination handling and a bounded page-search limit.
- HTTPS and trusted-host restrictions for media downloads.
- Rejection of HTTP redirects.
- JPEG, PNG, and WebP MIME-type validation.
- Download-size enforcement.
- Basic image file-signature validation.
- Rejection of empty image downloads.
- Safe errors for invalid authorization and failed Google requests.

OAuth tokens are not intentionally logged, included in response messages, or persisted by this service.

Firebase authentication and Google Photos OAuth authorization are separate. A Firebase ID token alone does not authorize Google Photos retrieval.

**Security limitation:** File-signature validation does not replace complete image decoding or integrity verification. The current hostname restriction also requires validation against live Google Picker download responses.

## 5. Error Handling

The service handles conditions including:

| Condition | Expected behavior |
|---|---|
| Missing or malformed access token | Authorization error |
| Invalid Picker session ID | Bad request |
| Invalid media item ID | Bad request |
| Item absent from selected-media results | Not found |
| Unsupported media type | Unsupported media |
| Unsupported image format | Unsupported media |
| Invalid Google media response | Upstream service error |
| Expired or rejected Google authorization | Authorization error |
| Failed image download | Upstream service error |
| Oversized image | Payload too large |
| Empty image | Unprocessable content |
| Invalid image signature | Unsupported media |

These are service-level errors. HTTP behavior must also be verified after the service is connected to an Express route.

## 6. Automated Testing

**Test file:** `server/tests/googlePhotos.test.js`

Thirteen automated tests have passed, covering:

1. Missing Google Photos access token.
2. Malformed access token.
3. Missing Picker session ID.
4. Missing selected photo ID.
5. Photo not found in the authorized selection.
6. Pagination and unsupported video rejection.
7. Successful mocked photo download.
8. Expired authorization.
9. Oversized image download.
10. Invalid image file signature.
11. Malformed media-list entries.
12. Failed photo download.
13. Invalid media-list response.

All tests use mocked Google API responses. They do not require actual Google OAuth credentials.

### Full Backend Test Results

| Test category | Passed | Failed |
|---|---:|---:|
| BE-08 schema validation | 16 | 0 |
| Existing backend tests | 60 | 0 |
| BE-04 tests | 13 | 0 |
| **Total** | **89** | **0** |

Run the complete backend test suite from the `server` directory:

`npm.cmd test`

## 7. Integration Dependencies

**Frontend, FE-02 (Victor Ly):**

- Implement Google Photos Picker authorization and selection.
- Obtain a valid Picker session and selected media item identifier.
- Coordinate a secure handoff of required authorization information to the backend.
- Handle cancellation, revoked consent, and expired authorization in the user interface.

**Cloud and configuration:**

- Enable the required Google Photos Picker API.
- Configure appropriate OAuth consent and application access.
- Confirm any external-user verification or testing restrictions.
- Keep credentials and access tokens out of source control and application logs.

**BE-02 analysis integration:**

- Define and implement the authenticated Express API handoff.
- Retrieve the selected image using BE-04.
- Pass the validated image into the existing analysis pipeline.
- Verify response handling and user-visible errors.

## 8. Pending Work and Acceptance Criteria

The following work has not yet been completed:

- [ ] Connect the retrieval service to an authenticated Express endpoint.
- [ ] Coordinate the Picker session and OAuth handoff with FE-02.
- [ ] Confirm live Google Photos media URL formats and permissions.
- [ ] Test expired consent, invalid sessions, and temporary URLs against the real service.
- [ ] Verify the selected photo can be analyzed through the deployed Python ADK service.
- [ ] Test the workflow using a real non-developer Google account.
- [ ] Confirm that the application does not depend on developer-only or test-only accounts.
- [ ] Complete end-to-end frontend, backend, and Google Photos integration testing.

## 9. Implementation Scope

This work implements the BE-04 standalone backend retrieval service, its validation logic, automated tests, and documentation.

It does not implement the frontend Google Photos Picker interface, configure Google Cloud credentials, or demonstrate completed live Google Photos integration.

The GitHub issue should remain open until its acceptance criteria have been verified.

## 10. References

- [Google Photos Picker API Overview](https://developers.google.com/photos/picker/guides/overview)
- [Google Photos Picker API REST Reference](https://developers.google.com/photos/picker/reference/rest)
- [GitHub Issue #33](https://github.com/GoldDust325/CS651-Project2-PlatePal/issues/33)
