
/*
 * PlatePal Project 2
 * BE-04: Google Photos Retrieval Tests
 * Developer: Michelle Golden
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    retrieveSelectedGooglePhoto
} = require("../services/googlePhotos");

test("BE-04 rejects a missing Google Photos access token", async () => {
    await assert.rejects(
        retrieveSelectedGooglePhoto({
            sessionId: "test-session",
            mediaItemId: "test-photo",
            accessToken: ""
        }),
        error => {
            assert.equal(error.status, 401);
            assert.equal(
                error.code,
                "GOOGLE_PHOTOS_AUTH_REQUIRED"
            );
            return true;
        }
    );
});

test("BE-04 rejects malformed Google Photos access tokens", async () => {
    await assert.rejects(
        retrieveSelectedGooglePhoto({
            sessionId: "test-session",
            mediaItemId: "test-photo",
            accessToken: "invalid token with spaces"
        }),
        error => {
            assert.equal(error.status, 401);
            assert.equal(
                error.code,
                "GOOGLE_PHOTOS_AUTH_REQUIRED"
            );
            return true;
        }
    );
});


test("BE-04 rejects a missing Picker session ID", async () => {
    await assert.rejects(
        retrieveSelectedGooglePhoto({
            sessionId: "",
            mediaItemId: "test-photo",
            accessToken: "mock-valid-token"
        }),
        error => {
            assert.equal(error.status, 400);
            assert.equal(
                error.code,
                "INVALID_PICKER_SESSION"
            );
            return true;
        }
    );
});


test("BE-04 rejects a missing selected photo ID", async () => {
    await assert.rejects(
        retrieveSelectedGooglePhoto({
            sessionId: "test-session",
            mediaItemId: "",
            accessToken: "mock-valid-token"
        }),
        error => {
            assert.equal(error.status, 400);
            assert.equal(
                error.code,
                "INVALID_MEDIA_ITEM_ID"
            );
            return true;
        }
    );
});


test("BE-04 rejects a photo not found in the Picker selection", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => {
        return new Response(
            JSON.stringify({
                mediaItems: [
                    {
                        id: "selected-photo-1",
                        type: "PHOTO"
                    }
                ]
            }),
            {
                status: 200,
                headers: {
                    "content-type": "application/json"
                }
            }
        );
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "different-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 404);
                assert.equal(
                    error.code,
                    "SELECTED_PHOTO_NOT_FOUND"
                );
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 searches additional Picker pages", async () => {
    const originalFetch = global.fetch;
    let requestCount = 0;

    global.fetch = async (url) => {
        requestCount++;

        const requestUrl = new URL(url);
        const pageToken = requestUrl.searchParams.get("pageToken");

        if (!pageToken) {
            return new Response(
                JSON.stringify({
                    mediaItems: [
                        { id: "first-photo", type: "PHOTO" }
                    ],
                    nextPageToken: "page-two"
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json"
                    }
                }
            );
        }

        return new Response(
            JSON.stringify({
                mediaItems: [
                    {
                        id: "selected-photo",
                        type: "VIDEO"
                    }
                ]
            }),
            {
                status: 200,
                headers: {
                    "content-type": "application/json"
                }
            }
        );
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "selected-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 415);
                assert.equal(
                    error.code,
                    "UNSUPPORTED_MEDIA_TYPE"
                );
                return true;
            }
        );

        assert.equal(requestCount, 2);
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 downloads an authorized selected photo", async () => {
    const originalFetch = global.fetch;
    const imageBytes = Buffer.from([
        0xff, 0xd8, 0xff, 0xd9
    ]);

    let requestCount = 0;

    global.fetch = async (url, options) => {
        requestCount++;

        assert.equal(
            options.headers.Authorization,
            "Bearer mock-valid-token"
        );
        assert.equal(options.redirect, "error");

        const requestUrl = new URL(url);

        if (requestUrl.hostname === "photospicker.googleapis.com") {
            return new Response(
                JSON.stringify({
                    mediaItems: [
                        {
                            id: "selected-photo",
                            type: "PHOTO",
                            mediaFile: {
                                mimeType: "image/jpeg",
                                baseUrl:
                                    "https://lh3.googleusercontent.com/test-photo"
                            }
                        }
                    ]
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json"
                    }
                }
            );
        }

        assert.equal(
            url,
            "https://lh3.googleusercontent.com/test-photo=w2048-h2048"
        );

        return new Response(imageBytes, {
            status: 200,
            headers: {
                "content-type": "image/jpeg"
            }
        });
    };

    try {
        const result = await retrieveSelectedGooglePhoto({
            sessionId: "test-session",
            mediaItemId: "selected-photo",
            accessToken: "mock-valid-token"
        });

        assert.deepEqual(result.buffer, imageBytes);
        assert.equal(result.mimetype, "image/jpeg");
        assert.equal(result.size, imageBytes.length);
        assert.equal(result.source, "google_photos");
        assert.equal(requestCount, 2);
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 rejects expired Google Photos authorization", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => {
        return new Response(null, {
            status: 401
        });
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "selected-photo",
                accessToken: "expired-mock-token"
            }),
            error => {
                assert.equal(error.status, 401);
                assert.equal(
                    error.code,
                    "GOOGLE_PHOTOS_AUTH_FAILED"
                );
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 rejects an oversized Google Photos download", async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
        const hostname = new URL(url).hostname;

        if (hostname === "photospicker.googleapis.com") {
            return new Response(
                JSON.stringify({
                    mediaItems: [{
                        id: "large-photo",
                        type: "PHOTO",
                        mediaFile: {
                            mimeType: "image/jpeg",
                            baseUrl:
                                "https://lh3.googleusercontent.com/large-photo"
                        }
                    }]
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json"
                    }
                }
            );
        }

        return new Response(
            Buffer.alloc(10 * 1024 * 1024 + 1),
            {
                status: 200,
                headers: {
                    "content-type": "image/jpeg"
                }
            }
        );
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "large-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 413);
                assert.equal(error.code, "PHOTO_TOO_LARGE");
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 rejects image content with an invalid signature", async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
        const hostname = new URL(url).hostname;

        if (hostname === "photospicker.googleapis.com") {
            return new Response(
                JSON.stringify({
                    mediaItems: [{
                        id: "fake-photo",
                        type: "PHOTO",
                        mediaFile: {
                            mimeType: "image/jpeg",
                            baseUrl:
                                "https://lh3.googleusercontent.com/fake-photo"
                        }
                    }]
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json"
                    }
                }
            );
        }

        return new Response(
            Buffer.from("This is not a JPEG image"),
            {
                status: 200,
                headers: {
                    "content-type": "image/jpeg"
                }
            }
        );
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "fake-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 415);
                assert.equal(error.code, "INVALID_IMAGE_CONTENT");
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 safely handles malformed media entries", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => {
        return new Response(
            JSON.stringify({
                mediaItems: [
                    null,
                    { id: "another-photo", type: "PHOTO" }
                ]
            }),
            {
                status: 200,
                headers: {
                    "content-type": "application/json"
                }
            }
        );
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "requested-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 404);
                assert.equal(
                    error.code,
                    "SELECTED_PHOTO_NOT_FOUND"
                );
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 safely handles a failed photo download", async () => {
    const originalFetch = global.fetch;
    let requestCount = 0;

    global.fetch = async (url) => {
        requestCount++;

        if (new URL(url).hostname === "photospicker.googleapis.com") {
            return new Response(
                JSON.stringify({
                    mediaItems: [{
                        id: "selected-photo",
                        type: "PHOTO",
                        mediaFile: {
                            mimeType: "image/jpeg",
                            baseUrl:
                                "https://lh3.googleusercontent.com/test-photo"
                        }
                    }]
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json"
                    }
                }
            );
        }

        return new Response(null, {
            status: 503
        });
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "selected-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 502);
                assert.equal(
                    error.code,
                    "GOOGLE_PHOTOS_DOWNLOAD_FAILED"
                );
                return true;
            }
        );

        assert.equal(requestCount, 2);
    } finally {
        global.fetch = originalFetch;
    }
});


test("BE-04 rejects an invalid Google Photos media list", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => {
        return new Response(
            JSON.stringify({
                mediaItems: "not-an-array"
            }),
            {
                status: 200,
                headers: {
                    "content-type": "application/json"
                }
            }
        );
    };

    try {
        await assert.rejects(
            retrieveSelectedGooglePhoto({
                sessionId: "test-session",
                mediaItemId: "selected-photo",
                accessToken: "mock-valid-token"
            }),
            error => {
                assert.equal(error.status, 502);
                assert.equal(
                    error.code,
                    "INVALID_GOOGLE_PHOTOS_RESPONSE"
                );
                return true;
            }
        );
    } finally {
        global.fetch = originalFetch;
    }
});
