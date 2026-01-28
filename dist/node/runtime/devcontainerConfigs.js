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
exports.formatDevcontainerLabel = formatDevcontainerLabel;
exports.buildDevcontainerConfigInfo = buildDevcontainerConfigInfo;
exports.scanDevcontainerConfigs = scanDevcontainerConfigs;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
function formatDevcontainerLabel(configPath) {
    if (configPath === ".devcontainer.json") {
        return "Default (.devcontainer.json)";
    }
    if (configPath === ".devcontainer/devcontainer.json") {
        return "Default (.devcontainer/devcontainer.json)";
    }
    const normalized = configPath.replace(/\\/g, "/");
    const match = /^\.devcontainer\/([^/]+)\/devcontainer\.json$/.exec(normalized);
    if (match?.[1]) {
        return `${match[1]} (${normalized})`;
    }
    return normalized;
}
function buildDevcontainerConfigInfo(configs) {
    return configs.map((configPath) => ({
        path: configPath,
        label: formatDevcontainerLabel(configPath),
    }));
}
/**
 * Scan for devcontainer.json files in a project.
 * Returns paths relative to project root.
 */
async function scanDevcontainerConfigs(projectPath) {
    const configs = [];
    // Check standard locations
    const locations = [".devcontainer.json", ".devcontainer/devcontainer.json"];
    for (const loc of locations) {
        try {
            await fs.access(path.join(projectPath, loc));
            configs.push(loc);
        }
        catch {
            // File doesn't exist
        }
    }
    // Also scan .devcontainer/*/devcontainer.json for multi-config projects
    try {
        const devcontainerDir = path.join(projectPath, ".devcontainer");
        const entries = await fs.readdir(devcontainerDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const configPath = path.join(".devcontainer", entry.name, "devcontainer.json");
                try {
                    await fs.access(path.join(projectPath, configPath));
                    configs.push(configPath);
                }
                catch {
                    // File doesn't exist
                }
            }
        }
    }
    catch {
        // .devcontainer directory doesn't exist
    }
    return configs;
}
//# sourceMappingURL=devcontainerConfigs.js.map