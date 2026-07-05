import { access } from "node:fs/promises";
import { join } from "node:path";

import { nodeCommandRunner } from "./process.js";
import type { CommandRunner } from "./process.js";

export interface DataFileStatus {
  name: string;
  present: boolean;
}

export interface StatusReport {
  configFound: boolean;
  gitRepositoryDetected: boolean;
  ccusageAvailable: boolean;
  dataFiles: DataFileStatus[];
}

const DATA_FILE_NAMES = [
  "commits.json",
  "prs.json",
  "usage.json",
  "attributions.json",
];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function checkStatus(
  options: { baseDirectory?: string; runner?: CommandRunner } = {},
): Promise<StatusReport> {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const runner = options.runner ?? nodeCommandRunner;

  const configFound = await pathExists(join(baseDirectory, ".floor200.yml"));

  const gitRepositoryDetected = await runner
    .run("git", ["-C", baseDirectory, "rev-parse", "--show-toplevel"])
    .then(() => true)
    .catch(() => false);

  const ccusageAvailable = await runner
    .run("ccusage", ["--version"])
    .then(() => true)
    .catch(() => false);

  const dataDirectory = join(baseDirectory, ".floor200", "data");
  const dataFiles = await Promise.all(
    DATA_FILE_NAMES.map(async (name) => ({
      name,
      present: await pathExists(join(dataDirectory, name)),
    })),
  );

  return { configFound, gitRepositoryDetected, ccusageAvailable, dataFiles };
}

export function renderStatus(report: StatusReport): string {
  const check = (value: boolean) => (value ? "yes" : "no");
  const lines = [
    `Config found: ${check(report.configFound)}`,
    `Git repository detected: ${check(report.gitRepositoryDetected)}`,
    `ccusage available: ${check(report.ccusageAvailable)}`,
    "Collected data files:",
    ...report.dataFiles.map(
      (file) => `  ${file.name}: ${check(file.present)}`,
    ),
  ];
  return lines.join("\n");
}
