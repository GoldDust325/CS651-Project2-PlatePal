// PlatePal Project 2
// Express Backend & API
// Developer: Michelle Golden
// BE-01 - Express Server and Shared Middleware

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const verifyFirebaseToken = require(
    "./middleware/verifyFirebaseToken"
);
const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 5000;
// Media upload size limits
const MAX_IMAGE_SIZE =
    Number(process.env.MAX_IMAGE_SIZE_MB || 10) * 1024 * 1024;

const MAX_AUDIO_SIZE =
    Number(process.env.MAX_AUDIO_SIZE_MB || 20) * 1024 * 1024;

// Supported media types
const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const allowedAudioTypes = [
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "audio/x-wav"
];

// Shared upload configuration
const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: Math.max(MAX_IMAGE_SIZE, MAX_AUDIO_SIZE),
        files: 2,
        fields: 10,
        parts: 12
    },

    fileFilter: (req, file, callback) => {
        const validImage =
            file.fieldname === "photo" &&
            allowedImageTypes.includes(file.mimetype);

        const validAudio =
            file.fieldname === "audio" &&
            allowedAudioTypes.includes(file.mimetype);

        if (validImage || validAudio) {
            return callback(null, true);
        }

        const error = new Error("Unsupported media type");
        error.status = 415;
        callback(error);
    }
});

// Validate individual media upload sizes
function validateMediaSizes(req, res, next) {
    const photo = req.files?.photo?.[0];
    const audio = req.files?.audio?.[0];

    if (
        (photo && photo.size > MAX_IMAGE_SIZE) ||
        (audio && audio.size > MAX_AUDIO_SIZE)
    ) {
        const error = new Error("File too large");
        error.status = 413;
        return next(error);
    }

    next();
}

// Allowed frontend origins
const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:5173"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        const error = new Error("Origin not allowed by CORS");
        error.status = 403;
        callback(error);
    }
}));

// Shared middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "PlatePal Backend",
        timestamp: new Date().toISOString()
    });
});

// Protected API router
const protectedRouter = express.Router();

// BE-03: Firebase ID token verification
protectedRouter.use(verifyFirebaseToken);

// Temporary response for authenticated requests
// Individual routes will be implemented in later issues.
protectedRouter.use((req, res) => {
    res.status(501).json({
        error: {
            code: "NOT_IMPLEMENTED",
            message: "Endpoint is pending implementation"
        }
    });
});

// Protected API endpoints
app.use("/api/analyze", protectedRouter);
app.use("/api/meals", protectedRouter);
app.use("/api/preferences", protectedRouter);

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        error: {
            code: "NOT_FOUND",
            message: "Route not found"
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    const status = err instanceof multer.MulterError
    ? (err.code === "LIMIT_FILE_SIZE" ? 413 : 400)
    : (err.status || 500);


    res.status(status).json({
        error: {
            code: status === 500
                ? "INTERNAL_SERVER_ERROR"
                : "REQUEST_ERROR",
            message: status >= 500
                ? "An unexpected server error occurred"
                : "Request rejected"
        }
    });
});

// Start Express server
app.listen(PORT, () => {
    console.log(`PlatePal backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});