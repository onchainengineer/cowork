"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const sshConfigParser_1 = require("./sshConfigParser");
describe("resolveSSHConfig", () => {
    test("applies Host + Match host proxy rules", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-ssh-config-"));
        const previousUserProfile = process.env.USERPROFILE;
        process.env.USERPROFILE = tempDir;
        try {
            await fs.mkdir(path.join(tempDir, ".ssh"), { recursive: true });
            const config = [
                "Host *.lattice",
                "  User coder-user",
                "  UserKnownHostsFile /dev/null",
                "",
                'Match host *.lattice !exec "exit 1"',
                "  ProxyCommand /usr/local/bin/coder --stdio %h",
                "",
            ].join("\n");
            await fs.writeFile(path.join(tempDir, ".ssh", "config"), config, "utf8");
            const resolved = await (0, sshConfigParser_1.resolveSSHConfig)("pog2.lattice");
            expect(resolved.user).toBe("coder-user");
            expect(resolved.hostName).toBe("pog2.lattice");
            expect(resolved.proxyCommand).toBe("/usr/local/bin/coder --stdio %h");
        }
        finally {
            if (previousUserProfile === undefined) {
                delete process.env.USERPROFILE;
            }
            else {
                process.env.USERPROFILE = previousUserProfile;
            }
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
    test("defaults %r to local username when no User is specified", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-ssh-config-"));
        const previousUserProfile = process.env.USERPROFILE;
        process.env.USERPROFILE = tempDir;
        try {
            await fs.mkdir(path.join(tempDir, ".ssh"), { recursive: true });
            // Config with no User directive - %r should default to local username
            // The !exec command checks if %r is non-empty; if it were empty, exit 0
            // would cause the Match to NOT apply (since !exec means "apply if command fails")
            const config = [
                "Host test-host",
                "  HostName 10.0.0.1",
                "",
                // !exec "test -n %r" fails when %r is non-empty (test -n returns 0 for non-empty)
                // So we use "test -z %r" which returns 0 when %r IS empty, 1 when non-empty
                // With %r defaulting to local username, test -z will fail, Match applies
                'Match host 10.0.0.1 !exec "test -z %r"',
                "  ProxyCommand /usr/bin/proxy --user %r",
                "",
            ].join("\n");
            await fs.writeFile(path.join(tempDir, ".ssh", "config"), config, "utf8");
            const resolved = await (0, sshConfigParser_1.resolveSSHConfig)("test-host");
            // Should apply ProxyCommand because %r is non-empty (local username)
            expect(resolved.proxyCommand).toBe("/usr/bin/proxy --user %r");
            // user should be undefined since no User directive
            expect(resolved.user).toBeUndefined();
        }
        finally {
            if (previousUserProfile === undefined) {
                delete process.env.USERPROFILE;
            }
            else {
                process.env.USERPROFILE = previousUserProfile;
            }
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=sshConfigParser.test.js.map