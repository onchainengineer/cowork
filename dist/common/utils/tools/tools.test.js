"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const tools_1 = require("./tools");
(0, bun_test_1.describe)("getToolsForModel", () => {
    (0, bun_test_1.test)("only includes agent_report when enableAgentReport=true", async () => {
        const runtime = new LocalRuntime_1.LocalRuntime(process.cwd());
        const initStateManager = {
            waitForInit: () => Promise.resolve(),
        };
        const toolsWithoutReport = await (0, tools_1.getToolsForModel)("noop:model", {
            cwd: process.cwd(),
            runtime,
            runtimeTempDir: "/tmp",
            enableAgentReport: false,
        }, "ws-1", initStateManager);
        (0, bun_test_1.expect)(toolsWithoutReport.agent_report).toBeUndefined();
        const toolsWithReport = await (0, tools_1.getToolsForModel)("noop:model", {
            cwd: process.cwd(),
            runtime,
            runtimeTempDir: "/tmp",
            enableAgentReport: true,
        }, "ws-1", initStateManager);
        (0, bun_test_1.expect)(toolsWithReport.agent_report).toBeDefined();
    });
});
//# sourceMappingURL=tools.test.js.map