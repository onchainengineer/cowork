"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const runtime_1 = require("./runtime");
const runtime_2 = require("../../../common/types/runtime");
(0, bun_test_1.describe)("RuntimeAvailabilityStatusSchema", () => {
    (0, bun_test_1.test)("preserves configs field when parsing devcontainer availability", () => {
        const input = {
            available: true,
            configs: [
                { path: ".devcontainer/devcontainer.json", label: "Default" },
                { path: ".devcontainer/backend/devcontainer.json", label: "Backend" },
            ],
            cliVersion: "0.81.1",
        };
        const result = runtime_1.RuntimeAvailabilityStatusSchema.parse(input);
        (0, bun_test_1.expect)(result.available).toBe(true);
        (0, bun_test_1.expect)("configs" in result).toBe(true);
        if ("configs" in result) {
            (0, bun_test_1.expect)(result.configs).toHaveLength(2);
            (0, bun_test_1.expect)(result.configs[0].path).toBe(".devcontainer/devcontainer.json");
            (0, bun_test_1.expect)(result.configs[1].path).toBe(".devcontainer/backend/devcontainer.json");
        }
        (0, bun_test_1.expect)("cliVersion" in result && result.cliVersion).toBe("0.81.1");
    });
    (0, bun_test_1.test)("parses plain available status without configs", () => {
        const input = { available: true };
        const result = runtime_1.RuntimeAvailabilityStatusSchema.parse(input);
        (0, bun_test_1.expect)(result.available).toBe(true);
        (0, bun_test_1.expect)("configs" in result).toBe(false);
    });
    (0, bun_test_1.test)("parses unavailable status with reason", () => {
        const input = { available: false, reason: "Docker daemon not running" };
        const result = runtime_1.RuntimeAvailabilityStatusSchema.parse(input);
        (0, bun_test_1.expect)(result.available).toBe(false);
        if (!result.available) {
            (0, bun_test_1.expect)(result.reason).toBe("Docker daemon not running");
        }
    });
});
(0, bun_test_1.describe)("getDevcontainerConfigs", () => {
    (0, bun_test_1.test)("extracts configs from availability status with configs", () => {
        const status = {
            available: true,
            configs: [
                { path: ".devcontainer/devcontainer.json", label: "Default" },
                { path: ".devcontainer/backend/devcontainer.json", label: "Backend" },
            ],
            cliVersion: "0.81.1",
        };
        const configs = (0, runtime_2.getDevcontainerConfigs)(status);
        (0, bun_test_1.expect)(configs).toHaveLength(2);
        (0, bun_test_1.expect)(configs[0].path).toBe(".devcontainer/devcontainer.json");
    });
    (0, bun_test_1.test)("returns empty array for plain available status", () => {
        const status = { available: true };
        const configs = (0, runtime_2.getDevcontainerConfigs)(status);
        (0, bun_test_1.expect)(configs).toEqual([]);
    });
    (0, bun_test_1.test)("returns empty array for unavailable status", () => {
        const status = {
            available: false,
            reason: "No devcontainer.json found",
        };
        const configs = (0, runtime_2.getDevcontainerConfigs)(status);
        (0, bun_test_1.expect)(configs).toEqual([]);
    });
});
//# sourceMappingURL=runtime.test.js.map