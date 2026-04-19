const { load, save } = require('./storage');

const ITEM_POOL = [
  // Apparel
  { id: 'hair_brown', name: 'Brown Hair', slot: 'hair', category: 'apparel', color: '#3b2a20' },
  { id: 'hair_blond', name: 'Blond Hair', slot: 'hair', category: 'apparel', color: '#e8c170' },
  { id: 'hair_black', name: 'Black Hair', slot: 'hair', category: 'apparel', color: '#1a1a1a' },
  { id: 'hair_red',   name: 'Red Hair',   slot: 'hair', category: 'apparel', color: '#b5432a' },
  { id: 'hair_blue',  name: 'Blue Hair',  slot: 'hair', category: 'apparel', color: '#1877F2' },
  { id: 'hair_pink',  name: 'Pink Hair',  slot: 'hair', category: 'apparel', color: '#ff77aa' },
  { id: 'shirt_blue',   name: 'Blue Shirt',   slot: 'shirt', category: 'apparel', color: '#1877F2' },
  { id: 'shirt_red',    name: 'Red Shirt',    slot: 'shirt', category: 'apparel', color: '#c0392b' },
  { id: 'shirt_green',  name: 'Green Shirt',  slot: 'shirt', category: 'apparel', color: '#2ecc71' },
  { id: 'shirt_yellow', name: 'Yellow Shirt', slot: 'shirt', category: 'apparel', color: '#f1c40f' },
  { id: 'shirt_purple', name: 'Purple Shirt', slot: 'shirt', category: 'apparel', color: '#8e44ad' },
  { id: 'shirt_white',  name: 'White Shirt',  slot: 'shirt', category: 'apparel', color: '#ffffff' },
  { id: 'pants_gray',  name: 'Gray Pants',  slot: 'pants', category: 'apparel', color: '#5a6373' },
  { id: 'pants_black', name: 'Black Pants', slot: 'pants', category: 'apparel', color: '#1a1a1a' },
  { id: 'pants_brown', name: 'Brown Pants', slot: 'pants', category: 'apparel', color: '#6b4a2b' },
  { id: 'pants_navy',  name: 'Navy Pants',  slot: 'pants', category: 'apparel', color: '#0c2b5a' },
  { id: 'hat_cap',   name: 'Baseball Cap', slot: 'hat', category: 'apparel', color: '#1877F2' },
  { id: 'hat_straw', name: 'Straw Hat',    slot: 'hat', category: 'apparel', color: '#d4a96a' },
  { id: 'hat_wizard', name: 'Wizard Hat',  slot: 'hat', category: 'apparel', color: '#3b2a6a' },
  
  // Consumables (Hunger/Thirst)
  { id: 'food_burger', name: 'Burger', category: 'food', value: 30, color: '#f1c40f' },
  { id: 'food_apple', name: 'Apple', category: 'food', value: 15, color: '#e74c3c' },
  { id: 'drink_water', name: 'Water', category: 'drink', value: 25, color: '#3498db' },
  { id: 'drink_cola', name: 'Cola', category: 'drink', value: 10, color: '#1a1a1a' },
  
  // Furniture (Energy)
  { id: 'furniture_bed', name: 'Wooden Bed', category: 'furniture', color: '#8B4513' },
  { id: 'furniture_table', name: 'Table', category: 'furniture', color: '#5C4033' },
];
const ITEM_PRICE = 10;

function getWeekKey() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = Math.floor((now - start) / 86400000);
  return `${now.getUTCFullYear()}-W${Math.floor(days / 7)}`;
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function getWeeklyShop() {
  const cache = load('shop', {});
  const week = getWeekKey();
  if (cache.week === week) return cache;

  const rand = mulberry32(seedFromString(week));
  const pool = [...ITEM_POOL];
  const items = [];
  const count = Math.min(8, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rand() * pool.length);
    items.push(pool.splice(idx, 1)[0]);
  }
  const shop = { week, items, price: ITEM_PRICE };
  save('shop', shop);
  return shop;
}

function getItemById(id) {
  return ITEM_POOL.find(i => i.id === id);
}

module.exports = { getWeeklyShop, getItemById, ITEM_PRICE, ITEM_POOL };
