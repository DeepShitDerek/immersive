import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Required for React Testing Library's automatic DOM cleanup between
    // tests (it registers against the global afterEach).
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/**/*.test.ts"],
    /*
      Vitest defaults to 5s per test, which is generous for a unit test and
      tight for the integration ones: `settings-page.test.tsx` renders the whole
      settings page — a large form plus a live preview of the real site header
      and footer — nineteen times, and the slowest case takes ~860ms on an idle
      machine. Run alone the file passes in about six seconds; run inside the
      full suite, with every worker competing for the same cores, individual
      tests stretch past five and fail on the clock rather than on a claim.

      That failed three times during one session — twice as a timeout, once
      failing to collect the file at all — and passed alone and on re-run every
      time. A test that fails only when the machine is busy teaches people to
      re-run CI without reading it, which is worse than a slow suite.

      Fifteen seconds is still far short of a genuine hang: a test waiting on
      something that never resolves fails here, just later and unambiguously.
    */
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
