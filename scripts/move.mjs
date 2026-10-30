#!/usr/bin/env node
// Handles a README "move": an issue titled "goblin: feed|pet|cheer". Updates the shared
// moves, re-renders the card, replies in the goblin's voice and closes the issue.
// Issue text is untrusted: it only ever arrives through env vars and is matched against a fixed list.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rest } from './lib/github.mjs';
import { writeCards } from './card.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'docs', 'data');
const read = (f, fallback) => existsSync(join(DATA, f)) ? JSON.parse(readFileSync(join(DATA, f), 'utf8')) : fallback;
const pick = a => a[Math.floor(Math.random() * a.length)];
const COOLDOWN = 10 * 60 * 1000;

const REPLIES = {
  feed: ['*CHOMP.* Tastes like a well-scoped pull request. More.', 'Mmm. Crunchy, like a freshly deleted config file.', 'The hoard grows. The goblin grows. Everyone wins.'],
  pet: ['The goblin purrs like a CI runner on a green build.', '*leans into it.* Fine. You may stay.', 'Ears twitch happily. That is the nice twitch, not the merge-conflict twitch.'],
  cheer: ['GOBLIN. GOBLIN. GOBLIN. The whole org can hear it.', 'The goblin does a small, dignified jig on the hoard.', 'Cheer received. Morale +1. Velocity, somehow, +2.']
};

async function main() {
  const title = String(process.env.ISSUE_TITLE || '').trim().toLowerCase();
  const who = String(process.env.ISSUE_USER || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 39);
  const number = Number(process.env.ISSUE_NUMBER);
  const repo = process.env.GITHUB_REPOSITORY;
  const m = /^goblin:\s*(feed|pet|cheer)\b/.exec(title);
  if (!m || !who || !number || !repo) { console.log('Not a goblin move, skipping.'); return; }
  const what = m[1];

  const moves = read('moves.json', { total: 0, people: {}, log: [] });
  const now = Date.now();
  const me = moves.people[who] || { n: 0, at: 0 };
  let reply;
  if (now - me.at < COOLDOWN) {
    reply = `The goblin is still digesting your last ${what}. Try again in a few minutes, @${who}.`;
  } else {
    me.n++; me.at = now; moves.people[who] = me;
    moves.total = (moves.total || 0) + 1;
    moves[what] = (moves[what] || 0) + 1;
    moves.log = [{ who, what, at: new Date(now).toISOString() }, ...(moves.log || [])].slice(0, 12);
    writeFileSync(join(DATA, 'moves.json'), JSON.stringify(moves, null, 1) + '\n');
    const hoard = read('hoard.json', null);
    if (hoard) writeCards(hoard, moves, read('avatars.json', {}), repo);
    reply = `${pick(REPLIES[what])}\n\n@${who} has cheered the goblin ${me.n}× · ${moves.total} moves from ${Object.keys(moves.people).length} people so far.`;
  }
  await rest('POST', `/repos/${repo}/issues/${number}/comments`, { body: reply });
  await rest('PATCH', `/repos/${repo}/issues/${number}`, { state: 'closed', state_reason: 'completed' });
  console.log(`${who} ${what}: ${moves.total} total.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
