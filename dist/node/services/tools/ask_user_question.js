"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAskUserQuestionTool = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const ai_1 = require("ai");
const askUserQuestionSummary_1 = require("../../../common/utils/tools/askUserQuestionSummary");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const askUserQuestionManager_1 = require("../../../node/services/askUserQuestionManager");
const createAskUserQuestionTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.ask_user_question.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.ask_user_question.schema,
        execute: async (args, { abortSignal, toolCallId }) => {
            // Claude Code allows passing pre-filled answers directly. If provided, we can short-circuit
            // and return immediately without prompting.
            if (args.answers && Object.keys(args.answers).length > 0) {
                return {
                    summary: (0, askUserQuestionSummary_1.buildAskUserQuestionSummary)(args.answers),
                    ui_only: {
                        ask_user_question: {
                            questions: args.questions,
                            answers: args.answers,
                        },
                    },
                };
            }
            (0, strict_1.default)(config.workspaceId, "ask_user_question requires a workspaceId");
            (0, strict_1.default)(toolCallId, "ask_user_question requires toolCallId");
            const pendingPromise = askUserQuestionManager_1.askUserQuestionManager.registerPending(config.workspaceId, toolCallId, args.questions);
            if (!abortSignal) {
                const answers = await pendingPromise;
                return {
                    summary: (0, askUserQuestionSummary_1.buildAskUserQuestionSummary)(answers),
                    ui_only: {
                        ask_user_question: {
                            questions: args.questions,
                            answers,
                        },
                    },
                };
            }
            if (abortSignal.aborted) {
                // Ensure we don't leak a pending prompt entry.
                try {
                    askUserQuestionManager_1.askUserQuestionManager.cancel(config.workspaceId, toolCallId, "Interrupted");
                }
                catch {
                    // ignore
                }
                throw new Error("Interrupted");
            }
            const abortPromise = new Promise((_, reject) => {
                abortSignal.addEventListener("abort", () => {
                    try {
                        askUserQuestionManager_1.askUserQuestionManager.cancel(config.workspaceId, toolCallId, "Interrupted");
                    }
                    catch {
                        // ignore
                    }
                    reject(new Error("Interrupted"));
                }, { once: true });
            });
            const answers = await Promise.race([pendingPromise, abortPromise]);
            (0, strict_1.default)(answers && typeof answers === "object", "Expected answers to be an object");
            return {
                summary: (0, askUserQuestionSummary_1.buildAskUserQuestionSummary)(answers),
                ui_only: {
                    ask_user_question: {
                        questions: args.questions,
                        answers,
                    },
                },
            };
        },
    });
};
exports.createAskUserQuestionTool = createAskUserQuestionTool;
//# sourceMappingURL=ask_user_question.js.map