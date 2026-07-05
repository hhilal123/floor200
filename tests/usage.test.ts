import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { CcusageMissingError, collectUsage, NoParseableUsageError, parseCcusageSessions } from "../src/usage.js";
import { CommandStartError, type CommandResult, type CommandRunner } from "../src/process.js";

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ccusage-sessions.json"), "utf8");
const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((p) => rm(p, { recursive: true, force: true }))));
class FakeRunner implements CommandRunner {
  calls: Array<{ command: string; args: string[] }> = [];
  constructor(private responses: Array<CommandResult | Error>) {}
  async run(command: string, args: string[]) { this.calls.push({ command, args }); const value = this.responses.shift(); if (value instanceof Error) throw value; if (!value) throw new Error("no response"); return value; }
}
async function project() { const p = await mkdtemp(join(tmpdir(), "floor200-usage-")); temporary.push(p); await writeFile(join(p, ".floor200.yml"), "project:\n  repo: null\n"); return p; }

describe("parseCcusageSessions", () => {
  it("normalizes aliases, derives values, hashes paths, and skips bad records", () => {
    const result = parseCcusageSessions(fixture);
    expect(result.skipped).toEqual([{ index: 2, reasonCode: "missing-timestamps" }]);
    expect(result.sessions[0]).toEqual({
      source: "claude-code",
      sourceSessionId: "session-1",
      model: "mixed",
      startedAt: "2026-07-01T10:00:00Z",
      endedAt: "2026-07-01T10:05:00Z",
      durationMs: 300000,
      inputTokens: 1000,
      outputTokens: 500,
      cacheTokens: 500,
      totalTokens: 2000,
      estimatedCostUsd: 1.25,
      projectPathHash: createHash("sha256").update("/Users/example/private-repo").digest("hex"),
      rawSource: "ccusage",
    });
    expect(result.sessions[1]).toMatchObject({ model: "claude-sonnet-4", totalTokens: 17, durationMs: 1000 });
    expect(JSON.stringify(result.sessions)).not.toContain("private-repo");
  });

  it("accepts a valid empty top-level array", () => {
    expect(parseCcusageSessions("[]")).toEqual({ sessions: [], skipped: [] });
  });

  it("parses the ccusage v20 session shape", () => {
    const result = parseCcusageSessions(JSON.stringify({ session: [{
      agent: "claude-code", period: "v20-session", modelsUsed: ["claude-opus-4"],
      inputTokens: 20, outputTokens: 10, cacheCreationTokens: 3,
      cacheReadTokens: 7, totalTokens: 40, totalCost: 0.12,
      metadata: { lastActivity: "2026-07-05T10:30:00Z" },
    }] }));
    expect(result.sessions[0]).toMatchObject({
      source: "claude-code", sourceSessionId: "v20-session",
      model: "claude-opus-4", startedAt: "2026-07-05T10:30:00Z",
      endedAt: "2026-07-05T10:30:00Z", durationMs: null,
      cacheTokens: 10, totalTokens: 40,
    });
  });

  it("fails unusable JSON and non-empty input with no valid records", () => {
    expect(() => parseCcusageSessions("bad json")).toThrow();
    expect(() => parseCcusageSessions('[{"id":"bad"}]')).toThrow(NoParseableUsageError);
  });
});

describe("collectUsage", () => {
  it("runs exact commands and writes safe usage and debug records", async () => {
    const baseDirectory = await project();
    const runner = new FakeRunner([{ stdout: "ccusage 1\n", stderr: "" }, { stdout: fixture, stderr: "" }]);
    const result = await collectUsage({ baseDirectory, runner });
    expect(runner.calls).toEqual([{ command: "ccusage", args: ["--version"] }, { command: "ccusage", args: ["session", "--json"] }]);
    expect(result).toMatchObject({ count: 2, skippedCount: 1 });
    expect(JSON.parse(await readFile(result.outputPath, "utf8"))).toHaveLength(2);
    expect(JSON.parse(await readFile(result.debugPath!, "utf8"))).toEqual([{ index: 2, reasonCode: "missing-timestamps" }]);
  });

  it("reports a missing ccusage executable", async () => {
    const baseDirectory = await project();
    await expect(collectUsage({ baseDirectory, runner: new FakeRunner([new CommandStartError("ccusage")]) })).rejects.toBeInstanceOf(CcusageMissingError);
  });
});
