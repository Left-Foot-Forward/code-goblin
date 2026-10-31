// The goblin's Den. Rooms are crowdfunded with scrolls and gold; each one unlocks something real.
export const ROOMS = [
  { id: 'library', name: 'Library', cost: { scrolls: 20, gold: 60 }, unlock: 'Weekly quests: three team challenges every Monday, with rewards for everyone who helps.' },
  { id: 'tavern', name: 'Tavern', cost: { scrolls: 15, gold: 120 }, unlock: 'The treasury adds 50% to every thanks, up to 5 gold, once per pair of people a week.' },
  { id: 'forge', name: 'Forge', cost: { scrolls: 40, gold: 150 }, unlock: 'Team banners on the README card and the realm.' },
  { id: 'observatory', name: 'Observatory', cost: { scrolls: 60, gold: 250 }, unlock: 'At the start of each month the goblin opens a retrospective issue about the month.' },
  { id: 'hall', name: 'Hall of Fame', cost: { scrolls: 80, gold: 400 }, unlock: 'Permanent monthly plaques for top mergers, reviewers and the most thanked, in the README.' }
];

export const roomCost = (room, config) => ({
  scrolls: Math.ceil(room.cost.scrolls * (config.roomCostScale || 1)),
  gold: Math.ceil(room.cost.gold * (config.roomCostScale || 1))
});

export const findRoom = name => {
  const n = String(name || '').trim().toLowerCase();
  return ROOMS.find(r => r.id === n || r.name.toLowerCase() === n || r.name.toLowerCase().replace(/\s+/g, '') === n.replace(/\s+/g, '')) || null;
};
