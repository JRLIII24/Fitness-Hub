/**
 * Next.js Edge Middleware
 *
 * Responsibilities:
 *  1. Supabase session refresh (cookie hygiene via updateSession)
 *  2. Content-Security-Policy in REPORT-ONLY mode
 *     - No requests are blocked today; violations are logged to /_csp-report
 *     - Once the violation report stream is clean, flip to enforcement by
 *       renaming the header to "Content-Security-Policy"
 *  3. Per-request nonce forwarded to Server Components via the x-nonce header
 *     so that inline <script> tags can be whitelisted without 'unsafe-inline'
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ---------------------------------------------------------------------------
// Nonce helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random, base64-encoded nonce.
 * A fresh nonce is produced for every request so it cannot be predicted or
 * replayed by an attacker who observed a previous response.
 */
function generateNonce(): string {
  // crypto.randomUUID() is available in the Edge runtime (no Node.js crypto import needed)
  const raw = crypto.randomUUID().replace(/-/g, ""); // 32 hex chars
  return btoa(raw); // base64-encode → ~44 chars, URL-safe enough for CSP
}

// ---------------------------------------------------------------------------
// CSP builder
// ---------------------------------------------------------------------------

/**
 * Build the Content-Security-Policy string for a given nonce.
 *
 * HOW TO READ THE DIRECTIVES:
 *  default-src   — baseline: block everything not explicitly allowed
 *  script-src    — allow same-origin scripts + this request's nonce.
 *                  'strict-dynamic' lets nonce-trusted scripts load further
 *                  scripts dynamically (needed by Next.js chunk loader).
 *                  'unsafe-eval' is included here only because Next.js dev
 *                  mode uses eval(); REMOVE it before flipping to enforce.
 *  style-src     — 'unsafe-inline' required for Tailwind's runtime styles.
 *                  Target: replace with a nonce once CSS-in-JS is audited.
 *  img-src       — allow data: URIs (base64 previews), blob: (canvas output),
 *                  and any https: host (Supabase Storage, CDN images).
 *  font-src      — same-origin fonts only (no Google Fonts CDN today).
 *  connect-src   — allow XHR/fetch/WebSocket to:
 *                    * same origin
 *                    * Supabase project REST + Realtime WS endpoints
 *                    * Sentry tunnel route (proxied, so it hits /monitoring)
 *                    * localhost during development
 *  media-src     — allow blob: for in-browser video previews (form-check)
 *  frame-src     — disallow iframes entirely (no embeds in the app)
 *  frame-ancestors — prevents this page from being framed (clickjacking guard)
 *  object-src    — block Flash/plugins unconditionally
 *  base-uri      — prevent <base> tag injection attacks
 *  form-action   — only allow form submissions to same origin
 *  report-uri    — CSP violation POSTs land here for logging (report-only only)
 */
function buildCsp(nonce: string): string {
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : "";

  // Realtime WebSocket endpoint uses wss:// protocol
  const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : "";

  const directives: Record<string, string> = {
    "default-src": "'self'",

    // 'strict-dynamic' allows Next.js to load its own chunked scripts after
    // the nonce-trusted bootstrap. 'unsafe-eval' only needed in dev.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Remove 'unsafe-eval' once you verify your prod build doesn't need it
      process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "",
    ]
      .filter(Boolean)
      .join(" "),

    // Tailwind injects inline styles; swap for nonce after CSS audit
    "style-src": "'self' 'unsafe-inline'",

    // Allow data: for base64 previews, blob: for canvas, https: for CDN
    "img-src": "'self' data: blob: https:",

    "font-src": "'self'",

    "connect-src": [
      "'self'",
      // Supabase REST + Auth endpoints
      supabaseHost ? `https://${supabaseHost}` : "",
      // Supabase Realtime WebSocket
      supabaseWs,
      // Sentry is tunnelled through our own domain — no external host needed
      // (the /monitoring tunnel route is same-origin)
      // Allow localhost variants for local development
      process.env.NODE_ENV === "development"
        ? "http://localhost:* ws://localhost:*"
        : "",
    ]
      .filter(Boolean)
      .join(" "),

    // blob: needed for form-check video previews
    "media-src": "'self' blob:",

    // No iframes used in the app
    "frame-src": "'none'",

    // Prevent this page from being embedded in a frame on another origin
    "frame-ancestors": "'none'",

    // Block Flash, Java applets, and other plugins unconditionally
    "object-src": "'none'",

    // Prevent <base href="https://attacker.com"> injection
    "base-uri": "'self'",

    // Only allow form POSTs back to same origin
    "form-action": "'self'",

    // Violation reports are collected here while in report-only mode.
    // Wire up a POST /api/csp-report route (or log to Sentry) to consume them.
    "report-uri": "/_csp-report",
  };

  return Object.entries(directives)
    .map(([key, value]) => `${key} ${value}`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  // 1. Let Supabase handle cookie-based session refresh first.
  //    updateSession() may rewrite the response to set new cookies.
  const response = await updateSession(request);

  // 2. Generate a fresh nonce for this request.
  const nonce = generateNonce();

  // 3. Attach CSP as report-only so no traffic is blocked.
  //    Once violation reports are clean, change this header name to:
  //      "Content-Security-Policy"
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    buildCsp(nonce),
  );

  // 4. Forward the nonce to Server Components via a request header.
  //    Server Components can read it with:
  //      import { headers } from "next/headers"
  //      const nonce = (await headers()).get("x-nonce") ?? ""
  //    and inject it into <script nonce={nonce}> tags.
  //
  //    Note: this header is set on the *request* (not the response) so that
  //    Next.js Server Components can read it via next/headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Propagate the modified request headers downstream.
  // We clone the response and attach the updated inbound headers.
  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Copy the CSP header we set on `response` (from updateSession) onto the
  // final response that Next.js will actually send to the browser.
  finalResponse.headers.set(
    "Content-Security-Policy-Report-Only",
    response.headers.get("Content-Security-Policy-Report-Only") ?? buildCsp(nonce),
  );

  // Copy any Set-Cookie headers that updateSession wrote (session refresh)
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      finalResponse.headers.append("set-cookie", value);
    }
  });

  return finalResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
