import { describe, expect, it } from "vitest";

import { deriveMetrics } from "../src/metrics.js";
import type { DemoData } from "../src/types.js";

const data: DemoData = {
  totalSpend: 200,
  abandonedSpend: 50,
  mergedPullRequests: 10,
  ciRuns: { passed: 8, total: 10 },
  revertCount: 2,
  models: [],
  developers: [],
  repos: [],
  recommendations: [],
};

describe("deriveMetrics", () => {
  it("calculates cost per merged pull request", () => {
    expect(deriveMetrics(data).costPerMergedPullRequest).toBe(20);
  });

  it("calculates abandoned-spend waste rate", () => {
    expect(deriveMetrics(data).wasteRate).toBe(25);
  });

  it("calculates CI pass rate", () => {
    expect(deriveMetrics(data).ciPassRate).toBe(80);
  });

  it("returns zero for derived rates with no denominator", () => {
    const empty: DemoData = {
      ...data,
      totalSpend: 0,
      mergedPullRequests: 0,
      ciRuns: { passed: 0, total: 0 },
    };

    expect(deriveMetrics(empty)).toEqual({
      costPerMergedPullRequest: 0,
      wasteRate: 0,
      ciPassRate: 0,
    });
  });
});
