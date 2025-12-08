const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { getSkinUrl } = require('./skinSystem.js');

const ARENA_BACKGROUNDS = {
  forest: {
    name: 'Forest Arena',
    path: path.join(__dirname, 'assets/arenas/forest_arena.jpg'),
    player1Position: { x: 235, y: 340, radius: 70 },
    player2Position: { x: 565, y: 340, radius: 70 },
    displayBoard: { x: 280, y: 60, width: 240, height: 100 }
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
    player1Position: config.player1Position || { x: 235, y: 340, radius: 70 },
    player2Position: config.player2Position || { x: 565, y: 340, radius: 70 },
    displayBoard: config.displayBoard || { x: 280, y: 60, width: 240, height: 100 }
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

function drawHealthBar(ctx, x, y, width, height, currentHP, maxHP, isPlayer1 = true) {
  const percentage = Math.max(0, Math.min(1, currentHP / maxHP));
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, width + 4, height + 4, 4);
  ctx.fill();
  
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  
  if (percentage > 0) {
    let healthColors;
    if (percentage > 0.5) {
      healthColors = ['#00ff88', '#00cc66'];
    } else if (percentage > 0.25) {
      healthColors = ['#ffcc00', '#ff9900'];
    } else {
      healthColors = ['#ff4444', '#cc0000'];
    }
    
    const gradient = createGradient(ctx, x, y, width * percentage, height, healthColors);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, width * percentage, height, 3);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(x, y, width * percentage, height / 2, 3);
    ctx.fill();
  }
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText(`${currentHP}/${maxHP}`, x + width / 2, y + height - 3);
  ctx.shadowBlur = 0;
}

function drawEnergyBar(ctx, x, y, width, height, currentEnergy, maxEnergy = 100) {
  const percentage = Math.max(0, Math.min(1, currentEnergy / maxEnergy));
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, width + 4, height + 4, 4);
  ctx.fill();
  
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  
  if (percentage > 0) {
    const gradient = createGradient(ctx, x, y, width * percentage, height, ['#00ccff', '#0088ff', '#0066cc']);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, width * percentage, height, 3);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(x, y, width * percentage, height / 2, 3);
    ctx.fill();
  }
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 2;
  ctx.fillText(`${currentEnergy}`, x + width / 2, y + height - 2);
  ctx.shadowBlur = 0;
}

function drawShieldBar(ctx, x, y, width, height, shield, maxHP) {
  if (shield <= 0) return;
  
  const percentage = Math.min(1, shield / (maxHP * 0.5));
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 2);
  ctx.fill();
  
  const gradient = createGradient(ctx, x, y, width * percentage, height, ['#88ccff', '#4488ff']);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width * percentage, height, 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`🛡️${shield}`, x + width / 2, y + height - 1);
}

function drawTurnIndicator(ctx, x, y, radius, isCurrentTurn) {
  if (!isCurrentTurn) return;
  
  ctx.strokeStyle = '#ffdd00';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ffdd00';
  ctx.shadowBlur = 15;
  
  ctx.beginPath();
  ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#ffdd00';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ YOUR TURN', x, y - radius - 20);
  
  ctx.shadowBlur = 0;
}

function drawCharacterOnCircle(ctx, image, x, y, radius) {
  ctx.save();
  
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  
  const size = radius * 2;
  ctx.drawImage(image, x - radius, y - radius, size, size);
  
  ctx.restore();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayerLabel(ctx, x, y, name, emoji, level, st, isPlayer1 = true) {
  const labelY = y + 90;
  
  ctx.fillStyle = isPlayer1 ? 'rgba(0, 150, 255, 0.85)' : 'rgba(255, 80, 80, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x - 70, labelY, 140, 45, 8);
  ctx.fill();
  
  ctx.strokeStyle = isPlayer1 ? '#00aaff' : '#ff6666';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText(`${emoji} ${name}`, x, labelY + 18);
  
  ctx.font = '10px Arial';
  ctx.fillStyle = '#dddddd';
  ctx.fillText(`Lvl ${level} | ST: ${st}%`, x, labelY + 35);
  ctx.shadowBlur = 0;
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
    player1Shield = 0,
    player2Shield = 0,
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
  
  if (player1Image) {
    drawCharacterOnCircle(ctx, player1Image, p1Pos.x, p1Pos.y, p1Pos.radius);
  }
  
  if (player2Image) {
    drawCharacterOnCircle(ctx, player2Image, p2Pos.x, p2Pos.y, p2Pos.radius);
  }
  
  drawPlayerLabel(
    ctx, p1Pos.x, p1Pos.y,
    player1Character.name,
    player1Character.emoji || '',
    player1Character.level || 1,
    player1Character.st || 50,
    true
  );
  
  drawPlayerLabel(
    ctx, p2Pos.x, p2Pos.y,
    player2Character.name,
    player2Character.emoji || '',
    player2Character.level || 1,
    player2Character.st || 50,
    false
  );
  
  const board = arena.displayBoard;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  ctx.roundRect(board.x, board.y, board.width, board.height, 10);
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText(`⚔️ BATTLE - Turn ${turnCount}`, board.x + board.width / 2, board.y + 18);
  ctx.shadowBlur = 0;
  
  const barWidth = 100;
  const barHeight = 14;
  const energyBarHeight = 10;
  const leftBarX = board.x + 15;
  const rightBarX = board.x + board.width - barWidth - 15;
  
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#00aaff';
  ctx.fillText(player1Character.emoji + ' ' + player1Character.name.substring(0, 8), leftBarX, board.y + 32);
  
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff6666';
  ctx.fillText(player2Character.emoji + ' ' + player2Character.name.substring(0, 8), rightBarX + barWidth, board.y + 32);
  
  drawHealthBar(ctx, leftBarX, board.y + 36, barWidth, barHeight, player1HP, player1MaxHP, true);
  drawHealthBar(ctx, rightBarX, board.y + 36, barWidth, barHeight, player2HP, player2MaxHP, false);
  
  drawEnergyBar(ctx, leftBarX, board.y + 54, barWidth, energyBarHeight, player1Energy);
  drawEnergyBar(ctx, rightBarX, board.y + 54, barWidth, energyBarHeight, player2Energy);
  
  if (player1Shield > 0) {
    drawShieldBar(ctx, leftBarX, board.y + 68, barWidth, 8, player1Shield, player1MaxHP);
  }
  if (player2Shield > 0) {
    drawShieldBar(ctx, rightBarX, board.y + 68, barWidth, 8, player2Shield, player2MaxHP);
  }
  
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
