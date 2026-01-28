"use strict";
/**
 * CLI environment detection for correct argv parsing across:
 * - bun/node direct invocation
 * - Electron dev mode (electron .)
 * - Packaged Electron app (./unix.AppImage)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLI_GLOBAL_FLAGS = void 0;
exports.detectCliEnvironment = detectCliEnvironment;
exports.getParseOptions = getParseOptions;
exports.getSubcommand = getSubcommand;
exports.getArgsAfterSplice = getArgsAfterSplice;
exports.isElectronLaunchArg = isElectronLaunchArg;
exports.isCommandAvailable = isCommandAvailable;
/**
 * Detect CLI environment from process state.
 *
 * | Environment       | isElectron | defaultApp | firstArgIndex |
 * |-------------------|------------|------------|---------------|
 * | bun/node          | false      | undefined  | 2             |
 * | electron dev      | true       | true       | 2             |
 * | packaged electron | true       | undefined  | 1             |
 */
function detectCliEnvironment(versions = process.versions, defaultApp = process.defaultApp) {
    const isElectron = "electron" in versions;
    const isPackagedElectron = isElectron && !defaultApp;
    const firstArgIndex = isPackagedElectron ? 1 : 2;
    return { isElectron, isPackagedElectron, firstArgIndex };
}
/**
 * Get Commander parse options for current environment.
 * Use with: program.parse(process.argv, getParseOptions())
 */
function getParseOptions(env = detectCliEnvironment()) {
    return { from: env.isPackagedElectron ? "electron" : "node" };
}
/**
 * Get the subcommand from argv (e.g., "server", "api", "run").
 */
function getSubcommand(argv = process.argv, env = detectCliEnvironment()) {
    return argv[env.firstArgIndex];
}
/**
 * Get args for a subcommand after the subcommand name has been spliced out.
 * This is what subcommand handlers (server.ts, api.ts, run.ts) use after
 * index.ts removes the subcommand name from process.argv.
 *
 * @example
 * // Original: ["electron", ".", "api", "--help"]
 * // After index.ts splices: ["electron", ".", "--help"]
 * // getArgsAfterSplice returns: ["--help"]
 */
function getArgsAfterSplice(argv = process.argv, env = detectCliEnvironment()) {
    return argv.slice(env.firstArgIndex);
}
/**
 * Global CLI flags that should show help/version, not launch desktop.
 * Commander auto-adds --help/-h. We add --version/-v in index.ts.
 *
 * IMPORTANT: If you add new global flags to the CLI in index.ts,
 * add them here too so packaged Electron routes them correctly.
 */
exports.CLI_GLOBAL_FLAGS = ["--help", "-h", "--version", "-v"];
/**
 * Check if the subcommand is an Electron launch arg (not a real CLI command).
 * In dev mode, "." or flags before the app path should launch desktop.
 * In packaged mode, Electron flags (--no-sandbox, etc.) should launch desktop,
 * but CLI flags (--help, --version) should show CLI help.
 */
function isElectronLaunchArg(subcommand, env = detectCliEnvironment()) {
    if (!env.isElectron)
        return false;
    if (env.isPackagedElectron) {
        // In packaged: flags that aren't CLI flags should launch desktop
        return Boolean(subcommand?.startsWith("-") &&
            !exports.CLI_GLOBAL_FLAGS.includes(subcommand));
    }
    // Dev mode: "." or any flag launches desktop
    return subcommand === "." || subcommand?.startsWith("-") === true;
}
/**
 * Check if a command is available in the current environment.
 * - "run" requires bun/node - it's not bundled in Electron.
 * - "desktop" only works when running inside Electron runtime.
 */
function isCommandAvailable(command, env = detectCliEnvironment()) {
    if (command === "run") {
        // run.ts is only available in bun/node, not bundled in Electron (dev or packaged)
        return !env.isElectron;
    }
    if (command === "desktop") {
        // Desktop command only works when running inside Electron runtime.
        // When run via node/bun (npx unix), require("../desktop/main") fails because
        // the Electron APIs aren't available. Users should download the packaged app.
        return env.isElectron;
    }
    return true;
}
//# sourceMappingURL=argv.js.map