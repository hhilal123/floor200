#!/usr/bin/env node

import { Command } from "commander";
import { relative } from "node:path";

import {
  ConfigAlreadyExistsError,
  InvalidConfigError,
  InvalidProjectRepoError,
  initializeProject,
  MissingConfigError,
  MissingProjectRepoError,
} from "./config.js";
import { demoData } from "./demo-data.js";
import { exportDemoReport } from "./export.js";
import type { ExportFormat } from "./export.js";
import {
  collectGitCommits,
  GitCollectionError,
  GitLogParseError,
  GitRepositoryError,
  InvalidSinceDateError,
} from "./git.js";
import {
  collectPullRequests,
  GitHubAuthenticationError,
  GitHubCliMissingError,
  GitHubCollectionError,
  GitHubResponseError,
} from "./github.js";
import { renderReport } from "./report.js";
import {
  CcusageMissingError,
  collectUsage,
  NoParseableUsageError,
  UsageCollectionError,
  UsageParseError,
} from "./usage.js";

const program = new Command()
  .name("floor200")
  .description("AI coding-agent ROI, from spend to shipped PRs.")
  .version("0.1.0");

const printDemo = (): void => {
  console.log(renderReport(demoData));
};

program
  .command("init")
  .description("Initialize Floor200 in the current project")
  .option("--force", "overwrite an existing configuration")
  .action(async (options: { force?: boolean }) => {
    try {
      const result = await initializeProject({ force: options.force });
      console.log(
        [
          "Floor200 initialized.",
          "",
          "Created:",
          `- ${relative(process.cwd(), result.configPath)}`,
          `- ${relative(process.cwd(), result.dataDirectory)}/`,
          `- ${relative(process.cwd(), result.reportsDirectory)}/`,
          "",
          "Next steps:",
          "1. Review .floor200.yml.",
          "2. Run floor200 report --demo.",
        ].join("\n"),
      );
    } catch (error) {
      if (error instanceof ConfigAlreadyExistsError) {
        program.error(
          "Configuration already exists. Use --force to overwrite it.",
        );
      }

      throw error;
    }
  });

program
  .command("demo")
  .description("Print a demo ROI report using fake data")
  .action(printDemo);

program
  .command("report")
  .description("Print an ROI report")
  .option("--demo", "use built-in fake data")
  .action((options: { demo?: boolean }) => {
    if (!options.demo) {
      program.error("The first version only supports: floor200 report --demo");
    }

    printDemo();
  });

program
  .command("export")
  .description("Export an ROI report")
  .option("--demo", "use built-in fake data")
  .requiredOption("--format <format>", "export format: md or json")
  .action(async (options: { demo?: boolean; format: string }) => {
    if (!options.demo) {
      program.error(
        "The first version only supports: floor200 export --demo",
      );
    }

    if (options.format !== "md" && options.format !== "json") {
      program.error(
        `Unsupported format "${options.format}". Use "md" or "json".`,
      );
    }

    const outputPath = await exportDemoReport(
      demoData,
      options.format as ExportFormat,
    );
    console.log(`Exported demo report to ${relative(process.cwd(), outputPath)}`);
  });

const collect = program
  .command("collect")
  .description("Collect local engineering metadata");

collect
  .command("prs")
  .description("Collect merged pull requests using GitHub CLI")
  .action(async () => {
    try {
      const result = await collectPullRequests();
      const pullRequestLabel = result.count === 1
        ? "merged pull request"
        : "merged pull requests";
      console.log(
        `Collected ${result.count} ${pullRequestLabel} to ${relative(process.cwd(), result.outputPath)}`,
      );
    } catch (error) {
      if (error instanceof MissingConfigError) {
        program.error("Configuration not found. Run floor200 init first.");
      }
      if (
        error instanceof MissingProjectRepoError ||
        error instanceof InvalidProjectRepoError
      ) {
        program.error(
          "Set project.repo in .floor200.yml using the owner/repo format.",
        );
      }
      if (error instanceof InvalidConfigError) {
        program.error(
          "Could not read .floor200.yml. Check that it contains valid YAML.",
        );
      }
      if (error instanceof GitHubCliMissingError) {
        program.error(
          "GitHub CLI (gh) is required. Install it and try again.",
        );
      }
      if (error instanceof GitHubAuthenticationError) {
        program.error(
          "GitHub CLI is not authenticated. Run gh auth login first.",
        );
      }
      if (error instanceof GitHubCollectionError) {
        program.error(
          "Could not collect merged pull requests. Check repository access.",
        );
      }
      if (error instanceof GitHubResponseError) {
        program.error("GitHub CLI returned malformed pull-request data.");
      }

      throw error;
    }
  });

collect
  .command("git")
  .description("Collect local git commit metadata")
  .option("--since <date>", "collect commits since YYYY-MM-DD")
  .action(async (options: { since?: string }) => {
    try {
      const result = await collectGitCommits({ since: options.since });
      const label = result.count === 1 ? "commit" : "commits";
      console.log(
        `Collected ${result.count} ${label} to ${relative(process.cwd(), result.outputPath)}`,
      );
    } catch (error) {
      if (error instanceof InvalidSinceDateError) {
        program.error("Use --since YYYY-MM-DD with a valid calendar date.");
      }
      if (error instanceof MissingConfigError) {
        program.error("Configuration not found. Run floor200 init first.");
      }
      if (error instanceof GitRepositoryError) {
        program.error("Current directory is not inside a git repository.");
      }
      if (error instanceof GitLogParseError) {
        program.error("Git returned malformed commit data.");
      }
      if (error instanceof GitCollectionError) {
        program.error("Could not collect local git commits.");
      }
      throw error;
    }
  });

collect
  .command("usage")
  .description("Collect local AI coding-agent usage through ccusage")
  .action(async () => {
    try {
      const result = await collectUsage();
      const sessionLabel = result.count === 1 ? "session" : "sessions";
      const warning = result.skippedCount
        ? ` (${result.skippedCount} skipped; see .floor200/debug/ccusage-skipped.json)`
        : "";
      console.log(`Collected ${result.count} usage ${sessionLabel} to ${relative(process.cwd(), result.outputPath)}${warning}`);
    } catch (error) {
      if (error instanceof MissingConfigError) program.error("Configuration not found. Run floor200 init first.");
      if (error instanceof CcusageMissingError) program.error("ccusage is required. Install it and try again.");
      if (error instanceof UsageParseError || error instanceof NoParseableUsageError) program.error("ccusage returned no parseable usage sessions.");
      if (error instanceof UsageCollectionError) program.error("Could not collect usage from ccusage.");
      throw error;
    }
  });

await program.parseAsync();
