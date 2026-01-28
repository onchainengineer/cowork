"use strict";
/**
 * Code Execution Tool for Programmatic Tool Calling (PTC)
 *
 * Executes JavaScript code in a sandboxed QuickJS environment with access to all
 * Unix tools via the `unix.*` namespace. Enables multi-tool workflows in a single
 * inference instead of multiple round-trips.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTypeCaches = clearTypeCaches;
exports.preGenerateMuxTypes = preGenerateMuxTypes;
exports.createCodeExecutionTool = createCodeExecutionTool;
const ai_1 = require("ai");
const zod_1 = require("zod");
const toolBridge_1 = require("../../../node/services/ptc/toolBridge");
const staticAnalysis_1 = require("../../../node/services/ptc/staticAnalysis");
const typeGenerator_1 = require("../../../node/services/ptc/typeGenerator");
// Default limits
const DEFAULT_MEMORY_BYTES = 64 * 1024 * 1024; // 64MB
const DEFAULT_TIMEOUT_SECS = 5 * 60; // 5 minutes
const MAX_TIMEOUT_SECS = 60 * 60; // 1 hour
/**
 * Clear all type caches. Call for test isolation or when tool schemas might have changed.
 */
function clearTypeCaches() {
    (0, typeGenerator_1.clearTypeCache)();
}
/**
 * Pre-generate type definitions for the given tools.
 * Call during workspace initialization to avoid first-call latency.
 * Integration with workspace initialization is handled in Phase 6.
 */
async function preGenerateMuxTypes(tools) {
    const toolBridge = new toolBridge_1.ToolBridge(tools);
    await (0, typeGenerator_1.getCachedMuxTypes)(toolBridge.getBridgeableTools());
}
/**
 * Create the code_execution tool.
 *
 * This function is async because it generates TypeScript type definitions
 * from the tool schemas, which requires async JSON Schema to TypeScript conversion.
 *
 * @param runtimeFactory Factory for creating QuickJS runtime instances
 * @param toolBridge Bridge containing tools to expose in sandbox
 * @param emitNestedEvent Callback for streaming nested tool events (includes parentToolCallId)
 */
async function createCodeExecutionTool(runtimeFactory, toolBridge, emitNestedEvent) {
    const bridgeableTools = toolBridge.getBridgeableTools();
    // Generate unix types for type validation and documentation (cached by tool set hash)
    const muxTypes = await (0, typeGenerator_1.getCachedMuxTypes)(bridgeableTools);
    return (0, ai_1.tool)({
        description: `Execute sandboxed JavaScript to batch tools and transform outputs.

**When to use:** Prefer this tool when making 2+ tool calls, especially when later calls depend on earlier results. Reduces round-trip latency.

**Available tools (TypeScript definitions):**
\`\`\`typescript
${muxTypes}
\`\`\`

**Usage notes:**
- \`unix.*\` functions are synchronous—do not use \`await\`
- Use \`return\` to provide a final result to the model
- Use \`console.log/warn/error\` for debugging - output is captured
- Results are JSON-serialized; non-serializable values return \`{ error: "..." }\`
- On failure, partial results (completed tool calls) are returned for debugging

**Security:** The sandbox has no access to \`require\`, \`import\`, \`process\`, \`fetch\`, or filesystem outside of \`unix.*\` tools.`,
        inputSchema: zod_1.z.object({
            code: zod_1.z
                .string()
                .min(1)
                .describe("JavaScript code to execute.unix.* calls are synchronous—do not use await. Use 'return' for final result."),
            timeout_secs: zod_1.z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Execution timeout in seconds (default: 300, max: 3600). " +
                "Increase when spawning subagents that may take 5-15+ minutes."),
        }),
        execute: async ({ code, timeout_secs }, { abortSignal, toolCallId }) => {
            const execStartTime = Date.now();
            // Static analysis before execution - catch syntax errors, forbidden patterns, and type errors
            const analysis = await (0, staticAnalysis_1.analyzeCode)(code, muxTypes);
            if (!analysis.valid) {
                const errorMessages = analysis.errors.map((e) => {
                    const location = e.line && e.column
                        ? ` (line ${e.line}, col ${e.column})`
                        : e.line
                            ? ` (line ${e.line})`
                            : "";
                    return `- ${e.message}${location}`;
                });
                return {
                    success: false,
                    error: `Code analysis failed:\n${errorMessages.join("\n")}`,
                    toolCalls: [],
                    consoleOutput: [],
                    duration_ms: Date.now() - execStartTime,
                };
            }
            // Create runtime with resource limits
            const runtime = await runtimeFactory.create();
            try {
                // Set resource limits (clamp timeout to max)
                const timeoutSecs = Math.min(timeout_secs ?? DEFAULT_TIMEOUT_SECS, MAX_TIMEOUT_SECS);
                runtime.setLimits({
                    memoryBytes: DEFAULT_MEMORY_BYTES,
                    timeoutMs: timeoutSecs * 1000,
                });
                // Subscribe to events for UI streaming
                // Wrap callback to include parentToolCallId from AI SDK context
                if (emitNestedEvent) {
                    runtime.onEvent((event) => {
                        emitNestedEvent({ ...event, parentToolCallId: toolCallId });
                    });
                }
                // Register tools - they'll use runtime.getAbortSignal() for cancellation
                toolBridge.register(runtime);
                // Handle abort signal - interrupt sandbox and cancel nested tools
                if (abortSignal) {
                    // If already aborted, abort runtime immediately
                    if (abortSignal.aborted) {
                        runtime.abort();
                    }
                    else {
                        abortSignal.addEventListener("abort", () => runtime.abort(), { once: true });
                    }
                }
                // Execute the code
                return await runtime.eval(code);
            }
            finally {
                // Clean up runtime resources
                runtime.dispose();
            }
        },
    });
}
//# sourceMappingURL=code_execution.js.map