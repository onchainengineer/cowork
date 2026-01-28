"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPStdioTransport = void 0;
const util_1 = require("util");
const log_1 = require("../../node/services/log");
/**
 * Minimal stdio transport for MCP servers using newline-delimited JSON (NDJSON).
 * Each message is a single line of JSON followed by \n.
 * This matches the protocol used by @ai-sdk/mcp's StdioMCPTransport.
 */
class MCPStdioTransport {
    execStream;
    decoder = new util_1.TextDecoder();
    encoder = new util_1.TextEncoder();
    stdoutReader;
    stdinWriter;
    buffer = "";
    running = false;
    exitPromise;
    onclose;
    onerror;
    onmessage;
    constructor(execStream) {
        this.execStream = execStream;
        this.stdoutReader = execStream.stdout.getReader();
        this.stdinWriter = execStream.stdin.getWriter();
        this.exitPromise = execStream.exitCode;
        // Observe process exit to trigger close event
        void this.exitPromise.then(() => {
            if (this.onclose)
                this.onclose();
        });
    }
    start() {
        if (this.running)
            return Promise.resolve();
        this.running = true;
        void this.readLoop();
        return Promise.resolve();
    }
    async send(message) {
        // NDJSON: serialize as JSON followed by newline
        const line = JSON.stringify(message) + "\n";
        const bytes = this.encoder.encode(line);
        await this.stdinWriter.write(bytes);
    }
    async close() {
        try {
            await this.stdinWriter.close();
        }
        catch (error) {
            log_1.log.debug("Failed to close MCP stdin writer", { error });
        }
        try {
            await this.stdoutReader.cancel();
        }
        catch (error) {
            log_1.log.debug("Failed to cancel MCP stdout reader", { error });
        }
    }
    async readLoop() {
        try {
            while (true) {
                const { value, done } = await this.stdoutReader.read();
                if (done)
                    break;
                if (value) {
                    this.buffer += this.decoder.decode(value, { stream: true });
                    this.processBuffer();
                }
            }
        }
        catch (error) {
            if (this.onerror) {
                this.onerror(error);
            }
            else {
                log_1.log.error("MCP stdio transport read error", { error });
            }
        }
        finally {
            if (this.onclose)
                this.onclose();
        }
    }
    processBuffer() {
        // Process complete lines (NDJSON format)
        let newlineIndex;
        while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);
            if (line.trim().length === 0)
                continue; // Skip empty lines
            try {
                const message = JSON.parse(line);
                if (this.onmessage) {
                    this.onmessage(message);
                }
            }
            catch (error) {
                if (this.onerror) {
                    this.onerror(error);
                }
                else {
                    log_1.log.error("Failed to parse MCP message", { error, line });
                }
            }
        }
    }
}
exports.MCPStdioTransport = MCPStdioTransport;
//# sourceMappingURL=mcpStdioTransport.js.map