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

The current adapter's provisional fields differ from the group backend contract:

| Data | Current frontend adapter | Group backend contract |
| --- | --- | --- |
| Photo upload field | `image` | `photo` in the existing Multer configuration |
| Companion selection | `companion` with `Casual`, `Strict`, or `Athlete` | `companionStyle` with `casual`, `strict`, or `athlete` in the shared normalized request |
| Meal nutrients | `totals.calories`, `protein`, `carbs`, `fat`, optional `fiber` | `estimatedMacros.calories`, `proteinGrams`, `carbohydrateGrams`, `fatGrams` |
| Food portion | `portion` text | `quantity` object |
| Food calories | `calories` | `estimatedMacros.calories` on each food |
| Advice | `recommendations` array | `recommendation` string |

Align the multipart field names with the implemented Express analysis route.
Express owns conversion from uploaded files to the normalized
Base64 request sent to ADK. Map the shared response into the result component's
view model, or update that component to consume the shared response directly.
Do not change the shared backend schema just to fit the provisional UI adapter.

The shared version 1.0.0 request requires a photo; the UI currently also allows
voice-only input. Agree on whether audio-only analysis will be supported before
connecting that flow. The frontend's audio size limit is 10 MB; the backend's
configured maximum is 20 MB. The frontend can remain more restrictive.

The `/api/analyze` route verifies a Firebase token and calls the team's ADK
service. Meal CRUD and preference routes are implemented in Express but are
not connected to this frontend yet. Live analysis also needs a configured ADK
service and the upload/response field mapping described above.

Meal history and food/portion correction controls still need frontend
implementation and integration.

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
| `react/components/AudioRecorder.jsx` | Real microphone recordings and uploaded audio |
| `react/App.jsx` | Shared meal inputs, companion selection, and request lifecycle |
