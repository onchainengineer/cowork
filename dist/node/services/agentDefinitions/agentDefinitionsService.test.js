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
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const bun_test_1 = require("bun:test");
const schemas_1 = require("../../../common/orpc/schemas");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const tempDir_1 = require("../../../node/services/tempDir");
const agentDefinitionsService_1 = require("./agentDefinitionsService");
async function writeAgent(root, id, name) {
    await fs.mkdir(root, { recursive: true });
    const content = `---
name: ${name}
policy:
  base: exec
---
Body
`;
    await fs.writeFile(path.join(root, `${id}.md`), content, "utf-8");
}
(0, bun_test_1.describe)("agentDefinitionsService", () => {
    (0, bun_test_1.test)("project agents override global agents", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_1, new tempDir_1.DisposableTempDir("agent-defs-project"), false);
            const global = __addDisposableResource(env_1, new tempDir_1.DisposableTempDir("agent-defs-global"), false);
            const projectAgentsRoot = path.join(project.path, ".unix", "agents");
            const globalAgentsRoot = global.path;
            await writeAgent(globalAgentsRoot, "foo", "Foo (global)");
            await writeAgent(projectAgentsRoot, "foo", "Foo (project)");
            await writeAgent(globalAgentsRoot, "bar", "Bar (global)");
            const roots = { projectRoot: projectAgentsRoot, globalRoot: globalAgentsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            const agents = await (0, agentDefinitionsService_1.discoverAgentDefinitions)(runtime, project.path, { roots });
            const foo = agents.find((a) => a.id === "foo");
            (0, bun_test_1.expect)(foo).toBeDefined();
            (0, bun_test_1.expect)(foo.scope).toBe("project");
            (0, bun_test_1.expect)(foo.name).toBe("Foo (project)");
            const bar = agents.find((a) => a.id === "bar");
            (0, bun_test_1.expect)(bar).toBeDefined();
            (0, bun_test_1.expect)(bar.scope).toBe("global");
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    });
    (0, bun_test_1.test)("readAgentDefinition resolves project before global", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_2, new tempDir_1.DisposableTempDir("agent-defs-project"), false);
            const global = __addDisposableResource(env_2, new tempDir_1.DisposableTempDir("agent-defs-global"), false);
            const projectAgentsRoot = path.join(project.path, ".unix", "agents");
            const globalAgentsRoot = global.path;
            await writeAgent(globalAgentsRoot, "foo", "Foo (global)");
            await writeAgent(projectAgentsRoot, "foo", "Foo (project)");
            const roots = { projectRoot: projectAgentsRoot, globalRoot: globalAgentsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            const agentId = schemas_1.AgentIdSchema.parse("foo");
            const pkg = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, project.path, agentId, { roots });
            (0, bun_test_1.expect)(pkg.scope).toBe("project");
            (0, bun_test_1.expect)(pkg.frontmatter.name).toBe("Foo (project)");
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    (0, bun_test_1.test)("resolveAgentBody appends by default (new default), replaces when prompt.append is false", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_3, new tempDir_1.DisposableTempDir("agent-body-test"), false);
            const agentsRoot = path.join(tempDir.path, ".unix", "agents");
            await fs.mkdir(agentsRoot, { recursive: true });
            // Create base agent
            await fs.writeFile(path.join(agentsRoot, "base.md"), `---
name: Base
tools:
  add:
    - .*
---
Base instructions.
`, "utf-8");
            // Create child agent that appends (default behavior)
            await fs.writeFile(path.join(agentsRoot, "child.md"), `---
name: Child
base: base
---
Child additions.
`, "utf-8");
            // Create another child that explicitly replaces
            await fs.writeFile(path.join(agentsRoot, "replacer.md"), `---
name: Replacer
base: base
prompt:
  append: false
---
Replaced body.
`, "utf-8");
            const roots = { projectRoot: agentsRoot, globalRoot: agentsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(tempDir.path);
            // Child without explicit prompt settings should append (new default)
            const childBody = await (0, agentDefinitionsService_1.resolveAgentBody)(runtime, tempDir.path, "child", { roots });
            (0, bun_test_1.expect)(childBody).toContain("Base instructions.");
            (0, bun_test_1.expect)(childBody).toContain("Child additions.");
            // Child with prompt.append: false should replace (explicit opt-out)
            const replacerBody = await (0, agentDefinitionsService_1.resolveAgentBody)(runtime, tempDir.path, "replacer", { roots });
            (0, bun_test_1.expect)(replacerBody).toBe("Replaced body.\n");
            (0, bun_test_1.expect)(replacerBody).not.toContain("Base instructions");
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, bun_test_1.test)("same-name override: project agent with base: self extends built-in/global, not itself", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_4, new tempDir_1.DisposableTempDir("agent-same-name"), false);
            const global = __addDisposableResource(env_4, new tempDir_1.DisposableTempDir("agent-same-name-global"), false);
            const projectAgentsRoot = path.join(project.path, ".unix", "agents");
            const globalAgentsRoot = global.path;
            await fs.mkdir(projectAgentsRoot, { recursive: true });
            await fs.mkdir(globalAgentsRoot, { recursive: true });
            // Global "foo" agent (simulates built-in or global config)
            await fs.writeFile(path.join(globalAgentsRoot, "foo.md"), `---
name: Foo
tools:
  add:
    - .*
---
Global foo instructions.
`, "utf-8");
            // Project-local "foo" agent that extends the global one via base: foo
            // This should NOT cause a circular dependency (would previously infinite loop)
            await fs.writeFile(path.join(projectAgentsRoot, "foo.md"), `---
name: Foo
base: foo
---
Project-specific additions.
`, "utf-8");
            const roots = { projectRoot: projectAgentsRoot, globalRoot: globalAgentsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            // Verify project agent is discovered
            const agents = await (0, agentDefinitionsService_1.discoverAgentDefinitions)(runtime, project.path, { roots });
            const foo = agents.find((a) => a.id === "foo");
            (0, bun_test_1.expect)(foo).toBeDefined();
            (0, bun_test_1.expect)(foo.scope).toBe("project");
            (0, bun_test_1.expect)(foo.base).toBe("foo"); // Points to itself by name
            // Verify body resolution correctly inherits from global (not self)
            const body = await (0, agentDefinitionsService_1.resolveAgentBody)(runtime, project.path, "foo", { roots });
            (0, bun_test_1.expect)(body).toContain("Global foo instructions.");
            (0, bun_test_1.expect)(body).toContain("Project-specific additions.");
        }
        catch (e_4) {
            env_4.error = e_4;
            env_4.hasError = true;
        }
        finally {
            __disposeResources(env_4);
        }
    });
    (0, bun_test_1.test)("readAgentDefinition with skipScopesAbove skips higher-priority scopes", async () => {
        const env_5 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_5, new tempDir_1.DisposableTempDir("agent-skip-scope"), false);
            const global = __addDisposableResource(env_5, new tempDir_1.DisposableTempDir("agent-skip-scope-global"), false);
            const projectAgentsRoot = path.join(project.path, ".unix", "agents");
            const globalAgentsRoot = global.path;
            await fs.mkdir(projectAgentsRoot, { recursive: true });
            await fs.mkdir(globalAgentsRoot, { recursive: true });
            await fs.writeFile(path.join(globalAgentsRoot, "test.md"), `---
name: Test Global
---
Global body.
`, "utf-8");
            await fs.writeFile(path.join(projectAgentsRoot, "test.md"), `---
name: Test Project
---
Project body.
`, "utf-8");
            const roots = { projectRoot: projectAgentsRoot, globalRoot: globalAgentsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            // Without skip: project takes precedence
            const normalPkg = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, project.path, "test", { roots });
            (0, bun_test_1.expect)(normalPkg.scope).toBe("project");
            (0, bun_test_1.expect)(normalPkg.frontmatter.name).toBe("Test Project");
            // With skipScopesAbove: "project" → skip project, return global
            const skippedPkg = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, project.path, "test", {
                roots,
                skipScopesAbove: "project",
            });
            (0, bun_test_1.expect)(skippedPkg.scope).toBe("global");
            (0, bun_test_1.expect)(skippedPkg.frontmatter.name).toBe("Test Global");
        }
        catch (e_5) {
            env_5.error = e_5;
            env_5.hasError = true;
        }
        finally {
            __disposeResources(env_5);
        }
    });
});
//# sourceMappingURL=agentDefinitionsService.test.js.map