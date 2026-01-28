"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentSkillReadFileTool = void 0;
const unixChat_1 = require("../../../common/constants/unixChat");
const builtInSkillDefinitions_1 = require("../../../node/services/agentSkills/builtInSkillDefinitions");
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const schemas_1 = require("../../../common/orpc/schemas");
const agentSkillsService_1 = require("../../../node/services/agentSkills/agentSkillsService");
const fileCommon_1 = require("../../../node/services/tools/fileCommon");
const builtInSkillDefinitions_2 = require("../../../node/services/agentSkills/builtInSkillDefinitions");
const Runtime_1 = require("../../../node/runtime/Runtime");
const helpers_1 = require("../../../node/utils/runtime/helpers");
function readContentWithFileReadLimits(input) {
    if (input.fileSize > fileCommon_1.MAX_FILE_SIZE) {
        const sizeMB = (input.fileSize / (1024 * 1024)).toFixed(2);
        const maxMB = (fileCommon_1.MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);
        return {
            success: false,
            error: `File is too large (${sizeMB}MB). Maximum supported size is ${maxMB}MB.`,
        };
    }
    const lines = input.fullContent === "" ? [] : input.fullContent.split("\n");
    if (input.offset !== undefined && input.offset > lines.length) {
        return {
            success: false,
            error: `Offset ${input.offset} is beyond file length`,
        };
    }
    const startLineNumber = input.offset ?? 1;
    const startIdx = startLineNumber - 1;
    const endIdx = input.limit !== undefined ? startIdx + input.limit : lines.length;
    const numberedLines = [];
    let totalBytesAccumulated = 0;
    const MAX_LINE_BYTES = 1024;
    const MAX_LINES = 1000;
    const MAX_TOTAL_BYTES = 16 * 1024; // 16KB
    for (let i = startIdx; i < Math.min(endIdx, lines.length); i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        let processedLine = line;
        const lineBytes = Buffer.byteLength(line, "utf-8");
        if (lineBytes > MAX_LINE_BYTES) {
            processedLine = Buffer.from(line, "utf-8").subarray(0, MAX_LINE_BYTES).toString("utf-8");
            processedLine += "... [truncated]";
        }
        const numberedLine = `${lineNumber}\t${processedLine}`;
        const numberedLineBytes = Buffer.byteLength(numberedLine, "utf-8");
        if (totalBytesAccumulated + numberedLineBytes > MAX_TOTAL_BYTES) {
            return {
                success: false,
                error: `Output would exceed ${MAX_TOTAL_BYTES} bytes. Please read less at a time using offset and limit parameters.`,
            };
        }
        numberedLines.push(numberedLine);
        totalBytesAccumulated += numberedLineBytes + 1;
        if (numberedLines.length > MAX_LINES) {
            return {
                success: false,
                error: `Output would exceed ${MAX_LINES} lines. Please read less at a time using offset and limit parameters.`,
            };
        }
    }
    return {
        success: true,
        file_size: input.fileSize,
        modifiedTime: input.modifiedTime,
        lines_read: numberedLines.length,
        content: numberedLines.join("\n"),
    };
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * Agent Skill read_file tool factory.
 * Reads a file within a skill directory with the same output limits as file_read.
 */
const createAgentSkillReadFileTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.agent_skill_read_file.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.agent_skill_read_file.schema,
        execute: async ({ name, filePath, offset, limit }) => {
            const workspacePath = config.cwd;
            if (!workspacePath) {
                return {
                    success: false,
                    error: "Tool misconfigured: cwd is required.",
                };
            }
            // Defensive: validate again even though inputSchema should guarantee shape.
            const parsedName = schemas_1.SkillNameSchema.safeParse(name);
            if (!parsedName.success) {
                return {
                    success: false,
                    error: parsedName.error.message,
                };
            }
            try {
                if (offset !== undefined && offset < 1) {
                    return {
                        success: false,
                        error: `Offset must be positive (got ${offset})`,
                    };
                }
                // Chat with Unix intentionally has no generic filesystem access. Restrict skill file reads
                // to built-in skills (bundled in the app) so users can access help like `unix-docs` without
                // granting access to project/global skills on disk.
                if (config.workspaceId === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID) {
                    const builtInSkill = (0, builtInSkillDefinitions_1.getBuiltInSkillByName)(parsedName.data);
                    if (!builtInSkill) {
                        return {
                            success: false,
                            error: `Only built-in skills are available in Chat with Unix (requested: ${parsedName.data}).`,
                        };
                    }
                    const builtIn = (0, builtInSkillDefinitions_2.readBuiltInSkillFile)(parsedName.data, filePath);
                    return readContentWithFileReadLimits({
                        fullContent: builtIn.content,
                        fileSize: Buffer.byteLength(builtIn.content, "utf-8"),
                        modifiedTime: new Date(0).toISOString(),
                        offset,
                        limit,
                    });
                }
                const resolvedSkill = await (0, agentSkillsService_1.readAgentSkill)(config.runtime, workspacePath, parsedName.data);
                // Built-in skills are embedded in the app bundle (no filesystem access).
                if (resolvedSkill.package.scope === "built-in") {
                    const builtIn = (0, builtInSkillDefinitions_2.readBuiltInSkillFile)(parsedName.data, filePath);
                    return readContentWithFileReadLimits({
                        fullContent: builtIn.content,
                        fileSize: Buffer.byteLength(builtIn.content, "utf-8"),
                        modifiedTime: new Date(0).toISOString(),
                        offset,
                        limit,
                    });
                }
                const targetPath = (0, agentSkillsService_1.resolveAgentSkillFilePath)(config.runtime, resolvedSkill.skillDir, filePath);
                let stat;
                try {
                    stat = await config.runtime.stat(targetPath);
                }
                catch (err) {
                    if (err instanceof Runtime_1.RuntimeError) {
                        return {
                            success: false,
                            error: err.message,
                        };
                    }
                    throw err;
                }
                if (stat.isDirectory) {
                    return {
                        success: false,
                        error: `Path is a directory, not a file: ${filePath}`,
                    };
                }
                const sizeValidation = (0, fileCommon_1.validateFileSize)(stat);
                if (sizeValidation) {
                    return {
                        success: false,
                        error: sizeValidation.error,
                    };
                }
                let fullContent;
                try {
                    fullContent = await (0, helpers_1.readFileString)(config.runtime, targetPath);
                }
                catch (err) {
                    if (err instanceof Runtime_1.RuntimeError) {
                        return {
                            success: false,
                            error: err.message,
                        };
                    }
                    throw err;
                }
                return readContentWithFileReadLimits({
                    fullContent,
                    fileSize: stat.size,
                    modifiedTime: stat.modifiedTime.toISOString(),
                    offset,
                    limit,
                });
            }
            catch (error) {
                return {
                    success: false,
                    error: `Failed to read file: ${formatError(error)}`,
                };
            }
        },
    });
};
exports.createAgentSkillReadFileTool = createAgentSkillReadFileTool;
//# sourceMappingURL=agent_skill_read_file.js.map