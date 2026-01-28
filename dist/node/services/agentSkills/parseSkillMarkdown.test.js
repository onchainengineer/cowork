"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const schemas_1 = require("../../../common/orpc/schemas");
const parseSkillMarkdown_1 = require("./parseSkillMarkdown");
(0, bun_test_1.describe)("parseSkillMarkdown", () => {
    (0, bun_test_1.test)("parses valid YAML frontmatter and body", () => {
        const content = `---
name: pdf-processing
description: Extract text from PDFs
---
# Instructions
Do the thing.
`;
        const directoryName = schemas_1.SkillNameSchema.parse("pdf-processing");
        const result = (0, parseSkillMarkdown_1.parseSkillMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
            directoryName,
        });
        (0, bun_test_1.expect)(result.frontmatter.name).toBe("pdf-processing");
        (0, bun_test_1.expect)(result.frontmatter.description).toBe("Extract text from PDFs");
        (0, bun_test_1.expect)(result.body).toContain("# Instructions");
    });
    (0, bun_test_1.test)("tolerates unknown frontmatter keys (e.g., allowed-tools)", () => {
        const content = `---
name: foo
description: Hello
allowed-tools: file_read
---
Body
`;
        const directoryName = schemas_1.SkillNameSchema.parse("foo");
        const result = (0, parseSkillMarkdown_1.parseSkillMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
            directoryName,
        });
        (0, bun_test_1.expect)(result.frontmatter.name).toBe("foo");
        (0, bun_test_1.expect)(result.frontmatter.description).toBe("Hello");
    });
    (0, bun_test_1.test)("throws on missing frontmatter", () => {
        const content = "# No frontmatter\n";
        (0, bun_test_1.expect)(() => (0, parseSkillMarkdown_1.parseSkillMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
        })).toThrow(parseSkillMarkdown_1.AgentSkillParseError);
    });
    (0, bun_test_1.test)("throws when frontmatter name does not match directory name", () => {
        const content = `---
name: bar
description: Hello
---
Body
`;
        const directoryName = schemas_1.SkillNameSchema.parse("foo");
        (0, bun_test_1.expect)(() => (0, parseSkillMarkdown_1.parseSkillMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf-8"),
            directoryName,
        })).toThrow(parseSkillMarkdown_1.AgentSkillParseError);
    });
});
//# sourceMappingURL=parseSkillMarkdown.test.js.map