
// PlatePal Project 2
// BE-05: Meal CRUD API Routes
// Express Backend & API

const express = require("express");
const {
    saveMeal,
    listMeals,
    updateMeal,
    deleteMeal
} = require("../services/firestoreMeals");

const router = express.Router();

// Forward known service errors to the Express error handler.
function handleMealError(error, next) {
    next(error);
}

// POST /api/meals
// Save a meal only after the user reviews the analysis.
router.post("/", async (req, res, next) => {
    try {
        const result = await saveMeal(req.user.uid, req.body);

        res.status(201).json({
            message: "Meal saved successfully",
            ...result
        });
    } catch (error) {
        handleMealError(error, next);
    }
});

// GET /api/meals
// Retrieve only the authenticated user's meals.
router.get("/", async (req, res, next) => {
    try {
        const meals = await listMeals(req.user.uid);
        res.status(200).json({ meals });
    } catch (error) {
        handleMealError(error, next);
    }
});

// PATCH /api/meals/:id
// Update an existing meal owned by the authenticated user.
router.patch("/:id", async (req, res, next) => {
    try {
        const result = await updateMeal(
            req.user.uid,
            req.params.id,
            req.body
        );

        res.status(200).json({
            message: "Meal updated successfully",
            ...result
        });
    } catch (error) {
        handleMealError(error, next);
    }
});

// DELETE /api/meals/:id
// Delete an existing meal owned by the authenticated user.
router.delete("/:id", async (req, res, next) => {
    try {
        const result = await deleteMeal(
            req.user.uid,
            req.params.id
        );

        res.status(200).json({
            message: "Meal deleted successfully",
            ...result
        });
    } catch (error) {
        handleMealError(error, next);
    }
});

module.exports = router;
