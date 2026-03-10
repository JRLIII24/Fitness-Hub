/**
 * k6 Load Test: Supabase RPC Performance Under 500 VUs
 *
 * Targets:
 *   - get_nutrition_trends(p_user_id, p_days)
 *       Defined in: supabase/migrations/077_nutrition_trends_fts.sql
 *       Type: SECURITY DEFINER, LANGUAGE sql STABLE
 *       Hot path: SUM/GROUP BY on food_log with INTERVAL filter
 *
 *   - get_public_leaderboard(p_metric, p_period, p_limit)
 *       Defined in: supabase/migrations/077_public_leaderboard.sql
 *       Type: SECURITY DEFINER, LANGUAGE plpgsql
 *       Hot path: DENSE_RANK() window function + JOIN profiles × workout_sessions
 *
 * Why these matter:
 *   Both are SECURITY DEFINER — they run as the function owner, bypassing RLS.
 *   Under 500 VUs, lock contention on the workout_sessions table is the primary
 *   risk. If p95 latency exceeds 500ms, the 077_public_leaderboard.sql comment
 *   recommends a MATERIALIZED VIEW with pg_cron refresh.
 *
 * SLO thresholds:
 *   p95 < 500ms, p99 < 1000ms per RPC
 *   Error rate < 1%
 *
 * Setup:
 *   Install k6: brew install k6
 *   Run: k6 run tests/load/rpc-performance.js \
 *          -e SUPABASE_URL=https://your-project.supabase.co \
 *          -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *          -e TEST_USER_ID=uuid-of-seeded-test-user
 *
 * Note: Using service_role key because get_nutrition_trends takes p_user_id
 * as a parameter rather than reading auth.uid() — the SECURITY DEFINER
 * function handles its own data scoping.
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// ── Custom metrics (true = high-resolution timestamps for percentile calc) ──
const nutritionTrendsLatency = new Trend("nutrition_trends_latency_ms", true);
const leaderboardLatency = new Trend("leaderboard_latency_ms", true);
const rpcErrorRate = new Rate("rpc_error_rate");
const totalRpcRequests = new Counter("total_rpc_requests");

// ── Test configuration ──────────────────────────────────────────────────────
export const options = {
  scenarios: {
    /**
     * Scenario A: get_nutrition_trends
     * 500 VUs hammering for 30s — simulates peak post-workout nutrition log reads.
     * The STABLE annotation tells Postgres it's safe to cache the result within
     * a transaction; we verify this assumption holds under concurrency.
     */
    nutrition_trends: {
      executor: "constant-vus",
      vus: 500,
      duration: "30s",
      tags: { rpc: "nutrition_trends" },
      env: { ACTIVE_RPC: "nutrition_trends" },
    },

    /**
     * Scenario B: get_public_leaderboard
     * 500 VUs 35s after A — isolates leaderboard from nutrition load.
     * Rotates through all 9 metric+period combinations to exercise every
     * branch of the PL/pgSQL CASE statement.
     */
    public_leaderboard: {
      executor: "constant-vus",
      vus: 500,
      duration: "30s",
      startTime: "35s", // Sequential — avoids combined DB pressure in reports
      tags: { rpc: "public_leaderboard" },
      env: { ACTIVE_RPC: "public_leaderboard" },
    },
  },

  thresholds: {
    // Primary SLOs — test fails if these are breached
    "nutrition_trends_latency_ms": ["p(95)<500", "p(99)<1000"],
    "leaderboard_latency_ms": ["p(95)<500", "p(99)<1000"],
    "rpc_error_rate": ["rate<0.01"], // <1% error rate

    // HTTP-level failure guard (covers 4xx/5xx not caught by check())
    http_req_failed: ["rate<0.01"],
  },
};

// ── Environment ─────────────────────────────────────────────────────────────
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SERVICE_ROLE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY;
// A pre-seeded user ID with food_log data (nutrition_trends needs data to aggregate)
const TEST_USER_ID =
  __ENV.TEST_USER_ID ?? "00000000-0000-0000-0000-000000000001";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Required env vars missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
}

