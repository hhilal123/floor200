import { describe, expect, it } from "vitest";

import {
  CommandExitError,
  CommandStartError,
  createCommandRunner,
  type ExecFileImplementation,
} from "../src/process.js";

describe("createCommandRunner", () => {
  it("forwards command arguments without a shell and captures output", async () => {
    const calls: unknown[][] = [];
    const execFile: ExecFileImplementation = (file, args, options, callback) => {
      calls.push([file, args, options]);
      callback(null, "output\n", "warning\n");
    };

    const result = await createCommandRunner(execFile).run("gh", [
      "pr",
      "list",
    ]);

    expect(calls).toEqual([
      ["gh", ["pr", "list"], { encoding: "utf8", maxBuffer: 10_000_000 }],
    ]);
    expect(result).toEqual({ stdout: "output\n", stderr: "warning\n" });
  });

  it("distinguishes a missing executable", async () => {
    const execFile: ExecFileImplementation = (_file, _args, _options, callback) => {
      const error = Object.assign(new Error("spawn gh ENOENT"), {
        code: "ENOENT",
      });
      callback(error, "", "");
    };

    await expect(createCommandRunner(execFile).run("gh", ["--version"]))
      .rejects.toBeInstanceOf(CommandStartError);
  });

  it("reports a non-zero command exit without persisting output", async () => {
    const execFile: ExecFileImplementation = (_file, _args, _options, callback) => {
      const error = Object.assign(new Error("command failed"), { code: 1 });
      callback(error, "", "authentication required");
    };

    await expect(createCommandRunner(execFile).run("gh", ["auth", "status"]))
      .rejects.toMatchObject({
        name: "CommandExitError",
        exitCode: 1,
        stderr: "authentication required",
      } satisfies Partial<CommandExitError>);
  });
});
