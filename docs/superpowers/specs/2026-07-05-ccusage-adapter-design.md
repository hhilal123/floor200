# ccusage Adapter Design

## Goal

Add `floor200 collect usage` to collect local AI coding-agent session metadata through ccusage while keeping the collection foundation generic for future adapters.

## Adapter boundary

A generic `UsageAdapter` interface exposes an adapter name and an async collection method returning normalized sessions plus skipped-record diagnostics. ccusage is the first implementation; the CLI and file writer consume the generic result rather than ccusage-specific raw objects.

All commands use the existing injected `CommandRunner`, without a shell. The adapter runs `ccusage --version` and then `ccusage session --json`. Tests inject a fake runner and never invoke real ccusage or networks.

## Parsing and normalization

The parser accepts a top-level session array or an object containing `sessions`. It defensively recognizes documented/common aliases for session IDs, timestamps, model lists, token counts, cost, and project paths.

Each valid record becomes one normalized session containing source, source session ID, model, start/end timestamps, duration, input/output/cache/total tokens, estimated USD cost, an optional SHA-256 path hash, and `rawSource: "ccusage"`.

One model uses its name, multiple models use `mixed`, and missing model data uses `unknown`. Cache creation and cache-read counts are combined. Duration and total tokens are derived only when the required numeric/timestamp inputs are valid.

Malformed or incomplete records are skipped. A valid empty session list succeeds with zero records; a non-empty candidate list with zero valid records fails as unparseable.

## Privacy

The adapter never writes prompts, source code, raw paths, raw ccusage objects, or full terminal output. Local project/repository paths are SHA-256 hashed immediately and only the hash is normalized.

When records are skipped, `.floor200/debug/ccusage-skipped.json` contains only the record index and a short reason code. The debug file is written only when skips occur and is removed after a later clean collection so stale warnings are not retained.

## Storage and CLI

Valid normalized records overwrite `.floor200/data/usage.json` as a pretty-printed JSON array. Writes occur only after configuration, command execution, and parsing succeed.

The CLI checks `.floor200.yml`, reports missing ccusage and command failures clearly, and prints valid-session and skipped-record counts plus the relative output path.

## Error handling

Typed errors distinguish missing configuration, unavailable ccusage, failed ccusage execution, malformed overall JSON, and non-empty input with no valid sessions. Missing fields in individual records produce skip reasons rather than failing the entire run.

## Testing

Fixture tests cover both top-level shapes, field aliases, mixed/unknown models, derived totals/duration, path hashing, record skipping, empty input, and unusable input. Collector tests verify exact commands, typed failures, stable files, safe debug diagnostics, and no writes before successful parsing. CLI tests use a fake ccusage executable.

## Constraints

No attribution, recommendations, database, direct API calls, prompt collection, source-content collection, raw-path storage, or terminal-output persistence is added.
