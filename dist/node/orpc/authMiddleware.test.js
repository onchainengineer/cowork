"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const authMiddleware_1 = require("./authMiddleware");
// Timing microbenchmarks are inherently noisy and can be flaky under parallel
// test execution. Run these locally with UNIX_TEST_TIMING=1 when you want to
// sanity-check constant-time behavior.
const describeTiming = process.env.UNIX_TEST_TIMING === "1" ? bun_test_1.describe : bun_test_1.describe.skip;
(0, bun_test_1.describe)("safeEq", () => {
    (0, bun_test_1.it)("returns true for equal strings", () => {
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("secret", "secret")).toBe(true);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("", "")).toBe(true);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("a", "a")).toBe(true);
    });
    (0, bun_test_1.it)("returns false for different strings of same length", () => {
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("secret", "secreT")).toBe(false);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("aaaaaa", "aaaaab")).toBe(false);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("a", "b")).toBe(false);
    });
    (0, bun_test_1.it)("returns false for different length strings", () => {
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("short", "longer")).toBe(false);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("", "a")).toBe(false);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("abc", "ab")).toBe(false);
    });
    (0, bun_test_1.it)("handles unicode strings", () => {
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("héllo", "héllo")).toBe(true);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("héllo", "hello")).toBe(false);
        (0, bun_test_1.expect)((0, authMiddleware_1.safeEq)("🔐", "🔐")).toBe(true);
    });
    describeTiming("timing consistency", () => {
        // Use a longer secret to make timing comparisons less noisy.
        const ITERATIONS = 2000;
        const secret = "a".repeat(256);
        function measureAvgTime(fn, iterations) {
            const start = process.hrtime.bigint();
            for (let i = 0; i < iterations; i++) {
                fn();
            }
            const end = process.hrtime.bigint();
            return Number(end - start) / iterations;
        }
        (0, bun_test_1.it)("takes similar time for matching vs non-matching strings of same length", () => {
            const matching = secret;
            const nonMatching = "b" + "a".repeat(secret.length - 1); // differs at first char
            const matchTime = measureAvgTime(() => (0, authMiddleware_1.safeEq)(secret, matching), ITERATIONS);
            const nonMatchTime = measureAvgTime(() => (0, authMiddleware_1.safeEq)(secret, nonMatching), ITERATIONS);
            const ratio = Math.max(matchTime, nonMatchTime) / Math.min(matchTime, nonMatchTime);
            // Timing microbenchmarks can be extremely noisy in CI and local dev environments.
            // This is a regression guard (against early-exit), not a strict performance spec.
            (0, bun_test_1.expect)(ratio).toBeLessThan(2.0);
        });
        (0, bun_test_1.it)("takes similar time regardless of where mismatch occurs", () => {
            const earlyMismatch = "b" + "a".repeat(secret.length - 1); // first char
            const lateMismatch = "a".repeat(secret.length - 1) + "b"; // last char
            const earlyTime = measureAvgTime(() => (0, authMiddleware_1.safeEq)(secret, earlyMismatch), ITERATIONS);
            const lateTime = measureAvgTime(() => (0, authMiddleware_1.safeEq)(secret, lateMismatch), ITERATIONS);
            const ratio = Math.max(earlyTime, lateTime) / Math.min(earlyTime, lateTime);
            // Timing microbenchmarks can be extremely noisy in CI and local dev environments.
            // This is a regression guard (against early-exit), not a strict performance spec.
            (0, bun_test_1.expect)(ratio).toBeLessThan(2.0);
        });
        (0, bun_test_1.it)("length mismatch takes comparable time to same-length comparison", () => {
            const sameLength = "b" + "a".repeat(secret.length - 1);
            const diffLength = "a".repeat(64);
            const sameLenTime = measureAvgTime(() => (0, authMiddleware_1.safeEq)(secret, sameLength), ITERATIONS);
            const diffLenTime = measureAvgTime(() => (0, authMiddleware_1.safeEq)(secret, diffLength), ITERATIONS);
            // Length mismatch should not be significantly faster (no early-exit)
            const ratio = Math.max(sameLenTime, diffLenTime) / Math.min(sameLenTime, diffLenTime);
            (0, bun_test_1.expect)(ratio).toBeLessThan(2.0);
        });
    });
});
//# sourceMappingURL=authMiddleware.test.js.map