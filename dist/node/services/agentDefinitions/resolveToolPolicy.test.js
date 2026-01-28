"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const resolveToolPolicy_1 = require("./resolveToolPolicy");
// Test helper: agents array is ordered child → base (as returned by resolveAgentInheritanceChain)
(0, bun_test_1.describe)("resolveToolPolicyForAgent", () => {
    (0, bun_test_1.test)("no tools means all tools disabled", () => {
        const agents = [{}];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([{ regex_match: ".*", action: "disable" }]);
    });
    (0, bun_test_1.test)("tools.add enables specified patterns", () => {
        const agents = [{ tools: { add: ["file_read", "bash.*"] } }];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "bash.*", action: "enable" },
        ]);
    });
    (0, bun_test_1.test)("agents can include propose_plan in tools", () => {
        const agents = [{ tools: { add: ["propose_plan", "file_read"] } }];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "propose_plan", action: "enable" },
            { regex_match: "file_read", action: "enable" },
        ]);
    });
    (0, bun_test_1.test)("subagents hard-deny task recursion and always allow agent_report", () => {
        const agents = [{ tools: { add: ["task", "file_read"] } }];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: true,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "task", action: "enable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "task", action: "disable" },
            { regex_match: "task_.*", action: "disable" },
            { regex_match: "propose_plan", action: "disable" },
            { regex_match: "ask_user_question", action: "disable" },
            { regex_match: "agent_report", action: "enable" },
        ]);
    });
    (0, bun_test_1.test)("depth limit hard-denies task tools", () => {
        const agents = [{ tools: { add: ["task", "file_read"] } }];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: true,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "task", action: "enable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "task", action: "disable" },
            { regex_match: "task_.*", action: "disable" },
        ]);
    });
    (0, bun_test_1.test)("empty tools.add array means no tools", () => {
        const agents = [{ tools: { add: [] } }];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([{ regex_match: ".*", action: "disable" }]);
    });
    (0, bun_test_1.test)("whitespace in tool patterns is trimmed", () => {
        const agents = [{ tools: { add: ["  file_read  ", "  ", "bash"] } }];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "bash", action: "enable" },
        ]);
    });
    (0, bun_test_1.test)("tools.remove disables specified patterns", () => {
        const agents = [
            { tools: { add: ["file_read", "bash", "task"], remove: ["task"] } },
        ];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "bash", action: "enable" },
            { regex_match: "task", action: "enable" },
            { regex_match: "task", action: "disable" },
        ]);
    });
    (0, bun_test_1.test)("inherits tools from base agent", () => {
        // Chain: ask → exec (ordered child → base as returned by resolveAgentInheritanceChain)
        const agents = [
            { tools: { remove: ["file_edit_.*"] } }, // ask (child)
            { tools: { add: [".*"], remove: ["propose_plan"] } }, // exec (base)
        ];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        // exec: deny-all → enable .* → disable propose_plan
        // ask: → disable file_edit_.*
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: ".*", action: "enable" },
            { regex_match: "propose_plan", action: "disable" },
            { regex_match: "file_edit_.*", action: "disable" },
        ]);
    });
    (0, bun_test_1.test)("multi-level inheritance", () => {
        // Chain: leaf → middle → base (ordered child → base)
        const agents = [
            { tools: { remove: ["task"] } }, // leaf (child)
            { tools: { add: ["task"], remove: ["bash"] } }, // middle
            { tools: { add: ["file_read", "bash"] } }, // base
        ];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        // base: deny-all → enable file_read → enable bash
        // middle: → enable task → disable bash
        // leaf: → disable task
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "bash", action: "enable" },
            { regex_match: "task", action: "enable" },
            { regex_match: "bash", action: "disable" },
            { regex_match: "task", action: "disable" },
        ]);
    });
    (0, bun_test_1.test)("child can add tools not in base", () => {
        // Chain: child → base (ordered child → base)
        const agents = [
            { tools: { add: ["bash"] } }, // child
            { tools: { add: ["file_read"] } }, // base
        ];
        const policy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
            agents,
            isSubagent: false,
            disableTaskToolsForDepth: false,
        });
        (0, bun_test_1.expect)(policy).toEqual([
            { regex_match: ".*", action: "disable" },
            { regex_match: "file_read", action: "enable" },
            { regex_match: "bash", action: "enable" },
        ]);
    });
});
//# sourceMappingURL=resolveToolPolicy.test.js.map