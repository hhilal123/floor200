# Attribution Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one transparent, conservative attribution record per usage session from normalized usage, commit, and PR metadata.

**Architecture:** `src/attribution.ts` contains a pure deterministic engine plus validated file orchestration. `src/cli.ts` exposes `attribute` and reports confidence/ROI-eligible counts.

**Tech Stack:** TypeScript, Node.js crypto/filesystem, Commander, Vitest, pnpm, tsup

## Global Constraints

- Confidence score is time proximity, not probability.
- Only high/medium PR-backed records are ROI eligible.
- Ambiguous, mismatched, and unmatched sessions remain unknown.
- Every record includes a human-readable explanation.
- Store normalized metadata only; no prompts or source contents.

---

### Task 1: Pure attribution engine

**Files:** Create `src/attribution.ts` and `tests/attribution.test.ts`.

- [ ] Write failing unit tests for high, medium, low, no-match unknown, repository mismatch, missing-path cap, 15-minute ambiguity, PR evidence over 8 hours, exact SHA matching, score calculation, and session preservation.
- [ ] Run the focused test and confirm missing APIs fail.
- [ ] Implement normalized attribution types and `attributeSessions` with exact approved rules and explanations.
- [ ] Run the focused test and confirm all pure-engine tests pass.

### Task 2: Input validation and file output

**Files:** Modify `src/attribution.ts` and `tests/attribution.test.ts`.

- [ ] Write failing tests for missing/malformed usage, commits, and PR files plus stable `attributions.json` output and summary counts.
- [ ] Implement `runAttribution({ baseDirectory? })` with defensive validation and write-after-success behavior.
- [ ] Run the focused test and confirm all attribution tests pass.

### Task 3: CLI integration

**Files:** Modify `src/cli.ts` and `tests/cli.test.ts`.

- [ ] Write failing CLI tests for missing input and readable success summary.
- [ ] Register `floor200 attribute`, map typed input errors, and report confidence plus ROI-eligible counts.
- [ ] Run focused CLI tests and confirm they pass.

### Task 4: Verification

- [ ] Run `pnpm build` and `pnpm test`.
- [ ] Run the built CLI against local collected metadata and inspect conservative output.
- [ ] Run `git diff --check` and inspect repository status.
