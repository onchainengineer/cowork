"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuiltInSkillDefinitions = getBuiltInSkillDefinitions;
exports.getBuiltInSkillDescriptors = getBuiltInSkillDescriptors;
exports.getBuiltInSkillByName = getBuiltInSkillByName;
exports.readBuiltInSkillFile = readBuiltInSkillFile;
exports.clearBuiltInSkillCache = clearBuiltInSkillCache;
const path = __importStar(require("node:path"));
const parseSkillMarkdown_1 = require("./parseSkillMarkdown");
const builtInSkillContent_generated_1 = require("./builtInSkillContent.generated");
const BUILT_IN_SOURCES = Object.entries(builtInSkillContent_generated_1.BUILTIN_SKILL_FILES).map(([name, files]) => ({ name, files }));
let cachedPackages = null;
function parseBuiltIns() {
    return BUILT_IN_SOURCES.map(({ name, files }) => {
        const content = files["SKILL.md"];
        if (content === undefined) {
            throw new Error(`Built-in skill '${name}' is missing SKILL.md`);
        }
        const parsed = (0, parseSkillMarkdown_1.parseSkillMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf8"),
            directoryName: name,
        });
        return {
            scope: "built-in",
            directoryName: name,
            frontmatter: parsed.frontmatter,
            body: parsed.body.trim(),
        };
    });
}
function getBuiltInSkillDefinitions() {
    cachedPackages ?? (cachedPackages = parseBuiltIns());
    return cachedPackages;
}
function getBuiltInSkillDescriptors() {
    return getBuiltInSkillDefinitions().map((pkg) => ({
        name: pkg.frontmatter.name,
        description: pkg.frontmatter.description,
        scope: pkg.scope,
    }));
}
function getBuiltInSkillByName(name) {
    return getBuiltInSkillDefinitions().find((pkg) => pkg.frontmatter.name === name);
}
function isAbsolutePathAny(filePath) {
    if (filePath.startsWith("/") || filePath.startsWith("\\"))
        return true;
    // Windows drive letter paths (e.g., C:\foo or C:/foo)
    if (/^[A-Za-z]:/.test(filePath)) {
        const sep = filePath[2];
        return sep === "\\" || sep === "/";
    }
    return false;
}
function normalizeBuiltInSkillFilePath(filePath) {
    if (!filePath) {
        throw new Error("filePath is required");
    }
    // Disallow absolute paths and home-relative paths.
    if (isAbsolutePathAny(filePath) || filePath.startsWith("~")) {
        throw new Error(`Invalid filePath (must be relative to the skill directory): ${filePath}`);
    }
    // Always normalize with posix separators (built-in skill file paths are stored posix-style).
    const normalized = path.posix.normalize(filePath.replaceAll("\\", "/"));
    const stripped = normalized.startsWith("./") ? normalized.slice(2) : normalized;
    if (stripped === "" || stripped === "." || stripped.endsWith("/")) {
        throw new Error(`Invalid filePath (expected a file, got directory): ${filePath}`);
    }
    if (stripped === ".." || stripped.startsWith("../")) {
        throw new Error(`Invalid filePath (path traversal): ${filePath}`);
    }
    return stripped;
}
function readBuiltInSkillFile(name, filePath) {
    const resolvedPath = normalizeBuiltInSkillFilePath(filePath);
    const skillFiles = builtInSkillContent_generated_1.BUILTIN_SKILL_FILES[name];
    if (!skillFiles) {
        throw new Error(`Built-in skill not found: ${name}`);
    }
    const content = skillFiles[resolvedPath];
    if (content === undefined) {
        throw new Error(`Built-in skill file not found: ${name}/${resolvedPath}`);
    }
    return { resolvedPath, content };
}
/** Exposed for testing - clears cached parsed packages */
function clearBuiltInSkillCache() {
    cachedPackages = null;
}
//# sourceMappingURL=builtInSkillDefinitions.js.map