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
exports.getDefaultAgentSkillsRoots = getDefaultAgentSkillsRoots;
exports.discoverAgentSkills = discoverAgentSkills;
exports.readAgentSkill = readAgentSkill;
exports.resolveAgentSkillFilePath = resolveAgentSkillFilePath;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const SSHRuntime_1 = require("../../../node/runtime/SSHRuntime");
const backgroundCommands_1 = require("../../../node/runtime/backgroundCommands");
const helpers_1 = require("../../../node/utils/runtime/helpers");
const schemas_1 = require("../../../common/orpc/schemas");
const log_1 = require("../../../node/services/log");
const fileCommon_1 = require("../../../node/services/tools/fileCommon");
const parseSkillMarkdown_1 = require("./parseSkillMarkdown");
const builtInSkillDefinitions_1 = require("./builtInSkillDefinitions");
const GLOBAL_SKILLS_ROOT = "~/.unix/skills";
function getDefaultAgentSkillsRoots(runtime, workspacePath) {
    if (!workspacePath) {
        throw new Error("getDefaultAgentSkillsRoots: workspacePath is required");
    }
    return {
        projectRoot: runtime.normalizePath(".unix/skills", workspacePath),
        globalRoot: GLOBAL_SKILLS_ROOT,
    };
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
async function listSkillDirectoriesFromLocalFs(root) {
    try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    }
    catch {
        return [];
    }
}
async function listSkillDirectoriesFromRuntime(runtime, root, options) {
    if (!options.cwd) {
        throw new Error("listSkillDirectoriesFromRuntime: options.cwd is required");
    }
    const quotedRoot = (0, backgroundCommands_1.shellQuote)(root);
    const command = `if [ -d ${quotedRoot} ]; then ` +
        `find ${quotedRoot} -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; ; ` +
        `fi`;
    const result = await (0, helpers_1.execBuffered)(runtime, command, { cwd: options.cwd, timeout: 10 });
    if (result.exitCode !== 0) {
        log_1.log.warn(`Failed to read skills directory ${root}: ${result.stderr || result.stdout}`);
        return [];
    }
    return result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}
