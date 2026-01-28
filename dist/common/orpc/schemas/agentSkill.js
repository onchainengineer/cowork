"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSkillPackageSchema = exports.AgentSkillDescriptorSchema = exports.AgentSkillFrontmatterSchema = exports.SkillNameSchema = exports.AgentSkillScopeSchema = void 0;
const zod_1 = require("zod");
exports.AgentSkillScopeSchema = zod_1.z.enum(["project", "global", "built-in"]);
/**
 * Skill name per agentskills.io
 * - 1–64 chars
 * - lowercase letters/numbers/hyphens
 * - no leading/trailing hyphen
 * - no consecutive hyphens
 */
exports.SkillNameSchema = zod_1.z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
exports.AgentSkillFrontmatterSchema = zod_1.z.object({
    name: exports.SkillNameSchema,
    description: zod_1.z.string().min(1).max(1024),
    license: zod_1.z.string().optional(),
    compatibility: zod_1.z.string().min(1).max(500).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
});
exports.AgentSkillDescriptorSchema = zod_1.z.object({
    name: exports.SkillNameSchema,
    description: zod_1.z.string().min(1).max(1024),
    scope: exports.AgentSkillScopeSchema,
});
exports.AgentSkillPackageSchema = zod_1.z
    .object({
    scope: exports.AgentSkillScopeSchema,
    directoryName: exports.SkillNameSchema,
    frontmatter: exports.AgentSkillFrontmatterSchema,
    body: zod_1.z.string(),
})
    .refine((value) => value.directoryName === value.frontmatter.name, {
    message: "SKILL.md frontmatter.name must match the parent directory name",
    path: ["frontmatter", "name"],
});
//# sourceMappingURL=agentSkill.js.map