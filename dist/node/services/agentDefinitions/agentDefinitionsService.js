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
exports.MAX_INHERITANCE_DEPTH = void 0;
exports.agentVisitKey = agentVisitKey;
exports.computeBaseSkipScope = computeBaseSkipScope;
exports.getDefaultAgentDefinitionsRoots = getDefaultAgentDefinitionsRoots;
exports.discoverAgentDefinitions = discoverAgentDefinitions;
exports.readAgentDefinition = readAgentDefinition;
exports.resolveAgentBody = resolveAgentBody;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const SSHRuntime_1 = require("../../../node/runtime/SSHRuntime");
const helpers_1 = require("../../../node/utils/runtime/helpers");
const backgroundCommands_1 = require("../../../node/runtime/backgroundCommands");
const schemas_1 = require("../../../common/orpc/schemas");
const log_1 = require("../../../node/services/log");
const fileCommon_1 = require("../../../node/services/tools/fileCommon");
const builtInAgentDefinitions_1 = require("./builtInAgentDefinitions");
const parseAgentDefinitionMarkdown_1 = require("./parseAgentDefinitionMarkdown");
exports.MAX_INHERITANCE_DEPTH = 10;
/**
 * Generate a unique visit key for cycle detection that distinguishes
 * same-name agents at different scopes (e.g., project/exec vs built-in/exec).
 */
function agentVisitKey(id, scope) {
    return `${id}:${scope}`;
}
/**
 * Compute the skipScopesAbove value when resolving a base agent.
 * If the base has the same ID as the current agent, skip the current scope
 * to allow project/global agents to extend built-ins of the same name.
 */
function computeBaseSkipScope(baseId, currentId, currentScope) {
    return baseId === currentId ? currentScope : undefined;
}
const GLOBAL_AGENTS_ROOT = "~/.unix/agents";
function resolveUiSelectable(ui) {
    if (!ui) {
        return true;
    }
    if (typeof ui.hidden === "boolean") {
        return !ui.hidden;
    }
    if (typeof ui.selectable === "boolean") {
        return ui.selectable;
    }
    return true;
}
function resolveUiDisabled(ui) {
    return ui?.disabled === true;
}
function getDefaultAgentDefinitionsRoots(runtime, workspacePath) {
    if (!workspacePath) {
        throw new Error("getDefaultAgentDefinitionsRoots: workspacePath is required");
    }
    return {
        projectRoot: runtime.normalizePath(".unix/agents", workspacePath),
        globalRoot: GLOBAL_AGENTS_ROOT,
    };
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
async function listAgentFilesFromLocalFs(root) {
    try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
            .map((entry) => entry.name);
    }
    catch {
        return [];
    }
}
async function listAgentFilesFromRuntime(runtime, root, options) {
    if (!options.cwd) {
        throw new Error("listAgentFilesFromRuntime: options.cwd is required");
    }
    const quotedRoot = (0, backgroundCommands_1.shellQuote)(root);
    const command = `if [ -d ${quotedRoot} ]; then ` +
        `find ${quotedRoot} -mindepth 1 -maxdepth 1 -type f -name '*.md' -exec basename {} \\; ; ` +
        `fi`;
    const result = await (0, helpers_1.execBuffered)(runtime, command, { cwd: options.cwd, timeout: 10 });
    if (result.exitCode !== 0) {
        log_1.log.warn(`Failed to read agents directory ${root}: ${result.stderr || result.stdout}`);
        return [];
    }
    return result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}
