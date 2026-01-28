"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqueSuffix = uniqueSuffix;
const crypto_1 = __importDefault(require("crypto"));
function uniqueSuffix(labels) {
    const hash = crypto_1.default.createHash("sha256");
    for (const label of labels) {
        hash.update(label);
    }
    const uniqueSuffix = hash.digest("hex").substring(0, 8);
    return uniqueSuffix;
}
//# sourceMappingURL=hasher.js.map