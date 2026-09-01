# Stale Branches Cleanup

## Overview

This document lists branches that have been merged into `main` and are safe to delete from the remote repository.

## Status

**Identified:** 35 merged branches  
**Date identified:** 2026-09-01  
**Deletion script:** `scripts/cleanup-stale-branches.sh`

## Merged Branches (Safe to Delete)

The following branches have all their commits merged into `main`:

1. `claude/auth-fk-decision-doc` - Auth.users FK delete behavior decision
2. `claude/bootstrap-promise-all` - Performance: batch independent reads
3. `claude/changelog-docs-update` - HANDOFF.md documentation update
4. `claude/changelog-handoff-status-rank` - Document 0.18.1 changes
5. `claude/character-creation-ui-cleanup-0n8jzm` - Character creation UI cleanup
6. `claude/character-sheet-crash-tboy1e` - Fix pre-0.13.0 sheet loading crash
7. `claude/character-sheet-ui-plan-gznj9c` - Character sheet UI planning
8. `claude/character-sheet-ui-responsive-f7qtmd` - Responsive UI fixes
9. `claude/cleanup-stale-branches-2twsm9` - Stale branches cleanup (current)
10. `claude/claude-md-documentation-lus5be` - CLAUDE.md documentation
11. `claude/codebase-review-alignment-wtcgbk` - Align CLAUDE.md with recent changes
12. `claude/confirm-before-destroy` - Confirmation dialogs for destructive actions
13. `claude/form-label-association` - Form label accessibility fixes
14. `claude/game-engine-implementation-5njrf3` - Game engine implementation
15. `claude/glossary-matcher-cache` - Glossary matcher performance caching
16. `claude/handoff-cleanup` - HANDOFF.md documentation cleanup
17. `claude/heading-hierarchy` - Heading hierarchy accessibility fixes
18. `claude/install-new-skills-gnvif4` - Install project-authored skills
19. `claude/installed-skills-mcp-connections-oxy8fb` - MCP connections update
20. `claude/mobile-ui-cleanup-plan-lljams` - Mobile UI planning and documentation
21. `claude/modal-a11y-overhaul` - Modal accessibility improvements
22. `claude/participant-card-variants` - Refactor ParticipantCard variants
23. `claude/pending-work-plan-cfzmdc` - 0.23.0 work plan and versioning
24. `claude/pending-work-plan-duibdg` - 0.26.0 work plan and versioning
25. `claude/pending-work-plan-j2musw` - 0.27.0 tech stack audit work plan
26. `claude/pending-work-plan-pool01` - 0.25.0 work plan and versioning
27. `claude/planned-work-xeuaau` - 0.24.0 work plan implementation
28. `claude/route-code-splitting` - Performance: code splitting for /admin and /combat
29. `claude/status-rank-creation-fj7z2u` - Allow setting Status rank at creation
30. `claude/sync-lockfile-version` - package-lock.json version sync
31. `claude/tech-stack-audit-rba4xe` - Tech stack audit documentation
32. `claude/theme-tokens-cleanup` - Theme tokens cleanup and fixes
33. `claude/ui-layout-form-architecture-jc4wyt` - UI layout and form architecture
34. `claude/ui-theme-overhaul-plan-g7avlt` - WorkPlan-0.26.0 documentation
35. `claude/workplan-0-24-0-review-yg6i3e` - WorkPlan-0.24.0 adversarial review

## Cleanup Instructions

### Automated Cleanup

Run the provided cleanup script:

```bash
chmod +x scripts/cleanup-stale-branches.sh
./scripts/cleanup-stale-branches.sh
```

The script will:
1. List all merged branches
2. Prompt for confirmation
3. Delete each branch from the remote repository

### Manual Cleanup

To delete branches individually:

```bash
git push origin --delete "branch-name"
```

To delete all at once (use with caution):

```bash
git branch -r --merged origin/main \
  | grep -v "origin/main$" \
  | grep -v "HEAD" \
  | sed 's|origin/||' \
  | xargs -I {} git push origin --delete {}
```

## Notes

- All listed branches have been fully merged into `main`
- Deleting these branches will not affect your local `main` branch
- This cleanup is safe and recommended to keep the repository clean
- After deletion, run `git fetch --prune` to remove local tracking branches
