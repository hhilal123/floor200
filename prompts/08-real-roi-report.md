Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add a real ROI report command using collected Floor200 data.

Current data files:
- .floor200/data/usage.json
- .floor200/data/commits.json
- .floor200/data/prs.json
- .floor200/data/attributions.json

Implement:
- floor200 report
- reads the real collected data files
- computes transparent ROI metrics
- prints a concise terminal report
- optionally writes markdown/json later, but not required in this step

Do not add new collectors.
Do not add database.
Do not add Claude hooks.
Do not add arbitrary scores or awards.

Metrics to compute:
- total sessions analyzed
- total estimated spend
- attributed spend
- unattributed spend
- waste rate = unattributed spend / total estimated spend
- PR-backed attributed sessions
- unique attributed merged PRs
- cost per attributed merged PR = attributed spend / unique attributed merged PRs
- spend by model
- attributed spend by model
- unattributed spend by model
- high/medium/low/unknown attribution counts
- top 5 most expensive unattributed sessions

Definitions:
- attributed spend = spend from high or medium confidence attributions with a prNumber
- unattributed spend = all other session spend
- PR-backed attributed sessions = high or medium attributions with a prNumber
- low confidence commit-only matches should not count as merged-PR ROI
- unknown sessions should count as unattributed

Report should include a recommendations section.

Initial recommendation rules:
1. If waste rate > 0.5:
   - "Most spend is currently unattributed. Improve repo/session tracking before using this as a team ROI source."
2. If attributed merged PRs > 0:
   - "Review attributed PRs to validate whether timing-based attribution matches reality."
3. If top unattributed sessions are expensive:
   - "Investigate high-cost sessions with no nearby commit or merged PR."
4. If one model has much lower cost per attributed PR than another:
   - mention that as a possible efficiency signal, but say sample size may be small.

Output tone:
Professional, clear, slightly sharp.
No game jargon.
No arbitrary score.
No awards.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 report fails clearly if required data files are missing
- floor200 report prints the metrics above
- unit tests exist for ROI metric calculation
- recommendations are generated from transparent rules
