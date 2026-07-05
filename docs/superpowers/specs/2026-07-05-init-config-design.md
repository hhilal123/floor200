# Init Configuration Design

## Goal

Add `floor200 init` to create a local project configuration and Floor200 working directories without collectors, a database, or network access.

## CLI behavior

`floor200 init` creates `.floor200.yml`, `.floor200/`, and `.floor200/reports/` beneath the current working directory. It prints the created paths and concise next steps.

`floor200 init --force` overwrites `.floor200.yml` while preserving existing contents beneath `.floor200/`.

If `.floor200.yml` exists and `--force` is absent, the command exits non-zero with a clear message and makes no filesystem changes. The existence check therefore occurs before directory creation.

## Configuration

The project name is the basename of the current working directory. The generated YAML contains:

- `project.name`: inferred project name
- `project.repo`: `null`
- `provider`: `github`
- `season.mode`: `monthly`
- `privacy.collectPrompts`: `false`
- `privacy.collectSourceCode`: `false`
- `privacy.hashEmails`: `true`
- `sources.github.enabled`: `false`
- `sources.git.enabled`: `true`
- `sources.ccusage.enabled`: `false`

The fixed schema is serialized directly without adding a YAML dependency. String values are safely JSON-quoted, which is valid YAML and handles folder names containing punctuation.

## Architecture

`src/config.ts` owns a pure configuration serializer and an async filesystem initializer. The initializer accepts an optional base directory for isolated testing, checks for an existing config, creates the report directory recursively, writes the config, and returns the created paths.

`src/cli.ts` registers `init`, passes `process.cwd()` implicitly, converts the known existing-config error into a clear CLI failure, and prints next steps after success.

## Error handling

Existing config without `--force` is represented by a specific error type so the CLI can present a stable message. Other filesystem failures propagate and cause a non-zero exit rather than reporting success.

## Testing

Tests cover exact default values, inferred project name, fresh directory creation, no mutations when config exists, forced config overwrite without directory-content deletion, and CLI success/refusal behavior. Full build, test suite, and source CLI acceptance commands verify completion.

## Constraints

The feature stores only configuration metadata. It introduces no real collectors, database, network calls, prompts, source-code contents, secrets, or full terminal output.
