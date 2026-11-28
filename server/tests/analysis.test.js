
// PlatePal Project 2
// Developer: Michelle Golden
// BE-08 - Shared JSON Contract Testing

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const schema = require("../schemas/analysis.schema.json");
const fixtures = require("./analysis.fixtures.json");

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(schema);

let passed = 0;
let failed = 0;

console.log("\nPlatePal JSON Schema Validation Tests\n");

// Additional conflict and correction fixtures
const conflictResponse = structuredClone(
    fixtures.validAnalysisResponse
);

conflictResponse.analysisId = "analysis-002";

conflictResponse.audioAssertions = [
    "The meal contains tofu, not chicken."
];

conflictResponse.conflicts = [
    {
        conflictId: "conflict-001",
        foodId: "food-001",
        imageObservation: "Grilled chicken",
        audioAssertion: "Grilled tofu",
        resolved: false
    }
];

conflictResponse.uncertainties = [
    "Image and audio disagree on food identity."
];

fixtures.validConflictResponse = conflictResponse;

// Simulate user corrections
const correctedResponse = structuredClone(
    conflictResponse
);

correctedResponse.foods[0].name = "Grilled tofu";
correctedResponse.foods[0].quantity.amount = 120;
correctedResponse.foods[0].corrected = true;

correctedResponse.conflicts[0].resolved = true;
correctedResponse.conflicts[0].resolution =
    "User confirmed grilled tofu.";

correctedResponse.reviewed = true;
correctedResponse.corrected = true;
correctedResponse.macroStatus = "pending_recalculation";
correctedResponse.uncertainties = [
    "Nutritional estimates require recalculation."
];

correctedResponse.corrections = [
    {
        foodId: "food-001",
        previousName: "Grilled chicken",
        correctedName: "Grilled tofu",
        previousQuantity: {
            amount: 150,
            unit: "g"
        },
        correctedQuantity: {
            amount: 120,
            unit: "g"
        }
    }
];

fixtures.validCorrectedResponse = correctedResponse;

// Invalid: resolved conflict without a resolution
fixtures.invalidConflictResolution = structuredClone(
    correctedResponse
);

delete fixtures.invalidConflictResolution
    .conflicts[0].resolution;

// Invalid: negative nutritional values
fixtures.invalidNegativeMacros = structuredClone(
    fixtures.validAnalysisResponse
);

fixtures.invalidNegativeMacros
    .estimatedMacros.calories = -100;

// Invalid: missing required response field
fixtures.invalidMissingFoods = structuredClone(
    fixtures.validAnalysisResponse
);

delete fixtures.invalidMissingFoods.foods;

// Invalid: negative food quantity
fixtures.invalidFoodQuantity = structuredClone(
    fixtures.validAnalysisResponse
);

fixtures.invalidFoodQuantity
    .foods[0].quantity.amount = -50;

// Invalid: incorrect timestamp format
fixtures.invalidTimestamp = structuredClone(
    fixtures.validAnalysisResponse
);

fixtures.invalidTimestamp.createdAt = "not-a-date";

// Invalid: unsupported contract version
fixtures.invalidSchemaVersion = structuredClone(
    fixtures.validPhotoOnlyRequest
);

fixtures.invalidSchemaVersion.schemaVersion = "2.0.0";

// Optional Agent 1/Agent 2 fields: category, nutrients, dietary
// context from the voice note, and the coach's structured review.
const coachedResponse = structuredClone(
    fixtures.validAnalysisResponse
);

coachedResponse.foods[0].category = "protein";
coachedResponse.foods[0].estimatedNutrients = {
    fiberGrams: 0,
    sugarGrams: 0,
    sodiumMilligrams: 110
};
coachedResponse.estimatedNutrients = {
    fiberGrams: 0,
    sugarGrams: 0,
    sodiumMilligrams: 110
};
coachedResponse.dietaryContext = {
    allergies: ["peanuts"],
    cravings: ["Chinese food"]
};
coachedResponse.review = {
    healthRating: "okay",
    healthNote: "High in protein but has no vegetables or whole grains.",
    suggestedAdditions: ["steamed broccoli", "brown rice"],
    allergyFlags: [],
    cravingSuggestion: "Try a chicken and vegetable stir-fry without peanuts."
};

coachedResponse.planUpdate = {
    goals: {
        fitnessGoal: "build_muscle",
        dailyTargets: {
            calories: 2600,
            proteinGrams: 150,
            carbohydrateGrams: 300,
            fatGrams: 80,
            fiberGrams: 30
        },
        weeklyGoals: ["Add vegetables to 4 dinners this week."]
    },
    reason: "Protein is on track but vegetables are low.",
    basedOnMealCount: 3
};

fixtures.validCoachedResponse = coachedResponse;

// Invalid: planner daily calorie target below the safe minimum
fixtures.invalidPlanTargets = structuredClone(coachedResponse);
fixtures.invalidPlanTargets.planUpdate.goals.dailyTargets.calories = 500;

// Invalid: health rating outside the allowed values
fixtures.invalidHealthRating = structuredClone(coachedResponse);
fixtures.invalidHealthRating.review.healthRating = "great";

// Invalid: unknown food category
fixtures.invalidFoodCategory = structuredClone(coachedResponse);
fixtures.invalidFoodCategory.foods[0].category = "meat";

// Export shared fixtures when requested
if (process.argv.includes("--export-fixtures")) {
    const fs = require("node:fs");
    const path = require("node:path");

    fs.writeFileSync(
        path.join(__dirname, "analysis.fixtures.json"),
        JSON.stringify(fixtures, null, 4) + "\n"
    );

    console.log("Shared fixtures exported successfully.");
}

for (const [name, data] of Object.entries(fixtures)) {
    const expected = name.startsWith("valid");
    const actual = validate(data);

    if (actual === expected) {
        console.log(`[PASS] ${name}`);
        passed++;
    } else {
        console.error(`[FAIL] ${name}`);
        console.error(validate.errors);
        failed++;
    }
}

console.log("\n--- Test Summary ---");
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(
    `Pass rate: ${(
        passed / (passed + failed) * 100
    ).toFixed(2)}%`
);

process.exitCode = failed > 0 ? 1 : 0;
