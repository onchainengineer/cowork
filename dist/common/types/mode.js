"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentModeSchema = exports.AGENT_MODE_VALUES = exports.UIModeSchema = exports.UI_MODE_VALUES = void 0;
const zod_1 = require("zod");
/**
 * UI Mode types
 */
exports.UI_MODE_VALUES = ["plan", "exec"];
exports.UIModeSchema = zod_1.z.enum(exports.UI_MODE_VALUES);
/**
 * Agent mode types
 *
 * Includes non-UI modes like "compact" used for history compaction.
 */
exports.AGENT_MODE_VALUES = [...exports.UI_MODE_VALUES, "compact"];
exports.AgentModeSchema = zod_1.z.enum(exports.AGENT_MODE_VALUES);
//# sourceMappingURL=mode.js.map