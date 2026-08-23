import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startTestServer, type TestServer } from "./helpers/server.ts";

const FALLBACK_LIMIT = 300;

describe("production SPA fallback", () => {
  let server: TestServer;

  before(async () => {
    server = await startTestServer({ NODE_ENV: "production" });
  });

  after(async () => server?.stop());

  it("serves index.html for a deep link", async () => {
    // Also guards the route pattern itself: Express 5 rejects a bare '*',
    // so this only passes with the '/*splat' form.
    const res = await fetch(`${server.baseUrl}/saved/dishes/tokyo`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="root">/);
  });

  it("serves real static assets straight from disk", async () => {
    const html = await (await fetch(`${server.baseUrl}/`)).text();
    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    assert.ok(asset, "no hashed JS bundle referenced by index.html");
    const res = await fetch(`${server.baseUrl}${asset}`);
    assert.equal(res.status, 200);
    assert.ok(!res.headers.has("ratelimit"), "static assets should not consume the fallback budget");
  });

  it("rate-limits the fallback route", async () => {
    const res = await fetch(`${server.baseUrl}/some/unmatched/path`);
    assert.ok(res.headers.has("ratelimit"), "fallback route is missing its rate limiter");
    assert.match(res.headers.get("ratelimit") ?? "", /limit=300/);
  });
});

describe("SPA fallback rate limit exhaustion", () => {
  let server: TestServer;

  before(async () => {
    // Fresh instance: the limiter counts per IP in memory and every other test
    // in this file would otherwise eat into the budget.
    server = await startTestServer({ NODE_ENV: "production" });
  });

  after(async () => server?.stop());

  it(`returns 429 after ${FALLBACK_LIMIT} requests in the window`, async () => {
    const statuses: number[] = [];
    for (let i = 0; i < FALLBACK_LIMIT + 1; i++) {
      const res = await fetch(`${server.baseUrl}/deep/link/${i}`);
      statuses.push(res.status);
      await res.arrayBuffer();
    }
    assert.equal(statuses[0], 200);
    assert.equal(statuses[FALLBACK_LIMIT - 1], 200, "limit reached too early");
    assert.equal(statuses[FALLBACK_LIMIT], 429, "request over the limit was not throttled");
  });
});
