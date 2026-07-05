# Launch Roadmap & Competitive Positioning

**Date:** 2026-07-06
**Status:** Approved
**Type:** Product-direction decision (docs-only; no feature code in this change)

## Decisions

Four decisions were made in a brainstorming session, each confirmed explicitly:

1. **Goal: get real users via an OSS/indie launch.** Not a pitch deck, not a
   private dogfooding tool. Success is people installing and running it.
2. **First user: the individual dev**, already running Claude Code (and often
   Codex or other agents) on their own machine, who wants to answer "what did
   my $200/month of agent spend actually ship?" Engineering leads remain the
   eventual buyer persona, but they require the team export/merge workflow,
   which is not built and is not needed to launch.
3. **Launch bar: launch small and iterate in public.** Pre-launch scope is
   npm publish + a solid README + a trustworthy first-run report. The hook
   installer and everything else ships post-launch, informed by feedback.
4. **Positioning: lead with the privacy/local-first wedge.** Headline message:
   *your AI spend data never leaves your machine.*

## Competitive landscape (researched 2026-07-06)

### Jellyfish (jellyfish.co) — closest overlap

Jellyfish AI Impact tracks adoption, token spend, and ROI across GitHub
Copilot, Cursor, Claude Code, Amazon Q, Gemini, and agentic tools, and links
usage/spend to delivery outcomes (cycle time, throughput, quality). They ship
a dedicated Claude Code dashboard. It is the strongest evidence that the
problem floor200 solves is real and monetizable.

Structurally, though, Jellyfish is an enterprise SaaS platform: 25+
integrations (Jira, GitHub, Azure DevOps…), demo-gated pricing, an org-wide
data pipeline into their cloud, and a procurement-length sales motion. It is
built for VPs of Engineering and finance teams at large orgs.

### LinearB, Swarmia, DX (getdx.com) — adjacent

Engineering-analytics platforms with AI-adoption reporting bolted on to
varying degrees. None are local-first; all are team/org products with the
same "send us your SDLC data" model. Public analyses consistently note the
same gap: they can show PR cycle times moving, but attribution of AI usage to
shipped output remains weak or hand-wavy across the category.

### The open seat

Nobody serves the individual dev with a tool that installs in five minutes,
runs entirely locally, and gives an honest per-repo answer about agent spend
vs shipped PRs. That is floor200's launch market.

## The pitch

**Headline (privacy wedge):**
> Floor200 — AI coding ROI, from spend to shipped PRs. Your data never leaves
> your machine.

**Supporting messages, in order:**

1. **Local-first, metadata-only.** No cloud, no account, no prompts, no source
   code, no secrets. Reads usage metadata via ccusage and git/GitHub metadata
   via your existing CLIs. Contrast: every incumbent requires shipping org
   data to their SaaS.
2. **Five minutes, no sales call.** One install, one command, a report in your
   terminal. Contrast: demo-gated enterprise procurement.
3. **Honest numbers.** Every attribution carries an explicit confidence level
   (high/medium/low/unknown) with a human-readable explanation. Floor200 tells
   you what it doesn't know instead of laundering uncertainty into a score.
   Contrast: black-box dashboards and arbitrary productivity scores.

## Roadmap consequences

**The Claude Code hook installer is demoted from "next" to
"immediately post-launch."** It is a retention feature — auto-capturing usage
so returning users don't have to re-run `collect`. The current bottleneck is
acquisition: the package isn't published, there is no README pitch, and the
first run takes five sequential commands. Retention work before acquisition
work is the wrong order for a launch.

**Pre-launch, in order:**

1. **One-command pipeline** — a single command chaining
   collect git → collect prs → collect usage → attribute → report, with
   graceful per-step degradation (e.g. no `gh` auth → warn, skip PRs,
   continue). Reuses the existing `collectGitCommits`, `collectPullRequests`,
   `collectUsage`, `runAttribution`, and `runRoiReport` functions.
2. **npm publish readiness** — the `floor200` package name is confirmed
   available on npm. Remove `"private": true`, add `files`/repo metadata,
   verify `npx floor200` works from a clean machine.
3. **README as the pitch** — the positioning above, sample report output,
   3-line quickstart, and an honest "how attribution works and what it can't
   know" section.

**Post-launch:** hook installer, then attribution-quality iteration driven by
real-user feedback (codex/other-agent project scoping when ccusage exposes
it, tunable matching windows).

**Moved to later:** team export/merge — the individual-first strategy makes it
non-blocking; it becomes the bridge to the eng-lead persona when individual
adoption warrants it.

## Non-goals (reaffirmed)

Unchanged from `AGENTS.md`: no web dashboard, no cloud service, no arbitrary
scores or awards, no raw-prompt or source-code collection by default, no
secrets stored, no real network calls in unit tests. The privacy wedge only
works if these stay hard rules.

Each pre-launch item gets its own spec/plan cycle before implementation; this
document only fixes the ordering and the message.
