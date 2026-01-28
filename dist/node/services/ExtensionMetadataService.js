"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionMetadataService = void 0;
const path_1 = require("path");
const promises_1 = require("fs/promises");
const fs_1 = require("fs");
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const extensionMetadata_1 = require("../../node/utils/extensionMetadata");
const log_1 = require("../../node/services/log");
class ExtensionMetadataService {
    filePath;
    toSnapshot(entry) {
        return {
            recency: entry.recency,
            streaming: entry.streaming,
            lastModel: entry.lastModel ?? null,
            lastThinkingLevel: entry.lastThinkingLevel ?? null,
        };
    }
    constructor(filePath) {
        this.filePath = filePath ?? (0, extensionMetadata_1.getExtensionMetadataPath)();
    }
    /**
     * Initialize the service by ensuring directory exists and clearing stale streaming flags.
     * Call this once on app startup.
     */
    async initialize() {
        // Ensure directory exists
        const dir = (0, path_1.dirname)(this.filePath);
        try {
            await (0, promises_1.access)(dir, fs_1.constants.F_OK);
        }
        catch {
            await (0, promises_1.mkdir)(dir, { recursive: true });
        }
        // Clear stale streaming flags (from crashes)
        await this.clearStaleStreaming();
    }
    async load() {
        try {
            await (0, promises_1.access)(this.filePath, fs_1.constants.F_OK);
        }
        catch {
            return { version: 1, workspaces: {} };
        }
        try {
            const content = await (0, promises_1.readFile)(this.filePath, "utf-8");
            const parsed = JSON.parse(content);
            // Validate structure
            if (typeof parsed !== "object" || parsed.version !== 1) {
                log_1.log.error("Invalid metadata file, resetting");
                return { version: 1, workspaces: {} };
            }
            return parsed;
        }
        catch (error) {
            log_1.log.error("Failed to load metadata:", error);
            return { version: 1, workspaces: {} };
        }
    }
    async save(data) {
        try {
            const content = JSON.stringify(data, null, 2);
            await (0, write_file_atomic_1.default)(this.filePath, content, "utf-8");
        }
        catch (error) {
            log_1.log.error("Failed to save metadata:", error);
        }
    }
    /**
     * Update the recency timestamp for a workspace.
     * Call this on user messages or other interactions.
     */
    async updateRecency(workspaceId, timestamp = Date.now()) {
        const data = await this.load();
        if (!data.workspaces[workspaceId]) {
            data.workspaces[workspaceId] = {
                recency: timestamp,
                streaming: false,
                lastModel: null,
                lastThinkingLevel: null,
            };
        }
        else {
            data.workspaces[workspaceId].recency = timestamp;
        }
        await this.save(data);
        const workspace = data.workspaces[workspaceId];
        if (!workspace) {
            throw new Error(`Workspace ${workspaceId} metadata missing after update.`);
        }
        return this.toSnapshot(workspace);
    }
    /**
     * Set the streaming status for a workspace.
     * Call this when streams start/end.
     */
    async setStreaming(workspaceId, streaming, model, thinkingLevel) {
        const data = await this.load();
        const now = Date.now();
        if (!data.workspaces[workspaceId]) {
            data.workspaces[workspaceId] = {
                recency: now,
                streaming,
                lastModel: model ?? null,
                lastThinkingLevel: thinkingLevel ?? null,
            };
        }
        else {
            data.workspaces[workspaceId].streaming = streaming;
            if (model) {
                data.workspaces[workspaceId].lastModel = model;
            }
            if (thinkingLevel !== undefined) {
                data.workspaces[workspaceId].lastThinkingLevel = thinkingLevel;
            }
        }
        await this.save(data);
        const workspace = data.workspaces[workspaceId];
        if (!workspace) {
            throw new Error(`Workspace ${workspaceId} metadata missing after streaming update.`);
        }
        return this.toSnapshot(workspace);
    }
    /**
     * Get metadata for a single workspace.
     */
    async getMetadata(workspaceId) {
        const data = await this.load();
        const entry = data.workspaces[workspaceId];
        if (!entry)
            return null;
        return {
            workspaceId,
            updatedAt: entry.recency, // Use recency as updatedAt for backwards compatibility
            ...entry,
        };
    }
    /**
     * Get all workspace metadata, ordered by recency.
     * Used by VS Code extension to sort workspace list.
     */
    async getAllMetadata() {
        const data = await this.load();
        const map = new Map();
        // Convert to array, sort by recency, then create map
        const entries = Object.entries(data.workspaces);
        entries.sort((a, b) => b[1].recency - a[1].recency);
        for (const [workspaceId, entry] of entries) {
            map.set(workspaceId, {
                workspaceId,
                updatedAt: entry.recency, // Use recency as updatedAt for backwards compatibility
                ...entry,
            });
        }
        return map;
    }
    /**
     * Delete metadata for a workspace.
     * Call this when a workspace is deleted.
     */
    async deleteWorkspace(workspaceId) {
        const data = await this.load();
        if (data.workspaces[workspaceId]) {
            delete data.workspaces[workspaceId];
            await this.save(data);
        }
    }
    /**
     * Clear all streaming flags.
     * Call this on app startup to clean up stale streaming states from crashes.
     */
    async clearStaleStreaming() {
        const data = await this.load();
        let modified = false;
        for (const entry of Object.values(data.workspaces)) {
            if (entry.streaming) {
                entry.streaming = false;
                modified = true;
            }
        }
        if (modified) {
            await this.save(data);
        }
    }
    async getAllSnapshots() {
        const data = await this.load();
        const map = new Map();
        for (const [workspaceId, entry] of Object.entries(data.workspaces)) {
            map.set(workspaceId, this.toSnapshot(entry));
        }
        return map;
    }
}
exports.ExtensionMetadataService = ExtensionMetadataService;
//# sourceMappingURL=ExtensionMetadataService.js.map