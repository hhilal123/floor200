# Attribution quality iteration — v1 critique and fix plan

## Context

Roadmap item #1 post-launch: attribution is a conservative v1 (nearest-commit time matching) and "the report is only as credible as its attributions." I ran a hyper-critical review against the real collected data in `.floor200/data/` (283 sessions, 20 commits, 6 PRs from the launch push on 2026-07-05/06).

**Result: attribution coverage is effectively zero.** Of 28 in-scope sessions ($70.40 total spend), only 4 got any attribution (1 high, 3 low), only **1 session ($0.33) is ROI-eligible**, and $68.51 sits unattributed. The report is honest but built on 0.5% of in-scope spend — useless as a credibility pitch.

## Root-cause findings (from real data, not speculation)

**F1 — The 15-minute ambiguity guard is killed by the merge-commit workflow (14/28 sessions).**
Every PR merge in this repo produces a branch commit and a merge commit seconds apart (e.g. commits at `19:53:20` and `19:53:33`). The guard in `src/attribution.ts:80` treats them as two *competing* candidates and refuses to attribute — but they're the same unit of work, and a merge pair is the *strongest* possible signal (a PR just merged). The $26.90 session (biggest in the dataset) was killed by two commits 13 seconds apart. PRs merged back-to-back (#2/#3 merged 17s apart) also collide.

**F2 — Sessions are point events anchored at `lastActivity`, and `delta >= 0` excludes commits made *during* the session.**
`src/usage.ts:60-63`: ccusage only exposes `lastActivity`, so `startedAt === endedAt` for every session and `durationMs` is null. Attribution then only considers commits *after* that anchor (`src/attribution.ts:75`). In agentic workflows the commits happen mid-session, i.e. *before* last activity — the strongest evidence is categorically excluded.

**F3 — Right-censoring: the most recent work can never be attributed (10/28 sessions).**
All 10 "no commit within 24 hours after" failures are sessions from the morning of 2026-07-06; their commits landed *after* `collect git` ran at 12:07Z. These aren't attribution failures — the evidence didn't exist yet at collection time. They're reported identically to genuine failures, inflating the unattributed number and eroding trust. Re-running the pipeline later would fix them, but nothing tells the user that.

**F4 — `confidenceScore` contradicts the confidence label.** A commit 0.01h away with no PR scores 0.9996 but is labeled "low" (`src/attribution.ts:85,91-93`). Two signals, one number — misleading.

**F5 — PR collector doesn't capture `mergeCommitSha`** (`prs.json` has only branch commits), which is what makes F1 unfixable with current data: the merge commit can't be tied back to its PR.

## Fix plan (in order)

### 1. PR-aware candidate grouping (fixes F1) — `src/attribution.ts`, `src/github.ts`
- Collect `mergeCommitSha` in the PR collector (`gh pr list` json field `mergeCommit`) and add it to `NormalizedPullRequest`; map it into `prByCommit` alongside branch commits.
- Before the ambiguity check, group candidate commits by the PR they resolve to (merge commit + branch commits of the same PR = one candidate unit; PR-less commits stay singleton units). Ambiguity now only fires when the two nearest *units* are within 15 minutes — two commits agreeing on the same PR is corroboration, not ambiguity.
- Attribute to the earliest commit in the winning unit (keeps `commitSha` meaningful), with the PR number from the unit.

### 2. Backward-looking match window (fixes F2) — `src/attribution.ts`, config
- Widen the eligible window to `[anchor − lookbackMs, anchor + WINDOW]`. A commit *before* the anchor (during the session) is stronger evidence than one after, so it should not lower confidence — if anything the confidence rules stay the same, keyed on `|delta|` distance with the existing 2h/8h thresholds.
- Make the windows tunable per the roadmap: `attribution.lookbackHours` (default 2), `attribution.windowHours` (default 24), `attribution.ambiguityMinutes` (default 15) in the existing config (`src/config.ts`), read by `runAttribution` and passed to `attributeSessions`. Defaults preserve current behavior except the new lookback.

### 3. Distinguish "pending" from "unattributed" (fixes F3) — `src/attribution.ts`, `src/roi-report.ts`, `src/report.ts`
- Record the collection timestamp (newest commit time in `commits.json` is a usable proxy; prefer an explicit `collectedAt` field written by `collect git` in `src/git.ts`).
- If a session found no candidate AND its anchor is later than `collectedAt − windowHours`, emit method `"pending-data"` with confidence `"unknown"` and an explanation saying evidence may not have landed/been collected yet (satisfies the "explicit confidence" non-negotiable).
- Report: show pending spend as its own line ("re-run `floor200 run` later to resolve"), excluded from the unattributed-failure framing.

### 4. Reconcile `confidenceScore` with the label (fixes F4) — `src/attribution.ts`
- Cap the score by method: time-only evidence caps at the low band (e.g. ≤ 0.4); keep the time-decay shape within each band. Small change, keeps score ordering meaningful.

### Non-goals (this iteration)
- No codex/other-agent scoping (blocked on ccusage exposing it).
- No richer signals beyond commit/PR timing (diff-content matching etc.) — separate iteration.
- No change to the privacy posture: still no raw prompts, no source contents.

## Files touched
`src/attribution.ts` (core), `src/github.ts` (+`mergeCommitSha`), `src/git.ts` (+`collectedAt`), `src/config.ts` (tunables), `src/roi-report.ts` + `src/report.ts` (pending line), `src/types.ts` if shared types live there; matching unit tests (all external calls already mocked via `CommandRunner`).

## Verification
- TDD per repo skill: fixture tests reproducing each real-data failure first — a merge-pair fixture (two commits 13s apart, one PR) must attribute; a mid-session commit fixture must attribute via lookback; a fresh-session fixture must come out `pending-data`.
- `pnpm build && pnpm test` green.
- End-to-end on real data: re-run `floor200 collect prs && floor200 collect git && floor200 attribute && floor200 report` in this repo and compare against the baseline captured above (1 attributed / $0.33 eligible). Success = the launch-day sessions (esp. the $26.90 one) attribute to their PRs with sensible confidence, and coverage of in-scope spend rises from ~0.5% to a clearly meaningful share, with pending sessions labeled as such.
