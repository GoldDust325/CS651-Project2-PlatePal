
/*
 * PlatePal Project 2
 * BE-06: Companion Preferences API Tests
 * Developer: Michelle Golden
 */

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const authPath = require.resolve(
    "../middleware/verifyFirebaseToken"
);

const firebaseAppPath = require.resolve(
    "firebase-admin/app"
);

const firestorePath = require.resolve(
    "firebase-admin/firestore"
);

// Simulated Firestore user profiles.
const profiles = new Map();

const timestamp = "2026-11-19T18:00:00Z";

// Reset data before each test.
beforeEach(() => {
    profiles.clear();

    profiles.set("alice", {
        displayName: "Alice",
        email: "alice@example.com",
        companionStyle: "casual",
        createdAt: "2026-11-01T10:00:00Z"
    });

    profiles.set("bob", {
        displayName: "Bob",
        email: "bob@example.com",
        companionStyle: "strict",
        createdAt: "2026-11-02T10:00:00Z"
    });
});

// Mock Firebase authentication.
require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (req, res, next) => {
        const token = req.headers.authorization;

        if (!token?.startsWith("Bearer test-")) {
            return res.status(401).json({
                error: {
                    code: "UNAUTHORIZED",
                    message: "A valid Bearer token is required"
                }
            });
        }

        req.user = {
            uid: token.slice("Bearer test-".length)
        };

        next();
    }
};

// Mock Firebase Admin app.
require.cache[firebaseAppPath] = {
    id: firebaseAppPath,
    filename: firebaseAppPath,
    loaded: true,
    exports: {
        getApp: () => ({ name: "test-app" })
    }
};

// Mock Firestore document operations.
const mockDb = {
    collection(name) {
        assert.equal(name, "users");

        return {
            doc(uid) {
                return {
                    async get() {
                        return {
                            exists: profiles.has(uid),
                            data: () => profiles.get(uid)
                        };
                    },

                    async update(changes) {
                        if (!profiles.has(uid)) {
                            throw new Error("Profile not found");
                        }

                        const existing = profiles.get(uid);

                        profiles.set(uid, {
                            ...existing,
                            ...changes
                        });
                    }
                };
            }
        };
    }
};

require.cache[firestorePath] = {
    id: firestorePath,
    filename: firestorePath,
    loaded: true,
    exports: {
        getFirestore: () => mockDb,
        FieldValue: {
            serverTimestamp: () => timestamp
        }
    }
};

const app = require("../index");

const auth = (uid) => ({
    Authorization: `Bearer test-${uid}`
});

// Test 1
test("PATCH rejects unauthenticated requests", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .send({ companionStyle: "casual" });

    assert.equal(response.status, 401);
});

// Test 2
test("PATCH accepts casual style", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({ companionStyle: "casual" });

    assert.equal(response.status, 200);
    assert.equal(response.body.companionStyle, "casual");
});

// Test 3
test("PATCH accepts strict style", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({ companionStyle: "strict" });

    assert.equal(response.status, 200);
    assert.equal(profiles.get("alice").companionStyle, "strict");
});

// Test 4
test("PATCH accepts athlete style", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({ companionStyle: "athlete" });

    assert.equal(response.status, 200);
    assert.equal(profiles.get("alice").companionStyle, "athlete");
});

// Test 5
test("PATCH rejects invalid companion style", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({ companionStyle: "unknown" });

    assert.equal(response.status, 400);
    assert.equal(
        response.body.error.code,
        "INVALID_COMPANION_STYLE"
    );
});

// Test 6
test("PATCH rejects missing companion style", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({});

    assert.equal(response.status, 400);
});

// Test 7
test("PATCH rejects missing user profile", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("nonexistent"))
        .send({ companionStyle: "casual" });

    assert.equal(response.status, 404);
    assert.equal(
        response.body.error.code,
        "PROFILE_NOT_FOUND"
    );
});

// Test 8
test("PATCH preserves existing profile fields", async () => {
    const original = { ...profiles.get("alice") };

    await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({ companionStyle: "athlete" });

    const updated = profiles.get("alice");

    assert.equal(updated.displayName, original.displayName);
    assert.equal(updated.email, original.email);
    assert.equal(updated.createdAt, original.createdAt);
    assert.equal(updated.updatedAt, timestamp);
});

// Test 9
test("PATCH cannot modify another user's profile", async () => {
    const response = await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({
            companionStyle: "athlete",
            uid: "bob"
        });

    assert.equal(response.status, 200);
    assert.equal(profiles.get("alice").companionStyle, "athlete");
    assert.equal(profiles.get("bob").companionStyle, "strict");
});

// Test 10
test("PATCH preference survives subsequent profile reads", async () => {
    await request(app)
        .patch("/api/preferences")
        .set(auth("alice"))
        .send({ companionStyle: "strict" });

    const savedProfile = profiles.get("alice");

    assert.equal(savedProfile.companionStyle, "strict");
});
