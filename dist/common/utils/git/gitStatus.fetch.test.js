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
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const gitStatus_1 = require("./gitStatus");
describe("GIT_FETCH_SCRIPT", () => {
    test("fetches when remote ref moves to a commit already present locally", async () => {
        const tempDir = await (0, promises_1.mkdtemp)(path.join(os.tmpdir(), "unix-git-fetch-"));
        const originDir = path.join(tempDir, "origin.git");
        const workspaceDir = path.join(tempDir, "workspace");
        const run = (cmd, cwd) => (0, child_process_1.execSync)(cmd, { cwd, stdio: "pipe" }).toString().trim();
        try {
            // Initialize bare remote and clone it
            run(`git init --bare ${originDir}`);
            run(`git clone ${originDir} ${workspaceDir}`);
            // Basic git identity configuration
            run('git config user.email "test@example.com"', workspaceDir);
            run('git config user.name "Test User"', workspaceDir);
            run("git config commit.gpgsign false", workspaceDir);
            // Seed main with an initial commit
            await (0, promises_1.writeFile)(path.join(workspaceDir, "README.md"), "init\n");
            run("git add README.md", workspaceDir);
            run('git commit -m "init"', workspaceDir);
            run("git branch -M main", workspaceDir);
            run("git push -u origin main", workspaceDir);
            // Ensure remote HEAD points to main for deterministic primary branch detection
            run("git symbolic-ref HEAD refs/heads/main", originDir);
            // Create a commit on a feature branch (object exists locally)
            run("git checkout -b feature", workspaceDir);
            await (0, promises_1.writeFile)(path.join(workspaceDir, "feature.txt"), "feature\n");
            run("git add feature.txt", workspaceDir);
            run('git commit -m "feature"', workspaceDir);
            const featureSha = run("git rev-parse feature", workspaceDir);
            // Push the feature branch so the remote has the object but main stays old
            run("git push origin feature", workspaceDir);
            // Move remote main to the feature commit without updating local tracking ref
            run(`git update-ref refs/heads/main ${featureSha}`, originDir);
            const localBefore = run("git rev-parse origin/main", workspaceDir);
            expect(localBefore).not.toBe(featureSha);
            // Run the optimized fetch script (should update origin/main)
            run(gitStatus_1.GIT_FETCH_SCRIPT, workspaceDir);
            const localAfter = run("git rev-parse origin/main", workspaceDir);
            expect(localAfter).toBe(featureSha);
        }
        finally {
            await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
        }
    }, 20000);
});
//# sourceMappingURL=gitStatus.fetch.test.js.map