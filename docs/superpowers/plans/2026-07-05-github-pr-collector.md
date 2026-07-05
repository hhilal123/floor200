# GitHub PR Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect merged GitHub pull-request metadata through a mockable `gh` CLI boundary and store normalized local records.

**Architecture:** `src/config.ts` reads the nested repository setting with `yaml`. `src/process.ts` wraps external commands, while `src/github.ts` validates and normalizes GitHub output, orchestrates preflights, and writes `.floor200/data/prs.json`; `src/cli.ts` exposes `collect prs`.

**Tech Stack:** TypeScript, Node.js child processes/filesystem, Commander, yaml, Vitest, pnpm, tsup

## Global Constraints

- Invoke GitHub only through `gh`; do not call the GitHub API directly.
- Store compact metadata only: author login, label names, and commit OIDs.
- External commands must be wrapped and injectable; tests must never invoke real commands or networks.
- Require nested `project.repo`; do not support top-level `repo`.
- Do not add a database, ccusage, attribution, or agent-usage collection.

---

### Task 1: Nested configuration schema and reading

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/config.ts`
- Modify: `tests/config.test.ts`

**Interfaces:**
- Produces: nested `project.repo: null` in `serializeDefaultConfig`
- Produces: `readProjectRepo(baseDirectory?: string): Promise<string>`
- Produces: typed missing-config and missing-repository errors

- [ ] Install `yaml` as a runtime dependency.
- [ ] Update tests first for nested serialization, valid config reading, missing file, null/missing repo, invalid owner/repo, and rejection of top-level repo.
- [ ] Run `./node_modules/.bin/vitest run tests/config.test.ts`; expect new tests to fail.
- [ ] Implement YAML parsing and repository validation.
- [ ] Run the focused test; expect all config tests to pass.

### Task 2: Mockable process runner

**Files:**
- Create: `src/process.ts`
- Create: `tests/process.test.ts`

**Interfaces:**
- Produces: `CommandRunner` with `run(command: string, args: string[]): Promise<CommandResult>`
- Produces: `nodeCommandRunner` backed by `execFile`
- Produces: typed command-start and non-zero-exit errors

- [ ] Write tests against an injected `execFile` implementation for argument forwarding, stdout capture, missing executable, and non-zero exit.
- [ ] Run the focused test; expect failure because the module is absent.
- [ ] Implement the bounded, shell-free runner.
- [ ] Run the focused test; expect all process tests to pass.

### Task 3: GitHub fixture parser

**Files:**
- Create: `tests/fixtures/github-pr-list.json`
- Create: `src/github.ts`
- Create: `tests/github.test.ts`

**Interfaces:**
- Produces: `NormalizedPullRequest`
- Produces: `parsePullRequests(json: string): NormalizedPullRequest[]`

- [ ] Add a representative fixture and tests for every requested field, null author, compact label names, compact commit OIDs, and malformed JSON/records.
- [ ] Run `./node_modules/.bin/vitest run tests/github.test.ts`; expect failure because the parser is absent.
- [ ] Implement strict-enough runtime validation and normalization without retaining nested objects.
- [ ] Run the focused test; expect parser tests to pass.

### Task 4: Collector orchestration and storage

**Files:**
- Modify: `src/github.ts`
- Modify: `tests/github.test.ts`

**Interfaces:**
- Consumes: `readProjectRepo`, `CommandRunner`, `parsePullRequests`
- Produces: `collectPullRequests(options?: CollectOptions): Promise<CollectionResult>`

- [ ] Add fake-runner tests for exact command order/arguments, missing `gh`, unauthenticated `gh`, list failure, malformed JSON, stable output path, and no write before successful parsing.
- [ ] Run the focused test; expect collection tests to fail.
- [ ] Implement preflights, exact `gh pr list` invocation, data-directory creation, pretty JSON overwrite, and result count/path.
- [ ] Run the focused test; expect all GitHub tests to pass.

### Task 5: CLI integration and documentation consistency

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`
- Modify: `docs/superpowers/plans/2026-07-05-init-config.md`

**Interfaces:**
- Consumes: `collectPullRequests()` and typed operational errors
- Produces: `floor200 collect prs`

- [ ] Add CLI tests using a fake executable on `PATH` for success and clear configuration/install/authentication failures, with no network access.
- [ ] Run the focused test; expect new CLI tests to fail.
- [ ] Register the nested Commander command and map typed errors to concise messages.
- [ ] Update init-plan examples from top-level `repo` to `project.repo`.
- [ ] Run the focused test; expect all CLI tests to pass.

### Task 6: Acceptance verification

**Files:**
- No source changes expected

**Interfaces:**
- Consumes: complete collector feature
- Produces: verified build, full suite, mock-`gh` CLI run, and repository-state review

- [ ] Run `pnpm build`; expect exit code 0.
- [ ] Run `pnpm test`; expect all tests to pass without real network calls.
- [ ] In a temporary project with a fake `gh` executable, run built `init`, set nested `project.repo`, run `collect prs`, and inspect `.floor200/data/prs.json`.
- [ ] Run `git diff --check` and inspect `git status --short` so existing user changes remain intact.
