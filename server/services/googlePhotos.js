/*
 * PlatePal Project 2
 * BE-04: Authorized Google Photos Retrieval
 * Developer: Michelle Golden
 */

const PICKER_API_BASE =
    "https://photospicker.googleapis.com/v1";

const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const MAX_IMAGE_SIZE =
    Number(process.env.MAX_IMAGE_SIZE_MB || 10) *
    1024 * 1024;

const REQUEST_TIMEOUT_MS = 15000;


function createGooglePhotosError(status, code, message) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
}

function validateAccessToken(accessToken) {
    if (
        typeof accessToken !== "string" ||
        accessToken.trim() === "" ||
        /\s/.test(accessToken)
    ) {
        throw createGooglePhotosError(
            401,
            "GOOGLE_PHOTOS_AUTH_REQUIRED",
            "Valid Google Photos authorization is required"
        );
    }

    return accessToken;
}


async function requestPickerApi(path, accessToken) {
    const token = validateAccessToken(accessToken);

    const url = new URL(`${PICKER_API_BASE}/${path}`);

    // Only communicate with the official Google Photos Picker API.
    if (
        url.origin !== "https://photospicker.googleapis.com" ||
        !url.pathname.startsWith("/v1/")
    ) {
        throw createGooglePhotosError(
            400,
            "INVALID_PICKER_PATH",
            "Invalid Google Photos Picker request"
        );
    }

    let response;

    try {
        response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            },
            redirect: "error",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
    } catch {
        throw createGooglePhotosError(
            502,
            "GOOGLE_PHOTOS_UNAVAILABLE",
            "Unable to contact Google Photos"
        );
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw createGooglePhotosError(
                401,
                "GOOGLE_PHOTOS_AUTH_FAILED",
                "Google Photos authorization is invalid or expired"
            );
        }

        throw createGooglePhotosError(
            502,
            "GOOGLE_PHOTOS_REQUEST_FAILED",
            "Google Photos could not complete the request"
        );
    }

    try {
        return await response.json();
    } catch {
        throw createGooglePhotosError(
            502,
            "INVALID_GOOGLE_PHOTOS_RESPONSE",
            "Google Photos returned an invalid response"
        );
    }
}

async function listPickerMediaPage(
    sessionId,
    accessToken,
    pageToken = null
) {
    if (
        typeof sessionId !== "string" ||
        sessionId.trim() === "" ||
        sessionId.length > 2048
    ) {
        throw createGooglePhotosError(
            400,
            "INVALID_PICKER_SESSION",
            "A valid Google Photos Picker session is required"
        );
    }

    const params = new URLSearchParams({
        sessionId,
        pageSize: "100"
    });

    if (pageToken !== null) {
        if (
            typeof pageToken !== "string" ||
            pageToken.trim() === ""
        ) {
            throw createGooglePhotosError(
                400,
                "INVALID_PAGE_TOKEN",
                "Invalid Google Photos page token"
            );
        }

        params.set("pageToken", pageToken);
    }

    const result = await requestPickerApi(
        `mediaItems?${params.toString()}`,
        accessToken
    );

    if (
        !result ||
        typeof result !== "object" ||
        (
    result.mediaItems !== undefined &&
    !Array.isArray(result.mediaItems)
)
    ) {
        throw createGooglePhotosError(
            502,
            "INVALID_GOOGLE_PHOTOS_RESPONSE",
            "Google Photos returned an invalid media list"
        );
    }

    return {
        mediaItems: result.mediaItems || [],
        nextPageToken: result.nextPageToken || null
    };
}


async function findSelectedMediaItem(
    sessionId,
    mediaItemId,
    accessToken
) {
    if (
        typeof mediaItemId !== "string" ||
        mediaItemId.trim() === "" ||
        mediaItemId.length > 2048
    ) {
        throw createGooglePhotosError(
            400,
            "INVALID_MEDIA_ITEM_ID",
            "A valid selected media item ID is required"
        );
    }

    let pageToken = null;
    const seenTokens = new Set();

    for (let page = 0; page < 100; page++) {
        const result = await listPickerMediaPage(
            sessionId,
            accessToken,
            pageToken
        );

        const selectedItem = result.mediaItems.find(
            item =>
                item !== null &&
                typeof item === "object" &&
                item.id === mediaItemId
        );


        if (selectedItem) {
            return selectedItem;
        }

        if (!result.nextPageToken) {
            break;
        }


        if (page === 99) {
            throw createGooglePhotosError(
                502,
                "GOOGLE_PHOTOS_PAGE_LIMIT",
                "Google Photos selection could not be fully checked"
            );
        }


        if (seenTokens.has(result.nextPageToken)) {
            throw createGooglePhotosError(
                502,
                "INVALID_GOOGLE_PHOTOS_RESPONSE",
                "Google Photos returned invalid pagination"
            );
        }

        seenTokens.add(result.nextPageToken);
        pageToken = result.nextPageToken;
    }

    throw createGooglePhotosError(
        404,
        "SELECTED_PHOTO_NOT_FOUND",
        "The requested photo was not found in the authorized selection"
    );
}


