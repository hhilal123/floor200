import chalk, { Chalk } from "chalk";
import Table from "cli-table3";

import { deriveMetrics } from "./metrics.js";
import type { DemoData, SpendBreakdown } from "./types.js";

const money = (value: number): string => `$${value.toFixed(2)}`;
const percent = (value: number): string => `${value.toFixed(1)}%`;

function breakdownTable(rows: SpendBreakdown[]): string {
  const table = new Table({
    head: ["Name", "Spend", "Merged PRs", "Cost / merge", "Confidence"],
  });

  for (const row of rows) {
    table.push([
      row.name,
      money(row.spend),
      row.mergedPullRequests,
      row.mergedPullRequests === 0
        ? "—"
        : money(row.spend / row.mergedPullRequests),
      row.confidence,
    ]);
  }

  return table.toString();
}

export function renderReport(data: DemoData, useColor = true): string {
  const color = useColor ? chalk : new Chalk({ level: 0 });
  const metrics = deriveMetrics(data);
  const summary = new Table();

  summary.push(
    ["Total AI coding spend", money(data.totalSpend)],
    ["Attributed merged PRs", data.mergedPullRequests],
    ["Cost per merged PR", money(metrics.costPerMergedPullRequest)],
    ["Abandoned spend", money(data.abandonedSpend)],
    ["Waste rate", percent(metrics.wasteRate)],
    ["CI pass rate", percent(metrics.ciPassRate)],
    ["Revert count", data.revertCount],
  );

  return [
    color.bold.cyan("Floor200 — AI Coding ROI Report"),
    "",
    color.bold("Summary"),
    summary.toString(),
    "",
    color.bold("Spend by model"),
    breakdownTable(data.models),
    "",
    color.bold("Spend by developer"),
    breakdownTable(data.developers),
    "",
    color.bold("Spend by repo"),
    breakdownTable(data.repos),
    "",
    color.bold("Recommendations"),
    ...data.recommendations.map((recommendation) => `- ${recommendation}`),
  ].join("\n");
}
