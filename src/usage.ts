import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { requireProjectConfig } from "./config.js";
import { CommandStartError, nodeCommandRunner } from "./process.js";
import type { CommandRunner } from "./process.js";

export interface NormalizedUsageSession {
  source: string; sourceSessionId: string; model: string;
  startedAt: string; endedAt: string; durationMs: number | null;
  inputTokens: number; outputTokens: number; cacheTokens: number;
  totalTokens: number; estimatedCostUsd: number;
  projectPathHash?: string; rawSource: "ccusage";
}
export interface SkippedUsageRecord { index: number; reasonCode: string }
export interface UsageParseResult { sessions: NormalizedUsageSession[]; skipped: SkippedUsageRecord[] }
export interface UsageAdapter { name: string; collect(runner: CommandRunner): Promise<UsageParseResult> }

export class UsageParseError extends Error { constructor() { super("ccusage returned malformed JSON"); this.name = "UsageParseError"; } }
export class NoParseableUsageError extends Error { constructor() { super("ccusage returned no parseable sessions"); this.name = "NoParseableUsageError"; } }
export class CcusageMissingError extends Error { constructor(options?: ErrorOptions) { super("ccusage is unavailable", options); this.name = "CcusageMissingError"; } }
export class UsageCollectionError extends Error { constructor(options?: ErrorOptions) { super("ccusage collection failed", options); this.name = "UsageCollectionError"; } }

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(r: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) if (typeof r[key] === "string" && r[key] !== "") return r[key] as string;
}
function num(r: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) if (typeof r[key] === "number" && Number.isFinite(r[key])) return r[key] as number;
  return 0;
}
function modelName(r: Record<string, unknown>): string {
  const one = text(r, "model", "modelName");
  if (one) return one;
  const candidateModels = Array.isArray(r.models) ? r.models : Array.isArray(r.modelsUsed) ? r.modelsUsed : [];
  const models = candidateModels.filter((x): x is string => typeof x === "string");
  return models.length === 1 ? models[0] : models.length > 1 ? "mixed" : "unknown";
}

export function parseCcusageSessions(json: string, pathBySessionId?: Map<string, string>): UsageParseResult {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new UsageParseError(); }
  const parsedRecord = record(parsed);
  const candidates = Array.isArray(parsed) ? parsed
    : parsedRecord && Array.isArray(parsedRecord.sessions) ? parsedRecord.sessions as unknown[]
    : parsedRecord && Array.isArray(parsedRecord.session) ? parsedRecord.session as unknown[]
    : null;
  if (!candidates) throw new UsageParseError();
  const sessions: NormalizedUsageSession[] = []; const skipped: SkippedUsageRecord[] = [];
  candidates.forEach((candidate, index) => {
    const r = record(candidate);
    if (!r) { skipped.push({ index, reasonCode: "invalid-record" }); return; }
    const id = text(r, "sessionId", "id", "sourceSessionId", "period");
    if (!id) { skipped.push({ index, reasonCode: "missing-session-id" }); return; }
    const metadata = record(r.metadata);
    const lastActivity = metadata ? text(metadata, "lastActivity") : undefined;
    const explicitStart = text(r, "startTime", "startedAt", "firstActivity");
    const explicitEnd = text(r, "endTime", "endedAt", "lastActivity");
    const startedAt = explicitStart ?? lastActivity;
    const endedAt = explicitEnd ?? lastActivity;
    const startMs = startedAt ? Date.parse(startedAt) : NaN; const endMs = endedAt ? Date.parse(endedAt) : NaN;
    if (!startedAt || !endedAt || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
      skipped.push({ index, reasonCode: "missing-timestamps" }); return;
    }
    const inputTokens = num(r, "inputTokens", "input_tokens");
    const outputTokens = num(r, "outputTokens", "output_tokens");
    const cacheTokens = num(r, "cacheTokens", "cache_tokens") + num(r, "cacheCreationInputTokens", "cacheCreationTokens") + num(r, "cacheReadInputTokens", "cacheReadTokens");
    const path = text(r, "projectPath", "repoPath", "cwd") ?? pathBySessionId?.get(id);
    sessions.push({ source: text(r, "source", "agent") ?? "claude-code", sourceSessionId: id, model: modelName(r), startedAt, endedAt,
      durationMs: explicitStart && explicitEnd ? endMs - startMs : null, inputTokens, outputTokens, cacheTokens,
      totalTokens: num(r, "totalTokens", "total_tokens") || inputTokens + outputTokens + cacheTokens,
      estimatedCostUsd: num(r, "totalCost", "estimatedCostUsd", "costUSD"),
      ...(path ? { projectPathHash: createHash("sha256").update(path).digest("hex") } : {}), rawSource: "ccusage" });
  });
  if (candidates.length > 0 && sessions.length === 0) throw new NoParseableUsageError();
  return { sessions, skipped };
}

function projectPathsBySessionId(json: string): Map<string, string> {
  const map = new Map<string, string>();
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return map; }
  const parsedRecord = record(parsed);
  const candidates = Array.isArray(parsed) ? parsed
    : parsedRecord && Array.isArray(parsedRecord.sessions) ? parsedRecord.sessions as unknown[]
    : parsedRecord && Array.isArray(parsedRecord.session) ? parsedRecord.session as unknown[]
    : [];
  for (const candidate of candidates) {
    const r = record(candidate);
    if (!r) continue;
    const id = text(r, "sessionId", "id", "sourceSessionId", "period");
    const path = text(r, "projectPath", "repoPath", "cwd");
    if (id && path) map.set(id, path);
  }
  return map;
}

export const ccusageAdapter: UsageAdapter = {
  name: "ccusage",
  async collect(runner) {
    try { await runner.run("ccusage", ["--version"]); }
    catch (error) { throw new CcusageMissingError({ cause: error }); }
    let pathBySessionId: Map<string, string> | undefined;
    try { pathBySessionId = projectPathsBySessionId((await runner.run("ccusage", ["claude", "session", "--json"])).stdout); }
    catch { pathBySessionId = undefined; }
    try { return parseCcusageSessions((await runner.run("ccusage", ["session", "--json"])).stdout, pathBySessionId); }
    catch (error) {
      if (error instanceof UsageParseError || error instanceof NoParseableUsageError) throw error;
      if (error instanceof CommandStartError) throw new CcusageMissingError({ cause: error });
      throw new UsageCollectionError({ cause: error });
    }
  },
};

export async function collectUsage(options: { baseDirectory?: string; runner?: CommandRunner; adapter?: UsageAdapter } = {}) {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  await requireProjectConfig(baseDirectory);
  const result = await (options.adapter ?? ccusageAdapter).collect(options.runner ?? nodeCommandRunner);
  const dataDir = join(baseDirectory, ".floor200", "data"); const outputPath = join(dataDir, "usage.json");
  const debugDir = join(baseDirectory, ".floor200", "debug"); const debugPath = join(debugDir, "ccusage-skipped.json");
  await mkdir(dataDir, { recursive: true }); await writeFile(outputPath, `${JSON.stringify(result.sessions, null, 2)}\n`, "utf8");
  if (result.skipped.length) { await mkdir(debugDir, { recursive: true }); await writeFile(debugPath, `${JSON.stringify(result.skipped, null, 2)}\n`, "utf8"); }
  else await rm(debugPath, { force: true });
  return { count: result.sessions.length, skippedCount: result.skipped.length, outputPath, debugPath: result.skipped.length ? debugPath : undefined };
}
