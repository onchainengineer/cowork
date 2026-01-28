"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDefaultContinueMessage = void 0;
exports.buildContinueMessage = buildContinueMessage;
exports.isDefaultSourceContent = isDefaultSourceContent;
exports.rebuildContinueMessage = rebuildContinueMessage;
exports.prepareUserMessageForSend = prepareUserMessageForSend;
exports.buildAgentSkillMetadata = buildAgentSkillMetadata;
exports.createUnixMessage = createUnixMessage;
const review_1 = require("./review");
/**
 * Build a ContinueMessage from raw inputs.
 * Centralizes the has-content check and field construction.
 *
 * @returns ContinueMessage if there's content to continue with, undefined otherwise
 */
function buildContinueMessage(opts) {
    const hasText = opts.text && opts.text.length > 0;
    const hasFiles = opts.fileParts && opts.fileParts.length > 0;
    const hasReviews = opts.reviews && opts.reviews.length > 0;
    if (!hasText && !hasFiles && !hasReviews)
        return undefined;
    // Type assertion is safe here - this is the only factory for ContinueMessage
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {
        text: opts.text ?? "",
        fileParts: opts.fileParts,
        reviews: opts.reviews,
        unixMetadata: opts.unixMetadata,
        model: opts.model,
        agentId: opts.agentId,
    };
    return result;
}
/**
 * True when the content is the default resume sentinel ("Continue")
 * with no attachments.
 */
function isDefaultSourceContent(content) {
    if (!content)
        return false;
    const text = typeof content.text === "string" ? content.text.trim() : "";
    const hasFiles = (content.fileParts?.length ?? 0) > 0;
    const hasReviews = (content.reviews?.length ?? 0) > 0;
    return text === "Continue" && !hasFiles && !hasReviews;
}
/** @deprecated Use isDefaultSourceContent. Legacy alias for backward compatibility. */
exports.isDefaultContinueMessage = isDefaultSourceContent;
/**
 * Rebuild a ContinueMessage from persisted data.
 * Use this when reading from storage/history where the data may have been
 * saved by older code that didn't include all fields.
 *
 * @param persisted - Data from storage (may be partial)
 * @param defaults - Default values for model/mode if not in persisted data
 * @returns Branded ContinueMessage, or undefined if no content
 */
function rebuildContinueMessage(persisted, defaults) {
    if (!persisted)
        return undefined;
    const persistedAgentId = typeof persisted.agentId === "string" && persisted.agentId.trim().length > 0
        ? persisted.agentId.trim()
        : undefined;
    const legacyMode = persisted.mode;
    const legacyAgentId = legacyMode === "plan" || legacyMode === "exec" ? legacyMode : undefined;
    return buildContinueMessage({
        text: persisted.text,
        fileParts: persisted.fileParts,
        reviews: persisted.reviews,
        unixMetadata: persisted.unixMetadata,
        model: persisted.model ?? defaults.model,
        agentId: persistedAgentId ?? legacyAgentId ?? defaults.agentId,
    });
}
/**
 * Process UserMessageContent into final message text and metadata.
 * Used by both normal send path and backend continue message processing.
 *
 * @param content - The user message content (text, attachments, reviews)
 * @param existingMetadata - Optional existing metadata to merge with (e.g., for compaction messages)
 * @returns Object with finalText (reviews prepended) and metadata (reviews for display)
 */
function prepareUserMessageForSend(content, existingMetadata) {
    const { text, reviews } = content;
    // Format reviews into message text
    const reviewsText = reviews?.length ? reviews.map(review_1.formatReviewForModel).join("\n\n") : "";
    const finalText = reviewsText ? reviewsText + (text ? "\n\n" + text : "") : text;
    // Build metadata with reviews for display
    let metadata = existingMetadata;
    if (reviews?.length) {
        metadata = metadata ? { ...metadata, reviews } : { type: "normal", reviews };
    }
    return { finalText, metadata };
}
function buildAgentSkillMetadata(options) {
    return {
        type: "agent-skill",
        rawCommand: options.rawCommand,
        commandPrefix: options.commandPrefix,
        skillName: options.skillName,
        scope: options.scope,
    };
}
// Helper to create a simple text message
function createUnixMessage(id, role, content, metadata, additionalParts) {
    const textPart = content
        ? [{ type: "text", text: content, state: "done" }]
        : [];
    const parts = [...textPart, ...(additionalParts ?? [])];
    // Validation: User messages must have at least one part with content
    // This prevents empty user messages from being created (defense-in-depth)
    if (role === "user" && parts.length === 0) {
        throw new Error("Cannot create user message with no parts. Empty messages should be rejected upstream.");
    }
    return {
        id,
        role,
        metadata,
        parts,
    };
}
//# sourceMappingURL=message.js.map