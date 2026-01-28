"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const taskResultConverters_1 = require("./taskResultConverters");
(0, globals_1.describe)("coerceBashToolResult", () => {
    (0, globals_1.it)("accepts legacy background results with only backgroundProcessId", () => {
        const result = (0, taskResultConverters_1.coerceBashToolResult)({
            success: true,
            output: "started",
            exitCode: 0,
            wall_duration_ms: 1,
            backgroundProcessId: "proc-123",
        });
        (0, globals_1.expect)(result).not.toBeNull();
        (0, globals_1.expect)(result).toMatchObject({
            success: true,
            backgroundProcessId: "proc-123",
            taskId: "bash:proc-123",
        });
    });
    (0, globals_1.it)("accepts legacy background results with only taskId", () => {
        const result = (0, taskResultConverters_1.coerceBashToolResult)({
            success: true,
            output: "started",
            exitCode: 0,
            wall_duration_ms: 1,
            taskId: "bash:proc-456",
        });
        (0, globals_1.expect)(result).not.toBeNull();
        (0, globals_1.expect)(result).toMatchObject({
            success: true,
            backgroundProcessId: "proc-456",
            taskId: "bash:proc-456",
        });
    });
    (0, globals_1.it)("rejects backgroundProcessId when not a string", () => {
        const result = (0, taskResultConverters_1.coerceBashToolResult)({
            success: true,
            output: "started",
            exitCode: 0,
            wall_duration_ms: 1,
            // legacy sessions should never do this; ensure we fail closed
            backgroundProcessId: 123,
        });
        (0, globals_1.expect)(result).toBeNull();
    });
});
//# sourceMappingURL=taskResultConverters.test.js.map