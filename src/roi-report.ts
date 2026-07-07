import { readFile } from "node:fs/promises";
import { join } from "node:path";

import chalk, { Chalk } from "chalk";
import Table from "cli-table3";

import type { Attribution, AttributionConfidence } from "./attribution.js";

export class RoiReportDataError extends Error {
  constructor(readonly fileName: string, options?: ErrorOptions) {
    super(`Required ROI report data is missing or malformed: ${fileName}`, options);
    this.name = "RoiReportDataError";
  }
}

export interface ModelRoi {
  model: string;
  totalSpend: number;
  attributedSpend: number;
  unattributedSpend: number;
  pendingSpend: number;
  prBackedAttributedSessions: number;
  uniqueAttributedMergedPrs: number;
  costPerAttributedMergedPr: number;
}

export interface UnattributedSessionSummary {
  sessionId: string;
  source: string;
  model: string;
  estimatedCostUsd: number;
  sessionStartedAt: string;
}

export interface RoiMetrics {
  totalSessions: number;
  totalSpend: number;
  attributedSpend: number;
  unattributedSpend: number;
  pendingSessions: number;
  pendingSpend: number;
  wasteRate: number;
  prBackedAttributedSessions: number;
  uniqueAttributedMergedPrs: number;
  costPerAttributedMergedPr: number;
  confidenceCounts: Record<AttributionConfidence, number>;
  modelBreakdown: ModelRoi[];
  topUnattributedSessions: UnattributedSessionSummary[];
}

function isAttributed(attribution: Attribution): boolean {
  return attribution.confidence === "high" || attribution.confidence === "medium";
}

function isPending(attribution: Attribution): boolean {
  return attribution.method === "pending-data";
}

function modelRoiFor(model: string, attributions: Attribution[]): ModelRoi {
  const totalSpend = attributions.reduce((sum, a) => sum + a.estimatedCostUsd, 0);
  const attributed = attributions.filter(isAttributed);
  const attributedSpend = attributed.reduce((sum, a) => sum + a.estimatedCostUsd, 0);
  const pendingSpend = attributions.filter(isPending).reduce((sum, a) => sum + a.estimatedCostUsd, 0);
  const uniqueAttributedMergedPrs = new Set(attributed.map((a) => a.prNumber)).size;
  return {
    model,
    totalSpend,
    attributedSpend,
    unattributedSpend: totalSpend - attributedSpend - pendingSpend,
    pendingSpend,
    prBackedAttributedSessions: attributed.length,
    uniqueAttributedMergedPrs,
    costPerAttributedMergedPr: uniqueAttributedMergedPrs === 0 ? 0 : attributedSpend / uniqueAttributedMergedPrs,
  };
}

export function computeRoiMetrics(allAttributions: Attribution[]): RoiMetrics {
  const attributions = allAttributions.filter((a) => a.inScope);
  const totalSpend = attributions.reduce((sum, a) => sum + a.estimatedCostUsd, 0);
  const attributed = attributions.filter(isAttributed);
  const pending = attributions.filter(isPending);
  const unattributed = attributions.filter((a) => !isAttributed(a) && !isPending(a));
  const attributedSpend = attributed.reduce((sum, a) => sum + a.estimatedCostUsd, 0);
  const pendingSpend = pending.reduce((sum, a) => sum + a.estimatedCostUsd, 0);
  const unattributedSpend = totalSpend - attributedSpend - pendingSpend;
  const uniqueAttributedMergedPrs = new Set(attributed.map((a) => a.prNumber)).size;

  const confidenceCounts: Record<AttributionConfidence, number> = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const attribution of attributions) confidenceCounts[attribution.confidence] += 1;

  const models = new Set(attributions.map((a) => a.model));
  const modelBreakdown = [...models]
    .map((model) => modelRoiFor(model, attributions.filter((a) => a.model === model)))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const topUnattributedSessions = unattributed
    .slice()
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
    .slice(0, 5)
    .map((a) => ({
      sessionId: a.sessionId, source: a.source, model: a.model,
      estimatedCostUsd: a.estimatedCostUsd, sessionStartedAt: a.sessionStartedAt,
    }));

  return {
    totalSessions: attributions.length,
    totalSpend, attributedSpend, unattributedSpend,
    pendingSessions: pending.length, pendingSpend,
    wasteRate: totalSpend - pendingSpend === 0 ? 0 : (unattributedSpend / (totalSpend - pendingSpend)) * 100,
    prBackedAttributedSessions: attributed.length,
    uniqueAttributedMergedPrs,
    costPerAttributedMergedPr: uniqueAttributedMergedPrs === 0 ? 0 : attributedSpend / uniqueAttributedMergedPrs,
    confidenceCounts, modelBreakdown, topUnattributedSessions,
  };
}

