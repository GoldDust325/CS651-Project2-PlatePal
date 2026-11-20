
/*
 * PlatePal Project 2
 * BE-05: Meal CRUD API Tests
 * Developer: Michelle Golden
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

// Mock service and authentication before importing Express.
const servicePath = require.resolve("../services/firestoreMeals");
const authPath = require.resolve("../middleware/verifyFirebaseToken");

// In-memory test records, separated by Firebase UID.
const records = new Map();
let nextId = 1;

function userMeals(uid) {
    if (!records.has(uid)) {
        records.set(uid, new Map());
    }
    return records.get(uid);
}

function serviceError(status, code) {
    const error = new Error(code);
    error.status = status;
    error.code = code;
    return error;
}

// Mock the Firestore service.
require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
        async saveMeal(uid, data) {
            if (!data?.analysis || data.analysis.reviewed !== true) {
                throw serviceError(400, "REVIEW_REQUIRED");
            }

            const mealId = String(nextId++);
            userMeals(uid).set(mealId, data);
            return { mealId };
        },

        async listMeals(uid) {
            return [...userMeals(uid)].map(([mealId, data]) => ({
                mealId,
                ...data
            }));
        },

        async updateMeal(uid, mealId, data) {
            if (!userMeals(uid).has(mealId)) {
                throw serviceError(404, "MEAL_NOT_FOUND");
            }

            if (!data?.analysis || data.analysis.reviewed !== true) {
                throw serviceError(400, "REVIEW_REQUIRED");
            }

            userMeals(uid).set(mealId, data);
            return { mealId };
        },

        async deleteMeal(uid, mealId) {
            if (!userMeals(uid).has(mealId)) {
                throw serviceError(404, "MEAL_NOT_FOUND");
            }

            userMeals(uid).delete(mealId);
            return { mealId, deleted: true };
        }
    }
};

// Simulate a verified Firebase identity.
// Production authentication is tested separately in auth.test.js.
require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: (req, res, next) => {
        const token = req.headers.authorization;

        if (!token?.startsWith("Bearer test-")) {
            return res.status(401).json({
                error: { code: "UNAUTHORIZED" }
            });
        }

        req.user = { uid: token.slice("Bearer test-".length) };
        next();
    }
};

const app = require("../index");

const auth = (uid) => ({ Authorization: `Bearer test-${uid}` });

test("GET /api/meals rejects unauthenticated requests", async () => {
    const response = await request(app).get("/api/meals");
    assert.equal(response.status, 401);
});

test("GET /api/meals returns empty history", async () => {
    const response = await request(app)
        .get("/api/meals")
        .set(auth("empty-user"));

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.meals, []);
});

test("POST /api/meals saves a reviewed meal", async () => {
    const response = await request(app)
        .post("/api/meals")
        .set(auth("alice"))
        .send({ analysis: { reviewed: true } });

    assert.equal(response.status, 201);
    assert.ok(response.body.mealId);
});

test("POST /api/meals rejects unreviewed analysis", async () => {
    const response = await request(app)
        .post("/api/meals")
        .set(auth("alice"))
        .send({ analysis: { reviewed: false } });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "REVIEW_REQUIRED");
});

test("GET /api/meals returns only the current user's meals", async () => {
    const alice = await request(app)
        .get("/api/meals")
        .set(auth("alice"));

    const bob = await request(app)
        .get("/api/meals")
        .set(auth("bob"));

    assert.equal(alice.status, 200);
    assert.equal(alice.body.meals.length, 1);
    assert.deepEqual(bob.body.meals, []);
});

test("PATCH /api/meals/:id updates an owned meal", async () => {
    const response = await request(app)
        .patch("/api/meals/1")
        .set(auth("alice"))
        .send({ analysis: { reviewed: true, corrected: true } });

    assert.equal(response.status, 200);
    assert.equal(response.body.mealId, "1");
});

test("PATCH rejects another user's meal ID", async () => {
    const response = await request(app)
        .patch("/api/meals/1")
        .set(auth("bob"))
        .send({ analysis: { reviewed: true } });

    assert.equal(response.status, 404);
});

test("DELETE rejects another user's meal ID", async () => {
    const response = await request(app)
        .delete("/api/meals/1")
        .set(auth("bob"));

    assert.equal(response.status, 404);
});

test("DELETE /api/meals/:id removes an owned meal", async () => {
    const response = await request(app)
        .delete("/api/meals/1")
        .set(auth("alice"));

    assert.equal(response.status, 200);
    assert.equal(response.body.deleted, true);
});

test("DELETE returns 404 for a missing meal", async () => {
    const response = await request(app)
        .delete("/api/meals/nonexistent")
        .set(auth("alice"));

    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, "MEAL_NOT_FOUND");
});
