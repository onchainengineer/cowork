"use strict";
/**
 * TypeScript Type Validator for PTC
 *
 * Validates agent-generated JavaScript code against generated type definitions.
 * Catches type errors before execution:
 * - Wrong property names
 * - Missing required arguments
 * - Wrong types for arguments
 * - Calling non-existent tools
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTypes = validateTypes;
/* eslint-disable local/no-sync-fs-methods -- TypeScript's CompilerHost API requires synchronous file operations */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
/**
 * In production builds, lib files are copied to dist/typescript-lib/ with .d.ts.txt extension
 * because electron-builder ignores .d.ts files by default (hardcoded, cannot override):
 * https://github.com/electron-userland/electron-builder/issues/5064
 *
 * These constants are computed once at module load time.
 */
const BUNDLED_LIB_DIR = path_1.default.resolve(__dirname, "../../../typescript-lib");
const IS_PRODUCTION = fs_1.default.existsSync(path_1.default.join(BUNDLED_LIB_DIR, "lib.es2023.d.ts.txt"));
const LIB_DIR = IS_PRODUCTION
    ? BUNDLED_LIB_DIR
    : path_1.default.dirname(require.resolve("typescript/lib/lib.d.ts"));
/** Convert lib filename for production: lib.X.d.ts → lib.X.d.ts.txt */
function toProductionLibName(fileName) {
    return fileName + ".txt";
}
/**
 * Validate JavaScript code against unix type definitions using TypeScript.
 *
 * @param code - JavaScript code to validate
 * @param muxTypes - Generated `.d.ts` content from generateMuxTypes()
 * @returns Validation result with errors if any
 */
/**
 * Check if a TS2339 diagnostic is for a property WRITE on an empty object literal.
 * Returns true only for patterns like `results.foo = x` where `results` is typed as `{}`.
 * Returns false for reads like `return results.foo` or `fn(results.foo)`.
 */
