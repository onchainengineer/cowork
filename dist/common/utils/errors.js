"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
/**
 * Extract a string message from an unknown error value
 * Handles Error objects and other thrown values consistently
 */
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=errors.js.map