/* Procedural pixel sprites. 32x32 character, 4-direction. */
(function () {
  const SPRITE_SIZE = 32;
  const ITEM_COLORS = {
    hair_brown: '#3b2a20', hair_blond: '#e8c170', hair_black: '#1a1a1a',
    hair_red: '#b5432a', hair_blue: '#1877F2', hair_pink: '#ff77aa',
    shirt_blue: '#1877F2', shirt_red: '#c0392b', shirt_green: '#2ecc71',
    shirt_yellow: '#f1c40f', shirt_purple: '#8e44ad', shirt_white: '#ffffff',
    pants_gray: '#5a6373', pants_black: '#1a1a1a', pants_brown: '#6b4a2b', pants_navy: '#0c2b5a',
    hat_cap: '#1877F2', hat_straw: '#d4a96a', hat_wizard: '#3b2a6a',
  };
  const ITEM_NAMES = {
    hair_brown: 'Brown Hair', hair_blond: 'Blond Hair', hair_black: 'Black Hair',
    hair_red: 'Red Hair', hair_blue: 'Blue Hair', hair_pink: 'Pink Hair',
    shirt_blue: 'Blue Shirt', shirt_red: 'Red Shirt', shirt_green: 'Green Shirt',
    shirt_yellow: 'Yellow Shirt', shirt_purple: 'Purple Shirt', shirt_white: 'White Shirt',
    pants_gray: 'Gray Pants', pants_black: 'Black Pants', pants_brown: 'Brown Pants', pants_navy: 'Navy Pants',
    hat_cap: 'Baseball Cap', hat_straw: 'Straw Hat', hat_wizard: 'Wizard Hat',
  };

  function getItemSlot(id) { return (id || '').split('_')[0]; }

  function drawCharacter(ctx, x, y, dir, step, appearance) {
    const skin = appearance?.avatar?.skin || '#f2c99b';
    const hairCol = ITEM_COLORS[appearance?.equipped?.hair] || '#3b2a20';
    const shirtCol = ITEM_COLORS[appearance?.equipped?.shirt] || '#1877F2';
    const pantsCol = ITEM_COLORS[appearance?.equipped?.pants] || '#5a6373';
    const hatCol = ITEM_COLORS[appearance?.equipped?.hat] || null;

    const px = Math.round(x - 16);
    const py = Math.round(y - 28);

    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    const legSwing = step === 1 ? 1 : step === 3 ? -1 : 0;
    ctx.fillStyle = pantsCol;
    ctx.fillRect(px + 10, py + 20, 4, 8 + (dir === 'left' || dir === 'right' ? legSwing : 0));
    ctx.fillRect(px + 18, py + 20, 4, 8 + (dir === 'left' || dir === 'right' ? -legSwing : 0));
    // Shoes
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 10, py + 28, 4, 2);
    ctx.fillRect(px + 18, py + 28, 4, 2);

    // Body (torso)
    ctx.fillStyle = shirtCol;
    ctx.fillRect(px + 9, py + 12, 14, 10);
    // Shirt shade
    ctx.fillStyle = shadeColor(shirtCol, -15);
    ctx.fillRect(px + 9, py + 20, 14, 2);

    // Arms
    const armSwing = step === 1 ? -1 : step === 3 ? 1 : 0;
    ctx.fillStyle = shirtCol;
    ctx.fillRect(px + 6, py + 13, 3, 8 + (dir === 'left' || dir === 'right' ? armSwing : 0));
    ctx.fillRect(px + 23, py + 13, 3, 8 + (dir === 'left' || dir === 'right' ? -armSwing : 0));
    // Hands
    ctx.fillStyle = skin;
    ctx.fillRect(px + 6, py + 20, 3, 2);
    ctx.fillRect(px + 23, py + 20, 3, 2);

    // Head
    ctx.fillStyle = skin;
    ctx.fillRect(px + 10, py + 4, 12, 10);
    // Skin shade
    ctx.fillStyle = shadeColor(skin, -10);
    ctx.fillRect(px + 10, py + 12, 12, 2);

    // Hair
    ctx.fillStyle = hairCol;
    if (dir === 'down') {
      ctx.fillRect(px + 10, py + 2, 12, 5);
      ctx.fillRect(px + 9, py + 4, 2, 4);
      ctx.fillRect(px + 21, py + 4, 2, 4);
    } else if (dir === 'up') {
      ctx.fillRect(px + 10, py + 2, 12, 8);
    } else if (dir === 'left') {
      ctx.fillRect(px + 10, py + 2, 12, 6);
      ctx.fillRect(px + 9, py + 4, 2, 5);
    } else {
      ctx.fillRect(px + 10, py + 2, 12, 6);
      ctx.fillRect(px + 21, py + 4, 2, 5);
    }

    // Face
    if (dir === 'down') {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(px + 13, py + 9, 2, 2);
      ctx.fillRect(px + 17, py + 9, 2, 2);
      ctx.fillStyle = '#a0484a';
      ctx.fillRect(px + 14, py + 12, 4, 1);
    } else if (dir === 'left') {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(px + 12, py + 9, 2, 2);
    } else if (dir === 'right') {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(px + 18, py + 9, 2, 2);
    }

    // Hat
    if (hatCol) {
      ctx.fillStyle = hatCol;
      const hatId = appearance?.equipped?.hat;
      if (hatId === 'hat_wizard') {
        ctx.fillRect(px + 10, py, 12, 3);
        ctx.fillRect(px + 12, py - 3, 8, 3);
        ctx.fillRect(px + 14, py - 6, 4, 3);
      } else if (hatId === 'hat_straw') {
        ctx.fillRect(px + 8, py + 2, 16, 2);
        ctx.fillRect(px + 10, py, 12, 2);
      } else {
        ctx.fillRect(px + 10, py + 1, 12, 3);
        ctx.fillRect(px + 9, py + 3, 14, 1);
        if (dir === 'down') ctx.fillRect(px + 19, py + 4, 5, 2);
        if (dir === 'left') ctx.fillRect(px + 5, py + 4, 5, 2);
      }
    }
    ctx.restore();
  }

  function shadeColor(hex, amt) {
    const h = hex.replace('#', '');
    const num = parseInt(h, 16);
    let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function drawHouse(ctx, h, ownerInfo) {
    // Base
    ctx.fillStyle = '#b88760';
    ctx.fillRect(h.x, h.y + 30, h.w, h.h - 30);
    // Roof
    ctx.fillStyle = '#7b2a2a';
    ctx.beginPath();
    ctx.moveTo(h.x - 10, h.y + 32);
    ctx.lineTo(h.x + h.w / 2, h.y - 10);
    ctx.lineTo(h.x + h.w + 10, h.y + 32);
    ctx.closePath();
    ctx.fill();
    // Roof shadow
    ctx.fillStyle = '#5c1e1e';
    ctx.fillRect(h.x - 10, h.y + 30, h.w + 20, 4);
    // Door
    ctx.fillStyle = '#4b2f1a';
    ctx.fillRect(h.x + h.w / 2 - 14, h.y + h.h - 50, 28, 50);
    ctx.fillStyle = '#e8c170';
    ctx.fillRect(h.x + h.w / 2 + 8, h.y + h.h - 26, 2, 2);
    // Windows
    ctx.fillStyle = '#b0e0ff';
    ctx.fillRect(h.x + 16, h.y + 50, 28, 24);
    ctx.fillRect(h.x + h.w - 44, h.y + 50, 28, 24);
    ctx.strokeStyle = '#4b2f1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(h.x + 16, h.y + 50, 28, 24);
    ctx.strokeRect(h.x + h.w - 44, h.y + 50, 28, 24);
    ctx.beginPath();
    ctx.moveTo(h.x + 30, h.y + 50); ctx.lineTo(h.x + 30, h.y + 74);
    ctx.moveTo(h.x + 16, h.y + 62); ctx.lineTo(h.x + 44, h.y + 62);
    ctx.moveTo(h.x + h.w - 30, h.y + 50); ctx.lineTo(h.x + h.w - 30, h.y + 74);
    ctx.moveTo(h.x + h.w - 44, h.y + 62); ctx.lineTo(h.x + h.w - 16, h.y + 62);
    ctx.stroke();

    // Nameplate
    const label = ownerInfo?.houseName || 'Vacant';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1877F2';
    ctx.lineWidth = 2;
    const textW = ctx.measureText(label).width + 14;
    const lx = h.x + h.w / 2 - textW / 2;
    const ly = h.y + h.h + 6;
    ctx.fillRect(lx, ly, textW, 20);
    ctx.strokeRect(lx, ly, textW, 20);
    ctx.fillStyle = '#1877F2';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, h.x + h.w / 2, ly + 10);
  }

  function drawShopBuilding(ctx, l) {
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(l.x - 4, l.y - 6, l.w + 8, 12);
    ctx.fillStyle = '#4b2f1a';
    ctx.fillRect(l.x + l.w / 2 - 12, l.y + l.h - 40, 24, 40);
    ctx.fillStyle = '#1877F2';
    ctx.fillRect(l.x, l.y - 20, l.w, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SHOP', l.x + l.w / 2, l.y - 13);
  }

  function drawBoard(ctx, l) {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(l.x + 4, l.y + l.h - 8, 4, 12);
    ctx.fillRect(l.x + l.w - 8, l.y + l.h - 8, 4, 12);
    ctx.fillStyle = '#d4b08c';
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 2;
    ctx.strokeRect(l.x, l.y, l.w, l.h);
    ctx.fillStyle = '#5c3a1e';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(l.label, l.x + l.w / 2, l.y + l.h / 2);
  }

  function drawChatBubble(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1877F2';
    ctx.lineWidth = 2;
    const bx = x - 14, by = y - 54;
    roundRect(ctx, bx, by, 28, 20, 6);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 10, by + 20);
    ctx.lineTo(bx + 14, by + 26);
    ctx.lineTo(bx + 18, by + 20);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#1877F2';
    ctx.beginPath();
    ctx.moveTo(bx + 10, by + 20);
    ctx.lineTo(bx + 14, by + 26);
    ctx.lineTo(bx + 18, by + 20);
    ctx.stroke();
    ctx.fillStyle = '#1877F2';
    ctx.fillRect(bx + 7, by + 8, 3, 3);
    ctx.fillRect(bx + 13, by + 8, 3, 3);
    ctx.fillRect(bx + 19, by + 8, 3, 3);
    ctx.restore();
  }

  function drawNameTag(ctx, x, y, name, you) {
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(name).width + 10;
    ctx.fillStyle = you ? 'rgba(24,119,242,.85)' : 'rgba(0,0,0,.65)';
    roundRect(ctx, x - w / 2, y - 44, w, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(name, x, y - 37);
    ctx.restore();
  }

  function drawGrassTiles(ctx, cam, world) {
    const tile = 32;
    const startX = Math.floor(cam.x / tile) * tile;
    const startY = Math.floor(cam.y / tile) * tile;
    const endX = Math.min(world.width, cam.x + cam.w + tile);
    const endY = Math.min(world.height, cam.y + cam.h + tile);
    for (let y = Math.max(0, startY); y < endY; y += tile) {
      for (let x = Math.max(0, startX); x < endX; x += tile) {
        const shade = ((x / tile) + (y / tile)) % 2 === 0 ? '#5dab4e' : '#549c47';
        ctx.fillStyle = shade;
        ctx.fillRect(x - cam.x, y - cam.y, tile, tile);
        // Grass tufts pseudo-random
        if (((x * 73856093) ^ (y * 19349663)) % 13 === 0) {
          ctx.fillStyle = '#3f7d34';
          ctx.fillRect(x - cam.x + 6, y - cam.y + 18, 2, 2);
          ctx.fillRect(x - cam.x + 20, y - cam.y + 10, 2, 2);
        }
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw item preview (for shop/inventory cards)
  function drawItemPreview(canvas, itemId) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = ITEM_COLORS[itemId] || '#888';
    const slot = getItemSlot(itemId);
    ctx.save();
    ctx.scale(2, 2);
    ctx.fillStyle = color;
    if (slot === 'hair') {
      ctx.fillRect(8, 4, 16, 10);
      ctx.fillRect(6, 6, 2, 8);
      ctx.fillRect(24, 6, 2, 8);
    } else if (slot === 'shirt') {
      ctx.fillRect(6, 10, 20, 16);
      ctx.fillRect(4, 12, 2, 10);
      ctx.fillRect(26, 12, 2, 10);
    } else if (slot === 'pants') {
      ctx.fillRect(8, 16, 7, 14);
      ctx.fillRect(17, 16, 7, 14);
    } else if (slot === 'hat') {
      if (itemId === 'hat_wizard') {
        ctx.fillRect(8, 14, 16, 4);
        ctx.fillRect(10, 10, 12, 4);
        ctx.fillRect(13, 6, 6, 4);
      } else if (itemId === 'hat_straw') {
        ctx.fillRect(5, 14, 22, 3);
        ctx.fillRect(8, 10, 16, 4);
      } else {
        ctx.fillRect(8, 12, 16, 4);
        ctx.fillRect(7, 14, 18, 2);
        ctx.fillRect(20, 16, 6, 2);
      }
    }
    ctx.restore();
  }

  window.Sprites = {
    drawCharacter, drawHouse, drawShopBuilding, drawBoard,
    drawChatBubble, drawNameTag, drawGrassTiles, drawItemPreview,
    ITEM_COLORS, ITEM_NAMES, getItemSlot,
  };
})();
