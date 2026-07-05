import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectPullRequests,
  GitHubAuthenticationError,
  GitHubCliMissingError,
  GitHubCollectionError,
  GitHubResponseError,
  parsePullRequests,
} from "../src/github.js";
import {
  CommandExitError,
  CommandStartError,
  type CommandResult,
  type CommandRunner,
} from "../src/process.js";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures", "github-pr-list.json"),
  "utf8",
);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function configuredProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "floor200-github-"));
  temporaryDirectories.push(directory);
  await writeFile(
    join(directory, ".floor200.yml"),
    'project:\n  name: "floor200"\n  repo: "acme/floor200"\n',
    "utf8",
  );
  return directory;
}

class FakeRunner implements CommandRunner {
  calls: Array<{ command: string; args: string[] }> = [];

  constructor(
    private readonly responses: Array<CommandResult | Error>,
  ) {}

  async run(command: string, args: string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    const response = this.responses.shift();
    if (response instanceof Error) {
      throw response;
    }
    if (!response) {
      throw new Error("Fake runner has no response");
    }
    return response;
  }
}

describe("parsePullRequests", () => {
  it("normalizes every requested field into compact metadata", () => {
    expect(parsePullRequests(fixture)).toEqual([
      {
        number: 42,
        title: "Add ROI exports",
        url: "https://github.com/acme/floor200/pull/42",
        author: "avery",
        headRefName: "feature/exports",
        baseRefName: "main",
        createdAt: "2026-06-01T10:00:00Z",
        mergedAt: "2026-06-02T12:30:00Z",
        additions: 180,
        deletions: 24,
        changedFiles: 7,
        commits: ["abc123", "def456"],
        labels: ["feature", "agent-assisted"],
      },
      {
        number: 43,
        title: "Remove stale workflow",
        url: "https://github.com/acme/floor200/pull/43",
        author: null,
        headRefName: "cleanup/workflow",
        baseRefName: "main",
        createdAt: "2026-06-03T09:00:00Z",
        mergedAt: "2026-06-03T11:00:00Z",
        additions: 2,
        deletions: 60,
        changedFiles: 1,
        commits: [],
        labels: [],
      },
    ]);
  });

  it("rejects malformed JSON", () => {
    expect(() => parsePullRequests("not json")).toThrow(GitHubResponseError);
  });

  it("rejects records with missing or invalid fields", () => {
    expect(() => parsePullRequests('[{"number":"42"}]')).toThrow(
      GitHubResponseError,
    );
  });
});

describe("collectPullRequests", () => {
  it("runs exact gh commands and writes normalized records", async () => {
    const directory = await configuredProject();
    const runner = new FakeRunner([
      { stdout: "gh version 2.80.0\n", stderr: "" },
      { stdout: "", stderr: "" },
      { stdout: fixture, stderr: "" },
    ]);

    const result = await collectPullRequests({
      baseDirectory: directory,
      runner,
    });

    expect(runner.calls).toEqual([
      { command: "gh", args: ["--version"] },
      { command: "gh", args: ["auth", "status"] },
      {
        command: "gh",
        args: [
          "pr",
          "list",
          "--repo",
          "acme/floor200",
          "--state",
          "merged",
          "--limit",
          "100",
          "--json",
          "number,title,url,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,changedFiles,commits,labels",
        ],
      },
    ]);
    expect(result).toEqual({
      count: 2,
      outputPath: join(directory, ".floor200", "data", "prs.json"),
    });
    expect(JSON.parse(await readFile(result.outputPath, "utf8"))).toEqual(
      parsePullRequests(fixture),
    );
  });

  it("reports when gh is not installed", async () => {
    const directory = await configuredProject();
    const runner = new FakeRunner([
      new CommandStartError("gh"),
    ]);

    await expect(
      collectPullRequests({ baseDirectory: directory, runner }),
    ).rejects.toBeInstanceOf(GitHubCliMissingError);
  });

  it("reports when gh is not authenticated", async () => {
    const directory = await configuredProject();
    const runner = new FakeRunner([
      { stdout: "gh version 2.80.0\n", stderr: "" },
      new CommandExitError("gh", 1, "not logged in"),
    ]);

    await expect(
      collectPullRequests({ baseDirectory: directory, runner }),
    ).rejects.toBeInstanceOf(GitHubAuthenticationError);
  });

  it("reports a failed PR list command", async () => {
    const directory = await configuredProject();
    const runner = new FakeRunner([
      { stdout: "gh version 2.80.0\n", stderr: "" },
      { stdout: "", stderr: "" },
      new CommandExitError("gh", 1, "repository not found"),
    ]);

    await expect(
      collectPullRequests({ baseDirectory: directory, runner }),
    ).rejects.toBeInstanceOf(GitHubCollectionError);
  });

  it("does not create data output for malformed GitHub JSON", async () => {
    const directory = await configuredProject();
    const runner = new FakeRunner([
      { stdout: "gh version 2.80.0\n", stderr: "" },
      { stdout: "", stderr: "" },
      { stdout: "malformed", stderr: "" },
    ]);

    await expect(
      collectPullRequests({ baseDirectory: directory, runner }),
    ).rejects.toBeInstanceOf(GitHubResponseError);
    await expect(
      access(join(directory, ".floor200", "data", "prs.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
