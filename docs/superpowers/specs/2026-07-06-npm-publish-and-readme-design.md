# npm Publish Readiness + README as the Pitch

**Date:** 2026-07-06
**Status:** Approved
**Type:** Pre-launch packaging and docs (no feature code)

## Scope

The last two pre-launch items from
`2026-07-06-launch-roadmap-and-positioning-design.md`, handled as one
combined cycle because they are coupled: the README is the npm package page,
and package.json metadata points at the README and repo.

## Decisions

1. **One combined cycle.** The launch spec prescribed one spec/plan cycle per
   item; the user approved combining these two because both are small,
   launch-blocking, and coupled.
2. **Stop at verified-ready.** This change makes the package publishable and
   proves it works from a packed tarball in a clean directory. The actual
   `npm publish` is a user action (npm account, 2FA, public and hard to
   undo), as is flipping the GitHub repo to public.
3. **MIT license, open-core.** This repo stays MIT as the trust and
   acquisition layer — auditable code is core to the privacy pitch. A future
   paid team tier lives in a separate proprietary repo or package; MIT on
   today's code does not constrain licensing of future code. Fork-and-resell
   risk is accepted as near zero at this stage; relicensing later (Sentry,
   HashiCorp precedent) remains possible in the permissive→restrictive
   direction.
4. **Repo public at launch.** `repository`/`bugs`/`homepage` metadata and
   README links point at `github.com/hhilal123/floor200`. The user makes the
   repo public before publishing so the links resolve.

## Changes

### package.json

- Remove `"private": true`.
- Add `description`, `license: MIT`, `author`, `repository`, `bugs`,
  `homepage`, `keywords`, and `files: ["dist"]` (README, LICENSE, and
  package.json ship automatically; `src/`, `tests/`, `docs/`, `prompts/`
  stay out of the tarball).
- Add a `prepublishOnly` script running `pnpm build && pnpm test` as a
  publish safety net.
- Unchanged: version `0.1.0`, `bin`, ESM `type`, `engines.node >= 22.13`.
  `dist/cli.js` already carries the `#!/usr/bin/env node` shebang.
- `pnpm-workspace.yaml` stays — it exists for the esbuild `allowBuilds`
  setting, not because this is a workspace.

### LICENSE

Standard MIT text, copyright 2026 Hudson Hilal.

### README.md

Structure, implementing the positioning spec:

1. Headline: privacy wedge ("Your data never leaves your machine").
2. What it does — correlates local agent usage/spend with git commits and
   merged GitHub PRs, entirely locally.
3. Quickstart — `cd your-repo` + `npx floor200 run` (auto-inits config),
   with a prerequisites one-liner and graceful-degradation note.
4. Sample report — real `floor200 report --demo` table output, ANSI
   stripped, in a code block.
5. What it reads / what it never stores — metadata-vs-content contrast from
   the AGENTS.md privacy rules; data lives in `.floor200/` (gitignored),
   config in `.floor200.yml`.
6. How attribution works — and what it can't know: the real rules from
   `src/attribution.ts` (24-hour window, PR-backed upgrade, 2-hour high
   threshold, 8-hour PR cutoff, 15-minute ambiguity refusal), the four
   confidence levels, and explicit limitations (time correlation is not
   causation; cross-repo scoping depends on ccusage exposing project
   context).
7. Commands table.
8. License.

Tone: professional, sharp, slightly fun; no game jargon.

### ROADMAP.md

Move both pre-launch items to Done, noting that `npm publish` and the repo
visibility flip are user actions at launch time.

## Verification

- `pnpm build && pnpm test` pass.
- `npm pack --dry-run` file list contains only `dist/`, `package.json`,
  `README.md`, `LICENSE`.
- End-to-end: pack the tarball, install it in a clean scratch directory,
  run `npx floor200 --help`, `report --demo`, and `run` inside a throwaway
  git repo to confirm the bin resolves and the pipeline degrades gracefully.

## Non-goals

No `npm publish`, no repo visibility change, no feature code, no CI changes.
