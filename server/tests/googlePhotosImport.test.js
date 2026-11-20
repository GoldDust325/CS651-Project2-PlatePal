const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../index");

const selection = { sessionId: "picker-session", itemId: "picked-photo" };
const token = "google-test-token";
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const selectedPhoto = {
    id: selection.itemId,
    type: "PHOTO",
    mediaFile: {
        mimeType: "image/jpeg",
        baseUrl: "https://lh3.googleusercontent.com/p/selected-photo"
    }
};

function mockGoogle(t, { items = [selectedPhoto], bytes = jpeg } = {}) {
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
        calls.push({ url: String(url), options });
        return new URL(url).hostname === "photospicker.googleapis.com"
            ? Response.json({ mediaItems: items })
            : new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
    });
    return calls;
}

function importRequest(body = selection) {
    return request(app).post("/api/google-photos/import")
        .set("Authorization", `Bearer ${token}`)
        .set("Origin", "http://localhost:5173")
        .send(body);
}

test("photo import requires a separate Google bearer token", async () => {
    const result = await request(app).post("/api/google-photos/import").send(selection);
    assert.equal(result.status, 401);
    assert.equal(result.body.error.code, "GOOGLE_PHOTOS_UNAUTHORIZED");
    assert.equal(result.headers["cache-control"], "no-store");
});

test("photo import rejects invalid selection IDs before contacting Google", async t => {
    const calls = mockGoogle(t);
    const result = await importRequest({ ...selection, itemId: "" });
    assert.equal(result.status, 400);
    assert.equal(calls.length, 0);
});

test("photo import rejects an invalid thumbnail option", async t => {
    const calls = mockGoogle(t);
    const result = await importRequest({ ...selection, thumbnail: "true" });
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_THUMBNAIL_OPTION");
    assert.equal(calls.length, 0);
});

test("gallery thumbnails reuse BE-04 authorization and return image bytes", async t => {
    const calls = mockGoogle(t);
    const result = await importRequest({ ...selection, thumbnail: true });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, jpeg);
    assert.equal(result.headers["content-type"], "image/jpeg");
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["x-content-type-options"], "nosniff");
    assert.ok(calls[1].url.endsWith("=w320-h320"));
    assert.ok(calls.every(call => call.options.headers.Authorization === `Bearer ${token}`));
    assert.ok(calls.every(call => call.options.redirect === "error"));
    assert.ok(calls.every(call => !call.url.includes(token)));
});

test("choosing a gallery photo imports the normal BE-04 image rendition", async t => {
    const calls = mockGoogle(t);
    const result = await importRequest();
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, jpeg);
    assert.ok(calls[1].url.endsWith("=w2048-h2048"));
});

test("an unselected photo cannot be imported through the route", async t => {
    const calls = mockGoogle(t, { items: [] });
    const result = await importRequest();
    assert.equal(result.status, 404);
    assert.equal(result.body.error.code, "SELECTED_PHOTO_NOT_FOUND");
    assert.equal(calls.length, 1);
});

test("expired Google authorization is reported without private provider details", async t => {
    t.mock.method(globalThis, "fetch", async () => Response.json({
        error: { message: `private provider detail ${token}` }
    }, { status: 401 }));
    const result = await importRequest();
    assert.equal(result.status, 401);
    assert.ok(!JSON.stringify(result.body).includes(token));
    assert.ok(!JSON.stringify(result.body).includes("private provider"));
});

test("the import route retains the BE-04 image-signature check", async t => {
    mockGoogle(t, { bytes: Buffer.from("This is not a JPEG") });
    const result = await importRequest();
    assert.equal(result.status, 415);
    assert.equal(result.body.error.code, "INVALID_IMAGE_CONTENT");
});

test("the import route never forwards a Google token to an untrusted media URL", async t => {
    const calls = mockGoogle(t, { items: [{
        ...selectedPhoto,
        mediaFile: { ...selectedPhoto.mediaFile, baseUrl: "https://example.com/private" }
    }] });
    const result = await importRequest();
    assert.equal(result.status, 502);
    assert.equal(calls.length, 1);
    assert.ok(!JSON.stringify(result.body).includes(token));
});

test("Google transport failures are safe and recoverable", async t => {
    t.mock.method(globalThis, "fetch", async () => {
        throw new Error(`private network detail ${token}`);
    });
    const result = await importRequest();
    assert.equal(result.status, 502);
    assert.equal(result.body.error.code, "GOOGLE_PHOTOS_UNAVAILABLE");
    assert.ok(!JSON.stringify(result.body).includes(token));
});

test("thumbnail size limits do not reduce the normal image-import limit", async t => {
    const bytes = Buffer.alloc(1024 * 1024 + 1);
    jpeg.copy(bytes);
    mockGoogle(t, { bytes });
    const thumbnail = await importRequest({ ...selection, thumbnail: true });
    assert.equal(thumbnail.status, 413);
    const fullImage = await importRequest();
    assert.equal(fullImage.status, 200);
    assert.equal(fullImage.body.length, bytes.length);
});
