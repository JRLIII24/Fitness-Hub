/**
 * Playwright E2E: Content-Security-Policy-Report-Only verification
 *
 * Verifies:
 *   1. The header is present on all /app/* document responses.
 *   2. The header contains a 'nonce-<value>' directive in script-src.
 *   3. Every <script nonce="..."> tag carries the SAME nonce that was embedded
 *      in the CSP header for that HTTP response.
 *
 * Why same-request nonce matters:
 *   src/middleware.ts generates crypto.randomUUID() per request, base64-encodes
 *   it, and does two things with it:
 *     a. Embeds it in the Content-Security-Policy-Report-Only response header
 *        as 'nonce-<value>' inside the script-src directive.
 *     b. Forwards it via the x-nonce request header so Server Components can
 *        inject it into <script nonce={nonce}> tags.
 *   If these values don't match, the browser reports a CSP violation for every
 *   inline script (even in report-only mode this is a sign of a broken nonce
 *   propagation chain).
 *
 * Prerequisites:
 *   - The app must be running at PLAYWRIGHT_BASE_URL (default: http://localhost:3000)
 *   - For /app/* routes: a pre-authenticated session (storageState) OR a test
 *     environment that bypasses auth. Configure via playwright.config.ts
 *     storageState option for the chromium project.
 *
 * Run: pnpm playwright test tests/e2e/csp-headers.spec.ts
 */
import { test, expect } from "@playwright/test";

// ── Routes that must carry the CSP header ─────────────────────────────────
// All go through src/middleware.ts (matcher: all except _next/static etc.)
const PROTECTED_ROUTES = ["/app", "/app/workout", "/app/nutrition"];

for (const route of PROTECTED_ROUTES) {
  test(`CSP-Report-Only header present and nonce is consistent on ${route}`, async ({
    page,
  }) => {
    let capturedNonce: string | null = null;
    let cspHeader: string | null = null;

    // Intercept the main document response to capture headers BEFORE the
    // page fully renders (avoids race conditions with JS execution).
    page.on("response", (response) => {
      const isMainDocument =
        response.request().resourceType() === "document" &&
        new URL(response.url()).pathname === route;

      if (isMainDocument) {
        cspHeader =
          response.headers()["content-security-policy-report-only"] ?? null;

        if (cspHeader) {
          // script-src 'nonce-<base64>' — extract the value between the quotes
          const match = cspHeader.match(/'nonce-([A-Za-z0-9+/=]+)'/);
          capturedNonce = match?.[1] ?? null;
        }
      }
    });

    await page.goto(route, { waitUntil: "domcontentloaded" });

    // ── Assertion 1: header is present ─────────────────────────────────────
    expect(
      cspHeader,
      `Content-Security-Policy-Report-Only must be set on ${route}`
    ).toBeTruthy();

    // ── Assertion 2: script-src contains a nonce directive ─────────────────
    expect(
      cspHeader,
      "CSP header must contain a nonce directive in script-src"
    ).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);

    // ── Assertion 3: nonce was successfully extracted ───────────────────────
    expect(
      capturedNonce,
      "Nonce value must be extractable from CSP header"
    ).toBeTruthy();

    // ── Assertion 4: all <script nonce="..."> tags match the CSP nonce ──────
    // Next.js injects nonce-bearing inline scripts for hydration bootstrapping
    const scriptNonces = await page.$$eval("script[nonce]", (scripts) =>
      scripts.map((s) => s.getAttribute("nonce"))
    );

    // At minimum one nonce-bearing script tag must be present
    expect(
      scriptNonces.length,
      "Expected at least one <script nonce='...'> injected by Next.js"
    ).toBeGreaterThan(0);

    // Every script nonce must match the nonce in the CSP header
    for (const scriptNonce of scriptNonces) {
      expect(
        scriptNonce,
        `<script nonce="${scriptNonce}"> does not match CSP nonce "${capturedNonce}"`
      ).toBe(capturedNonce);
    }

    // ── Assertion 5: nonce is non-trivially long (base64 of UUID hex) ──────
    // generateNonce() does: btoa(crypto.randomUUID().replace(/-/g, ''))
    // 32 hex chars → 32 bytes → base64 ≈ 44 chars
    expect(
      capturedNonce!.length,
      "Nonce should be at least 20 characters (base64-encoded UUID)"
    ).toBeGreaterThanOrEqual(20);
  });
}

// ── Negative test: static assets bypass middleware ─────────────────────────
test("CSP-Report-Only header is absent on _next/static assets", async ({
  request,
}) => {
  // _next/static is excluded from the middleware matcher in src/middleware.ts
  // Fetch any static asset path (may 404 but that's fine — we only check headers)
  const response = await request.get("/_next/static/chunks/main.js", {
    failOnStatusCode: false,
  });

  const csp = response.headers()["content-security-policy-report-only"];
  expect(
    csp,
    "_next/static assets must not carry the CSP header (middleware excluded)"
  ).toBeFalsy();
});

// ── Nonce uniqueness: two requests must get different nonces ───────────────
test("Each request generates a unique nonce (crypto.randomUUID per request)", async ({
  request,
}) => {
  // Use the request context (no browser session) — hits middleware but
  // renders the raw HTTP response. Any public route works here.
  const [res1, res2] = await Promise.all([
    request.get("/"),
    request.get("/"),
  ]);

  const csp1 = res1.headers()["content-security-policy-report-only"] ?? "";
  const csp2 = res2.headers()["content-security-policy-report-only"] ?? "";

  const nonce1 = csp1.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
  const nonce2 = csp2.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];

  // Both responses must have nonces
  expect(nonce1).toBeTruthy();
  expect(nonce2).toBeTruthy();

  // And they must be different (randomness check)
  expect(nonce1, "Two concurrent requests must not share the same nonce").not.toBe(
    nonce2
  );
});
