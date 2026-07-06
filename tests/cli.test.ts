import { spawnSync } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxLoader = createRequire(import.meta.url).resolve("tsx");
const floor200Cli = join(projectRoot, "src", "cli.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function runCli(
  directory: string,
  args: string[],
  environment: NodeJS.ProcessEnv = {},
) {
  return spawnSync(process.execPath, ["--import", tsxLoader, floor200Cli, ...args], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
}

async function createFakeGh(directory: string): Promise<string> {
  const binDirectory = join(directory, "bin");
  const executable = join(binDirectory, "gh");
  await mkdir(binDirectory);
  await writeFile(
    executable,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("gh version 2.80.0");
} else if (args[0] === "auth") {
  process.exit(process.env.FLOOR200_FAKE_AUTH_FAIL === "1" ? 1 : 0);
} else if (args[0] === "pr" && args[1] === "list") {
  process.stdout.write(process.env.FLOOR200_FAKE_PRS ?? "[]");
} else {
  process.exit(2);
}
`,
    "utf8",
  );
  await chmod(executable, 0o755);
  return binDirectory;
}

async function createFakeRunPipelineBin(directory: string): Promise<string> {
  const binDirectory = join(directory, "bin");
  await mkdir(binDirectory, { recursive: true });

  const gitExecutable = join(binDirectory, "git");
  await writeFile(
    gitExecutable,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes("rev-parse")) {
  console.log(process.cwd());
} else if (args.includes("branch")) {
  console.log("main");
} else if (args.includes("remote")) {
  process.exit(1);
} else if (args.includes("log")) {
  process.stdout.write("");
} else {
  process.exit(2);
}
`,
    "utf8",
  );
  await chmod(gitExecutable, 0o755);

  const ccusageExecutable = join(binDirectory, "ccusage");
  await writeFile(
    ccusageExecutable,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("ccusage 1.0.0");
} else if (args[0] === "claude" || args[0] === "session") {
  process.stdout.write("[]");
} else {
  process.exit(2);
}
`,
    "utf8",
  );
  await chmod(ccusageExecutable, 0o755);

  const ghExecutable = join(binDirectory, "gh");
  await writeFile(
    ghExecutable,
    `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("gh version 2.80.0");
} else if (args[0] === "auth") {
  process.exit(process.env.FLOOR200_FAKE_AUTH_FAIL === "1" ? 1 : 0);
} else if (args[0] === "pr" && args[1] === "list") {
  process.stdout.write(process.env.FLOOR200_FAKE_PRS ?? "[]");
} else {
  process.exit(2);
}
`,
    "utf8",
  );
  await chmod(ghExecutable, 0o755);

  return binDirectory;
}

describe("floor200 run", () => {
  it("auto-initializes, collects, attributes, and prints a report in one command", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-run-"));
    temporaryDirectories.push(directory);
    const binDirectory = await createFakeRunPipelineBin(directory);
    const fixture = await readFile(
      join(projectRoot, "tests", "fixtures", "github-pr-list.json"),
      "utf8",
    );

    const result = runCli(directory, ["run"], {
      PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
      FLOOR200_FAKE_PRS: fixture,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No .floor200.yml found");
    expect(result.stdout).toContain("Floor200 — AI Coding ROI Report");
    await expect(
      access(join(directory, ".floor200", "data", "attributions.json")),
    ).resolves.toBeUndefined();
  });

  it("warns and continues when gh is unauthenticated, still producing a report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-run-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: "acme/example"\n',
      "utf8",
    );
    const binDirectory = await createFakeRunPipelineBin(directory);

    const result = runCli(directory, ["run"], {
      PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
      FLOOR200_FAKE_AUTH_FAIL: "1",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("GitHub CLI is not authenticated");
    expect(result.stdout).toContain("Floor200 — AI Coding ROI Report");
    expect(
      JSON.parse(
        await readFile(join(directory, ".floor200", "data", "prs.json"), "utf8"),
      ),
    ).toEqual([]);
  });
});

describe("floor200 export", () => {
  it.each([
    ["md", "demo-report.md"],
    ["json", "demo-report.json"],
  ])("exports demo data as %s", async (format, filename) => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-"));
    temporaryDirectories.push(directory);

    const result = runCli(directory, ["export", "--demo", "--format", format]);
    const outputPath = join(directory, ".floor200", "reports", filename);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(join(".floor200", "reports", filename));
    expect(await readFile(outputPath, "utf8")).not.toHaveLength(0);
  });

  it("rejects export without demo mode", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-"));
    temporaryDirectories.push(directory);

    const result = runCli(directory, ["export", "--format", "md"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "The first version only supports: floor200 export --demo",
    );
  });

  it("rejects an unsupported export format", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-"));
    temporaryDirectories.push(directory);

    const result = runCli(directory, [
      "export",
      "--demo",
      "--format",
      "csv",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Unsupported format "csv". Use "md" or "json".',
    );
  });
});

describe("floor200 init", () => {
  it("initializes the current project and prints next steps", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-init-"));
    temporaryDirectories.push(directory);

    const result = runCli(directory, ["init"]);

    expect(result.status).toBe(0);
    expect(await readFile(join(directory, ".floor200.yml"), "utf8")).toContain(
      `name: ${JSON.stringify(basename(directory))}`,
    );
    await expect(
      access(join(directory, ".floor200", "reports")),
    ).resolves.toBeUndefined();
    expect(result.stdout).toContain("Floor200 initialized");
    expect(result.stdout).toContain("Next steps");
  });

  it("refuses an existing config without changing the project", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-init-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, ".floor200.yml");
    await writeFile(configPath, "existing: true\n", "utf8");

    const result = runCli(directory, ["init"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Configuration already exists. Use --force to overwrite it.",
    );
    expect(await readFile(configPath, "utf8")).toBe("existing: true\n");
    await expect(access(join(directory, ".floor200"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("force overwrites an existing config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-init-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, ".floor200.yml");
    await writeFile(configPath, "existing: true\n", "utf8");

    const result = runCli(directory, ["init", "--force"]);

    expect(result.status).toBe(0);
    expect(await readFile(configPath, "utf8")).toContain("provider: github");
  });
});

describe("floor200 collect prs", () => {
  it("fails clearly when configuration is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-prs-"));
    temporaryDirectories.push(directory);

    const result = runCli(directory, ["collect", "prs"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Configuration not found. Run floor200 init first.",
    );
  });

  it("fails clearly when project.repo is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-prs-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: null\n',
      "utf8",
    );

    const result = runCli(directory, ["collect", "prs"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Set project.repo in .floor200.yml using the owner/repo format.",
    );
  });

  it("fails clearly when gh is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-prs-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: "acme/example"\n',
      "utf8",
    );

    const result = runCli(directory, ["collect", "prs"], { PATH: directory });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "GitHub CLI (gh) is required. Install it and try again.",
    );
  });

  it("fails clearly when gh is unauthenticated", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-prs-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: "acme/example"\n',
      "utf8",
    );
    const binDirectory = await createFakeGh(directory);

    const result = runCli(directory, ["collect", "prs"], {
      PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
      FLOOR200_FAKE_AUTH_FAIL: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "GitHub CLI is not authenticated. Run gh auth login first.",
    );
  });

  it("collects normalized PRs and prints a short summary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-prs-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: "acme/example"\n',
      "utf8",
    );
    const binDirectory = await createFakeGh(directory);
    const fixture = await readFile(
      join(projectRoot, "tests", "fixtures", "github-pr-list.json"),
      "utf8",
    );

    const result = runCli(directory, ["collect", "prs"], {
      PATH: `${binDirectory}:${process.env.PATH ?? ""}`,
      FLOOR200_FAKE_PRS: fixture,
    });
    const outputPath = join(directory, ".floor200", "data", "prs.json");
    const records = JSON.parse(await readFile(outputPath, "utf8"));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Collected 2 merged pull requests");
    expect(result.stdout).toContain(join(".floor200", "data", "prs.json"));
    expect(records[0].author).toBe("avery");
    expect(records[0].labels).toEqual(["feature", "agent-assisted"]);
    expect(records[0].commits).toEqual(["abc123", "def456"]);
    expect(records[0]).not.toHaveProperty("author.login");
  });
});

describe("floor200 collect git", () => {
  it("fails clearly when configuration is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-git-"));
    temporaryDirectories.push(directory);
    const result = runCli(directory, ["collect", "git"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Configuration not found. Run floor200 init first.");
  });

  it("rejects an invalid since date", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-git-"));
    temporaryDirectories.push(directory);
    const result = runCli(directory, ["collect", "git", "--since", "2026-02-30"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Use --since YYYY-MM-DD with a valid calendar date.");
  });
});

describe("floor200 collect usage", () => {
  it("fails clearly when configuration is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-usage-"));
    temporaryDirectories.push(directory);
    const result = runCli(directory, ["collect", "usage"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Configuration not found. Run floor200 init first.");
  });
});

describe("floor200 status", () => {
  it("reports config, git, ccusage, and data file status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-status-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, ".floor200.yml"), "project:\n  repo: null\n");
    await mkdir(join(directory, ".floor200", "data"), { recursive: true });
    await writeFile(join(directory, ".floor200", "data", "commits.json"), "[]");
    spawnSync("git", ["init"], { cwd: directory });

    const result = runCli(directory, ["status"], { PATH: process.env.PATH ?? "" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Config found: yes");
    expect(result.stdout).toContain("Git repository detected: yes");
    expect(result.stdout).toContain("  commits.json: yes");
    expect(result.stdout).toContain("  prs.json: no");
  });

  it("reports missing config and data outside a project", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-status-"));
    temporaryDirectories.push(directory);

    const result = runCli(directory, ["status"], { PATH: "" });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Config found: no");
    expect(result.stdout).toContain("Git repository detected: no");
    expect(result.stdout).toContain("ccusage available: no");
  });
});

describe("floor200 attribute", () => {
  it("fails clearly when required data is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-attribute-"));
    temporaryDirectories.push(directory);
    const result = runCli(directory, ["attribute"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing or malformed attribution input: usage.json");
  });
});

describe("floor200 report", () => {
  it("still prints the demo report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-report-"));
    temporaryDirectories.push(directory);
    const result = runCli(directory, ["report", "--demo"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Floor200 — AI Coding ROI Report");
  });

  it("fails clearly when attributions.json is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-report-"));
    temporaryDirectories.push(directory);
    const result = runCli(directory, ["report"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing or malformed ROI report input: attributions.json");
  });

  it("prints a real ROI report computed from attributions.json", async () => {
    const directory = await mkdtemp(join(tmpdir(), "floor200-cli-report-"));
    temporaryDirectories.push(directory);
    const dataDirectory = join(directory, ".floor200", "data");
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(
      join(dataDirectory, "attributions.json"),
      JSON.stringify([
        {
          sessionId: "a", source: "claude", model: "claude-opus", commitSha: "abc", prNumber: 1,
          confidence: "high", confidenceScore: 0.9, method: "time+pr-commit", explanation: "matched",
          estimatedCostUsd: 10, sessionStartedAt: "2026-07-01T10:00:00Z",
          commitCommittedAt: "2026-07-01T11:00:00Z", prMergedAt: "2026-07-01T12:00:00Z", inScope: true,
        },
        {
          sessionId: "b", source: "claude", model: "claude-opus", commitSha: null, prNumber: null,
          confidence: "unknown", confidenceScore: 0, method: "unattributed", explanation: "no match",
          estimatedCostUsd: 5, sessionStartedAt: "2026-07-02T10:00:00Z",
          commitCommittedAt: null, prMergedAt: null, inScope: true,
        },
      ]),
    );

    const result = runCli(directory, ["report"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Floor200 — AI Coding ROI Report");
    expect(result.stdout).toContain("$10.00");
    expect(result.stdout).toContain("Review attributed PRs to validate whether timing-based attribution matches reality.");
  });
});
