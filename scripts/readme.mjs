// Keeps the README's live blocks up to date: the card with its alt text and action links,
// and the Hall of Fame once that room is built. Everything outside the markers is left alone.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardAlt } from './card.mjs';
import { monthLabel } from './lib/quests.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function links(repo) {
  if (!repo) return null;
  const [o, r] = repo.split('/');
  const base = `https://github.com/${repo}/issues/new`;
  return {
    play: `https://${o.toLowerCase()}.github.io/${r}/`,
    thanks: `${base}?template=thanks.yml`, bounty: `${base}?template=bounty.yml`, fund: `${base}?template=fund.yml`,
    cheer: `${base}?title=${encodeURIComponent('goblin: cheer')}&body=${encodeURIComponent('Submitting this issue tells the goblin. A bot will reply and close it.')}`
  };
}

const replaceBlock = (md, name, body) => {
  const re = new RegExp(`<!-- goblin:${name} -->[\\s\\S]*?<!-- /goblin:${name} -->`);
  return re.test(md) ? md.replace(re, `<!-- goblin:${name} -->\n${body}\n<!-- /goblin:${name} -->`) : md;
};

export function writeReadme(realm) {
  const path = join(ROOT, 'README.md');
  if (!existsSync(path) || realm.demo) return;
  const L = links(realm.repo);
  if (!L) return;
  const alt = cardAlt(realm).replace(/"/g, "'");
  let md = readFileSync(path, 'utf8');
  md = replaceBlock(md, 'links', `<a href="${L.play}"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/card-dark.svg">
  <img alt="${alt}" src="docs/card.svg" width="100%">
</picture></a>

**[▶ Visit the Den](${L.play})** · [Thank a teammate](${L.thanks}) · [Post a bounty](${L.bounty}) · [Fund a room](${L.fund}) · [Cheer](${L.cheer})`);
  if (realm.plaques.length) {
    md = replaceBlock(md, 'hall', `## Hall of Fame\n\n| Month | Most merges | Most reviews | Most thanked |\n| --- | --- | --- | --- |\n`
      + realm.plaques.map(p => {
        const get = t => { const e = p.entries.find(x => x.title === t); return e ? `${e.login} (${e.n})` : '·'; };
        return `| ${monthLabel(p.month)} | ${get('Most merges')} | ${get('Most reviews')} | ${get('Most thanked')} |`;
      }).join('\n'));
  }
  writeFileSync(path, md);
}
