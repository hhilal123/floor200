# Demo Export Design

## Goal

Add local Markdown and JSON exports for the existing fake-data ROI report without adding collectors, persistence, or network access.

## CLI behavior

`floor200 export --demo --format md` writes `.floor200/reports/demo-report.md`.

`floor200 export --demo --format json` writes `.floor200/reports/demo-report.json`.

The report directory is created when absent. Each command overwrites its stable output file. Missing `--demo` and unsupported formats produce clear CLI errors.

## Architecture

Add an export module with pure Markdown and JSON serializers. Both serializers consume `DemoData` and call `deriveMetrics()` so exported summary values use the same calculations as the terminal report.

A separate filesystem function selects the serializer, creates the destination directory, writes the stable filename, and returns its path. CLI code only validates options, invokes this function, and reports the written path.

## Export contents

Markdown contains a professional title, summary metrics, model, contributor, and repository tables, plus recommendations.

JSON contains `summary`, `models`, `contributors`, `repos`, and `recommendations`. Summary includes total spend, attributed merged PRs, cost per merged PR, abandoned spend, waste rate, CI pass rate, and revert count. Breakdown rows include their existing spend, merged PR, and attribution-confidence values plus derived cost per merge.

## Error handling

Only `md` and `json` are accepted. Missing demo mode and unsupported formats fail before filesystem writes. Filesystem errors propagate so the CLI exits unsuccessfully rather than claiming an export succeeded.

## Testing

Unit tests cover serializer structure, exact derived values, directory creation, stable filenames, and overwrite behavior. Existing tests remain unchanged. Final verification runs build, all tests, and both requested export commands.

## Constraints

No real collectors, database, network calls, prompt contents, source-code contents, or secrets are introduced.
