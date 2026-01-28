"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const mux_md_client_1 = require("@coder/mux-md-client");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const signingService_1 = require("./signingService");
async function expectValidSignature(content, envelope) {
    const parsed = (0, mux_md_client_1.parsePublicKey)(envelope.publicKey);
    const signatureBytes = Buffer.from(envelope.sig, "base64");
    const messageBytes = new TextEncoder().encode(content);
    const isValid = await (0, mux_md_client_1.verifySignature)(parsed, messageBytes, new Uint8Array(signatureBytes));
    (0, bun_test_1.expect)(isValid).toBe(true);
}
function startSshAgent() {
    const output = (0, child_process_1.execSync)("ssh-agent -s").toString("utf-8");
    const sockMatch = /SSH_AUTH_SOCK=([^;]+);/m.exec(output);
    const pidMatch = /SSH_AGENT_PID=([0-9]+);/m.exec(output);
    if (!sockMatch || !pidMatch) {
        throw new Error(`Failed to parse ssh-agent output: ${output}`);
    }
    return { sshAuthSock: sockMatch[1], sshAgentPid: pidMatch[1] };
}
(0, bun_test_1.describe)("SigningService", () => {
    // Create isolated temp directory for each test run
    const testDir = (0, path_1.join)((0, os_1.tmpdir)(), `signing-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const ed25519KeyPath = (0, path_1.join)(testDir, "id_ed25519");
    const ecdsaKeyPath = (0, path_1.join)(testDir, "id_ecdsa");
    const encryptedKeyPath = (0, path_1.join)(testDir, "id_encrypted");
    const prevEnv = {
        SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
        SSH_AGENT_PID: process.env.SSH_AGENT_PID,
    };
    (0, bun_test_1.beforeAll)(() => {
        // Ensure these tests are not influenced by a user's existing ssh-agent.
        delete process.env.SSH_AUTH_SOCK;
        delete process.env.SSH_AGENT_PID;
        (0, fs_1.mkdirSync)(testDir, { recursive: true });
        // Generate keys using ssh-keygen (same format users would have)
        (0, child_process_1.execSync)(`ssh-keygen -t ed25519 -f "${ed25519KeyPath}" -N "" -q`);
        (0, child_process_1.execSync)(`ssh-keygen -t ecdsa -b 256 -f "${ecdsaKeyPath}" -N "" -q`);
        (0, child_process_1.execSync)(`ssh-keygen -t ed25519 -f "${encryptedKeyPath}" -N "testpassword" -q`);
    });
    (0, bun_test_1.afterAll)(() => {
        (0, fs_1.rmSync)(testDir, { recursive: true, force: true });
        if (prevEnv.SSH_AUTH_SOCK === undefined) {
            delete process.env.SSH_AUTH_SOCK;
        }
        else {
            process.env.SSH_AUTH_SOCK = prevEnv.SSH_AUTH_SOCK;
        }
        if (prevEnv.SSH_AGENT_PID === undefined) {
            delete process.env.SSH_AGENT_PID;
        }
        else {
            process.env.SSH_AGENT_PID = prevEnv.SSH_AGENT_PID;
        }
    });
    (0, bun_test_1.describe)("with Ed25519 key", () => {
        (0, bun_test_1.it)("should load key and return capabilities", async () => {
            const service = new signingService_1.SigningService([ed25519KeyPath]);
            const capabilities = await service.getCapabilities();
            (0, bun_test_1.expect)(capabilities.publicKey).toBeDefined();
            (0, bun_test_1.expect)(capabilities.publicKey).toStartWith("ssh-ed25519 ");
        });
        (0, bun_test_1.it)("should sign messages", async () => {
            const service = new signingService_1.SigningService([ed25519KeyPath]);
            const content = "hello world";
            const envelope = await service.signMessage(content);
            (0, bun_test_1.expect)(envelope.publicKey).toStartWith("ssh-ed25519 ");
            await expectValidSignature(content, envelope);
        });
        (0, bun_test_1.it)("should return consistent public key across multiple calls", async () => {
            const service = new signingService_1.SigningService([ed25519KeyPath]);
            const caps1 = await service.getCapabilities();
            const caps2 = await service.getCapabilities();
            const envelope = await service.signMessage("consistency");
            (0, bun_test_1.expect)(caps1.publicKey).toBe(caps2.publicKey);
            (0, bun_test_1.expect)(caps1.publicKey).toBe(envelope.publicKey);
        });
    });
    (0, bun_test_1.describe)("with ECDSA key", () => {
        (0, bun_test_1.it)("should load key and return capabilities", async () => {
            const service = new signingService_1.SigningService([ecdsaKeyPath]);
            const capabilities = await service.getCapabilities();
            (0, bun_test_1.expect)(capabilities.publicKey).toBeDefined();
            (0, bun_test_1.expect)(capabilities.publicKey).toStartWith("ecdsa-sha2-nistp256 ");
        });
        (0, bun_test_1.it)("should sign messages", async () => {
            const service = new signingService_1.SigningService([ecdsaKeyPath]);
            const content = "hello ecdsa";
            const envelope = await service.signMessage(content);
            (0, bun_test_1.expect)(envelope.publicKey).toStartWith("ecdsa-sha2-nistp256 ");
            await expectValidSignature(content, envelope);
        });
    });
    (0, bun_test_1.describe)("with no key", () => {
        (0, bun_test_1.it)("should return null publicKey when no key exists", async () => {
            const service = new signingService_1.SigningService(["/nonexistent/path/key"]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toBeNull();
            (0, bun_test_1.expect)(caps.error).toBeDefined();
            (0, bun_test_1.expect)(caps.error?.hasEncryptedKey).toBe(false);
        });
        (0, bun_test_1.it)("should throw when signing without a key", async () => {
            const service = new signingService_1.SigningService(["/nonexistent/path/key"]);
            let threw = false;
            try {
                await service.signMessage("no key");
            }
            catch {
                threw = true;
            }
            (0, bun_test_1.expect)(threw).toBe(true);
        });
    });
    (0, bun_test_1.describe)("key path priority", () => {
        (0, bun_test_1.it)("should use first available key in path order", async () => {
            // ECDSA first, Ed25519 second - should pick ECDSA
            const service = new signingService_1.SigningService([ecdsaKeyPath, ed25519KeyPath]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toStartWith("ecdsa-sha2-nistp256 ");
        });
        (0, bun_test_1.it)("should skip missing paths and use next available", async () => {
            // Nonexistent first, Ed25519 second - should pick Ed25519
            const service = new signingService_1.SigningService(["/nonexistent/key", ed25519KeyPath]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toStartWith("ssh-ed25519 ");
        });
    });
    (0, bun_test_1.describe)("with encrypted key", () => {
        (0, bun_test_1.it)("should detect encrypted key and return hasEncryptedKey=true", async () => {
            const service = new signingService_1.SigningService([encryptedKeyPath]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toBeNull();
            (0, bun_test_1.expect)(caps.error?.hasEncryptedKey).toBe(true);
            (0, bun_test_1.expect)(caps.error?.message).toContain("passphrase");
        });
        (0, bun_test_1.it)("should skip encrypted key and use unencrypted fallback", async () => {
            // Encrypted first, unencrypted second - should skip encrypted and use unencrypted
            const service = new signingService_1.SigningService([encryptedKeyPath, ed25519KeyPath]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toStartWith("ssh-ed25519 ");
            // Key loaded successfully - error may exist for identity detection (gh not installed)
            // but should NOT have hasEncryptedKey flag since we found a usable key
            if (caps.error) {
                (0, bun_test_1.expect)(caps.error.hasEncryptedKey).toBe(false);
            }
        });
        (0, bun_test_1.it)("should reset hasEncryptedKey on cache clear", async () => {
            const service = new signingService_1.SigningService([encryptedKeyPath]);
            const caps1 = await service.getCapabilities();
            (0, bun_test_1.expect)(caps1.error?.hasEncryptedKey).toBe(true);
            service.clearIdentityCache();
            // After clearing, a fresh load should still detect the encrypted key
            const caps2 = await service.getCapabilities();
            (0, bun_test_1.expect)(caps2.error?.hasEncryptedKey).toBe(true);
        });
    });
    (0, bun_test_1.describe)("with ssh-agent", () => {
        let sshAuthSock = null;
        let sshAgentPid = null;
        (0, bun_test_1.beforeAll)(() => {
            const agent = startSshAgent();
            sshAuthSock = agent.sshAuthSock;
            sshAgentPid = agent.sshAgentPid;
            process.env.SSH_AUTH_SOCK = sshAuthSock;
            process.env.SSH_AGENT_PID = sshAgentPid;
            (0, child_process_1.execSync)(`ssh-add -q "${ed25519KeyPath}"`, { env: process.env });
        });
        (0, bun_test_1.afterAll)(() => {
            if (sshAuthSock && sshAgentPid) {
                try {
                    (0, child_process_1.execSync)("ssh-agent -k", {
                        env: {
                            ...process.env,
                            SSH_AUTH_SOCK: sshAuthSock,
                            SSH_AGENT_PID: sshAgentPid,
                        },
                    });
                }
                catch {
                    // Best-effort cleanup.
                }
            }
            delete process.env.SSH_AUTH_SOCK;
            delete process.env.SSH_AGENT_PID;
        });
        (0, bun_test_1.it)("should prefer agent key over disk fallback", async () => {
            // Nonexistent explicit path forces the service to choose between agent and fallback.
            // The agent provides Ed25519; fallback provides ECDSA.
            const service = new signingService_1.SigningService(["/nonexistent/key", ecdsaKeyPath]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toStartWith("ssh-ed25519 ");
            const content = "agent signing";
            const envelope = await service.signMessage(content);
            (0, bun_test_1.expect)(envelope.publicKey).toStartWith("ssh-ed25519 ");
            await expectValidSignature(content, envelope);
        });
        (0, bun_test_1.it)("should use agent key when only encrypted disk key is present", async () => {
            const service = new signingService_1.SigningService([encryptedKeyPath]);
            const caps = await service.getCapabilities();
            (0, bun_test_1.expect)(caps.publicKey).toStartWith("ssh-ed25519 ");
            if (caps.error) {
                (0, bun_test_1.expect)(caps.error.hasEncryptedKey).toBe(false);
            }
        });
    });
});
//# sourceMappingURL=signingService.test.js.map