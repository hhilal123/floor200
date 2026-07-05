# Local Git Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect privacy-safe local git commit metadata since a validated date and store it in a repository envelope.

**Architecture:** `src/config.ts` exposes a reusable config-presence check. `src/git.ts` owns dates, hashing, fixture parsing, mockable git orchestration, and storage; `src/cli.ts` exposes `collect git` and maps typed failures.

**Tech Stack:** TypeScript, Node.js crypto/filesystem, Git CLI, Commander, Vitest, pnpm, tsup

## Global Constraints

- Store subject-only commit messages and SHA-256 email hashes.
- Store file paths and line counts only; never store contents or diffs.
- External commands must use the injected `CommandRunner`; tests must not invoke real git.
- Default to the local-calendar first day of the current month.
- Do not add a database, ccusage, attribution, agent usage, or network calls.

---

### Task 1: Config presence and date utilities

**Files:**
- Modify: `src/config.ts`
- Modify: `tests/config.test.ts`
- Create: `src/git.ts`
- Create: `tests/git.test.ts`

**Interfaces:**
- Produces: `requireProjectConfig(baseDirectory?: string): Promise<void>`
- Produces: `resolveSinceDate(value?: string, now?: Date): string`
- Produces: `InvalidSinceDateError`

- [ ] Write tests for config presence independent of `project.repo`, current-month defaulting, valid explicit dates, invalid formats, and impossible dates.
- [ ] Run focused config/git tests and confirm failures for missing APIs.
- [ ] Implement the minimum config and date functions.
- [ ] Run focused tests and confirm they pass.

### Task 2: Git fixture parser and hashing

**Files:**
- Create: `tests/fixtures/git-log-numstat.txt`
- Modify: `src/git.ts`
- Modify: `tests/git.test.ts`

**Interfaces:**
- Produces: `hashAuthorEmail(email: string): string`
- Produces: `parseGitLog(output: string, branchName: string): NormalizedCommit[]`
- Produces: `GitLogParseError`

- [ ] Add fixture tests for multiple commits/files, subject-only messages, SHA-256 email hashing, binary numstat, aggregates, empty output, and malformed records.
- [ ] Run focused tests and confirm parser failures.
- [ ] Implement delimiter parsing, immediate email hashing, binary zero counts, and aggregate calculation.
- [ ] Run focused tests and confirm they pass.

### Task 3: Git orchestration and output

**Files:**
- Modify: `src/git.ts`
- Modify: `tests/git.test.ts`

**Interfaces:**
- Produces: `collectGitCommits(options?: CollectGitOptions): Promise<GitCollectionResult>`
- Produces: typed repository and collection errors

- [ ] Add fake-runner tests for exact commands, non-repository failure, optional missing origin, detached HEAD, stable envelope output, and no write before successful parsing.
- [ ] Run focused tests and confirm collector failures.
- [ ] Implement preflight, metadata commands, one formatted log command, parsing, directory creation, JSON overwrite, and summary result.
- [ ] Run focused tests and confirm all git tests pass.

### Task 4: CLI integration

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `collectGitCommits({ since })`
- Produces: `floor200 collect git [--since YYYY-MM-DD]`

- [ ] Add fake-git CLI tests for missing config, non-repository, invalid date, successful default/custom date collection, and summary output.
- [ ] Run focused CLI tests and confirm new tests fail.
- [ ] Register `collect git`, map typed failures to concise messages, and print count/path.
- [ ] Run focused CLI tests and confirm all pass.

### Task 5: Acceptance verification

**Files:**
- No source changes expected

**Interfaces:**
- Consumes: complete local git collector
- Produces: verified build, full suite, built-CLI fake-git collection, and repository-state review

- [ ] Run `pnpm build`; expect exit code 0.
- [ ] Run `pnpm test`; expect all tests to pass without real git or network calls in unit tests.
- [ ] Run the built CLI in a temporary initialized project with a fake git executable and inspect normalized `commits.json`.
- [ ] Run `git diff --check` and inspect `git status --short` to preserve existing user changes.
