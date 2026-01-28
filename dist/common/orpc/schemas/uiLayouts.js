"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayoutPresetsConfigSchema = exports.LayoutSlotSchema = exports.LayoutPresetSchema = exports.RightSidebarWidthPresetSchema = exports.RightSidebarLayoutPresetStateSchema = exports.RightSidebarLayoutPresetNodeSchema = exports.RightSidebarPresetTabSchema = exports.KeybindSchema = void 0;
const zod_1 = require("zod");
exports.KeybindSchema = zod_1.z
    // Keep in sync with the Keybind type (including allowShift). Strict schemas will
    // otherwise reject normalized config objects that include optional fields.
    .object({
    key: zod_1.z.string().min(1),
    allowShift: zod_1.z.boolean().optional(),
    ctrl: zod_1.z.boolean().optional(),
    shift: zod_1.z.boolean().optional(),
    alt: zod_1.z.boolean().optional(),
    meta: zod_1.z.boolean().optional(),
    macCtrlBehavior: zod_1.z.enum(["either", "command", "control"]).optional(),
})
    .strict();
const RightSidebarPresetBaseTabSchema = zod_1.z.enum(["costs", "review", "explorer", "stats"]);
exports.RightSidebarPresetTabSchema = zod_1.z.union([
    RightSidebarPresetBaseTabSchema,
    zod_1.z
        .string()
        .min("terminal_new:".length + 1)
        .regex(/^terminal_new:.+$/),
]);
exports.RightSidebarLayoutPresetNodeSchema = zod_1.z.lazy(() => {
    const tabset = zod_1.z
        .object({
        type: zod_1.z.literal("tabset"),
        id: zod_1.z.string().min(1),
        tabs: zod_1.z.array(exports.RightSidebarPresetTabSchema),
        activeTab: exports.RightSidebarPresetTabSchema,
    })
        .strict();
    const split = zod_1.z
        .object({
        type: zod_1.z.literal("split"),
        id: zod_1.z.string().min(1),
        direction: zod_1.z.enum(["horizontal", "vertical"]),
        sizes: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
        children: zod_1.z.tuple([exports.RightSidebarLayoutPresetNodeSchema, exports.RightSidebarLayoutPresetNodeSchema]),
    })
        .strict();
    return zod_1.z.union([split, tabset]);
});
exports.RightSidebarLayoutPresetStateSchema = zod_1.z
    .object({
    version: zod_1.z.literal(1),
    nextId: zod_1.z.number().int(),
    focusedTabsetId: zod_1.z.string().min(1),
    root: exports.RightSidebarLayoutPresetNodeSchema,
})
    .strict();
exports.RightSidebarWidthPresetSchema = zod_1.z.discriminatedUnion("mode", [
    zod_1.z
        .object({
        mode: zod_1.z.literal("px"),
        value: zod_1.z.number().int(),
    })
        .strict(),
    zod_1.z
        .object({
        mode: zod_1.z.literal("fraction"),
        value: zod_1.z.number(),
    })
        .strict(),
]);
exports.LayoutPresetSchema = zod_1.z
    .object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    leftSidebarCollapsed: zod_1.z.boolean(),
    rightSidebar: zod_1.z
        .object({
        collapsed: zod_1.z.boolean(),
        width: exports.RightSidebarWidthPresetSchema,
        layout: exports.RightSidebarLayoutPresetStateSchema,
    })
        .strict(),
})
    .strict();
exports.LayoutSlotSchema = zod_1.z
    .object({
    slot: zod_1.z.number().int().min(1),
    preset: exports.LayoutPresetSchema.optional(),
    keybindOverride: exports.KeybindSchema.optional(),
})
    .strict();
exports.LayoutPresetsConfigSchema = zod_1.z
    .object({
    version: zod_1.z.literal(2),
    slots: zod_1.z.array(exports.LayoutSlotSchema),
})
    .strict();
//# sourceMappingURL=uiLayouts.js.map