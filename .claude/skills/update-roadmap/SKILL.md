---
name: update-roadmap
description: Update ROADMAP.md's Done/Next/Later sections from recent git history. Use when a feature has landed and ROADMAP.md needs to reflect it, or when asked to check whether ROADMAP.md is stale.
---

# Update Roadmap

ROADMAP.md says to update it "whenever a feature lands" so a new session can see status at a glance instead of guessing from git log. This skill does that update.

## Steps

1. Find the last commit that touched `ROADMAP.md`:
   ```
   git log -1 --format=%H -- ROADMAP.md
   ```
2. List commits since then:
   ```
   git log <sha>..HEAD --oneline
   ```
   If there are none, report that ROADMAP.md is already current and stop.
3. Read `ROADMAP.md` and `AGENTS.md`'s "MVP order" section for context on what each item represents.
4. For each commit, determine whether it completes an item currently listed under `## Next` or `## Later`, or ships something not yet listed at all.
5. Propose edits:
   - Move completed items into `## Done`, matching the existing line format: `- [x] <feature> — <command or file> (PR #<n> if known)`.
   - Do not reorder or reword items that aren't affected by the new commits.
   - Do not invent completions — only mark something Done if the commit history actually shows it landed (code + tests, not just a plan/spec doc).
6. Show the user the specific lines you intend to change (a small diff, not a full-file rewrite) before applying.
7. Apply with the Edit tool once confirmed.

## Notes

- This is bookkeeping, not a design decision — don't restructure ROADMAP.md's sections or rewrite the "Strategy"/"Non-negotiables" framing text.
- If a commit's purpose is ambiguous, read the commit body and any referenced `docs/superpowers/specs/*` or `docs/superpowers/plans/*` file before guessing.
