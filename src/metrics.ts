import type { DemoData, DerivedMetrics } from "./types.js";

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

export function deriveMetrics(data: DemoData): DerivedMetrics {
  return {
    costPerMergedPullRequest:
      data.mergedPullRequests === 0
        ? 0
        : data.totalSpend / data.mergedPullRequests,
    wasteRate: percentage(data.abandonedSpend, data.totalSpend),
    ciPassRate: percentage(data.ciRuns.passed, data.ciRuns.total),
  };
}