function getAgentIdFromFilename(filename) {
    const parsed = path.parse(filename);
    if (parsed.ext.toLowerCase() !== ".md") {
        return null;
    }
    const idRaw = parsed.name.trim().toLowerCase();
    const idParsed = schemas_1.AgentIdSchema.safeParse(idRaw);
    if (!idParsed.success) {
        return null;
    }
    return idParsed.data;
}
async function readAgentDescriptorFromFileWithDisabled(runtime, filePath, agentId, scope) {
    let stat;
    try {
        stat = await runtime.stat(filePath);
    }
    catch {
        return null;
    }
    if (stat.isDirectory) {
        return null;
    }
    const sizeValidation = (0, fileCommon_1.validateFileSize)(stat);
    if (sizeValidation) {
        log_1.log.warn(`Skipping agent '${agentId}' (${scope}): ${sizeValidation.error}`);
        return null;
    }
    let content;
    try {
        content = await (0, helpers_1.readFileString)(runtime, filePath);
    }
    catch (err) {
        log_1.log.warn(`Failed to read agent definition ${filePath}: ${formatError(err)}`);
        return null;
    }
    try {
        const parsed = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({ content, byteSize: stat.size });
        const uiSelectable = resolveUiSelectable(parsed.frontmatter.ui);
        const uiColor = parsed.frontmatter.ui?.color;
        const subagentRunnable = parsed.frontmatter.subagent?.runnable ?? false;
        const disabled = resolveUiDisabled(parsed.frontmatter.ui);
        const descriptor = {
            id: agentId,
            scope,
            name: parsed.frontmatter.name,
            description: parsed.frontmatter.description,
            uiSelectable,
            uiColor,
            subagentRunnable,
            base: parsed.frontmatter.base,
            aiDefaults: parsed.frontmatter.ai,
            tools: parsed.frontmatter.tools,
        };
        const validated = schemas_1.AgentDefinitionDescriptorSchema.safeParse(descriptor);
        if (!validated.success) {
            log_1.log.warn(`Invalid agent definition descriptor for ${agentId}: ${validated.error.message}`);
            return null;
        }
        return { descriptor: validated.data, disabled };
    }
    catch (err) {
        const message = err instanceof parseAgentDefinitionMarkdown_1.AgentDefinitionParseError ? err.message : formatError(err);
        log_1.log.warn(`Skipping invalid agent definition '${agentId}' (${scope}): ${message}`);
        return null;
    }
}
async function discoverAgentDefinitions(runtime, workspacePath, options) {
    if (!workspacePath) {
        throw new Error("discoverAgentDefinitions: workspacePath is required");
    }
    const roots = options?.roots ?? getDefaultAgentDefinitionsRoots(runtime, workspacePath);
    const byId = new Map();
    // Seed built-ins (lowest precedence).
    for (const pkg of (0, builtInAgentDefinitions_1.getBuiltInAgentDefinitions)()) {
        const uiSelectable = resolveUiSelectable(pkg.frontmatter.ui);
        const uiColor = pkg.frontmatter.ui?.color;
        const subagentRunnable = pkg.frontmatter.subagent?.runnable ?? false;
        const disabled = resolveUiDisabled(pkg.frontmatter.ui);
        byId.set(pkg.id, {
            descriptor: {
                id: pkg.id,
                scope: "built-in",
                name: pkg.frontmatter.name,
                description: pkg.frontmatter.description,
                uiSelectable,
                uiColor,
                subagentRunnable,
                base: pkg.frontmatter.base,
                aiDefaults: pkg.frontmatter.ai,
                tools: pkg.frontmatter.tools,
            },
            disabled,
        });
    }
    const scans = [
        { scope: "global", root: roots.globalRoot },
        { scope: "project", root: roots.projectRoot },
    ];
    for (const scan of scans) {
        let resolvedRoot;
        try {
            resolvedRoot = await runtime.resolvePath(scan.root);
        }
        catch (err) {
            log_1.log.warn(`Failed to resolve agents root ${scan.root}: ${formatError(err)}`);
            continue;
        }
        const filenames = runtime instanceof SSHRuntime_1.SSHRuntime
            ? await listAgentFilesFromRuntime(runtime, resolvedRoot, { cwd: workspacePath })
            : await listAgentFilesFromLocalFs(resolvedRoot);
        for (const filename of filenames) {
            const agentId = getAgentIdFromFilename(filename);
            if (!agentId) {
                log_1.log.warn(`Skipping invalid agent filename '${filename}' in ${resolvedRoot}`);
                continue;
            }
            const filePath = runtime.normalizePath(filename, resolvedRoot);
            const result = await readAgentDescriptorFromFileWithDisabled(runtime, filePath, agentId, scan.scope);
            if (!result)
                continue;
            byId.set(agentId, result);
        }
    }
    // Filter out disabled agents and return only the descriptors
    return Array.from(byId.values())
        .filter((entry) => !entry.disabled)
        .map((entry) => entry.descriptor)
        .sort((a, b) => a.name.localeCompare(b.name));
}
const SCOPE_PRIORITY = ["project", "global", "built-in"];
async function readAgentDefinition(runtime, workspacePath, agentId, options) {
    if (!workspacePath) {
        throw new Error("readAgentDefinition: workspacePath is required");
    }
    const roots = options?.roots ?? getDefaultAgentDefinitionsRoots(runtime, workspacePath);
    const skipScopesAbove = options?.skipScopesAbove;
    // Determine which scopes to skip based on skipScopesAbove
    const skipScopes = new Set();
    if (skipScopesAbove) {
        const skipIndex = SCOPE_PRIORITY.indexOf(skipScopesAbove);
        if (skipIndex !== -1) {
            // Skip this scope and all higher-priority scopes
            for (let i = 0; i <= skipIndex; i++) {
                skipScopes.add(SCOPE_PRIORITY[i]);
            }
        }
    }
    // Precedence: project overrides global overrides built-in.
    const candidates = [
        { scope: "project", root: roots.projectRoot },
        { scope: "global", root: roots.globalRoot },
    ];
    for (const candidate of candidates) {
        if (skipScopes.has(candidate.scope)) {
            continue;
        }
        let resolvedRoot;
        try {
            resolvedRoot = await runtime.resolvePath(candidate.root);
        }
        catch {
            continue;
        }
        const filePath = runtime.normalizePath(`${agentId}.md`, resolvedRoot);
        try {
            const stat = await runtime.stat(filePath);
            if (stat.isDirectory) {
                continue;
            }
            const sizeValidation = (0, fileCommon_1.validateFileSize)(stat);
            if (sizeValidation) {
                throw new Error(sizeValidation.error);
            }
            const content = await (0, helpers_1.readFileString)(runtime, filePath);
            const parsed = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({ content, byteSize: stat.size });
            const pkg = {
                id: agentId,
                scope: candidate.scope,
                frontmatter: parsed.frontmatter,
                body: parsed.body,
            };
            const validated = schemas_1.AgentDefinitionPackageSchema.safeParse(pkg);
            if (!validated.success) {
                throw new Error(`Invalid agent definition package for '${agentId}' (${candidate.scope}): ${validated.error.message}`);
            }
            return validated.data;
        }
        catch {
            continue;
        }
    }
    if (!skipScopes.has("built-in")) {
        const builtIn = (0, builtInAgentDefinitions_1.getBuiltInAgentDefinitions)().find((pkg) => pkg.id === agentId);
        if (builtIn) {
            const validated = schemas_1.AgentDefinitionPackageSchema.safeParse(builtIn);
            if (!validated.success) {
                throw new Error(`Invalid built-in agent definition '${agentId}': ${validated.error.message}`);
            }
            return validated.data;
        }
    }
    throw new Error(`Agent definition not found: ${agentId}`);
}
/**
 * Resolve the effective system prompt body for an agent, including inherited content.
 *
 * By default (or with `prompt.append: true`), the agent's body is appended to its base's body.
 * Set `prompt.append: false` to replace the base body entirely.
 *
 * When resolving a base, we skip the current agent's scope to allow overriding built-ins:
 * - Project-scope `exec.md` with `base: exec` → resolves to global/built-in exec
 * - Global-scope `exec.md` with `base: exec` → resolves to built-in exec
 */
