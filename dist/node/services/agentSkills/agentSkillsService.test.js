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
const agentSkillsService_1 = require("./agentSkillsService");
async function writeSkill(root, name, description) {
    const skillDir = path.join(root, name);
    await fs.mkdir(skillDir, { recursive: true });
    const content = `---
name: ${name}
description: ${description}
---
Body
`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), content, "utf-8");
}
(0, bun_test_1.describe)("agentSkillsService", () => {
    (0, bun_test_1.test)("project skills override global skills", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_1, new tempDir_1.DisposableTempDir("agent-skills-project"), false);
            const global = __addDisposableResource(env_1, new tempDir_1.DisposableTempDir("agent-skills-global"), false);
            const projectSkillsRoot = path.join(project.path, ".unix", "skills");
            const globalSkillsRoot = global.path;
            await writeSkill(globalSkillsRoot, "foo", "from global");
            await writeSkill(projectSkillsRoot, "foo", "from project");
            await writeSkill(globalSkillsRoot, "bar", "global only");
            const roots = { projectRoot: projectSkillsRoot, globalRoot: globalSkillsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            const skills = await (0, agentSkillsService_1.discoverAgentSkills)(runtime, project.path, { roots });
            // Should include project/global skills plus built-in skills
            (0, bun_test_1.expect)(skills.map((s) => s.name)).toEqual(["bar", "foo", "init", "unix-docs"]);
            const foo = skills.find((s) => s.name === "foo");
            (0, bun_test_1.expect)(foo).toBeDefined();
            (0, bun_test_1.expect)(foo.scope).toBe("project");
            (0, bun_test_1.expect)(foo.description).toBe("from project");
            const bar = skills.find((s) => s.name === "bar");
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
    (0, bun_test_1.test)("readAgentSkill resolves project before global", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_2, new tempDir_1.DisposableTempDir("agent-skills-project"), false);
            const global = __addDisposableResource(env_2, new tempDir_1.DisposableTempDir("agent-skills-global"), false);
            const projectSkillsRoot = path.join(project.path, ".unix", "skills");
            const globalSkillsRoot = global.path;
            await writeSkill(globalSkillsRoot, "foo", "from global");
            await writeSkill(projectSkillsRoot, "foo", "from project");
            const roots = { projectRoot: projectSkillsRoot, globalRoot: globalSkillsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            const name = schemas_1.SkillNameSchema.parse("foo");
            const resolved = await (0, agentSkillsService_1.readAgentSkill)(runtime, project.path, name, { roots });
            (0, bun_test_1.expect)(resolved.package.scope).toBe("project");
            (0, bun_test_1.expect)(resolved.package.frontmatter.description).toBe("from project");
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    (0, bun_test_1.test)("readAgentSkill can read built-in skills", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_3, new tempDir_1.DisposableTempDir("agent-skills-project"), false);
            const global = __addDisposableResource(env_3, new tempDir_1.DisposableTempDir("agent-skills-global"), false);
            const projectSkillsRoot = path.join(project.path, ".unix", "skills");
            const globalSkillsRoot = global.path;
            const roots = { projectRoot: projectSkillsRoot, globalRoot: globalSkillsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            const name = schemas_1.SkillNameSchema.parse("unix-docs");
            const resolved = await (0, agentSkillsService_1.readAgentSkill)(runtime, project.path, name, { roots });
            (0, bun_test_1.expect)(resolved.package.scope).toBe("built-in");
            (0, bun_test_1.expect)(resolved.package.frontmatter.name).toBe("unix-docs");
            (0, bun_test_1.expect)(resolved.skillDir).toBe("<built-in:unix-docs>");
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, bun_test_1.test)("project/global skills override built-in skills", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const project = __addDisposableResource(env_4, new tempDir_1.DisposableTempDir("agent-skills-project"), false);
            const global = __addDisposableResource(env_4, new tempDir_1.DisposableTempDir("agent-skills-global"), false);
            const projectSkillsRoot = path.join(project.path, ".unix", "skills");
            const globalSkillsRoot = global.path;
            // Override the built-in unix-docs skill with a project-local version
            await writeSkill(projectSkillsRoot, "unix-docs", "custom docs from project");
            const roots = { projectRoot: projectSkillsRoot, globalRoot: globalSkillsRoot };
            const runtime = new LocalRuntime_1.LocalRuntime(project.path);
            const skills = await (0, agentSkillsService_1.discoverAgentSkills)(runtime, project.path, { roots });
            const muxDocs = skills.find((s) => s.name === "unix-docs");
            (0, bun_test_1.expect)(muxDocs).toBeDefined();
            (0, bun_test_1.expect)(muxDocs.scope).toBe("project");
            (0, bun_test_1.expect)(muxDocs.description).toBe("custom docs from project");
            // readAgentSkill should also return the project version
            const name = schemas_1.SkillNameSchema.parse("unix-docs");
            const resolved = await (0, agentSkillsService_1.readAgentSkill)(runtime, project.path, name, { roots });
            (0, bun_test_1.expect)(resolved.package.scope).toBe("project");
        }
        catch (e_4) {
            env_4.error = e_4;
            env_4.hasError = true;
        }
        finally {
            __disposeResources(env_4);
        }
    });
});
//# sourceMappingURL=agentSkillsService.test.js.map