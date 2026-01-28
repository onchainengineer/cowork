"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectRouteId = getProjectRouteId;
const paths_1 = require("../../common/utils/paths");
function hashStringDjb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Unsigned 32-bit
}
function slugify(input) {
    // Keep it URL-friendly and stable across platforms.
    // NOTE: This is for routing only (not user-facing display).
    const slug = input
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
    return slug || "project";
}
function getProjectRouteId(projectPath) {
    const name = paths_1.PlatformPaths.basename(projectPath);
    const hash = hashStringDjb2(projectPath).toString(16).padStart(8, "0");
    return `${slugify(name)}-${hash}`;
}
//# sourceMappingURL=projectRouteId.js.map