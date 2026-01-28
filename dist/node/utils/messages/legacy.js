"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLegacyUnixMetadata = normalizeLegacyUnixMetadata;
/**
 * Normalize persisted messages from older builds.
 *
 * Migrations:
 * - `cunixMetadata` → `unixMetadata` (unix rename)
 * - `{ compacted: true, idleCompacted: true }` → `{ compacted: "idle" }`
 */
function normalizeLegacyUnixMetadata(message) {
    const metadata = message.metadata;
    if (!metadata)
        return message;
    let normalized = { ...metadata };
    let changed = false;
    // Migrate cunixMetadata → unixMetadata
    if (metadata.cunixMetadata !== undefined) {
        const { cunixMetadata, ...rest } = normalized;
        normalized = rest;
        if (!metadata.unixMetadata) {
            normalized.unixMetadata = cunixMetadata;
        }
        changed = true;
    }
    // Migrate idleCompacted: true → compacted: "idle"
    if (metadata.idleCompacted === true) {
        const { idleCompacted, ...rest } = normalized;
        normalized = { ...rest, compacted: "idle" };
        changed = true;
    }
    return changed ? { ...message, metadata: normalized } : message;
}
//# sourceMappingURL=legacy.js.map