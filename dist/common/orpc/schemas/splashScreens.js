"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSplashScreenViewed = exports.getViewedSplashScreens = void 0;
const zod_1 = require("zod");
exports.getViewedSplashScreens = {
    input: zod_1.z.undefined(),
    output: zod_1.z.array(zod_1.z.string()),
};
exports.markSplashScreenViewed = {
    input: zod_1.z.object({
        splashId: zod_1.z.string(),
    }),
    output: zod_1.z.undefined(),
};
//# sourceMappingURL=splashScreens.js.map