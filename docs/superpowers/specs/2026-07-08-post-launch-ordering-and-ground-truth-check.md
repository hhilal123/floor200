# Post-launch ordering & ground-truth check of v0.2.0 attributions

**Date:** 2026-07-08
**Status:** Approved
**Type:** Product-direction decision + measurement results (docs-only; the session metadata enrichment it motivates is scoped separately)

## Decisions

Three decisions, each confirmed explicitly:

1. **The ground-truth review *tool* is deferred, not next.** With attribution
   volume still small, precision can be measured by hand in one session —
   which we did (results below). The tool earns its existence when
   hook-driven volume makes hand-labeling impractical. It stays on the
   roadmap, gated on volume.
2. **Session metadata enrichment ships before the hook installer.** The
   attribution engine currently infers by time what agent session logs
   already record on disk: Claude Code's session JSONL carries `cwd`,
   `gitBranch`, and per-entry timestamps, and Codex session files open with a
   `session_meta` carrying `cwd` and `git.branch` (both verified locally).
   Reading that metadata directly — never prompt or tool-call content —
   gives definitive project scoping for all agents (kills failure mode 1),
   real session start/end boundaries instead of a `lastActivity` point
   anchor, and the branch each session worked on. Combined with the
   already-collected PR `headRefName`, session-branch ↔ PR-head-branch
   matching resolves adjacent PRs (kills failure mode 2 for branch-per-PR
   workflows). This supersedes the interim idea of merely capping
   no-context sessions at low confidence: instead of labeling scope as
   unverifiable, make it known.
3. **Then the hook installer, unchanged in scope but upgraded in rationale.**
   It is time-sensitive (ccusage reads Claude Code's local JSONL history,
   which is cleaned up after ~30 days — uncaptured sessions are gone
   forever), it fixes the session-boundary problem (F2 in the 2026-07-07
   quality spec) at the source, and it captures per-session changed-file
   paths — the signal quality round 2 needs to disambiguate adjacent PRs.

## Ground-truth pass (2026-07-08)

**Method:** dumped every attributed session from local `.floor200/data/`
(the launch-window dataset, attributed by v0.2.0 logic), cross-checked each
against git/PR history for timing plausibility, then had the user label them
from memory. Metadata only — no prompts or content involved. Per-session
details (spend, models, timestamps, labels) stay local and are deliberately
not reproduced here; this doc records only the qualitative findings.

**Results:** the high-confidence bucket came out error-free, including the
large session the v0.2.0 merge-pair fix was built to rescue. The medium
bucket did not: a meaningful share of its no-repository-context attributions
were confirmed to be **work on a different project**, and a further group of
sessions near two back-to-back PR merges could not be assigned even by the
user from memory.

**Failure mode 1 — cross-project contamination of no-context sessions.**
The scope check (`src/attribution.ts:90`) only excludes sessions whose
project hash *definitively mismatches* the repo. Sessions with no project
hash at all (all non-Claude sources today) pass through and can reach medium
confidence — and this is exactly where every confirmed error sat.
→ Fixed by decision 2 above.

**Failure mode 2 — adjacent PRs are indistinguishable by timing.**
Two PRs merged minutes apart; sessions in that window cannot be assigned by
time alone, and the user couldn't do it from memory either ("we need to be
able to sort this out via our system"). → Resolved by decision 2's
session-branch ↔ PR-head-branch matching for branch-per-PR workflows;
changed-file overlap (hook installer + quality round 2) covers the rest.

**Calibration takeaway:** the confidence *ranking* is honest — every
confirmed error sat in the medium bucket, the high bucket was error-free.
The problem is that "medium" currently mixes "context matched, timing a bit
loose" with "scope unverifiable", and the second kind is where the errors
live. The precision fix separates them.

## Revised post-launch order

1. **Session metadata enrichment** — read `cwd`/branch/boundaries from
   Claude Code and Codex session JSONL (metadata only, bypassing ccusage's
   gaps), and add session-branch ↔ PR-head-branch matching to attribution.
   Gets its own spec/plan cycle; one caution already known: the `branchName`
   stamped on commits at collect time is unreliable (derived from where the
   commit is visible when collected), so PR `headRefName` is the trustworthy
   branch signal.
2. **Claude Code hook installer** — auto-capture sessions as they happen:
   durable beyond JSONL retention (~30 days), per-session changed-file paths
   (the privacy-clean way — hooks record paths without parsing transcript
   content), shrinks the pending-data window.
3. **Ground-truth review tool** — gated on attribution volume making manual
   labeling impractical.
4. **Attribution quality round 2** — changed-file overlap matching and
   friends; gated on measured precision showing it's needed.

## Non-goals (reaffirmed)

Unchanged: no web dashboard, no arbitrary scores, no raw prompts or source
contents stored, no secrets, no real network calls in unit tests. The
ground-truth labels themselves were not persisted as data — only the summary
above.
