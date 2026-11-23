# Try Firebase sign-in

This update includes the working Google Photos integration and Firebase
email/password sign-in. Use this extracted project folder for the test.
Stop any older PlatePal development servers first so they do not occupy ports
5001 or 5173.

1. In a terminal opened inside this folder, start the backend:

   ```bash
   cd server
   npm ci
   npm start
   ```

2. In another terminal opened inside this folder, start the frontend:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

3. Open `http://localhost:5173/signin.html`. Select **Create Account** and enter
   your email and a new PlatePal password. The Firebase project invitation
   gives you project access; it does not create a PlatePal login account.

4. Continue to the App, reload, sign out, and sign in again using that email
   and PlatePal password. You can also test an incorrect password.

The download includes only the public frontend configuration and backend
project/port settings. Firebase Authentication manages the account credentials.

If the page says that you are signed in but the meal profile could not be set
up, the account is still created. The backend needs your existing Google Cloud
Application Default Credentials to write Firestore. If they are not set up,
stop the backend, run the following in `server/`, restart it, and select
**Retry profile setup**:

```bash
gcloud auth application-default login
npm start
```

Use the Google account that has access to `cs651-platepal-project2`. The profile
will be created as `users/{yourFirebaseUid}`. See
[the Firebase integration guide](documentation/FE-Firebase-Authentication.md)
for details and automated test commands.

Live Cloud Run deployment and ADK/analysis contract integration are separate
team tasks. This download is for the local sign-in/sign-up test.
