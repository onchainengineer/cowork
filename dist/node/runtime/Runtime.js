"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeError = void 0;
/**
 * Error thrown by runtime implementations
 */
class RuntimeError extends Error {
    type;
    cause;
    constructor(message, type, cause) {
        super(message);
        this.type = type;
        this.cause = cause;
        this.name = "RuntimeError";
    }
}
exports.RuntimeError = RuntimeError;
//# sourceMappingURL=Runtime.js.map