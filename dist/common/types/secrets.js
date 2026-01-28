"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsToRecord = secretsToRecord;
/**
 * Convert an array of secrets to a Record for environment variable injection
 * @param secrets Array of Secret objects
 * @returns Record mapping secret keys to values
 */
function secretsToRecord(secrets) {
    const record = {};
    for (const secret of secrets) {
        record[secret.key] = secret.value;
    }
    return record;
}
//# sourceMappingURL=secrets.js.map