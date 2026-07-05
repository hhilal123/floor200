Read AGENTS.md and docs/PRODUCT_SPEC.md first.

Goal:
Add a GitHub PR collector using the GitHub CLI.

Implement:
- floor200 collect prs
- reads .floor200.yml
- requires project.repo to be set, like "owner/repo"
- checks that `gh` is installed
- checks that `gh auth status` works
- runs `gh pr list` for merged PRs
- parses JSON into normalized PR records
- writes output to .floor200/data/prs.json for now
- prints a short summary after collection

Use GitHub CLI, not direct GitHub API calls.

Use fields:
number,title,url,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,changedFiles,commits,labels

Command shape:
gh pr list --repo owner/repo --state merged --limit 100 --json number,title,url,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,changedFiles,commits,labels

Do not add a database yet.
Do not add ccusage yet.
Do not add attribution yet.
Do not make this collect agent usage.

Acceptance criteria:
- pnpm build works
- pnpm test works
- floor200 collect prs fails clearly if .floor200.yml is missing
- floor200 collect prs fails clearly if project.repo is missing
- floor200 collect prs fails clearly if gh is missing or unauthenticated
- floor200 collect prs writes .floor200/data/prs.json
- parser has fixture tests
- external CLI calls are wrapped and mockable
