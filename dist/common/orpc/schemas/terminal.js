"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalResizeParamsSchema = exports.TerminalCreateParamsSchema = exports.TerminalSessionSchema = void 0;
const zod_1 = require("zod");
exports.TerminalSessionSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    workspaceId: zod_1.z.string(),
    cols: zod_1.z.number(),
    rows: zod_1.z.number(),
});
exports.TerminalCreateParamsSchema = zod_1.z.object({
    workspaceId: zod_1.z.string(),
    cols: zod_1.z.number(),
    rows: zod_1.z.number(),
    /** Optional command to run immediately after terminal creation */
    initialCommand: zod_1.z.string().optional(),
});
exports.TerminalResizeParamsSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    cols: zod_1.z.number(),
    rows: zod_1.z.number(),
});
//# sourceMappingURL=terminal.js.map