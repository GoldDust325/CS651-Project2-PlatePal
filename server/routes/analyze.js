/*
 * PlatePal Project 2
 * BE-02: Photo and Audio Analysis API
 * Developer: Michelle Golden
 */

const express = require("express");
const { analyzeMeal } = require("../services/adkClient");

const router = express.Router();

router.post("/", async (req, res, next) => {
    try {
        const photo = req.files?.photo?.[0];
        const audio = req.files?.audio?.[0];
// Validate required photo
        if (!photo || photo.size === 0) {
            return res.status(400).json({
                error: {
                    code: "PHOTO_REQUIRED",
                    message: "A meal photo is required"
                }
            });
        }

// Validate optional audio
        if (audio && audio.size === 0) {
            return res.status(400).json({
                error: {
                 code: "EMPTY_AUDIO",
                 message: "The audio recording cannot be empty"
        }
    });
}
        const photoSource = req.body?.photoSource || "local";

if (!["local", "google_photos"].includes(photoSource)) {
    return res.status(400).json({
        error: {
            code: "INVALID_PHOTO_SOURCE",
            message: "Photo source must be local or google_photos"
        }
    });
}
        const companionStyle = req.body?.companionStyle;

        if (!["casual", "strict", "athlete"].includes(companionStyle)) {
            return res.status(400).json({
                error: {
                    code: "INVALID_COMPANION_STYLE",
                    message: "Choose casual, strict, or athlete"
                }
            });
        }

        const analysisRequest = {
            schemaVersion: "1.0.0",
            photo: {
                source: photoSource,
                mimeType: photo.mimetype,
                data: photo.buffer.toString("base64")
            },
            companionStyle
        };

        if (audio) {
    const rawDuration = req.body?.audioDurationSeconds;
    const duration = Number(rawDuration);

    if (
        typeof rawDuration !== "string" ||
        rawDuration.trim() === "" ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 60
    ) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_AUDIO_DURATION",
                        message: "Audio duration must be between 0 and 60 seconds"
                    }
                });
            }

            analysisRequest.audio = {
                mimeType: audio.mimetype,
                data: audio.buffer.toString("base64"),
                durationSeconds: duration
            };
        }

        const result = await analyzeMeal(analysisRequest);
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
