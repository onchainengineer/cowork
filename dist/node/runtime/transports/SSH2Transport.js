"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSH2Transport = void 0;
const events_1 = require("events");
const stream_1 = require("stream");
const Runtime_1 = require("../Runtime");
const errors_1 = require("../../../common/utils/errors");
const log_1 = require("../../../node/services/log");
const streamErrors_1 = require("../../../node/utils/streamErrors");
const tildeExpansion_1 = require("../tildeExpansion");
const SSH2ConnectionPool_1 = require("../SSH2ConnectionPool");
class SSH2ChildProcess extends events_1.EventEmitter {
    channel;
    stdout;
    stderr;
    stdin;
    exitCode = null;
    signalCode = null;
    killed = false;
    pid = 0;
    constructor(channel) {
        super();
        this.channel = channel;
        const stdoutPipe = new stream_1.PassThrough();
        const stderrPipe = new stream_1.PassThrough();
        const stdinPipe = new stream_1.PassThrough();
        channel.pipe(stdoutPipe);
        (channel.stderr ?? new stream_1.PassThrough()).pipe(stderrPipe);
        stdinPipe.pipe(channel);
        this.stdout = stdoutPipe;
        this.stderr = stderrPipe;
        this.stdin = stdinPipe;
        let closeEventFired = false;
        let closeTimer = null;
        let closeEmitted = false;
        const emitClose = () => {
            if (closeEmitted) {
                return;
            }
            closeEmitted = true;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            this.emit("close", this.exitCode ?? 0, this.signalCode);
        };
        channel.on("exit", (code, signal) => {
            this.exitCode = typeof code === "number" ? code : null;
            this.signalCode = typeof signal === "string" ? signal : null;
            // ssh2 sometimes emits "close" before "exit"; if that happens, ensure we still
            // report the real exit code.
            if (closeEventFired) {
                emitClose();
            }
        });
        channel.on("close", (...args) => {
            closeEventFired = true;
            // ssh2 sometimes emits "close" with the exit code/signal. Capture it so we still
            // report the correct exit status even if we missed the earlier "exit" event
            // (e.g. extremely fast commands).
            const [code, signal] = args;
            if (this.exitCode === null && typeof code === "number") {
                this.exitCode = code;
            }
            if (this.signalCode === null && typeof signal === "string") {
                this.signalCode = signal;
            }
            if (this.exitCode !== null || this.signalCode !== null) {
                emitClose();
                return;
            }
            // Grace period: allow the "exit" event to arrive after "close".
            // Without this, we can incorrectly report exitCode=0 for failed commands.
            closeTimer = setTimeout(() => emitClose(), 250);
            closeTimer.unref?.();
        });
        channel.on("error", (err) => {
            this.emit("error", err);
        });
    }
    kill(signal) {
        this.killed = true;
        try {
            if (signal && typeof this.channel.signal === "function") {
                this.channel.signal(signal);
            }
        }
        catch {
            // Ignore signal errors.
        }
        try {
            this.channel.close();
        }
        catch {
            // Ignore close errors.
        }
        return true;
    }
}
class SSH2Pty {
    channel;
    closed = false;
    constructor(channel) {
        this.channel = channel;
        this.channel.on("close", () => {
            this.closed = true;
        });
        const closeChannel = () => {
            this.closed = true;
            try {
                this.channel.close();
            }
            catch {
                // Ignore close errors.
            }
        };
        // PTY channels can emit socket errors when sessions exit early.
        (0, streamErrors_1.attachStreamErrorHandler)(this.channel, "ssh2-pty-channel", {
            logger: log_1.log,
            onIgnorable: closeChannel,
            onUnexpected: closeChannel,
        });
        if (this.channel.stderr) {
            (0, streamErrors_1.attachStreamErrorHandler)(this.channel.stderr, "ssh2-pty-stderr", {
                logger: log_1.log,
                onIgnorable: closeChannel,
                onUnexpected: closeChannel,
            });
        }
    }
    write(data) {
        if (this.closed || this.channel.destroyed || this.channel.writableEnded) {
            return;
        }
        try {
            this.channel.write(data);
        }
        catch (error) {
            if ((0, streamErrors_1.isIgnorableStreamError)(error)) {
                return;
            }
            const message = error instanceof Error ? error.message : String(error);
            const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
                ? error.code
                : undefined;
            log_1.log.warn("SSH2 PTY write failed", { code, message });
        }
    }
    resize(cols, rows) {
        this.channel.setWindow(rows, cols, 0, 0);
    }
    kill() {
        this.closed = true;
        this.channel.close();
    }
    onData(handler) {
        const onStdout = (data) => handler(data.toString());
        const onStderr = (data) => handler(data.toString());
        this.channel.on("data", onStdout);
        this.channel.stderr?.on("data", onStderr);
        return {
            dispose: () => {
                this.channel.off("data", onStdout);
                this.channel.stderr?.off("data", onStderr);
            },
        };
    }
    onExit(handler) {
        const onClose = (code) => {
            handler({ exitCode: typeof code === "number" ? code : 0 });
        };
        this.channel.on("close", onClose);
        return {
            dispose: () => {
                this.channel.off("close", onClose);
            },
        };
    }
}
class SSH2Transport {
    config;
    constructor(config) {
        this.config = config;
    }
    isConnectionFailure(_exitCode, _stderr) {
        return false;
    }
    getConfig() {
        return this.config;
    }
    markHealthy() {
        SSH2ConnectionPool_1.ssh2ConnectionPool.markHealthy(this.config);
    }
    reportFailure(error) {
        SSH2ConnectionPool_1.ssh2ConnectionPool.reportFailure(this.config, error);
    }
    async acquireConnection(options) {
        await SSH2ConnectionPool_1.ssh2ConnectionPool.acquireConnection(this.config, {
            abortSignal: options?.abortSignal,
            timeoutMs: options?.timeoutMs,
            onWait: options?.onWait,
        });
    }
    async spawnRemoteProcess(fullCommand, options) {
        const connectTimeoutSec = options.timeout !== undefined ? Math.min(Math.ceil(options.timeout), 15) : 15;
        let client;
        try {
            ({ client } = await SSH2ConnectionPool_1.ssh2ConnectionPool.acquireConnection(this.config, {
                abortSignal: options.abortSignal,
                timeoutMs: connectTimeoutSec * 1000,
            }));
        }
        catch (error) {
            throw new Runtime_1.RuntimeError(`SSH2 connection failed: ${(0, errors_1.getErrorMessage)(error)}`, "network", error instanceof Error ? error : undefined);
        }
        try {
            const channel = await new Promise((resolve, reject) => {
                const onExec = (err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!stream) {
                        reject(new Error("SSH2 exec did not return a stream"));
                        return;
                    }
                    resolve(stream);
                };
                if (options.forcePTY) {
                    client.exec(fullCommand, { pty: { term: "xterm-256color" } }, onExec);
                }
                else {
                    client.exec(fullCommand, onExec);
                }
            });
            const process = new SSH2ChildProcess(channel);
            return { process };
        }
        catch (error) {
            SSH2ConnectionPool_1.ssh2ConnectionPool.reportFailure(this.config, (0, errors_1.getErrorMessage)(error));
            throw new Runtime_1.RuntimeError(`SSH2 command failed: ${(0, errors_1.getErrorMessage)(error)}`, "network", error instanceof Error ? error : undefined);
        }
    }
    async createPtySession(params) {
        const { client } = await SSH2ConnectionPool_1.ssh2ConnectionPool.acquireConnection(this.config, { maxWaitMs: 0 });
        const channel = await new Promise((resolve, reject) => {
            client.shell({
                term: "xterm-256color",
                cols: params.cols,
                rows: params.rows,
            }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!stream) {
                    reject(new Error("SSH2 shell did not return a stream"));
                    return;
                }
                resolve(stream);
            });
        });
        // expandTildeForSSH already returns a quoted string (e.g., "$HOME/path")
        // Do NOT wrap with shellQuotePath - that would double-quote it
        // Exit on cd failure to match OpenSSH transport behavior (cd ... && exec $SHELL -i)
        const expandedPath = (0, tildeExpansion_1.expandTildeForSSH)(params.workspacePath);
        channel.write(`cd ${expandedPath} || exit 1\n`);
        return new SSH2Pty(channel);
    }
}
exports.SSH2Transport = SSH2Transport;
//# sourceMappingURL=SSH2Transport.js.map