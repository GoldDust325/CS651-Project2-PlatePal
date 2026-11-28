// PlatePal Project 2 — Goals API for the ADK Planner (Agent 3)
// Author: Shiv Shankar Yadav

const express = require("express");
const { getGoals, saveGoals } = require("../services/firestoreGoals");

const router = express.Router();

// GET /api/goals
// The authenticated user's current goals, or null when none are set.
router.get("/", async (req, res, next) => {
    try {
        res.status(200).json({ goals: await getGoals(req.user.uid) });
    } catch (error) {
        next(error);
    }
});

// PUT /api/goals
// Body: { goals, source: "planner" | "user" }. Replaces the user's goals.
router.put("/", async (req, res, next) => {
    try {
        res.status(200).json(await saveGoals(req.user.uid, req.body));
    } catch (error) {
        next(error);
    }
});

module.exports = router;
