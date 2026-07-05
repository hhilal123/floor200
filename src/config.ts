import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse } from "yaml";

export interface InitOptions {
  baseDirectory?: string;
  force?: boolean;
}

export interface InitResult {
  configPath: string;
  dataDirectory: string;
  reportsDirectory: string;
}

export class ConfigAlreadyExistsError extends Error {
  constructor(readonly configPath: string) {
    super(`Configuration already exists at ${configPath}`);
    this.name = "ConfigAlreadyExistsError";
  }
}

export class MissingConfigError extends Error {
  constructor(readonly configPath: string) {
    super(`Configuration not found at ${configPath}`);
    this.name = "MissingConfigError";
  }
}

export class InvalidConfigError extends Error {
  constructor(readonly configPath: string) {
    super(`Configuration is invalid at ${configPath}`);
    this.name = "InvalidConfigError";
  }
}

export class MissingProjectRepoError extends Error {
  constructor() {
    super("project.repo is not configured");
    this.name = "MissingProjectRepoError";
  }
}

export class InvalidProjectRepoError extends Error {
  constructor(readonly repo: string) {
    super(`project.repo must use the owner/repo format: ${repo}`);
    this.name = "InvalidProjectRepoError";
  }
}

export function serializeDefaultConfig(projectName: string): string {
  return `project:
  name: ${JSON.stringify(projectName)}
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
`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readProjectRepo(
  baseDirectory = process.cwd(),
): Promise<string> {
  const configPath = join(baseDirectory, ".floor200.yml");
  let contents: string;

  try {
    contents = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new MissingConfigError(configPath);
    }

    throw error;
  }

  let config: unknown;
  try {
    config = parse(contents);
  } catch {
    throw new InvalidConfigError(configPath);
  }

  const project = isRecord(config) && isRecord(config.project)
    ? config.project
    : undefined;
  const repo = project?.repo;

  if (typeof repo !== "string" || repo.trim() === "") {
    throw new MissingProjectRepoError();
  }

  const normalizedRepo = repo.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]+$/.test(normalizedRepo)) {
    throw new InvalidProjectRepoError(normalizedRepo);
  }

  return normalizedRepo;
}

export async function requireProjectConfig(
  baseDirectory = process.cwd(),
): Promise<void> {
  const configPath = join(baseDirectory, ".floor200.yml");
  try {
    await access(configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new MissingConfigError(configPath);
    }
    throw error;
  }
}

async function configExists(configPath: string): Promise<boolean> {
  try {
    await access(configPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function initializeProject(
  options: InitOptions = {},
): Promise<InitResult> {
  const baseDirectory = options.baseDirectory ?? process.cwd();
  const configPath = join(baseDirectory, ".floor200.yml");
  const dataDirectory = join(baseDirectory, ".floor200");
  const reportsDirectory = join(dataDirectory, "reports");

  if (!options.force && (await configExists(configPath))) {
    throw new ConfigAlreadyExistsError(configPath);
  }

  await mkdir(reportsDirectory, { recursive: true });
  await writeFile(
    configPath,
    serializeDefaultConfig(basename(baseDirectory)),
    "utf8",
  );

  return { configPath, dataDirectory, reportsDirectory };
}
