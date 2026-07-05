Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add `floor200 init`.

Implement:
- `floor200 init`
- creates `.floor200.yml`
- creates `.floor200/`
- creates `.floor200/reports/`
- does not overwrite existing `.floor200.yml` unless `--force` is passed
- supports `floor200 init --force`
- prints clear next steps after init

Default `.floor200.yml` should include:
- project name inferred from current folder
- provider: github
- repo: null
- season mode: monthly
- privacy defaults:
  - collectPrompts: false
  - collectSourceCode: false
  - hashEmails: true
- sources:
  - github enabled false
  - git enabled true
  - ccusage enabled false

Do not add real collectors yet.
Do not add a database.
Do not make network calls.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 init creates the expected files/folders
- floor200 init refuses to overwrite existing config
- floor200 init --force overwrites config
