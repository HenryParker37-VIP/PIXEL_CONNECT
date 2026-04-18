(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const state = {
    me: null,
    world: null,
    players: new Map(),      // username -> { x, y, dir, moving, appearance, stepTimer, step, bubbleUntil }
    keys: new Set(),
    camera: { x: 0, y: 0, w: 960, h: 640 },
    activeChat: null,         // username
    bubbles: new Map(),       // username -> untilMs
    lastPosSend: 0,
    lastPing: 0,
    nearby: new Set(),
    interactTarget: null,     // { kind: 'player'|'shop'|'board', data }
  };

  // ------- Setup -------
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.camera.w = canvas.width;
    state.camera.h = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();
  ctx.imageSmoothingEnabled = false;

  // ------- Net -------
  let ws;
  function openSocket() {
    ws = Net.connectWS();
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      handleMessage(msg);
    });
    ws.addEventListener('close', () => {
      UI.toast('Disconnected — reconnecting...', 'warn');
      setTimeout(openSocket, 1500);
    });
  }

  function handleMessage(msg) {
    if (msg.type === 'welcome') {
      state.me = msg.you;
      state.me.step = 0; state.me.stepTimer = 0;
      for (const p of msg.players) state.players.set(p.username, { ...p, step: 0, stepTimer: 0 });
    } else if (msg.type === 'spawn') {
      state.players.set(msg.player.username, { ...msg.player, step: 0, stepTimer: 0 });
      UI.toast(`${msg.player.username} joined`, 'success');
    } else if (msg.type === 'despawn') {
      state.players.delete(msg.username);
    } else if (msg.type === 'pos') {
      const p = state.players.get(msg.username);
      if (p) { p.x = msg.x; p.y = msg.y; p.dir = msg.dir; p.moving = msg.moving; }
    } else if (msg.type === 'appearance') {
      if (state.me && msg.username === state.me.username) state.me.appearance = msg.appearance;
      const p = state.players.get(msg.username);
      if (p) p.appearance = msg.appearance;
    } else if (msg.type === 'chat') {
      onChat(msg);
    } else if (msg.type === 'bubble') {
      const t = Date.now() + 4000;
      state.bubbles.set(msg.from, t);
      state.bubbles.set(msg.to, t);
    } else if (msg.type === 'stats') {
      document.getElementById('statVisits').textContent = msg.visitors;
      document.getElementById('statOnline').textContent = msg.online;
    } else if (msg.type === 'chatError') {
      UI.toast(msg.error, 'danger');
    } else if (msg.type === 'pong') {
      updateNearby(msg.nearby || []);
    }
  }

  function updateNearby(list) {
    const incoming = new Set(list);
    for (const u of incoming) if (!state.nearby.has(u)) UI.toast(`${u} is nearby`, '');
    state.nearby = incoming;
  }

  // ------- Input -------
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    state.keys.add(e.key.toLowerCase());
    if (e.key === 'e' || e.key === 'E') tryInteract();
    if (e.key === 'Escape') {
      UI.hide('shopModal'); UI.hide('feedModal'); UI.hide('invModal'); UI.hide('chatPanel');
      state.activeChat = null;
    }
  });
  window.addEventListener('keyup', (e) => state.keys.delete(e.key.toLowerCase()));

  // ------- Game loop -------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(50, now - last);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (!state.me || !state.world) return;
    const speed = 0.18; // px per ms
    let dx = 0, dy = 0;
    if (state.keys.has('w') || state.keys.has('arrowup')) dy -= 1;
    if (state.keys.has('s') || state.keys.has('arrowdown')) dy += 1;
    if (state.keys.has('a') || state.keys.has('arrowleft')) dx -= 1;
    if (state.keys.has('d') || state.keys.has('arrowright')) dx += 1;

      const moving = dx || dy;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      let nx = state.me.x + dx * speed * dt;
      let ny = state.me.y + dy * speed * dt;

      // Collision with houses (bottom half only)
      for (const h of state.world.houses) {
        if (nx > h.x && nx < h.x + h.w && ny > h.y + 30 && ny < h.y + h.h) {
          if (Math.abs(nx - h.x) < Math.abs(nx - (h.x + h.w))) nx = h.x - 1;
          else nx = h.x + h.w + 1;
        }
      }
      // Shop collision
      for (const l of state.world.landmarks) {
        if (l.type !== 'shop') continue;
        if (nx > l.x && nx < l.x + l.w && ny > l.y && ny < l.y + l.h) {
          if (Math.abs(nx - l.x) < Math.abs(nx - (l.x + l.w))) nx = l.x - 1;
          else nx = l.x + l.w + 1;
        }
      }
      // World bounds
      nx = Math.max(16, Math.min(state.world.world.width - 16, nx));
      ny = Math.max(16, Math.min(state.world.world.height - 16, ny));
      
      state.me.x = nx; state.me.y = ny;

      if (Math.abs(dx) > Math.abs(dy)) state.me.dir = dx > 0 ? 'right' : 'left';
      else state.me.dir = dy > 0 ? 'down' : 'up';
      state.me.moving = true;
    } else {
      state.me.moving = false;
    }

    // Animate step
    advanceStep(state.me, dt);
    for (const p of state.players.values()) advanceStep(p, dt);

    // Send position
    if (performance.now() - state.lastPosSend > 80) {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'move', x: state.me.x, y: state.me.y, dir: state.me.dir, moving: state.me.moving }));
      }
      state.lastPosSend = performance.now();
    }
    // Periodic nearby ping
    if (performance.now() - state.lastPing > 1500) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
      state.lastPing = performance.now();
    }

    // Camera follow
    state.camera.x = Math.max(0, Math.min(state.world.world.width - state.camera.w, state.me.x - state.camera.w / 2));
    state.camera.y = Math.max(0, Math.min(state.world.world.height - state.camera.h, state.me.y - state.camera.h / 2));

    // Determine interactable target
    state.interactTarget = findInteractTarget();
    document.getElementById('interactHint').innerHTML = state.interactTarget
      ? `<span class="hint-text">Press <b>E</b> to ${state.interactTarget.label}</span>`
      : '';
  }

  function advanceStep(p, dt) {
    if (!p.moving) { p.step = 0; p.stepTimer = 0; return; }
    p.stepTimer = (p.stepTimer || 0) + dt;
    if (p.stepTimer > 140) { p.stepTimer = 0; p.step = ((p.step || 0) + 1) % 4; }
  }

  function findInteractTarget() {
    if (!state.me || !state.world) return null;
    // Nearest player within 96px
    let nearest = null; let nd = 96 * 96;
    for (const p of state.players.values()) {
      const dx = p.x - state.me.x, dy = p.y - state.me.y;
      const d = dx * dx + dy * dy;
      if (d < nd) { nd = d; nearest = p; }
    }
    if (nearest) return { kind: 'player', data: nearest, label: `chat with ${nearest.username}` };


    for (const h of state.world.houses) {
      if (Math.abs(state.me.x - (h.x + h.w / 2)) < 80 && Math.abs(state.me.y - (h.y + h.h)) < 80) {
        const owner = state.world.houseOwners[h.ownerSlot];
        if (owner) {
           return { kind: 'house_door', data: h, label: owner.username === state.me.username ? 'manage House' : `knock on ${owner.houseName}` };
        } else {
           return { kind: 'plot', data: h, label: 'inspect FOR SALE' };
        }
      }
    }

    for (const l of state.world.landmarks) {
      if (l.type === 'shop') {
        if (Math.abs(state.me.x - (l.x + l.w / 2)) < 100 && Math.abs(state.me.y - (l.y + l.h)) < 100) {
          return { kind: 'shop', data: l, label: 'open Shop' };
        }
      } else if (l.type === 'board') {
        if (Math.abs(state.me.x - (l.x + l.w / 2)) < 60 && Math.abs(state.me.y - (l.y + l.h / 2)) < 60) {
          return { kind: 'board', data: l, label: `open ${l.label}` };
        }
      }
    }
    return null;
  }

  function tryInteract() {
    const t = state.interactTarget;
    if (!t) return;
    if (t.kind === 'player') openChat(t.data.username);
    else if (t.kind === 'shop') openShop();
    else if (t.kind === 'board') openFeed(t.data.label);
    else if (t.kind === 'plot') openBuyLand(t.data);

    else if (t.kind === 'house_door') {
      const owner = state.world.houseOwners[t.data.ownerSlot];
      if (owner.username === state.me.username) openHouseSettings(t.data.ownerSlot, owner);
      else tryEnterHouse(t.data.ownerSlot, owner);
    }
  }

  // ------- Render -------
  function draw() {
    ctx.fillStyle = '#5dab4e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!state.world || !state.me) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading world...', canvas.width / 2, canvas.height / 2);
      return;
    }


    Sprites.drawGrassTiles(ctx, state.camera, state.world.world);

    // World objects sorted by y for correct z-order
    const drawables = [];
    for (const h of state.world.houses) {
      drawables.push({ y: h.y + h.h, draw: () => {
        if (state.world.houseOwners[h.ownerSlot]) {
          Sprites.drawHouse(ctx, { x: h.x - state.camera.x, y: h.y - state.camera.y, w: h.w, h: h.h }, state.world.houseOwners[h.ownerSlot]);
        } else {
          // For Sale Sign
          const sx = h.x - state.camera.x, sy = h.y - state.camera.y;
          ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(sx, sy, h.w, h.h);
          ctx.fillStyle = '#8B4513'; ctx.fillRect(sx + h.w/2 - 2, sy + h.h/2, 4, 30);
          ctx.fillStyle = '#fff'; ctx.fillRect(sx + h.w/2 - 20, sy + h.h/2 - 15, 40, 20);
          ctx.fillStyle = '#f00'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('SALE', sx + h.w/2, sy + h.h/2 - 1);
        }
      }});
    }
    for (const l of state.world.landmarks) {
      drawables.push({ y: l.y + l.h, draw: () => {
        const ll = { ...l, x: l.x - state.camera.x, y: l.y - state.camera.y };
        if (l.type === 'shop') Sprites.drawShopBuilding(ctx, ll);
        else Sprites.drawBoard(ctx, ll);
      }});
    }
    for (const p of state.players.values()) {
      drawables.push({ y: p.y, draw: () => drawPlayer(p, false) });
    }
    drawables.push({ y: state.me.y, draw: () => drawPlayer(state.me, true) });

    drawables.sort((a, b) => a.y - b.y);
    drawables.forEach(d => d.draw());
  }

  function drawPlayer(p, isMe) {
    const sx = p.x - state.camera.x;
    const sy = p.y - state.camera.y;
    Sprites.drawCharacter(ctx, sx, sy, p.dir, p.moving ? p.step : 0, p.appearance);
    Sprites.drawNameTag(ctx, sx, sy - 8, p.username, isMe);
    const until = state.bubbles.get(p.username);
    if (until && until > Date.now()) Sprites.drawChatBubble(ctx, sx, sy - 10);
    else if (until) state.bubbles.delete(p.username);
  }

  // ------- Chat -------
  function openChat(username) {
    state.activeChat = username;
    document.getElementById('chatWith').textContent = username;
    document.getElementById('chatLog').innerHTML = '';
    UI.show('chatPanel');
    document.getElementById('chatInput').focus();
  }

  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !state.activeChat) return;
    ws.send(JSON.stringify({ type: 'chat', to: state.activeChat, text }));
    input.value = '';
  });

  function onChat(msg) {
    const other = msg.from === state.me.username ? msg.to : msg.from;
    if (state.activeChat !== other) {
      if (msg.from !== state.me.username) {
        UI.toast(`💬 ${msg.from}: ${msg.text.slice(0, 40)}`, '');
      }
      return;
    }
    const log = document.getElementById('chatLog');
    const el = document.createElement('div');
    el.className = 'chat-msg ' + (msg.from === state.me.username ? 'me' : 'them');
    el.textContent = msg.text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    // Local bubble
    state.bubbles.set(msg.from, Date.now() + 3000);
    state.bubbles.set(msg.to, Date.now() + 3000);
  }

  // ------- Shop -------
  async function openShop() {
    UI.show('shopModal');
    try {
      const [shop, me] = await Promise.all([Net.api('/api/shop'), Net.api('/api/me')]);
      document.getElementById('huCoins').textContent = me.coins;
      const grid = document.getElementById('shopGrid');
      grid.innerHTML = '';
      for (const item of shop.items) {
        const card = document.createElement('div');
        card.className = 'shop-item' + (me.inventory.includes(item.id) ? ' owned' : '');
        const cv = document.createElement('canvas');
        cv.width = 64; cv.height = 64;
        Sprites.drawItemPreview(cv, item.id);
        card.appendChild(cv);
        const name = document.createElement('div');
        name.className = 'n'; name.textContent = item.name;
        card.appendChild(name);
        const price = document.createElement('div');
        price.className = 'p';
        price.textContent = me.inventory.includes(item.id) ? 'Owned' : `${shop.price} xu`;
        card.appendChild(price);
        if (!me.inventory.includes(item.id)) {
          card.addEventListener('click', async () => {
            try {
              const r = await Net.api('/api/shop/buy', { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
              document.getElementById('huCoins').textContent = r.coins;
              UI.toast(`Bought ${item.name}`, 'success');
              openShop();
            } catch (e) { UI.toast(e.message, 'danger'); }
          });
        }
        grid.appendChild(card);
      }
    } catch (e) { UI.toast(e.message, 'danger'); }
  }
  document.getElementById('btnShop').addEventListener('click', openShop);

  // ------- Inventory -------
  async function openInventory() {
    UI.show('invModal');
    try {
      const me = await Net.api('/api/me');
      const grid = document.getElementById('invGrid');
      grid.innerHTML = '';
      const all = ['hair', 'shirt', 'pants', 'hat'];
      const ownedBySlot = {};
      for (const id of me.inventory) {
        const slot = Sprites.getItemSlot(id);
        (ownedBySlot[slot] ||= []).push(id);
      }
      // Include defaults as equippable
      ['hair_brown', 'shirt_blue', 'pants_gray'].forEach(id => {
        const slot = Sprites.getItemSlot(id);
        if (!me.inventory.includes(id)) (ownedBySlot[slot] ||= []).unshift(id);
      });

      if (!me.inventory.length && !Object.values(ownedBySlot).some(a => a.length)) {
        grid.innerHTML = '<p style="padding:20px;text-align:center;color:#65676B">No items yet. Visit the shop!</p>';
        return;
      }

      for (const slot of all) {
        for (const id of (ownedBySlot[slot] || [])) {
          const card = document.createElement('div');
          const equipped = me.equipped[slot] === id;
          card.className = 'shop-item' + (equipped ? ' equipped' : '');
          const cv = document.createElement('canvas');
          cv.width = 64; cv.height = 64;
          Sprites.drawItemPreview(cv, id);
          card.appendChild(cv);
          const name = document.createElement('div');
          name.className = 'n'; name.textContent = Sprites.ITEM_NAMES[id] || id;
          card.appendChild(name);
          const label = document.createElement('div');
          label.className = 'p';
          label.textContent = equipped ? 'Equipped' : 'Click to equip';
          card.appendChild(label);
          if (!equipped) {
            card.addEventListener('click', async () => {
              try {
                await Net.api('/api/me/equip', { method: 'POST', body: JSON.stringify({ itemId: id }) });
                UI.toast(`Equipped ${Sprites.ITEM_NAMES[id] || id}`, 'success');
                openInventory();
              } catch (e) { UI.toast(e.message, 'danger'); }
            });
          }
          grid.appendChild(card);
        }
      }
    } catch (e) { UI.toast(e.message, 'danger'); }
  }
  document.getElementById('btnInv').addEventListener('click', openInventory);

  // ------- Feed -------
  async function openFeed(title) {
    document.getElementById('feedTitle').textContent = title || 'Feed';
    UI.show('feedModal');
    renderFeed();
  }
  async function renderFeed() {
    try {
      const posts = await Net.api('/api/posts');
      const list = document.getElementById('feedList');
      list.innerHTML = '';
      if (!posts.length) {
        list.innerHTML = '<p style="padding:20px;text-align:center;color:#65676B">No posts yet. Be the first!</p>';
        return;
      }
      const meName = state.me.username;
      for (const p of posts) {
        const el = document.createElement('div');
        el.className = 'post';
        const time = new Date(p.createdAt).toLocaleString();
        const visLabel = p.visibility === 'private' ? ' · Private' : '';
        const liked = p.likes.includes(meName);
        el.innerHTML = `
          <div class="author">${escapeHtml(p.author)}</div>
          <div class="meta">${time}${visLabel}</div>
          <div class="body">${escapeHtml(p.content)}</div>
          <div class="actions">
            <span class="act like ${liked ? 'liked' : ''}">👍 ${p.likes.length} Like</span>
            <span class="act comment-toggle">💬 ${p.comments.length} Comment</span>
          </div>
          <div class="comments hidden">
            ${p.comments.map(c => `<div class="comment"><b>${escapeHtml(c.author)}</b>: ${escapeHtml(c.text)}</div>`).join('')}
            <form class="comment-form">
              <input maxlength="200" placeholder="Write a comment...">
              <button class="btn primary small" type="submit">Post</button>
            </form>
          </div>
        `;
        el.querySelector('.like').addEventListener('click', async () => {
          try { await Net.api(`/api/posts/${p.id}/like`, { method: 'POST' }); renderFeed(); }
          catch (e) { UI.toast(e.message, 'danger'); }
        });
        el.querySelector('.comment-toggle').addEventListener('click', () => {
          el.querySelector('.comments').classList.toggle('hidden');
        });
        el.querySelector('.comment-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const input = el.querySelector('.comment-form input');
          const text = input.value.trim();
          if (!text) return;
          try {
            await Net.api(`/api/posts/${p.id}/comment`, { method: 'POST', body: JSON.stringify({ text }) });
            input.value = '';
            renderFeed();
          } catch (e) { UI.toast(e.message, 'danger'); }
        });
        list.appendChild(el);
      }
    } catch (e) { UI.toast(e.message, 'danger'); }
  }

  document.getElementById('btnFeed').addEventListener('click', () => openFeed('Home Feed'));

  document.getElementById('postVisibility').addEventListener('change', (e) => {
    const aud = document.getElementById('postAudience');
    if (e.target.value === 'private') aud.classList.remove('hidden');
    else aud.classList.add('hidden');
  });
  document.getElementById('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('postContent').value.trim();
    const visibility = document.getElementById('postVisibility').value;
    const audRaw = document.getElementById('postAudience').value.trim();
    const audience = audRaw ? audRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!content) return;
    try {
      await Net.api('/api/posts', { method: 'POST', body: JSON.stringify({ content, visibility, audience }) });
      document.getElementById('postContent').value = '';
      UI.toast('Posted!', 'success');
      renderFeed();
    } catch (e) { UI.toast(e.message, 'danger'); }
  });

  // ------- Misc -------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.getElementById('btnLogout').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/';
  });

  // ------- New Modals -------
  let buyTarget = null;
  window.openBuyLand = function(plot) { buyTarget = plot; UI.show('buyModal'); };
  document.getElementById('btnBuyOkay').addEventListener('click', async () => {
    if (!buyTarget) return;
    try {
      const r = await Net.api('/api/land/buy', { method: 'POST', body: JSON.stringify({ slot: buyTarget.ownerSlot }) });
      document.getElementById('huCoins').textContent = r.coins;
      UI.hide('buyModal');
      state.world = await Net.api('/api/world');
      UI.toast('Land purchased!', 'success');
    } catch(e) { UI.toast(e.message, 'danger'); }
  });

  let houseSettingsTarget = null;
  window.openHouseSettings = function(slot, owner) {
     houseSettingsTarget = slot;
     document.getElementById('houseBio').value = owner.bio || '';
     UI.show('houseSettingsModal');
  };
  document.getElementById('houseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bio = document.getElementById('houseBio').value;
    const keys = document.getElementById('houseKeys').value;
    try {
      await Net.api('/api/house/settings', { method: 'POST', body: JSON.stringify({ bio, keys }) });
      UI.hide('houseSettingsModal');
      state.world = await Net.api('/api/world');
      UI.toast('House updated', 'success');
    } catch(e) { UI.toast(e.message, 'danger'); }
  });
  document.getElementById('btnEnterHouse').addEventListener('click', () => {
    UI.hide('houseSettingsModal');
    if (houseSettingsTarget !== null) {
      triggerHouseEntry(houseSettingsTarget);
    }
  });

  window.tryEnterHouse = function(slot, owner) {
    if (owner.bio) UI.toast(owner.bio, '');
    triggerHouseEntry(slot);
  };

  async function triggerHouseEntry(slot) {
    try {
      const res = await Net.api('/api/house/enter', { method: 'POST', body: JSON.stringify({ slot }) });
      document.getElementById('interiorTitle').textContent = res.houseName || 'House Interior';
      
      const grid = document.getElementById('interiorGrid');
      grid.innerHTML = '';
      for (let i = 0; i < 24; i++) grid.appendChild(document.createElement('div'));
      
      UI.show('interiorModal');
    } catch(e) {
      UI.toast(e.message, 'danger');
    }
  }

  // ------- Boot -------
  (async function init() {
    try {
      const [me, worldData] = await Promise.all([Net.api('/api/me'), Net.api('/api/world')]);
      state.world = worldData;
      document.getElementById('huName').textContent = me.username;
      document.getElementById('huCoins').textContent = me.coins;
      openSocket();
      requestAnimationFrame(loop);
    } catch (e) {
      UI.toast(e.message, 'danger');
    }
  })();
})();
