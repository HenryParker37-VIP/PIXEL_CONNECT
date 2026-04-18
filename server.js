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

// ---- Auth ----
app.post('/api/register', async (req, res) => {
  try {
    const result = await auth.register(req.body);
    world.assignHouse(result.username, loadAssignments());
    saveAssignments(assignments);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const result = await auth.login(req.body);
    world.assignHouse(result.username, loadAssignments());
    saveAssignments(assignments);
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
    houseSlot: assignments[user.username],
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

app.post('/api/me/house', requireAuth, (req, res) => {
  const { houseName } = req.body;
  if (!houseName || houseName.length > 40) return res.status(400).json({ error: 'Invalid name' });
  const users = auth.loadUsers();
  const u = users[req.session.userKey];
  u.houseName = houseName.trim();
  auth.saveUsers(users);
  res.json({ houseName: u.houseName });
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
    if (u) houseOwners[slot] = { username: u.username, houseName: u.houseName };
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
  };
}

function nearbyUsernames(meta, radius = 96) {
  const list = [];
  for (const other of clients.values()) {
    if (other.username === meta.username) continue;
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
      const spawn = world.spawnPoint();
      meta = {
        username: session.user.username,
        x: spawn.x, y: spawn.y, dir: 'down', moving: false,
        appearance: getAppearance(session.user.username),
        lastMove: Date.now(),
      };
      clients.set(ws, meta);

      ws.send(JSON.stringify({
        type: 'welcome',
        you: playerSnapshot(meta),
        players: [...clients.values()].filter(m => m.username !== meta.username).map(playerSnapshot),
      }));
      broadcast({ type: 'spawn', player: playerSnapshot(meta) }, m => m.username !== meta.username);
      return;
    }

    if (!meta) return;

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
        m => m.username !== meta.username);
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
      broadcast({ type: 'despawn', username: meta.username });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`PixelConnect listening on http://localhost:${PORT}`);
});
