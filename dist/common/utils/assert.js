"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssertionError = void 0;
exports.assert = assert;
// Browser-safe assertion helper for renderer and worker bundles.
// Throws immediately when invariants are violated so bugs surface early.
class AssertionError extends Error {
    constructor(message) {
        super(message ?? "Assertion failed");
        this.name = "AssertionError";
    }
}
exports.AssertionError = AssertionError;
function assert(condition, message) {
    if (!condition) {
        throw new AssertionError(message);
    }
}
exports.default = assert;
//# sourceMappingURL=assert.js.map