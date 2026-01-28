"use strict";
/**
 * Static Analysis for PTC Code
 *
 * Analyzes agent-generated JavaScript code before execution to catch:
 * - Syntax errors (via QuickJS parser)
 * - Unavailable constructs (import(), require())
 * - Unavailable globals (process, window, etc.)
 *
 * The runtime also wraps ReferenceErrors with friendlier messages as a backstop.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNAVAILABLE_IDENTIFIERS = void 0;
exports.analyzeCode = analyzeCode;
exports.disposeAnalysisContext = disposeAnalysisContext;
const typescript_1 = __importDefault(require("typescript"));
const quickjs_emscripten_core_1 = require("quickjs-emscripten-core");
const ffi_1 = require("@jitl/quickjs-wasmfile-release-asyncify/ffi");
const typeValidator_1 = require("./typeValidator");
/**
 * Identifiers that don't exist in QuickJS and will cause ReferenceError.
 * Used by static analysis to block execution, and by runtime for friendly error messages.
 */
exports.UNAVAILABLE_IDENTIFIERS = new Set([
    // Node.js globals
    "process",
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
    // Browser globals
    "window",
    "document",
    "navigator",
    "fetch",
    "XMLHttpRequest",
]);
// ============================================================================
// Pattern Definitions
// ============================================================================
/**
 * Patterns that will fail at runtime in QuickJS.
 * We detect these early to give better error messages.
 */
const UNAVAILABLE_PATTERNS = [
    {
        // Dynamic import() - not supported in QuickJS, causes crash
        pattern: /(?<![.\w])import\s*\(/g,
        type: "forbidden_construct",
        message: () => "Dynamic import() is not available in the sandbox",
    },
    {
        // require() - CommonJS import, not in QuickJS
        pattern: /(?<![.\w])require\s*\(/g,
        type: "forbidden_construct",
        message: () => "require() is not available in the sandbox - useunix.* tools instead",
    },
];
// ============================================================================
// QuickJS Context Management
// ============================================================================
let cachedContext = null;
/**
 * Get or create a QuickJS context for syntax validation.
 * We reuse the context to avoid repeated WASM initialization.
 */
async function getValidationContext() {
    if (cachedContext) {
        return cachedContext;
    }
    const variant = {
        type: "async",
        importFFI: () => Promise.resolve(ffi_1.QuickJSAsyncFFI),
        // eslint-disable-next-line @typescript-eslint/require-await
        importModuleLoader: async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
            const mod = require("@jitl/quickjs-wasmfile-release-asyncify/emscripten-module");
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
            return mod.default ?? mod;
        },
    };
    const QuickJS = await (0, quickjs_emscripten_core_1.newQuickJSAsyncWASMModuleFromVariant)(variant);
    cachedContext = QuickJS.newContext();
    return cachedContext;
}
// ============================================================================
// Analysis Functions
// ============================================================================
/**
 * Validate JavaScript syntax using QuickJS parser.
 * Returns syntax error if code is invalid.
 */
async function validateSyntax(code) {
    const ctx = await getValidationContext();
    // Wrap in function to allow return statements (matches runtime behavior)
    const wrappedCode = `(function() { ${code} })`;
    // Use evalCode with compile-only flag to parse without executing.
    const result = ctx.evalCode(wrappedCode, "analysis.js", {
        compileOnly: true,
    });
    if (result.error) {
        const errorObj = ctx.dump(result.error);
        result.error.dispose();
        // QuickJS error object has: { name, message, stack, fileName, lineNumber }
        let message = typeof errorObj.message === "string" ? errorObj.message : JSON.stringify(errorObj);
        // Enhance obtuse "expecting ';'" error when await expression is detected.
        // In non-async context, `await foo()` parses as identifier `await` + stray `foo()`,
        // giving unhelpful "expecting ';'". Detect this pattern and give a clearer message.
        if (message === "expecting ';'" && /\bawait\s+\w/.test(code)) {
            message =
                "`await` is not supported -unix.* functions return results directly (no await needed)";
        }
        const rawLine = typeof errorObj.lineNumber === "number" ? errorObj.lineNumber : undefined;
        // Only report line if it's within agent code bounds.
        // The wrapper is `(function() { ${code} })` - all on one line with code inlined.
        // So QuickJS line N = agent line N for lines within the code.
        // Errors detected at the closing wrapper (missing braces, incomplete expressions)
        // will have line numbers beyond the agent's code - don't report those.
        const codeLines = code.split("\n").length;
        const line = rawLine !== undefined && rawLine >= 1 && rawLine <= codeLines ? rawLine : undefined;
        return {
            type: "syntax",
            message,
            line,
            column: undefined, // QuickJS doesn't provide column for syntax errors
        };
    }
    result.value.dispose();
    return null;
}
/**
 * Find line number for a match position in the source code.
 */
function getLineNumber(code, index) {
    const upToMatch = code.slice(0, index);
    return (upToMatch.match(/\n/g) ?? []).length + 1;
}
/**
 * Detect patterns that will fail at runtime in QuickJS.
 */
function detectUnavailablePatterns(code) {
    const errors = [];
    for (const { pattern, type, message } of UNAVAILABLE_PATTERNS) {
        // Reset regex state for each scan
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(code)) !== null) {
            errors.push({
                type,
                message: message(match),
                line: getLineNumber(code, match.index),
            });
        }
    }
    return errors;
}
/**
 * Detect references to unavailable globals (process, window, fetch, etc.)
 * using TypeScript AST to avoid false positives on object keys and string literals.
 */
