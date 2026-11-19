
// PlatePal Project 2
// Developer: Michelle Golden
// BE-03 - Firebase ID Token Verification Middleware

const {
    initializeApp,
    getApps,
    getApp,
    applicationDefault
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

// Initialize Firebase Admin only once
function initializeFirebaseAdmin() {
    if (getApps().length > 0) {
        return getApp();
    }

    if (!process.env.FIREBASE_PROJECT_ID) {
        throw new Error("Firebase project ID is not configured");
    }

    return initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

// Firebase authentication middleware
async function verifyFirebaseToken(req, res, next) {
    const authHeader = req.headers.authorization;

    // Check for a Bearer token
    const match = authHeader?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
        return res.status(401).json({
            error: {
                code: "UNAUTHORIZED",
                message: "A valid Bearer token is required"
            }
        });
    }

    const idToken = match[1];

    try {
        const firebaseApp = initializeFirebaseAdmin();

        // Verify the Firebase ID token
        const decodedToken = await getAuth(firebaseApp)
            .verifyIdToken(idToken);

        // Establish trusted user identity
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email || null,
            emailVerified: decodedToken.email_verified === true
        };

    } catch (error) {
        const authenticationErrors = {
            "auth/id-token-expired": {
                code: "TOKEN_EXPIRED",
                message: "Authentication token has expired"
            },
            "auth/argument-error": {
                code: "INVALID_TOKEN",
                message: "Invalid authentication token"
            },
            "auth/invalid-id-token": {
                code: "INVALID_TOKEN",
                message: "Invalid authentication token"
            }
        };

        const authError = authenticationErrors[error.code];

        if (authError) {
            return res.status(401).json({
                error: authError
            });
        }

        // Do not expose credentials or internal error details
        console.error(
            "Firebase authentication failure:",
            error.code || "CONFIGURATION_ERROR"
        );

        return res.status(503).json({
            error: {
                code: "AUTH_SERVICE_UNAVAILABLE",
                message: "Authentication service is unavailable"
            }
        });
    }

    next();
}

module.exports = verifyFirebaseToken;
