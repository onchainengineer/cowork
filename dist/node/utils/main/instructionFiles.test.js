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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const instructionFiles_1 = require("./instructionFiles");
describe("instructionFiles", () => {
    let tempDir;
    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "instruction-test-"));
    });
    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    describe("readInstructionSet", () => {
        it("should return null when no instruction files exist", async () => {
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBeNull();
        });
        it("should return base instruction file content", async () => {
            await fs.writeFile(path.join(tempDir, "AGENTS.md"), "base instructions");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBe("base instructions");
        });
        it("should append AGENTS.local.md to base instructions", async () => {
            await fs.writeFile(path.join(tempDir, "AGENTS.md"), "base instructions");
            await fs.writeFile(path.join(tempDir, "AGENTS.local.md"), "local overrides");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBe("base instructions\n\nlocal overrides");
        });
        it("should work with AGENT.md + AGENTS.local.md", async () => {
            await fs.writeFile(path.join(tempDir, "AGENT.md"), "base content");
            await fs.writeFile(path.join(tempDir, "AGENTS.local.md"), "local content");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBe("base content\n\nlocal content");
        });
        it("should work with CLAUDE.md + AGENTS.local.md", async () => {
            await fs.writeFile(path.join(tempDir, "CLAUDE.md"), "base content");
            await fs.writeFile(path.join(tempDir, "AGENTS.local.md"), "local content");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBe("base content\n\nlocal content");
        });
        it("should ignore AGENTS.local.md if no base file exists", async () => {
            await fs.writeFile(path.join(tempDir, "AGENTS.local.md"), "local only");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBeNull();
        });
        it("should strip markdown comments from instructions", async () => {
            await fs.writeFile(path.join(tempDir, "AGENTS.md"), "<!-- secret -->\nVisible directive");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBe("Visible directive");
        });
        it("should return null if stripping comments leaves no content", async () => {
            await fs.writeFile(path.join(tempDir, "AGENTS.md"), "<!-- only comments -->");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBeNull();
        });
        it("should prefer AGENTS.md even if AGENT.md and AGENTS.local.md exist", async () => {
            await fs.writeFile(path.join(tempDir, "AGENTS.md"), "agents base");
            await fs.writeFile(path.join(tempDir, "AGENT.md"), "agent base");
            await fs.writeFile(path.join(tempDir, "AGENTS.local.md"), "local");
            const result = await (0, instructionFiles_1.readInstructionSet)(tempDir);
            expect(result).toBe("agents base\n\nlocal");
        });
    });
    describe("gatherInstructionSets", () => {
        it("should return empty array when no instructions exist", async () => {
            const dir1 = path.join(tempDir, "dir1");
            const dir2 = path.join(tempDir, "dir2");
            await fs.mkdir(dir1);
            await fs.mkdir(dir2);
            const result = await (0, instructionFiles_1.gatherInstructionSets)([dir1, dir2]);
            expect(result).toEqual([]);
        });
        it("should gather instructions from multiple directories", async () => {
            const dir1 = path.join(tempDir, "dir1");
            const dir2 = path.join(tempDir, "dir2");
            await fs.mkdir(dir1);
            await fs.mkdir(dir2);
            await fs.writeFile(path.join(dir1, "AGENTS.md"), "global instructions");
            await fs.writeFile(path.join(dir2, "AGENTS.md"), "workspace instructions");
            const result = await (0, instructionFiles_1.gatherInstructionSets)([dir1, dir2]);
            expect(result).toEqual(["global instructions", "workspace instructions"]);
        });
        it("should include local files in gathered instructions", async () => {
            const dir1 = path.join(tempDir, "dir1");
            const dir2 = path.join(tempDir, "dir2");
            await fs.mkdir(dir1);
            await fs.mkdir(dir2);
            await fs.writeFile(path.join(dir1, "AGENTS.md"), "global base");
            await fs.writeFile(path.join(dir1, "AGENTS.local.md"), "global local");
            await fs.writeFile(path.join(dir2, "AGENTS.md"), "workspace base");
            await fs.writeFile(path.join(dir2, "AGENTS.local.md"), "workspace local");
            const result = await (0, instructionFiles_1.gatherInstructionSets)([dir1, dir2]);
            expect(result).toEqual(["global base\n\nglobal local", "workspace base\n\nworkspace local"]);
        });
        it("should skip directories without instruction files", async () => {
            const dir1 = path.join(tempDir, "dir1");
            const dir2 = path.join(tempDir, "dir2");
            const dir3 = path.join(tempDir, "dir3");
            await fs.mkdir(dir1);
            await fs.mkdir(dir2);
            await fs.mkdir(dir3);
            await fs.writeFile(path.join(dir1, "AGENTS.md"), "dir1 content");
            await fs.writeFile(path.join(dir3, "AGENTS.md"), "dir3 content");
            // dir2 has no instruction files
            const result = await (0, instructionFiles_1.gatherInstructionSets)([dir1, dir2, dir3]);
            expect(result).toEqual(["dir1 content", "dir3 content"]);
        });
    });
});
//# sourceMappingURL=instructionFiles.test.js.map