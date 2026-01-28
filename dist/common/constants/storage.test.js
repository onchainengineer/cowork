"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const storage_1 = require("../../common/constants/storage");
class MemoryStorage {
    map = new Map();
    get length() {
        return this.map.size;
    }
    clear() {
        this.map.clear();
    }
    getItem(key) {
        return this.map.get(key) ?? null;
    }
    key(index) {
        const keys = Array.from(this.map.keys());
        return keys[index] ?? null;
    }
    removeItem(key) {
        this.map.delete(key);
    }
    setItem(key, value) {
        this.map.set(key, value);
    }
}
(0, bun_test_1.describe)("storage workspace-scoped keys", () => {
    let originalLocalStorage;
    (0, bun_test_1.beforeEach)(() => {
        // The helpers in src/common/constants/storage.ts rely on global localStorage.
        // In tests we install a minimal in-memory implementation.
        originalLocalStorage = globalThis.localStorage;
        globalThis.localStorage = new MemoryStorage();
    });
    (0, bun_test_1.afterEach)(() => {
        if (originalLocalStorage) {
            globalThis.localStorage = originalLocalStorage;
        }
        else {
            delete globalThis.localStorage;
        }
    });
    (0, bun_test_1.test)("getInputAttachmentsKey formats key", () => {
        (0, bun_test_1.expect)((0, storage_1.getInputAttachmentsKey)("ws-123")).toBe("inputAttachments:ws-123");
    });
    (0, bun_test_1.test)("copyWorkspaceStorage copies inputAttachments key", () => {
        const source = "ws-source";
        const dest = "ws-dest";
        const sourceKey = (0, storage_1.getInputAttachmentsKey)(source);
        const destKey = (0, storage_1.getInputAttachmentsKey)(dest);
        const value = JSON.stringify([
            { id: "img-1", url: "data:image/png;base64,AAA", mediaType: "image/png" },
        ]);
        localStorage.setItem(sourceKey, value);
        (0, storage_1.copyWorkspaceStorage)(source, dest);
        (0, bun_test_1.expect)(localStorage.getItem(destKey)).toBe(value);
    });
    (0, bun_test_1.test)("deleteWorkspaceStorage removes inputAttachments key", () => {
        const workspaceId = "ws-delete";
        const key = (0, storage_1.getInputAttachmentsKey)(workspaceId);
        localStorage.setItem(key, "value");
        (0, storage_1.deleteWorkspaceStorage)(workspaceId);
        (0, bun_test_1.expect)(localStorage.getItem(key)).toBeNull();
    });
});
//# sourceMappingURL=storage.test.js.map