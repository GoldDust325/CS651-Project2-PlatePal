# Google Photos meal import

The App page has two photo actions: **Google Photos** and **Choose File**.
Google Photos asks the user to authorize photo selection, opens Google's hosted
picker, then shows up to 12 selected-photo thumbnails inside Add your meal.
Clicking a thumbnail imports that photo into the existing large meal preview.
Choose File and drag-and-drop continue to accept local JPG, PNG, and WEBP files.

Google's API exposes only items the user picks. It cannot show the user's entire
library in an embedded PlatePal gallery, and its picker cannot run in an iframe.
If the browser blocks the picker window after authorization, use the visible
**Open Google Photos** link in the meal box.

## 1. Configure the team's Google Cloud project

1. Select the shared PlatePal project in [Google Cloud Console](https://console.cloud.google.com/).
2. In APIs & Services, enable **Google Photos Picker API** (not the legacy Library API).
3. Configure Google Auth Platform branding and audience. During development,
   add the Google accounts that will test the flow to the testing audience.
4. In Data Access, add this scope:

   ```text
   https://www.googleapis.com/auth/photospicker.mediaitems.readonly
   ```

5. Create an OAuth client with application type **Web application**. Add both
   `http://localhost` and `http://localhost:5173` to Authorized JavaScript origins.
   Add the deployed frontend's exact HTTPS origin when available. Origins have
   no path, for example `https://platepal.example.com`, not `/app.html`.
6. Copy the public client ID, ending in `.apps.googleusercontent.com`.
   This implementation uses Google's browser token model: no client secret,
   server OAuth callback, or authorized redirect URI is required.

Testing-audience access is a development step. Before public instructor testing,
review Google's OAuth verification requirements and complete any required review.
Register the production origin as well; local authorization does not authorize
a different hostname or port.

## 2. Configure and run locally

In `frontend/`, copy `.env.example` to `.env` and set:

```dotenv
VITE_GOOGLE_PHOTOS_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE_URL=
```

Leave the API base empty for local development. Vite proxies only
`/api/google-photos` to the Express server on port 5001. Restart Vite after
changing `.env`. Do not commit `.env` or put a client secret in a `VITE_` variable.

The local backend uses port 5001 to avoid a conflict with other services on
port 5000. If you already have `server/.env`, set `PORT=5001` there as well.
After starting the backend, `http://localhost:5001/api/health` should return
`"status":"ok"`. Restart both terminals after changing the server or proxy port.

Run Express in one terminal:

```bash
cd server
npm ci
npm start
```

Run Vite in a second terminal, starting from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173/app.html`. Click Google Photos, authorize a test
account, choose photos, press Done, and click a returned thumbnail. Confirm that
the large preview and filename change. Choosing a local file cancels any pending
Google import. Cancel and Start over stop polling and release picker sessions.

## 3. Deployment configuration

Set these **before building** the frontend:

```dotenv
VITE_GOOGLE_PHOTOS_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE_URL=https://YOUR_EXPRESS_SERVICE
```

Deploy the new Express route with the backend. Add the deployed frontend origin
to the backend's `ALLOWED_ORIGINS`. The production frontend does not use Vite's
development proxy. The backend URL must use HTTPS outside localhost.

The existing frontend Docker build accepts public settings as build arguments:

```bash
docker build -t platepal-frontend \
  --build-arg VITE_GOOGLE_PHOTOS_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com \
  --build-arg VITE_API_BASE_URL=https://YOUR_EXPRESS_SERVICE ./frontend
```

If hosting sets Cross-Origin-Opener-Policy, use `same-origin-allow-popups` for
Google's authorization popup. If a Content Security Policy is configured, allow
the Google Identity script/frame/connect origins, `https://photospicker.googleapis.com`
for API requests, the backend origin, and `blob:` image previews. See Google's
setup reference below for current policy details.

## Request flow and responsibilities

| Part | Responsibility |
| --- | --- |
| `frontend/react/lib/googlePhotos.js` | Load Google Identity Services; picker API requests; timing; selected-item pagination; image imports |
| `frontend/react/hooks/useGooglePhotos.js` | Ask for consent on click; create/poll/delete sessions; cancellation; memory-only token lifecycle |
| `frontend/react/components/GooglePhotosGallery.jsx` | Authenticated thumbnail fetches, selection, and object URL cleanup |
| `frontend/react/components/MealPicker.jsx` | Two buttons, selection/waiting states, gallery, and existing preview |
| `server/routes/googlePhotos.js` | `POST /api/google-photos/import`, returning an image or a safe error |
| `server/services/googlePhotos.js` | Reuse BE-04 selected-item authorization, download and image-signature checks; support gallery thumbnails |

The import endpoint receives `{ sessionId, itemId, thumbnail }` and a short-lived
**Google OAuth access token** in the Authorization bearer header. Google checks
that the session and selected item belong to that token. The server resolves the
image URL from Google's response; it never accepts arbitrary image URLs from the
browser, follows download redirects, or returns the token in an error response.
Images are uncropped Google renditions, up to 2048 x 2048 pixels for meal analysis
and 320 x 320 for thumbnails, with MIME and streaming byte limits checked.

Tokens stay in React memory and are cleared when the component unmounts. No
refresh tokens, cookies, database records, or backend process-local sessions are
needed. Expired or revoked access requires reconnecting. Thumbnails and imported
photo blobs are temporary, not saved to Firestore. Session deletion is best
effort; abandoned sessions also expire at Google.

This Google authorization is separate from signing in to PlatePal. It grants
photo import only. Existing meal/history/preferences routes still require
Firebase ID tokens. Do not send a Firebase token to the Google Photos import
endpoint, or a Google Photos token to the Firebase-protected routes.

The imported image is a normal `File` in `App.jsx`, so it reuses the current
validation, preview, removal, and meal submission state. Connecting Firebase
sign-in and aligning the analysis adapter with the shared backend schema remain
separate frontend work described in `frontend/APP_INTEGRATION.md`. Agent analysis
is owned by the backend/ADK team.

## Verification

```bash
cd frontend
npm test
npm run build
```

From `server/`, run `npm test` or `npm run test:google-photos`.
Automated tests use mocked Google responses and do not need credentials. A real
end-to-end authorization and import test requires the configured OAuth client,
a permitted Google account, and both services running.

The frontend owner confirmed Google sign-in, photo selection, gallery thumbnails,
and the enlarged meal preview in local testing on November 20, 2026. The local
package used an OAuth Testing account. The GitHub integration reuses the existing
BE-04 backend service, with automated coverage for both thumbnails and image
imports. Production deployment, non-test-account access, and agent analysis are
separate integration checks.

## Official references

- [Google Identity Services setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
- [Browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Photos Picker flow](https://developers.google.com/photos/picker/guides/get-started-picker)
- [Picking sessions and polling configuration](https://developers.google.com/photos/picker/reference/rest/v1/sessions)
- [Retrieving selected media](https://developers.google.com/photos/picker/guides/media-items)
- [Google Photos authorization and verification](https://developers.google.com/photos/overview/authorization)
