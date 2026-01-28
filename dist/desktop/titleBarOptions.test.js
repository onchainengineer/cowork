"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const titleBarOptions_1 = require("./titleBarOptions");
(0, bun_test_1.describe)("getTitleBarOptions", () => {
    (0, bun_test_1.it)("returns hiddenInset for macOS", () => {
        const options = (0, titleBarOptions_1.getTitleBarOptions)("darwin");
        (0, bun_test_1.expect)(options.titleBarStyle).toBe("hiddenInset");
        (0, bun_test_1.expect)(options.titleBarOverlay).toBeUndefined();
    });
    (0, bun_test_1.it)("returns hidden + titleBarOverlay for Windows", () => {
        const options = (0, titleBarOptions_1.getTitleBarOptions)("win32");
        (0, bun_test_1.expect)(options.titleBarStyle).toBe("hidden");
        (0, bun_test_1.expect)(options.titleBarOverlay).toEqual({
            color: "#171717",
            symbolColor: "#a3a3a3",
            height: 32,
        });
    });
    (0, bun_test_1.it)("returns hidden + titleBarOverlay for Linux", () => {
        const options = (0, titleBarOptions_1.getTitleBarOptions)("linux");
        (0, bun_test_1.expect)(options.titleBarStyle).toBe("hidden");
        (0, bun_test_1.expect)(options.titleBarOverlay).toEqual({
            color: "#171717",
            symbolColor: "#a3a3a3",
            height: 32,
        });
    });
});
//# sourceMappingURL=titleBarOptions.test.js.map