const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { getSkinUrl } = require('./skinSystem.js');

const ARENA_BACKGROUNDS = {
  forest: {
    name: 'Forest Arena',
    path: path.join(__dirname, 'assets/arenas/forest_arena.jpg'),
    player1Position: { x: 205, y: 378, radius: 55 },
    player2Position: { x: 655, y: 378, radius: 55 },
    displayBoard: { x: 285, y: 18, width: 285, height: 115 }
  }
};

let defaultArena = 'forest';

const imageCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

function evictStaleCache() {
  const now = Date.now();
  for (const [url, cached] of imageCache.entries()) {
    if (now - cached.timestamp >= CACHE_TTL) {
      imageCache.delete(url);
    }
  }
  
  if (imageCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(imageCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([url]) => imageCache.delete(url));
  }
}

async function loadImageCached(url, forceRefresh = false) {
  const now = Date.now();
  
  evictStaleCache();
  
  if (!forceRefresh && imageCache.has(url)) {
    const cached = imageCache.get(url);
    if (now - cached.timestamp < CACHE_TTL) {
      cached.timestamp = now;
      return cached.image;
    }
  }
  
  try {
    const image = await loadImage(url);
    imageCache.set(url, { image, timestamp: now });
    return image;
  } catch (error) {
    console.error(`Failed to load image from ${url}:`, error.message);
    return null;
  }
}

function clearImageCache() {
  imageCache.clear();
}

function getAvailableArenas() {
  return Object.entries(ARENA_BACKGROUNDS).map(([key, arena]) => ({
    id: key,
    name: arena.name
  }));
}

function setDefaultArena(arenaId) {
  if (ARENA_BACKGROUNDS[arenaId]) {
    defaultArena = arenaId;
    return true;
  }
  return false;
}

function addArena(id, config) {
  ARENA_BACKGROUNDS[id] = {
    name: config.name || id,
    path: config.path,
    player1Position: config.player1Position || { x: 205, y: 378, radius: 55 },
    player2Position: config.player2Position || { x: 655, y: 378, radius: 55 },
    displayBoard: config.displayBoard || { x: 285, y: 18, width: 285, height: 115 }
  };
  return true;
}

function createGradient(ctx, x, y, width, height, colors) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });
  return gradient;
}

function drawHealthBar(ctx, x, y, width, height, currentHP, maxHP) {
  const percentage = Math.max(0, Math.min(1, currentHP / maxHP));
  
  ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 4);
  ctx.fill();
  
  if (percentage > 0) {
    let healthColors;
    if (percentage > 0.5) {
      healthColors = ['#22c55e', '#16a34a'];
    } else if (percentage > 0.25) {
      healthColors = ['#eab308', '#ca8a04'];
    } else {
      healthColors = ['#ef4444', '#dc2626'];
    }
    
    const gradient = createGradient(ctx, x, y, width * percentage, height, healthColors);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, (width - 4) * percentage, height - 4, 3);
    ctx.fill();
  }
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 3;
  ctx.fillText(`${currentHP}/${maxHP}`, x + width / 2, y + height - 4);
  ctx.shadowBlur = 0;
}

function drawEnergyBar(ctx, x, y, width, height, currentEnergy, maxEnergy = 100) {
  const percentage = Math.max(0, Math.min(1, currentEnergy / maxEnergy));
  
  ctx.fillStyle = 'rgba(20, 20, 40, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  
  if (percentage > 0) {
    const gradient = createGradient(ctx, x, y, width * percentage, height, ['#3b82f6', '#1d4ed8']);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, (width - 4) * percentage, height - 4, 2);
    ctx.fill();
  }
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 2;
  ctx.fillText(`${currentEnergy}`, x + width / 2, y + height - 3);
  ctx.shadowBlur = 0;
}

function drawTurnIndicator(ctx, x, y, radius, isCurrentTurn) {
  if (!isCurrentTurn) return;
  
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 20;
  
  ctx.beginPath();
  ctx.arc(x, y, radius + 12, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
}

function drawCharacterOnHologram(ctx, image, x, y, radius) {
  if (!image) return;
  
  ctx.save();
  
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  
  const size = radius * 2;
  ctx.drawImage(image, x - radius, y - radius, size, size);
  
  ctx.restore();
}

function drawPlayerNameTag(ctx, x, y, radius, name, level, isPlayer1, isCurrentTurn) {
  const tagY = y + radius + 25;
  const tagWidth = 130;
  const tagHeight = 35;
  
  const bgColor = isPlayer1 ? 'rgba(59, 130, 246, 0.9)' : 'rgba(239, 68, 68, 0.9)';
  const borderColor = isPlayer1 ? '#60a5fa' : '#f87171';
  
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x - tagWidth/2, tagY, tagWidth, tagHeight, 8);
  ctx.fill();
  
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 2;
  
  const displayName = name.length > 10 ? name.substring(0, 9) + '..' : name;
  ctx.fillText(displayName, x, tagY + 16);
  
  ctx.font = '11px Arial';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText(`Level ${level}`, x, tagY + 30);
  
  ctx.shadowBlur = 0;
  
  if (isCurrentTurn) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px Arial';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.fillText('YOUR TURN', x, y - radius - 15);
    ctx.shadowBlur = 0;
  }
}