const HEADERS = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  // Prefer: return=minimal reduces response payload for leaderboard
  Prefer: "return=representation",
};

// ── RPC endpoint URLs ────────────────────────────────────────────────────────
const NUTRITION_TRENDS_URL = `${SUPABASE_URL}/rest/v1/rpc/get_nutrition_trends`;
const LEADERBOARD_URL = `${SUPABASE_URL}/rest/v1/rpc/get_public_leaderboard`;

// Cycle through all leaderboard variants to avoid hot-path caching bias
const LEADERBOARD_VARIANTS = [
  { p_metric: "volume", p_period: "weekly" },
  { p_metric: "volume", p_period: "monthly" },
  { p_metric: "volume", p_period: "all_time" },
  { p_metric: "consistency", p_period: "weekly" },
  { p_metric: "consistency", p_period: "monthly" },
  { p_metric: "consistency", p_period: "all_time" },
  { p_metric: "streak", p_period: "weekly" },
  { p_metric: "streak", p_period: "monthly" },
  { p_metric: "streak", p_period: "all_time" },
];

// ── VU logic ─────────────────────────────────────────────────────────────────
export default function () {
  const activeRpc = __ENV.ACTIVE_RPC ?? "nutrition_trends";

  if (activeRpc === "nutrition_trends") {
    group("get_nutrition_trends", () => {
      const start = Date.now();

      const res = http.post(
        NUTRITION_TRENDS_URL,
        JSON.stringify({
          p_user_id: TEST_USER_ID,
          p_days: 30,
        }),
        { headers: HEADERS }
      );

      const latencyMs = Date.now() - start;
      nutritionTrendsLatency.add(latencyMs);
      totalRpcRequests.add(1);

      const ok = check(res, {
        "status is 200": (r) => r.status === 200,
        "response is JSON array": (r) => {
          try {
            return Array.isArray(JSON.parse(r.body));
          } catch {
            return false;
          }
        },
        "latency under 500ms": () => latencyMs < 500,
      });

      if (!ok) {
        rpcErrorRate.add(1);
        console.error(
          `[nutrition_trends] FAIL status=${res.status} ` +
            `latency=${latencyMs}ms body=${String(res.body).substring(0, 300)}`
        );
      } else {
        rpcErrorRate.add(0);
      }
    });
  } else if (activeRpc === "public_leaderboard") {
    // Rotate variants deterministically per VU iteration
    const variant =
      LEADERBOARD_VARIANTS[
        Math.floor(Math.random() * LEADERBOARD_VARIANTS.length)
      ];

    group("get_public_leaderboard", () => {
      const start = Date.now();

      const res = http.post(
        LEADERBOARD_URL,
        JSON.stringify({ ...variant, p_limit: 50 }),
        { headers: HEADERS }
      );

      const latencyMs = Date.now() - start;
      leaderboardLatency.add(latencyMs);
      totalRpcRequests.add(1);

      const ok = check(res, {
        "status is 200": (r) => r.status === 200,
        "response is JSON array": (r) => {
          try {
            return Array.isArray(JSON.parse(r.body));
          } catch {
            return false;
          }
        },
        "first row has rank field": (r) => {
          try {
            const rows = JSON.parse(r.body);
            return rows.length === 0 || "rank" in rows[0];
          } catch {
            return false;
          }
        },
        "latency under 500ms": () => latencyMs < 500,
      });

      if (!ok) {
        rpcErrorRate.add(1);
        console.error(
          `[leaderboard] FAIL metric=${variant.p_metric} period=${variant.p_period} ` +
            `status=${res.status} latency=${latencyMs}ms`
        );
      } else {
        rpcErrorRate.add(0);
      }
    });
  }

  // Think time: prevents thundering-herd within each VU and approximates
  // realistic client behavior (mobile app reading data, then idle).
  sleep(0.1);
}

// ── Summary handler: write JSON report + console table ───────────────────────
export function handleSummary(data) {
  return {
    "tests/load/results/rpc-performance-summary.json": JSON.stringify(
      data,
      null,
      2
    ),
    stdout: textSummary(data, { indent: "  ", enableColors: true }),
  };
}
