# Floor200 Roadmap

Tracks the MVP order from `AGENTS.md` against what's actually built. Update this file (not just `prompts/`) whenever a feature lands, so a new session can see status at a glance instead of guessing from `prompts/*.md` or git log.

## Done

- [x] Demo ROI report with fake data — `floor200 demo`, `floor200 report --demo` (`prompts/01-bootstrap.md`)
- [x] Local export to markdown/json — `floor200 export --demo --format <md|json>` (`prompts/02-export-demo.md`)
- [x] `floor200 init` config scaffolding (`prompts/03-init-config.md`)
- [x] GitHub merged PR collector — `floor200 collect prs` (`prompts/04-github-pr-collector.md`)
- [x] Local git commit collector — `floor200 collect git` (`prompts/05-git-collector.md`)
- [x] ccusage adapter — `floor200 collect usage` (`prompts/06-ccusage-adapter.md`)
- [x] Attribution engine — `floor200 attribute` (`prompts/07-attribution-engine.md`)
- [x] Real ROI report + recommendations engine from collected data — `floor200 report` (`prompts/08-real-roi-report.md`)

## Next

- [ ] Claude Code hook installer (auto-capture usage as sessions happen, instead of relying on manual `collect` runs)
- [ ] Team export/merge workflow (combine multiple contributors' local `.floor200` data into one report)

## Later / not yet scoped

- [ ] Revert count and CI pass rate wired into the real report (currently only in the demo data shape — see `DemoData` in `src/types.ts`)
- [ ] SQLite storage (per `AGENTS.md` tech stack, "later") if flat JSON files stop scaling
- [ ] `zod` validation of collected data files (per `AGENTS.md` tech stack, "later")

## Non-negotiables (do not build)

See `AGENTS.md` for the full list. The short version: no web dashboard, no arbitrary scores/awards, no raw-prompt or source-code collection by default, no secrets stored, no real network calls in unit tests.