async function resolveAgentBody(runtime, workspacePath, agentId, options) {
    const visited = new Set();
    function mergeSkipScopesAbove(a, b) {
        if (!a) {
            return b;
        }
        if (!b) {
            return a;
        }
        const aIndex = SCOPE_PRIORITY.indexOf(a);
        const bIndex = SCOPE_PRIORITY.indexOf(b);
        // Defensive fallback. (In practice, both should always be in SCOPE_PRIORITY.)
        if (aIndex === -1 || bIndex === -1) {
            return a;
        }
        return aIndex > bIndex ? a : b;
    }
    async function resolve(id, depth, skipScopesAbove) {
        if (depth > exports.MAX_INHERITANCE_DEPTH) {
            throw new Error(`Agent inheritance depth exceeded for '${id}' (max: ${exports.MAX_INHERITANCE_DEPTH})`);
        }
        const pkg = await readAgentDefinition(runtime, workspacePath, id, {
            roots: options?.roots,
            skipScopesAbove,
        });
        const visitKey = agentVisitKey(pkg.id, pkg.scope);
        if (visited.has(visitKey)) {
            throw new Error(`Circular agent inheritance detected: ${pkg.id} (${pkg.scope})`);
        }
        visited.add(visitKey);
        const baseId = pkg.frontmatter.base;
        const shouldAppend = pkg.frontmatter.prompt?.append !== false;
        if (!baseId || !shouldAppend) {
            return pkg.body;
        }
        const baseBody = await resolve(baseId, depth + 1, mergeSkipScopesAbove(skipScopesAbove, computeBaseSkipScope(baseId, id, pkg.scope)));
        const separator = baseBody.trim() && pkg.body.trim() ? "\n\n" : "";
        return `${baseBody}${separator}${pkg.body}`;
    }
    return resolve(agentId, 0, options?.skipScopesAbove);
}
//# sourceMappingURL=agentDefinitionsService.js.map