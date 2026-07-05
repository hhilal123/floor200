Build the initial Floor200 TypeScript CLI skeleton.

Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Create a local-first CLI that can print a demo ROI report using fake data. Do not implement real collectors yet.

Tech:
- TypeScript
- Node.js
- pnpm
- commander
- chalk
- cli-table3
- vitest
- tsup

CLI command:
floor200

Commands:
- floor200 demo
- floor200 report --demo

The demo report should show:
- total AI coding spend
- merged PRs attributed
- cost per merged PR
- abandoned spend
- spend by model
- spend by developer
- spend by repo
- CI pass rate
- revert count
- recommendations

Do not implement:
- database
- GitHub API
- ccusage
- Claude hooks
- network calls
- web dashboard
- awards
- arbitrary score

Acceptance criteria:
- pnpm install works
- pnpm build works
- pnpm test works
- pnpm --filter floor200 dev demo works
- tests exist for derived metrics
