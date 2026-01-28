"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuiltInAgentDefinitions = getBuiltInAgentDefinitions;
exports.clearBuiltInAgentCache = clearBuiltInAgentCache;
const parseAgentDefinitionMarkdown_1 = require("./parseAgentDefinitionMarkdown");
const builtInAgentContent_generated_1 = require("./builtInAgentContent.generated");
const BUILT_IN_SOURCES = [
    { id: "exec", content: builtInAgentContent_generated_1.BUILTIN_AGENT_CONTENT.exec },
    { id: "plan", content: builtInAgentContent_generated_1.BUILTIN_AGENT_CONTENT.plan },
    { id: "compact", content: builtInAgentContent_generated_1.BUILTIN_AGENT_CONTENT.compact },
    { id: "explore", content: builtInAgentContent_generated_1.BUILTIN_AGENT_CONTENT.explore },
    { id: "system1_bash", content: builtInAgentContent_generated_1.BUILTIN_AGENT_CONTENT.system1_bash },
    { id: "unix", content: builtInAgentContent_generated_1.BUILTIN_AGENT_CONTENT.unix },
];
let cachedPackages = null;
function parseBuiltIns() {
    return BUILT_IN_SOURCES.map(({ id, content }) => {
        const parsed = (0, parseAgentDefinitionMarkdown_1.parseAgentDefinitionMarkdown)({
            content,
            byteSize: Buffer.byteLength(content, "utf8"),
        });
        return {
            id,
            scope: "built-in",
            frontmatter: parsed.frontmatter,
            body: parsed.body.trim(),
        };
    });
}
function getBuiltInAgentDefinitions() {
    cachedPackages ?? (cachedPackages = parseBuiltIns());
    return cachedPackages;
}
/** Exposed for testing - clears cached parsed packages */
function clearBuiltInAgentCache() {
    cachedPackages = null;
}
//# sourceMappingURL=builtInAgentDefinitions.js.map