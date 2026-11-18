
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
