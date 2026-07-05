import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { demoData } from "../src/demo-data.js";
import {
  exportDemoReport,
  serializeJson,
  serializeMarkdown,
} from "../src/export.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("export serializers", () => {
  it("serializes a readable Markdown report with derived metrics", () => {
    const output = serializeMarkdown(demoData);

    expect(output).toContain("# Floor200 — AI Coding ROI Report");
    expect(output).toContain("| Total AI coding spend | $428.72 |");
    expect(output).toContain("| Cost per merged PR | $16.49 |");
    expect(output).toContain("| Waste rate | 21.3% |");
    expect(output).toContain("| CI pass rate | 87.5% |");
    expect(output).toContain("## Spend by model");
    expect(output).toContain("## Spend by contributor");
    expect(output).toContain("## Spend by repo");
    expect(output).toContain("| Claude | $182.40 | 14 | $13.03 | high |");
    expect(output).toContain("- Investigate abandoned sessions over $10.");
  });

  it("serializes structured JSON with matching derived metrics", () => {
    const output = JSON.parse(serializeJson(demoData));

    expect(output.summary).toEqual({
      totalSpend: 428.72,
      attributedMergedPullRequests: 26,
      costPerMergedPullRequest: 428.72 / 26,
      abandonedSpend: 91.2,
      wasteRate: (91.2 / 428.72) * 100,
      ciPassRate: 87.5,
      revertCount: 2,
    });
    expect(output.models[0]).toEqual({
      name: "Claude",
      spend: 182.4,
      mergedPullRequests: 14,
      costPerMergedPullRequest: 182.4 / 14,
      confidence: "high",
    });
    expect(output.models.at(-1).costPerMergedPullRequest).toBeNull();
    expect(output.contributors).toHaveLength(3);
    expect(output.repos).toHaveLength(3);
    expect(output.recommendations).toEqual(demoData.recommendations);
  });
});

describe("exportDemoReport", () => {
  it.each([
    ["md" as const, "demo-report.md", "# Floor200 — AI Coding ROI Report"],
    ["json" as const, "demo-report.json", '"totalSpend": 428.72'],
  ])("creates the stable %s export", async (format, filename, expectedText) => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-export-"));
    temporaryDirectories.push(directory);

    const outputPath = await exportDemoReport(demoData, format, directory);

    expect(outputPath).toBe(
      join(directory, ".floor200", "reports", filename),
    );
    expect(await readFile(outputPath, "utf8")).toContain(expectedText);
  });

  it("overwrites an existing stable export", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-export-"));
    temporaryDirectories.push(directory);
    const outputPath = await exportDemoReport(demoData, "md", directory);
    await writeFile(outputPath, "stale report", "utf8");

    await exportDemoReport(demoData, "md", directory);

    expect(await readFile(outputPath, "utf8")).toBe(
      serializeMarkdown(demoData),
    );
  });
});
