import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { deriveMetrics } from "./metrics.js";
import type { DemoData, SpendBreakdown } from "./types.js";

export type ExportFormat = "md" | "json";

const money = (value: number): string => `$${value.toFixed(2)}`;
const percent = (value: number): string => `${value.toFixed(1)}%`;

function costPerMerge(row: SpendBreakdown): number | null {
  return row.mergedPullRequests === 0
    ? null
    : row.spend / row.mergedPullRequests;
}

function markdownBreakdown(rows: SpendBreakdown[]): string[] {
  return [
    "| Name | Spend | Merged PRs | Cost / merge | Confidence |",
    "| --- | ---: | ---: | ---: | --- |",
    ...rows.map((row) => {
      const cost = costPerMerge(row);
      return `| ${row.name} | ${money(row.spend)} | ${row.mergedPullRequests} | ${cost === null ? "—" : money(cost)} | ${row.confidence} |`;
    }),
  ];
}

function jsonBreakdown(rows: SpendBreakdown[]) {
  return rows.map((row) => ({
    name: row.name,
    spend: row.spend,
    mergedPullRequests: row.mergedPullRequests,
    costPerMergedPullRequest: costPerMerge(row),
    confidence: row.confidence,
  }));
}

export function serializeMarkdown(data: DemoData): string {
  const metrics = deriveMetrics(data);

  return [
    "# Floor200 — AI Coding ROI Report",
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Total AI coding spend | ${money(data.totalSpend)} |`,
    `| Attributed merged PRs | ${data.mergedPullRequests} |`,
    `| Cost per merged PR | ${money(metrics.costPerMergedPullRequest)} |`,
    `| Abandoned spend | ${money(data.abandonedSpend)} |`,
    `| Waste rate | ${percent(metrics.wasteRate)} |`,
    `| CI pass rate | ${percent(metrics.ciPassRate)} |`,
    `| Revert count | ${data.revertCount} |`,
    "",
    "## Spend by model",
    "",
    ...markdownBreakdown(data.models),
    "",
    "## Spend by contributor",
    "",
    ...markdownBreakdown(data.developers),
    "",
    "## Spend by repo",
    "",
    ...markdownBreakdown(data.repos),
    "",
    "## Recommendations",
    "",
    ...data.recommendations.map((recommendation) => `- ${recommendation}`),
    "",
  ].join("\n");
}

export function serializeJson(data: DemoData): string {
  const metrics = deriveMetrics(data);
  const report = {
    summary: {
      totalSpend: data.totalSpend,
      attributedMergedPullRequests: data.mergedPullRequests,
      costPerMergedPullRequest: metrics.costPerMergedPullRequest,
      abandonedSpend: data.abandonedSpend,
      wasteRate: metrics.wasteRate,
      ciPassRate: metrics.ciPassRate,
      revertCount: data.revertCount,
    },
    models: jsonBreakdown(data.models),
    contributors: jsonBreakdown(data.developers),
    repos: jsonBreakdown(data.repos),
    recommendations: data.recommendations,
  };

  return `${JSON.stringify(report, null, 2)}\n`;
}

export async function exportDemoReport(
  data: DemoData,
  format: ExportFormat,
  baseDirectory = process.cwd(),
): Promise<string> {
  const reportDirectory = join(baseDirectory, ".floor200", "reports");
  const filename = format === "md" ? "demo-report.md" : "demo-report.json";
  const content =
    format === "md" ? serializeMarkdown(data) : serializeJson(data);
  const outputPath = join(reportDirectory, filename);

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(outputPath, content, "utf8");

  return outputPath;
}
