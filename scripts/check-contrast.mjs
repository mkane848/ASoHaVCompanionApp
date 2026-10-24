#!/usr/bin/env node
// Composited WCAG contrast of the --ink-* text tones over the surfaces text actually sits on,
// in both appearances. Values mirror styles/tokens.css + styles/appearances.css (keep in sync).
// Usage: node scripts/check-contrast.mjs            (exit 1 if a TEXT token drops below 4.5)
//        CAND=0.6,0.7 node scripts/check-contrast.mjs   (also probe candidate alphas)
const INK = [42, 32, 26];
const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => {
  const [r, g, b] = c.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const surfaces = (panelHex, sidebarHex, groundHex, gold, goldA, dangerA, posting) => {
  const panel = hex(panelHex);
  const s = {
    panel,
    sidebar: hex(sidebarHex),
    'panel+goldTint': over(gold, goldA, panel),
    'panel+dangerTint': over([140, 58, 31], dangerA, panel),
    postingBg: hex(posting),
  };
  if (groundHex) s.ground = hex(groundHex);
  return s;
};
const SURF = {
  parchment: surfaces('#faf6ec', '#e6ddcb', '#efe8da', [157, 124, 51], 0.14, 0.07, '#faf6ec'),
  // Notice Board's bare ground is dark (text there uses --ink-on-ground), so it is not a surface for ink tones.
  noticeboard: surfaces('#ece0c4', '#ddcda0', null, [169, 134, 58], 0.16, 0.09, '#f1e9d4'),
};
// Tokens under test. `text: true` ones are enforced at >= 4.5.
const TOKENS = {
  'ink-35': { a: 0.35 },
  'ink-45': { a: 0.45 },
  'ink-55': { a: 0.55 },
  'ink-65': { a: 0.65 },
  'ink-text-faint': { a: 0.7, text: true },
  'ink-text-muted': { a: 0.76, text: true },
};
for (const a of (process.env.CAND || '').split(',').filter(Boolean)) TOKENS[`cand-${a}`] = { a: +a };
let fail = false;
for (const [name, { a, text }] of Object.entries(TOKENS)) {
  let min = 99;
  const rows = [];
  for (const [ap, surfs] of Object.entries(SURF)) {
    for (const [s, bg] of Object.entries(surfs)) {
      const r = ratio(over(INK, a, bg), bg);
      min = Math.min(min, r);
      rows.push(`${ap}/${s} ${r.toFixed(2)}`);
    }
  }
  if (text && min < 4.5) fail = true;
  console.log(`${name.padEnd(15)} a=${a} min ${min.toFixed(2)}  ${rows.join(' | ')}`);
}
process.exit(fail ? 1 : 0);
