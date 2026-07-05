import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Attribution } from "../src/attribution.js";
import {
  RoiReportDataError,
  buildRecommendations,
  computeRoiMetrics,
  renderRoiReport,
  runRoiReport,
} from "../src/roi-report.js";

const temporaryDirectories: string[] = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((p) => rm(p, { recursive: true, force: true }))));

const attribution = (overrides: Partial<Attribution> = {}): Attribution => ({
  sessionId: "s1", source: "claude", model: "claude-opus", commitSha: null, prNumber: null,
  confidence: "unknown", confidenceScore: 0, method: "unattributed",
  explanation: "No attribution.", estimatedCostUsd: 1, sessionStartedAt: "2026-07-01T10:00:00Z",
  commitCommittedAt: null, prMergedAt: null, ...overrides,
});

describe("computeRoiMetrics", () => {
  it("splits spend into attributed and unattributed", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", confidence: "high", prNumber: 1, estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", confidence: "low", estimatedCostUsd: 5 }),
      attribution({ sessionId: "c", confidence: "unknown", estimatedCostUsd: 5 }),
    ]);

    expect(metrics.totalSessions).toBe(3);
    expect(metrics.totalSpend).toBe(20);
    expect(metrics.attributedSpend).toBe(10);
    expect(metrics.unattributedSpend).toBe(10);
    expect(metrics.wasteRate).toBe(50);
  });

  it("counts low-confidence commit-only matches as unattributed", () => {
    const metrics = computeRoiMetrics([
      attribution({ confidence: "low", commitSha: "abc", estimatedCostUsd: 7 }),
    ]);

    expect(metrics.attributedSpend).toBe(0);
    expect(metrics.unattributedSpend).toBe(7);
  });

  it("deduplicates merged PRs shared across sessions", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", confidence: "high", prNumber: 42, estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", confidence: "medium", prNumber: 42, estimatedCostUsd: 6 }),
    ]);

    expect(metrics.prBackedAttributedSessions).toBe(2);
    expect(metrics.uniqueAttributedMergedPrs).toBe(1);
    expect(metrics.costPerAttributedMergedPr).toBe(16);
  });

  it("returns zero derived rates with no sessions", () => {
    const metrics = computeRoiMetrics([]);
    expect(metrics.wasteRate).toBe(0);
    expect(metrics.costPerAttributedMergedPr).toBe(0);
  });

  it("splits spend by model", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", model: "claude", confidence: "high", prNumber: 1, estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", model: "codex", confidence: "unknown", estimatedCostUsd: 3 }),
    ]);

    const byModel = Object.fromEntries(metrics.modelBreakdown.map((m) => [m.model, m]));
    expect(byModel.claude.attributedSpend).toBe(10);
    expect(byModel.claude.uniqueAttributedMergedPrs).toBe(1);
    expect(byModel.codex.attributedSpend).toBe(0);
    expect(byModel.codex.unattributedSpend).toBe(3);
  });

  it("tallies confidence counts", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", confidence: "high", prNumber: 1 }),
      attribution({ sessionId: "b", confidence: "medium", prNumber: 2 }),
      attribution({ sessionId: "c", confidence: "low" }),
      attribution({ sessionId: "d", confidence: "unknown" }),
    ]);

    expect(metrics.confidenceCounts).toEqual({ high: 1, medium: 1, low: 1, unknown: 1 });
  });

  it("returns only the 5 costliest unattributed sessions, sorted descending", () => {
    const attributions = Array.from({ length: 7 }, (_, i) =>
      attribution({ sessionId: `s${i}`, confidence: "unknown", estimatedCostUsd: i + 1 }));
    const metrics = computeRoiMetrics(attributions);

    expect(metrics.topUnattributedSessions).toHaveLength(5);
    expect(metrics.topUnattributedSessions.map((s) => s.estimatedCostUsd)).toEqual([7, 6, 5, 4, 3]);
  });
});

