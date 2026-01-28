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
exports.resolveSshAgentForwarding = resolveSshAgentForwarding;
exports.resolveGhToken = resolveGhToken;
exports.getHostGitconfigPath = getHostGitconfigPath;
exports.hasHostGitconfig = hasHostGitconfig;
exports.readHostGitconfig = readHostGitconfig;
const fs_1 = require("fs");
const fsPromises = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
function resolveSshAgentForwarding(targetSocketPath) {
    const hostSocketPath = process.platform === "darwin" ? "/run/host-services/ssh-auth.sock" : process.env.SSH_AUTH_SOCK;
    if (!hostSocketPath || !(0, fs_1.existsSync)(hostSocketPath)) {
        return null;
    }
    return { hostSocketPath, targetSocketPath };
}
function resolveGhToken(env) {
    return env?.GH_TOKEN ?? process.env.GH_TOKEN ?? null;
}
function getHostGitconfigPath() {
    return path.join(os.homedir(), ".gitconfig");
}
function hasHostGitconfig() {
    return (0, fs_1.existsSync)(getHostGitconfigPath());
}
async function readHostGitconfig() {
    const gitconfigPath = getHostGitconfigPath();
    if (!(0, fs_1.existsSync)(gitconfigPath)) {
        return null;
    }
    return fsPromises.readFile(gitconfigPath);
}
//# sourceMappingURL=credentialForwarding.js.map