
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const analysisSchema = require("../schemas/analysis.schema.json");

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validateAnalysisResponse = ajv.compile({
  $ref: "#/definitions/analysisResponse",
  definitions: analysisSchema.definitions
});


// The ADK service allows up to 110 seconds (ADK_DEADLINE_SECONDS) for
// identification plus coaching, so Express must wait slightly longer.
const DEFAULT_TIMEOUT_MS = 120000;

class AdkClientError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AdkClientError";
    this.status = status;
  }
}

async function analyzeMeal(analysisRequest, options = {}) {
  const serviceUrl = process.env.ADK_SERVICE_URL;

  if (!serviceUrl) {
    throw new AdkClientError(
      "ADK service URL is not configured",
      503
    );
  }

  const controller = new AbortController();
  const timeoutMs = Number(
    process.env.ADK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS
  );

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  // AG-03 (#3): forward the signed-in user's Firebase token so the ADK
  // history tools can read only that user's meals through GET /api/meals.
  const headers = { "Content-Type": "application/json" };

  if (
    typeof options.authorization === "string" &&
    /^Bearer \S+$/.test(options.authorization)
  ) {
    headers.Authorization = options.authorization;
  }

  try {
    const response = await fetch(serviceUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(analysisRequest),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new AdkClientError(
        "ADK service returned an error",
        502
      );
    }

    const data = await response.json();
if (!validateAnalysisResponse(data)) {
  throw new AdkClientError(
    "ADK response does not match BE-08 schema",
    502
  );
}


    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AdkClientError(
        "ADK service request timed out",
        504
      );
    }

    if (error instanceof AdkClientError) {
      throw error;
    }

    throw new AdkClientError(
      "Unable to communicate with ADK service"
    );
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  analyzeMeal,
  AdkClientError
};
