"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const projectOrdering_1 = require("./projectOrdering");
(0, globals_1.describe)("projectOrdering", () => {
    const createProjects = (paths) => {
        const map = new Map();
        for (const p of paths) {
            map.set(p, { workspaces: [] });
        }
        return map;
    };
    (0, globals_1.describe)("sortProjectsByOrder", () => {
        (0, globals_1.it)("returns lexical order when order array is empty", () => {
            const projects = createProjects(["/a", "/c", "/b"]);
            const result = (0, projectOrdering_1.sortProjectsByOrder)(projects, []);
            (0, globals_1.expect)(result.map(([p]) => p)).toEqual(["/a", "/b", "/c"]);
        });
        (0, globals_1.it)("sorts projects according to order array", () => {
            const projects = createProjects(["/a", "/b", "/c"]);
            const result = (0, projectOrdering_1.sortProjectsByOrder)(projects, ["/c", "/a", "/b"]);
            (0, globals_1.expect)(result.map(([p]) => p)).toEqual(["/c", "/a", "/b"]);
        });
        (0, globals_1.it)("puts unknown projects at the end in natural order", () => {
            const projects = createProjects(["/a", "/b", "/c", "/d"]);
            const result = (0, projectOrdering_1.sortProjectsByOrder)(projects, ["/c", "/a"]);
            // /c and /a are ordered, /b and /d are unknown and should appear in natural order
            (0, globals_1.expect)(result.map(([p]) => p)).toEqual(["/c", "/a", "/b", "/d"]);
        });
    });
    (0, globals_1.describe)("reorderProjects", () => {
        (0, globals_1.it)("moves dragged project to target position", () => {
            const projects = createProjects(["/a", "/b", "/c", "/d"]);
            const currentOrder = ["/a", "/b", "/c", "/d"];
            // Drag /d onto /b (move /d to position 1)
            const result = (0, projectOrdering_1.reorderProjects)(currentOrder, projects, "/d", "/b");
            (0, globals_1.expect)(result).toEqual(["/a", "/d", "/b", "/c"]);
        });
        (0, globals_1.it)("returns current order if dragged or target not found", () => {
            const projects = createProjects(["/a", "/b", "/c"]);
            const currentOrder = ["/a", "/b", "/c"];
            const result = (0, projectOrdering_1.reorderProjects)(currentOrder, projects, "/x", "/b");
            (0, globals_1.expect)(result).toEqual(["/a", "/b", "/c"]);
        });
        (0, globals_1.it)("returns current order if dragged === target", () => {
            const projects = createProjects(["/a", "/b", "/c"]);
            const currentOrder = ["/a", "/b", "/c"];
            const result = (0, projectOrdering_1.reorderProjects)(currentOrder, projects, "/b", "/b");
            (0, globals_1.expect)(result).toEqual(["/a", "/b", "/c"]);
        });
    });
    (0, globals_1.describe)("normalizeOrder", () => {
        (0, globals_1.it)("removes paths that no longer exist", () => {
            const projects = createProjects(["/a", "/b"]);
            const order = ["/a", "/b", "/c", "/d"];
            const result = (0, projectOrdering_1.normalizeOrder)(order, projects);
            (0, globals_1.expect)(result).toEqual(["/a", "/b"]);
        });
        (0, globals_1.it)("prepends new projects to the front in lexical order", () => {
            const projects = createProjects(["/a", "/b", "/c", "/d"]);
            const order = ["/b", "/a"];
            const result = (0, projectOrdering_1.normalizeOrder)(order, projects);
            // /c and /d are missing from order, prepended in lexical order
            (0, globals_1.expect)(result).toEqual(["/c", "/d", "/b", "/a"]);
        });
        (0, globals_1.it)("sorts missing projects lexically for deterministic order", () => {
            // Even if Map iteration order is non-lexical, missing projects should be sorted
            const projects = new Map([
                ["/z-project", { workspaces: [] }],
                ["/a-project", { workspaces: [] }],
                ["/m-project", { workspaces: [] }],
            ]);
            const order = []; // empty order, all projects are "missing"
            const result = (0, projectOrdering_1.normalizeOrder)(order, projects);
            // Should be lexically sorted regardless of Map insertion order
            (0, globals_1.expect)(result).toEqual(["/a-project", "/m-project", "/z-project"]);
        });
        (0, globals_1.it)("preserves order of existing projects", () => {
            const projects = createProjects(["/a", "/b", "/c"]);
            const order = ["/c", "/a", "/b"];
            const result = (0, projectOrdering_1.normalizeOrder)(order, projects);
            (0, globals_1.expect)(result).toEqual(["/c", "/a", "/b"]);
        });
    });
    (0, globals_1.describe)("equalOrders", () => {
        (0, globals_1.it)("returns true for identical arrays", () => {
            const a = ["/a", "/b", "/c"];
            const b = ["/a", "/b", "/c"];
            (0, globals_1.expect)((0, projectOrdering_1.equalOrders)(a, b)).toBe(true);
        });
        (0, globals_1.it)("returns false for arrays with different lengths", () => {
            const a = ["/a", "/b"];
            const b = ["/a", "/b", "/c"];
            (0, globals_1.expect)((0, projectOrdering_1.equalOrders)(a, b)).toBe(false);
        });
        (0, globals_1.it)("returns false for arrays with different order", () => {
            const a = ["/a", "/b", "/c"];
            const b = ["/a", "/c", "/b"];
            (0, globals_1.expect)((0, projectOrdering_1.equalOrders)(a, b)).toBe(false);
        });
        (0, globals_1.it)("returns true for same reference", () => {
            const a = ["/a", "/b", "/c"];
            (0, globals_1.expect)((0, projectOrdering_1.equalOrders)(a, a)).toBe(true);
        });
    });
    (0, globals_1.describe)("Bug fix: empty projects Map on initial load", () => {
        (0, globals_1.it)("returns empty array when projects Map is empty", () => {
            // This documents the bug scenario:
            // 1. localStorage has projectOrder = ["/a", "/b", "/c"]
            // 2. Projects haven't loaded yet, so projects = new Map()
            // 3. If normalization runs, it would clear the order
            const emptyProjects = createProjects([]);
            const order = ["/a", "/b", "/c"];
            const result = (0, projectOrdering_1.normalizeOrder)(order, emptyProjects);
            // normalizeOrder returns [] when projects is empty
            (0, globals_1.expect)(result).toEqual([]);
            // Fix: ProjectSidebar.tsx skips normalization when projects.size === 0
            // This prevents clearing the order during initial component mount
        });
        (0, globals_1.it)("normalizes correctly after projects load", () => {
            // After projects load, normalization should work normally:
            // 1. projectOrder is still ["/a", "/b", "/c"] from localStorage
            // 2. Projects are now loaded with an additional project ["/d"]
            // 3. Normalization should treat the new project as "most recent" and put it first
            const projectOrder = ["/a", "/b", "/c"];
            const loadedProjects = createProjects(["/a", "/b", "/c", "/d"]);
            const result = (0, projectOrdering_1.normalizeOrder)(projectOrder, loadedProjects);
            (0, globals_1.expect)(result).toEqual(["/d", "/a", "/b", "/c"]);
        });
    });
});
//# sourceMappingURL=projectOrdering.test.js.map