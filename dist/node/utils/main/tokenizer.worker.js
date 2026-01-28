"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.countTokens = countTokens;
exports.encodingName = encodingName;
const node_assert_1 = __importDefault(require("node:assert"));
const node_worker_threads_1 = require("node:worker_threads");
const ai_tokenizer_1 = require("ai-tokenizer");
const encoding = __importStar(require("ai-tokenizer/encoding"));
const tokenizerCache = new Map();
function getTokenizer(modelName) {
    const cached = tokenizerCache.get(modelName);
    if (cached) {
        return cached;
    }
    const model = ai_tokenizer_1.models[modelName];
    (0, node_assert_1.default)(model, `Unknown tokenizer model '${modelName}'`);
    const encodingModule = encoding[model.encoding];
    (0, node_assert_1.default)(encodingModule, `Unknown tokenizer encoding '${model.encoding}'`);
    const tokenizer = new ai_tokenizer_1.Tokenizer(encodingModule);
    tokenizerCache.set(modelName, tokenizer);
    return tokenizer;
}
function countTokens({ modelName, input }) {
    const tokenizer = getTokenizer(modelName);
    const count = tokenizer.count(input);
    return count;
}
function encodingName(modelName) {
    const model = ai_tokenizer_1.models[modelName];
    (0, node_assert_1.default)(model, `Unknown tokenizer model '${modelName}'`);
    return model.encoding;
}
// Handle messages from main thread
if (node_worker_threads_1.parentPort) {
    node_worker_threads_1.parentPort.on("message", (message) => {
        try {
            let result;
            switch (message.taskName) {
                case "countTokens":
                    result = countTokens(message.data);
                    break;
                case "encodingName":
                    result = encodingName(message.data);
                    break;
                default:
                    throw new Error(`Unknown task: ${message.taskName}`);
            }
            node_worker_threads_1.parentPort.postMessage({
                messageId: message.messageId,
                result,
            });
        }
        catch (error) {
            node_worker_threads_1.parentPort.postMessage({
                messageId: message.messageId,
                error: {
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
        }
    });
}
//# sourceMappingURL=tokenizer.worker.js.map