function isEmptyObjectWriteError(d, sourceFile) {
    if (d.code !== 2339 || d.start === undefined)
        return false;
    const message = typescript_1.default.flattenDiagnosticMessageText(d.messageText, "");
    if (!message.includes("on type '{}'"))
        return false;
    // Find the node at the error position and walk up to find context
    const token = findTokenAtPosition(sourceFile, d.start);
    if (!token)
        return false;
    // Walk up to find PropertyAccessExpression containing this token
    let propAccess;
    let node = token;
    while (node.parent) {
        if (typescript_1.default.isPropertyAccessExpression(node.parent)) {
            propAccess = node.parent;
            break;
        }
        node = node.parent;
    }
    if (!propAccess)
        return false;
    // Check if this PropertyAccessExpression is on the left side of an assignment
    const parent = propAccess.parent;
    if (typescript_1.default.isBinaryExpression(parent) &&
        parent.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken &&
        parent.left === propAccess) {
        return true;
    }
    return false;
}
/** Find the innermost token at a position in the source file */
function findTokenAtPosition(sourceFile, position) {
    function find(node) {
        if (position < node.getStart(sourceFile) || position >= node.getEnd()) {
            return undefined;
        }
        // Try to find a more specific child
        const child = typescript_1.default.forEachChild(node, find);
        return child ?? node;
    }
    return find(sourceFile);
}
function validateTypes(code, muxTypes) {
    // Wrap code in function to allow return statements (matches runtime behavior)
    // Note: We don't use async because Asyncify makesunix.* calls appear synchronous
    // Types go AFTER code so error line numbers match agent's code directly
    const wrapperPrefix = "function __agent__() {\n";
    const wrappedCode = `${wrapperPrefix}${code}
}

${muxTypes}
`;
    const compilerOptions = {
        noEmit: true,
        strict: false, // Don't require explicit types on everything
        strictNullChecks: true, // Enable discriminated union narrowing (e.g., `if (!result.success) { result.error }`)
        noImplicitAny: false, // Allow any types
        skipLibCheck: true,
        target: typescript_1.default.ScriptTarget.ES2020,
        module: typescript_1.default.ModuleKind.ESNext,
        // ES2023 needed for Array.at(), findLast(), toSorted(), Object.hasOwn(), String.replaceAll()
        // QuickJS 0.31+ supports these features at runtime
        lib: ["lib.es2023.d.ts"],
    };
    const sourceFile = typescript_1.default.createSourceFile("agent.ts", wrappedCode, typescript_1.default.ScriptTarget.ES2020, true);
    // Create compiler host with custom lib directory resolution.
    // In production, lib files are in dist/typescript-lib/ with .d-ts extension.
    const host = typescript_1.default.createCompilerHost(compilerOptions);
    // Override to read lib files from our bundled directory
    host.getDefaultLibLocation = () => LIB_DIR;
    host.getDefaultLibFileName = (options) => path_1.default.join(LIB_DIR, typescript_1.default.getDefaultLibFileName(options));
    const originalGetSourceFile = host.getSourceFile.bind(host);
    const originalFileExists = host.fileExists.bind(host);
    const originalReadFile = host.readFile.bind(host);
    /** Resolve lib file path, accounting for .d-ts rename in production */
    const resolveLibPath = (fileName) => {
        const libFileName = path_1.default.basename(fileName);
        const actualName = IS_PRODUCTION ? toProductionLibName(libFileName) : libFileName;
        return path_1.default.join(LIB_DIR, actualName);
    };
    host.getSourceFile = (fileName, languageVersion) => {
        if (fileName === "agent.ts")
            return sourceFile;
        // In production, redirect lib file requests to our bundled directory (with .txt extension)
        // In development, let TypeScript use its default resolution so /// <reference lib="..." /> works
        if (IS_PRODUCTION && fileName.includes("lib.") && fileName.endsWith(".d.ts")) {
            const libPath = resolveLibPath(fileName);
            const content = fs_1.default.existsSync(libPath) ? fs_1.default.readFileSync(libPath, "utf-8") : undefined;
            if (content) {
                return typescript_1.default.createSourceFile(fileName, content, languageVersion, true);
            }
        }
        return originalGetSourceFile(fileName, languageVersion);
    };
    host.fileExists = (fileName) => {
        if (fileName === "agent.ts")
            return true;
        // In production, check bundled lib directory for lib files
        if (IS_PRODUCTION && fileName.includes("lib.") && fileName.endsWith(".d.ts")) {
            return fs_1.default.existsSync(resolveLibPath(fileName));
        }
        return originalFileExists(fileName);
    };
    host.readFile = (fileName) => {
        // In production, read lib files from bundled directory
        if (IS_PRODUCTION && fileName.includes("lib.") && fileName.endsWith(".d.ts")) {
            const libPath = resolveLibPath(fileName);
            if (fs_1.default.existsSync(libPath)) {
                return fs_1.default.readFileSync(libPath, "utf-8");
            }
        }
        return originalReadFile(fileName);
    };
    const program = typescript_1.default.createProgram(["agent.ts"], compilerOptions, host);
    const diagnostics = typescript_1.default.getPreEmitDiagnostics(program);
    // Filter to errors in our code only (not lib files)
    // Also filter console redeclaration warning (our minimal console conflicts with lib.dom)
    const errors = diagnostics
        .filter((d) => d.category === typescript_1.default.DiagnosticCategory.Error)
        .filter((d) => !d.file || d.file.fileName === "agent.ts")
        .filter((d) => !typescript_1.default.flattenDiagnosticMessageText(d.messageText, "").includes("console"))
        // Allow dynamic property WRITES on empty object literals - Claude frequently uses
        // `const results = {}; results.foo =unix.file_read(...)` to collate parallel reads.
        // Only suppress when the property access is on the LEFT side of an assignment.
        // Reads like `return results.typo` must still error.
        .filter((d) => !isEmptyObjectWriteError(d, sourceFile))
        .map((d) => {
        const message = typescript_1.default.flattenDiagnosticMessageText(d.messageText, " ");
        // Extract line number if available
        if (d.file && d.start !== undefined) {
            const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
            // TS line is 0-indexed. Wrapper adds 1 line before agent code, so:
            // TS line 0 = wrapper, TS line 1 = agent line 1, TS line 2 = agent line 2, etc.
            // This means TS 0-indexed line number equals agent 1-indexed line number.
            // Only report if within agent code bounds (filter out wrapper and muxTypes)
            const agentCodeLines = code.split("\n").length;
            if (line >= 1 && line <= agentCodeLines) {
                return { message, line, column: character + 1 };
            }
        }
        return { message };
    });
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=typeValidator.js.map