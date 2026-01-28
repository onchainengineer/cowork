"use strict";
/**
 * Type definitions for dynamic tool parts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDynamicToolPart = isDynamicToolPart;
function isDynamicToolPart(part) {
    return (typeof part === "object" && part !== null && "type" in part && part.type === "dynamic-tool");
}
//# sourceMappingURL=toolParts.js.map