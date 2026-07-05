# Demo Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the demo ROI report as stable Markdown and JSON files from the Floor200 CLI.

**Architecture:** Pure serializers in `src/export.ts` build export content from `DemoData` and `deriveMetrics()`. A small async filesystem boundary in the same focused module creates the output directory and overwrites the selected stable file; `src/cli.ts` only handles command options and user-facing errors.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Commander, Vitest, pnpm, tsup

## Global Constraints

- Write only `.floor200/reports/demo-report.md` and `.floor200/reports/demo-report.json` for this feature.
- Overwrite stable filenames on every run.
- Accept only demo data and the exact formats `md` and `json`.
- Reuse `deriveMetrics()` for terminal/export calculation consistency.
- Do not add collectors, a database, or network calls.

---

### Task 1: Pure export serializers

**Files:**
- Create: `src/export.ts`
- Create: `tests/export.test.ts`

**Interfaces:**
- Consumes: `DemoData`, `SpendBreakdown`, and `deriveMetrics(data: DemoData): DerivedMetrics`
- Produces: `serializeMarkdown(data: DemoData): string` and `serializeJson(data: DemoData): string`

- [ ] **Step 1: Write failing serializer tests**

Test that Markdown contains the title, summary calculations, all breakdown headings, confidence, and recommendations. Test that parsed JSON has exact `summary`, `models`, `contributors`, `repos`, and `recommendations` values, including derived cost per merge and a `null` cost for zero-merge rows.

- [ ] **Step 2: Verify serializer tests fail**

Run: `pnpm test -- tests/export.test.ts`

Expected: FAIL because `src/export.ts` does not exist.

- [ ] **Step 3: Implement minimal pure serializers**

Create exported serializer functions. Use `deriveMetrics()` once per serialization, map breakdown rows without mutation, render professional Markdown tables, and emit pretty-printed JSON with a trailing newline.

- [ ] **Step 4: Verify serializer tests pass**

Run: `pnpm test -- tests/export.test.ts`

Expected: all serializer tests PASS.

### Task 2: Stable local file writer

**Files:**
- Modify: `src/export.ts`
- Modify: `tests/export.test.ts`

**Interfaces:**
- Consumes: `serializeMarkdown`, `serializeJson`, Node filesystem promises, an optional base directory
- Produces: `ExportFormat = "md" | "json"` and `exportDemoReport(data: DemoData, format: ExportFormat, baseDirectory?: string): Promise<string>`

- [ ] **Step 1: Write failing filesystem tests**

Use a temporary directory to verify directory creation, exact stable filenames, correct content, and overwrite behavior without writing to the repository.

- [ ] **Step 2: Verify filesystem tests fail**

Run: `pnpm test -- tests/export.test.ts`

Expected: FAIL because `exportDemoReport` is missing.

- [ ] **Step 3: Implement the writer**

Resolve `<baseDirectory>/.floor200/reports`, create it recursively, choose the serializer and stable filename from the format, write UTF-8 content, and return the output path.

- [ ] **Step 4: Verify export tests pass**

Run: `pnpm test -- tests/export.test.ts`

Expected: all export tests PASS.

### Task 3: CLI export command

**Files:**
- Modify: `src/cli.ts`
- Create: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `exportDemoReport(demoData, format)`
- Produces: `floor200 export --demo --format md|json`

- [ ] **Step 1: Write failing CLI tests**

Run the source CLI in isolated temporary working directories. Verify successful Markdown/JSON writes and clear failures for missing `--demo` and unsupported formats.

- [ ] **Step 2: Verify CLI tests fail**

Run: `pnpm test -- tests/cli.test.ts`

Expected: FAIL because the `export` command is unknown.

- [ ] **Step 3: Implement Commander integration**

Add the `export` command with `--demo` and required `--format <format>`. Validate demo mode and the `md|json` union before calling the writer. Print the relative output path after success.

- [ ] **Step 4: Verify CLI tests pass**

Run: `pnpm test -- tests/cli.test.ts`

Expected: all CLI tests PASS.

### Task 4: Full acceptance verification

**Files:**
- No source changes expected

**Interfaces:**
- Consumes: completed CLI and export module
- Produces: verified build, test suite, and two local export artifacts

- [ ] **Step 1: Run build and tests**

Run: `pnpm build` and `pnpm test`

Expected: both exit successfully with no TypeScript or test failures.

- [ ] **Step 2: Run requested CLI acceptance commands**

Run: `./node_modules/.bin/tsx src/cli.ts export --demo --format md` and `./node_modules/.bin/tsx src/cli.ts export --demo --format json`.

Expected: both exit successfully and create the exact stable files beneath `.floor200/reports/`.

- [ ] **Step 3: Inspect artifacts and repository status**

Confirm exported values match `deriveMetrics(demoData)`, output is readable, and only intended source/test/doc changes are present. Remove generated acceptance artifacts so they are not committed.
