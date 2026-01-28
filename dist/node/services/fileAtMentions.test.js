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
const fsPromises = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const message_1 = require("../../common/types/message");
const runtimeFactory_1 = require("../../node/runtime/runtimeFactory");
const fileAtMentions_1 = require("./fileAtMentions");
(0, bun_test_1.describe)("injectFileAtMentions", () => {
    (0, bun_test_1.it)("expands @file mentions from earlier user messages even when the latest has none", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            await fsPromises.mkdir(path.join(tmpDir, "src"), { recursive: true });
            await fsPromises.writeFile(path.join(tmpDir, "src", "foo.ts"), ["line1", "line2", "line3"].join("\n"), "utf8");
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const messages = [
                (0, message_1.createUnixMessage)("u1", "user", "Please check @src/foo.ts"),
                (0, message_1.createUnixMessage)("a1", "assistant", "Sure."),
                (0, message_1.createUnixMessage)("u2", "user", "Now do X (no mentions)."),
            ];
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            // Injection should stay anchored to the *original* mention message.
            (0, bun_test_1.expect)(result).toHaveLength(4);
            (0, bun_test_1.expect)(result[0]?.metadata?.synthetic).toBe(true);
            (0, bun_test_1.expect)(result[1]).toEqual(messages[0]);
            (0, bun_test_1.expect)(result[2]).toEqual(messages[1]);
            (0, bun_test_1.expect)(result[3]).toEqual(messages[2]);
            const injectedText = result[0]?.parts.find((p) => p.type === "text")?.text ?? "";
            (0, bun_test_1.expect)(injectedText).toContain('<unix-file path="src/foo.ts"');
            (0, bun_test_1.expect)(injectedText).toContain("line1");
            (0, bun_test_1.expect)(injectedText).toContain("line2");
            (0, bun_test_1.expect)(injectedText).toContain("line3");
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("prioritizes the latest @file mention when the global cap is hit", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            await fsPromises.mkdir(path.join(tmpDir, "src"), { recursive: true });
            for (let i = 1; i <= 11; i++) {
                await fsPromises.writeFile(path.join(tmpDir, "src", `f${i}.ts`), `line${i}`, "utf8");
            }
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const messages = Array.from({ length: 11 }, (_, idx) => {
                const i = idx + 1;
                return (0, message_1.createUnixMessage)(`u${i}`, "user", `Please check @src/f${i}.ts`);
            });
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            const syntheticMessages = result.filter((m) => m.metadata?.synthetic === true);
            (0, bun_test_1.expect)(syntheticMessages).toHaveLength(10);
            const injectedText = syntheticMessages
                .map((m) => m.parts.find((p) => p.type === "text")?.text ?? "")
                .join("\n\n");
            (0, bun_test_1.expect)(injectedText).toContain('<unix-file path="src/f11.ts"');
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("injects a synthetic user message with file contents before the prompt", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            await fsPromises.mkdir(path.join(tmpDir, "src"), { recursive: true });
            await fsPromises.writeFile(path.join(tmpDir, "src", "foo.ts"), ["line1", "line2", "line3", "line4"].join("\n"), "utf8");
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const messages = [(0, message_1.createUnixMessage)("u1", "user", "Please check @src/foo.ts#L2-3")];
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toHaveLength(2);
            (0, bun_test_1.expect)(result[0]?.role).toBe("user");
            (0, bun_test_1.expect)(result[0]?.metadata?.synthetic).toBe(true);
            (0, bun_test_1.expect)(result[1]).toEqual(messages[0]);
            const injectedText = result[0]?.parts.find((p) => p.type === "text")?.text ?? "";
            (0, bun_test_1.expect)(injectedText).toContain('<unix-file path="src/foo.ts" range="L2-L3"');
            (0, bun_test_1.expect)(injectedText).toContain("```ts");
            (0, bun_test_1.expect)(injectedText).toContain("line2");
            (0, bun_test_1.expect)(injectedText).toContain("line3");
            (0, bun_test_1.expect)(injectedText).not.toContain("line1");
            (0, bun_test_1.expect)(injectedText).not.toContain("line4");
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("ignores non-existent file mentions", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const messages = [(0, message_1.createUnixMessage)("u1", "user", "Please check @src/missing.ts")];
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toEqual(messages);
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("injects root files like @Makefile", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            await fsPromises.writeFile(path.join(tmpDir, "Makefile"), ["line1", "line2"].join("\n"), "utf8");
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const messages = [(0, message_1.createUnixMessage)("u1", "user", "Please check @Makefile")];
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toHaveLength(2);
            (0, bun_test_1.expect)(result[0]?.metadata?.synthetic).toBe(true);
            const injectedText = result[0]?.parts.find((p) => p.type === "text")?.text ?? "";
            (0, bun_test_1.expect)(injectedText).toContain('<unix-file path="Makefile" range="L1-L2"');
            (0, bun_test_1.expect)(injectedText).toContain("line1");
            (0, bun_test_1.expect)(injectedText).toContain("line2");
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("ignores non-file @mentions with # fragments", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const messages = [(0, message_1.createUnixMessage)("u1", "user", "Ping @alice#123")];
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toEqual(messages);
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("skips tokens that already have persisted snapshots (fileAtMentionSnapshot metadata)", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-file-at-mentions-"));
        try {
            await fsPromises.mkdir(path.join(tmpDir, "src"), { recursive: true });
            await fsPromises.writeFile(path.join(tmpDir, "src", "foo.ts"), ["new line1", "new line2"].join("\n"), "utf8");
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            // Simulate a message that has already-materialized snapshot
            const snapshotMessage = (0, message_1.createUnixMessage)("snapshot-1", "user", '<unix-file path="src/foo.ts" range="L1-L2">\n```ts\nold line1\nold line2\n```\n</unix-file>', {
                timestamp: Date.now(),
                synthetic: true,
                fileAtMentionSnapshot: ["src/foo.ts"], // Token that was materialized
            });
            const userMessage = (0, message_1.createUnixMessage)("u1", "user", "Please check @src/foo.ts");
            const messages = [snapshotMessage, userMessage];
            const result = await (0, fileAtMentions_1.injectFileAtMentions)(messages, {
                runtime,
                workspacePath: tmpDir,
            });
            // Should NOT inject a new synthetic message because the token was already materialized
            // The messages should remain unchanged (snapshot + user message)
            (0, bun_test_1.expect)(result).toHaveLength(2);
            (0, bun_test_1.expect)(result[0]).toEqual(snapshotMessage);
            (0, bun_test_1.expect)(result[1]).toEqual(userMessage);
            // Verify the old content is preserved (not re-read from the file)
            const snapshotText = result[0]?.parts.find((p) => p.type === "text")?.text ?? "";
            (0, bun_test_1.expect)(snapshotText).toContain("old line1");
            (0, bun_test_1.expect)(snapshotText).not.toContain("new line1");
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
});
(0, bun_test_1.describe)("materializeFileAtMentions", () => {
    (0, bun_test_1.it)("materializes @file mentions into snapshot blocks", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-materialize-"));
        try {
            await fsPromises.mkdir(path.join(tmpDir, "src"), { recursive: true });
            await fsPromises.writeFile(path.join(tmpDir, "src", "foo.ts"), ["line1", "line2", "line3"].join("\n"), "utf8");
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const result = await (0, fileAtMentions_1.materializeFileAtMentions)("Please check @src/foo.ts", {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toHaveLength(1);
            (0, bun_test_1.expect)(result[0]?.token).toBe("src/foo.ts");
            (0, bun_test_1.expect)(result[0]?.resolvedPath).toBe(path.join(tmpDir, "src", "foo.ts"));
            (0, bun_test_1.expect)(result[0]?.block).toContain('<unix-file path="src/foo.ts"');
            (0, bun_test_1.expect)(result[0]?.block).toContain("line1");
            (0, bun_test_1.expect)(result[0]?.block).toContain("line2");
            (0, bun_test_1.expect)(result[0]?.content).toBe("line1\nline2\nline3");
            (0, bun_test_1.expect)(typeof result[0]?.modifiedTimeMs).toBe("number");
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("materializes line range mentions", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-materialize-"));
        try {
            await fsPromises.mkdir(path.join(tmpDir, "src"), { recursive: true });
            await fsPromises.writeFile(path.join(tmpDir, "src", "foo.ts"), ["line1", "line2", "line3", "line4"].join("\n"), "utf8");
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const result = await (0, fileAtMentions_1.materializeFileAtMentions)("Check @src/foo.ts#L2-3", {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toHaveLength(1);
            (0, bun_test_1.expect)(result[0]?.token).toBe("src/foo.ts#L2-3");
            (0, bun_test_1.expect)(result[0]?.block).toContain('range="L2-L3"');
            (0, bun_test_1.expect)(result[0]?.block).toContain("line2");
            (0, bun_test_1.expect)(result[0]?.block).toContain("line3");
            (0, bun_test_1.expect)(result[0]?.block).not.toContain("line1");
            (0, bun_test_1.expect)(result[0]?.block).not.toContain("line4");
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("returns empty array when no @file mentions found", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-materialize-"));
        try {
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const result = await (0, fileAtMentions_1.materializeFileAtMentions)("No file mentions here", {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toHaveLength(0);
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("ignores non-existent files", async () => {
        const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-materialize-"));
        try {
            const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: tmpDir });
            const result = await (0, fileAtMentions_1.materializeFileAtMentions)("Check @src/nonexistent.ts", {
                runtime,
                workspacePath: tmpDir,
            });
            (0, bun_test_1.expect)(result).toHaveLength(0);
        }
        finally {
            await fsPromises.rm(tmpDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=fileAtMentions.test.js.map