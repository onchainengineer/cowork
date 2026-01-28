"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const telemetryService_1 = require("./telemetryService");
function createContext(overrides) {
    return {
        env: overrides.env ?? {},
        isElectron: overrides.isElectron ?? false,
        isPackaged: overrides.isPackaged ?? null,
    };
}
(0, bun_test_1.describe)("TelemetryService enablement", () => {
    (0, bun_test_1.test)("disables telemetry when explicitly disabled", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: { UNIX_DISABLE_TELEMETRY: "1" },
            isElectron: true,
            isPackaged: true,
        }));
        (0, bun_test_1.expect)(enabled).toBe(false);
    });
    (0, bun_test_1.test)("disables telemetry in E2E runs", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: { UNIX_E2E: "1" },
            isElectron: true,
            isPackaged: true,
        }));
        (0, bun_test_1.expect)(enabled).toBe(false);
    });
    (0, bun_test_1.test)("disables telemetry in test environments", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: { NODE_ENV: "test" },
            isElectron: true,
            isPackaged: true,
        }));
        (0, bun_test_1.expect)(enabled).toBe(false);
    });
    (0, bun_test_1.test)("disables telemetry in CI environments", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: { CI: "true" },
            isElectron: true,
            isPackaged: true,
        }));
        (0, bun_test_1.expect)(enabled).toBe(false);
    });
    (0, bun_test_1.test)("enables telemetry in unpackaged Electron by default", () => {
        // Telemetry is now enabled by default in dev mode (unpackaged Electron)
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: {},
            isElectron: true,
            isPackaged: false,
        }));
        (0, bun_test_1.expect)(enabled).toBe(true);
    });
    (0, bun_test_1.test)("enables telemetry in packaged Electron by default", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: {},
            isElectron: true,
            isPackaged: true,
        }));
        (0, bun_test_1.expect)(enabled).toBe(true);
    });
    (0, bun_test_1.test)("enables telemetry in NODE_ENV=development by default", () => {
        // Telemetry is now enabled by default in dev mode
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: { NODE_ENV: "development" },
            isElectron: false,
        }));
        (0, bun_test_1.expect)(enabled).toBe(true);
    });
    (0, bun_test_1.test)("allows opting into telemetry in unpackaged Electron", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: { UNIX_ENABLE_TELEMETRY_IN_DEV: "1" },
            isElectron: true,
            isPackaged: false,
        }));
        (0, bun_test_1.expect)(enabled).toBe(true);
    });
    (0, bun_test_1.test)("dev opt-in does not bypass test env disable", () => {
        const enabled = (0, telemetryService_1.shouldEnableTelemetry)(createContext({
            env: {
                NODE_ENV: "test",
                UNIX_ENABLE_TELEMETRY_IN_DEV: "1",
            },
            isElectron: false,
        }));
        (0, bun_test_1.expect)(enabled).toBe(false);
    });
});
//# sourceMappingURL=telemetryService.test.js.map