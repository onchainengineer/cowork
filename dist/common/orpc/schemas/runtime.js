"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeConfigSchema = exports.RuntimeAvailabilitySchema = exports.RuntimeAvailabilityStatusSchema = exports.DevcontainerConfigInfoSchema = exports.RuntimeModeSchema = void 0;
const zod_1 = require("zod");
const lattice_1 = require("./lattice");
exports.RuntimeModeSchema = zod_1.z.enum(["local", "worktree", "ssh", "docker", "devcontainer"]);
/**
 * Runtime configuration union type.
 *
 * COMPATIBILITY NOTE:
 * - `type: "local"` with `srcBaseDir` = legacy worktree config (for backward compat)
 * - `type: "local"` without `srcBaseDir` = new project-dir runtime
 * - `type: "worktree"` = explicit worktree runtime (new workspaces)
 *
 * This allows two-way compatibility: users can upgrade/downgrade without breaking workspaces.
 */
// Common field for background process output directory
const bgOutputDirField = zod_1.z
    .string()
    .optional()
    .meta({ description: "Directory for background process output (e.g., /tmp/unix-bashes)" });
exports.DevcontainerConfigInfoSchema = zod_1.z.object({
    path: zod_1.z.string(),
    label: zod_1.z.string(),
});
/**
 * Runtime availability status - discriminated union that can carry mode-specific data.
 * Most runtimes use the simple available/unavailable shape; devcontainer carries extra
 * config info when available.
 *
 * IMPORTANT: The configs-bearing shape MUST come before the plain `{ available: true }`
 * shape in the union. Zod matches the first valid schema, so if the plain shape comes
 * first, it will match and strip the `configs` field from devcontainer responses.
 */
exports.RuntimeAvailabilityStatusSchema = zod_1.z.union([
    // Devcontainer-specific: available with configs (must be first to preserve configs)
    zod_1.z.object({
        available: zod_1.z.literal(true),
        configs: zod_1.z.array(exports.DevcontainerConfigInfoSchema),
        cliVersion: zod_1.z.string().optional(),
    }),
    // Generic: available without extra data
    zod_1.z.object({ available: zod_1.z.literal(true) }),
    // Unavailable with reason
    zod_1.z.object({ available: zod_1.z.literal(false), reason: zod_1.z.string() }),
]);
exports.RuntimeAvailabilitySchema = zod_1.z.object({
    local: exports.RuntimeAvailabilityStatusSchema,
    worktree: exports.RuntimeAvailabilityStatusSchema,
    ssh: exports.RuntimeAvailabilityStatusSchema,
    docker: exports.RuntimeAvailabilityStatusSchema,
    devcontainer: exports.RuntimeAvailabilityStatusSchema,
});
exports.RuntimeConfigSchema = zod_1.z.union([
    // Legacy local with srcBaseDir (treated as worktree)
    zod_1.z.object({
        type: zod_1.z.literal("local"),
        srcBaseDir: zod_1.z.string().meta({
            description: "Base directory where all workspaces are stored (legacy worktree config)",
        }),
        bgOutputDir: bgOutputDirField,
    }),
    // New project-dir local (no srcBaseDir)
    zod_1.z.object({
        type: zod_1.z.literal("local"),
        bgOutputDir: bgOutputDirField,
    }),
    // Explicit worktree runtime
    zod_1.z.object({
        type: zod_1.z.literal("worktree"),
        srcBaseDir: zod_1.z
            .string()
            .meta({ description: "Base directory where all workspaces are stored (e.g., ~/.unix/src)" }),
        bgOutputDir: bgOutputDirField,
    }),
    // SSH runtime
    zod_1.z.object({
        type: zod_1.z.literal("ssh"),
        host: zod_1.z
            .string()
            .meta({ description: "SSH host (can be hostname, user@host, or SSH config alias)" }),
        srcBaseDir: zod_1.z
            .string()
            .meta({ description: "Base directory on remote host where all workspaces are stored" }),
        bgOutputDir: bgOutputDirField,
        identityFile: zod_1.z
            .string()
            .optional()
            .meta({ description: "Path to SSH private key (if not using ~/.ssh/config or ssh-agent)" }),
        port: zod_1.z.number().optional().meta({ description: "SSH port (default: 22)" }),
        lattice: lattice_1.LatticeWorkspaceConfigSchema.optional().meta({
            description: "Lattice workspace configuration (when using Lattice as SSH backend)",
        }),
    }),
    // Docker runtime - each workspace runs in its own container
    zod_1.z.object({
        type: zod_1.z.literal("docker"),
        image: zod_1.z.string().meta({ description: "Docker image to use (e.g., node:20)" }),
        containerName: zod_1.z
            .string()
            .optional()
            .meta({ description: "Container name (populated after workspace creation)" }),
        shareCredentials: zod_1.z.boolean().optional().meta({
            description: "Forward SSH agent and mount ~/.gitconfig read-only",
        }),
    }),
    // Devcontainer runtime - uses devcontainer CLI to build/run containers from devcontainer.json
    zod_1.z.object({
        type: zod_1.z.literal("devcontainer"),
        configPath: zod_1.z
            .string()
            .meta({ description: "Path to devcontainer.json (relative to project root)" }),
        shareCredentials: zod_1.z.boolean().optional().meta({
            description: "Forward SSH agent and mount ~/.gitconfig read-only",
        }),
    }),
]);
//# sourceMappingURL=runtime.js.map