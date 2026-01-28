"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultSchema = void 0;
const zod_1 = require("zod");
/**
 * Generic Result schema for success/failure discriminated unions
 */
const ResultSchema = (dataSchema, errorSchema = zod_1.z.string()) => zod_1.z.discriminatedUnion("success", [
    zod_1.z.object({ success: zod_1.z.literal(true), data: dataSchema }),
    zod_1.z.object({ success: zod_1.z.literal(false), error: errorSchema }),
]);
exports.ResultSchema = ResultSchema;
//# sourceMappingURL=result.js.map