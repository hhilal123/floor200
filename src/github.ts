import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readProjectRepo } from "./config.js";
import { nodeCommandRunner } from "./process.js";
import type { CommandRunner } from "./process.js";

const PR_FIELDS =
  "number,title,url,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,changedFiles,commits,labels";

export interface NormalizedPullRequest {
  number: number;
  title: string;
  url: string;
  author: string | null;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: string[];
  labels: string[];
}

export class GitHubResponseError extends Error {
  constructor(options?: ErrorOptions) {
    super("GitHub CLI returned malformed pull-request data", options);
    this.name = "GitHubResponseError";
  }
}

export class GitHubCliMissingError extends Error {
  constructor(options?: ErrorOptions) {
    super("GitHub CLI is not installed or unavailable", options);
    this.name = "GitHubCliMissingError";
  }
}

export class GitHubAuthenticationError extends Error {
  constructor(options?: ErrorOptions) {
    super("GitHub CLI is not authenticated", options);
    this.name = "GitHubAuthenticationError";
  }
}

export class GitHubCollectionError extends Error {
  constructor(options?: ErrorOptions) {
    super("GitHub CLI could not list merged pull requests", options);
    this.name = "GitHubCollectionError";
  }
}

export interface CollectOptions {
  baseDirectory?: string;
  runner?: CommandRunner;
}

export interface CollectionResult {
  count: number;
  outputPath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new GitHubResponseError();
  }
  return value;
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GitHubResponseError();
  }
  return value;
}

function nestedStrings(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new GitHubResponseError();
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new GitHubResponseError();
    }
    return stringField(item, field);
  });
}

function normalizePullRequest(value: unknown): NormalizedPullRequest {
  if (!isRecord(value)) {
    throw new GitHubResponseError();
  }

  const author = value.author;
  if (author !== null && !isRecord(author)) {
    throw new GitHubResponseError();
  }

  return {
    number: numberField(value, "number"),
    title: stringField(value, "title"),
    url: stringField(value, "url"),
    author: author === null ? null : stringField(author, "login"),
    headRefName: stringField(value, "headRefName"),
    baseRefName: stringField(value, "baseRefName"),
    createdAt: stringField(value, "createdAt"),
    mergedAt: stringField(value, "mergedAt"),
    additions: numberField(value, "additions"),
    deletions: numberField(value, "deletions"),
    changedFiles: numberField(value, "changedFiles"),
    commits: nestedStrings(value.commits, "oid"),
    labels: nestedStrings(value.labels, "name"),
  };
}

export function parsePullRequests(json: string): NormalizedPullRequest[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new GitHubResponseError({ cause: error });
  }

  if (!Array.isArray(value)) {
    throw new GitHubResponseError();
  }

  return value.map(normalizePullRequest);
}

export async function collectPullRequests(
  options: CollectOptions = {},
): Promise<CollectionResult> {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const runner = options.runner ?? nodeCommandRunner;
  const repo = await readProjectRepo(baseDirectory);

  try {
    await runner.run("gh", ["--version"]);
  } catch (error) {
    throw new GitHubCliMissingError({ cause: error });
  }

  try {
    await runner.run("gh", ["auth", "status"]);
  } catch (error) {
    throw new GitHubAuthenticationError({ cause: error });
  }

  let stdout: string;
  try {
    ({ stdout } = await runner.run("gh", [
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "merged",
      "--limit",
      "100",
      "--json",
      PR_FIELDS,
    ]));
  } catch (error) {
    throw new GitHubCollectionError({ cause: error });
  }

  const pullRequests = parsePullRequests(stdout);
  const dataDirectory = join(baseDirectory, ".floor200", "data");
  const outputPath = join(dataDirectory, "prs.json");
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(pullRequests, null, 2)}\n`,
    "utf8",
  );

  return { count: pullRequests.length, outputPath };
}
