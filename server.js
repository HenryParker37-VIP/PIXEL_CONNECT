const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const auth = require('./src/auth');
const shop = require('./src/shop');
const posts = require('./src/posts');
const world = require('./src/world');
const { load, save } = require('./src/storage');

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = auth.verifyToken(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.session = session;
  next();
}

// ---- Analytics ----
let serverStats = load('stats', { allTimeVisits: 0 });
function recordVisit() {
  serverStats.allTimeVisits++;
  save('stats', serverStats);
  broadcastStats();
}
function broadcastStats() {
  broadcast({ type: 'stats', visitors: serverStats.allTimeVisits, online: clients.size });
}

// ---- Auth ----
app.post('/api/register', async (req, res) => {
  try {
    const result = await auth.register(req.body);
    recordVisit();
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const result = await auth.login(req.body);
    recordVisit();
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/backup/regenerate', requireAuth, async (req, res) => {
  try {
    const code = await auth.regenerateBackupCode(req.session.userKey);
    res.json({ backupCode: code });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Player / Profile ----
app.get('/api/me', requireAuth, (req, res) => {
  const { user } = req.session;
  res.json({
    username: user.username,
    email: user.email,
    coins: user.coins,
    inventory: user.inventory,
    equipped: user.equipped,
    avatar: user.avatar,
    houseName: user.houseName,
    bio: user.bio || '',
    allowedUsers: user.allowedUsers || [],
    houseSlot: assignments[user.username],
    hunger: user.hunger, thirst: user.thirst, energy: user.energy,
    furniture: user.furniture || []
  });
});

app.post('/api/me/equip', requireAuth, (req, res) => {
  const { itemId } = req.body;
  const { user } = req.session;
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  const item = shop.getItemById(itemId);
  if (!item) return res.status(400).json({ error: 'Unknown item' });
  if (!u.inventory.includes(itemId)) return res.status(400).json({ error: 'Item not owned' });
  u.equipped[item.slot] = itemId;
  auth.saveUsers(users);
  broadcastAppearance(u.username);
  res.json({ equipped: u.equipped });
});

app.post('/api/me/consume', requireAuth, (req, res) => {
  const { itemId } = req.body;
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  const item = shop.getItemById(itemId);
  if (!item || !['food', 'drink'].includes(item.category)) return res.status(400).json({ error: 'Not consumable' });
  const idx = u.inventory.indexOf(itemId);
  if (idx === -1) return res.status(400).json({ error: 'Item not owned' });
  
  u.inventory.splice(idx, 1);
  if (item.category === 'food') u.hunger = Math.min(100, (u.hunger || 100) + item.value);
  if (item.category === 'drink') u.thirst = Math.min(100, (u.thirst || 100) + item.value);
  
  auth.saveUsers(users);
  res.json({ hunger: u.hunger, thirst: u.thirst, inventory: u.inventory });
});

app.post('/api/me/work', requireAuth, (req, res) => {
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  if ((u.hunger||100) < 10 || (u.thirst||100) < 10 || (u.energy||100) < 20) {
    return res.status(400).json({ error: 'Too exhausted or hungry to work! Eat or sleep.' });
  }
  u.hunger -= 10;
  u.thirst -= 10;
  u.energy -= 20;
  u.coins += 50;
  auth.saveUsers(users);
  res.json({ coins: u.coins, hunger: u.hunger, thirst: u.thirst, energy: u.energy });
});

app.post('/api/me/sleep', requireAuth, (req, res) => {
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  u.energy = 100;
  auth.saveUsers(users);
  res.json({ energy: u.energy });
});

app.post('/api/me/house', requireAuth, (req, res) => {
  const { houseName } = req.body;
  if (!houseName || houseName.length > 40) return res.status(400).json({ error: 'Invalid name' });
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  u.houseName = houseName.trim();
  auth.saveUsers(users);
  res.json({ houseName: u.houseName });
});

app.post('/api/house/settings', requireAuth, (req, res) => {
  const { bio, keys } = req.body;
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  if (bio !== undefined) u.bio = String(bio).slice(0, 100);
  if (keys !== undefined) {
    u.allowedUsers = String(keys).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  auth.saveUsers(users);
  res.json({ bio: u.bio, allowedUsers: u.allowedUsers });
});

app.post('/api/land/buy', requireAuth, (req, res) => {
  const { slot } = req.body;
  if (!Number.isInteger(slot) || slot < 0 || slot >= world.HOUSES.length) return res.status(400).json({ error: 'Invalid plot' });
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  
  const takenSlots = Object.values(assignments);
  if (takenSlots.includes(slot)) return res.status(400).json({ error: 'Plot already owned' });
  if (assignments[u.username.toLowerCase()]) return res.status(400).json({ error: 'You already own land' });
  
  if (u.coins < 500) return res.status(400).json({ error: 'Not enough Xu (Need 500)' });
  u.coins -= 500;
  
  assignments[u.username.toLowerCase()] = slot;
  saveAssignments(assignments);
  auth.saveUsers(users);
  
  res.json({ coins: u.coins, slot });
});

app.post('/api/house/enter', requireAuth, (req, res) => {
  const { slot } = req.body;
  if (!Number.isInteger(slot)) return res.status(400).json({ error: 'Invalid plot' });
  
  let ownerKey = Object.keys(assignments).find(k => assignments[k] === slot);
  if (!ownerKey) return res.status(400).json({ error: 'House is vacant' });
  
  const users = auth.loadUsers();
  if (ownerKey.toLowerCase() !== req.session.userKey) {
    const owner = users[ownerKey.toLowerCase()];
    const allowed = ((owner && owner.allowedUsers) || []).map(s => s.toLowerCase());
    if (!allowed.includes(req.session.userKey)) {
      return res.status(403).json({ error: "Locked! You don't have a key." });
    }
  }
  
  const owner = users[ownerKey.toLowerCase()];
  res.json({ success: true, houseName: owner.houseName, ownerKey: ownerKey.toLowerCase(), furniture: owner.furniture || [] });
});

app.post('/api/house/furniture', requireAuth, (req, res) => {
  const { itemId, cellIdx } = req.body;
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  if (!u.furniture) u.furniture = [];
  
  if (itemId) {
    const item = shop.getItemById(itemId);
    if (!item || item.category !== 'furniture') return res.status(400).json({ error: 'Not furniture' });
    const idx = u.inventory.indexOf(itemId);
    if (idx === -1) return res.status(400).json({ error: 'Item not owned' });
    
    u.inventory.splice(idx, 1);
    u.furniture.push({ itemId, cellIdx });
  } else {
    const fIdx = u.furniture.findIndex(f => f.cellIdx === cellIdx);
    if (fIdx !== -1) {
      const removed = u.furniture.splice(fIdx, 1)[0];
      u.inventory.push(removed.itemId);
    }
  }
  
  auth.saveUsers(users);
  res.json({ furniture: u.furniture, inventory: u.inventory });
});

// ---- Shop ----
app.get('/api/shop', requireAuth, (req, res) => {
  res.json(shop.getWeeklyShop());
});

app.post('/api/shop/buy', requireAuth, (req, res) => {
  const { itemId } = req.body;
  const weekly = shop.getWeeklyShop();
  const item = weekly.items.find(i => i.id === itemId);
  if (!item) return res.status(400).json({ error: 'Item not in shop' });

  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  if (u.inventory.includes(itemId)) return res.status(400).json({ error: 'Already owned' });
  if (u.coins < weekly.price) return res.status(400).json({ error: 'Not enough coins' });

  u.coins -= weekly.price;
  u.inventory.push(itemId);
  auth.saveUsers(users);
  res.json({ coins: u.coins, inventory: u.inventory });
});

// ---- Posts ----
app.get('/api/posts', requireAuth, (req, res) => {
  res.json(posts.listPostsFor(req.session.user.username));
});

app.get('/api/posts/board/:boardId', requireAuth, (req, res) => {
  res.json(posts.listPostsFor(req.session.user.username).slice(0, 50));
});

app.get('/api/posts/user/:username', requireAuth, (req, res) => {
  res.json(posts.postsByAuthor(req.params.username));
});

app.post('/api/posts', requireAuth, (req, res) => {
  try {
    const post = posts.createPost({
      author: req.session.user.username,
      content: req.body.content,
      visibility: req.body.visibility || 'public',
      audience: req.body.audience || [],
    });
    res.json(post);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/posts/:id/like', requireAuth, (req, res) => {
  try {
    res.json(posts.likePost(req.params.id, req.session.user.username));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/posts/:id/comment', requireAuth, (req, res) => {
  try {
    res.json(posts.commentOnPost(req.params.id, req.session.user.username, req.body.text));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- World ----
app.get('/api/world', requireAuth, (req, res) => {
  const users = auth.loadUsers();
  const houseOwners = {};
  for (const [uname, slot] of Object.entries(assignments)) {
    const u = users[uname.toLowerCase()];
    if (u) houseOwners[slot] = { username: u.username, houseName: u.houseName, bio: u.bio || '' };
  }
  res.json({ world: world.WORLD, houses: world.HOUSES, landmarks: world.LANDMARKS, houseOwners });
});

// ---- House assignments ----
let assignments = load('assignments', {});
function loadAssignments() { assignments = load('assignments', {}); return assignments; }
function saveAssignments(a) { save('assignments', a); }

// ---- Server + WebSocket ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map(); // ws -> { username, x, y, dir, moving }

function broadcast(msg, filter) {
  const data = JSON.stringify(msg);
  for (const [ws, meta] of clients.entries()) {
    if (ws.readyState !== 1) continue;
    if (filter && !filter(meta, ws)) continue;
    ws.send(data);
  }
}

function getAppearance(username) {
  const users = auth.loadUsers();
  const u = users[username.toLowerCase()];
  if (!u) return null;
  return { avatar: u.avatar, equipped: u.equipped };
}

function broadcastAppearance(username) {
  const appearance = getAppearance(username);
  if (!appearance) return;
  broadcast({ type: 'appearance', username, appearance });
}

function playerSnapshot(meta) {
  return {
    username: meta.username,
    x: meta.x, y: meta.y, dir: meta.dir, moving: meta.moving,
    appearance: meta.appearance,
    scene: meta.scene,
  };
}

function nearbyUsernames(meta, radius = 96) {
  const list = [];
  for (const other of clients.values()) {
    if (other.username === meta.username || other.scene !== meta.scene) continue;
    const dx = other.x - meta.x, dy = other.y - meta.y;
    if (dx*dx + dy*dy <= radius*radius) list.push(other.username);
  }
  return list;
}

function findClientByUsername(username) {
  for (const [ws, meta] of clients.entries()) {
    if (meta.username === username) return { ws, meta };
  }
  return null;
}

wss.on('connection', (ws) => {
  let meta = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'auth') {
      const session = auth.verifyToken(msg.token);
      if (!session) { ws.send(JSON.stringify({ type: 'error', error: 'bad token' })); ws.close(); return; }
      // Disconnect prior session for same user
      for (const [otherWs, otherMeta] of clients.entries()) {
        if (otherMeta.username === session.user.username) {
          clients.delete(otherWs);
          try { otherWs.close(); } catch {}
          broadcast({ type: 'despawn', username: otherMeta.username });
        }
      }
      const uKey = session.user.username.toLowerCase();
      const spawn = world.spawnPoint(assignments[uKey]);
      meta = {
        username: session.user.username,
        x: spawn.x, y: spawn.y, dir: 'down', moving: false,
        scene: 'main',
        appearance: getAppearance(session.user.username),
        lastMove: Date.now(),
      };
      clients.set(ws, meta);
      broadcastStats();

      ws.send(JSON.stringify({
        type: 'welcome',
        you: playerSnapshot(meta),
        players: [...clients.values()].filter(m => m.username !== meta.username && m.scene === meta.scene).map(playerSnapshot),
      }));
      broadcast({ type: 'spawn', player: playerSnapshot(meta) }, m => m.username !== meta.username && m.scene === meta.scene);
      return;
    }

    if (!meta) return;

    if (msg.type === 'scene_change') {
      const { scene, x, y } = msg;
      
      // Permissions check for interiors
      if (scene !== 'main' && scene.startsWith('interior_')) {
        const slot = parseInt(scene.split('_')[1], 10);
        let ownerKey = Object.keys(assignments).find(k => assignments[k] === slot);
        if (ownerKey && ownerKey.toLowerCase() !== meta.username.toLowerCase()) {
          const owner = auth.loadUsers()[ownerKey.toLowerCase()];
          const allowed = ((owner && owner.allowedUsers) || []).map(s => s.toLowerCase());
          if (!allowed.includes(meta.username.toLowerCase())) {
             ws.send(JSON.stringify({ type: 'error', error: 'Locked! You don\'t have a key.' }));
             return;
          }
        }
      }
      
      // Broadcast despawn in old scene
      broadcast({ type: 'despawn', username: meta.username }, m => m.username !== meta.username && m.scene === meta.scene);
      
      meta.scene = scene;
      meta.x = x || meta.x; meta.y = y || meta.y;
      meta.lastMove = Date.now();
      
      // Broadcast spawn in new scene
      broadcast({ type: 'spawn', player: playerSnapshot(meta) }, m => m.username !== meta.username && m.scene === meta.scene);
      return;
    }

    if (msg.type === 'move') {
      const x = Math.max(16, Math.min(world.WORLD.width - 16, +msg.x || 0));
      const y = Math.max(16, Math.min(world.WORLD.height - 16, +msg.y || 0));
      const dx = x - meta.x, dy = y - meta.y;
      const dt = Math.max(1, Date.now() - meta.lastMove);
      const speed = Math.sqrt(dx*dx + dy*dy) / dt * 1000;
      if (speed > 600) return; // anti-teleport
      meta.x = x; meta.y = y;
      meta.dir = msg.dir || meta.dir;
      meta.moving = !!msg.moving;
      meta.lastMove = Date.now();
      broadcast({ type: 'pos', username: meta.username, x, y, dir: meta.dir, moving: meta.moving },
        m => m.username !== meta.username && m.scene === meta.scene);
      return;
    }

    if (msg.type === 'chat') {
      const target = findClientByUsername(msg.to);
      if (!target) return;
      const dx = target.meta.x - meta.x, dy = target.meta.y - meta.y;
      if (dx*dx + dy*dy > 96*96) {
        ws.send(JSON.stringify({ type: 'chatError', error: 'Too far away' }));
        return;
      }
      const text = String(msg.text || '').slice(0, 300);
      if (!text.trim()) return;
      const payload = { type: 'chat', from: meta.username, to: target.meta.username, text, ts: Date.now() };
      ws.send(JSON.stringify(payload));
      target.ws.send(JSON.stringify(payload));
      // Bubble indicator to nearby players (no content)
      broadcast({ type: 'bubble', from: meta.username, to: target.meta.username },
        m => m.username !== meta.username && m.username !== target.meta.username);
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', nearby: nearbyUsernames(meta) }));
    }
  });

  ws.on('close', () => {
    if (meta) {
      clients.delete(ws);
      broadcastStats();
      broadcast({ type: 'despawn', username: meta.username }, m => m.scene === meta.scene);
    }
  });
});

setInterval(() => {
  const users = auth.loadUsers();
  let changed = false;
  for (const [ws, meta] of clients.entries()) {
    const uKey = meta.username.toLowerCase();
    const u = users[uKey];
    if (u) {
      if (u.hunger === undefined) { u.hunger=100; u.thirst=100; u.energy=100; }
      u.hunger = Math.max(0, u.hunger - 1);
      u.thirst = Math.max(0, u.thirst - 1);
      u.energy = Math.max(0, u.energy - 1);
      changed = true;
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'sync_stats', hunger: u.hunger, thirst: u.thirst, energy: u.energy }));
      }
    }
  }
  if (changed) auth.saveUsers(users);
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`PixelConnect listening on http://localhost:${PORT}`);
});
