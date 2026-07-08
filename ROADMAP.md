# Floor200 Roadmap

Tracks what's actually built against what's next. Update this file (not just `prompts/`) whenever a feature lands, so a new session can see status at a glance instead of guessing from `prompts/*.md` or git log.

**Strategy:** OSS/indie launch aimed at individual devs, positioned on the privacy/local-first wedge. See `docs/superpowers/specs/2026-07-06-launch-roadmap-and-positioning-design.md` for the competitive analysis (Jellyfish et al.), the pitch, and why the ordering below changed.

## Done

- [x] Demo ROI report with fake data — `floor200 demo`, `floor200 report --demo` (`prompts/01-bootstrap.md`)
- [x] Local export to markdown/json — `floor200 export --demo --format <md|json>` (`prompts/02-export-demo.md`)
- [x] `floor200 init` config scaffolding (`prompts/03-init-config.md`)
- [x] GitHub merged PR collector — `floor200 collect prs` (`prompts/04-github-pr-collector.md`)
- [x] Local git commit collector — `floor200 collect git` (`prompts/05-git-collector.md`)
- [x] ccusage adapter — `floor200 collect usage` (`prompts/06-ccusage-adapter.md`)
- [x] Attribution engine — `floor200 attribute` (`prompts/07-attribution-engine.md`)
- [x] Real ROI report + recommendations engine from collected data — `floor200 report` (`prompts/08-real-roi-report.md`)
- [x] Project-scoped attribution — usage sessions from other repos are excluded from attribution and report totals (PR #5)
- [x] One-command pipeline — `floor200 run` chains collect git → collect prs → collect usage → attribute → report, auto-initializing config and degrading gracefully (no `gh` auth, missing `project.repo`, missing ccusage → warn, skip, continue) (`prompts/09-run-pipeline.md`)
- [x] npm publish readiness — `"private": true` dropped, MIT license, `files`/repo metadata added, tarball verified from a clean directory (`docs/superpowers/specs/2026-07-06-npm-publish-and-readme-design.md`)
- [x] README as the pitch — privacy-first positioning, sample report output, quickstart, honest "how attribution works and what it can't know" section (same spec)
- [x] Attribution quality iteration — PR-unit candidate grouping (merge pair = corroboration, not ambiguity), 2h lookback window for mid-session commits, tunable windows via `attribution:` config, `pending-data` state for right-censored sessions, confidence score/label reconciliation; in-scope attributed sessions went from 1 to 18 on real data (`docs/superpowers/specs/2026-07-07-attribution-quality-iteration.md`)

## Launch (completed 2026-07-06)

- [x] GitHub repo made public
- [x] `floor200@0.1.0` published to npm — verified live via clean-directory `npx floor200 report --demo`; registry shasum matches the locally verified tarball
- [x] `floor200@0.2.0` published to npm (2026-07-08) — ships the attribution quality iteration (PR #12); publish run from a real terminal for passkey 2FA

## Next — post-launch (in order)

- [ ] Claude Code hook installer (auto-capture usage as sessions happen, instead of relying on manual `collect` runs) — also shrinks the pending-data window, mechanically raising attribution coverage
- [ ] Attribution ground-truth review tool (`floor200 attribute --review` or similar): label real attributions right/wrong locally to measure precision before adding new matching signals
- [ ] Attribution quality round 2 (not yet scoped, gated on the review tool showing it's needed): codex/other-agent project scoping when ccusage exposes it, richer signals beyond commit timing (e.g. changed-file overlap once the hook captures per-session files)

## Later / not yet scoped

- [ ] Team export/merge workflow (combine multiple contributors' local `.floor200` data into one report) — moved from Next: first user is an individual dev; this is the bridge to the eng-lead persona once individual adoption warrants it
- [ ] Revert count and CI pass rate wired into the real report (currently only in the demo data shape — see `DemoData` in `src/types.ts`)
- [ ] SQLite storage (per `AGENTS.md` tech stack, "later") if flat JSON files stop scaling
- [ ] `zod` validation of collected data files (per `AGENTS.md` tech stack, "later")

## Non-negotiables (do not build)

See `AGENTS.md` for the full list. The short version: no web dashboard, no arbitrary scores/awards, no raw-prompt or source-code collection by default, no secrets stored, no real network calls in unit tests.
