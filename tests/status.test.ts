import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { checkStatus, renderStatus } from "../src/status.js";
import type { CommandResult, CommandRunner } from "../src/process.js";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((p) => rm(p, { recursive: true, force: true }))));

async function project() {
  const p = await mkdtemp(join(tmpdir(), "floor200-status-"));
  temporary.push(p);
  return p;
}

class FakeRunner implements CommandRunner {
  constructor(private responses: Record<string, CommandResult | Error>) {}
  async run(command: string) {
    const value = this.responses[command];
    if (value instanceof Error) throw value;
    if (!value) throw new Error(`unexpected command: ${command}`);
    return value;
  }
}

const ok: CommandResult = { stdout: "", stderr: "" };

describe("checkStatus", () => {
  it("reports everything missing in a bare directory", async () => {
    const directory = await project();
    const runner = new FakeRunner({
      git: new Error("not a repo"),
      ccusage: new Error("not found"),
    });
    const report = await checkStatus({ baseDirectory: directory, runner });
    expect(report).toEqual({
      configFound: false,
      gitRepositoryDetected: false,
      ccusageAvailable: false,
      dataFiles: [
        { name: "commits.json", present: false },
        { name: "prs.json", present: false },
        { name: "usage.json", present: false },
        { name: "attributions.json", present: false },
      ],
    });
  });

  it("reports everything present when set up and data has been collected", async () => {
    const directory = await project();
    await writeFile(join(directory, ".floor200.yml"), "project:\n  repo: null\n");
    const dataDirectory = join(directory, ".floor200", "data");
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(join(dataDirectory, "commits.json"), "[]");
    await writeFile(join(dataDirectory, "usage.json"), "[]");
    const runner = new FakeRunner({ git: ok, ccusage: ok });

    const report = await checkStatus({ baseDirectory: directory, runner });
    expect(report.configFound).toBe(true);
    expect(report.gitRepositoryDetected).toBe(true);
    expect(report.ccusageAvailable).toBe(true);
    expect(report.dataFiles).toEqual([
      { name: "commits.json", present: true },
      { name: "prs.json", present: false },
      { name: "usage.json", present: true },
      { name: "attributions.json", present: false },
    ]);
  });
});

describe("renderStatus", () => {
  it("renders a human-readable report", () => {
    const output = renderStatus({
      configFound: true,
      gitRepositoryDetected: false,
      ccusageAvailable: true,
      dataFiles: [
        { name: "commits.json", present: true },
        { name: "prs.json", present: false },
      ],
    });
    expect(output).toBe(
      [
        "Config found: yes",
        "Git repository detected: no",
        "ccusage available: yes",
        "Collected data files:",
        "  commits.json: yes",
        "  prs.json: no",
      ].join("\n"),
    );
  });
});
