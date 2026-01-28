"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuEventService = void 0;
const events_1 = require("events");
/**
 * MenuEventService - Bridges Electron menu events to oRPC subscriptions.
 *
 * Menu events are one-way notifications from main→renderer (e.g., user clicks
 * "Settings..." in the macOS app menu). This service allows the oRPC router
 * to expose these as subscriptions.
 */
class MenuEventService {
    emitter = new events_1.EventEmitter();
    /**
     * Emit an "open settings" event. Called by main.ts when menu item is clicked.
     */
    emitOpenSettings() {
        this.emitter.emit("openSettings");
    }
    /**
     * Subscribe to "open settings" events. Used by oRPC subscription handler.
     * Returns a cleanup function.
     */
    onOpenSettings(callback) {
        this.emitter.on("openSettings", callback);
        return () => this.emitter.off("openSettings", callback);
    }
}
exports.MenuEventService = MenuEventService;
//# sourceMappingURL=menuEventService.js.map