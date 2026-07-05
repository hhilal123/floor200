import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigAlreadyExistsError,
  InvalidConfigError,
  InvalidProjectRepoError,
  MissingConfigError,
  MissingProjectRepoError,
  requireProjectConfig,
  initializeProject,
  readProjectRepo,
  serializeDefaultConfig,
} from "../src/config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function temporaryProject(name = "floor200-test"): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "floor200-init-"));
  const directory = join(parent, name);
  temporaryDirectories.push(parent);
  await mkdir(directory);
  return directory;
}

describe("serializeDefaultConfig", () => {
  it("serializes every privacy-safe default", () => {
    expect(serializeDefaultConfig("floor200")).toBe(`project:
  name: "floor200"
  repo: null
provider: github
season:
  mode: monthly
privacy:
  collectPrompts: false
  collectSourceCode: false
  hashEmails: true
sources:
  github:
    enabled: false
  git:
    enabled: true
  ccusage:
    enabled: false
`);
  });

  it("quotes inferred project names safely", () => {
    expect(serializeDefaultConfig('team: "api"')).toContain(
      'name: "team: \\"api\\""',
    );
  });
});

describe("readProjectRepo", () => {
  it("reads a nested owner/repo value", async () => {
    const directory = await temporaryProject();
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: "openai/codex"\n',
      "utf8",
    );

    await expect(readProjectRepo(directory)).resolves.toBe("openai/codex");
  });

  it("fails clearly when configuration is missing", async () => {
    const directory = await temporaryProject();

    await expect(readProjectRepo(directory)).rejects.toBeInstanceOf(
      MissingConfigError,
    );
  });

  it("requires project.repo and rejects the old top-level field", async () => {
    const directory = await temporaryProject();
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\nrepo: "openai/codex"\n',
      "utf8",
    );

    await expect(readProjectRepo(directory)).rejects.toBeInstanceOf(
      MissingProjectRepoError,
    );
  });

  it("rejects an invalid repository name", async () => {
    const directory = await temporaryProject();
    await writeFile(
      join(directory, ".floor200.yml"),
      'project:\n  name: "example"\n  repo: "not-a-repo"\n',
      "utf8",
    );

    await expect(readProjectRepo(directory)).rejects.toBeInstanceOf(
      InvalidProjectRepoError,
    );
  });

  it("rejects malformed YAML", async () => {
    const directory = await temporaryProject();
    await writeFile(
      join(directory, ".floor200.yml"),
      "project: [unterminated\n",
      "utf8",
    );

    await expect(readProjectRepo(directory)).rejects.toBeInstanceOf(
      InvalidConfigError,
    );
  });
});

describe("requireProjectConfig", () => {
  it("accepts config without project.repo", async () => {
    const directory = await temporaryProject();
    await writeFile(join(directory, ".floor200.yml"), "project:\n  repo: null\n");
    await expect(requireProjectConfig(directory)).resolves.toBeUndefined();
  });

  it("rejects a missing config", async () => {
    const directory = await temporaryProject();
    await expect(requireProjectConfig(directory)).rejects.toBeInstanceOf(
      MissingConfigError,
    );
  });
});

describe("initializeProject", () => {
  it("creates the config and report directories", async () => {
    const directory = await temporaryProject("sample-project");

    const result = await initializeProject({ baseDirectory: directory });

    expect(result.configPath).toBe(join(directory, ".floor200.yml"));
    expect(result.dataDirectory).toBe(join(directory, ".floor200"));
    expect(result.reportsDirectory).toBe(
      join(directory, ".floor200", "reports"),
    );
    expect(await readFile(result.configPath, "utf8")).toContain(
      'name: "sample-project"',
    );
    await expect(access(result.reportsDirectory)).resolves.toBeUndefined();
  });

  it("refuses an existing config before making changes", async () => {
    const directory = await temporaryProject();
    const configPath = join(directory, ".floor200.yml");
    await writeFile(configPath, "existing: true\n", "utf8");

    await expect(
      initializeProject({ baseDirectory: directory }),
    ).rejects.toBeInstanceOf(ConfigAlreadyExistsError);
    expect(await readFile(configPath, "utf8")).toBe("existing: true\n");
    await expect(access(join(directory, ".floor200"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("force overwrites the config and preserves data-directory contents", async () => {
    const directory = await temporaryProject("forced-project");
    const configPath = join(directory, ".floor200.yml");
    const reportsDirectory = join(directory, ".floor200", "reports");
    const existingReport = join(reportsDirectory, "existing.md");
    await mkdir(reportsDirectory, { recursive: true });
    await writeFile(configPath, "existing: true\n", "utf8");
    await writeFile(existingReport, "keep me", "utf8");

    await initializeProject({ baseDirectory: directory, force: true });

    expect(await readFile(configPath, "utf8")).toContain(
      'name: "forced-project"',
    );
    expect(await readFile(existingReport, "utf8")).toBe("keep me");
  });
});
