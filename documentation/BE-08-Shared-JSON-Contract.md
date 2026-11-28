# PlatePal Project 2: Shared JSON Analysis Contract

**Developer:** Michelle Golden  
**Role:** Express Backend & API Developer  
**Issue:** #37 (BE-08)  
**Date:** November 18, 2026  
**Branch:** be-08-json-contract  
**Contract Version:** 1.0.0

## 1. Overview

The shared JSON analysis contract establishes a standardized data structure for communication between the React frontend, Express backend, Python ADK agent, and Cloud Firestore.

The contract uses JSON Schema Draft-07 and is validated locally using AJV and AJV Formats.

## 2. Component Files

| File | Purpose |
|---|---|
| server/schemas/analysis.schema.json | Shared JSON schema |
| server/tests/analysis.fixtures.json | Valid and invalid JSON examples |
| server/tests/analysis.test.js | Automated schema validation |
| server/package.json | Validation dependencies and test command |
| server/package-lock.json | Dependency version management |

## 3. Analysis Request

| Field | Type | Required |
|---|---|---|
| schemaVersion | String | Yes |
| photo | Object | Yes |
| audio | Object | No |
| companionStyle | String | Yes |

The normalized request supports photo-only and photo-plus-audio analysis.

React submits media using multipart/form-data. Express will normalize the media into the proposed Base64 JSON format for communication with ADK.

Audio duration must be greater than zero and no longer than 60 seconds.

## 4. Analysis Response

| Field | Purpose |
|---|---|
| schemaVersion | Contract version |
| analysisId | Unique analysis identifier |
| createdAt | Timestamp |
| foods | Identified food items and quantities |
| imageEvidence | Observations from the image |
| audioAssertions | Information provided through audio |
| conflicts | Image and audio disagreements |
| uncertainties | Uncertain analysis findings |
| estimatedMacros | Estimated meal nutritional values |
| macroStatus | Current nutritional estimation status |
| recommendation | AI-generated recommendation |
| companionStyle | Selected companion behavior |
| reviewed | User review status |
| corrected | User correction status |
| corrections | Food and portion correction history |

**Optional fields from the multi-agent coach (still `schemaVersion` 1.0.0).** These were added as optional fields so older responses and saved meals stay valid. Clients that do not know them can ignore them.

| Field | Purpose |
|---|---|
| foods[].category | protein, grain, vegetable, fruit, dairy, fat_oil, sweet, beverage, mixed or other |
| foods[].estimatedNutrients | fiberGrams, sugarGrams, sodiumMilligrams for that food |
| estimatedNutrients | Meal totals of the above, summed in code when every food has them |
| dietaryContext | allergies and cravings the user stated in the voice note |
| review | Coach review: healthRating (balanced, okay, needs_attention), healthNote, suggestedAdditions, allergyFlags (allergen, foodIds, note), optional cravingSuggestion |
| planUpdate | Planner proposal: goals (fitnessGoal, dailyTargets, weeklyGoals), reason, basedOnMealCount. The `goals` definition is also what `PUT /api/goals` accepts |

## 5. Companion Styles

The contract supports three standardized companion values:

- casual
- strict
- athlete

Companion style influences recommendations, not the nutritional estimates themselves.

## 6. Nutritional Estimates

Nutritional values include:

- Calories (kcal)
- Protein (grams)
- Carbohydrates (grams)
- Fat (grams)

All nutritional values must be nonnegative. Food quantities must be greater than zero.

Nutritional values are estimates and should not be presented as exact measurements.

Supported macro statuses:

- estimated
- pending_recalculation

## 7. Image and Audio Conflicts

The contract supports disagreements between visual observations and spoken meal descriptions.

Example:

- Image observation: Grilled chicken, 150 g
- Audio assertion: Grilled tofu
- User correction: Grilled tofu, 120 g

The corrected response preserves the original observations, records the user's correction, resolves the conflict, and marks nutritional estimates as pending recalculation.

A resolved conflict requires a resolution description.

## 8. API Error Structure

API errors contain an error code and a safe user-facing message.

The schemaVersion field is optional for error responses to maintain compatibility with the initial BE-01 backend implementation.

## 9. Security and Validation

- Required field validation
- Data type validation
- Restricted companion style values
- Supported declared media types
- Audio duration constraints
- Nonnegative nutritional values
- Positive food quantities
- Timestamp format validation
- Contract version validation
- Rejection of unexpected object properties

Firebase user identity must be obtained through verified authentication rather than trusted from client-provided data.

## 10. Automated Testing

From the server directory, install dependencies:

`npm install`

Run the contract validation tests:

`npm run test:contract`

Export the shared JSON fixtures:

`node tests/analysis.test.js --export-fixtures`

Windows PowerShell users may substitute npm.cmd for npm.

## 11. Testing Results

| Test Case | Result |
|---|---|
| Valid photo-only request | PASS |
| Valid photo and audio request | PASS |
| Valid analysis response | PASS |
| Valid API error | PASS |
| Missing required photo | PASS |
| Invalid companion style | PASS |
| Invalid audio duration | PASS |
| Invalid API error | PASS |
| Valid image/audio conflict | PASS |
| Valid user-corrected response | PASS |
| Missing conflict resolution | PASS |
| Negative nutritional values | PASS |
| Missing required foods field | PASS |
| Invalid food quantity | PASS |
| Invalid timestamp | PASS |
| Unsupported schema version | PASS |

**Total test cases:** 16  
**Passed:** 16  
**Failed:** 0  
**Pass rate:** 100%

Invalid test cases pass when the schema correctly rejects the supplied data.

## 12. Team Integration

The shared schema and exported fixtures are intended for use by the frontend, ADK, and cloud/database developers.

Related components:

- AG-01: ADK agent architecture and service contract
- DB-01: Firestore schema and user profiles
- FE-05: Live analysis results
- FE-06: Meal corrections
- BE-02: Analysis API
- BE-07: Express-to-ADK service client

## 13. Pending Integration

- Team review and agreement on the proposed contract
- React rendering of valid mock responses
- Python ADK schema compatibility and parsing
- Express runtime validation integration
- Firestore persistence of reviewed and corrected results
- Actual media content and Base64 validation
- Application-level consistency checks for nutritional values, corrections, and conflict resolution

## 14. Conclusion

The proposed shared JSON analysis contract has been implemented and locally validated. All 16 automated test cases passed successfully.

The schema and exported fixtures are ready for team review and cross-component integration. Final acceptance remains pending integration testing.