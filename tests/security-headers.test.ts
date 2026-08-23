import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parseCsp, startTestServer, type TestServer } from "./helpers/server.ts";

/**
 * The exact connect-src allowlist the app needs. Asserted whole rather than
 * probed entry by entry, so an unintended *addition* fails the test too.
 */
const EXPECTED_CONNECT_SRC = [
  "'self'", // same-origin /api calls
  "https://*.googleapis.com", // Firebase auth (identitytoolkit, securetoken) + Firestore
  "wss://*.googleapis.com", // Firestore WebChannel transport
  "https://api.bigdatacloud.net", // "use my location" reverse geocoding
];

describe("production security headers", () => {
  let server: TestServer;
  let csp: Record<string, string[]>;
  let headers: Headers;

  before(async () => {
    server = await startTestServer({ NODE_ENV: "production" });
    const res = await fetch(`${server.baseUrl}/`);
    headers = res.headers;
    csp = parseCsp(res.headers.get("content-security-policy"));
  });

  after(async () => server?.stop());

  it("boots and serves the built SPA", async () => {
    const res = await fetch(`${server.baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="root">/);
  });

  it("sends a Content-Security-Policy instead of disabling it", () => {
    assert.ok(
      headers.get("content-security-policy"),
      "CSP header missing — helmet's contentSecurityPolicy must not be false",
    );
    assert.deepEqual(csp["default-src"], ["'self'"]);
  });

  it("allows Firebase anonymous auth, Firestore and the geocoder in connect-src", () => {
    // Regression guard: helmet's defaults have no connect-src, so it falls back
    // to `default-src 'self'`. That blocks signInAnonymously(), which leaves
    // userId null and permanently disables the Search button in App.tsx.
    assert.deepEqual(csp["connect-src"], EXPECTED_CONNECT_SRC);
  });

  it("locks script-src to 'self' in production", () => {
    // The built dist/index.html loads no inline script, so production needs
    // neither 'unsafe-inline' nor 'unsafe-eval'.
    assert.deepEqual(csp["script-src"], ["'self'"]);
  });

  it("keeps upgrade-insecure-requests in production", () => {
    assert.ok("upgrade-insecure-requests" in csp);
  });

  it("still applies the other helmet defaults", () => {
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.equal(headers.get("x-frame-options"), "SAMEORIGIN");
    assert.ok(headers.get("strict-transport-security"));
    assert.deepEqual(csp["object-src"], ["'none'"]);
    assert.deepEqual(csp["base-uri"], ["'self'"]);
  });
});

describe("development security headers", () => {
  let server: TestServer;
  let csp: Record<string, string[]>;

  before(async () => {
    server = await startTestServer({ NODE_ENV: "development" });
    const res = await fetch(`${server.baseUrl}/`);
    csp = parseCsp(res.headers.get("content-security-policy"));
  });

  after(async () => server?.stop());

  it("relaxes script-src so the Vite dev client and HMR work", () => {
    const scriptSrc = csp["script-src"] ?? [];
    assert.ok(scriptSrc.includes("'self'"));
    assert.ok(scriptSrc.includes("'unsafe-inline'"));
    assert.ok(scriptSrc.includes("'unsafe-eval'"));
  });

  it("allows the HMR websocket without dropping the app's own origins", () => {
    // Dev must add the websocket schemes on top of the production allowlist,
    // not narrow to them — Firebase is needed here too.
    assert.deepEqual(csp["connect-src"], [...EXPECTED_CONNECT_SRC, "ws:", "wss:"]);
  });

  it("drops upgrade-insecure-requests so http://localhost assets are not rewritten", () => {
    assert.ok(!("upgrade-insecure-requests" in csp));
  });
});
