"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSystem1KeepRangesForBashOutput = runSystem1KeepRangesForBashOutput;
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const ai_1 = require("ai");
const agentDefinitionsService_1 = require("../../../node/services/agentDefinitions/agentDefinitionsService");
const system1_keep_ranges_1 = require("../../../node/services/tools/system1_keep_ranges");
const abort_1 = require("../../../node/utils/abort");
async function runSystem1KeepRangesForBashOutput(params) {
    (0, assert_1.default)(params, "params is required");
    (0, assert_1.default)(params.runtime, "runtime is required");
    (0, assert_1.default)(typeof params.agentDiscoveryPath === "string" && params.agentDiscoveryPath.length > 0, "agentDiscoveryPath must be a non-empty string");
    (0, assert_1.default)(typeof params.runtimeTempDir === "string" && params.runtimeTempDir.length > 0, "runtimeTempDir must be a non-empty string");
    (0, assert_1.default)(params.model, "model is required");
    (0, assert_1.default)(params.displayName === undefined || typeof params.displayName === "string", "displayName must be a string when provided");
    (0, assert_1.default)(typeof params.modelString === "string" && params.modelString.length > 0, "modelString must be a non-empty string");
    (0, assert_1.default)(typeof params.script === "string", "script must be a string");
    (0, assert_1.default)(typeof params.numberedOutput === "string" && params.numberedOutput.length > 0, "numberedOutput must be a non-empty string");
    (0, assert_1.default)(Number.isInteger(params.maxKeptLines) && params.maxKeptLines > 0, "maxKeptLines must be a positive integer");
    (0, assert_1.default)(Number.isInteger(params.timeoutMs) && params.timeoutMs > 0, "timeoutMs must be a positive integer");
    // Intentionally keep the System 1 prompt minimal to avoid consuming context budget.
    //
    // Use the built-in definition for this internal agent. Allowing project/global overrides
    // would introduce a new footgun compared to the previously hard-coded System1 prompt.
    const systemPrompt = await (0, agentDefinitionsService_1.resolveAgentBody)(params.runtime, params.agentDiscoveryPath, "system1_bash", { skipScopesAbove: "global" });
    const userMessageParts = [`maxKeptLines: ${params.maxKeptLines}`, ""];
    const displayName = typeof params.displayName === "string" && params.displayName.trim().length > 0
        ? params.displayName.trim()
        : undefined;
    if (displayName) {
        userMessageParts.push(`Display name:\n${displayName}`, "");
    }
    userMessageParts.push(`Bash script:\n${params.script}`, "", `Numbered output:\n${params.numberedOutput}`);
    const userMessage = userMessageParts.join("\n");
    const system1AbortController = new AbortController();
    const unlink = (0, abort_1.linkAbortSignal)(params.abortSignal, system1AbortController);
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        params.onTimeout?.();
        system1AbortController.abort();
    }, params.timeoutMs);
    timeout.unref?.();
    // Some providers (Anthropic) reject requests that force tool use while also enabling
    // "thinking". Since the System 1 agent already mandates tool usage, keep requests
    // provider-agnostic and retry once with a stronger reminder if needed.
    const attemptMessages = [
        [{ role: "user", content: userMessage }],
        [
            { role: "user", content: userMessage },
            {
                role: "user",
                content: "Reminder: You MUST call `system1_keep_ranges` exactly once. Do not output any text; only the tool call.",
            },
        ],
    ];
    const generate = params.generateTextImpl ?? ai_1.generateText;
    try {
        for (const messages of attemptMessages) {
            let keepRanges;
            const tools = {
                system1_keep_ranges: (0, system1_keep_ranges_1.createSystem1KeepRangesTool)(
                // This tool is pure/side-effect-free; config is unused.
                // Provide a minimal config object for interface compatibility.
                {
                    cwd: params.agentDiscoveryPath,
                    runtime: params.runtime,
                    runtimeTempDir: params.runtimeTempDir,
                }, {
                    onKeepRanges: (ranges) => {
                        keepRanges = ranges;
                    },
                }),
            };
            let response;
            try {
                response = await generate({
                    model: params.model,
                    system: systemPrompt,
                    messages,
                    tools,
                    abortSignal: system1AbortController.signal,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
                    providerOptions: params.providerOptions,
                    maxOutputTokens: 300,
                    maxRetries: 0,
                });
            }
            catch (error) {
                const errorName = error instanceof Error ? error.name : undefined;
                if (errorName === "AbortError") {
                    return undefined;
                }
                throw error;
            }
            if (keepRanges && keepRanges.length > 0) {
                return {
                    keepRanges,
                    finishReason: response.finishReason,
                    timedOut,
                };
            }
        }
        return undefined;
    }
    finally {
        clearTimeout(timeout);
        unlink();
    }
}
//# sourceMappingURL=system1AgentRunner.js.map