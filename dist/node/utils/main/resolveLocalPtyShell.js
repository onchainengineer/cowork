"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocalPtyShell = resolveLocalPtyShell;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const bashPath_1 = require("../../../node/utils/main/bashPath");
function defaultIsCommandAvailable(platform) {
    return (command) => {
        if (!command)
            return false;
        try {
            const result = (0, child_process_1.spawnSync)(platform === "win32" ? "where" : "which", [command], {
                stdio: "ignore",
            });
            return result.status === 0;
        }
        catch {
            return false;
        }
    };
}
function looksLikeWslShell(envShell) {
    // WSL (and other Unix-like environments) often surface POSIX-y paths like `/bin/bash`.
    // Those paths don't exist on Windows hosts, so treat them as WSL and ignore.
    if (envShell.startsWith("/")) {
        return true;
    }
    const normalized = envShell.replace(/\//g, "\\").toLowerCase();
    const base = path_1.default.win32.basename(normalized);
    return (normalized === "wsl" ||
        base === "wsl.exe" ||
        normalized === "bash" ||
        normalized === "bash.exe" ||
        normalized.endsWith("\\windows\\system32\\bash.exe"));
}
/**
 * Resolve the best shell to use for a *local* PTY session.
 *
 * We keep this as a small, mostly-pure helper so it can be unit-tested without
 * mutating `process.platform` / `process.env`.
 */
function resolveLocalPtyShell(params = {}) {
    const platform = params.platform ?? process.platform;
    const env = params.env ?? process.env;
    const isCommandAvailable = params.isCommandAvailable ?? defaultIsCommandAvailable(platform);
    const getBashPathFn = params.getBashPath ?? bashPath_1.getBashPath;
    // `process.env.SHELL` can be present-but-empty (""), especially in packaged apps.
    // Treat empty/whitespace as "unset".
    const envShell = env.SHELL?.trim();
    if (envShell) {
        // On Windows, `SHELL=bash` often routes to WSL (via System32\\bash.exe).
        // Ignore WSL shells and fall back to Git Bash/pwsh/cmd selection below.
        if (platform !== "win32" || !looksLikeWslShell(envShell)) {
            return { command: envShell, args: [] };
        }
    }
    if (platform === "win32") {
        // Prefer Git Bash when available (works well with repo tooling).
        try {
            const bashPath = getBashPathFn().trim();
            if (bashPath) {
                return { command: bashPath, args: ["--login", "-i"] };
            }
        }
        catch {
            // Git Bash not available; fall back to PowerShell / cmd.
        }
        if (isCommandAvailable("pwsh")) {
            return { command: "pwsh", args: [] };
        }
        if (isCommandAvailable("powershell")) {
            return { command: "powershell", args: [] };
        }
        const comspec = env.COMSPEC?.trim();
        return { command: comspec && comspec.length > 0 ? comspec : "cmd.exe", args: [] };
    }
    if (platform === "darwin") {
        return { command: "/bin/zsh", args: [] };
    }
    return { command: "/bin/bash", args: [] };
}
//# sourceMappingURL=resolveLocalPtyShell.js.map