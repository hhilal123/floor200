# ccusage Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect privacy-safe local agent usage sessions through a generic adapter boundary with ccusage as adapter one.

**Architecture:** `src/usage.ts` defines normalized types, generic adapter interfaces, defensive parsing, ccusage execution, and storage. `src/cli.ts` adds `collect usage` and maps typed failures.

**Tech Stack:** TypeScript, Node.js crypto/filesystem, existing CommandRunner, Commander, Vitest, pnpm, tsup

## Global Constraints

- Never persist prompts, source contents, raw paths, raw records, or full terminal output.
- Skip malformed records and store only index/reason diagnostics.
- Fail unusable JSON or non-empty input with zero valid records.
- Keep ccusage behind a generic adapter interface.
- Do not add attribution, recommendations, a database, or direct API calls.

---

### Task 1: Generic types and defensive fixture parser

**Files:** Create `src/usage.ts`, `tests/usage.test.ts`, and `tests/fixtures/ccusage-sessions.json`.

- [ ] Write fixture tests for normalized fields, aliases, derived totals/duration, mixed/unknown models, path hashing, skipped reasons, empty input, and unusable input.
- [ ] Run the focused test and confirm missing APIs fail.
- [ ] Implement `UsageAdapter`, normalized types, `parseCcusageSessions`, and typed parse errors.
- [ ] Run the focused test and confirm parser tests pass.

### Task 2: Adapter execution and storage

**Files:** Modify `src/usage.ts` and `tests/usage.test.ts`.

- [ ] Add fake-runner tests for exact commands, missing ccusage, failed collection, stable usage output, safe debug output, stale-debug removal, and no writes before parse success.
- [ ] Run the focused test and confirm failures.
- [ ] Implement the ccusage adapter and generic collector writer.
- [ ] Run the focused test and confirm all usage tests pass.

### Task 3: CLI integration

**Files:** Modify `src/cli.ts` and `tests/cli.test.ts`.

- [ ] Add CLI tests for missing config, missing ccusage, and concise success/warning summary.
- [ ] Run the focused test and confirm failures.
- [ ] Register `collect usage` and map typed errors.
- [ ] Run the focused test and confirm all CLI tests pass.

### Task 4: Verification

- [ ] Run `pnpm build`.
- [ ] Run `pnpm test`.
- [ ] Run the built CLI in a temporary project with a fake ccusage executable and inspect privacy-safe output/debug files.
- [ ] Run `git diff --check` and inspect repository status.
