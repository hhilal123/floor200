# Init Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `floor200 init` and `floor200 init --force` with predictable local configuration setup.

**Architecture:** `src/config.ts` contains a pure YAML serializer and an injectable filesystem initializer. `src/cli.ts` maps Commander options and known initialization errors to clear terminal output.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Commander, Vitest, pnpm, tsup

## Global Constraints

- Existing `.floor200.yml` without `--force` must exit non-zero and make no changes.
- `--force` overwrites only `.floor200.yml` and preserves `.floor200/` contents.
- Do not add a YAML dependency, collectors, a database, or network calls.
- Keep all storage local and do not collect prompts, source code, secrets, or terminal output.

---

### Task 1: Configuration serializer and initializer

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

**Interfaces:**
- Produces: `serializeDefaultConfig(projectName: string): string`
- Produces: `initializeProject(options?: { baseDirectory?: string; force?: boolean }): Promise<InitResult>`
- Produces: `ConfigAlreadyExistsError`

- [ ] Write tests asserting the complete default YAML, safe project-name quoting, fresh directory creation, refusal before mutation, forced overwrite, and preservation of existing report-directory contents.
- [ ] Run `./node_modules/.bin/vitest run tests/config.test.ts`; expect failure because `src/config.ts` is absent.
- [ ] Implement the pure serializer, specific error, preflight existence check, recursive report-directory creation, config write, and returned paths.
- [ ] Run `./node_modules/.bin/vitest run tests/config.test.ts`; expect all tests to pass.

### Task 2: CLI integration

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `initializeProject({ force })` and `ConfigAlreadyExistsError`
- Produces: `floor200 init [--force]`

- [ ] Add CLI tests for successful initialization, clear next steps, non-zero refusal without mutations, and forced overwrite.
- [ ] Run `./node_modules/.bin/vitest run tests/cli.test.ts`; expect the init tests to fail because the command is absent.
- [ ] Add the Commander command, known-error handling through `program.error`, and concise success/next-step output.
- [ ] Run `./node_modules/.bin/vitest run tests/cli.test.ts`; expect all CLI tests to pass.

### Task 3: Acceptance verification

**Files:**
- No source changes expected

**Interfaces:**
- Consumes: completed initializer and CLI
- Produces: verified build, tests, and local CLI behavior

- [ ] Run `pnpm build`; expect exit code 0.
- [ ] Run `pnpm test`; expect all tests to pass.
- [ ] In an isolated temporary directory, run the built CLI for fresh init, refusal, and forced overwrite; inspect the YAML and expected directories.
- [ ] Run `git diff --check` and inspect `git status --short` to ensure existing user changes remain intact.
