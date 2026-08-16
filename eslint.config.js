// TechStackAudit.md D8. Scope discipline matches the audit's own: typescript-eslint's
// non-type-checked `recommended` preset plus eslint-plugin-react-hooks only — no stylistic
// ruleset, no Prettier (see C's table: "Repo-wide diff that would bury every real change for a
// release" — Cut). The goal is finding the Rules-of-React violations that would make React
// Compiler (G13) silently bail, not reformatting 93 files.
//
// react-hooks@^6 folded the React Compiler's own rule set into
// reactHooks.configs['recommended-latest'], so there is no separate eslint-plugin-react-compiler
// to install (confirmed against the installed version's own exports before relying on it here).
//
// Non-type-checked on purpose: typescript-eslint's `recommendedTypeChecked` preset needs a
// project service that resolves every workspace's cross-package imports (apps/server and
// apps/web both import @asohav/shared from its built dist/), which would make this config
// depend on build order for no rule this pass actually needs — react-hooks' rules and the
// plain `recommended` preset both work from a single file's AST alone.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/web/.screenshots/**',
      'apps/web/.stats/**',
      '**/*.tsbuildinfo',
      // The original static-prototype design handoff (CLAUDE.md: "Built from a
      // static-prototype design handoff in Planning Docs/") — reference material this app was
      // built from, not live application source; its .js files were never meant to be linted
      // or maintained going forward.
      'Planning Docs/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Node-authored source: the server, every root/workspace *.mjs script, and this config file
    // itself (CommonJS, since root package.json has no "type": "module" — matching D8's own
    // "eslint.config.js", not ".mjs").
    files: ['apps/server/src/**/*.ts', 'scripts/**/*.mjs', '*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // The Playwright driver scripts run as Node processes but also author page.evaluate()
    // callback bodies that execute inside the browser under test (document, getComputedStyle,
    // URL, …) — ESLint parses the whole file with one global scope, so it can't tell those
    // callback bodies apart from the surrounding Node code. Both globals sets together avoids
    // false no-undef positives on either half rather than trying to carve the file up.
    files: ['apps/web/scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    // `configs['recommended-latest']` is itself an array of one ready-made flat-config object
    // (confirmed against the installed version's own shape, not assumed from its name) — pull
    // its plugins/rules out rather than spreading it unscoped, so react-hooks rules apply only
    // where React actually is (apps/server and packages/shared have no JSX/hooks at all). The
    // plugin registration and its rule severity overrides have to live in the same config object
    // as each other — a later, unscoped block can widen severity but can't reach a plugin's
    // rules without also re-registering the plugin.
    plugins: { 'react-hooks': reactHooks.configs['recommended-latest'][0].plugins['react-hooks'] },
    rules: {
      ...reactHooks.configs['recommended-latest'][0].rules,
      // Pre-existing findings (D8: "do not fix forty lint findings in the PR that introduces
      // the linter") — see the repo-wide any/unused-vars downgrade below for the full reasoning.
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    // require() is the only way a CommonJS file (this one) loads its own tooling — the rule
    // exists to steer application code toward `import`, which doesn't apply to a build/lint
    // config that runs before any bundler does.
    files: ['eslint.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Pre-existing findings across a 137-file, never-linted codebase — real, but out of scope
    // for the PR that introduces the linter (D8: "do not fix forty lint findings in the PR that
    // introduces the linter"). Downgraded to warn so `eslint --max-warnings` (see package.json's
    // lint script) is the actual gate: today's count passes, any *new* finding of these kinds
    // fails CI, and the threshold ratchets down as each category gets cleaned up in its own pass.
    // (typescript-eslint's plugin is registered repo-wide by tseslint.configs.recommended above,
    // so — unlike react-hooks above — these two are safe to override unscoped.)
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
);
