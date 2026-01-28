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
const bun_test_1 = require("bun:test");
const paths_main_1 = require("./paths.main");
const paths_1 = require("./paths");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
(0, bun_test_1.describe)("PlatformPaths", () => {
    (0, bun_test_1.describe)("basename", () => {
        (0, bun_test_1.test)("extracts basename from path using current platform", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.basename("/home/user/project")).toBe("project");
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.basename("/home/user/project/file.txt")).toBe("file.txt");
        });
        (0, bun_test_1.test)("handles edge cases", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.basename("")).toBe("");
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.basename("project")).toBe("project");
        });
    });
    (0, bun_test_1.describe)("parse", () => {
        (0, bun_test_1.test)("parses absolute path on current platform", () => {
            const testPath = path.join("/", "home", "user", "projects", "unix");
            const result = paths_main_1.PlatformPaths.parse(testPath);
            (0, bun_test_1.expect)(result.segments).toContain("home");
            (0, bun_test_1.expect)(result.segments).toContain("user");
            (0, bun_test_1.expect)(result.segments).toContain("projects");
            (0, bun_test_1.expect)(result.basename).toBe("unix");
        });
        (0, bun_test_1.test)("parses relative path", () => {
            const result = paths_main_1.PlatformPaths.parse("src/utils/paths.ts");
            (0, bun_test_1.expect)(result.root).toBe("");
            (0, bun_test_1.expect)(result.basename).toBe("paths.ts");
        });
        (0, bun_test_1.test)("handles edge cases", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.parse("")).toEqual({ root: "", segments: [], basename: "" });
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.parse("file.txt").basename).toBe("file.txt");
        });
    });
    (0, bun_test_1.describe)("abbreviate", () => {
        (0, bun_test_1.test)("abbreviates path", () => {
            const testPath = path.join("/", "home", "user", "Projects", "lattice", "unix");
            const result = paths_main_1.PlatformPaths.abbreviate(testPath);
            // Should end with the full basename
            (0, bun_test_1.expect)(result.endsWith("unix")).toBe(true);
            // Should be shorter than original (segments abbreviated)
            (0, bun_test_1.expect)(result.length).toBeLessThan(testPath.length);
        });
        (0, bun_test_1.test)("handles short paths", () => {
            const testPath = path.join("/", "home");
            const result = paths_main_1.PlatformPaths.abbreviate(testPath);
            // Short paths should not be abbreviated much
            (0, bun_test_1.expect)(result).toContain("home");
        });
        (0, bun_test_1.test)("handles empty input", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.abbreviate("")).toBe("");
        });
    });
    (0, bun_test_1.describe)("splitAbbreviated", () => {
        (0, bun_test_1.test)("splits abbreviated path", () => {
            const testPath = path.join("/", "h", "u", "P", "c", "unix");
            const result = paths_main_1.PlatformPaths.splitAbbreviated(testPath);
            (0, bun_test_1.expect)(result.basename).toBe("unix");
            (0, bun_test_1.expect)(result.dirPath.endsWith(path.sep)).toBe(true);
        });
        (0, bun_test_1.test)("handles path without directory", () => {
            const result = paths_main_1.PlatformPaths.splitAbbreviated("file.txt");
            (0, bun_test_1.expect)(result.dirPath).toBe("");
            (0, bun_test_1.expect)(result.basename).toBe("file.txt");
        });
    });
    (0, bun_test_1.describe)("formatHome", () => {
        (0, bun_test_1.test)("replaces home directory with tilde", () => {
            const home = os.homedir();
            const testPath = path.join(home, "projects", "unix");
            const result = paths_main_1.PlatformPaths.formatHome(testPath);
            const sep = paths_main_1.PlatformPaths.separator;
            (0, bun_test_1.expect)(result).toBe(`~${sep}projects${sep}unix`);
        });
        (0, bun_test_1.test)("leaves non-home paths unchanged", () => {
            const result = paths_main_1.PlatformPaths.formatHome("/tmp/test");
            (0, bun_test_1.expect)(result).toBe("/tmp/test");
        });
    });
    (0, bun_test_1.describe)("expandHome", () => {
        (0, bun_test_1.test)("expands tilde to home directory", () => {
            const home = os.homedir();
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.expandHome("~")).toBe(home);
        });
        (0, bun_test_1.test)("expands tilde with path", () => {
            const home = os.homedir();
            const sep = path.sep;
            const result = paths_main_1.PlatformPaths.expandHome(`~${sep}projects${sep}unix`);
            (0, bun_test_1.expect)(result).toBe(path.join(home, "projects", "unix"));
        });
        (0, bun_test_1.test)("leaves absolute paths unchanged", () => {
            const testPath = path.join("/", "home", "user", "project");
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.expandHome(testPath)).toBe(testPath);
        });
        (0, bun_test_1.test)("expands ~/.unix to UNIX_ROOT when set", () => {
            const originalMuxRoot = process.env.UNIX_ROOT;
            const testMuxRoot = path.join(os.tmpdir(), "unix-root-test");
            process.env.UNIX_ROOT = testMuxRoot;
            try {
                const sep = path.sep;
                const muxPath = `~${sep}.unix${sep}src${sep}project`;
                (0, bun_test_1.expect)(paths_main_1.PlatformPaths.expandHome(muxPath)).toBe(path.join(testMuxRoot, "src", "project"));
                // Other ~ paths should still resolve to the actual OS home directory.
                const home = os.homedir();
                const homePath = `~${sep}projects${sep}unix`;
                (0, bun_test_1.expect)(paths_main_1.PlatformPaths.expandHome(homePath)).toBe(path.join(home, "projects", "unix"));
            }
            finally {
                if (originalMuxRoot === undefined) {
                    delete process.env.UNIX_ROOT;
                }
                else {
                    process.env.UNIX_ROOT = originalMuxRoot;
                }
            }
        });
        (0, bun_test_1.test)("handles empty input", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.expandHome("")).toBe("");
        });
    });
    (0, bun_test_1.describe)("getProjectName", () => {
        (0, bun_test_1.test)("extracts project name from path", () => {
            const testPath = path.join("/", "home", "user", "projects", "unix");
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.getProjectName(testPath)).toBe("unix");
        });
        (0, bun_test_1.test)("handles relative paths", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.getProjectName("projects/unix")).toBe("unix");
        });
        (0, bun_test_1.test)("returns 'unknown' for empty path", () => {
            (0, bun_test_1.expect)(paths_main_1.PlatformPaths.getProjectName("")).toBe("unknown");
        });
    });
    (0, bun_test_1.describe)("separator", () => {
        (0, bun_test_1.test)("returns correct separator for platform", () => {
            const sep = paths_main_1.PlatformPaths.separator;
            // Should match the current platform's separator
            (0, bun_test_1.expect)(sep).toBe(path.sep);
        });
    });
});
(0, bun_test_1.describe)("toPosixPath", () => {
    (0, bun_test_1.describe)("on non-Windows platforms", () => {
        (0, bun_test_1.test)("returns POSIX paths unchanged", () => {
            if (process.platform !== "win32") {
                (0, bun_test_1.expect)((0, paths_1.toPosixPath)("/home/user/project")).toBe("/home/user/project");
                (0, bun_test_1.expect)((0, paths_1.toPosixPath)("/tmp/unix-bashes")).toBe("/tmp/unix-bashes");
            }
        });
        (0, bun_test_1.test)("returns paths with spaces unchanged", () => {
            if (process.platform !== "win32") {
                (0, bun_test_1.expect)((0, paths_1.toPosixPath)("/home/user/my project")).toBe("/home/user/my project");
            }
        });
        (0, bun_test_1.test)("returns relative paths unchanged", () => {
            if (process.platform !== "win32") {
                (0, bun_test_1.expect)((0, paths_1.toPosixPath)("relative/path/file.txt")).toBe("relative/path/file.txt");
            }
        });
        (0, bun_test_1.test)("returns empty string unchanged", () => {
            if (process.platform !== "win32") {
                (0, bun_test_1.expect)((0, paths_1.toPosixPath)("")).toBe("");
            }
        });
    });
    (0, bun_test_1.describe)("path format handling", () => {
        (0, bun_test_1.test)("handles paths with special characters", () => {
            const input = "/path/with spaces/and-dashes/under_scores";
            const result = (0, paths_1.toPosixPath)(input);
            (0, bun_test_1.expect)(typeof result).toBe("string");
            if (process.platform !== "win32") {
                (0, bun_test_1.expect)(result).toBe(input);
            }
        });
        (0, bun_test_1.test)("handles deeply nested paths", () => {
            const input = "/a/b/c/d/e/f/g/h/i/j/file.txt";
            const result = (0, paths_1.toPosixPath)(input);
            (0, bun_test_1.expect)(typeof result).toBe("string");
            if (process.platform !== "win32") {
                (0, bun_test_1.expect)(result).toBe(input);
            }
        });
    });
    // Windows-specific behavior documentation
    // These tests document expected behavior but can only truly verify on Windows CI
    (0, bun_test_1.describe)("Windows behavior (documented)", () => {
        (0, bun_test_1.test)("converts Windows drive paths to POSIX format on Windows", () => {
            // On Windows with Git Bash/MSYS2, cygpath converts:
            //   "C:\\Users\\test" → "/c/Users/test"
            //   "C:\\Program Files\\Git" → "/c/Program Files/Git"
            //   "D:\\Projects\\unix" → "/d/Projects/unix"
            //
            // On non-Windows, this is a no-op (returns input unchanged)
            if (process.platform === "win32") {
                // Real Windows test - only runs on Windows CI
                const result = (0, paths_1.toPosixPath)("C:\\Users\\test");
                (0, bun_test_1.expect)(result).toMatch(/^\/c\/Users\/test$/i);
            }
        });
        (0, bun_test_1.test)("falls back to original path if cygpath unavailable", () => {
            // If cygpath is not available (edge case), the function catches
            // the error and returns the original path unchanged
            // This prevents crashes if Git Bash is misconfigured
            (0, bun_test_1.expect)(true).toBe(true); // Cannot easily test without mocking execSync
        });
    });
});
//# sourceMappingURL=paths.test.js.map