async function readSkillDescriptorFromDir(runtime, skillDir, directoryName, scope) {
    const skillFilePath = runtime.normalizePath("SKILL.md", skillDir);
    let stat;
    try {
        stat = await runtime.stat(skillFilePath);
    }
    catch {
        return null;
    }
    if (stat.isDirectory) {
        return null;
    }
    // Avoid reading very large files into memory (parseSkillMarkdown enforces the same limit).
    const sizeValidation = (0, fileCommon_1.validateFileSize)(stat);
    if (sizeValidation) {
        log_1.log.warn(`Skipping skill '${directoryName}' (${scope}): ${sizeValidation.error}`);
        return null;
    }
    let content;
    try {
        content = await (0, helpers_1.readFileString)(runtime, skillFilePath);
    }
    catch (err) {
        log_1.log.warn(`Failed to read SKILL.md for ${directoryName}: ${formatError(err)}`);
        return null;
    }
    try {
        const parsed = (0, parseSkillMarkdown_1.parseSkillMarkdown)({
            content,
            byteSize: stat.size,
            directoryName,
        });
        const descriptor = {
            name: parsed.frontmatter.name,
            description: parsed.frontmatter.description,
            scope,
        };
        const validated = schemas_1.AgentSkillDescriptorSchema.safeParse(descriptor);
        if (!validated.success) {
            log_1.log.warn(`Invalid agent skill descriptor for ${directoryName}: ${validated.error.message}`);
            return null;
        }
        return validated.data;
    }
    catch (err) {
        const message = err instanceof parseSkillMarkdown_1.AgentSkillParseError ? err.message : formatError(err);
        log_1.log.warn(`Skipping invalid skill '${directoryName}' (${scope}): ${message}`);
        return null;
    }
}
async function discoverAgentSkills(runtime, workspacePath, options) {
    if (!workspacePath) {
        throw new Error("discoverAgentSkills: workspacePath is required");
    }
    const roots = options?.roots ?? getDefaultAgentSkillsRoots(runtime, workspacePath);
    const byName = new Map();
    // Project skills take precedence over global.
    const scans = [
        { scope: "project", root: roots.projectRoot },
        { scope: "global", root: roots.globalRoot },
    ];
    for (const scan of scans) {
        let resolvedRoot;
        try {
            resolvedRoot = await runtime.resolvePath(scan.root);
        }
        catch (err) {
            log_1.log.warn(`Failed to resolve skills root ${scan.root}: ${formatError(err)}`);
            continue;
        }
        const directoryNames = runtime instanceof SSHRuntime_1.SSHRuntime
            ? await listSkillDirectoriesFromRuntime(runtime, resolvedRoot, { cwd: workspacePath })
            : await listSkillDirectoriesFromLocalFs(resolvedRoot);
        for (const directoryNameRaw of directoryNames) {
            const nameParsed = schemas_1.SkillNameSchema.safeParse(directoryNameRaw);
            if (!nameParsed.success) {
                log_1.log.warn(`Skipping invalid skill directory name '${directoryNameRaw}' in ${resolvedRoot}`);
                continue;
            }
            const directoryName = nameParsed.data;
            if (scan.scope === "global" && byName.has(directoryName)) {
                continue;
            }
            const skillDir = runtime.normalizePath(directoryName, resolvedRoot);
            const descriptor = await readSkillDescriptorFromDir(runtime, skillDir, directoryName, scan.scope);
            if (!descriptor)
                continue;
            // Precedence: project overwrites global.
            byName.set(descriptor.name, descriptor);
        }
    }
    // Add built-in skills (lowest precedence - only if not overridden by project/global)
    for (const builtIn of (0, builtInSkillDefinitions_1.getBuiltInSkillDescriptors)()) {
        if (!byName.has(builtIn.name)) {
            byName.set(builtIn.name, builtIn);
        }
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
async function readAgentSkillFromDir(runtime, skillDir, directoryName, scope) {
    const skillFilePath = runtime.normalizePath("SKILL.md", skillDir);
    const stat = await runtime.stat(skillFilePath);
    if (stat.isDirectory) {
        throw new Error(`SKILL.md is not a file: ${skillFilePath}`);
    }
    const sizeValidation = (0, fileCommon_1.validateFileSize)(stat);
    if (sizeValidation) {
        throw new Error(sizeValidation.error);
    }
    const content = await (0, helpers_1.readFileString)(runtime, skillFilePath);
    const parsed = (0, parseSkillMarkdown_1.parseSkillMarkdown)({
        content,
        byteSize: stat.size,
        directoryName,
    });
    const pkg = {
        scope,
        directoryName,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
    };
    const validated = schemas_1.AgentSkillPackageSchema.safeParse(pkg);
    if (!validated.success) {
        throw new Error(`Invalid agent skill package for '${directoryName}': ${validated.error.message}`);
    }
    return {
        package: validated.data,
        skillDir,
    };
}
async function readAgentSkill(runtime, workspacePath, name, options) {
    if (!workspacePath) {
        throw new Error("readAgentSkill: workspacePath is required");
    }
    const roots = options?.roots ?? getDefaultAgentSkillsRoots(runtime, workspacePath);
    // Project overrides global.
    const candidates = [
        { scope: "project", root: roots.projectRoot },
        { scope: "global", root: roots.globalRoot },
    ];
    for (const candidate of candidates) {
        let resolvedRoot;
        try {
            resolvedRoot = await runtime.resolvePath(candidate.root);
        }
        catch {
            continue;
        }
        const skillDir = runtime.normalizePath(name, resolvedRoot);
        try {
            const stat = await runtime.stat(skillDir);
            if (!stat.isDirectory)
                continue;
            return await readAgentSkillFromDir(runtime, skillDir, name, candidate.scope);
        }
        catch {
            continue;
        }
    }
    // Check built-in skills as fallback
    const builtIn = (0, builtInSkillDefinitions_1.getBuiltInSkillByName)(name);
    if (builtIn) {
        return {
            package: builtIn,
            // Built-in skills don't have a real skillDir on disk.
            // agent_skill_read_file handles built-in skills specially; this is a sentinel value.
            skillDir: `<built-in:${name}>`,
        };
    }
    throw new Error(`Agent skill not found: ${name}`);
}
function isAbsolutePathAny(filePath) {
    if (filePath.startsWith("/") || filePath.startsWith("\\"))
        return true;
    // Windows drive letter paths (e.g., C:\foo or C:/foo)
    return /^[A-Za-z]:[\\/]/.test(filePath);
}
function resolveAgentSkillFilePath(runtime, skillDir, filePath) {
    if (!filePath) {
        throw new Error("filePath is required");
    }
    // Disallow absolute paths and home-relative paths.
    if (isAbsolutePathAny(filePath) || filePath.startsWith("~")) {
        throw new Error(`Invalid filePath (must be relative to the skill directory): ${filePath}`);
    }
    const pathModule = runtime instanceof SSHRuntime_1.SSHRuntime ? path.posix : path;
    // Resolve relative to skillDir and ensure it stays within skillDir.
    const resolved = pathModule.resolve(skillDir, filePath);
    const relative = pathModule.relative(skillDir, resolved);
    if (relative === "" || relative === ".") {
        throw new Error(`Invalid filePath (expected a file, got directory): ${filePath}`);
    }
    if (relative.startsWith("..") || pathModule.isAbsolute(relative)) {
        throw new Error(`Invalid filePath (path traversal): ${filePath}`);
    }
    return resolved;
}
//# sourceMappingURL=agentSkillsService.js.map