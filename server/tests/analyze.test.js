/*
 * PlatePal Project 2
 * BE-02: Photo and Audio Analysis API Tests
 * Developer: Michelle Golden
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const authPath = require.resolve("../middleware/verifyFirebaseToken");
const adkPath = require.resolve("../services/adkClient");

let capturedRequest;
let capturedOptions;
let simulatedError;

// Mock authentication before importing Express.
require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (req, res, next) => {
        if (req.headers.authorization !== "Bearer test-user") {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "Authentication required"
                }
            });
        }

        req.user = { uid: "test-user" };
        next();
    }
};

// Mock Matthew's ADK client. No external service is called.
require.cache[adkPath] = {
    id: adkPath,
    filename: adkPath,
    loaded: true,
    exports: {
        async analyzeMeal(data, options) {
            capturedRequest = data;
            capturedOptions = options;

            if (simulatedError) {
                throw simulatedError;
            }

            return {
                schemaVersion: "1.0.0",
                analysisId: "test-analysis",
                createdAt: "2026-11-19T12:00:00.000Z",
                foods: [],
                imageEvidence: [],
                audioAssertions: [],
                conflicts: [],
                uncertainties: [],
                estimatedMacros: {
                    calories: 0,
                    proteinGrams: 0,
                    carbohydrateGrams: 0,
                    fatGrams: 0
                },
                macroStatus: "estimated",
                recommendation: "Test recommendation",
                companionStyle: data.companionStyle,
                reviewed: false,
                corrected: false,
                corrections: []
            };
        }
    }
};

const app = require("../index");

function photoRequest() {
    return request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "casual")
        .attach("photo", Buffer.from("fake-image"), {
            filename: "meal.jpg",
            contentType: "image/jpeg"
        });
}

test("POST /api/analyze rejects unauthenticated requests", async () => {
    const response = await request(app)
        .post("/api/analyze")
        .field("companionStyle", "casual")
        .attach("photo", Buffer.from("fake-image"), "meal.jpg");

    assert.equal(response.status, 401);
});

test("POST /api/analyze requires a photo", async () => {
    const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "casual");

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "PHOTO_REQUIRED");
});

test("POST /api/analyze accepts a photo-only request", async () => {
    const response = await photoRequest();

    assert.equal(response.status, 200);
    assert.equal(response.body.companionStyle, "casual");
    assert.equal(capturedRequest.schemaVersion, "1.0.0");
    assert.equal(capturedRequest.photo.mimeType, "image/jpeg");
    assert.equal(capturedRequest.photo.source, "local");
    assert.equal(
        capturedRequest.photo.data,
        Buffer.from("fake-image").toString("base64")
    );
    assert.equal(capturedRequest.audio, undefined);
});

test("POST /api/analyze accepts Google Photos as a source", async () => {
    const response = await photoRequest()
        .field("photoSource", "google_photos");

    assert.equal(response.status, 200);
    assert.equal(capturedRequest.photo.source, "google_photos");
});

test("POST /api/analyze rejects invalid photo sources", async () => {
    const response = await photoRequest()
        .field("photoSource", "unknown");

    assert.equal(response.status, 400);
    assert.equal(
        response.body.error.code,
        "INVALID_PHOTO_SOURCE"
    );
});

test("POST /api/analyze accepts photo and audio", async () => {
    const response = await photoRequest()
        .field("audioDurationSeconds", "12")
        .attach("audio", Buffer.from("fake-audio"), {
            filename: "note.webm",
            contentType: "audio/webm"
        });

    assert.equal(response.status, 200);
    assert.equal(capturedRequest.audio.mimeType, "audio/webm");
    assert.equal(capturedRequest.audio.durationSeconds, 12);
    assert.equal(
        capturedRequest.audio.data,
        Buffer.from("fake-audio").toString("base64")
    );
});

test("POST /api/analyze rejects invalid companion styles", async () => {
    const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "unknown")
        .attach("photo", Buffer.from("fake-image"), {
            filename: "meal.jpg",
            contentType: "image/jpeg"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "INVALID_COMPANION_STYLE");
});

test("POST /api/analyze rejects invalid audio duration", async () => {
    const response = await photoRequest()
        .field("audioDurationSeconds", "61")
        .attach("audio", Buffer.from("fake-audio"), {
            filename: "note.webm",
            contentType: "audio/webm"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "INVALID_AUDIO_DURATION");
});

test("POST /api/analyze rejects missing audio duration", async () => {
    const response = await photoRequest()
        .attach("audio", Buffer.from("fake-audio"), {
            filename: "note.webm",
            contentType: "audio/webm"
        });

    assert.equal(response.status, 400);
    assert.equal(
        response.body.error.code,
        "INVALID_AUDIO_DURATION"
    );
});

test("POST /api/analyze rejects unsupported photo types", async () => {
    const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "casual")
        .attach("photo", Buffer.from("fake-image"), {
            filename: "meal.gif",
            contentType: "image/gif"
        });

    assert.equal(response.status, 415);
});

test("POST /api/analyze rejects duplicate photo uploads", async () => {
    const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "casual")
        .attach("photo", Buffer.from("first-photo"), {
            filename: "first.jpg",
            contentType: "image/jpeg"
        })
        .attach("photo", Buffer.from("second-photo"), {
            filename: "second.jpg",
            contentType: "image/jpeg"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "LIMIT_UNEXPECTED_FILE");
});

test("POST /api/analyze rejects oversized photos", async () => {
    const oversizedPhoto = Buffer.alloc(
        10 * 1024 * 1024 + 1,
        1
    );

    const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "casual")
        .attach("photo", oversizedPhoto, {
            filename: "large.jpg",
            contentType: "image/jpeg"
        });

    assert.equal(response.status, 413);
});

test("POST /api/analyze rejects an empty photo", async () => {
    const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", "Bearer test-user")
        .field("companionStyle", "casual")
        .attach("photo", Buffer.alloc(0), {
            filename: "empty.jpg",
            contentType: "image/jpeg"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "PHOTO_REQUIRED");
});

test("POST /api/analyze rejects an empty audio recording", async () => {
    const response = await photoRequest()
        .field("audioDurationSeconds", "10")
        .attach("audio", Buffer.alloc(0), {
            filename: "empty.webm",
            contentType: "audio/webm"
        });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "EMPTY_AUDIO");
});

test("POST /api/analyze handles ADK service errors", async () => {
    simulatedError = Object.assign(
        new Error("ADK service unavailable"),
        { status: 503 }
    );

    try {
        const response = await photoRequest();

        assert.equal(response.status, 503);
        assert.equal(response.body.error.code, "INTERNAL_SERVER_ERROR");
        assert.equal(
            response.body.error.message,
            "An unexpected server error occurred"
        );
    } finally {
        simulatedError = undefined;
    }
});

test("POST /api/analyze handles ADK timeouts", async () => {
    simulatedError = Object.assign(
        new Error("ADK service request timed out"),
        { status: 504 }
    );

    try {
        const response = await photoRequest();

        assert.equal(response.status, 504);
        assert.equal(
            response.body.error.code,
            "INTERNAL_SERVER_ERROR"
        );
        assert.equal(
            response.body.error.message,
            "An unexpected server error occurred"
        );
    } finally {
        simulatedError = undefined;
    }
});

// AG-03 (#3): the ADK history tools need the caller's own token.
test("POST /api/analyze passes the caller's token to the ADK client", async () => {
    simulatedError = undefined;
    const response = await photoRequest();

    assert.equal(response.status, 200);
    assert.equal(capturedOptions.authorization, "Bearer test-user");
});
