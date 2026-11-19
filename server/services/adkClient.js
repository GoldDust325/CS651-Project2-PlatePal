
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const analysisSchema = require("../schemas/analysis.schema.json");

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

const validateAnalysisResponse = ajv.compile({
  $ref: "#/definitions/analysisResponse",
  definitions: analysisSchema.definitions
});


const DEFAULT_TIMEOUT_MS = 30000;

class AdkClientError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AdkClientError";
    this.status = status;
  }
}

async function analyzeMeal(analysisRequest) {
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

  try {
    const response = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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
