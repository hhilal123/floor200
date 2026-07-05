import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AttributionDataError, attributeSessions, runAttribution } from "../src/attribution.js";
import type { NormalizedCommit } from "../src/git.js";
import type { NormalizedPullRequest } from "../src/github.js";
import type { NormalizedUsageSession } from "../src/usage.js";

const root = "/repo";
const rootHash = createHash("sha256").update(root.replace(/\//g, "-")).digest("hex");
const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((p) => rm(p, { recursive: true, force: true }))));
const session = (overrides: Partial<NormalizedUsageSession> = {}): NormalizedUsageSession => ({
  source: "claude", sourceSessionId: "s1", model: "opus", startedAt: "2026-07-01T10:00:00Z",
  endedAt: "2026-07-01T10:00:00Z", durationMs: null, inputTokens: 1, outputTokens: 2,
  cacheTokens: 3, totalTokens: 6, estimatedCostUsd: 1.5, projectPathHash: rootHash,
  rawSource: "ccusage", ...overrides,
});

describe("runAttribution", () => {
  it("fails clearly when a required data file is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-attribute-"));
    temporaryDirectories.push(directory);
    await expect(runAttribution({ baseDirectory: directory })).rejects.toMatchObject({
      name: "AttributionDataError", fileName: "usage.json",
    } satisfies Partial<AttributionDataError>);
  });

  it("writes every session and returns transparent summary counts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-attribute-"));
    temporaryDirectories.push(directory);
    const data = join(directory, ".floor200", "data");
    await mkdir(data, { recursive: true });
    await writeFile(join(data, "usage.json"), JSON.stringify([session(), session({ sourceSessionId: "s2", endedAt: "2026-07-03T00:00:00Z" })]));
    await writeFile(join(data, "commits.json"), JSON.stringify({ repository: { root, branchName: "main", remoteOrigin: null }, since: "2026-07-01", commits: [commit("a", "2026-07-01T11:00:00Z")] }));
    await writeFile(join(data, "prs.json"), JSON.stringify([pr("a")]));

    const result = await runAttribution({ baseDirectory: directory });
    const records = JSON.parse(await readFile(result.outputPath, "utf8"));
    expect(records).toHaveLength(2);
    expect(result.counts).toEqual({ high: 1, medium: 0, low: 0, unknown: 1 });
    expect(result.roiEligibleCount).toBe(1);
  });
});
const commit = (sha: string, committedAt: string): NormalizedCommit => ({
  sha, message: "change", authorName: "Dev", authorEmailHash: "hash", committedAt,
  branchName: "main", additions: 1, deletions: 0, filesChanged: 1,
  files: [{ path: "src/a.ts", additions: 1, deletions: 0 }],
});
const pr = (sha: string): NormalizedPullRequest => ({
  number: 10, title: "PR", url: "https://example.test/10", author: "dev",
  headRefName: "feature", baseRefName: "main", createdAt: "2026-07-01T09:00:00Z",
  mergedAt: "2026-07-01T13:00:00Z", additions: 1, deletions: 0, changedFiles: 1,
  commits: [sha], labels: [],
});

describe("attributeSessions", () => {
  it("assigns high confidence to a close PR-backed commit with matching repo", () => {
    const result = attributeSessions([session()], [commit("a", "2026-07-01T11:00:00Z")], [pr("a")], root);
    expect(result[0]).toMatchObject({ confidence: "high", commitSha: "a", prNumber: 10, method: "time+pr-commit" });
    expect(result[0].confidenceScore).toBeCloseTo(23 / 24);
    expect(result[0].explanation).toContain("1.00 hours");
  });

  it("assigns medium confidence within eight hours and caps missing repo context", () => {
    const medium = attributeSessions([session()], [commit("a", "2026-07-01T15:00:00Z")], [pr("a")], root)[0];
    const capped = attributeSessions([session({ projectPathHash: undefined })], [commit("a", "2026-07-01T11:00:00Z")], [pr("a")], root)[0];
    expect(medium.confidence).toBe("medium");
    expect(capped.confidence).toBe("medium");
    expect(capped.explanation).toContain("repository context was unavailable");
  });

  it("assigns low confidence to commit-only timing and no PR ROI", () => {
    const result = attributeSessions([session()], [commit("a", "2026-07-01T20:00:00Z")], [], root)[0];
    expect(result).toMatchObject({ confidence: "low", prNumber: null, method: "time-only" });
  });

  it("preserves unknown sessions with no match or repo mismatch", () => {
    const noMatch = attributeSessions([session()], [], [], root)[0];
    const mismatch = attributeSessions([session({ projectPathHash: "different" })], [commit("a", "2026-07-01T11:00:00Z")], [pr("a")], root)[0];
    expect(noMatch).toMatchObject({ confidence: "unknown", commitSha: null, confidenceScore: 0, inScope: true });
    expect(mismatch.confidence).toBe("unknown");
    expect(mismatch.explanation).toContain("repository context did not match");
    expect(mismatch.inScope).toBe(false);
  });

  it("withholds attribution when nearest commits are within fifteen minutes", () => {
    const result = attributeSessions([session()], [
      commit("a", "2026-07-01T11:00:00Z"), commit("b", "2026-07-01T11:10:00Z"),
    ], [pr("a")], root)[0];
    expect(result).toMatchObject({ confidence: "unknown", commitSha: null, method: "unattributed" });
    expect(result.explanation).toContain("within 15 minutes");
  });

  it("withholds PR attribution when timing is weaker than eight hours", () => {
    const result = attributeSessions([session()], [commit("a", "2026-07-01T19:00:00Z")], [pr("a")], root)[0];
    expect(result.confidence).toBe("unknown");
    expect(result.explanation).toContain("exceeded the 8-hour PR threshold");
  });
});
