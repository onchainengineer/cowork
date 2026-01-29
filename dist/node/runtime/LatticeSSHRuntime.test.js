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
const runtimeHelpers = __importStar(require("../../node/utils/runtime/helpers"));
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => { };
const LatticeSSHRuntime_1 = require("./LatticeSSHRuntime");
const SSHRuntime_1 = require("./SSHRuntime");
const transports_1 = require("./transports");
/**
 * Create a minimal mock LatticeService for testing.
 * Only mocks methods used by the tested code paths.
 */
function createMockLatticeService(overrides) {
    return {
        createWorkspace: (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            // default: no output
            for (const line of []) {
                yield line;
            }
        })()),
        deleteWorkspace: (0, bun_test_1.mock)(() => Promise.resolve()),
        ensureSSHConfig: (0, bun_test_1.mock)(() => Promise.resolve()),
        getWorkspaceStatus: (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "running" })),
        listWorkspaces: (0, bun_test_1.mock)(() => Promise.resolve([])),
        waitForStartupScripts: (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            // default: no output (startup scripts completed)
            for (const line of []) {
                yield line;
            }
        })()),
        workspaceExists: (0, bun_test_1.mock)(() => Promise.resolve(false)),
        ...overrides,
    };
}
/**
 * Create a LatticeSSHRuntime with minimal config for testing.
 */
function createRuntime(latticeConfig, latticeService) {
    const template = "template" in latticeConfig ? latticeConfig.template : "default-template";
    const config = {
        host: "placeholder.lattice",
        srcBaseDir: "~/src",
        lattice: {
            existingWorkspace: latticeConfig.existingWorkspace ?? false,
            workspaceName: latticeConfig.workspaceName,
            template,
        },
    };
    const transport = (0, transports_1.createSSHTransport)(config, false);
    return new LatticeSSHRuntime_1.LatticeSSHRuntime(config, transport, latticeService);
}
/**
 * Create an SSH+Lattice RuntimeConfig for finalizeConfig tests.
 */
