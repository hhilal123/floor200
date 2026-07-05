Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add export support for the existing demo ROI report.

Implement:
- floor200 export --demo --format md
- floor200 export --demo --format json
- default output directory: .floor200/reports/
- create the directory if it does not exist
- markdown report should be readable and professional
- JSON export should include summary metrics, model breakdown, contributor breakdown, repo breakdown, and recommendations

Do not add real collectors yet.
Do not add a database.
Do not make network calls.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 export --demo --format md creates a markdown file
- floor200 export --demo --format json creates a JSON file
- exported numbers match the terminal demo calculations
