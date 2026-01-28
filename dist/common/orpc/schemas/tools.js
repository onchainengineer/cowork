"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTreeNodeSchema = exports.BashToolResultSchema = void 0;
const zod_1 = require("zod");
const ToolOutputUiOnlySchema = zod_1.z.object({
    ask_user_question: zod_1.z
        .object({
        questions: zod_1.z.array(zod_1.z.unknown()),
        answers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    })
        .optional(),
    file_edit: zod_1.z
        .object({
        diff: zod_1.z.string(),
    })
        .optional(),
    notify: zod_1.z
        .object({
        notifiedVia: zod_1.z.enum(["electron", "browser"]),
        workspaceId: zod_1.z.string().optional(),
    })
        .optional(),
});
const ToolOutputUiOnlyFieldSchema = {
    ui_only: ToolOutputUiOnlySchema.optional(),
};
exports.BashToolResultSchema = zod_1.z.discriminatedUnion("success", [
    zod_1.z
        .object({
        success: zod_1.z.literal(true),
        wall_duration_ms: zod_1.z.number(),
        output: zod_1.z.string(),
        exitCode: zod_1.z.literal(0),
        note: zod_1.z.string().optional(),
        truncated: zod_1.z
            .object({
            reason: zod_1.z.string(),
            totalLines: zod_1.z.number(),
        })
            .optional(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
    zod_1.z
        .object({
        success: zod_1.z.literal(false),
        wall_duration_ms: zod_1.z.number(),
        output: zod_1.z.string().optional(),
        exitCode: zod_1.z.number(),
        error: zod_1.z.string(),
        note: zod_1.z.string().optional(),
        truncated: zod_1.z
            .object({
            reason: zod_1.z.string(),
            totalLines: zod_1.z.number(),
        })
            .optional(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
]);
exports.FileTreeNodeSchema = zod_1.z.object({
    name: zod_1.z.string(),
    path: zod_1.z.string(),
    isDirectory: zod_1.z.boolean(),
    get children() {
        return zod_1.z.array(exports.FileTreeNodeSchema);
    },
    /** Whether this file/directory is gitignored */
    ignored: zod_1.z.boolean().optional(),
    stats: zod_1.z
        .object({
        filePath: zod_1.z.string(),
        additions: zod_1.z.number(),
        deletions: zod_1.z.number(),
    })
        .optional(),
    totalStats: zod_1.z
        .object({
        filePath: zod_1.z.string(),
        additions: zod_1.z.number(),
        deletions: zod_1.z.number(),
    })
        .optional(),
});
//# sourceMappingURL=tools.js.map