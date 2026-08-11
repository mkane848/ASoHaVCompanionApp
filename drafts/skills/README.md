# Draft skills — not installed

These four skills are **drafts only**. They are NOT registered (not symlinked into
`.claude/skills/`), NOT committed to the install path, and will not trigger for Claude
Code in this repo. Each `SKILL.md` has real frontmatter (name/description); two have
finished instruction bodies, two are still a TODO outline.

To finish and install one:

1. Flesh out its `SKILL.md` body (replace the TODO outline with real instructions —
   `skill-creator` can help with the interview/draft/test/iterate loop at that point).
2. Move/copy it into `.agents/skills/<name>/` and run the project's skill install flow
   (see how the `vercel-*` and `web-design-guidelines` skills were added — project-scoped,
   symlinked into `.claude/skills/`).
3. Commit.

Drafted 2026-08-11:
- `responsive-device-qa` — fleshed out, not yet installed
- `theme-tokens` — fleshed out, not yet installed
- `perf-budget` — still a TODO outline
- `release-reliability-checklist` — still a TODO outline
