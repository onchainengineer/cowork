"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./client");
describe("Telemetry client", () => {
    it("initTelemetry and shutdownTelemetry are no-ops", () => {
        // These are kept for API compatibility but do nothing
        expect(() => (0, client_1.initTelemetry)()).not.toThrow();
        expect(() => (0, client_1.shutdownTelemetry)()).not.toThrow();
    });
    it("trackEvent silently forwards to backend without throwing", () => {
        // In test environment, ORPC is not available, but trackEvent should not throw
        expect(() => {
            (0, client_1.trackEvent)({
                event: "workspace_switched",
                properties: {
                    fromWorkspaceId: "test-from",
                    toWorkspaceId: "test-to",
                },
            });
        }).not.toThrow();
    });
});
//# sourceMappingURL=client.test.js.map