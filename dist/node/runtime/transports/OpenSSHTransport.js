"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSSHTransport = void 0;
const child_process_1 = require("child_process");
const log_1 = require("../../../node/services/log");
const ptySpawn_1 = require("../ptySpawn");
const tildeExpansion_1 = require("../tildeExpansion");
const sshConnectionPool_1 = require("../sshConnectionPool");
class OpenSSHTransport {
    config;
    controlPath;
    constructor(config) {
        this.config = config;
        this.controlPath = (0, sshConnectionPool_1.getControlPath)(config);
    }
    isConnectionFailure(exitCode, _stderr) {
        return exitCode === 255;
    }
    getConfig() {
        return this.config;
    }
    markHealthy() {
        sshConnectionPool_1.sshConnectionPool.markHealthy(this.config);
    }
    reportFailure(error) {
        sshConnectionPool_1.sshConnectionPool.reportFailure(this.config, error);
    }
    async acquireConnection(options) {
        await sshConnectionPool_1.sshConnectionPool.acquireConnection(this.config, {
            abortSignal: options?.abortSignal,
            timeoutMs: options?.timeoutMs,
            onWait: options?.onWait,
        });
    }
    async spawnRemoteProcess(fullCommand, options) {
        await sshConnectionPool_1.sshConnectionPool.acquireConnection(this.config, {
            abortSignal: options.abortSignal,
        });
        const sshArgs = [options.forcePTY ? "-t" : "-T", ...this.buildSSHArgs()];
        const connectTimeout = options.timeout !== undefined ? Math.min(Math.ceil(options.timeout), 15) : 15;
        sshArgs.push("-o", `ConnectTimeout=${connectTimeout}`);
        sshArgs.push("-o", "ServerAliveInterval=5");
        sshArgs.push("-o", "ServerAliveCountMax=2");
        sshArgs.push(this.config.host, fullCommand);
        log_1.log.debug(`SSH exec on ${this.config.host}`);
        const process = (0, child_process_1.spawn)("ssh", sshArgs, {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        });
        return { process };
    }
    async createPtySession(params) {
        await sshConnectionPool_1.sshConnectionPool.acquireConnection(this.config, { maxWaitMs: 0 });
        const args = [...this.buildSSHArgs()];
        args.push("-o", "ConnectTimeout=15");
        args.push("-o", "ServerAliveInterval=5");
        args.push("-o", "ServerAliveCountMax=2");
        args.push("-t");
        args.push(this.config.host);
        // expandTildeForSSH already returns a quoted string (e.g., "$HOME/path")
        // Do NOT wrap with shellQuotePath - that would double-quote it
        const expandedPath = (0, tildeExpansion_1.expandTildeForSSH)(params.workspacePath);
        args.push(`cd ${expandedPath} && exec $SHELL -i`);
        return (0, ptySpawn_1.spawnPtyProcess)({
            runtimeLabel: "SSH",
            command: "ssh",
            args,
            cwd: process.cwd(),
            cols: params.cols,
            rows: params.rows,
            preferElectronBuild: false,
        });
    }
    buildSSHArgs() {
        const args = [];
        if (this.config.port) {
            args.push("-p", this.config.port.toString());
        }
        if (this.config.identityFile) {
            args.push("-i", this.config.identityFile);
            args.push("-o", "StrictHostKeyChecking=no");
            args.push("-o", "UserKnownHostsFile=/dev/null");
        }
        args.push("-o", "LogLevel=FATAL");
        args.push("-o", "ControlMaster=auto");
        args.push("-o", `ControlPath=${this.controlPath}`);
        args.push("-o", "ControlPersist=60");
        return args;
    }
}
exports.OpenSSHTransport = OpenSSHTransport;
//# sourceMappingURL=OpenSSHTransport.js.map