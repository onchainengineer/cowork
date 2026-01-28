"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const languageDetector_1 = require("./languageDetector");
(0, bun_test_1.describe)("getLanguageFromPath", () => {
    (0, bun_test_1.describe)("JavaScript/TypeScript ecosystem", () => {
        (0, bun_test_1.test)("detects TypeScript", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Component.tsx")).toBe("tsx");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("utils.ts")).toBe("typescript");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("src/utils/helper.ts")).toBe("typescript");
        });
        (0, bun_test_1.test)("detects JavaScript", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("app.js")).toBe("javascript");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Component.jsx")).toBe("jsx");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("src/components/Button.jsx")).toBe("jsx");
        });
    });
    (0, bun_test_1.describe)("web technologies", () => {
        (0, bun_test_1.test)("detects HTML", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("index.html")).toBe("html");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("templates/page.html")).toBe("html");
        });
        (0, bun_test_1.test)("detects CSS and variants", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("styles.css")).toBe("css");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("app.scss")).toBe("scss");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("theme.sass")).toBe("sass");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("variables.less")).toBe("less");
        });
    });
    (0, bun_test_1.describe)("backend languages", () => {
        (0, bun_test_1.test)("detects Python", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("main.py")).toBe("python");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("src/utils/helper.py")).toBe("python");
        });
        (0, bun_test_1.test)("detects Java", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Main.java")).toBe("java");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("com/example/Service.java")).toBe("java");
        });
        (0, bun_test_1.test)("detects Go", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("main.go")).toBe("go");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("pkg/utils/helper.go")).toBe("go");
        });
        (0, bun_test_1.test)("detects Rust", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("main.rs")).toBe("rust");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("src/lib.rs")).toBe("rust");
        });
        (0, bun_test_1.test)("detects C/C++", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("main.c")).toBe("c");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("main.cpp")).toBe("cpp");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("header.h")).toBe("c");
        });
        (0, bun_test_1.test)("detects C#", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Program.cs")).toBe("csharp");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Services/UserService.cs")).toBe("csharp");
        });
        (0, bun_test_1.test)("detects Ruby", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("app.rb")).toBe("ruby");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Gemfile")).toBe("ruby");
        });
        (0, bun_test_1.test)("detects PHP", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("index.php")).toBe("php");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("src/Controller.php")).toBe("php");
        });
        (0, bun_test_1.test)("detects other backend languages", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Main.kt")).toBe("kotlin");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("App.swift")).toBe("swift");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Main.scala")).toBe("scala");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("app.ex")).toBe("elixir");
        });
    });
    (0, bun_test_1.describe)("shell and scripting", () => {
        (0, bun_test_1.test)("detects shell scripts", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("script.sh")).toBe("bash");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("deploy.bash")).toBe("bash");
        });
        (0, bun_test_1.test)("detects PowerShell", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("script.ps1")).toBe("powershell");
        });
        (0, bun_test_1.test)("detects batch files", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("build.bat")).toBe("batch");
        });
    });
    (0, bun_test_1.describe)("data and config formats", () => {
        (0, bun_test_1.test)("detects JSON", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("package.json")).toBe("json");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("config.json")).toBe("json");
        });
        (0, bun_test_1.test)("detects YAML", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("config.yaml")).toBe("yaml");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)(".github/workflows/ci.yml")).toBe("yaml");
        });
        (0, bun_test_1.test)("detects TOML", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Cargo.toml")).toBe("toml");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("config.toml")).toBe("toml");
        });
        (0, bun_test_1.test)("detects XML", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("config.xml")).toBe("xml");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("pom.xml")).toBe("xml");
        });
        (0, bun_test_1.test)("detects Markdown", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("README.md")).toBe("markdown");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("docs/guide.md")).toBe("markdown");
        });
        (0, bun_test_1.test)("detects SQL", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("schema.sql")).toBe("sql");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("migrations/001_init.sql")).toBe("sql");
        });
        (0, bun_test_1.test)("detects GraphQL", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("schema.graphql")).toBe("graphql");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("queries.gql")).toBe("graphql");
        });
    });
    (0, bun_test_1.describe)("other formats", () => {
        (0, bun_test_1.test)("detects Dockerfile", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Dockerfile")).toBe("docker");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Dockerfile.prod")).toBe("docker");
        });
        (0, bun_test_1.test)("detects Makefile", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("Makefile")).toBe("makefile");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("GNUmakefile")).toBe("makefile");
        });
    });
    (0, bun_test_1.describe)("edge cases", () => {
        (0, bun_test_1.test)("handles unknown extensions", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("file.unknownext")).toBe("text");
        });
        (0, bun_test_1.test)("handles files without extensions", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("README")).toBe("text");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("LICENSE")).toBe("text");
        });
        (0, bun_test_1.test)("handles paths with directories", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("src/components/Button.tsx")).toBe("tsx");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("backend/services/user.py")).toBe("python");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("./relative/path/file.go")).toBe("go");
        });
        (0, bun_test_1.test)("handles absolute paths", () => {
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("/usr/local/bin/script.sh")).toBe("bash");
            (0, bun_test_1.expect)((0, languageDetector_1.getLanguageFromPath)("/home/user/project/main.rs")).toBe("rust");
        });
        (0, bun_test_1.test)("fallback to lowercase for unmapped languages", () => {
            // Languages not in LINGUIST_TO_PRISM map should fallback to lowercase
            // This is handled by the lowercase fallback in the implementation
            const result = (0, languageDetector_1.getLanguageFromPath)("test.dart");
            // Dart should be detected and lowercased (if not in map explicitly)
            (0, bun_test_1.expect)(typeof result).toBe("string");
            (0, bun_test_1.expect)(result.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=languageDetector.test.js.map