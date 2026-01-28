"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const node_worker_threads_1 = require("node:worker_threads");
const node_path_1 = require("node:path");
const log_1 = require("../../../node/services/log");
let messageIdCounter = 0;
const pendingPromises = new Map();
// Track if worker is alive - reject immediately if dead
let workerError = null;
// Resolve worker path
// In production: both workerPool.js and tokenizer.worker.js are in dist/utils/main/
// During tests: workerPool.ts is in src/utils/main/ but worker is in dist/utils/main/
const currentDir = (0, node_path_1.dirname)(__filename);
const pathParts = currentDir.split(node_path_1.sep);
const hasDist = pathParts.includes("dist");
const srcIndex = pathParts.lastIndexOf("src");
let workerDir;
let workerFile = "tokenizer.worker.js";
// Check if we're running under Bun (not Node with ts-jest)
// ts-jest transpiles .ts files but runs them via Node, which can't load .ts workers
const isBun = !!process.isBun;
if (isBun && (0, node_path_1.extname)(__filename) === ".ts") {
    // Running from source via Bun - use .ts worker directly
    workerDir = currentDir;
    workerFile = "tokenizer.worker.ts";
}
else if (srcIndex !== -1 && !hasDist) {
    // Replace 'src' with 'dist' in the path (only if not already in dist)
    pathParts[srcIndex] = "dist";
    workerDir = pathParts.join(node_path_1.sep);
}
else {
    workerDir = currentDir;
}
const workerPath = (0, node_path_1.join)(workerDir, workerFile);
const worker = new node_worker_threads_1.Worker(workerPath);
// Handle messages from worker
worker.on("message", (response) => {
    const pending = pendingPromises.get(response.messageId);
    if (!pending) {
        log_1.log.error(`No pending promise for messageId ${response.messageId}`);
        return;
    }
    pendingPromises.delete(response.messageId);
    if ("error" in response) {
        const error = new Error(response.error.message);
        error.stack = response.error.stack;
        pending.reject(error);
    }
    else {
        pending.resolve(response.result);
    }
});
// Handle worker errors
worker.on("error", (error) => {
    log_1.log.error("Worker error:", error);
    workerError = error;
    // Reject all pending promises
    for (const pending of pendingPromises.values()) {
        pending.reject(error);
    }
    pendingPromises.clear();
});
// Handle worker exit
worker.on("exit", (code) => {
    if (code !== 0) {
        log_1.log.error(`Worker stopped with exit code ${code}`);
        const error = new Error(`Worker stopped with exit code ${code}`);
        workerError = error;
        for (const pending of pendingPromises.values()) {
            pending.reject(error);
        }
        pendingPromises.clear();
    }
});
// Don't block process exit
worker.unref();
/**
 * Run a task on the worker thread
 * @param taskName The name of the task to run (e.g., "countTokens", "encodingName")
 * @param data The data to pass to the task
 * @returns A promise that resolves with the task result
 */
function run(taskName, data) {
    // If worker already died (e.g., failed to load), reject immediately
    // This prevents hanging promises when the worker is not available
    if (workerError) {
        return Promise.reject(workerError);
    }
    const messageId = messageIdCounter++;
    const request = { messageId, taskName, data };
    return new Promise((resolve, reject) => {
        pendingPromises.set(messageId, {
            resolve: resolve,
            reject,
        });
        worker.postMessage(request);
    });
}
//# sourceMappingURL=workerPool.js.map