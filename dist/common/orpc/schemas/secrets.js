"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretSchema = void 0;
const zod_1 = require("zod");
exports.SecretSchema = zod_1.z
    .object({
    key: zod_1.z.string(),
    value: zod_1.z.string(),
})
    .meta({
    description: "A key-value pair for storing sensitive configuration",
});
//# sourceMappingURL=secrets.js.map