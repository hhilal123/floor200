# Floor200

**AI coding ROI, from spend to shipped PRs. Your data never leaves your machine.**

Floor200 is a local-first CLI that answers one question: what did your AI coding-agent spend actually ship? It correlates local agent usage and spend (via [ccusage](https://github.com/ryoppippi/ccusage)) with your git commits and merged GitHub PRs, then prints an ROI report in your terminal.

No cloud. No account. No prompts, no source code, no secrets. Everything runs on your machine and reads only metadata.

## Quickstart

```bash
cd your-repo
npx floor200 run
```

That's it — `run` initializes config on first use, collects commits, merged PRs, and usage data, attributes spend to shipped work, and prints the report.

**Prerequisites:** Node ≥ 22.13. For PR data, the [`gh` CLI](https://cli.github.com) logged in; for Claude Code spend, [ccusage](https://github.com/ryoppippi/ccusage) available via `npx`. Missing either? Floor200 warns, skips that step, and keeps going with what it has.

## What the report looks like

```text
Floor200 — AI Coding ROI Report

Summary
┌───────────────────────┬─────────┐
│ Total AI coding spend │ $428.72 │
├───────────────────────┼─────────┤
│ Attributed merged PRs │ 26      │
├───────────────────────┼─────────┤
│ Cost per merged PR    │ $16.49  │
├───────────────────────┼─────────┤
│ Abandoned spend       │ $91.20  │
├───────────────────────┼─────────┤
│ Waste rate            │ 21.3%   │
├───────────────────────┼─────────┤
│ CI pass rate          │ 87.5%   │
├───────────────────────┼─────────┤
│ Revert count          │ 2       │
└───────────────────────┴─────────┘

Spend by model
┌──────────────┬─────────┬────────────┬──────────────┬────────────┐
│ Name         │ Spend   │ Merged PRs │ Cost / merge │ Confidence │
├──────────────┼─────────┼────────────┼──────────────┼────────────┤
│ Claude       │ $182.40 │ 14         │ $13.03       │ high       │
├──────────────┼─────────┼────────────┼──────────────┼────────────┤
│ Codex        │ $96.10  │ 9          │ $10.68       │ high       │
├──────────────┼─────────┼────────────┼──────────────┼────────────┤
│ Gemini       │ $12.02  │ 1          │ $12.02       │ medium     │
├──────────────┼─────────┼────────────┼──────────────┼────────────┤
│ OpenCode     │ $44.20  │ 2          │ $22.10       │ medium     │
├──────────────┼─────────┼────────────┼──────────────┼────────────┤
│ Unattributed │ $94.00  │ 0          │ —            │ low        │
└──────────────┴─────────┴────────────┴──────────────┴────────────┘

Recommendations
- Investigate abandoned sessions over $10.
- Use Claude for larger backend changes.
- Use Codex for smaller scoped fixes.
```

Plus per-developer and per-repo breakdowns. Try it without any setup: `npx floor200 report --demo`.

## What it reads — and what it never stores

Floor200 works from metadata only. All collected data lives in `.floor200/` inside your repo (gitignored), config in `.floor200.yml`. Nothing is transmitted anywhere.

| Stored (metadata) | Never stored |
| --- | --- |
| Timestamps, session IDs | Raw prompts |
| Token counts, estimated cost | Source-code contents |
| Model and agent names | Secrets, `.env` contents |
| Commit SHAs, branch names | Credential files |
| PR numbers and PR metadata | Terminal output |
| Changed file paths, repo hash | |

The code is open — audit it. The privacy rules are hard constraints in this repo, not settings.

## How attribution works — and what it can't know

Floor200 matches each usage session to the nearest commit within 24 hours after the session ends. If that commit is part of a merged PR, the match gets stronger. Every attribution carries an explicit confidence level with a human-readable explanation:

- **high** — nearest commit is in a merged PR, landed within 2 hours, and the session's repository context matched this repo.
- **medium** — PR-backed, but slower or missing repository context.
- **low** — commit-only evidence; no merged PR contains that commit.
- **unknown** — unattributed, with the reason stated. Floor200 refuses to guess: if the two nearest candidate commits are within 15 minutes of each other, or the nearest PR-backed commit is more than 8 hours out, it reports *unknown* rather than inventing precision.

Honest limitations:

- **Time correlation is not causation.** A commit landing after a session doesn't prove the session produced it. Confidence levels exist precisely because of this.
- **Cross-repo scoping depends on your usage source.** Claude Code exposes project context through ccusage, so sessions from other repos are excluded. Agents that don't expose it can only be time-matched, which caps their confidence.
- **No productivity score.** Floor200 reports transparent metrics and tells you what it doesn't know — it will never compress uncertainty into a single number.

## Commands

| Command | What it does |
| --- | --- |
| `floor200 run` | The whole pipeline: collect, attribute, report |
| `floor200 report` | Print the ROI report from collected data (`--demo` for fake data) |
| `floor200 collect git` | Collect local commit metadata |
| `floor200 collect prs` | Collect merged-PR metadata via `gh` |
| `floor200 collect usage` | Collect agent usage/spend via ccusage |
| `floor200 attribute` | Attribute usage sessions to commits and PRs |
| `floor200 export` | Export the report as markdown or JSON |
| `floor200 init` | Scaffold `.floor200.yml` config |
| `floor200 status` | Show setup and data-collection status |
| `floor200 demo` | Print the demo report |

## How this was built

Floor200 was built agent-first — every feature started as a written spec with acceptance criteria, executed by an AI coding agent, and merged only on green CI. The receipts are in the repo: the task prompts in [`prompts/`](prompts/), the design docs in [`docs/superpowers/specs/`](docs/superpowers/specs/), and a [pre-tool-use hook](.claude/scripts/privacy-guard.sh) that mechanically blocks secrets from ever being written during development.

## License

[MIT](LICENSE)
