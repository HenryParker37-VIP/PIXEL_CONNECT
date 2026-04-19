const WORLD = {
  width: 3200,
  height: 2400,
  tileSize: 32,
};

const HOUSES = [];
let houseCount = 0;

// Create 13 clusters of 4 (52 total), but stop at 50 plots.
// We'll arrange clusters in a 4 columns by 4 rows grid
const startX = 200;
const startY = 200;
const clusterSpacingX = 500; // Road width is 500 - (160*2 + 20) = 160
const clusterSpacingY = 440; // Road width is 440 - (120*2 + 20) = 180

for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 4; c++) {
    if (houseCount >= 50) break;
    
    // Cluster base position
    const cx = startX + c * clusterSpacingX;
    const cy = startY + r * clusterSpacingY;
    
    // 2x2 houses in this cluster
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        if (houseCount >= 50) break;
        HOUSES.push({
          x: cx + j * 180, // 160 w + 20 px inner gap
          y: cy + i * 140, // 120 h + 20 px inner gap
          w: 160,
          h: 120,
          ownerSlot: houseCount
        });
        houseCount++;
      }
    }
  }
}

const LANDMARKS = [
  { type: 'shop', x: 1550, y: 2000, w: 96, h: 96, label: 'SHOP' },
  { type: 'board', x: 1400, y: 2040, w: 64, h: 48, label: 'Community Board' },
  { type: 'board', x: 1700, y: 2040, w: 64, h: 48, label: 'Events Board' },
  { type: 'job', x: 1850, y: 2040, w: 64, h: 48, label: 'Job Center' },
];

function spawnPoint(houseSlot) {
  if (houseSlot !== undefined && houseSlot !== null && HOUSES[houseSlot]) {
    const h = HOUSES[houseSlot];
    return {
      x: h.x + h.w / 2,
      y: h.y + h.h + 20
    };
  }
  const shop = LANDMARKS.find(l => l.type === 'shop');
  return {
    x: shop.x + shop.w / 2 + (Math.random() * 40 - 20),
    y: shop.y + shop.h + 20,
  };
}

function assignHouse() {
  // Deprecated format. Actual assignment is done on purchase.
  return null; 
}

module.exports = { WORLD, HOUSES, LANDMARKS, spawnPoint, assignHouse };
