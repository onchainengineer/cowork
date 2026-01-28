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
exports.getTodoFilePath = getTodoFilePath;
exports.coerceTodoItems = coerceTodoItems;
exports.readTodosForSessionDir = readTodosForSessionDir;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const TODO_FILE_NAME = "todos.json";
/**
 * Get path to todos.json file in the workspace's session directory.
 */
function getTodoFilePath(workspaceSessionDir) {
    return path.join(workspaceSessionDir, TODO_FILE_NAME);
}
function coerceTodoItems(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const result = [];
    for (const item of value) {
        if (!item || typeof item !== "object")
            continue;
        const content = item.content;
        const status = item.status;
        if (typeof content !== "string")
            continue;
        if (status !== "pending" && status !== "in_progress" && status !== "completed")
            continue;
        result.push({ content, status });
    }
    return result;
}
/**
 * Read todos from the workspace session directory.
 */
async function readTodosForSessionDir(workspaceSessionDir) {
    const todoFile = getTodoFilePath(workspaceSessionDir);
    try {
        const content = await fs.readFile(todoFile, "utf-8");
        const parsed = JSON.parse(content);
        return coerceTodoItems(parsed);
    }
    catch (error) {
        // File doesn't exist yet or is invalid
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return [];
        }
        return [];
    }
}
//# sourceMappingURL=todoStorage.js.map