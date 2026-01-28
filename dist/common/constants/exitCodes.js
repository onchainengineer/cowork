"use strict";
/**
 * Special exit codes used by Runtime implementations to communicate
 * expected error conditions (timeout, abort) without throwing exceptions.
 *
 * These are distinct from standard Unix exit codes and signals:
 * - Normal exit: 0-255
 * - Signal death: typically -1 to -64 (negative signal numbers)
 * - Special runtime codes: -997, -998 (far outside normal range)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT_CODE_TIMEOUT = exports.EXIT_CODE_ABORTED = void 0;
/** Process was aborted via AbortSignal */
exports.EXIT_CODE_ABORTED = -997;
/** Process exceeded configured timeout */
exports.EXIT_CODE_TIMEOUT = -998;
//# sourceMappingURL=exitCodes.js.map