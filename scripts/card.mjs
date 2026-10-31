// Renders the README card (light and dark) from realm.json. Self-contained SVG: GitHub shows
// SVGs as images, so no scripts or external fonts; CSS animation still works.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goblin, den, defs, goblinCSS, THEMES, esc } from '../docs/js/goblin.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERIF = `'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// Plain-language description: the card's accessible name and the README image alt text.
export function cardAlt(r) {
  const room = r.rooms.find(x => x.id === r.current);
  const s = r.shoutouts;
  const names = [s.merger && `top merger ${s.merger.login}`, s.reviewer && `top reviewer ${s.reviewer.login}`, s.thanked && `most thanked ${s.thanked.login}`].filter(Boolean);
  return `${r.name}, the ${r.owner} code goblin, is level ${r.level} with ${plural(r.scrollsAll, 'scroll')} hoarded and ${r.treasury.gold} gold in the treasury.`
    + (room ? ` The team is building the ${room.name}: ${room.funded.scrolls} of ${room.cost.scrolls} scrolls and ${room.funded.gold} of ${room.cost.gold} gold.` : ' Every room in the Den is built.')
    + ` ${r.month.label} so far: ${r.month.merges} merged, ${r.month.reviews} reviews, ${r.month.issues} issues resolved.`
    + (names.length ? ` Shout-outs: ${names.join(', ')}.` : '')
    + (r.bounties.open.length ? ` ${plural(r.bounties.open.length, 'open bounty', 'open bounties')}.` : '');
}

export function renderCard(r, avatars = {}, theme = 'light') {
  const t = THEMES[theme], W = 880, H = 340, B = `style="mix-blend-mode:${t.blend}"`, x0 = 318;
  const built = r.rooms.filter(x => x.builtAt).map(x => x.id);
  const room = r.rooms.find(x => x.id === r.current);
  const thanksMonth = r.thanks.filter(x => x.at.slice(0, 7) === r.month.key).length;
  const stat = (i, value, label, ink = t.ink) => `<text x="${x0 + i * 108}" y="214" font-family="${SERIF}" font-style="italic" font-size="30" fill="${ink}">${esc(value)}</text>
    <text x="${x0 + i * 108}" y="233" font-family="${MONO}" font-size="11" letter-spacing=".8" fill="${t.muted}">${esc(label)}</text>`;
  const stamp = (i, p, role, unit) => {
    const x = x0 + i * 182, y = 256;
    if (!p) return `<g transform="translate(${x} ${y})"><circle cx="16" cy="16" r="15" fill="none" stroke="${t.ink}" stroke-dasharray="3 3" opacity=".5"/>
      <text x="40" y="13" font-family="${MONO}" font-size="10.5" letter-spacing=".8" fill="${t.muted}">${role}</text><text x="40" y="28" font-family="${SANS}" font-size="13" fill="${t.muted}">up for grabs</text></g>`;
    const img = avatars[p.login];
    return `<g transform="translate(${x} ${y})"><clipPath id="av${i}${theme}"><circle cx="16" cy="16" r="15"/></clipPath>
      ${img ? `<image href="${img}" x="1" y="1" width="30" height="30" clip-path="url(#av${i}${theme})" style="filter:grayscale(1) contrast(1.1) brightness(1.25)"/><circle cx="16" cy="16" r="15" fill="${i === 1 ? t.pink : t.green}" ${B} opacity=".5"/>`
        : `<circle cx="16" cy="16" r="15" fill="url(#c${theme}-dg)"/>`}
      <circle cx="16" cy="16" r="15" fill="none" stroke="${t.ink}" stroke-width="1.4"/>
      <text x="40" y="13" font-family="${MONO}" font-size="10.5" letter-spacing=".8" fill="${t.muted}">${role} · ${esc(plural(p.n, unit))}</text>
      <text x="40" y="29" font-family="${SANS}" font-weight="600" font-size="13.5" fill="${t.ink}">@${esc(clip(p.login, 15))}</text></g>`;
  };
  const bar = (y, label, have, need, ink) => `<text y="${y}" font-family="${MONO}" font-size="11" fill="${t.muted}">${label} ${have}/${need}</text>
    <rect x="130" y="${y - 9}" width="390" height="10" fill="none" stroke="${t.ink}" stroke-width="1.1"/>
    <rect x="130" y="${y - 9}" width="${(390 * Math.min(1, have / Math.max(1, need))).toFixed(1)}" height="10" fill="${ink}"/>`;
  const qDone = r.quests.filter(q => q.done || q.progress >= q.target).length;
  const nextQ = r.quests.find(q => q.progress < q.target);
  const top = r.bounties.open[0];
  const left = r.quests.length ? `This week: ${qDone} of ${r.quests.length} quests done${nextQ ? ` · next: ${nextQ.title}` : ''}`
    : top ? `Top bounty: ${top.gold} gold on ${top.target.private ? 'a private issue' : `${top.target.repo}#${top.target.number}`}`
      : 'Build the Library to start weekly quests.';
  const lastThanks = r.thanks[0];
  const right = lastThanks ? `@${clip(lastThanks.from, 14)} thanked @${clip(lastThanks.to, 14)} · ${lastThanks.gold} gold` : 'Thank a teammate to start the thanks wall';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cardAlt(r))}">
