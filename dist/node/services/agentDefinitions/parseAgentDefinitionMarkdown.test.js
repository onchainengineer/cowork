"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const parseAgentDefinitionMarkdown_1 = require("./parseAgentDefinitionMarkdown");
(0, bun_test_1.describe)("parseAgentDefinitionMarkdown", () => {
    (0, bun_test_1.test)("parses valid YAML frontmatter and body (ignores unknown keys)", () => {
        const content = `---
name: My Agent
description: Does stuff
base: exec
tools:
  add: ["file_read", "bash.*"]
unknownTopLevel: 123
ui:
  hidden: false
  color: "#ff00ff"
  unknownNested: 456
---
# Instructions
Do the thing.
`;
        const result = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
        });
        (0, bun_test_1.expect)(result.frontmatter.name).toBe("My Agent");
        (0, bun_test_1.expect)(result.frontmatter.description).toBe("Does stuff");
        (0, bun_test_1.expect)(result.frontmatter.base).toBe("exec");
        (0, bun_test_1.expect)(result.frontmatter.tools).toEqual({ add: ["file_read", "bash.*"] });
        (0, bun_test_1.expect)(result.frontmatter.ui?.hidden).toBe(false);
        (0, bun_test_1.expect)(result.frontmatter.ui?.color).toBe("#ff00ff");
        const frontmatterUnknown = result.frontmatter;
        (0, bun_test_1.expect)(frontmatterUnknown.unknownTopLevel).toBeUndefined();
        if (!result.frontmatter.ui) {
            throw new Error("Expected ui to be present");
        }
        const uiUnknown = result.frontmatter.ui;
        (0, bun_test_1.expect)(uiUnknown.unknownNested).toBeUndefined();
        (0, bun_test_1.expect)(result.body).toContain("# Instructions");
    });
    (0, bun_test_1.test)("accepts legacy ui.selectable", () => {
        const content = `---
name: Legacy UI
ui:
  selectable: false
---
Body
`;
        const result = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
        });
        (0, bun_test_1.expect)(result.frontmatter.ui?.selectable).toBe(false);
    });
    (0, bun_test_1.test)("parses subagent.skip_init_hook", () => {
        const content = `---
name: Skip Init
subagent:
  runnable: true
  skip_init_hook: true
---
Body
`;
        const result = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
        });
        (0, bun_test_1.expect)(result.frontmatter.subagent?.skip_init_hook).toBe(true);
    });
    (0, bun_test_1.test)("throws on missing frontmatter", () => {
        (0, bun_test_1.expect)(() => (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({
            content: "# No frontmatter\n",
            byteSize: 14,
        })).toThrow(parseAgentDefinitionMarkdown_1.AgentDefinitionParseError);
    });
    (0, bun_test_1.test)("parses tools as add/remove patterns", () => {
        const content = `---
name: Regex Tools
tools:
  add:
    - file_read
    - "bash.*"
    - "task_.*"
  remove:
    - task
---
Body
`;
        const result = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
        });
        (0, bun_test_1.expect)(result.frontmatter.tools).toEqual({
            add: ["file_read", "bash.*", "task_.*"],
            remove: ["task"],
        });
    });
});
//# sourceMappingURL=parseAgentDefinitionMarkdown.test.js.map