const WORLD = {
  width: 1600,
  height: 1200,
  tileSize: 32,
};

const HOUSES = [
  { x: 200, y: 200, w: 160, h: 120, ownerSlot: 0 },
  { x: 500, y: 200, w: 160, h: 120, ownerSlot: 1 },
  { x: 800, y: 200, w: 160, h: 120, ownerSlot: 2 },
  { x: 1100, y: 200, w: 160, h: 120, ownerSlot: 3 },
  { x: 200, y: 800, w: 160, h: 120, ownerSlot: 4 },
  { x: 500, y: 800, w: 160, h: 120, ownerSlot: 5 },
  { x: 800, y: 800, w: 160, h: 120, ownerSlot: 6 },
  { x: 1100, y: 800, w: 160, h: 120, ownerSlot: 7 },
];

const LANDMARKS = [
  { type: 'shop', x: 760, y: 520, w: 96, h: 96, label: 'SHOP' },
  { type: 'board', x: 400, y: 560, w: 64, h: 48, label: 'Community Board' },
  { type: 'board', x: 1140, y: 560, w: 64, h: 48, label: 'Events Board' },
];

function spawnPoint() {
  return {
    x: 800 + (Math.random() * 80 - 40),
    y: 600 + (Math.random() * 80 - 40),
  };
}

function assignHouse(username, assignments) {
  if (assignments[username] !== undefined) return assignments[username];
  const taken = new Set(Object.values(assignments));
  for (let i = 0; i < HOUSES.length; i++) {
    if (!taken.has(i)) { assignments[username] = i; return i; }
  }
  return null;
}

module.exports = { WORLD, HOUSES, LANDMARKS, spawnPoint, assignHouse };
