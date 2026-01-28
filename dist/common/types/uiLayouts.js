"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LAYOUT_PRESETS_CONFIG = void 0;
exports.normalizeLayoutPresetsConfig = normalizeLayoutPresetsConfig;
exports.isLayoutPresetsConfigEmpty = isLayoutPresetsConfigEmpty;
const assert_1 = __importDefault(require("../../common/utils/assert"));
const keybind_1 = require("../../common/types/keybind");
exports.DEFAULT_LAYOUT_PRESETS_CONFIG = {
    version: 2,
    slots: [],
};
function isLayoutSlotNumber(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
function normalizeOptionalNonEmptyString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
function normalizeRightSidebarWidthPreset(raw) {
    if (!raw || typeof raw !== "object") {
        return { mode: "px", value: 400 };
    }
    const record = raw;
    const mode = record.mode;
    if (mode === "fraction") {
        const value = typeof record.value === "number" && Number.isFinite(record.value) ? record.value : 0.3;
        // Keep in a sensible range (avoid 0px or >100% layouts)
        const clamped = Math.min(0.9, Math.max(0.1, value));
        return { mode: "fraction", value: clamped };
    }
    const value = typeof record.value === "number" && Number.isFinite(record.value) ? record.value : 400;
    const rounded = Math.floor(value);
    const clamped = Math.min(1200, Math.max(300, rounded));
    return { mode: "px", value: clamped };
}
function isPresetTabType(value) {
    if (typeof value !== "string")
        return false;
    if (value === "costs" || value === "review" || value === "explorer" || value === "stats") {
        return true;
    }
    return value.startsWith("terminal_new:") && value.length > "terminal_new:".length;
}
function isLayoutNode(value) {
    if (!value || typeof value !== "object")
        return false;
    const v = value;
    if (v.type === "tabset") {
        return (typeof v.id === "string" &&
            Array.isArray(v.tabs) &&
            v.tabs.every((t) => isPresetTabType(t)) &&
            isPresetTabType(v.activeTab));
    }
    if (v.type === "split") {
        if (typeof v.id !== "string")
            return false;
        if (v.direction !== "horizontal" && v.direction !== "vertical")
            return false;
        if (!Array.isArray(v.sizes) || v.sizes.length !== 2)
            return false;
        if (typeof v.sizes[0] !== "number" || typeof v.sizes[1] !== "number")
            return false;
        if (!Array.isArray(v.children) || v.children.length !== 2)
            return false;
        return isLayoutNode(v.children[0]) && isLayoutNode(v.children[1]);
    }
    return false;
}
function findTabset(root, tabsetId) {
    if (root.type === "tabset") {
        return root.id === tabsetId ? root : null;
    }
    return findTabset(root.children[0], tabsetId) ?? findTabset(root.children[1], tabsetId);
}
function isRightSidebarLayoutPresetState(value) {
    if (!value || typeof value !== "object")
        return false;
    const v = value;
    if (v.version !== 1)
        return false;
    if (typeof v.nextId !== "number")
        return false;
    if (typeof v.focusedTabsetId !== "string")
        return false;
    if (!isLayoutNode(v.root))
        return false;
    return findTabset(v.root, v.focusedTabsetId) !== null;
}
function normalizeLayoutSlot(raw) {
    if (!raw || typeof raw !== "object") {
        return undefined;
    }
    const record = raw;
    if (!isLayoutSlotNumber(record.slot)) {
        return undefined;
    }
    const preset = normalizeLayoutPreset(record.preset);
    const keybindOverrideRaw = (0, keybind_1.normalizeKeybind)(record.keybindOverride);
    const keybindOverride = keybindOverrideRaw
        ? (0, keybind_1.hasModifierKeybind)(keybindOverrideRaw)
            ? keybindOverrideRaw
            : undefined
        : undefined;
    if (!preset && !keybindOverride) {
        return undefined;
    }
    return {
        slot: record.slot,
        preset: preset ?? undefined,
        keybindOverride,
    };
}
function normalizeLayoutSlotV1(raw) {
    if (!raw || typeof raw !== "object") {
        return undefined;
    }
    const record = raw;
    if (!isLayoutSlotNumber(record.slot)) {
        return undefined;
    }
    const presetId = normalizeOptionalNonEmptyString(record.presetId);
    const keybindOverrideRaw = (0, keybind_1.normalizeKeybind)(record.keybindOverride);
    const keybindOverride = keybindOverrideRaw
        ? (0, keybind_1.hasModifierKeybind)(keybindOverrideRaw)
            ? keybindOverrideRaw
            : undefined
        : undefined;
    if (!presetId && !keybindOverride) {
        return undefined;
    }
    return {
        slot: record.slot,
        presetId,
        keybindOverride,
    };
}
function normalizeLayoutPreset(raw) {
    if (!raw || typeof raw !== "object") {
        return undefined;
    }
    const record = raw;
    const id = normalizeOptionalNonEmptyString(record.id);
    const name = normalizeOptionalNonEmptyString(record.name);
    if (!id || !name) {
        return undefined;
    }
    const leftSidebarCollapsed = typeof record.leftSidebarCollapsed === "boolean" ? record.leftSidebarCollapsed : false;
    if (!record.rightSidebar || typeof record.rightSidebar !== "object") {
        return undefined;
    }
    const rightSidebarRecord = record.rightSidebar;
    const collapsed = typeof rightSidebarRecord.collapsed === "boolean" ? rightSidebarRecord.collapsed : false;
    const width = normalizeRightSidebarWidthPreset(rightSidebarRecord.width);
    const layoutRaw = rightSidebarRecord.layout;
    if (!isRightSidebarLayoutPresetState(layoutRaw)) {
        return undefined;
    }
    const layout = layoutRaw;
    return {
        id,
        name,
        leftSidebarCollapsed,
        rightSidebar: {
            collapsed,
            width,
            layout,
        },
    };
}
function normalizeLayoutPresetsConfig(raw) {
    if (!raw || typeof raw !== "object") {
        return exports.DEFAULT_LAYOUT_PRESETS_CONFIG;
    }
    const record = raw;
    if (record.version === 2) {
        return normalizeLayoutPresetsConfigV2(record);
    }
    if (record.version === 1) {
        return migrateLayoutPresetsConfigV1(record);
    }
    return exports.DEFAULT_LAYOUT_PRESETS_CONFIG;
}
function normalizeLayoutPresetsConfigV2(record) {
    const slotsArray = Array.isArray(record.slots) ? record.slots : [];
    const slotsByNumber = new Map();
    for (const entry of slotsArray) {
        const slot = normalizeLayoutSlot(entry);
        if (!slot)
            continue;
        slotsByNumber.set(slot.slot, slot);
    }
    const slots = Array.from(slotsByNumber.values()).sort((a, b) => a.slot - b.slot);
    const result = {
        version: 2,
        slots,
    };
    (0, assert_1.default)(result.version === 2, "normalizeLayoutPresetsConfig: version must be 2");
    (0, assert_1.default)(Array.isArray(result.slots), "normalizeLayoutPresetsConfig: slots must be an array");
    return result;
}
function migrateLayoutPresetsConfigV1(record) {
    const presetsArray = Array.isArray(record.presets) ? record.presets : [];
    const presetsById = new Map();
    for (const entry of presetsArray) {
        const preset = normalizeLayoutPreset(entry);
        if (!preset)
            continue;
        presetsById.set(preset.id, preset);
    }
    const slotsArray = Array.isArray(record.slots) ? record.slots : [];
    const slotsByNumber = new Map();
    for (const entry of slotsArray) {
        const slot = normalizeLayoutSlotV1(entry);
        if (!slot)
            continue;
        const preset = slot.presetId ? presetsById.get(slot.presetId) : undefined;
        if (!preset && !slot.keybindOverride) {
            continue;
        }
        slotsByNumber.set(slot.slot, {
            slot: slot.slot,
            preset,
            keybindOverride: slot.keybindOverride,
        });
    }
    const slots = Array.from(slotsByNumber.values()).sort((a, b) => a.slot - b.slot);
    const result = {
        version: 2,
        slots,
    };
    (0, assert_1.default)(result.version === 2, "migrateLayoutPresetsConfigV1: version must be 2");
    (0, assert_1.default)(Array.isArray(result.slots), "migrateLayoutPresetsConfigV1: slots must be an array");
    return result;
}
function isLayoutPresetsConfigEmpty(value) {
    (0, assert_1.default)(value.version === 2, "isLayoutPresetsConfigEmpty: version must be 2");
    for (const slot of value.slots) {
        if (slot.preset || slot.keybindOverride) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=uiLayouts.js.map