function detectUnavailableGlobals(code) {
    const errors = [];
    const seen = new Set();
    const sourceFile = typescript_1.default.createSourceFile("code.ts", code, typescript_1.default.ScriptTarget.ES2020, true);
    function visit(node) {
        // Only check identifier nodes
        if (!typescript_1.default.isIdentifier(node)) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        const name = node.text;
        // Skip 'require' - already handled as forbidden_construct pattern
        if (name === "require") {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // Skip if not an unavailable identifier
        if (!exports.UNAVAILABLE_IDENTIFIERS.has(name)) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // Skip if already reported
        if (seen.has(name)) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        const parent = node.parent;
        // Skip property access on RHS (e.g., obj.process)
        if (parent && typescript_1.default.isPropertyAccessExpression(parent) && parent.name === node) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // Skip object literal property keys (e.g., { process: ... })
        if (parent && typescript_1.default.isPropertyAssignment(parent) && parent.name === node) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // Skip shorthand property assignments (e.g., { process } where process is a variable)
        // This is actually a reference, so we don't skip it
        // Skip variable declarations (e.g., const process = ...)
        if (parent && typescript_1.default.isVariableDeclaration(parent) && parent.name === node) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // Skip function declarations (e.g., function process() {})
        if (parent && typescript_1.default.isFunctionDeclaration(parent) && parent.name === node) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // Skip parameter declarations
        if (parent && typescript_1.default.isParameter(parent) && parent.name === node) {
            typescript_1.default.forEachChild(node, visit);
            return;
        }
        // This is a real reference to an unavailable global
        seen.add(name);
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        errors.push({
            type: "unavailable_global",
            message: `'${name}' is not available in the sandbox`,
            line: line + 1, // 1-indexed
        });
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return errors;
}
// ============================================================================
// Main Analysis Function
// ============================================================================
/**
 * Analyze JavaScript code before execution.
 *
 * Performs:
 * 1. Syntax validation via QuickJS parser
 * 2. Unavailable pattern detection (import, require)
 * 3. Unavailable global detection (process, window, etc.)
 * 4. TypeScript type validation (if muxTypes provided)
 *
 * @param code - JavaScript code to analyze
 * @param muxTypes - Optional .d.ts content for type validation
 * @returns Analysis result with errors
 */
async function analyzeCode(code, muxTypes) {
    const errors = [];
    // 1. Syntax validation
    const syntaxError = await validateSyntax(code);
    if (syntaxError) {
        errors.push(syntaxError);
        // If syntax is invalid, skip other checks (they'd give false positives)
        return { valid: false, errors };
    }
    // 2. Unavailable pattern detection (import, require)
    errors.push(...detectUnavailablePatterns(code));
    // 3. Unavailable global detection (process, window, etc.)
    errors.push(...detectUnavailableGlobals(code));
    // 4. TypeScript type validation (if muxTypes provided)
    if (muxTypes) {
        const typeResult = (0, typeValidator_1.validateTypes)(code, muxTypes);
        for (const typeError of typeResult.errors) {
            errors.push({
                type: "type_error",
                message: typeError.message,
                line: typeError.line,
                column: typeError.column,
            });
        }
    }
    return { valid: errors.length === 0, errors };
}
/**
 * Clean up the cached validation context.
 * Call this when shutting down to free resources.
 *
 * TODO: Wire into app/workspace shutdown to free QuickJS context (Phase 6)
 */
function disposeAnalysisContext() {
    if (cachedContext) {
        cachedContext.dispose();
        cachedContext = null;
    }
}
//# sourceMappingURL=staticAnalysis.js.map