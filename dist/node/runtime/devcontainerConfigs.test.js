"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const devcontainerConfigs_1 = require("./devcontainerConfigs");
(0, bun_test_1.describe)("formatDevcontainerLabel", () => {
    (0, bun_test_1.it)("labels root devcontainer.json as default", () => {
        (0, bun_test_1.expect)((0, devcontainerConfigs_1.formatDevcontainerLabel)(".devcontainer.json")).toBe("Default (.devcontainer.json)");
    });
    (0, bun_test_1.it)("labels .devcontainer/devcontainer.json as default", () => {
        (0, bun_test_1.expect)((0, devcontainerConfigs_1.formatDevcontainerLabel)(".devcontainer/devcontainer.json")).toBe("Default (.devcontainer/devcontainer.json)");
    });
    (0, bun_test_1.it)("labels nested devcontainer configs by folder", () => {
        (0, bun_test_1.expect)((0, devcontainerConfigs_1.formatDevcontainerLabel)(".devcontainer/backend/devcontainer.json")).toBe("backend (.devcontainer/backend/devcontainer.json)");
    });
    (0, bun_test_1.it)("normalizes backslashes in nested paths", () => {
        (0, bun_test_1.expect)((0, devcontainerConfigs_1.formatDevcontainerLabel)(".devcontainer\\frontend\\devcontainer.json")).toBe("frontend (.devcontainer/frontend/devcontainer.json)");
    });
    (0, bun_test_1.it)("falls back to normalized path for custom locations", () => {
        (0, bun_test_1.expect)((0, devcontainerConfigs_1.formatDevcontainerLabel)("configs/devcontainer.json")).toBe("configs/devcontainer.json");
    });
});
(0, bun_test_1.describe)("buildDevcontainerConfigInfo", () => {
    (0, bun_test_1.it)("maps config paths to labels", () => {
        const info = (0, devcontainerConfigs_1.buildDevcontainerConfigInfo)([
            ".devcontainer.json",
            ".devcontainer/api/devcontainer.json",
        ]);
        (0, bun_test_1.expect)(info).toEqual([
            { path: ".devcontainer.json", label: "Default (.devcontainer.json)" },
            {
                path: ".devcontainer/api/devcontainer.json",
                label: "api (.devcontainer/api/devcontainer.json)",
            },
        ]);
    });
});
//# sourceMappingURL=devcontainerConfigs.test.js.map