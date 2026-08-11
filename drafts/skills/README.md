# Draft skills — not installed

These four skills are **drafts only**. They are NOT registered (not symlinked into
`.claude/skills/`), NOT committed to the install path, and will not trigger for Claude
Code in this repo. Each `SKILL.md` has real frontmatter (name/description) and a finished
instruction body — all four are ready to install, just not installed yet.

To install one:

1. Move/copy it into `.agents/skills/<name>/` and run the project's skill install flow
   (see how the `vercel-*` and `web-design-guidelines` skills were added — project-scoped,
   symlinked into `.claude/skills/`).
2. Commit.

Drafted 2026-08-11, all fleshed out:
- `responsive-device-qa`
- `theme-tokens`
- `perf-budget`
- `release-reliability-checklist`
