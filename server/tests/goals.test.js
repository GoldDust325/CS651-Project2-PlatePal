// PlatePal Project 2 — Goals service and API tests (ADK Planner, Agent 3)
// Author: Shiv Shankar Yadav

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createGoalsService } = require("../services/firestoreGoals");

const GOALS = {
    fitnessGoal: "build_muscle",
    dailyTargets: {
        calories: 2600,
        proteinGrams: 150,
        carbohydrateGrams: 300,
        fatGrams: 80,
        fiberGrams: 30
    },
    weeklyGoals: ["Add vegetables to 5 meals this week."]
};

// Minimal in-memory Firestore: users/{uid}/goals/{docId}.
function fakeDb() {
    const docs = new Map();
    const db = {
        docs,
        collection(name) {
            return {
                doc(id) {
                    return {
                        collection(sub) {
                            return {
                                doc(docId) {
                                    const path = `${name}/${id}/${sub}/${docId}`;
                                    return {
                                        path,
                                        async get() {
                                            return {
                                                exists: docs.has(path),
                                                data: () => structuredClone(docs.get(path))
                                            };
                                        },
                                        async set(value) {
                                            docs.set(path, structuredClone(value));
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        }
    };
    return db;
}

test("goals are stored per user under users/{uid}/goals/current", async () => {
    const db = fakeDb();
    const service = createGoalsService(db, () => "2026-11-28T00:00:00Z");

    assert.equal(await service.getGoals("alice"), null);
    await service.saveGoals("alice", { goals: GOALS, source: "planner" });

    assert.deepEqual([...db.docs.keys()], ["users/alice/goals/current"]);
    const saved = await service.getGoals("alice");
    assert.equal(saved.fitnessGoal, "build_muscle");
    assert.equal(saved.source, "planner");
    assert.equal(saved.updatedAt, "2026-11-28T00:00:00Z");
    assert.equal(await service.getGoals("bob"), null);
});

test("source defaults to user and unknown fields are not stored", async () => {
    const db = fakeDb();
    const service = createGoalsService(db, () => "now");
    await service.saveGoals("alice", { goals: GOALS, extra: "ignored" });
    const stored = db.docs.get("users/alice/goals/current");
    assert.equal(stored.source, "user");
    assert.deepEqual(Object.keys(stored).sort(),
        ["dailyTargets", "fitnessGoal", "source", "updatedAt", "weeklyGoals"]);
});

test("invalid goals and sources are rejected", async () => {
    const service = createGoalsService(fakeDb(), () => "now");
    const bad = structuredClone(GOALS);
    bad.dailyTargets.calories = 400;
    await assert.rejects(service.saveGoals("alice", { goals: bad }), { code: "INVALID_GOALS", status: 400 });
    await assert.rejects(service.saveGoals("alice", { goals: { ...GOALS, fitnessGoal: "bulk" } }), { code: "INVALID_GOALS" });
    await assert.rejects(service.saveGoals("alice", { goals: GOALS, source: "admin" }), { code: "INVALID_GOALS" });
    await assert.rejects(service.saveGoals("alice", {}), { code: "INVALID_GOALS" });
    await assert.rejects(service.saveGoals("a/b", { goals: GOALS }), { code: "INVALID_ID" });
});

test("goals API uses the verified UID and requires sign-in", async () => {
    const servicePath = require.resolve("../services/firestoreGoals");
    const authPath = require.resolve("../middleware/verifyFirebaseToken");
    const indexPath = require.resolve("../index");
    const previous = [servicePath, authPath, indexPath].map(p => require.cache[p]);
    const db = fakeDb();
    const real = createGoalsService(db, () => "now");

    require.cache[servicePath] = { id: servicePath, filename: servicePath, loaded: true, exports: real };
    require.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: (req, res, next) => {
            const token = req.headers.authorization;
            if (!token?.startsWith("Bearer test-")) {
                return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in" } });
            }
            req.user = { uid: token.slice("Bearer test-".length) };
            next();
        }
    };
    delete require.cache[indexPath];

    try {
        const app = require("../index");
        await request(app).get("/api/goals").expect(401);

        await request(app).put("/api/goals").set("Authorization", "Bearer test-alice")
            .send({ goals: GOALS, source: "planner", uid: "bob" }).expect(200);
        assert.deepEqual([...db.docs.keys()], ["users/alice/goals/current"]);

        const alice = await request(app).get("/api/goals").set("Authorization", "Bearer test-alice").expect(200);
        assert.equal(alice.body.goals.fitnessGoal, "build_muscle");
        const bob = await request(app).get("/api/goals").set("Authorization", "Bearer test-bob").expect(200);
        assert.equal(bob.body.goals, null);

        const bad = await request(app).put("/api/goals").set("Authorization", "Bearer test-alice")
            .send({ goals: { fitnessGoal: "maintain" } }).expect(400);
        assert.equal(bad.body.error.code, "INVALID_GOALS");
    } finally {
        [servicePath, authPath, indexPath].forEach((p, i) => {
            if (previous[i]) require.cache[p] = previous[i]; else delete require.cache[p];
        });
    }
});
