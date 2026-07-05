# Floor200 — Agent Instructions

Read `AGENTS.md` and `docs/PRODUCT_SPEC.md` before starting any work in this repo. They are the source of truth for the product's non-negotiables, tech stack, metrics, and done criteria — this file only points to them so you don't skip that step.

Quick reference (see `AGENTS.md` for full detail, and defer to it if anything here goes stale):

- Local-first CLI. No web dashboard, no database yet, no arbitrary scores or awards.
- Never store raw prompts, source-code contents, secrets, or `.env` contents by default.
- Every attribution must carry an explicit confidence level.
- External CLI calls (`git`, `gh`, `ccusage`) must go through the mockable `CommandRunner` in `src/process.ts` — unit tests must not make real network or subprocess calls.
- A task is only done when `pnpm build` and `pnpm test` both pass, the CLI command works locally, and no privacy rule is violated.

See `ROADMAP.md` for what's built and what's next. Design docs for past features live in `docs/superpowers/specs/` and `docs/superpowers/plans/` — check there before re-deriving a decision that's already been made.
