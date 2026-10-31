// Renders the README card (light and dark) from the shared hoard. Self-contained SVG:
// GitHub shows SVGs as images, so no scripts or external fonts; CSS animation still works.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goblin, defs, goblinCSS, THEMES, esc } from '../docs/js/goblin.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERIF = `'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;

const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Plain-language description, used as the card's accessible name and the README image alt text.
export function cardAlt(hoard, moves) {
  const so = hoard.shoutouts || {}, mo = hoard.month, wk = hoard.thisWeek;
  const people = [so.feeder && `top feeder @${so.feeder.login}`, so.cleanup && `cleanup hero @${so.cleanup.login}`, so.sage && `review sage @${so.sage.login}`].filter(Boolean);
  return `${hoard.name}, the ${hoard.owner} code goblin, is level ${hoard.level}. ${mo.label}: ${mo.merged} of ${mo.goal} merged pull requests${mo.merged >= mo.goal ? ', goal smashed' : ''}.`
    + (wk ? ` This week: ${wk.merged} merged.` : '')
    + (hoard.teamOfMonth ? ` Team of the month: ${hoard.teamOfMonth}.` : '')
    + (people.length ? ` Shout-outs: ${people.join(', ')}.` : '')
    + (moves?.total ? ` Cheered ${moves.total === 1 ? 'once' : `${moves.total} times`}.` : '');
}

