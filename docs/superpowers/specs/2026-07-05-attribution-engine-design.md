# Attribution Engine v1 Design

## Goal

Add `floor200 attribute` to conservatively link usage sessions to local commits and merged pull requests using deterministic, human-readable evidence.

## Principles

Attribution is an evidence estimate, not proof. The engine emits one record per usage session, preserves unmatched sessions, uses no learned model or opaque weights, and never converts weak evidence into merged-PR ROI.

`confidenceScore` is only a time-proximity score: `max(0, 1 - deltaHours / 24)`. It is not a probability.

## Evidence flow

The session anchor is `endedAt` when valid, otherwise `startedAt`. The engine hashes the commits envelope’s repository root and compares it with `projectPathHash` when present. A mismatch produces `unknown`. Missing usage path context permits matching but caps PR-backed confidence at `medium`.

Only commits occurring from zero through 24 hours after the session anchor are eligible. Candidates are ordered by time delta. If the two nearest candidate deltas differ by 15 minutes or less, the result is `unknown` and the explanation explicitly states that attribution was withheld because the nearest candidates were ambiguous.

Otherwise, only the nearest commit is selected. Pull requests are indexed by exact commit SHA membership.

## Confidence rules

- `high`: nearest commit is at most 2 hours after the anchor, belongs to a merged PR, and repository context matches.
- `medium`: nearest commit is at most 8 hours after the anchor and belongs to a merged PR. Missing repository context caps otherwise-high evidence here.
- `low`: nearest commit is at most 24 hours after the anchor but has no merged-PR evidence.
- `unknown`: no eligible commit, repository mismatch, ambiguous candidates, or PR-backed timing weaker than 8 hours.

Only high/medium PR-backed matches contribute to merged-PR ROI and future cost-per-merged-PR metrics. Low commit-only matches never do.

## Output

`.floor200/data/attributions.json` is a pretty-printed array with one record per session. Each record contains session/source/model/cost/timestamps, nullable commit and PR evidence, confidence, time-proximity score, method, and a plain-language explanation.

Methods are `time+pr-commit`, `time-only`, and `unattributed`. Unknown records use nullable evidence fields when no commit was selected and a score of zero when no time delta is retained.

## Components

`src/attribution.ts` owns input validation, pure matching, explanations, file loading, and output writing. `src/cli.ts` registers `attribute`, maps missing/malformed file errors, and prints confidence counts plus a separate PR-backed ROI-eligible count.

## Testing

Unit tests cover high, medium, low, unknown/no-match, repository mismatch, missing path context, 15-minute ambiguity, PR timing over 8 hours, score calculation, exact SHA membership, and preservation of every session. File/CLI tests cover missing inputs, stable output, and summary eligibility.

## Privacy and scope

The engine stores only already-normalized metadata. It adds no prompts, source content, database, recommendations, hooks, web dashboard, or invented contributor evidence.
