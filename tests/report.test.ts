import { describe, expect, it } from "vitest";

import { demoData } from "../src/demo-data.js";
import { renderReport } from "../src/report.js";

describe("renderReport", () => {
  it("renders every required demo report section", () => {
    const output = renderReport(demoData, false);

    for (const text of [
      "Floor200 — AI Coding ROI Report",
      "Total AI coding spend",
      "Attributed merged PRs",
      "Cost per merged PR",
      "Abandoned spend",
      "Waste rate",
      "Spend by model",
      "Spend by developer",
      "Spend by repo",
      "CI pass rate",
      "Revert count",
      "Recommendations",
    ]) {
      expect(output).toContain(text);
    }
  });
});