function createSSHLatticeConfig(lattice) {
    return {
        type: "ssh",
        host: "placeholder.lattice",
        srcBaseDir: "~/src",
        lattice: {
            existingWorkspace: lattice.existingWorkspace ?? false,
            workspaceName: lattice.workspaceName,
            template: "default-template",
        },
    };
}
// =============================================================================
// Test Suite 1: finalizeConfig (name/host derivation)
// =============================================================================
(0, bun_test_1.describe)("LatticeSSHRuntime.finalizeConfig", () => {
    let latticeService;
    let runtime;
    (0, bun_test_1.beforeEach)(() => {
        latticeService = createMockLatticeService();
        runtime = createRuntime({}, latticeService);
    });
    (0, bun_test_1.describe)("new workspace mode", () => {
        (0, bun_test_1.it)("derives Lattice name from branch name when not provided", async () => {
            const config = createSSHLatticeConfig({ existingWorkspace: false });
            const result = await runtime.finalizeConfig("my-feature", config);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.data.type).toBe("ssh");
                if (result.data.type === "ssh") {
                    (0, bun_test_1.expect)(result.data.lattice?.workspaceName).toBe("unix-my-feature");
                    (0, bun_test_1.expect)(result.data.host).toBe("lattice.unix-my-feature");
                }
            }
        });
        (0, bun_test_1.it)("converts underscores to hyphens", async () => {
            const config = createSSHLatticeConfig({ existingWorkspace: false });
            const result = await runtime.finalizeConfig("my_feature_branch", config);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success && result.data.type === "ssh") {
                (0, bun_test_1.expect)(result.data.lattice?.workspaceName).toBe("unix-my-feature-branch");
                (0, bun_test_1.expect)(result.data.host).toBe("lattice.unix-my-feature-branch");
            }
        });
        (0, bun_test_1.it)("collapses multiple hyphens and trims leading/trailing", async () => {
            const config = createSSHLatticeConfig({ existingWorkspace: false });
            const result = await runtime.finalizeConfig("--my--feature--", config);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success && result.data.type === "ssh") {
                (0, bun_test_1.expect)(result.data.lattice?.workspaceName).toBe("unix-my-feature");
            }
        });
        (0, bun_test_1.it)("rejects names that fail regex after conversion", async () => {
            const config = createSSHLatticeConfig({ existingWorkspace: false });
            // Name with special chars that can't form a valid Lattice name (only hyphens/underscores become invalid)
            const result = await runtime.finalizeConfig("@#$%", config);
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("cannot be converted to a valid Lattice name");
            }
        });
        (0, bun_test_1.it)("uses provided workspaceName over branch name", async () => {
            const config = createSSHLatticeConfig({
                existingWorkspace: false,
                workspaceName: "custom-name",
            });
            const result = await runtime.finalizeConfig("branch-name", config);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success && result.data.type === "ssh") {
                (0, bun_test_1.expect)(result.data.lattice?.workspaceName).toBe("custom-name");
                (0, bun_test_1.expect)(result.data.host).toBe("lattice.custom-name");
            }
        });
    });
    (0, bun_test_1.describe)("existing workspace mode", () => {
        (0, bun_test_1.it)("requires workspaceName to be provided", async () => {
            const config = createSSHLatticeConfig({ existingWorkspace: true });
            const result = await runtime.finalizeConfig("branch-name", config);
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("required for existing workspaces");
            }
        });
        (0, bun_test_1.it)("keeps provided workspaceName and sets host", async () => {
            const config = createSSHLatticeConfig({
                existingWorkspace: true,
                workspaceName: "existing-ws",
            });
            const result = await runtime.finalizeConfig("branch-name", config);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success && result.data.type === "ssh") {
                (0, bun_test_1.expect)(result.data.lattice?.workspaceName).toBe("existing-ws");
                (0, bun_test_1.expect)(result.data.host).toBe("lattice.existing-ws");
            }
        });
    });
    (0, bun_test_1.it)("passes through non-SSH configs unchanged", async () => {
        const config = { type: "local" };
        const result = await runtime.finalizeConfig("branch", config);
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.data).toEqual(config);
        }
    });
    (0, bun_test_1.it)("passes through SSH configs without coder unchanged", async () => {
        const config = { type: "ssh", host: "example.com", srcBaseDir: "/src" };
        const result = await runtime.finalizeConfig("branch", config);
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.data).toEqual(config);
        }
    });
});
// =============================================================================
// Test Suite 2: deleteWorkspace behavior
// =============================================================================
(0, bun_test_1.describe)("LatticeSSHRuntime.deleteWorkspace", () => {
    /**
     * For deleteWorkspace tests, we mock SSHRuntime.prototype.deleteWorkspace
     * to control the parent class behavior.
     */
    let sshDeleteSpy;
    (0, bun_test_1.beforeEach)(() => {
        sshDeleteSpy = (0, bun_test_1.spyOn)(SSHRuntime_1.SSHRuntime.prototype, "deleteWorkspace").mockResolvedValue({
            success: true,
            deletedPath: "/path",
        });
    });
    (0, bun_test_1.afterEach)(() => {
        sshDeleteSpy.mockRestore();
    });
    (0, bun_test_1.it)("never calls latticeService.deleteWorkspace when existingWorkspace=true", async () => {
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "existing-ws" }, latticeService);
        await runtime.deleteWorkspace("/project", "ws", false);
        (0, bun_test_1.expect)(deleteWorkspace).not.toHaveBeenCalled();
    });
    (0, bun_test_1.it)("skips Coder deletion when workspaceName is not set", async () => {
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ deleteWorkspace });
        // No workspaceName provided
        const runtime = createRuntime({ existingWorkspace: false }, latticeService);
        const result = await runtime.deleteWorkspace("/project", "ws", false);
        (0, bun_test_1.expect)(deleteWorkspace).not.toHaveBeenCalled();
        (0, bun_test_1.expect)(result.success).toBe(true);
    });
    (0, bun_test_1.it)("skips Coder deletion when SSH delete fails and force=false", async () => {
        sshDeleteSpy.mockResolvedValue({ success: false, error: "dirty workspace" });
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws" }, latticeService);
        const result = await runtime.deleteWorkspace("/project", "ws", false);
        (0, bun_test_1.expect)(deleteWorkspace).not.toHaveBeenCalled();
        (0, bun_test_1.expect)(result.success).toBe(false);
    });
    (0, bun_test_1.it)("calls Coder deletion when SSH delete fails but force=true", async () => {
        sshDeleteSpy.mockResolvedValue({ success: false, error: "dirty workspace" });
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws" }, latticeService);
        await runtime.deleteWorkspace("/project", "ws", true);
        (0, bun_test_1.expect)(deleteWorkspace).toHaveBeenCalledWith("my-ws");
    });
    (0, bun_test_1.it)("returns combined error when SSH succeeds but Coder delete throws", async () => {
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.reject(new Error("Coder API error")));
        const latticeService = createMockLatticeService({ deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws" }, latticeService);
        const result = await runtime.deleteWorkspace("/project", "ws", false);
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("SSH delete succeeded");
            (0, bun_test_1.expect)(result.error).toContain("Coder API error");
        }
    });
    (0, bun_test_1.it)("succeeds immediately when Lattice workspace is already deleted", async () => {
        // getWorkspaceStatus returns { kind: "not_found" } when workspace doesn't exist
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "not_found" }));
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ getWorkspaceStatus, deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws" }, latticeService);
        const result = await runtime.deleteWorkspace("/project", "ws", false);
        // Should succeed without calling SSH delete or Coder delete
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(sshDeleteSpy).not.toHaveBeenCalled();
        (0, bun_test_1.expect)(deleteWorkspace).not.toHaveBeenCalled();
    });
    (0, bun_test_1.it)("proceeds with SSH cleanup when status check fails with API error", async () => {
        // API error (auth, network) - should NOT treat as "already deleted"
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "error", error: "coder timed out" }));
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ getWorkspaceStatus, deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws" }, latticeService);
        const result = await runtime.deleteWorkspace("/project", "ws", false);
        // Should proceed with SSH cleanup (which succeeds), then Coder delete
        (0, bun_test_1.expect)(sshDeleteSpy).toHaveBeenCalled();
        (0, bun_test_1.expect)(deleteWorkspace).toHaveBeenCalled();
        (0, bun_test_1.expect)(result.success).toBe(true);
    });
    (0, bun_test_1.it)("succeeds immediately when Lattice workspace status is 'deleting'", async () => {
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "deleting" }));
        const deleteWorkspace = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({ getWorkspaceStatus, deleteWorkspace });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws" }, latticeService);
        const result = await runtime.deleteWorkspace("/project", "ws", false);
        // Should succeed without calling SSH delete or Coder delete (workspace already dying)
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(sshDeleteSpy).not.toHaveBeenCalled();
        (0, bun_test_1.expect)(deleteWorkspace).not.toHaveBeenCalled();
    });
});
// =============================================================================
// Test Suite 3: validateBeforePersist (collision detection)
// =============================================================================
(0, bun_test_1.describe)("LatticeSSHRuntime.validateBeforePersist", () => {
    (0, bun_test_1.it)("returns error when Lattice workspace already exists", async () => {
        const workspaceExists = (0, bun_test_1.mock)(() => Promise.resolve(true));
        const latticeService = createMockLatticeService({ workspaceExists });
        const runtime = createRuntime({}, latticeService);
        const config = createSSHLatticeConfig({
            existingWorkspace: false,
            workspaceName: "my-ws",
        });
        const result = await runtime.validateBeforePersist("branch", config);
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("already exists");
        }
        (0, bun_test_1.expect)(workspaceExists).toHaveBeenCalledWith("my-ws");
    });
    (0, bun_test_1.it)("skips collision check for existingWorkspace=true", async () => {
        const workspaceExists = (0, bun_test_1.mock)(() => Promise.resolve(true));
        const latticeService = createMockLatticeService({ workspaceExists });
        const runtime = createRuntime({}, latticeService);
        const config = createSSHLatticeConfig({
            existingWorkspace: true,
            workspaceName: "existing-ws",
        });
        const result = await runtime.validateBeforePersist("branch", config);
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(workspaceExists).not.toHaveBeenCalled();
    });
});
// =============================================================================
// Test Suite 4: postCreateSetup (provisioning)
// =============================================================================
(0, bun_test_1.describe)("LatticeSSHRuntime.postCreateSetup", () => {
    let execBufferedSpy;
    (0, bun_test_1.beforeEach)(() => {
        execBufferedSpy = (0, bun_test_1.spyOn)(runtimeHelpers, "execBuffered").mockResolvedValue({
            stdout: "",
            stderr: "",
            exitCode: 0,
            duration: 0,
        });
    });
    (0, bun_test_1.afterEach)(() => {
        execBufferedSpy.mockRestore();
    });
    (0, bun_test_1.it)("creates a new Lattice workspace and prepares the directory", async () => {
        const createWorkspace = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "build line 1";
            yield "build line 2";
        })());
        const ensureSSHConfig = (0, bun_test_1.mock)(() => Promise.resolve());
        // Start with workspace not found, then return running after creation
        let workspaceCreated = false;
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve(workspaceCreated
            ? { kind: "ok", status: "running" }
            : { kind: "not_found" }));
        const latticeService = createMockLatticeService({
            createWorkspace,
            ensureSSHConfig,
            getWorkspaceStatus,
        });
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws", template: "my-template" }, latticeService);
        // Before postCreateSetup, ensureReady should fail (workspace doesn't exist on server)
        const beforeReady = await runtime.ensureReady();
        (0, bun_test_1.expect)(beforeReady.ready).toBe(false);
        if (!beforeReady.ready) {
            (0, bun_test_1.expect)(beforeReady.errorType).toBe("runtime_not_ready");
        }
        // Simulate workspace being created by postCreateSetup
        workspaceCreated = true;
        const steps = [];
        const stdout = [];
        const stderr = [];
        const initLogger = {
            logStep: (s) => {
                steps.push(s);
            },
            logStdout: (s) => {
                stdout.push(s);
            },
            logStderr: (s) => {
                stderr.push(s);
            },
            logComplete: noop,
        };
        await runtime.postCreateSetup({
            initLogger,
            projectPath: "/project",
            branchName: "branch",
            trunkBranch: "main",
            workspacePath: "/home/user/src/my-project/my-ws",
        });
        (0, bun_test_1.expect)(createWorkspace).toHaveBeenCalledWith("my-ws", "my-template", undefined, undefined, undefined);
        (0, bun_test_1.expect)(ensureSSHConfig).toHaveBeenCalled();
        (0, bun_test_1.expect)(execBufferedSpy).toHaveBeenCalled();
        // After postCreateSetup, ensureReady should succeed (workspace exists on server)
        const afterReady = await runtime.ensureReady();
        (0, bun_test_1.expect)(afterReady.ready).toBe(true);
        (0, bun_test_1.expect)(stdout).toEqual(["build line 1", "build line 2"]);
        (0, bun_test_1.expect)(stderr).toEqual([]);
        (0, bun_test_1.expect)(steps.join("\n")).toContain("Creating Lattice workspace");
        (0, bun_test_1.expect)(steps.join("\n")).toContain("Configuring SSH");
        (0, bun_test_1.expect)(steps.join("\n")).toContain("Preparing workspace directory");
    });
    (0, bun_test_1.it)("skips workspace creation when existingWorkspace=true and workspace is running", async () => {
        const createWorkspace = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "should not happen";
        })());
        const waitForStartupScripts = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "Already running";
        })());
        const ensureSSHConfig = (0, bun_test_1.mock)(() => Promise.resolve());
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "running" }));
        const latticeService = createMockLatticeService({
            createWorkspace,
            waitForStartupScripts,
            ensureSSHConfig,
            getWorkspaceStatus,
        });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "existing-ws" }, latticeService);
        await runtime.postCreateSetup({
            initLogger: {
                logStep: noop,
                logStdout: noop,
                logStderr: noop,
                logComplete: noop,
            },
            projectPath: "/project",
            branchName: "branch",
            trunkBranch: "main",
            workspacePath: "/home/user/src/my-project/existing-ws",
        });
        (0, bun_test_1.expect)(createWorkspace).not.toHaveBeenCalled();
        // waitForStartupScripts is called (it handles running workspaces quickly)
        (0, bun_test_1.expect)(waitForStartupScripts).toHaveBeenCalled();
        (0, bun_test_1.expect)(ensureSSHConfig).toHaveBeenCalled();
        (0, bun_test_1.expect)(execBufferedSpy).toHaveBeenCalled();
    });
    (0, bun_test_1.it)("uses waitForStartupScripts for existing stopped workspace (auto-starts via coder ssh)", async () => {
        const createWorkspace = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "should not happen";
        })());
        const waitForStartupScripts = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "Starting workspace...";
            yield "Build complete";
            yield "Startup scripts finished";
        })());
        const ensureSSHConfig = (0, bun_test_1.mock)(() => Promise.resolve());
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "stopped" }));
        const latticeService = createMockLatticeService({
            createWorkspace,
            waitForStartupScripts,
            ensureSSHConfig,
            getWorkspaceStatus,
        });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "existing-ws" }, latticeService);
        const loggedStdout = [];
        await runtime.postCreateSetup({
            initLogger: {
                logStep: noop,
                logStdout: (line) => loggedStdout.push(line),
                logStderr: noop,
                logComplete: noop,
            },
            projectPath: "/project",
            branchName: "branch",
            trunkBranch: "main",
            workspacePath: "/home/user/src/my-project/existing-ws",
        });
        (0, bun_test_1.expect)(createWorkspace).not.toHaveBeenCalled();
        (0, bun_test_1.expect)(waitForStartupScripts).toHaveBeenCalled();
        (0, bun_test_1.expect)(loggedStdout).toContain("Starting workspace...");
        (0, bun_test_1.expect)(loggedStdout).toContain("Startup scripts finished");
        (0, bun_test_1.expect)(ensureSSHConfig).toHaveBeenCalled();
    });
    (0, bun_test_1.it)("polls until stopping workspace becomes stopped before connecting", async () => {
        let pollCount = 0;
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => {
            pollCount++;
            // First 2 calls return "stopping", then "stopped"
            if (pollCount <= 2) {
                return Promise.resolve({ kind: "ok", status: "stopping" });
            }
            return Promise.resolve({ kind: "ok", status: "stopped" });
        });
        const waitForStartupScripts = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "Ready";
        })());
        const ensureSSHConfig = (0, bun_test_1.mock)(() => Promise.resolve());
        const latticeService = createMockLatticeService({
            getWorkspaceStatus,
            waitForStartupScripts,
            ensureSSHConfig,
        });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "stopping-ws" }, latticeService);
        (0, bun_test_1.spyOn)(runtime, "sleep").mockResolvedValue(undefined);
        const loggedSteps = [];
        await runtime.postCreateSetup({
            initLogger: {
                logStep: (step) => loggedSteps.push(step),
                logStdout: noop,
                logStderr: noop,
                logComplete: noop,
            },
            projectPath: "/project",
            branchName: "branch",
            trunkBranch: "main",
            workspacePath: "/home/user/src/my-project/stopping-ws",
        });
        // Should have polled status multiple times
        (0, bun_test_1.expect)(pollCount).toBeGreaterThan(2);
        (0, bun_test_1.expect)(loggedSteps.some((s) => s.includes("Waiting for Lattice workspace"))).toBe(true);
        (0, bun_test_1.expect)(waitForStartupScripts).toHaveBeenCalled();
    });
    (0, bun_test_1.it)("throws when workspaceName is missing", () => {
        const latticeService = createMockLatticeService();
        const runtime = createRuntime({ existingWorkspace: false, template: "tmpl" }, latticeService);
        return (0, bun_test_1.expect)(runtime.postCreateSetup({
            initLogger: {
                logStep: noop,
                logStdout: noop,
                logStderr: noop,
                logComplete: noop,
            },
            projectPath: "/project",
            branchName: "branch",
            trunkBranch: "main",
            workspacePath: "/home/user/src/my-project/ws",
        })).rejects.toThrow("Lattice workspace name is required");
    });
    (0, bun_test_1.it)("throws when template is missing for new workspaces", () => {
        const latticeService = createMockLatticeService();
        const runtime = createRuntime({ existingWorkspace: false, workspaceName: "my-ws", template: undefined }, latticeService);
        return (0, bun_test_1.expect)(runtime.postCreateSetup({
            initLogger: {
                logStep: noop,
                logStdout: noop,
                logStderr: noop,
                logComplete: noop,
            },
            projectPath: "/project",
            branchName: "branch",
            trunkBranch: "main",
            workspacePath: "/home/user/src/my-project/ws",
        })).rejects.toThrow("Lattice template is required");
    });
});
// =============================================================================
// Test Suite 5: ensureReady (runtime readiness + status events)
// =============================================================================
(0, bun_test_1.describe)("LatticeSSHRuntime.ensureReady", () => {
    (0, bun_test_1.it)("returns ready when workspace is already running", async () => {
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "running" }));
        const waitForStartupScripts = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "should not be called";
        })());
        const latticeService = createMockLatticeService({ getWorkspaceStatus, waitForStartupScripts });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "my-ws" }, latticeService);
        const events = [];
        const result = await runtime.ensureReady({
            statusSink: (e) => events.push(e),
        });
        (0, bun_test_1.expect)(result).toEqual({ ready: true });
        (0, bun_test_1.expect)(getWorkspaceStatus).toHaveBeenCalled();
        // Short-circuited because status is already "running"
        (0, bun_test_1.expect)(waitForStartupScripts).not.toHaveBeenCalled();
        (0, bun_test_1.expect)(events.map((e) => e.phase)).toEqual(["checking", "ready"]);
        (0, bun_test_1.expect)(events[0]?.runtimeType).toBe("ssh");
    });
    (0, bun_test_1.it)("connects via waitForStartupScripts when status is stopped (auto-starts)", async () => {
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "stopped" }));
        const waitForStartupScripts = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "Starting workspace...";
            yield "Workspace started";
        })());
        const latticeService = createMockLatticeService({ getWorkspaceStatus, waitForStartupScripts });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "my-ws" }, latticeService);
        const events = [];
        const result = await runtime.ensureReady({
            statusSink: (e) => events.push(e),
        });
        (0, bun_test_1.expect)(result).toEqual({ ready: true });
        (0, bun_test_1.expect)(waitForStartupScripts).toHaveBeenCalled();
        // We should see checking, then starting, then ready
        (0, bun_test_1.expect)(events[0]?.phase).toBe("checking");
        (0, bun_test_1.expect)(events.some((e) => e.phase === "starting")).toBe(true);
        (0, bun_test_1.expect)(events.at(-1)?.phase).toBe("ready");
    });
    (0, bun_test_1.it)("returns runtime_start_failed when waitForStartupScripts fails", async () => {
        const getWorkspaceStatus = (0, bun_test_1.mock)(() => Promise.resolve({ kind: "ok", status: "stopped" }));
        const waitForStartupScripts = (0, bun_test_1.mock)(() => (async function* () {
            await Promise.resolve();
            yield "Starting workspace...";
            throw new Error("connection failed");
        })());
        const latticeService = createMockLatticeService({ getWorkspaceStatus, waitForStartupScripts });
        const runtime = createRuntime({ existingWorkspace: true, workspaceName: "my-ws" }, latticeService);
        const events = [];
        const result = await runtime.ensureReady({
            statusSink: (e) => events.push(e),
        });
        (0, bun_test_1.expect)(result.ready).toBe(false);
        if (!result.ready) {
            (0, bun_test_1.expect)(result.errorType).toBe("runtime_start_failed");
            (0, bun_test_1.expect)(result.error).toContain("Failed to connect");
        }
        (0, bun_test_1.expect)(events.at(-1)?.phase).toBe("error");
    });
});
//# sourceMappingURL=LatticeSSHRuntime.test.js.map