export function renderCard(hoard, moves, avatars = {}, theme = 'light', playUrl = '') {
  const t = THEMES[theme], W = 880, H = 340, B = `style="mix-blend-mode:${t.blend}"`;
  const tot = hoard.totals, mo = hoard.month, so = hoard.shoutouts || {};
  const goalPct = Math.min(1, mo.merged / Math.max(1, mo.goal));
  const x0 = 318;

  const stat = (i, value, label, ink) => {
    const x = x0 + i * 108;
    return `<text x="${x}" y="214" font-family="${SERIF}" font-style="italic" font-size="30" fill="${ink}">${esc(value)}</text>
      <text x="${x}" y="233" font-family="${MONO}" font-size="11" letter-spacing=".8" fill="${t.muted}">${esc(label)}</text>`;
  };
  const stamp = (i, person, role) => {
    const x = x0 + i * 182, y = 256;
    if (!person) return `<g transform="translate(${x} ${y})"><circle cx="16" cy="16" r="15" fill="none" stroke="${t.ink}" stroke-dasharray="3 3" opacity=".5"/>
      <text x="40" y="13" font-family="${MONO}" font-size="10.5" letter-spacing=".8" fill="${t.muted}">${role}</text>
      <text x="40" y="28" font-family="${SANS}" font-size="13" fill="${t.muted}">up for grabs</text></g>`;
    const img = avatars[person.login];
    return `<g transform="translate(${x} ${y})">
      <clipPath id="av${i}${theme}"><circle cx="16" cy="16" r="15"/></clipPath>
      ${img ? `<image href="${img}" x="1" y="1" width="30" height="30" clip-path="url(#av${i}${theme})" style="filter:grayscale(1) contrast(1.1) brightness(1.25)"/>
        <circle cx="16" cy="16" r="15" fill="${i === 1 ? t.pink : t.green}" ${B} opacity=".5"/>` : `<circle cx="16" cy="16" r="15" fill="url(#c${theme}-dg)"/>`}
      <circle cx="16" cy="16" r="15" fill="none" stroke="${t.ink}" stroke-width="1.4"/>
      <text x="40" y="13" font-family="${MONO}" font-size="10.5" letter-spacing=".8" fill="${t.muted}">${role}</text>
      <text x="40" y="29" font-family="${SANS}" font-weight="600" font-size="13.5" fill="${t.ink}">@${esc(clip(person.login, 15))}</text></g>`;
  };
  const last = (hoard.feast || [])[0];
  const lastLine = !last ? 'The hoard is empty. Merge something tasty.'
    : last.sealed ? `Last devoured: a sealed scroll (+${fmt(last.additions)} −${fmt(last.deletions)})`
      : `Last devoured: “${clip(last.title, 46)}” by @${clip(last.author, 18)}`;
  const fans = Object.keys(moves?.people || {}).length;
  const cheers = moves?.total ? `cheered ${moves.total}× by ${fans} ${fans === 1 ? 'person' : 'people'}` : 'be the first to cheer';

  const wk = hoard.thisWeek;
  const kicker = `THE ${hoard.owner.toUpperCase()} HOARD${hoard.demo ? ' · DEMO DATA' : ''}${wk ? ` · THIS WEEK ${wk.merged} MERGED${wk.people ? ` BY ${wk.people} ${wk.people === 1 ? 'PERSON' : 'PEOPLE'}` : ''}` : ''}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cardAlt(hoard, moves))}">
<style>${goblinCSS()}</style>
${defs('c' + theme, theme)}
<rect width="${W}" height="${H}" fill="${t.paper}"/>
<rect x="9" y="9" width="${W - 18}" height="${H - 18}" fill="none" stroke="${t.pink}" stroke-width="2" ${B}/>
<rect x="7" y="7.5" width="${W - 18}" height="${H - 18}" fill="none" stroke="${t.ink}" stroke-width="1.5"/>
<circle cx="150" cy="190" r="120" fill="url(#c${theme}-dp)" opacity=".35" ${B}/>
<g transform="translate(16 16) scale(1.12)">${goblin({ p: 'c' + theme, theme, level: hoard.level, mood: hoard.mood, seed: hoard.level * 7 + 3 })}</g>

<text x="${x0}" y="50" font-family="${MONO}" font-size="11" letter-spacing="1.4" fill="${t.ink}">${esc(clip(kicker, 72))}</text>
<g font-family="${SERIF}" font-style="italic" font-size="44">
  <text x="${x0 + 1.6}" y="96" fill="${t.pink}" ${B}>${esc(hoard.name)}, the code goblin</text>
  <text x="${x0}" y="94.5" fill="${t.ink}">${esc(hoard.name)}, the code goblin</text>
</g>
<g transform="translate(${x0} 112)">
  <rect width="78" height="24" fill="${t.greenFill}"/><text x="39" y="16.5" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="12" letter-spacing="1" fill="${t.onGreen}">LEVEL ${hoard.level}</text>
  <rect x="88" y="9" width="120" height="6" fill="none" stroke="${t.ink}" stroke-width="1"/><rect x="88" y="9" width="${(120 * hoard.levelProgress).toFixed(1)}" height="6" fill="${t.ink}"/>
  <text x="218" y="16.5" font-family="${MONO}" font-size="11" fill="${t.muted}">${fmt(tot.mergedAllTime)} PRs devoured all-time</text>
</g>
<g transform="translate(${x0} 150)">
  <text y="0" font-family="${SANS}" font-weight="600" font-size="13" fill="${t.ink}">${esc(mo.label)} feast · ${mo.merged} / ${mo.goal} merged PRs${mo.merged >= mo.goal ? ' · goal smashed' : ''}${hoard.teamOfMonth ? ` · team of the month: ${esc(clip(hoard.teamOfMonth, 24))}` : ''}</text>
  <rect y="9" width="520" height="14" fill="none" stroke="${t.ink}" stroke-width="1.2"/>
  <rect y="9" width="${(520 * goalPct).toFixed(1)}" height="14" fill="${t.pinkMark}"/>
  <rect y="9" width="${(520 * goalPct).toFixed(1)}" height="14" fill="url(#c${theme}-dp)" ${B}/>
</g>
${stat(0, fmt(tot.merged), `MERGED · ${hoard.windowDays}D`, t.ink)}
${stat(1, '+' + fmt(tot.additions), 'LINES ADDED', t.greenText)}
${stat(2, '−' + fmt(tot.deletions), 'LINES DELETED', t.pinkText)}
${stat(3, fmt(tot.reviews), 'REVIEWS', t.ink)}
${stat(4, fmt(tot.contributors), 'FEEDERS', t.ink)}
${stamp(0, so.feeder, 'TOP FEEDER')}
${stamp(1, so.cleanup, 'CLEANUP HERO')}
${stamp(2, so.sage, 'REVIEW SAGE')}
<line x1="24" y1="303" x2="${W - 24}" y2="303" stroke="${t.ink}" stroke-width="1" opacity=".35"/>
<text x="26" y="322" font-family="${MONO}" font-size="11" fill="${t.ink}">${esc(lastLine)}</text>
<text x="${W - 26}" y="322" text-anchor="end" font-family="${MONO}" font-size="11" fill="${t.muted}">${esc(cheers)}${playUrl ? ' · play ↗' : ''}</text>
<rect width="${W}" height="${H}" filter="url(#c${theme}-grain)" fill="${t.ink}"/>
</svg>`;
}

export function writeCards(hoard, moves, avatars, repoSlug) {
  let playUrl = '';
  if (repoSlug) { const [o, r] = repoSlug.split('/'); playUrl = `https://${o.toLowerCase()}.github.io/${r}/`; }
  for (const theme of ['light', 'dark']) {
    writeFileSync(join(ROOT, 'docs', theme === 'light' ? 'card.svg' : 'card-dark.svg'), renderCard(hoard, moves, avatars, theme, playUrl));
  }
}
