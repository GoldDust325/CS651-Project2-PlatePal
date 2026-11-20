
/*
 * PlatePal Project 2
 * BE-06: Companion Preferences API
 * Developer: Michelle Golden
 */

const express = require("express");
const { getApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const router = express.Router();

const ALLOWED_STYLES = ["casual", "strict", "athlete"];

// PATCH /api/preferences
// Update the authenticated user's companion preference.
router.patch("/", async (req, res, next) => {
    try {
        const { companionStyle } = req.body || {};

        // Accept only the three supported companion styles.
        if (
            typeof companionStyle !== "string" ||
            !ALLOWED_STYLES.includes(companionStyle)
        ) {
            return res.status(400).json({
                error: {
                    code: "INVALID_COMPANION_STYLE",
                    message: "Companion style must be casual, strict, or athlete"
                }
            });
        }

        // Use the verified Firebase UID, never a client-provided UID.
        const uid = req.user.uid;

        // Reuse the Firebase Admin app initialized by BE-03.
        const db = getFirestore(getApp());
        const userRef = db.collection("users").doc(uid);

        // Require an existing user profile.
        // Do not silently create an incomplete profile.
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.status(404).json({
                error: {
                    code: "PROFILE_NOT_FOUND",
                    message: "User profile not found"
                }
            });
        }

        // Update only the preference and timestamp.
        await userRef.update({
            companionStyle,
            updatedAt: FieldValue.serverTimestamp()
        });

        return res.status(200).json({
            companionStyle
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
