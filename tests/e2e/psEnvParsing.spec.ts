import { test, expect } from "@playwright/test";
import { parseEnvVarFromPsCommand } from "./electronTest";

test.describe("parseEnvVarFromPsCommand", () => {
  test("parses env values containing spaces", () => {
    const command = "sleep 5 UNIX_ROOT=/Users/Jane Doe/dev/unix SHELL=/bin/zsh PATH=/usr/bin";

    expect(parseEnvVarFromPsCommand(command, "UNIX_ROOT")).toBe("/Users/Jane Doe/dev/unix");
  });

  test("returns empty string when key is present but empty", () => {
    const command = "sleep 5 UNIX_ROOT= SHELL=/bin/zsh";

    expect(parseEnvVarFromPsCommand(command, "UNIX_ROOT")).toBe("");
  });

  test("returns undefined when key is missing", () => {
    const command = "sleep 5 SHELL=/bin/zsh";

    expect(parseEnvVarFromPsCommand(command, "UNIX_ROOT")).toBeUndefined();
  });
});
