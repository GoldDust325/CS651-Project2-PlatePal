
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  analyzeMeal,
  AdkClientError
} = require("../services/adkClient");

const fixtures = require("./analysis.fixtures.json");

const originalFetch = global.fetch;
const originalUrl = process.env.ADK_SERVICE_URL;
const originalTimeout = process.env.ADK_TIMEOUT_MS;

// Restore settings after every test
afterEach(() => {
  global.fetch = originalFetch;

  if (originalUrl === undefined) {
    delete process.env.ADK_SERVICE_URL;
  } else {
    process.env.ADK_SERVICE_URL = originalUrl;
  }

  if (originalTimeout === undefined) {
    delete process.env.ADK_TIMEOUT_MS;
  } else {
    process.env.ADK_TIMEOUT_MS = originalTimeout;
  }
});

// Test 1: Missing service URL
test("Reject missing ADK service URL", async () => {
  delete process.env.ADK_SERVICE_URL;

  await assert.rejects(
    analyzeMeal(fixtures.validPhotoOnlyRequest),
    (error) => error instanceof AdkClientError &&
               error.status === 503
  );
});

// Test 2: Successful ADK response
test("Accept successful ADK response", async () => {
  process.env.ADK_SERVICE_URL =
    "http://localhost:8000/analyze";

  global.fetch = async (url, options) => {
    assert.equal(url, process.env.ADK_SERVICE_URL);
    assert.equal(options.method, "POST");

    return {
      ok: true,
      json: async () => fixtures.validAnalysisResponse
    };
  };

  const result = await analyzeMeal(
    fixtures.validPhotoOnlyRequest
  );

  assert.equal(result.analysisId, "analysis-001");
});

// Test 3: ADK server returns an error
test("Handle ADK server error", async () => {
  process.env.ADK_SERVICE_URL =
    "http://localhost:8000/analyze";

  global.fetch = async () => ({
    ok: false,
    status: 500
  });

  await assert.rejects(
    analyzeMeal(fixtures.validPhotoOnlyRequest),
    (error) => error.status === 502
  );
});

// Test 4: Invalid ADK response
test("Reject invalid ADK response", async () => {
  process.env.ADK_SERVICE_URL =
    "http://localhost:8000/analyze";

  global.fetch = async () => ({
    ok: true,
    json: async () => null
  });

  await assert.rejects(
    analyzeMeal(fixtures.validPhotoOnlyRequest),
    (error) => error.status === 502
  );
});

// Test 5: Network connection failure
test("Handle ADK connection failure", async () => {
  process.env.ADK_SERVICE_URL =
    "http://localhost:8000/analyze";

  global.fetch = async () => {
    throw new Error("Connection refused");
  };

  await assert.rejects(
    analyzeMeal(fixtures.validPhotoOnlyRequest),
    (error) => error.status === 502
  );
});


test("Reject response that violates BE-08 schema", async () => {
  process.env.ADK_SERVICE_URL =
    "http://localhost:8000/analyze";

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      hello: "world"
    })
  });

  await assert.rejects(
    analyzeMeal(fixtures.validPhotoOnlyRequest),
    (error) =>
      error instanceof AdkClientError &&
      error.status === 502
  );
});


test("Handle ADK request timeout", async () => {
  process.env.ADK_SERVICE_URL =
    "http://localhost:8000/analyze";

  // Use a short timeout for testing
  process.env.ADK_TIMEOUT_MS = "25";

  // Simulate a server that never responds
  global.fetch = (url, { signal }) =>
    new Promise((resolve, reject) => {
      const onAbort = () => {
        const error = new Error("Request aborted");
        error.name = "AbortError";
        reject(error);
      };

      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, {
          once: true
        });
      }
    });

  await assert.rejects(
    analyzeMeal(fixtures.validPhotoOnlyRequest),
    (error) =>
      error instanceof AdkClientError &&
      error.status === 504
  );
});
