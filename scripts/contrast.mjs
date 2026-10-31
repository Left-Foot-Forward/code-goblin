#!/usr/bin/env node
// WCAG contrast check for every text/background pairing the game and card use.
// node scripts/contrast.mjs   exits non-zero if any pair fails.
import { THEMES } from '../docs/js/goblin.js';

const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground key, background key, minimum, what it is]
const PAIRS = [
  ['ink', 'paper', 4.5, 'body text'],
  ['muted', 'paper', 4.5, 'secondary text'],
  ['ink', 'paper2', 4.5, 'text on stage'],
  ['muted', 'paper2', 4.5, 'secondary text on stage'],
  ['greenText', 'paper', 4.5, 'green text'],
  ['greenText', 'paper2', 4.5, 'green text on stage'],
  ['pinkText', 'paper', 4.5, 'pink text'],
  ['pinkText', 'paper2', 4.5, 'pink text on stage'],
  ['onGreen', 'greenFill', 4.5, 'level badge text'],
  ['paper', 'ink', 4.5, 'selected tab text'],
  ['greenMark', 'paper', 3, 'green bars and marks'],
  ['greenMark', 'paper2', 3, 'green bars on stage'],
  ['pinkMark', 'paper', 3, 'pink bars and marks'],
  ['pinkMark', 'paper2', 3, 'pink bars on stage'],
  ['ink', 'paper2', 3, 'control borders']
];

let failed = 0;
for (const [name, t] of Object.entries(THEMES)) {
  console.log(`\n${name}`);
  for (const [f, b, min, what] of PAIRS) {
    const r = ratio(t[f], t[b]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (need ${min})  ${what}  ${t[f]} on ${t[b]}`);
  }
}
if (failed) { console.log(`\n${failed} pair(s) fail.`); process.exit(1); }
console.log('\nAll pairs pass.');
