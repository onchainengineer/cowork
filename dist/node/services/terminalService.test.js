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
const terminalService_1 = require("./terminalService");
const childProcess = __importStar(require("child_process"));
const fs = __importStar(require("fs/promises"));
// Mock dependencies
const mockConfig = {
    getAllWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve([
        {
            id: "ws-1",
            projectPath: "/tmp/project",
            name: "main",
            runtimeConfig: { type: "local", srcBaseDir: "/tmp" },
        },
    ])),
    srcDir: "/tmp",
};
const createSessionMock = (0, bun_test_1.mock)((params, _runtime, _path, onData, _onExit) => {
    // Simulate immediate data emission to test buffering
    onData("initial data");
    return Promise.resolve({
        sessionId: "session-1",
        workspaceId: params.workspaceId,
        cols: 80,
        rows: 24,
    });
});
const resizeMock = (0, bun_test_1.mock)(() => {
    /* no-op */
});
const sendInputMock = (0, bun_test_1.mock)(() => {
    /* no-op */
});
const closeSessionMock = (0, bun_test_1.mock)(() => {
    /* no-op */
});
const mockPTYService = {
    createSession: createSessionMock,
    closeSession: closeSessionMock,
    resize: resizeMock,
    sendInput: sendInputMock,
};
const openTerminalWindowMock = (0, bun_test_1.mock)(() => Promise.resolve());
const closeTerminalWindowMock = (0, bun_test_1.mock)(() => {
    /* no-op */
});
const mockWindowManager = {
    openTerminalWindow: openTerminalWindowMock,
    closeTerminalWindow: closeTerminalWindowMock,
};
(0, bun_test_1.describe)("TerminalService", () => {
    let service;
    (0, bun_test_1.beforeEach)(() => {
        service = new terminalService_1.TerminalService(mockConfig, mockPTYService);
        service.setTerminalWindowManager(mockWindowManager);
        createSessionMock.mockClear();
        resizeMock.mockClear();
        sendInputMock.mockClear();
        openTerminalWindowMock.mockClear();
    });
    (0, bun_test_1.it)("should create a session", async () => {
        const session = await service.create({
            workspaceId: "ws-1",
            cols: 80,
            rows: 24,
        });
        (0, bun_test_1.expect)(session.sessionId).toBe("session-1");
        (0, bun_test_1.expect)(session.workspaceId).toBe("ws-1");
        (0, bun_test_1.expect)(createSessionMock).toHaveBeenCalled();
    });
    (0, bun_test_1.it)("should handle resizing", () => {
        service.resize({ sessionId: "session-1", cols: 100, rows: 30 });
        (0, bun_test_1.expect)(resizeMock).toHaveBeenCalledWith({
            sessionId: "session-1",
            cols: 100,
            rows: 30,
        });
    });
    (0, bun_test_1.it)("should respond to DA1 terminal queries on the backend", async () => {
        let capturedOnData;
        // Override mock temporarily for this test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockPTYService.createSession = (0, bun_test_1.mock)((params, _runtime, _path, onData, _onExit) => {
            capturedOnData = onData;
            return Promise.resolve({
                sessionId: "session-da1",
                workspaceId: params.workspaceId,
                cols: params.cols,
                rows: params.rows,
            });
        });
        await service.create({ workspaceId: "ws-1", cols: 80, rows: 24 });
        if (!capturedOnData) {
            throw new Error("Expected createSession to capture onData callback");
        }
        // DA1 (Primary Device Attributes) query sent by many TUIs during startup.
        capturedOnData("\x1b[0c");
        // xterm/headless processes writes asynchronously.
        await new Promise((resolve) => setTimeout(resolve, 10));
        (0, bun_test_1.expect)(sendInputMock).toHaveBeenCalled();
        const calls = sendInputMock.mock.calls;
        if (calls.length === 0) {
            throw new Error("Expected sendInput to be called with DA1 response");
        }
        const [calledSessionId, response] = calls[calls.length - 1];
        (0, bun_test_1.expect)(calledSessionId).toBe("session-da1");
        (0, bun_test_1.expect)(response.startsWith("\x1b[?")).toBe(true);
        (0, bun_test_1.expect)(response.endsWith("c")).toBe(true);
        // Restore mock (since we replaced the reference on the object)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockPTYService.createSession = createSessionMock;
    });
    (0, bun_test_1.it)("should handle input", () => {
        service.sendInput("session-1", "ls\n");
        (0, bun_test_1.expect)(sendInputMock).toHaveBeenCalledWith("session-1", "ls\n");
    });
    (0, bun_test_1.it)("should open terminal window via manager", async () => {
        await service.openWindow("ws-1");
        // openWindow(workspaceId, sessionId?) passes sessionId as undefined when not provided
        (0, bun_test_1.expect)(openTerminalWindowMock).toHaveBeenCalledWith("ws-1", undefined);
    });
    (0, bun_test_1.it)("should handle session exit", async () => {
        // We need to capture the onExit callback passed to createSession
        let capturedOnExit;
        // Override mock temporarily for this test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockPTYService.createSession = (0, bun_test_1.mock)((params, _runtime, _path, _onData, onExit) => {
            capturedOnExit = onExit;
            return Promise.resolve({
                sessionId: "session-2",
                workspaceId: params.workspaceId,
                cols: 80,
                rows: 24,
            });
        });
        await service.create({ workspaceId: "ws-1", cols: 80, rows: 24 });
        let exitCode = null;
        service.onExit("session-2", (code) => {
            exitCode = code;
        });
        // Simulate exit
        if (capturedOnExit)
            capturedOnExit(0);
        (0, bun_test_1.expect)(exitCode).toBe(0);
        // Restore mock (optional if beforeEach resets, but we are replacing the reference on the object)
        // Actually best to restore it.
        // However, since we defined mockPTYService as a const object, we can't easily replace properties safely if they are readonly.
        // But they are not readonly in the mock definition.
        // Let's just restore it to createSessionMock.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockPTYService.createSession = createSessionMock;
    });
});
(0, bun_test_1.describe)("TerminalService.openNative", () => {
    let service;
    // Using simplified mock types since spawnSync has complex overloads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let spawnSpy;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let spawnSyncSpy;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fsStatSpy;
    let originalPlatform;
    // Helper to create a mock child process
    const createMockChildProcess = () => ({
        unref: (0, bun_test_1.mock)(() => undefined),
        on: (0, bun_test_1.mock)(() => undefined),
        pid: 12345,
    });
    // Config with local workspace
    const configWithLocalWorkspace = {
        getAllWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve([
            {
                id: "ws-local",
                projectPath: "/tmp/project",
                name: "main",
                namedWorkspacePath: "/tmp/project/main",
                runtimeConfig: { type: "local", srcBaseDir: "/tmp" },
            },
        ])),
        srcDir: "/tmp",
    };
    // Config with SSH workspace
    const configWithSSHWorkspace = {
        getAllWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve([
            {
                id: "ws-ssh",
                projectPath: "/home/user/project",
                name: "feature",
                namedWorkspacePath: "/home/user/project/feature",
                runtimeConfig: {
                    type: "ssh",
                    host: "remote.example.com",
                    port: 2222,
                    identityFile: "~/.ssh/id_rsa",
                },
            },
        ])),
        srcDir: "/tmp",
    };
    (0, bun_test_1.beforeEach)(() => {
        // Store original platform
        originalPlatform = process.platform;
        // Spy on spawn to capture calls without actually spawning processes
        // Using `as unknown as` to bypass complex overload matching
        spawnSpy = (0, bun_test_1.spyOn)(childProcess, "spawn").mockImplementation((() => createMockChildProcess()));
        // Spy on spawnSync for command availability checks
        spawnSyncSpy = (0, bun_test_1.spyOn)(childProcess, "spawnSync").mockImplementation((() => ({
            status: 0,
            output: [null, "/usr/bin/cmd"],
        })));
        // Spy on fs.stat to reject (no ghostty installed by default)
        fsStatSpy = (0, bun_test_1.spyOn)(fs, "stat").mockImplementation((() => Promise.reject(new Error("ENOENT"))));
    });
    (0, bun_test_1.afterEach)(() => {
        // Restore original platform
        Object.defineProperty(process, "platform", { value: originalPlatform });
        // Restore spies
        spawnSpy.mockRestore();
        spawnSyncSpy.mockRestore();
        fsStatSpy.mockRestore();
    });
    /**
     * Helper to set the platform for testing
     */
    function setPlatform(platform) {
        Object.defineProperty(process, "platform", { value: platform });
    }
    (0, bun_test_1.describe)("macOS (darwin)", () => {
        (0, bun_test_1.beforeEach)(() => {
            setPlatform("darwin");
        });
        (0, bun_test_1.it)("should open Terminal.app for local workspace when ghostty is not available", async () => {
            // spawnSync returns non-zero for ghostty check (not available)
            spawnSyncSpy.mockImplementation((cmd, args) => {
                if (cmd === "which" && args?.[0] === "ghostty") {
                    return { status: 1 }; // ghostty not found
                }
                return { status: 0 }; // other commands available
            });
            service = new terminalService_1.TerminalService(configWithLocalWorkspace, mockPTYService);
            await service.openNative("ws-local");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            // Type assertion for spawn call args: [command, args, options]
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("open");
            (0, bun_test_1.expect)(call[1]).toEqual(["-a", "Terminal", "/tmp/project/main"]);
            (0, bun_test_1.expect)(call[2]?.detached).toBe(true);
            (0, bun_test_1.expect)(call[2]?.stdio).toBe("ignore");
        });
        (0, bun_test_1.it)("should open Ghostty for local workspace when available", async () => {
            // Make ghostty available via fs.stat (common install path)
            fsStatSpy.mockImplementation((path) => {
                if (path === "/Applications/Ghostty.app/Contents/MacOS/ghostty") {
                    return Promise.resolve({ isFile: () => true, mode: 0o755 });
                }
                return Promise.reject(new Error("ENOENT"));
            });
            service = new terminalService_1.TerminalService(configWithLocalWorkspace, mockPTYService);
            await service.openNative("ws-local");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("open");
            (0, bun_test_1.expect)(call[1]).toContain("-a");
            (0, bun_test_1.expect)(call[1]).toContain("Ghostty");
            (0, bun_test_1.expect)(call[1]).toContain("/tmp/project/main");
        });
        (0, bun_test_1.it)("should use osascript for SSH workspace with Terminal.app", async () => {
            // No ghostty available
            spawnSyncSpy.mockImplementation((cmd, args) => {
                if (cmd === "which" && args?.[0] === "ghostty") {
                    return { status: 1 };
                }
                return { status: 0 };
            });
            service = new terminalService_1.TerminalService(configWithSSHWorkspace, mockPTYService);
            await service.openNative("ws-ssh");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("osascript");
            (0, bun_test_1.expect)(call[1]?.[0]).toBe("-e");
            // Verify the AppleScript contains SSH command with proper args
            const script = call[1]?.[1];
            (0, bun_test_1.expect)(script).toContain('tell application "Terminal"');
            (0, bun_test_1.expect)(script).toContain("ssh");
            (0, bun_test_1.expect)(script).toContain("-p 2222"); // port
            (0, bun_test_1.expect)(script).toContain("-i ~/.ssh/id_rsa"); // identity file
            (0, bun_test_1.expect)(script).toContain("remote.example.com"); // host
        });
    });
    (0, bun_test_1.describe)("Windows (win32)", () => {
        (0, bun_test_1.beforeEach)(() => {
            setPlatform("win32");
        });
        (0, bun_test_1.it)("should open cmd for local workspace", async () => {
            service = new terminalService_1.TerminalService(configWithLocalWorkspace, mockPTYService);
            await service.openNative("ws-local");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("cmd");
            (0, bun_test_1.expect)(call[1]).toEqual(["/c", "start", "cmd", "/K", "cd", "/D", "/tmp/project/main"]);
            (0, bun_test_1.expect)(call[2]?.shell).toBe(true);
        });
        (0, bun_test_1.it)("should open cmd with SSH for SSH workspace", async () => {
            service = new terminalService_1.TerminalService(configWithSSHWorkspace, mockPTYService);
            await service.openNative("ws-ssh");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("cmd");
            (0, bun_test_1.expect)(call[1]?.[0]).toBe("/c");
            (0, bun_test_1.expect)(call[1]?.[1]).toBe("start");
            (0, bun_test_1.expect)(call[1]).toContain("ssh");
            (0, bun_test_1.expect)(call[1]).toContain("-p");
            (0, bun_test_1.expect)(call[1]).toContain("2222");
            (0, bun_test_1.expect)(call[1]).toContain("remote.example.com");
        });
    });
    (0, bun_test_1.describe)("Linux", () => {
        (0, bun_test_1.beforeEach)(() => {
            setPlatform("linux");
        });
        (0, bun_test_1.it)("should try terminal emulators in order of preference", async () => {
            // Make gnome-terminal the first available
            spawnSyncSpy.mockImplementation((cmd, args) => {
                if (cmd === "which") {
                    const terminal = args?.[0];
                    // x-terminal-emulator, ghostty, alacritty, kitty, wezterm not found
                    // gnome-terminal found
                    if (terminal === "gnome-terminal") {
                        return { status: 0 };
                    }
                    return { status: 1 };
                }
                return { status: 0 };
            });
            service = new terminalService_1.TerminalService(configWithLocalWorkspace, mockPTYService);
            await service.openNative("ws-local");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("gnome-terminal");
            (0, bun_test_1.expect)(call[1]).toContain("--working-directory");
            (0, bun_test_1.expect)(call[1]).toContain("/tmp/project/main");
        });
        (0, bun_test_1.it)("should throw error when no terminal emulator is found", async () => {
            // All terminals not found
            spawnSyncSpy.mockImplementation(() => ({ status: 1 }));
            service = new terminalService_1.TerminalService(configWithLocalWorkspace, mockPTYService);
            // eslint-disable-next-line @typescript-eslint/await-thenable
            await (0, bun_test_1.expect)(service.openNative("ws-local")).rejects.toThrow("No terminal emulator found");
        });
        (0, bun_test_1.it)("should pass SSH args to terminal for SSH workspace", async () => {
            // Make alacritty available
            spawnSyncSpy.mockImplementation((cmd, args) => {
                if (cmd === "which" && args?.[0] === "alacritty") {
                    return { status: 0 };
                }
                return { status: 1 };
            });
            service = new terminalService_1.TerminalService(configWithSSHWorkspace, mockPTYService);
            await service.openNative("ws-ssh");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledTimes(1);
            const call = spawnSpy.mock.calls[0];
            (0, bun_test_1.expect)(call[0]).toBe("alacritty");
            (0, bun_test_1.expect)(call[1]).toContain("-e");
            (0, bun_test_1.expect)(call[1]).toContain("ssh");
            (0, bun_test_1.expect)(call[1]).toContain("-p");
            (0, bun_test_1.expect)(call[1]).toContain("2222");
        });
    });
    (0, bun_test_1.describe)("error handling", () => {
        (0, bun_test_1.beforeEach)(() => {
            setPlatform("darwin");
            spawnSyncSpy.mockImplementation(() => ({ status: 0 }));
        });
        (0, bun_test_1.it)("should throw error for non-existent workspace", async () => {
            service = new terminalService_1.TerminalService(configWithLocalWorkspace, mockPTYService);
            // eslint-disable-next-line @typescript-eslint/await-thenable
            await (0, bun_test_1.expect)(service.openNative("non-existent")).rejects.toThrow("Workspace not found: non-existent");
        });
    });
});
//# sourceMappingURL=terminalService.test.js.map