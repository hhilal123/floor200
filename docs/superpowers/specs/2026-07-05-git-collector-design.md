# Local Git Collector Design

## Goal

Add `floor200 collect git` to collect local commit metadata and line-count statistics without storing source contents, diffs, or raw author emails.

## Command behavior

`floor200 collect git` collects commits from the local-calendar first day of the current month, inclusive.

`floor200 collect git --since YYYY-MM-DD` uses the supplied inclusive date. Invalid formats and impossible calendar dates fail before git collection.

The command requires `.floor200.yml`, verifies the current directory is inside a git repository, resolves the repository root, current branch, and optional origin URL, then writes `.floor200/data/commits.json` and prints a concise count/path summary.

Detached HEAD is represented as `HEAD`. A missing `origin` is represented as `null` and does not fail collection.

## External command boundary

All git invocations use the existing injected `CommandRunner`, without a shell. The collector executes:

1. `git rev-parse --show-toplevel`
2. `git branch --show-current`
3. `git remote get-url origin`
4. One `git log` command using an unambiguous record/field delimiter format, ISO timestamps, subject-only messages, `--numstat`, and `--no-renames`

The origin command is the only optional failure. Other git failures are mapped to clear typed errors. Tests inject a fake runner and never invoke real git.

## Normalization and privacy

Each normalized commit contains:

- `sha`
- subject-only `message`
- `authorName`
- SHA-256 `authorEmailHash`
- ISO `committedAt`
- the collected `branchName`
- aggregate additions, deletions, and files changed
- file records containing only path, additions, and deletions

Raw author emails exist only in the in-memory git output long enough to hash and are never written. Source contents, full commit messages, full diffs, prompts, secrets, and terminal output are not stored. Binary-file numstat markers are normalized to zero line additions and deletions.

## Output

The collector overwrites `.floor200/data/commits.json` with a pretty-printed envelope:

```json
{
  "repository": {
    "root": "/path/to/repo",
    "branchName": "main",
    "remoteOrigin": "git@github.com:owner/repo.git"
  },
  "since": "2026-07-01",
  "commits": []
}
```

The data directory is created only after configuration, repository checks, git collection, and parsing succeed.

## Components

`src/config.ts` gains a reusable configuration-existence check that does not require `project.repo`. `src/git.ts` owns date validation/defaulting, SHA-256 hashing, fixture parsing, git orchestration, and output writing. `src/cli.ts` registers `collect git`, validates `--since`, maps typed failures to clear messages, and prints the summary.

## Testing

Fixture tests cover multiple commits and files, subject-only messages, binary numstat, aggregate counts, email hashing, and malformed output. Collector tests verify exact command order and arguments, missing config, non-repository failure, optional origin behavior, detached HEAD, stable output, and no writes before successful parsing. CLI tests use a temporary fake git executable and make no network calls.

## Constraints

No database, ccusage integration, attribution engine, agent-usage collection, direct network access, source-content collection, or diff storage is added.
