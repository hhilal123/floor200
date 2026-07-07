import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { requireProjectConfig } from "./config.js";
import { nodeCommandRunner } from "./process.js";
import type { CommandRunner } from "./process.js";

export interface CommitFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface NormalizedCommit {
  sha: string;
  message: string;
  authorName: string;
  authorEmailHash: string;
  committedAt: string;
  branchName: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  files: CommitFile[];
}

export class GitLogParseError extends Error {
  constructor() {
    super("Git returned malformed commit data");
    this.name = "GitLogParseError";
  }
}

export class GitRepositoryError extends Error {
  constructor(options?: ErrorOptions) {
    super("Current directory is not inside a git repository", options);
    this.name = "GitRepositoryError";
  }
}

export class GitCollectionError extends Error {
  constructor(options?: ErrorOptions) {
    super("Git could not collect commits", options);
    this.name = "GitCollectionError";
  }
}

export interface CollectGitOptions {
  baseDirectory?: string;
  since?: string;
  runner?: CommandRunner;
  now?: Date;
}

export class InvalidSinceDateError extends Error {
  constructor(readonly value: string) {
    super(`Invalid since date: ${value}`);
    this.name = "InvalidSinceDateError";
  }
}

export function hashAuthorEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function parseCount(value: string): number {
  if (value === "-") return 0;
  if (!/^\d+$/.test(value)) throw new GitLogParseError();
  return Number(value);
}

export function parseGitLog(
  output: string,
  branchName: string,
): NormalizedCommit[] {
  if (output.trim() === "") return [];

  return output
    .split("\x1e")
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const lines = record.trim().split("\n");
      const fields = lines.shift()?.split("\x1f") ?? [];
      if (fields.length !== 5 || fields.some((field) => field === "")) {
        throw new GitLogParseError();
      }
      const [sha, message, authorName, authorEmail, committedAt] = fields;
      const files = lines.filter(Boolean).map((line) => {
        const [added, deleted, ...pathParts] = line.split("\t");
        const path = pathParts.join("\t");
        if (!added || !deleted || !path) throw new GitLogParseError();
        return {
          path,
          additions: parseCount(added),
          deletions: parseCount(deleted),
        };
      });

      return {
        sha,
        message,
        authorName,
        authorEmailHash: hashAuthorEmail(authorEmail),
        committedAt,
        branchName,
        additions: files.reduce((sum, file) => sum + file.additions, 0),
        deletions: files.reduce((sum, file) => sum + file.deletions, 0),
        filesChanged: files.length,
        files,
      };
    });
}

export async function collectGitCommits(
  options: CollectGitOptions = {},
): Promise<{ count: number; outputPath: string }> {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const runner = options.runner ?? nodeCommandRunner;
  const since = resolveSinceDate(options.since, options.now);
  await requireProjectConfig(baseDirectory);

  let root: string;
  try {
    root = (await runner.run("git", ["-C", baseDirectory, "rev-parse", "--show-toplevel"])).stdout.trim();
    if (!root) throw new Error("missing root");
  } catch (error) {
    throw new GitRepositoryError({ cause: error });
  }

  try {
    const branchOutput = await runner.run("git", ["-C", root, "branch", "--show-current"]);
    const branchName = branchOutput.stdout.trim() || "HEAD";
    let remoteOrigin: string | null = null;
    try {
      remoteOrigin = (await runner.run("git", ["-C", root, "remote", "get-url", "origin"])).stdout.trim() || null;
    } catch {
      remoteOrigin = null;
    }
    const log = await runner.run("git", [
      "-C", root, "log", `--since=${since}T00:00:00`, "--date=iso-strict",
      "--format=%x1e%H%x1f%s%x1f%an%x1f%ae%x1f%cI", "--numstat", "--no-renames",
    ]);
    const commits = parseGitLog(log.stdout, branchName);
    const dataDirectory = join(baseDirectory, ".floor200", "data");
    const outputPath = join(dataDirectory, "commits.json");
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify({
      repository: { root, branchName, remoteOrigin }, since,
      collectedAt: (options.now ?? new Date()).toISOString(), commits,
    }, null, 2)}\n`, "utf8");
    return { count: commits.length, outputPath };
  } catch (error) {
    if (error instanceof GitLogParseError) throw error;
    throw new GitCollectionError({ cause: error });
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function resolveSinceDate(value?: string, now = new Date()): string {
  if (value === undefined) {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidSinceDateError(value);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new InvalidSinceDateError(value);
  }
  return value;
}