function drawScoreboard(ctx, board, battleData) {
  const {
    player1Character,
    player2Character,
    player1HP,
    player2HP,
    player1MaxHP,
    player2MaxHP,
    player1Energy,
    player2Energy,
    turnCount = 0
  } = battleData;
  
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(board.x, board.y, board.width, board.height, 12);
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  const centerX = board.x + board.width / 2;
  
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(`BATTLE - Turn ${turnCount}`, centerX, board.y + 22);
  ctx.shadowBlur = 0;
  
  const leftX = board.x + 18;
  const rightX = board.x + board.width - 18;
  const barWidth = 115;
  const healthBarHeight = 18;
  const energyBarHeight = 12;
  
  const p1Name = player1Character.name.length > 8 ? player1Character.name.substring(0, 7) + '..' : player1Character.name;
  const p2Name = player2Character.name.length > 8 ? player2Character.name.substring(0, 7) + '..' : player2Character.name;
  
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#60a5fa';
  ctx.fillText(p1Name, leftX, board.y + 42);
  
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f87171';
  ctx.fillText(p2Name, rightX, board.y + 42);
  
  drawHealthBar(ctx, leftX, board.y + 48, barWidth, healthBarHeight, player1HP, player1MaxHP);
  drawHealthBar(ctx, rightX - barWidth, board.y + 48, barWidth, healthBarHeight, player2HP, player2MaxHP);
  
  drawEnergyBar(ctx, leftX, board.y + 70, barWidth, energyBarHeight, player1Energy);
  drawEnergyBar(ctx, rightX - barWidth, board.y + 70, barWidth, energyBarHeight, player2Energy);
  
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('VS', centerX, board.y + 65);
}

async function generateBattleImage(battleData, arenaId = null) {
  const arena = ARENA_BACKGROUNDS[arenaId || defaultArena];
  if (!arena) {
    throw new Error(`Arena '${arenaId || defaultArena}' not found`);
  }
  
  let background;
  try {
    background = await loadImage(arena.path);
  } catch (error) {
    console.error('Failed to load arena background:', error);
    throw new Error('Failed to load arena background');
  }
  
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(background, 0, 0);
  
  const {
    player1Character,
    player2Character,
    player1HP,
    player2HP,
    player1MaxHP,
    player2MaxHP,
    player1Energy,
    player2Energy,
    currentTurn,
    turnCount = 0,
    player1 = 'Player 1',
    player2 = 'Player 2'
  } = battleData;
  
  const player1Skin = player1Character.skin || player1Character.currentSkin || 'default';
  const player2Skin = player2Character.skin || player2Character.currentSkin || 'default';
  
  const [player1SkinUrl, player2SkinUrl] = await Promise.all([
    getSkinUrl(player1Character.name, player1Skin),
    getSkinUrl(player2Character.name, player2Skin)
  ]);
  
  const [player1Image, player2Image] = await Promise.all([
    player1SkinUrl ? loadImageCached(player1SkinUrl) : null,
    player2SkinUrl ? loadImageCached(player2SkinUrl) : null
  ]);
  
  const p1Pos = arena.player1Position;
  const p2Pos = arena.player2Position;
  
  const isPlayer1Turn = currentTurn === 'player1' || currentTurn === player1 || currentTurn === 'player';
  const isPlayer2Turn = currentTurn === 'player2' || currentTurn === player2 || currentTurn === 'ai';
  
  drawTurnIndicator(ctx, p1Pos.x, p1Pos.y, p1Pos.radius, isPlayer1Turn);
  drawTurnIndicator(ctx, p2Pos.x, p2Pos.y, p2Pos.radius, isPlayer2Turn);
  
  drawCharacterOnHologram(ctx, player1Image, p1Pos.x, p1Pos.y, p1Pos.radius);
  drawCharacterOnHologram(ctx, player2Image, p2Pos.x, p2Pos.y, p2Pos.radius);
  
  drawPlayerNameTag(
    ctx, p1Pos.x, p1Pos.y, p1Pos.radius,
    player1Character.name,
    player1Character.level || 1,
    true,
    isPlayer1Turn
  );
  
  drawPlayerNameTag(
    ctx, p2Pos.x, p2Pos.y, p2Pos.radius,
    player2Character.name,
    player2Character.level || 1,
    false,
    isPlayer2Turn
  );
  
  const board = arena.displayBoard;
  drawScoreboard(ctx, board, {
    player1Character,
    player2Character,
    player1HP,
    player2HP,
    player1MaxHP,
    player2MaxHP,
    player1Energy,
    player2Energy,
    turnCount
  });
  
  return canvas.toBuffer('image/png');
}

async function generateBattleAttachment(battleData, arenaId = null) {
  try {
    const imageBuffer = await generateBattleImage(battleData, arenaId);
    
    if (!imageBuffer) {
      console.error('Failed to generate battle image: null buffer');
      return null;
    }
    
    return {
      attachment: imageBuffer,
      name: `battle_${Date.now()}.png`
    };
  } catch (error) {
    console.error('Failed to generate battle attachment:', error);
    return null;
  }
}

module.exports = {
  generateBattleImage,
  generateBattleAttachment,
  getAvailableArenas,
  setDefaultArena,
  addArena,
  clearImageCache,
  ARENA_BACKGROUNDS
};
