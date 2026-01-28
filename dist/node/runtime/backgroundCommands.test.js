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
const bun_test_1 = require("bun:test");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const backgroundCommands_1 = require("./backgroundCommands");
(0, bun_test_1.describe)("backgroundCommands", () => {
    (0, bun_test_1.describe)("shellQuote", () => {
        (0, bun_test_1.it)("quotes empty string", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("")).toBe("''");
        });
        (0, bun_test_1.it)("quotes simple strings and paths", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("hello")).toBe("'hello'");
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("/path/with spaces/file")).toBe("'/path/with spaces/file'");
        });
        (0, bun_test_1.it)("escapes single quotes", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("it's")).toBe("'it'\"'\"'s'");
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("it's a 'test'")).toBe("'it'\"'\"'s a '\"'\"'test'\"'\"''");
        });
        (0, bun_test_1.it)("preserves special characters inside quotes", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("$HOME")).toBe("'$HOME'");
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("a && b")).toBe("'a && b'");
            (0, bun_test_1.expect)((0, backgroundCommands_1.shellQuote)("foo\nbar")).toBe("'foo\nbar'");
        });
    });
    (0, bun_test_1.describe)("buildWrapperScript", () => {
        (0, bun_test_1.it)("builds script with trap, cd, and user script joined by &&", () => {
            const result = (0, backgroundCommands_1.buildWrapperScript)({
                exitCodePath: "/tmp/exit_code",
                cwd: "/home/user/project",
                script: "echo hello",
            });
            (0, bun_test_1.expect)(result).toBe(`__UNIX_EXIT_CODE_PATH='/tmp/exit_code' && trap 'echo $? > "$__UNIX_EXIT_CODE_PATH"' EXIT && cd '/home/user/project' && echo hello`);
        });
        (0, bun_test_1.it)("includes env exports", () => {
            const result = (0, backgroundCommands_1.buildWrapperScript)({
                exitCodePath: "/tmp/exit_code",
                cwd: "/home/user",
                env: { FOO: "bar", BAZ: "qux" },
                script: "env",
            });
            (0, bun_test_1.expect)(result).toContain("export FOO='bar'");
            (0, bun_test_1.expect)(result).toContain("export BAZ='qux'");
        });
        (0, bun_test_1.it)("quotes paths with spaces", () => {
            const result = (0, backgroundCommands_1.buildWrapperScript)({
                exitCodePath: "/tmp/my dir/exit_code",
                cwd: "/home/user/my project",
                script: "ls",
            });
            (0, bun_test_1.expect)(result).toContain("'/tmp/my dir/exit_code'");
            (0, bun_test_1.expect)(result).toContain("'/home/user/my project'");
        });
        (0, bun_test_1.it)("produces valid bash when exit code path contains spaces", async () => {
            // Regression test: spaces in process ID (display_name) caused invalid trap syntax
            // The trap command needs to properly nest quoted paths
            const testDir = `/tmp/PR Checks ${Date.now()}`;
            const exitCodePath = `${testDir}/exit_code`;
            const result = (0, backgroundCommands_1.buildWrapperScript)({
                exitCodePath,
                cwd: "/tmp",
                script: "exit 42",
            });
            // The wrapper script should be valid bash - execute it and verify exit code is captured
            await fs.mkdir(testDir, { recursive: true });
            // Ensure no stale file
            await fs.rm(exitCodePath, { force: true });
            try {
                (0, child_process_1.execSync)(`bash -c ${(0, backgroundCommands_1.shellQuote)(result)}`, { stdio: "pipe" });
            }
            catch {
                // Expected - script exits with 42
            }
            // The exit code file MUST exist if the trap worked correctly
            const exitCode = await fs.readFile(exitCodePath, "utf-8");
            (0, bun_test_1.expect)(exitCode.trim()).toBe("42");
            await fs.rm(testDir, { recursive: true });
        });
        (0, bun_test_1.it)("escapes single quotes in env values", () => {
            const result = (0, backgroundCommands_1.buildWrapperScript)({
                exitCodePath: "/tmp/exit_code",
                cwd: "/home",
                env: { MSG: "it's a test" },
                script: "echo $MSG",
            });
            (0, bun_test_1.expect)(result).toContain("export MSG='it'\"'\"'s a test'");
        });
    });
    (0, bun_test_1.describe)("buildSpawnCommand", () => {
        (0, bun_test_1.it)("uses set -m, nohup, unified output with 2>&1, and echoes PID", () => {
            const result = (0, backgroundCommands_1.buildSpawnCommand)({
                wrapperScript: "echo hello",
                outputPath: "/tmp/output.log",
            });
            (0, bun_test_1.expect)(result).toMatch(/^\(set -m; nohup 'bash' -c /);
            (0, bun_test_1.expect)(result).toContain("> '/tmp/output.log' 2>&1");
            (0, bun_test_1.expect)(result).toContain("< /dev/null");
            (0, bun_test_1.expect)(result).toContain("& echo $!)");
        });
        (0, bun_test_1.it)("uses custom bash path (including paths with spaces)", () => {
            const result = (0, backgroundCommands_1.buildSpawnCommand)({
                wrapperScript: "echo hello",
                outputPath: "/tmp/output.log",
                bashPath: "/c/Program Files/Git/bin/bash.exe",
            });
            (0, bun_test_1.expect)(result).toContain("'/c/Program Files/Git/bin/bash.exe' -c");
        });
        (0, bun_test_1.it)("quotes the wrapper script", () => {
            const result = (0, backgroundCommands_1.buildSpawnCommand)({
                wrapperScript: "echo 'hello world'",
                outputPath: "/tmp/output.log",
            });
            (0, bun_test_1.expect)(result).toContain("-c 'echo '\"'\"'hello world'\"'\"''");
        });
    });
    (0, bun_test_1.describe)("buildTerminateCommand", () => {
        (0, bun_test_1.it)("sends SIGTERM then SIGKILL to process group using negative PID", () => {
            const result = (0, backgroundCommands_1.buildTerminateCommand)(1234, "/tmp/exit_code");
            (0, bun_test_1.expect)(result).toContain("kill -15 -1234 2>/dev/null || true");
            (0, bun_test_1.expect)(result).toContain("sleep 2");
            (0, bun_test_1.expect)(result).toContain("kill -0 -1234");
            (0, bun_test_1.expect)(result).toContain("kill -9 -1234 2>/dev/null || true");
            (0, bun_test_1.expect)(result).toContain("echo 137 >"); // SIGKILL exit code
            (0, bun_test_1.expect)(result).toContain("echo 143 >"); // SIGTERM exit code (written after process exits)
        });
        (0, bun_test_1.it)("quotes exit code path with spaces", () => {
            const result = (0, backgroundCommands_1.buildTerminateCommand)(1234, "/tmp/my dir/exit_code");
            (0, bun_test_1.expect)(result).toContain("'/tmp/my dir/exit_code'");
        });
        (0, bun_test_1.it)("uses custom quotePath function for SSH tilde expansion", () => {
            const expandTilde = (p) => (p.startsWith("~/") ? `"$HOME/${p.slice(2)}"` : `"${p}"`);
            const result = (0, backgroundCommands_1.buildTerminateCommand)(1234, "~/unix/exit_code", expandTilde);
            (0, bun_test_1.expect)(result).toContain('"$HOME/unix/exit_code"');
        });
    });
    (0, bun_test_1.describe)("parseExitCode", () => {
        (0, bun_test_1.it)("parses valid exit codes with whitespace", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.parseExitCode)("0")).toBe(0);
            (0, bun_test_1.expect)((0, backgroundCommands_1.parseExitCode)("  137\n")).toBe(137);
            (0, bun_test_1.expect)((0, backgroundCommands_1.parseExitCode)("\t42\t")).toBe(42);
        });
        (0, bun_test_1.it)("returns null for empty or non-numeric input", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.parseExitCode)("")).toBeNull();
            (0, bun_test_1.expect)((0, backgroundCommands_1.parseExitCode)("   ")).toBeNull();
            (0, bun_test_1.expect)((0, backgroundCommands_1.parseExitCode)("abc")).toBeNull();
        });
    });
    (0, bun_test_1.describe)("parsePid", () => {
        (0, bun_test_1.it)("parses valid PID with whitespace", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("1234")).toBe(1234);
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("  1234\n")).toBe(1234);
        });
        (0, bun_test_1.it)("returns null for invalid input", () => {
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("")).toBeNull();
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("   ")).toBeNull();
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("abc")).toBeNull();
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("-1")).toBeNull();
            (0, bun_test_1.expect)((0, backgroundCommands_1.parsePid)("0")).toBeNull();
        });
    });
});
//# sourceMappingURL=backgroundCommands.test.js.map