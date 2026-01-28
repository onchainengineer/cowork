"use strict";
/**
 * Custom Event Constants & Types
 * These are window-level custom events used for cross-component communication
 *
 * Each event has a corresponding type in CustomEventPayloads for type safety
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageChangeEvent = exports.CUSTOM_EVENTS = void 0;
exports.createCustomEvent = createCustomEvent;
exports.CUSTOM_EVENTS = {
    /**
     * Event to show a toast notification when thinking level changes
     * Detail: { workspaceId: string, level: ThinkingLevel }
     */
    THINKING_LEVEL_TOAST: "unix:thinkingLevelToast",
    /**
     * Event to insert text into the chat input
     * Detail: { text: string, mode?: "replace" | "append", fileParts?: FilePart[] }
     */
    UPDATE_CHAT_INPUT: "unix:updateChatInput",
    /**
     * Event to open the model selector
     * No detail
     */
    OPEN_MODEL_SELECTOR: "unix:openModelSelector",
    /**
     * Event to open the agent picker (AgentModePicker)
     * No detail
     */
    OPEN_AGENT_PICKER: "unix:openAgentPicker",
    /**
     * Event to close the agent picker (AgentModePicker)
     * No detail
     */
    CLOSE_AGENT_PICKER: "unix:closeAgentPicker",
    /**
     * Event to trigger resume check for a workspace
     * Detail: { workspaceId: string }
     *
     * Emitted when:
     * - Stream error occurs
     * - Stream aborted
     * - App startup (for all workspaces with interrupted streams)
     *
     * useResumeManager handles this idempotently - safe to emit multiple times
     */
    RESUME_CHECK_REQUESTED: "unix:resumeCheckRequested",
    /**
     * Event to switch to a different workspace after fork
     * Detail: { workspaceId: string, projectPath: string, projectName: string, workspacePath: string, branch: string }
     */
    WORKSPACE_FORK_SWITCH: "unix:workspaceForkSwitch",
    /**
     * Event to execute a command from the command palette
     * Detail: { commandId: string }
     */
    EXECUTE_COMMAND: "unix:executeCommand",
    /**
     * Event to enter the chat-based workspace creation experience.
     * Detail: { projectPath: string, startMessage?: string, model?: string, trunkBranch?: string, runtime?: string }
     */
    START_WORKSPACE_CREATION: "unix:startWorkspaceCreation",
    /**
     * Event to toggle voice input (dictation) mode
     * No detail
     */
    TOGGLE_VOICE_INPUT: "unix:toggleVoiceInput",
    /**
     * Event to open the debug LLM request modal
     * No detail
     */
    OPEN_DEBUG_LLM_REQUEST: "unix:openDebugLlmRequest",
};
/**
 * Helper to create a typed custom event
 *
 * @example
 * ```typescript
 * const event = createCustomEvent(CUSTOM_EVENTS.RESUME_CHECK_REQUESTED, {
 *   workspaceId: 'abc123',
 *   isManual: true
 * });
 * window.dispatchEvent(event);
 * ```
 */
function createCustomEvent(eventName, ...args) {
    const [detail] = args;
    return new CustomEvent(eventName, { detail });
}
/**
 * Helper to create a storage change event name for a specific key
 * Used by usePersistedState for same-tab synchronization
 */
const getStorageChangeEvent = (key) => `storage-change:${key}`;
exports.getStorageChangeEvent = getStorageChangeEvent;
//# sourceMappingURL=events.js.map