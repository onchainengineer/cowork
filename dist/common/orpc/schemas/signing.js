"use strict";
/**
 * Signing ORPC schemas
 *
 * Defines input/output schemas for unix.md message signing endpoints.
 * Used for signing shared content with optional GitHub identity attribution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.signing = exports.clearIdentityCacheOutput = exports.clearIdentityCacheInput = exports.signMessageOutput = exports.signMessageInput = exports.signatureEnvelopeOutput = exports.signingCapabilitiesOutput = exports.signingErrorOutput = exports.signingCapabilitiesInput = void 0;
const zod_1 = require("zod");
// --- Capabilities endpoint ---
exports.signingCapabilitiesInput = zod_1.z.object({});
exports.signingErrorOutput = zod_1.z.object({
    /** Error message */
    message: zod_1.z.string(),
    /** True if a compatible key was found but requires a passphrase */
    hasEncryptedKey: zod_1.z.boolean(),
});
exports.signingCapabilitiesOutput = zod_1.z.object({
    /** Public key in OpenSSH format (ssh-ed25519 AAAA...), null if no key is available */
    publicKey: zod_1.z.string().nullable(),
    /** Detected GitHub username, if any */
    githubUser: zod_1.z.string().nullable(),
    /** Error info if key loading or identity detection failed */
    error: exports.signingErrorOutput.nullable(),
});
// --- signMessage endpoint ---
// Returns a unix.md-compatible signature envelope for the provided content.
exports.signatureEnvelopeOutput = zod_1.z.object({
    sig: zod_1.z.string(),
    publicKey: zod_1.z.string(),
    githubUser: zod_1.z.string().optional(),
});
exports.signMessageInput = zod_1.z
    .object({
    content: zod_1.z.string(),
})
    .strict();
exports.signMessageOutput = exports.signatureEnvelopeOutput;
// --- Clear identity cache endpoint ---
exports.clearIdentityCacheInput = zod_1.z.object({});
exports.clearIdentityCacheOutput = zod_1.z.object({
    success: zod_1.z.boolean(),
});
// Grouped schemas for router
exports.signing = {
    capabilities: {
        input: exports.signingCapabilitiesInput,
        output: exports.signingCapabilitiesOutput,
    },
    signMessage: {
        input: exports.signMessageInput,
        output: exports.signMessageOutput,
    },
    clearIdentityCache: {
        input: exports.clearIdentityCacheInput,
        output: exports.clearIdentityCacheOutput,
    },
};
//# sourceMappingURL=signing.js.map