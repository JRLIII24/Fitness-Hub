/**
 * Vitest config for API route and integration tests.
 *
 * Uses the Node.js environment (not jsdom) because:
 *   - API route handlers use Node.js globals (Request, Response, Headers)
 *   - Integration tests call real Supabase clients
 *   - Rate-limit module uses setInterval.unref() (Node.js-only)
 *
 * Run: pnpm vitest --config vitest.config.node.ts run
 *   or: pnpm test:api
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    // Longer timeout for integration tests that hit local Supabase
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Run integration tests serially to avoid DB state conflicts
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
