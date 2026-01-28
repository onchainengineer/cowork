"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtensionMetadataPath = getExtensionMetadataPath;
exports.readExtensionMetadata = readExtensionMetadata;
const fs_1 = require("fs");
const paths_1 = require("../../common/constants/paths");
const thinking_1 = require("../../common/types/thinking");
const log_1 = require("../../node/services/log");
/**
 * Get the path to the extension metadata file.
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getExtensionMetadataPath(rootDir) {
    return (0, paths_1.getMuxExtensionMetadataPath)(rootDir);
}
/**
 * Read extension metadata from JSON file.
 * Returns a map of workspace ID to metadata.
 * Used by both the main app and VS Code extension.
 */
function readExtensionMetadata() {
    const metadataPath = getExtensionMetadataPath();
    if (!(0, fs_1.existsSync)(metadataPath)) {
        return new Map();
    }
    try {
        const content = (0, fs_1.readFileSync)(metadataPath, "utf-8");
        const data = JSON.parse(content);
        // Validate structure
        if (typeof data !== "object" || data.version !== 1) {
            log_1.log.error("Invalid metadata file format");
            return new Map();
        }
        const map = new Map();
        for (const [workspaceId, metadata] of Object.entries(data.workspaces || {})) {
            const rawThinkingLevel = metadata.lastThinkingLevel;
            map.set(workspaceId, {
                recency: metadata.recency,
                streaming: metadata.streaming,
                lastModel: metadata.lastModel ?? null,
                lastThinkingLevel: (0, thinking_1.isThinkingLevel)(rawThinkingLevel) ? rawThinkingLevel : null,
            });
        }
        return map;
    }
    catch (error) {
        log_1.log.error("Failed to read metadata:", error);
        return new Map();
    }
}
//# sourceMappingURL=extensionMetadata.js.map