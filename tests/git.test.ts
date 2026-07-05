import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectGitCommits,
  GitLogParseError,
  GitRepositoryError,
  hashAuthorEmail,
  InvalidSinceDateError,
  parseGitLog,
  resolveSinceDate,
} from "../src/git.js";
import { CommandExitError, type CommandResult, type CommandRunner } from "../src/process.js";

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures", "git-log-numstat.txt"),
  "utf8",
).replaceAll("<RS>", "\x1e").replaceAll("<US>", "\x1f");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

class FakeRunner implements CommandRunner {
  calls: Array<{ command: string; args: string[] }> = [];
  constructor(private responses: Array<CommandResult | Error>) {}
  async run(command: string, args: string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Missing fake response");
    return response;
  }
}

async function configuredDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "floor200-git-"));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, ".floor200.yml"), "project:\n  repo: null\n");
  return directory;
}

describe("resolveSinceDate", () => {
  it("defaults to the local first day of the current month", () => {
    expect(resolveSinceDate(undefined, new Date(2026, 6, 19, 12))).toBe(
      "2026-07-01",
    );
  });

  it("accepts a valid explicit date", () => {
    expect(resolveSinceDate("2025-12-09")).toBe("2025-12-09");
  });

  it.each(["2025-2-01", "2025-02-30", "not-a-date"])(
    "rejects invalid date %s",
    (value) => {
      expect(() => resolveSinceDate(value)).toThrow(InvalidSinceDateError);
    },
  );
});

describe("parseGitLog", () => {
  it("normalizes commits, hashes emails, and aggregates numstat", () => {
    const commits = parseGitLog(fixture, "main");
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({
      sha: "abc123",
      message: "Add local git collector",
      authorName: "Avery Doe",
      authorEmailHash: createHash("sha256")
        .update("avery@example.com")
        .digest("hex"),
      committedAt: "2026-07-03T10:20:30+02:00",
      branchName: "main",
      additions: 155,
      deletions: 16,
      filesChanged: 3,
      files: [
        { path: "src/git.ts", additions: 120, deletions: 14 },
        { path: "tests/git.test.ts", additions: 35, deletions: 2 },
        { path: "assets/logo.png", additions: 0, deletions: 0 },
      ],
    });
    expect(commits[1].message).toBe("Fix parser edge case");
  });

  it("hashes normalized emails deterministically", () => {
    expect(hashAuthorEmail(" Avery@Example.com ")).toBe(
      hashAuthorEmail("avery@example.com"),
    );
  });

  it("returns no commits for empty output", () => {
    expect(parseGitLog("", "main")).toEqual([]);
  });

  it("rejects malformed records", () => {
    expect(() => parseGitLog("\x1ebroken", "main")).toThrow(
      GitLogParseError,
    );
  });
});

describe("collectGitCommits", () => {
  it("collects metadata with exact git commands and writes the envelope", async () => {
    const directory = await configuredDirectory();
    const runner = new FakeRunner([
      { stdout: "/repo/root\n", stderr: "" },
      { stdout: "main\n", stderr: "" },
      { stdout: "git@github.com:acme/repo.git\n", stderr: "" },
      { stdout: fixture, stderr: "" },
    ]);

    const result = await collectGitCommits({ baseDirectory: directory, since: "2026-07-01", runner });
    expect(runner.calls[3]).toEqual({
      command: "git",
      args: ["-C", "/repo/root", "log", "--since=2026-07-01T00:00:00", "--date=iso-strict", "--format=%x1e%H%x1f%s%x1f%an%x1f%ae%x1f%cI", "--numstat", "--no-renames"],
    });
    expect(result.count).toBe(2);
    const output = JSON.parse(await readFile(result.outputPath, "utf8"));
    expect(output.repository).toEqual({ root: "/repo/root", branchName: "main", remoteOrigin: "git@github.com:acme/repo.git" });
    expect(output.since).toBe("2026-07-01");
    expect(output.commits[0]).not.toHaveProperty("authorEmail");
  });

  it("allows missing origin and detached HEAD", async () => {
    const directory = await configuredDirectory();
    const runner = new FakeRunner([
      { stdout: "/repo/root\n", stderr: "" },
      { stdout: "", stderr: "" },
      new CommandExitError("git", 2, "no remote"),
      { stdout: "", stderr: "" },
    ]);
    await collectGitCommits({ baseDirectory: directory, since: "2026-07-01", runner });
    const output = JSON.parse(await readFile(join(directory, ".floor200/data/commits.json"), "utf8"));
    expect(output.repository).toMatchObject({ branchName: "HEAD", remoteOrigin: null });
  });

  it("fails before writing when not in a git repository", async () => {
    const directory = await configuredDirectory();
    const runner = new FakeRunner([new CommandExitError("git", 128, "not a repository")]);
    await expect(collectGitCommits({ baseDirectory: directory, runner })).rejects.toBeInstanceOf(GitRepositoryError);
    await expect(access(join(directory, ".floor200/data/commits.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
