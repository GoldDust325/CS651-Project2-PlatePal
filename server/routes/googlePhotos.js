const express = require("express");
const { retrieveSelectedGooglePhoto } = require("../services/googlePhotos");
const router = express.Router();

// This media import uses a Google Photos OAuth access token, not a Firebase ID
// token. It neither signs users into PlatePal nor grants access to meal history.
router.post("/import", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const token = req.headers.authorization?.match(/^Bearer\s+(\S{1,4096})$/i)?.[1];
    if (!token) {
        return res.status(401).json({ error: {
            code: "GOOGLE_PHOTOS_UNAUTHORIZED",
            message: "Connect to Google Photos before importing a photo."
        } });
    }
    try {
        const { buffer, mimetype } = await retrieveSelectedGooglePhoto({
            accessToken: token,
            sessionId: req.body?.sessionId,
            mediaItemId: req.body?.itemId,
            thumbnail: req.body?.thumbnail ?? false
        });
        res.set("X-Content-Type-Options", "nosniff");
        res.type(mimetype).send(buffer);
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            return res.status(504).json({ error: {
                code: "GOOGLE_PHOTOS_TIMEOUT",
                message: "That photo took too long to load. Please try again."
            } });
        }
        // Provider/network errors must not expose response URLs or tokens.
        if (!error.status || error.status >= 500) {
            return res.status(502).json({ error: {
                code: "GOOGLE_PHOTOS_UNAVAILABLE",
                message: "Google Photos is temporarily unavailable. Please try again."
            } });
        }
        // Existing middleware hides 5xx details, including provider errors.
        next(error);
    }
});

module.exports = router;
