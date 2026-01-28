"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SVG_TEXT_CHARS = exports.SVG_MEDIA_TYPE = void 0;
exports.SVG_MEDIA_TYPE = "image/svg+xml";
// Large SVGs can cause provider request failures when we inline SVG as text.
// Keep this conservative so users get fast feedback at attach-time.
exports.MAX_SVG_TEXT_CHARS = 50_000;
//# sourceMappingURL=imageAttachments.js.map