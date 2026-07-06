import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runAttribution } from "./attribution.js";
import {
  initializeProject,
  InvalidProjectRepoError,
  MissingProjectRepoError,
} from "./config.js";
import {
  collectGitCommits,
} from "./git.js";
import {
  collectPullRequests,
  GitHubAuthenticationError,
  GitHubCliMissingError,
  GitHubCollectionError,
  GitHubResponseError,
} from "./github.js";
import { nodeCommandRunner } from "./process.js";
import type { CommandRunner } from "./process.js";
import { runRoiReport } from "./roi-report.js";
import {
  CcusageMissingError,
  collectUsage,
  NoParseableUsageError,
  UsageCollectionError,
  UsageParseError,
} from "./usage.js";

export type PipelineStepName = "init" | "git" | "prs" | "usage" | "attribute" | "report";

export interface PipelineStepResult {
  step: PipelineStepName;
  status: "ok" | "skipped" | "initialized";
  detail: string;
  warning?: string;
}

export interface PipelineOptions {
  baseDirectory?: string;
  runner?: CommandRunner;
  since?: string;
  onStep?: (result: PipelineStepResult) => void;
}

export interface PipelineResult {
  steps: PipelineStepResult[];
  report: string;
}

const PR_DEGRADABLE_ERRORS = [
  GitHubCliMissingError,
  GitHubAuthenticationError,
  GitHubCollectionError,
  GitHubResponseError,
  MissingProjectRepoError,
  InvalidProjectRepoError,
];

const USAGE_DEGRADABLE_ERRORS = [
  CcusageMissingError,
  UsageParseError,
  NoParseableUsageError,
  UsageCollectionError,
];

function warningFor(error: unknown): string {
  if (error instanceof GitHubCliMissingError) {
    return "GitHub CLI (gh) is required. Install it and try again. Skipping pull requests.";
  }
  if (error instanceof GitHubAuthenticationError) {
    return "GitHub CLI is not authenticated. Run gh auth login first. Skipping pull requests.";
  }
  if (error instanceof GitHubCollectionError) {
    return "Could not collect merged pull requests. Check repository access. Skipping pull requests.";
  }
  if (error instanceof GitHubResponseError) {
    return "GitHub CLI returned malformed pull-request data. Skipping pull requests.";
  }
  if (error instanceof MissingProjectRepoError || error instanceof InvalidProjectRepoError) {
    return "Set project.repo in .floor200.yml using the owner/repo format. Skipping pull requests.";
  }
  if (error instanceof CcusageMissingError) {
    return "ccusage is required. Install it and try again. Skipping usage.";
  }
  if (error instanceof UsageParseError || error instanceof NoParseableUsageError) {
    return "ccusage returned no parseable usage sessions. Skipping usage.";
  }
  if (error instanceof UsageCollectionError) {
    return "Could not collect usage from ccusage. Skipping usage.";
  }
  throw error instanceof Error ? error : new Error(String(error));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureEmptyDataFile(baseDirectory: string, fileName: string): Promise<boolean> {
  const dataDirectory = join(baseDirectory, ".floor200", "data");
  const path = join(dataDirectory, fileName);
  if (await fileExists(path)) {
    return false;
  }
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(path, "[]\n", "utf8");
  return true;
}

export async function runPipeline(
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const runner = options.runner ?? nodeCommandRunner;
  const steps: PipelineStepResult[] = [];
  const emit = (result: PipelineStepResult): void => {
    steps.push(result);
    options.onStep?.(result);
  };

  const configPath = join(baseDirectory, ".floor200.yml");
  if (!(await fileExists(configPath))) {
    await initializeProject({ baseDirectory });
    emit({
      step: "init",
      status: "initialized",
      detail: "No .floor200.yml found; initialized Floor200 with defaults.",
    });
  }

  const gitResult = await collectGitCommits({ baseDirectory, since: options.since, runner });
  emit({
    step: "git",
    status: "ok",
    detail: `Collected ${gitResult.count} commit${gitResult.count === 1 ? "" : "s"} to ${gitResult.outputPath}`,
  });

  try {
    const prsResult = await collectPullRequests({ baseDirectory, runner });
    emit({
      step: "prs",
      status: "ok",
      detail: `Collected ${prsResult.count} merged pull request${prsResult.count === 1 ? "" : "s"} to ${prsResult.outputPath}`,
    });
  } catch (error) {
    if (!PR_DEGRADABLE_ERRORS.some((ErrorClass) => error instanceof ErrorClass)) {
      throw error;
    }
    const wrote = await ensureEmptyDataFile(baseDirectory, "prs.json");
    emit({
      step: "prs",
      status: "skipped",
      detail: wrote
        ? "Skipped pull request collection."
        : "Skipped pull request collection; using previously collected data.",
      warning: warningFor(error),
    });
  }

  try {
    const usageResult = await collectUsage({ baseDirectory, runner });
    const skippedNote = usageResult.skippedCount
      ? ` (${usageResult.skippedCount} skipped; see ${usageResult.debugPath})`
      : "";
    emit({
      step: "usage",
      status: "ok",
      detail: `Collected ${usageResult.count} usage session${usageResult.count === 1 ? "" : "s"} to ${usageResult.outputPath}${skippedNote}`,
    });
  } catch (error) {
    if (!USAGE_DEGRADABLE_ERRORS.some((ErrorClass) => error instanceof ErrorClass)) {
      throw error;
    }
    const wrote = await ensureEmptyDataFile(baseDirectory, "usage.json");
    emit({
      step: "usage",
      status: "skipped",
      detail: wrote
        ? "Skipped usage collection."
        : "Skipped usage collection; using previously collected data.",
      warning: warningFor(error),
    });
  }

  const attributionResult = await runAttribution({ baseDirectory });
  emit({
    step: "attribute",
    status: "ok",
    detail: `Wrote attributions to ${attributionResult.outputPath}`,
  });

  const { report } = await runRoiReport({ baseDirectory });
  emit({ step: "report", status: "ok", detail: "Generated ROI report." });

  return { steps, report };
}