<style>${goblinCSS()}</style>
${defs('c' + theme, theme)}
<rect width="${W}" height="${H}" fill="${t.paper}"/>
<rect x="9" y="9" width="${W - 18}" height="${H - 18}" fill="none" stroke="${t.pink}" stroke-width="2" ${B}/>
<rect x="7" y="7.5" width="${W - 18}" height="${H - 18}" fill="none" stroke="${t.ink}" stroke-width="1.5"/>
<circle cx="150" cy="190" r="120" fill="url(#c${theme}-dp)" opacity=".3" ${B}/>
<g transform="translate(16 16) scale(1.12)">${den({ p: 'c' + theme, theme, built })}${goblin({ p: 'c' + theme, theme, level: r.level, mood: r.mood, seed: r.level * 7 + 3 })}</g>
<text x="${x0}" y="50" font-family="${MONO}" font-size="11" letter-spacing="1.4" fill="${t.ink}">${esc(clip(`THE ${r.owner.toUpperCase()} DEN${r.demo ? ' · DEMO DATA' : ''} · TREASURY ${fmt(r.treasury.gold)} GOLD`, 70))}</text>
<g font-family="${SERIF}" font-style="italic" font-size="44">
  <text x="${x0 + 1.6}" y="96" fill="${t.pink}" ${B}>${esc(r.name)}, the code goblin</text>
  <text x="${x0}" y="94.5" fill="${t.ink}">${esc(r.name)}, the code goblin</text>
</g>
<g transform="translate(${x0} 112)">
  <rect width="78" height="24" fill="${t.greenFill}"/><text x="39" y="16.5" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="12" letter-spacing="1" fill="${t.onGreen}">LEVEL ${r.level}</text>
  <text x="90" y="16.5" font-family="${MONO}" font-size="11.5" fill="${t.ink}">${esc(`${fmt(r.scrollsAll)} scrolls hoarded · ${built.length} of ${r.rooms.length} rooms built`)}</text>
</g>
<g transform="translate(${x0} 154)">
  <text y="0" font-family="${SANS}" font-weight="600" font-size="13" fill="${t.ink}">${room ? `Building the ${esc(room.name)}` : 'The Den is complete'}</text>
  ${room ? `${bar(18, 'SCROLLS', room.funded.scrolls, room.cost.scrolls, t.greenMark)}${bar(33, 'GOLD', room.funded.gold, room.cost.gold, t.pinkMark)}` : ''}
</g>
${stat(0, fmt(r.month.merges), `MERGED · ${r.month.label.slice(0, 3).toUpperCase()}`)}
${stat(1, fmt(r.month.reviews), 'REVIEWS')}
${stat(2, fmt(r.month.issues), 'ISSUES SOLVED', t.greenText)}
${stat(3, fmt(r.month.comments), 'COMMENTS')}
${stat(4, fmt(thanksMonth), 'THANKS SENT', t.pinkText)}
${stamp(0, r.shoutouts.merger, 'TOP MERGER', 'merge')}
${stamp(1, r.shoutouts.thanked, 'MOST THANKED', 'gold')}
${stamp(2, r.shoutouts.reviewer, 'TOP REVIEWER', 'review')}
<line x1="24" y1="303" x2="${W - 24}" y2="303" stroke="${t.ink}" stroke-width="1" opacity=".35"/>
<text x="26" y="322" font-family="${MONO}" font-size="11" fill="${t.ink}">${esc(clip(left, 66))}</text>
<text x="${W - 26}" y="322" text-anchor="end" font-family="${MONO}" font-size="11" fill="${t.muted}">${esc(clip(right, 52))}</text>
<rect width="${W}" height="${H}" filter="url(#c${theme}-grain)" fill="${t.ink}"/>
</svg>`;
}

export function writeCards(realm, avatars) {
  for (const theme of ['light', 'dark']) writeFileSync(join(ROOT, 'docs', theme === 'light' ? 'card.svg' : 'card-dark.svg'), renderCard(realm, avatars, theme));
}
