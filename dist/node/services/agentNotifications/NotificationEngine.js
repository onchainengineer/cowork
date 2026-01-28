"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationEngine = void 0;
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const log_1 = require("../../../node/services/log");
class NotificationEngine {
    sources;
    seenContents = new Set();
    constructor(sources) {
        (0, assert_1.default)(Array.isArray(sources), "sources must be an array");
        this.sources = sources;
    }
    async pollAfterToolCall(ctx) {
        const results = [];
        for (const source of this.sources) {
            try {
                const notifications = await source.poll(ctx);
                for (const notification of notifications) {
                    if (!notification?.content)
                        continue;
                    if (this.seenContents.has(notification.content))
                        continue;
                    this.seenContents.add(notification.content);
                    results.push(notification.content);
                }
            }
            catch (error) {
                const ctorName = source.constructor?.name;
                const sourceName = typeof ctorName === "string" ? ctorName : "unknown";
                log_1.log.debug("[NotificationEngine] poll failed", {
                    error,
                    source: sourceName,
                });
            }
        }
        return results;
    }
}
exports.NotificationEngine = NotificationEngine;
//# sourceMappingURL=NotificationEngine.js.map