export function buildRecommendations(metrics: RoiMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.wasteRate > 50) {
    recommendations.push(
      "Most spend is currently unattributed. Improve repo/session tracking before using this as a team ROI source.",
    );
  }

  if (metrics.uniqueAttributedMergedPrs > 0) {
    recommendations.push(
      "Review attributed PRs to validate whether timing-based attribution matches reality.",
    );
  }

  const costliestUnattributed = metrics.topUnattributedSessions[0];
  const averageSessionCost = metrics.totalSessions === 0 ? 0 : metrics.totalSpend / metrics.totalSessions;
  if (costliestUnattributed && averageSessionCost > 0 && costliestUnattributed.estimatedCostUsd > 2 * averageSessionCost) {
    recommendations.push("Investigate high-cost sessions with no nearby commit or merged PR.");
  }

  const modelsWithPrs = metrics.modelBreakdown.filter((m) => m.uniqueAttributedMergedPrs > 0);
  if (modelsWithPrs.length >= 2) {
    const cheapest = modelsWithPrs.reduce((min, m) => m.costPerAttributedMergedPr < min.costPerAttributedMergedPr ? m : min);
    const priciest = modelsWithPrs.reduce((max, m) => m.costPerAttributedMergedPr > max.costPerAttributedMergedPr ? m : max);
    if (cheapest.model !== priciest.model && priciest.costPerAttributedMergedPr >= 2 * cheapest.costPerAttributedMergedPr) {
      recommendations.push(
        `${cheapest.model} shows a lower cost per attributed merged PR than ${priciest.model}; possible efficiency signal, but sample size may be small.`,
      );
    }
  }

  return recommendations;
}

const money = (value: number): string => `$${value.toFixed(2)}`;
const percent = (value: number): string => `${value.toFixed(1)}%`;

export function renderRoiReport(metrics: RoiMetrics, useColor = true): string {
  const color = useColor ? chalk : new Chalk({ level: 0 });

  const summary = new Table();
  summary.push(
    ["Total sessions analyzed", metrics.totalSessions],
    ["Total estimated spend", money(metrics.totalSpend)],
    ["Attributed spend", money(metrics.attributedSpend)],
    ["Unattributed spend", money(metrics.unattributedSpend)],
    ["Pending spend (evidence too recent)", money(metrics.pendingSpend)],
    ["Waste rate", percent(metrics.wasteRate)],
    ["PR-backed attributed sessions", metrics.prBackedAttributedSessions],
    ["Unique attributed merged PRs", metrics.uniqueAttributedMergedPrs],
    ["Cost per attributed merged PR", money(metrics.costPerAttributedMergedPr)],
  );

  const confidence = new Table();
  confidence.push(
    ["High", metrics.confidenceCounts.high],
    ["Medium", metrics.confidenceCounts.medium],
    ["Low", metrics.confidenceCounts.low],
    ["Unknown", metrics.confidenceCounts.unknown],
  );

  const modelTable = new Table({
    head: ["Model", "Total spend", "Attributed", "Unattributed", "Pending", "Attributed merged PRs", "Cost / merged PR"],
  });
  for (const model of metrics.modelBreakdown) {
    modelTable.push([
      model.model, money(model.totalSpend), money(model.attributedSpend), money(model.unattributedSpend),
      money(model.pendingSpend),
      model.uniqueAttributedMergedPrs,
      model.uniqueAttributedMergedPrs === 0 ? "—" : money(model.costPerAttributedMergedPr),
    ]);
  }

  const unattributedTable = new Table({ head: ["Session", "Source", "Model", "Cost", "Started"] });
  for (const session of metrics.topUnattributedSessions) {
    unattributedTable.push([
      session.sessionId, session.source, session.model, money(session.estimatedCostUsd), session.sessionStartedAt,
    ]);
  }

  const recommendations = buildRecommendations(metrics);

  const pendingNote = metrics.pendingSessions === 0 ? [] : [
    "",
    `${metrics.pendingSessions} session(s) are too recent to attribute (their commits may not have existed when data was collected); re-run \`floor200 run\` later to resolve them.`,
  ];

  return [
    color.bold.cyan("Floor200 — AI Coding ROI Report"),
    "",
    color.bold("Summary"),
    summary.toString(),
    ...pendingNote,
    "",
    color.bold("Attribution confidence"),
    confidence.toString(),
    "",
    color.bold("Spend by model"),
    modelTable.toString(),
    "",
    color.bold("Top 5 most expensive unattributed sessions"),
    metrics.topUnattributedSessions.length === 0 ? "None." : unattributedTable.toString(),
    "",
    color.bold("Recommendations"),
    recommendations.length === 0 ? "No recommendations." : recommendations.map((r) => `- ${r}`).join("\n"),
  ].join("\n");
}

export async function runRoiReport(
  options: { baseDirectory?: string } = {},
): Promise<{ metrics: RoiMetrics; report: string }> {
  const dataDirectory = join(options.baseDirectory ?? process.cwd(), ".floor200", "data");
  const path = join(dataDirectory, "attributions.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new RoiReportDataError("attributions.json", { cause: error });
  }
  if (!Array.isArray(parsed)) throw new RoiReportDataError("attributions.json");

  const metrics = computeRoiMetrics(parsed as Attribution[]);
  return { metrics, report: renderRoiReport(metrics) };
}
