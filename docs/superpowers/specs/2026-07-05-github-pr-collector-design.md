# GitHub PR Collector Design

## Goal

Add `floor200 collect prs` to collect merged pull-request metadata through the GitHub CLI and store normalized local records for future ROI reporting and attribution.

## Configuration

The generated configuration nests repository identity under `project`:

```yaml
project:
  name: "floor200"
  repo: null
```

The collector requires `project.repo` to be a non-empty `owner/repo` string. The obsolete top-level `repo` field is not supported. Configuration is parsed with the `yaml` package so normal user-edited YAML remains reliable.

## External command boundary

A process-runner interface wraps all GitHub CLI execution and is injected into the collector. The production runner invokes commands without a shell and captures bounded stdout/stderr for immediate error reporting; it does not persist full terminal output.

The collector executes, in order:

1. `gh --version`
2. `gh auth status`
3. `gh pr list --repo owner/repo --state merged --limit 100 --json number,title,url,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,changedFiles,commits,labels`

Failure to start `gh` produces an installation message. A non-zero authentication check produces an authentication message. Unit tests use a fake runner and never invoke `gh` or the network.

## Normalized records

The output is a pretty-printed JSON array at `.floor200/data/prs.json`. Each record contains:

- PR number, title, URL
- `author: string | null` from `author.login`
- head and base branch names
- creation and merge timestamps
- additions, deletions, changed-file count
- `commits: string[]` from commit OIDs
- `labels: string[]` from label names

No extra nested GitHub objects, source contents, prompts, secrets, or terminal output are stored.

## Components and data flow

`src/process.ts` provides the mockable command runner. `src/github.ts` owns raw response validation, normalization, collection orchestration, and the local JSON write. `src/config.ts` owns config serialization and reading. `src/cli.ts` registers `collect prs`, maps typed operational errors to clear CLI failures, and prints the collected count and relative output path.

The collector validates the config before checking `gh`, creates `.floor200/data/` only after all command and parse steps succeed, and overwrites `prs.json` on successful runs.

## Error handling

The command exits non-zero with distinct messages for missing config, missing or invalid `project.repo`, unavailable `gh`, unauthenticated `gh`, command failure, and malformed GitHub JSON. Failed preflight or collection does not create or replace `prs.json`.

## Testing

Fixture tests verify raw GitHub JSON normalization, including null authors and compact labels/commit OIDs. Collector tests verify exact command arguments, all preflight failures, stable output, and summary results with a fake runner. CLI tests verify readable failures and successful summary output without real external calls.

## Constraints

No direct GitHub API calls, database, ccusage integration, attribution engine, or agent-usage collection are added.
