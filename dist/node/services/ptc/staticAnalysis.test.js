"use strict";
/**
 * Tests for PTC Static Analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const staticAnalysis_1 = require("./staticAnalysis");
(0, bun_test_1.afterAll)(() => {
    (0, staticAnalysis_1.disposeAnalysisContext)();
});
(0, bun_test_1.describe)("staticAnalysis", () => {
    (0, bun_test_1.describe)("syntax validation", () => {
        (0, bun_test_1.test)("valid code passes", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const x = 1;
        const y = 2;
        return x + y;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
            (0, bun_test_1.expect)(result.errors).toHaveLength(0);
        });
        (0, bun_test_1.test)("syntax error is detected", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const x = 1
        const y = 2 +
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors).toHaveLength(1);
            (0, bun_test_1.expect)(result.errors[0].type).toBe("syntax");
        });
        (0, bun_test_1.test)("unclosed brace is detected", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        if (true) {
          const x = 1;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors[0].type).toBe("syntax");
        });
        (0, bun_test_1.test)("invalid token is detected", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const x = @invalid;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors[0].type).toBe("syntax");
        });
        (0, bun_test_1.test)("await expression gives clear error message", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`const x = awaitunix.bash({ script: "ls" })`);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors).toHaveLength(1);
            (0, bun_test_1.expect)(result.errors[0].type).toBe("syntax");
            // Should give clear message about await, not obtuse "expecting ';'"
            (0, bun_test_1.expect)(result.errors[0].message).toContain("await");
            (0, bun_test_1.expect)(result.errors[0].message).toContain("not supported");
        });
        (0, bun_test_1.test)("allows return statements (wrapped in function)", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const x =unix.fileRead("test.txt");
        return x;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
    });
    (0, bun_test_1.describe)("unavailable patterns", () => {
        (0, bun_test_1.test)("dynamic import() is unavailable", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const mod = import("./module.js");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("import()"))).toBe(true);
        });
        (0, bun_test_1.test)("require() is unavailable", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const fs = require("fs");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("require()"))).toBe(true);
        });
    });
    (0, bun_test_1.describe)("unavailable globals", () => {
        (0, bun_test_1.test)("process is unavailable", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const env = process.env;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("process"))).toBe(true);
        });
        (0, bun_test_1.test)("window is unavailable", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        window.alert("hi");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("window"))).toBe(true);
        });
        (0, bun_test_1.test)("fetch is unavailable", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        fetch("https://example.com");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("fetch"))).toBe(true);
        });
        (0, bun_test_1.test)("document is unavailable", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        document.getElementById("test");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("document"))).toBe(true);
        });
        (0, bun_test_1.test)("multiple unavailable globals produce one error each", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const a = process.env;
        const b = window.location;
        const c = fetch("url");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.filter((e) => e.type === "unavailable_global")).toHaveLength(3);
        });
        (0, bun_test_1.test)("same global used twice produces only one error", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const a = process.env;
        const b = process.cwd();
      `);
            (0, bun_test_1.expect)(result.valid).toBe(false);
            (0, bun_test_1.expect)(result.errors.filter((e) => e.message.includes("process"))).toHaveLength(1);
        });
        (0, bun_test_1.test)("property access obj.process does not error", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const obj = { foo: "bar" };
        return obj.process;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
            (0, bun_test_1.expect)(result.errors).toHaveLength(0);
        });
        (0, bun_test_1.test)("object key like { process: ... } does NOT error (AST-based detection)", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const obj = { process: "running" };
      `);
            // AST-based detection correctly identifies this as an object key, not a reference
            (0, bun_test_1.expect)(result.valid).toBe(true);
            (0, bun_test_1.expect)(result.errors).toHaveLength(0);
        });
        (0, bun_test_1.test)("error includes line number", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`const x = 1;
const y = 2;
const env = process.env;`);
            const processError = result.errors.find((e) => e.message.includes("process"));
            (0, bun_test_1.expect)(processError?.line).toBe(3);
        });
    });
    (0, bun_test_1.describe)("allowed constructs (work in QuickJS)", () => {
        (0, bun_test_1.test)("eval() is allowed", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const x = eval("1 + 1");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("new Function() is allowed", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const fn = new Function("a", "b", "return a + b");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("globalThis is allowed", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const pi = globalThis.Math.PI;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("Proxy is allowed", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const p = new Proxy({}, {});
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("Reflect is allowed", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const x = Reflect.get({a: 1}, "a");
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
    });
    (0, bun_test_1.describe)("line number reporting", () => {
        (0, bun_test_1.test)("reports line number for unavailable pattern", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`const x = 1;
const y = 2;
require("fs");
const z = 3;`);
            const requireError = result.errors.find((e) => e.message.includes("require"));
            (0, bun_test_1.expect)(requireError?.line).toBe(3);
        });
    });
    (0, bun_test_1.describe)("valid code examples", () => {
        (0, bun_test_1.test)("file reading and processing", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const content =unix.fileRead("package.json");
        const pkg = JSON.parse(content);
        return pkg.name;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
            (0, bun_test_1.expect)(result.errors).toHaveLength(0);
        });
        (0, bun_test_1.test)("array operations", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const files = ["a.txt", "b.txt", "c.txt"];
        const results = [];
        for (const file of files) {
          results.push(unix.fileRead(file));
        }
        return results;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("using Date and Math", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const now = new Date();
        const random = Math.floor(Math.random() * 100);
        console.log("Time:", now.toISOString());
        return random;
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("object and array manipulation", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const data = { items: [1, 2, 3] };
        const doubled = data.items.map(x => x * 2);
        const sum = doubled.reduce((a, b) => a + b, 0);
        return { doubled, sum };
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("try-catch error handling", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        try {
          const content =unix.fileRead("maybe-missing.txt");
          return content;
        } catch (err) {
          console.error("File not found:", err.message);
          return null;
        }
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("regex operations", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const text =unix.fileRead("log.txt");
        const pattern = /error:.*/gi;
        const matches = text.match(pattern);
        return matches || [];
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
    });
    (0, bun_test_1.describe)("edge cases", () => {
        (0, bun_test_1.test)("empty code is valid", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)("");
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("whitespace only is valid", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)("   \n\n  \t  ");
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("comment only is valid", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        // This is a comment
        /* Multi-line
           comment */
      `);
            (0, bun_test_1.expect)(result.valid).toBe(true);
        });
        (0, bun_test_1.test)("require in string literal - still false positive for patterns", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const msg = "Use require() to import modules";
        console.log(msg);
      `);
            // Known limitation: pattern-based detection for require() can't distinguish strings
            // This is acceptable since agents rarely put "require()" in string literals
            (0, bun_test_1.expect)(result.valid).toBe(false); // False positive for pattern detection
            (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("require()"))).toBe(true);
        });
        (0, bun_test_1.test)("process in string literal does NOT error (AST-based detection)", async () => {
            const result = await (0, staticAnalysis_1.analyzeCode)(`
        const msg = "The process is complete";
        console.log(msg);
      `);
            // AST-based detection correctly ignores string literal content
            (0, bun_test_1.expect)(result.valid).toBe(true);
            (0, bun_test_1.expect)(result.errors).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=staticAnalysis.test.js.map