describe("buildRecommendations", () => {
  it("flags a high waste rate", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", confidence: "unknown", estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", confidence: "high", prNumber: 1, estimatedCostUsd: 1 }),
    ]);
    expect(buildRecommendations(metrics)).toContain(
      "Most spend is currently unattributed. Improve repo/session tracking before using this as a team ROI source.",
    );
  });

  it("does not flag waste rate when spend is mostly attributed", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", confidence: "high", prNumber: 1, estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", confidence: "unknown", estimatedCostUsd: 1 }),
    ]);
    expect(buildRecommendations(metrics)).not.toContain(
      "Most spend is currently unattributed. Improve repo/session tracking before using this as a team ROI source.",
    );
  });

  it("recommends reviewing attributed PRs when any exist", () => {
    const metrics = computeRoiMetrics([attribution({ confidence: "high", prNumber: 1 })]);
    expect(buildRecommendations(metrics)).toContain(
      "Review attributed PRs to validate whether timing-based attribution matches reality.",
    );
  });

  it("does not recommend reviewing PRs when none are attributed", () => {
    const metrics = computeRoiMetrics([attribution({ confidence: "unknown" })]);
    expect(buildRecommendations(metrics)).not.toContain(
      "Review attributed PRs to validate whether timing-based attribution matches reality.",
    );
  });

  it("flags an outlier unattributed session cost", () => {
    const attributions = [
      attribution({ sessionId: "a", confidence: "unknown", estimatedCostUsd: 100 }),
      attribution({ sessionId: "b", confidence: "unknown", estimatedCostUsd: 1 }),
      attribution({ sessionId: "c", confidence: "unknown", estimatedCostUsd: 1 }),
    ];
    const metrics = computeRoiMetrics(attributions);
    expect(buildRecommendations(metrics)).toContain(
      "Investigate high-cost sessions with no nearby commit or merged PR.",
    );
  });

  it("does not flag unattributed cost when sessions are similarly priced", () => {
    const attributions = [
      attribution({ sessionId: "a", confidence: "unknown", estimatedCostUsd: 2 }),
      attribution({ sessionId: "b", confidence: "unknown", estimatedCostUsd: 1 }),
    ];
    const metrics = computeRoiMetrics(attributions);
    expect(buildRecommendations(metrics)).not.toContain(
      "Investigate high-cost sessions with no nearby commit or merged PR.",
    );
  });

  it("flags a large cost-per-PR gap between models", () => {
    const attributions = [
      attribution({ sessionId: "a", model: "claude", confidence: "high", prNumber: 1, estimatedCostUsd: 2 }),
      attribution({ sessionId: "b", model: "codex", confidence: "high", prNumber: 2, estimatedCostUsd: 20 }),
    ];
    const metrics = computeRoiMetrics(attributions);
    const recommendations = buildRecommendations(metrics);
    expect(recommendations.some((r) => r.includes("claude") && r.includes("codex") && r.includes("sample size"))).toBe(true);
  });

  it("does not flag model efficiency when costs per PR are close", () => {
    const attributions = [
      attribution({ sessionId: "a", model: "claude", confidence: "high", prNumber: 1, estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", model: "codex", confidence: "high", prNumber: 2, estimatedCostUsd: 12 }),
    ];
    const metrics = computeRoiMetrics(attributions);
    expect(buildRecommendations(metrics).some((r) => r.includes("sample size"))).toBe(false);
  });

  it("returns no recommendations for a clean, fully attributed, evenly priced report", () => {
    const metrics = computeRoiMetrics([]);
    expect(buildRecommendations(metrics)).toEqual([]);
  });
});

describe("renderRoiReport", () => {
  it("renders every required section", () => {
    const metrics = computeRoiMetrics([
      attribution({ sessionId: "a", confidence: "high", prNumber: 1, estimatedCostUsd: 10 }),
      attribution({ sessionId: "b", confidence: "unknown", estimatedCostUsd: 5 }),
    ]);
    const output = renderRoiReport(metrics, false);

    for (const text of [
      "Floor200 — AI Coding ROI Report",
      "Total sessions analyzed",
      "Total estimated spend",
      "Attributed spend",
      "Unattributed spend",
      "Waste rate",
      "PR-backed attributed sessions",
      "Unique attributed merged PRs",
      "Cost per attributed merged PR",
      "Attribution confidence",
      "Spend by model",
      "Top 5 most expensive unattributed sessions",
      "Recommendations",
    ]) {
      expect(output).toContain(text);
    }
  });

  it("prints a plain message instead of empty tables/lists", () => {
    const metrics = computeRoiMetrics([]);
    const output = renderRoiReport(metrics, false);
    expect(output).toContain("None.");
    expect(output).toContain("No recommendations.");
  });
});

describe("runRoiReport", () => {
  it("fails clearly when attributions.json is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-roi-report-"));
    temporaryDirectories.push(directory);
    await expect(runRoiReport({ baseDirectory: directory })).rejects.toMatchObject({
      name: "RoiReportDataError", fileName: "attributions.json",
    } satisfies Partial<RoiReportDataError>);
  });

  it("fails clearly when attributions.json is malformed", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-roi-report-"));
    temporaryDirectories.push(directory);
    const dataDirectory = join(directory, ".floor200", "data");
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(join(dataDirectory, "attributions.json"), JSON.stringify({ not: "an array" }));

    await expect(runRoiReport({ baseDirectory: directory })).rejects.toMatchObject({
      name: "RoiReportDataError", fileName: "attributions.json",
    } satisfies Partial<RoiReportDataError>);
  });

  it("computes and renders a report end-to-end", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-roi-report-"));
    temporaryDirectories.push(directory);
    const dataDirectory = join(directory, ".floor200", "data");
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(
      join(dataDirectory, "attributions.json"),
      JSON.stringify([
        attribution({ sessionId: "a", confidence: "high", prNumber: 1, estimatedCostUsd: 10 }),
        attribution({ sessionId: "b", confidence: "unknown", estimatedCostUsd: 5 }),
      ]),
    );

    const { metrics, report } = await runRoiReport({ baseDirectory: directory });
    expect(metrics.totalSessions).toBe(2);
    expect(report).toContain("Floor200 — AI Coding ROI Report");
  });
});
