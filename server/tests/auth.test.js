
// PlatePal Project 2
// Developer: Michelle Golden
// BE-03 - Firebase Authentication Testing

const { test } = require("node:test");
const assert = require("node:assert/strict");

const firebaseApp = require("firebase-admin/app");
const firebaseAuth = require("firebase-admin/auth");

const verifyFirebaseToken = require(
    "../middleware/verifyFirebaseToken"
);

// Create simulated Express request and response
function createContext(authorization, body = {}, query = {}) {
    const req = {
        headers: {},
        body,
        query,
        params: {}
    };

    if (authorization !== undefined) {
        req.headers.authorization = authorization;
    }

    const res = {
        statusCode: 200,
        payload: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(data) {
            this.payload = data;
            return this;
        }
    };

    let nextCalled = false;

    const next = () => {
        nextCalled = true;
    };

    return {
        req,
        res,
        next,
        wasNextCalled: () => nextCalled
    };
}

// Mock Firebase token verification
function mockFirebase(t, decodedToken, error = null) {
    const auth = firebaseAuth.getAuth(
        firebaseApp.getApps().length > 0
            ? firebaseApp.getApp()
            : firebaseApp.initializeApp({
                projectId: "platepal-test"
            })
    );

    return t.mock.method(
        auth,
        "verifyIdToken",
        async () => {
            if (error) {
                throw error;
            }

            return decodedToken;
        }
    );
}

// Simulated verified Firebase identity
const validUser = {
    uid: "user-001",
    email: "test@example.com",
    email_verified: true
};

// Simulated Firebase errors
function createAuthError(code) {
    const error = new Error("Simulated Firebase error");
    error.code = code;
    return error;
}

// Test 1: Missing authentication header
test("Reject missing authorization header", async () => {
    const ctx = createContext();

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.res.statusCode, 401);
    assert.equal(ctx.wasNextCalled(), false);
});

// Test 2: Incorrect authentication scheme
test("Reject incorrect authentication scheme", async () => {
    const ctx = createContext("Basic abc123");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.res.statusCode, 401);
    assert.equal(ctx.wasNextCalled(), false);
});

// Test 3: Empty Bearer token
test("Reject empty Bearer token", async () => {
    const ctx = createContext("Bearer");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.res.statusCode, 401);
    assert.equal(ctx.wasNextCalled(), false);
});

// Test 4: Valid token
test("Accept valid Firebase token", async (t) => {
    mockFirebase(t, validUser);

    const ctx = createContext("Bearer valid-token");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.wasNextCalled(), true);
    assert.equal(ctx.req.user.uid, "user-001");
});

// Test 5: Invalid or forged token
test("Reject invalid Firebase token", async (t) => {
    mockFirebase(
        t,
        null,
        createAuthError("auth/argument-error")
    );

    const ctx = createContext("Bearer forged-token");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.res.statusCode, 401);
    assert.equal(ctx.res.payload.error.code, "INVALID_TOKEN");
    assert.equal(ctx.wasNextCalled(), false);
});

// Test 6: Expired token
test("Reject expired Firebase token", async (t) => {
    mockFirebase(
        t,
        null,
        createAuthError("auth/id-token-expired")
    );

    const ctx = createContext("Bearer expired-token");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.res.statusCode, 401);
    assert.equal(ctx.res.payload.error.code, "TOKEN_EXPIRED");
    assert.equal(ctx.wasNextCalled(), false);
});

// Test 7: Firebase service failure
test("Reject requests when Firebase fails", async (t) => {
    mockFirebase(
        t,
        null,
        createAuthError("auth/internal-error")
    );

    const ctx = createContext("Bearer test-token");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.res.statusCode, 503);
    assert.equal(ctx.wasNextCalled(), false);
});

// Test 8: Trusted identity extraction
test("Extract trusted Firebase user identity", async (t) => {
    mockFirebase(t, validUser);

    const ctx = createContext("Bearer valid-token");

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.deepEqual(ctx.req.user, {
        uid: "user-001",
        email: "test@example.com",
        emailVerified: true
    });

    assert.equal(ctx.wasNextCalled(), true);
});

// Test 9: Caller-provided UID manipulation
test("Do not trust caller-provided UID", async (t) => {
    mockFirebase(t, validUser);

    const ctx = createContext(
        "Bearer valid-token",
        { uid: "user-999" },
        { uid: "user-888" }
    );

    ctx.req.params.uid = "user-777";

    await verifyFirebaseToken(
        ctx.req, ctx.res, ctx.next
    );

    assert.equal(ctx.req.user.uid, "user-001");
    assert.notEqual(ctx.req.user.uid, ctx.req.body.uid);
    assert.notEqual(ctx.req.user.uid, ctx.req.query.uid);
    assert.notEqual(ctx.req.user.uid, ctx.req.params.uid);
    assert.equal(ctx.wasNextCalled(), true);
});
