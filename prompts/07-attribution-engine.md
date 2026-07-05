Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add attribution v1.

Floor200 currently has:
- .floor200/data/usage.json
- .floor200/data/commits.json
- .floor200/data/prs.json

Implement:
- floor200 attribute
- reads usage, commits, and PR data
- links agent sessions to commits/PRs using transparent heuristics
- writes .floor200/data/attributions.json
- prints a short attribution summary

Do not add recommendations yet.
Do not add database yet.
Do not add Claude hooks yet.
Do not add web dashboard.

Attribution logic v1:

1. Same repo/source window:
   - only consider sessions and commits/PRs in the same project context when possible
   - if repo path hash is unavailable, allow matching but lower confidence

2. Time-window match:
   - match sessions to commits that happen after the session timestamp
   - default window: 24 hours
   - closer commits should score higher

3. PR commit match:
   - if a commit SHA appears in a merged PR’s commits array, link that session to the PR through the commit

4. Author/contributor signal:
   - if commit author hash is available and usage export has contributor hash later, support it
   - for now, do not require contributor matching

5. Confidence levels:
   - high: strong time match + commit appears in merged PR
   - medium: weaker time match + commit appears in merged PR
   - low: plausible time match but limited supporting metadata
   - unknown: no reasonable match

Normalized attribution shape:
- sessionId
- source
- model
- commitSha
- prNumber
- confidence
- confidenceScore
- method
- explanation
- estimatedCostUsd
- sessionStartedAt
- commitCommittedAt
- prMergedAt

Important:
- Every attribution must include a human-readable explanation.
- Do not pretend attribution is perfect.
- Do not assign sessions to PRs if evidence is too weak.
- Unmatched sessions should be preserved in the output as abandoned/unattributed candidates.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 attribute fails clearly if required data files are missing
- floor200 attribute writes .floor200/data/attributions.json
- attribution has unit tests for high, medium, low, and unknown cases
- no raw prompts or source code are stored
