
# Floor200 Product Spec

## One-liner

Floor200 is a local-first CLI that shows where AI coding-agent spend turns into shipped engineering work.

## Tagline

AI coding-agent ROI, from spend to shipped PRs.

## Target user

Engineering leads and small startup teams using tools like Claude Code, Codex, Gemini CLI, OpenCode, or Copilot CLI.

## Main pain

Teams are spending more on AI coding agents and need to answer:

* Where is the ROI?
* Which models are worth using?
* Which contributors turn agent spend into shipped work?
* Which repos or workflows waste tokens?
* What should we change next?

## MVP

A CLI that prints a demo ROI report using fake data.

Commands:

```bash id="38iwx0"
floor200 demo
floor200 report --demo
```

The report should show:

* total AI coding spend
* attributed merged PRs
* cost per merged PR
* abandoned spend
* waste rate
* spend by model
* spend by contributor
* spend by repo
* CI pass rate
* revert count
* recommendations

## Demo report shape

```text id="2vce3m"
Floor200 — AI Coding ROI Report

Summary
Total spend: $428.72
Attributed merged PRs: 26
Cost per merged PR: $16.49
Abandoned spend: $91.20
Waste rate: 21.3%

By Model
Claude: $182.40, 14 merged PRs, $13.03/merge
Codex: $96.10, 9 merged PRs, $10.68/merge
Gemini: $12.02, 4 merged PRs, $3.01/merge
OpenCode: $44.20, 3 merged PRs, $14.73/merge

Recommendations
- Investigate abandoned sessions over $10.
- Use Claude for larger backend changes.
- Use Codex for smaller scoped fixes.
- Avoid agent-led migrations until CI is more reliable.
```

## What not to build yet

* web dashboard
* arbitrary score
* awards
* real GitHub collector
* real ccusage adapter
* database
* network calls
* Claude hooks

## Future paid value

Team reports should eventually show:

* model ROI
* contributor ROI
* repo ROI
* work-type ROI
* wasted token spend
* private repo support
* weekly/monthly markdown exports
* team export merging
* recommendations for agent usage policy

## Privacy stance

Floor200 should not collect prompts, source code, or secrets by default.

It should primarily work from metadata:

* usage records
* estimated spend
* timestamps
* commits
* PRs
* CI state
* file paths
* attribution confidence