function validateSelectedPhoto(mediaItem) {
    if (
        !mediaItem ||
        typeof mediaItem !== "object" ||
        mediaItem.type !== "PHOTO"
    ) {
        throw createGooglePhotosError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "The selected media item must be a photo"
        );
    }

    const mediaFile = mediaItem.mediaFile;

    if (
        !mediaFile ||
        typeof mediaFile !== "object" ||
        !ALLOWED_IMAGE_TYPES.has(mediaFile.mimeType)
    ) {
        throw createGooglePhotosError(
            415,
            "UNSUPPORTED_IMAGE_FORMAT",
            "Only JPEG, PNG, and WebP photos are supported"
        );
    }

    if (
        typeof mediaFile.baseUrl !== "string" ||
        mediaFile.baseUrl.trim() === ""
    ) {
        throw createGooglePhotosError(
            502,
            "INVALID_GOOGLE_PHOTOS_RESPONSE",
            "Google Photos did not provide a valid media URL"
        );
    }

    return {
        id: mediaItem.id,
        mimeType: mediaFile.mimeType,
        baseUrl: mediaFile.baseUrl
    };
}


function buildPhotoDownloadUrl(baseUrl) {
    let url;

    try {
        url = new URL(baseUrl);
    } catch {
        throw createGooglePhotosError(
            502,
            "INVALID_GOOGLE_PHOTOS_URL",
            "Google Photos returned an invalid media URL"
        );
    }

    // Never send an OAuth token to an arbitrary destination.
    if (
        url.protocol !== "https:" ||
        url.hostname !== "lh3.googleusercontent.com" ||
        url.port !== "" ||
        url.username !== "" ||
        url.password !== "" ||
        url.search !== "" ||
        url.hash !== ""
    ) {
        throw createGooglePhotosError(
            502,
            "UNTRUSTED_GOOGLE_PHOTOS_URL",
            "Google Photos returned an untrusted media URL"
        );
    }

    // Request a bounded image resolution for meal analysis.
    return `${url.toString()}=w2048-h2048`;
}


function hasValidImageSignature(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) {
        return false;
    }

    if (mimeType === "image/jpeg") {
        return buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff;
    }

    if (mimeType === "image/png") {
        const signature = Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a
        ]);

        return buffer.length >= 8 &&
            buffer.subarray(0, 8).equals(signature);
    }

    if (mimeType === "image/webp") {
        return buffer.length >= 12 &&
            buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP";
    }

    return false;
}


async function downloadSelectedPhoto(photo, accessToken) {
    const token = validateAccessToken(accessToken);
    const url = buildPhotoDownloadUrl(photo.baseUrl);

    let response;

    try {
        response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "image/*"
            },
            redirect: "error",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
    } catch {
        throw createGooglePhotosError(
            502,
            "GOOGLE_PHOTOS_DOWNLOAD_FAILED",
            "Unable to download the selected photo"
        );
    }

    if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();

        throw createGooglePhotosError(
            401,
            "GOOGLE_PHOTOS_AUTH_FAILED",
            "Google Photos authorization is invalid or expired"
        );
    }

    if (!response.ok) {
        await response.body?.cancel();

        throw createGooglePhotosError(
            502,
            "GOOGLE_PHOTOS_DOWNLOAD_FAILED",
            "Google Photos could not provide the selected photo"
        );
    }

    const contentType = response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        ?.toLowerCase();

    if (
        !ALLOWED_IMAGE_TYPES.has(contentType) ||
        contentType !== photo.mimeType
    ) {
        await response.body?.cancel();

        throw createGooglePhotosError(
            415,
            "UNSUPPORTED_IMAGE_FORMAT",
            "The downloaded photo has an unsupported image format"
        );
    }

    const chunks = [];
    let totalBytes = 0;

    try {
        if (!response.body) {
            throw new Error("Missing response body");
        }

        for await (const chunk of response.body) {
            totalBytes += chunk.length;

            if (totalBytes > MAX_IMAGE_SIZE) {
                throw createGooglePhotosError(
                    413,
                    "PHOTO_TOO_LARGE",
                    "The selected photo exceeds the upload size limit"
                );
            }

            chunks.push(Buffer.from(chunk));
        }
    } catch (error) {
        if (error.code === "PHOTO_TOO_LARGE") {
            throw error;
        }

        throw createGooglePhotosError(
            502,
            "GOOGLE_PHOTOS_DOWNLOAD_FAILED",
            "The selected photo could not be downloaded"
        );
    }

    if (totalBytes === 0) {
        throw createGooglePhotosError(
            422,
            "EMPTY_GOOGLE_PHOTO",
            "The selected photo is empty"
        );
    }
    const imageBuffer = Buffer.concat(chunks);

    if (!hasValidImageSignature(imageBuffer, contentType)) {
        throw createGooglePhotosError(
            415,
            "INVALID_IMAGE_CONTENT",
            "The downloaded file is not a valid supported image"
    );
}

    return {
        buffer: imageBuffer,
        mimetype: contentType,
        size: totalBytes
    };
}


async function retrieveSelectedGooglePhoto({
    sessionId,
    mediaItemId,
    accessToken
}) {
    // Validate authorization before contacting Google.
    validateAccessToken(accessToken);

    // Confirm the requested image is in the authorized
    // Google Photos Picker selection.
    const mediaItem = await findSelectedMediaItem(
        sessionId,
        mediaItemId,
        accessToken
    );

    // Validate the selected item's metadata.
    const photo = validateSelectedPhoto(mediaItem);

    // Download and validate the image bytes.
    const downloaded = await downloadSelectedPhoto(
        photo,
        accessToken
    );

    return {
        ...downloaded,
        source: "google_photos"
    };
}

module.exports = {
    retrieveSelectedGooglePhoto
};
