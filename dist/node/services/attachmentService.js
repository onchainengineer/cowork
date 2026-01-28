"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentService = void 0;
const planStorage_1 = require("../../common/utils/planStorage");
const helpers_1 = require("../../node/utils/runtime/helpers");
const tildeExpansion_1 = require("../../node/runtime/tildeExpansion");
const attachments_1 = require("../../common/constants/attachments");
const TRUNCATED_PLAN_NOTE = "\n\n...(truncated)\n";
function truncatePlanContent(planContent) {
    if (planContent.length <= attachments_1.MAX_POST_COMPACTION_PLAN_CHARS) {
        return planContent;
    }
    const sliceLength = Math.max(0, attachments_1.MAX_POST_COMPACTION_PLAN_CHARS - TRUNCATED_PLAN_NOTE.length);
    return `${planContent.slice(0, sliceLength)}${TRUNCATED_PLAN_NOTE}`;
}
/**
 * Service for generating post-compaction attachments.
 * These attachments preserve context that would otherwise be lost after compaction.
 */
class AttachmentService {
    /**
     * Generate a plan file reference attachment if the plan file exists.
     * Mode-agnostic: plan context is valuable in both plan and exec modes.
     * Falls back to legacy plan path if new path doesn't exist.
     */
    static async generatePlanFileReference(workspaceName, projectName, workspaceId, runtime) {
        const unixHome = runtime.getUnixHome();
        const planFilePath = (0, planStorage_1.getPlanFilePath)(workspaceName, projectName, unixHome);
        // Legacy paths only used for non-Docker runtimes (Docker has no legacy files)
        const legacyPlanPath = (0, planStorage_1.getLegacyPlanFilePath)(workspaceId);
        // Try new path first
        try {
            const planContent = await (0, helpers_1.readFileString)(runtime, planFilePath);
            if (planContent) {
                return {
                    type: "plan_file_reference",
                    planFilePath,
                    planContent: truncatePlanContent(planContent),
                };
            }
        }
        catch {
            // Plan file doesn't exist at new path, try legacy
        }
        // Fall back to legacy path
        try {
            const planContent = await (0, helpers_1.readFileString)(runtime, legacyPlanPath);
            if (planContent) {
                return {
                    type: "plan_file_reference",
                    planFilePath: legacyPlanPath,
                    planContent: truncatePlanContent(planContent),
                };
            }
        }
        catch {
            // Plan file doesn't exist at legacy path either
        }
        return null;
    }
    /**
     * Generate an edited files reference attachment from extracted file diffs.
     * Excludes the plan file (which is handled separately).
     * @param planPathsToFilter - Array of plan file paths to filter (both tilde and expanded)
     */
    static generateEditedFilesAttachment(fileDiffs, planPathsToFilter = []) {
        // Build set of paths to filter (includes both tilde and expanded versions)
        const pathsToFilter = new Set();
        for (const p of planPathsToFilter) {
            pathsToFilter.add(p);
            pathsToFilter.add((0, tildeExpansion_1.expandTilde)(p));
        }
        const files = fileDiffs
            .filter((f) => !pathsToFilter.has(f.path))
            .map((f) => ({
            path: f.path,
            diff: f.diff,
            truncated: f.truncated,
        }));
        if (files.length === 0) {
            return null;
        }
        return {
            type: "edited_files_reference",
            files,
        };
    }
    /**
     * Generate all post-compaction attachments.
     * Returns empty array if no attachments are needed.
     * @param excludedItems - Set of item IDs to exclude ("plan" or "file:<path>")
     */
    static async generatePostCompactionAttachments(workspaceName, projectName, workspaceId, fileDiffs, runtime, excludedItems = new Set()) {
        const attachments = [];
        const unixHome = runtime.getUnixHome();
        const planFilePath = (0, planStorage_1.getPlanFilePath)(workspaceName, projectName, unixHome);
        const legacyPlanPath = (0, planStorage_1.getLegacyPlanFilePath)(workspaceId);
        // Plan file reference (skip if excluded)
        let planRef = null;
        if (!excludedItems.has("plan")) {
            planRef = await this.generatePlanFileReference(workspaceName, projectName, workspaceId, runtime);
            if (planRef) {
                attachments.push(planRef);
            }
        }
        // Filter out excluded files
        const filteredDiffs = fileDiffs.filter((f) => !excludedItems.has(`file:${f.path}`));
        // Edited files reference - always filter out both new and legacy plan paths
        // to prevent plan file from appearing in the file diffs list
        const editedFilesRef = this.generateEditedFilesAttachment(filteredDiffs, [
            planFilePath,
            legacyPlanPath,
        ]);
        if (editedFilesRef) {
            attachments.push(editedFilesRef);
        }
        return attachments;
    }
}
exports.AttachmentService = AttachmentService;
//# sourceMappingURL=attachmentService.js.map