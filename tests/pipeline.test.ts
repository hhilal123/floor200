import { readFileSync } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { GitRepositoryError } from "../src/git.js";
import { type CommandResult, type CommandRunner } from "../src/process.js";
import { runPipeline } from "../src/pipeline.js";
import type { PipelineStepResult } from "../src/pipeline.js";

const fixturesDirectory = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const gitLogFixture = readFileSync(join(fixturesDirectory, "git-log-numstat.txt"), "utf8")
  .replaceAll("<RS>", "\x1e")
  .replaceAll("<US>", "\x1f");
const prListFixture = readFileSync(join(fixturesDirectory, "github-pr-list.json"), "utf8");
const ccusageFixture = readFileSync(join(fixturesDirectory, "ccusage-sessions.json"), "utf8");

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

class FakeRunner implements CommandRunner {
  calls: Array<{ command: string; args: string[] }> = [];
  constructor(private responses: Array<CommandResult | Error>) {}
  async run(command: string, args: string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Fake runner has no response");
    return response;
  }
}

async function tempProject(configYaml?: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "floor200-pipeline-"));
  temporaryDirectories.push(directory);
  if (configYaml !== undefined) {
    await writeFile(join(directory, ".floor200.yml"), configYaml, "utf8");
  }
  return directory;
}

const ok = (stdout = ""): CommandResult => ({ stdout, stderr: "" });

const gitHappyPathResponses = (): Array<CommandResult | Error> => [
  ok("/repo\n"), // git rev-parse --show-toplevel
  ok("main\n"), // git branch --show-current
  ok(""), // git remote get-url origin
  ok(gitLogFixture), // git log ...
];

const prsHappyPathResponses = (): Array<CommandResult | Error> => [
  ok("gh version 2.80.0"), // gh --version
  ok(""), // gh auth status
  ok(prListFixture), // gh pr list
];

const usageHappyPathResponses = (): Array<CommandResult | Error> => [
  ok(""), // ccusage --version
  ok("[]"), // ccusage claude session --json
  ok(ccusageFixture), // ccusage session --json
];

describe("runPipeline", () => {
  it("runs every step in order and produces a report", async () => {
    const directory = await tempProject('project:\n  name: "example"\n  repo: "acme/floor200"\n');
    const runner = new FakeRunner([
      ...gitHappyPathResponses(),
      ...prsHappyPathResponses(),
      ...usageHappyPathResponses(),
    ]);
    const steps: PipelineStepResult[] = [];

    const result = await runPipeline({ baseDirectory: directory, runner, onStep: (step) => steps.push(step) });

    expect(steps.map((step) => step.step)).toEqual(["git", "prs", "usage", "attribute", "report"]);
    expect(steps.every((step) => step.status === "ok")).toBe(true);
    const attributions = JSON.parse(
      await readFile(join(directory, ".floor200", "data", "attributions.json"), "utf8"),
    );
    expect(Array.isArray(attributions)).toBe(true);
    expect(result.report).toContain("Floor200");
  });

  it("auto-initializes a missing config and continues, skipping PRs without project.repo", async () => {
    const directory = await tempProject();
    const runner = new FakeRunner([
      ...gitHappyPathResponses(),
      ...usageHappyPathResponses(),
    ]);
    const steps: PipelineStepResult[] = [];

    await runPipeline({ baseDirectory: directory, runner, onStep: (step) => steps.push(step) });

    expect(steps[0]).toMatchObject({ step: "init", status: "initialized" });
    await expect(access(join(directory, ".floor200.yml"))).resolves.toBeUndefined();
    const prsStep = steps.find((step) => step.step === "prs");
    expect(prsStep).toMatchObject({ status: "skipped" });
    expect(prsStep?.warning).toContain("project.repo");
    expect(JSON.parse(await readFile(join(directory, ".floor200", "data", "prs.json"), "utf8"))).toEqual([]);
  });

  it("skips pull requests and continues when gh is unauthenticated", async () => {
    const directory = await tempProject('project:\n  name: "example"\n  repo: "acme/floor200"\n');
    const runner = new FakeRunner([
      ...gitHappyPathResponses(),
      ok("gh version 2.80.0"),
      new Error("not authenticated"),
      ...usageHappyPathResponses(),
    ]);
    const steps: PipelineStepResult[] = [];

    const result = await runPipeline({ baseDirectory: directory, runner, onStep: (step) => steps.push(step) });

    const prsStep = steps.find((step) => step.step === "prs");
    expect(prsStep).toMatchObject({ status: "skipped" });
    expect(prsStep?.warning).toContain("gh auth login");
    expect(JSON.parse(await readFile(join(directory, ".floor200", "data", "prs.json"), "utf8"))).toEqual([]);
    expect(steps.map((step) => step.step)).toEqual(["git", "prs", "usage", "attribute", "report"]);
    expect(result.report).toContain("Floor200");
  });

  it("skips usage and continues when ccusage is missing", async () => {
    const directory = await tempProject('project:\n  name: "example"\n  repo: "acme/floor200"\n');
    const runner = new FakeRunner([
      ...gitHappyPathResponses(),
      ...prsHappyPathResponses(),
      new Error("ccusage not found"),
    ]);
    const steps: PipelineStepResult[] = [];

    const result = await runPipeline({ baseDirectory: directory, runner, onStep: (step) => steps.push(step) });

    const usageStep = steps.find((step) => step.step === "usage");
    expect(usageStep).toMatchObject({ status: "skipped" });
    expect(usageStep?.warning).toContain("ccusage");
    expect(JSON.parse(await readFile(join(directory, ".floor200", "data", "usage.json"), "utf8"))).toEqual([]);
    expect(result.report).toContain("Floor200");
  });

  it("preserves previously collected PR data instead of overwriting it on a skipped step", async () => {
    const directory = await tempProject('project:\n  name: "example"\n  repo: "acme/floor200"\n');
    const dataDirectory = join(directory, ".floor200", "data");
    await mkdir(dataDirectory, { recursive: true });
    const staleContent = `${JSON.stringify([{ number: 1, commits: [] }], null, 2)}\n`;
    await writeFile(join(dataDirectory, "prs.json"), staleContent, "utf8");

    const runner = new FakeRunner([
      ...gitHappyPathResponses(),
      ok("gh version 2.80.0"),
      new Error("not authenticated"),
      ...usageHappyPathResponses(),
    ]);
    const steps: PipelineStepResult[] = [];

    await runPipeline({ baseDirectory: directory, runner, onStep: (step) => steps.push(step) });

    const prsStep = steps.find((step) => step.step === "prs");
    expect(prsStep?.detail).toContain("previously collected data");
    expect(await readFile(join(dataDirectory, "prs.json"), "utf8")).toBe(staleContent);
  });

  it("rejects when git collection fails", async () => {
    const directory = await tempProject('project:\n  name: "example"\n  repo: "acme/floor200"\n');
    const runner = new FakeRunner([new Error("not a git repository")]);

    await expect(runPipeline({ baseDirectory: directory, runner })).rejects.toThrow(GitRepositoryError);
  });

  it("passes --since through to the git collector", async () => {
    const directory = await tempProject('project:\n  name: "example"\n  repo: "acme/floor200"\n');
    const runner = new FakeRunner([
      ...gitHappyPathResponses(),
      ...prsHappyPathResponses(),
      ...usageHappyPathResponses(),
    ]);

    await runPipeline({ baseDirectory: directory, runner, since: "2026-01-01" });

    const logCall = runner.calls.find((call) => call.args.includes("log"));
    expect(logCall?.args.some((arg) => arg.startsWith("--since=2026-01-01"))).toBe(true);
  });
});
