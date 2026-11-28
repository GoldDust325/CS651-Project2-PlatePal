# Frontend integration handoff

This frontend preserves the current PlatePal design and local media controls.
The existing Express implementation and its shared schema are the references
for the next integration work:

- [Backend setup](../documentation/BE-01-Backend-Setup.md)
- [Firebase authentication](../documentation/BE-03-Firebase-Authentication.md)
- [Shared JSON contract](../documentation/BE-08-Shared-JSON-Contract.md)
- [Analysis schema](../server/schemas/analysis.schema.json)

## Current frontend behavior

- Companion slider: Casual, Strict, and Athlete, with pixel robot artwork.
- Meal History button beneath the companion selector opens a styled placeholder
  dialog. The close button, Back to meal button, and Escape return to the App.
  This is a frontend entry point only; it does not fetch, save, or delete meals.
- Photos: choose, drop, replace, and remove JPG, PNG, or WEBP files up to 10 MB.
- Google Photos: authorize, select in Google's picker, display selected thumbnails,
  and import a photo into the existing preview. Requires OAuth configuration and
  the Express import route; see [Google Photos setup](../documentation/FE-Google-Photos.md).
- Audio: record up to 60 seconds, upload a file up to 10 MB, play it back, or remove it.
- The UI accepts a photo, an audio file, or both.
- Changing inputs cancels an in-flight analysis and clears its previous result.
- Temporary object URLs and microphone tracks are released when no longer needed.
- With no analysis URL configured, the UI shows an availability message and sends no request.

## Connections still required

The account forms now use Firebase email/password Authentication. The shared
`authenticatedFetch` adapter supplies the signed-in user's Firebase ID token,
refreshes/retries once on 401, and ends a rejected session. The current analysis
adapter uses that helper. Account profiles initialize through authenticated
`POST /api/profile`; see [Firebase setup](../documentation/FE-Firebase-Authentication.md).

The frontend and the Express analysis route use the same field names.
`react/lib/mealAnalysisContract.js` builds the multipart request and maps the
shared BE-08 response into the result component's view model:

| Data | Frontend sends / displays | Express route / BE-08 contract |
| --- | --- | --- |
| Photo upload field | `photo` | `photo` (Multer field) |
| Photo source | `photoSource`: `local` or `google_photos` | `photoSource` → `photo.source` |
| Companion selection | UI `Casual`/`Strict`/`Athlete`, sent lowercased as `companionStyle` | `companionStyle`: `casual`, `strict`, or `athlete` |
| Audio | `audio` plus `audioDurationSeconds` (0–60) | `audio` → `audio.durationSeconds` |
| Meal nutrients | view model `totals.calories`, `protein`, `carbs`, `fat` | `estimatedMacros.calories`, `proteinGrams`, `carbohydrateGrams`, `fatGrams` |
| Food portion | view model `portion` text, e.g. `150 g` | `quantity` object (`amount`, `unit`) |
| Food calories | view model `calories` | `estimatedMacros.calories` on each food |
| Advice | view model `recommendations` (one-item array) | `recommendation` string |

Express owns conversion from uploaded files to the normalized Base64 request sent
to ADK. Do not change the shared backend schema to fit the UI; change the mapping
in `mealAnalysisContract.js` instead. The result component's optional Fiber row
is never shown because the contract has no fiber value.

`server/tests/frontendContract.integration.test.mjs` sends requests built by the
frontend through the real Express route (with mocked auth and ADK) and maps the
response back, so a field-name drift on either side fails `npm test` in `server/`.

The shared version 1.0.0 request requires a photo; the UI currently also allows
voice-only input. Agree on whether audio-only analysis will be supported before
connecting that flow. The frontend's audio size limit is 10 MB; the backend's
configured maximum is 20 MB. The frontend can remain more restrictive.

The `/api/analyze` route verifies a Firebase token and calls the team's ADK
service. Meal CRUD and preference routes are implemented in Express but are
not connected to this frontend yet. Live analysis also needs a configured ADK
service and the upload/response field mapping described above.

`react/components/MealHistory.jsx` contains the Meal History button and placeholder
view for the team to connect later. Replace its coming-soon content with the real
history states and use `authenticatedFetch` with `GET /api/meals` when implementing
the data integration. Do not treat the placeholder as an empty saved-meal response.
History retrieval, meal details, and edit/delete controls remain pending, along
with food/portion correction controls.

## Local configuration

To review the interface, run `npm ci` and `npm run dev` inside `frontend/`.
No backend credentials are needed for the UI review.

When the authentication and contract work is complete, copy `.env.example` to
`.env`, set `VITE_MEAL_ANALYSIS_URL=http://localhost:5001/api/analyze`, and restart
Vite. For production, set the public API URL before `npm run build`.
`VITE_` variables are included in the browser build; Gemini credentials belong
in the backend configuration.

The backend already allows `http://localhost:5173` by default. Add the deployed
frontend origin to `ALLOWED_ORIGINS` when connecting the deployed applications.

## Frontend files to connect

| File | Responsibility |
| --- | --- |
| `react/SignIn.jsx` and account form components | Firebase sign-in/account creation state |
| `react/lib/mealAnalysis.js` | Authentication header, upload fields, and response validation/mapping |
| `react/components/MealResults.jsx` | Display the shared analysis response and review/correction states |
| `react/components/MealHistory.jsx` | Frontend history button/dialog; saved-meal data integration pending |
| `react/components/AudioRecorder.jsx` | Real microphone recordings and uploaded audio |
| `react/App.jsx` | Shared meal inputs, companion selection, and request lifecycle |
