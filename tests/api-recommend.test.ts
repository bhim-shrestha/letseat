import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { postRecommend, startTestServer, type TestServer } from "./helpers/server.ts";

const RECOMMEND_LIMIT = 20;

describe("POST /api/recommend input validation", () => {
  let server: TestServer;

  before(async () => {
    // A placeholder key gets past the credential check; validation short-circuits
    // long before anything reaches the network.
    server = await startTestServer({
      NODE_ENV: "production",
      GEMINI_API_KEY: "test-key-never-used",
    });
  });

  after(async () => server?.stop());

  it("rejects a missing city", async () => {
    const res = await postRecommend(server.baseUrl, {});
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /City is required/i);
  });

  it("rejects a non-string city", async () => {
    const res = await postRecommend(server.baseUrl, { city: { $ne: null } });
    assert.equal(res.status, 400);
  });

  it("rejects a city over 50 characters", async () => {
    const res = await postRecommend(server.baseUrl, { city: "a".repeat(51) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
  });

  it("accepts a 50-character city (boundary)", async () => {
    const res = await postRecommend(server.baseUrl, { city: "a".repeat(50) });
    assert.notEqual(res.status, 400);
  });

  for (const payload of [
    "<script>alert(1)</script>",
    "Tokyo; DROP TABLE users",
    "Paris | cat /etc/passwd",
    "Rome {{7*7}}",
    "Berlin\\..\\..\\etc",
    "Tokyo %s %d",
  ]) {
    it(`blocks injection-shaped input: ${payload}`, async () => {
      const res = await postRecommend(server.baseUrl, { city: payload });
      assert.equal(res.status, 400, `"${payload}" was not rejected`);
      assert.match((await res.json()).error, /Invalid characters/i);
    });
  }

  it("rejects a body larger than the 10kb JSON limit", async () => {
    const res = await postRecommend(server.baseUrl, { city: "Tokyo", pad: "x".repeat(11_000) });
    assert.equal(res.status, 413);
  });
});

describe("POST /api/recommend without credentials", () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer({ NODE_ENV: "production" });
  });

  after(async () => server?.stop());

  it("returns 401 when GEMINI_API_KEY is unset", async () => {
    const res = await postRecommend(server.baseUrl, { city: "Tokyo" });
    assert.equal(res.status, 401);
    assert.match((await res.json()).error, /GEMINI_API_KEY|DEMO_MODE/);
  });
});

describe("POST /api/recommend in demo mode", () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer({ NODE_ENV: "production", DEMO_MODE: "true" });
  });

  after(async () => server?.stop());

  it("returns a fully-formed recommendation payload with no API key", async () => {
    const res = await postRecommend(server.baseUrl, { city: "Tokyo" });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.demoMode, true);
    assert.equal(body.cityMeta.fullName, "Tokyo");
    assert.equal(body.recommendations.length, 3);

    for (const rec of body.recommendations) {
      for (const field of ["name", "description", "whyItFits", "searchQuery", "weight", "price"]) {
        assert.ok(rec[field], `recommendation is missing ${field}`);
      }
      assert.ok(["Light", "Medium", "Heavy"].includes(rec.weight));
      assert.equal(typeof rec.isVerified, "boolean");
    }
  });

  it("keys the response on the requested city", async () => {
    const body = await (await postRecommend(server.baseUrl, { city: "Lisbon" })).json();
    assert.equal(body.cityMeta.fullName, "Lisbon");
    assert.ok(body.recommendations.every((r: { name: string }) => r.name.includes("Lisbon")));
  });
});

describe("POST /api/recommend rate limiting", () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer({ NODE_ENV: "production", DEMO_MODE: "true" });
  });

  after(async () => server?.stop());

  it(`throttles after ${RECOMMEND_LIMIT} requests in the window`, async () => {
    const statuses: number[] = [];
    for (let i = 0; i < RECOMMEND_LIMIT + 1; i++) {
      const res = await postRecommend(server.baseUrl, { city: `City${i}` });
      statuses.push(res.status);
      await res.arrayBuffer();
    }
    assert.equal(statuses[RECOMMEND_LIMIT - 1], 200, "limit reached too early");
    assert.equal(statuses[RECOMMEND_LIMIT], 429, "request over the limit was not throttled");
  });
});
