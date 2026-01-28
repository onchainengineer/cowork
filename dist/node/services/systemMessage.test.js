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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const systemMessage_1 = require("./systemMessage");
const workspace_1 = require("../../common/constants/workspace");
const extractTagContent = (message, tagName) => {
    const pattern = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*</${tagName}>`, "i");
    const match = pattern.exec(message);
    return match ? match[1].trim() : null;
};
const bun_test_1 = require("bun:test");
const LocalRuntime_1 = require("../../node/runtime/LocalRuntime");
(0, bun_test_1.describe)("extractToolInstructions", () => {
    // Use a model that has bash tool available
    const modelString = "anthropic:claude-sonnet-4-20250514";
    (0, bun_test_1.test)("extracts tool section from agentInstructions first", () => {
        const globalInstructions = `## Tool: bash
From global: Use rg for searching.
`;
        const contextInstructions = `## Tool: bash
From context: Use fd for finding.
`;
        const agentInstructions = `## Tool: bash
From agent: Use ripgrep alias.
`;
        const result = (0, systemMessage_1.extractToolInstructions)(globalInstructions, contextInstructions, modelString, {
            agentInstructions,
        });
        (0, bun_test_1.expect)(result.bash).toContain("From agent: Use ripgrep alias.");
        (0, bun_test_1.expect)(result.bash).not.toContain("From context");
        (0, bun_test_1.expect)(result.bash).not.toContain("From global");
    });
    (0, bun_test_1.test)("falls back to context when agentInstructions has no matching tool section", () => {
        const globalInstructions = `## Tool: bash
From global: Use rg for searching.
`;
        const contextInstructions = `## Tool: bash
From context: Use fd for finding.
`;
        const agentInstructions = `## Tool: file_read
From agent: Read files carefully.
`;
        const result = (0, systemMessage_1.extractToolInstructions)(globalInstructions, contextInstructions, modelString, {
            agentInstructions,
        });
        (0, bun_test_1.expect)(result.bash).toContain("From context: Use fd for finding.");
        (0, bun_test_1.expect)(result.bash).not.toContain("From global");
    });
    (0, bun_test_1.test)("falls back to global when neither agentInstructions nor context has tool section", () => {
        const globalInstructions = `## Tool: bash
From global: Use rg for searching.
`;
        const contextInstructions = `General context instructions.`;
        const agentInstructions = `General agent instructions.`;
        const result = (0, systemMessage_1.extractToolInstructions)(globalInstructions, contextInstructions, modelString, {
            agentInstructions,
        });
        (0, bun_test_1.expect)(result.bash).toContain("From global: Use rg for searching.");
    });
    (0, bun_test_1.test)("returns empty object when no tool sections found", () => {
        const result = (0, systemMessage_1.extractToolInstructions)("No tool sections here.", "Nor here.", modelString, {
            agentInstructions: "Or here.",
        });
        (0, bun_test_1.expect)(result.bash).toBeUndefined();
    });
});
(0, bun_test_1.describe)("buildSystemMessage", () => {
    let tempDir;
    let projectDir;
    let workspaceDir;
    let globalDir;
    let mockHomedir;
    let runtime;
    let originalMuxRoot;
    (0, bun_test_1.beforeEach)(async () => {
        // Snapshot any existing UNIX_ROOT so we can restore it after the test.
        originalMuxRoot = process.env.UNIX_ROOT;
        // Create temp directory for test
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "systemMessage-test-"));
        projectDir = path.join(tempDir, "project");
        workspaceDir = path.join(tempDir, "workspace");
        globalDir = path.join(tempDir, ".unix");
        await fs.mkdir(projectDir, { recursive: true });
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.mkdir(globalDir, { recursive: true });
        // Mock homedir to return our test directory (getSystemDirectory will append .unix)
        mockHomedir = (0, bun_test_1.spyOn)(os, "homedir");
        mockHomedir.mockReturnValue(tempDir);
        // Force unix home to our test .unix directory regardless of host UNIX_ROOT.
        process.env.UNIX_ROOT = globalDir;
        // Create a local runtime for tests
        runtime = new LocalRuntime_1.LocalRuntime(tempDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
        // Restore environment override
        if (originalMuxRoot === undefined) {
            delete process.env.UNIX_ROOT;
        }
        else {
            process.env.UNIX_ROOT = originalMuxRoot;
        }
        // Restore the original homedir
        mockHomedir?.mockRestore();
    });
    (0, bun_test_1.test)("includes general instructions in custom-instructions", async () => {
        await fs.writeFile(path.join(projectDir, "AGENTS.md"), `# General Instructions
Always be helpful.
Use clear examples.
`);
        const metadata = {
            id: "test-workspace",
            name: "test-workspace",
            projectName: "test-project",
            projectPath: projectDir,
            runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
        };
        const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir);
        const customInstructions = extractTagContent(systemMessage, "custom-instructions") ?? "";
        (0, bun_test_1.expect)(customInstructions).toContain("Always be helpful.");
        (0, bun_test_1.expect)(customInstructions).toContain("Use clear examples.");
    });
    (0, bun_test_1.test)("includes model-specific section when regex matches active model", async () => {
        await fs.writeFile(path.join(projectDir, "AGENTS.md"), `# Instructions
## Model: sonnet
Respond to Sonnet tickets in two sentences max.
`);
        const metadata = {
            id: "test-workspace",
            name: "test-workspace",
            projectName: "test-project",
            projectPath: projectDir,
            runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
        };
        const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir, undefined, "anthropic:claude-3.5-sonnet");
        const customInstructions = extractTagContent(systemMessage, "custom-instructions") ?? "";
        (0, bun_test_1.expect)(customInstructions).not.toContain("Respond to Sonnet tickets in two sentences max.");
        (0, bun_test_1.expect)(systemMessage).toContain("<model-anthropic-claude-3-5-sonnet>");
        (0, bun_test_1.expect)(systemMessage).toContain("Respond to Sonnet tickets in two sentences max.");
        (0, bun_test_1.expect)(systemMessage).toContain("</model-anthropic-claude-3-5-sonnet>");
    });
    (0, bun_test_1.test)("falls back to global model section when project lacks a match", async () => {
        await fs.writeFile(path.join(globalDir, "AGENTS.md"), `# Global Instructions
## Model: /openai:.*codex/i
OpenAI's GPT-5.1 Codex models already default to terse replies.
`);
        await fs.writeFile(path.join(projectDir, "AGENTS.md"), `# Project Instructions
General details only.
`);
        const metadata = {
            id: "test-workspace",
            name: "test-workspace",
            projectName: "test-project",
            projectPath: projectDir,
            runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
        };
        const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir, undefined, "openai:gpt-5.1-codex");
        const customInstructions = extractTagContent(systemMessage, "custom-instructions") ?? "";
        (0, bun_test_1.expect)(customInstructions).not.toContain("OpenAI's GPT-5.1 Codex models already default to terse replies.");
        (0, bun_test_1.expect)(systemMessage).toContain("<model-openai-gpt-5-1-codex>");
        (0, bun_test_1.expect)(systemMessage).toContain("OpenAI's GPT-5.1 Codex models already default to terse replies.");
    });
    (0, bun_test_1.describe)("agentSystemPrompt scoped instructions", () => {
        (0, bun_test_1.test)("extracts model section from agentSystemPrompt", async () => {
            const agentSystemPrompt = `You are a helpful agent.

## Model: sonnet

Be extra concise when using Sonnet.
`;
            const metadata = {
                id: "test-workspace",
                name: "test-workspace",
                projectName: "test-project",
                projectPath: projectDir,
                runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
            };
            const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir, undefined, "anthropic:claude-3.5-sonnet", undefined, { agentSystemPrompt });
            // Agent instructions should have scoped sections stripped
            const agentInstructions = extractTagContent(systemMessage, "agent-instructions") ?? "";
            (0, bun_test_1.expect)(agentInstructions).toContain("You are a helpful agent.");
            (0, bun_test_1.expect)(agentInstructions).not.toContain("Be extra concise when using Sonnet.");
            // Model section should be extracted and injected
            (0, bun_test_1.expect)(systemMessage).toContain("<model-anthropic-claude-3-5-sonnet>");
            (0, bun_test_1.expect)(systemMessage).toContain("Be extra concise when using Sonnet.");
        });
        (0, bun_test_1.test)("agentSystemPrompt model section takes precedence over AGENTS.md", async () => {
            await fs.writeFile(path.join(projectDir, "AGENTS.md"), `## Model: sonnet
From AGENTS.md: Be verbose.
`);
            const agentSystemPrompt = `## Model: sonnet
From agent: Be terse.
`;
            const metadata = {
                id: "test-workspace",
                name: "test-workspace",
                projectName: "test-project",
                projectPath: projectDir,
                runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
            };
            const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir, undefined, "anthropic:claude-3.5-sonnet", undefined, { agentSystemPrompt });
            // Agent definition's model section wins
            (0, bun_test_1.expect)(systemMessage).toContain("From agent: Be terse.");
            (0, bun_test_1.expect)(systemMessage).not.toContain("From AGENTS.md: Be verbose.");
        });
        (0, bun_test_1.test)("falls back to AGENTS.md when agentSystemPrompt has no matching model section", async () => {
            await fs.writeFile(path.join(projectDir, "AGENTS.md"), `## Model: sonnet
From AGENTS.md: Sonnet instructions.
`);
            const agentSystemPrompt = `## Model: opus
From agent: Opus instructions.
`;
            const metadata = {
                id: "test-workspace",
                name: "test-workspace",
                projectName: "test-project",
                projectPath: projectDir,
                runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
            };
            const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir, undefined, "anthropic:claude-3.5-sonnet", undefined, { agentSystemPrompt });
            // Falls back to AGENTS.md since agent has no sonnet section
            (0, bun_test_1.expect)(systemMessage).toContain("From AGENTS.md: Sonnet instructions.");
            (0, bun_test_1.expect)(systemMessage).not.toContain("From agent: Opus instructions.");
        });
    });
    (0, bun_test_1.describe)("instruction scoping matrix", () => {
        const scopingScenarios = [
            {
                name: "strips model sections when no model provided",
                mdContent: `# Notes
General guidance for everyone.

## Model: sonnet
Anthropic-only instructions.
`,
                assert: (message) => {
                    const custom = extractTagContent(message, "custom-instructions") ?? "";
                    (0, bun_test_1.expect)(custom).toContain("General guidance for everyone.");
                    (0, bun_test_1.expect)(custom).not.toContain("Anthropic-only instructions.");
                    (0, bun_test_1.expect)(message).not.toContain("Anthropic-only instructions.");
                },
            },
            {
                name: "injects only the matching model section",
                mdContent: `General base instructions.

## Model: sonnet
Anthropic-only instructions.

## Model: /openai:.*/
OpenAI-only instructions.
`,
                model: "openai:gpt-5.1-codex",
                assert: (message) => {
                    const custom = extractTagContent(message, "custom-instructions") ?? "";
                    (0, bun_test_1.expect)(custom).toContain("General base instructions.");
                    (0, bun_test_1.expect)(custom).not.toContain("Anthropic-only instructions.");
                    (0, bun_test_1.expect)(custom).not.toContain("OpenAI-only instructions.");
                    const openaiSection = extractTagContent(message, "model-openai-gpt-5-1-codex") ?? "";
                    (0, bun_test_1.expect)(openaiSection).toContain("OpenAI-only instructions.");
                    (0, bun_test_1.expect)(openaiSection).not.toContain("Anthropic-only instructions.");
                    (0, bun_test_1.expect)(message).not.toContain("Anthropic-only instructions.");
                },
            },
        ];
        for (const scenario of scopingScenarios) {
            (0, bun_test_1.test)(scenario.name, async () => {
                await fs.writeFile(path.join(projectDir, "AGENTS.md"), scenario.mdContent);
                const metadata = {
                    id: "test-workspace",
                    name: "test-workspace",
                    projectName: "test-project",
                    projectPath: projectDir,
                    runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
                };
                const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspaceDir, undefined, scenario.model);
                scenario.assert(systemMessage);
            });
        }
    });
});
//# sourceMappingURL=systemMessage.test.js.map