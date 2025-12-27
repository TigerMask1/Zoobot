const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { saveData, saveDataImmediate } = require('./dataManager.js');
const { calculateBaseHP, calculateDamage, calculateEnergyCost, calculateCriticalHit, getMoveDisplay } = require('./battleUtils.js');
const { getCharacterAbility } = require('./characterAbilities.js');
const { MOVE_EFFECTS, applyEffect, processEffects, hasEffect, getEffectsDisplay, clearAllEffects } = require('./moveEffects.js');
const { getUserBattleItems, useItem } = require('./itemsSystem.js');
const { updateTaskProgress } = require('./seasonSystem.js');
const { addAura } = require('./serverAuraSystem.js');
const { getSkinUrl } = require('./skinSystem.js');

const activeBattles = new Map();
const battleInvites = new Map();

const STARTING_ENERGY = 50;
const ENERGY_PER_TURN = 10;
const MAX_ENERGY = 100;

async function createBattleCanvas(battle) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 800, 400);
  
  // Players
  const p1 = {
    name: battle.player1Character.name,
    hp: battle.player1HP,
    maxHp: battle.player1MaxHP,
    energy: battle.player1Energy,
    skin: battle.player1Character.skin || 'default',
    x: 100,
    y: 150
  };
  
  const p2 = {
    name: battle.player2Character.name,
    hp: battle.player2HP,
    maxHp: battle.player2MaxHP,
    energy: battle.player2Energy,
    skin: battle.player2Character.skin || 'default',
    x: 500,
    y: 150
  };

  // Draw P1
  const p1Url = await getSkinUrl(p1.name, p1.skin);
  try {
    const p1Img = await loadImage(p1Url);
    ctx.drawImage(p1Img, p1.x, p1.y, 200, 200);
  } catch (e) {
    ctx.fillStyle = '#3498DB';
    ctx.fillRect(p1.x, p1.y, 200, 200);
  }
  
  // Draw P2 (flipped)
  const p2Url = await getSkinUrl(p2.name, p2.skin);
  try {
    const p2Img = await loadImage(p2Url);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(p2Img, -p2.x - 200, p2.y, 200, 200);
    ctx.restore();
  } catch (e) {
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(p2.x, p2.y, 200, 200);
  }

  // HP & Energy Bars
  drawBars(ctx, p1.x, p1.y + 210, p1.hp, p1.maxHp, p1.energy);
  drawBars(ctx, p2.x, p2.y + 210, p2.hp, p2.maxHp, p2.energy);

  return canvas.toBuffer();
}

function drawBars(ctx, x, y, hp, maxHp, energy) {
  const width = 200;
  const height = 15;
  const energyHeight = 8;
  
  // HP Bar BG
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, width, height);
  
  // HP Bar Fill
  const hpPercent = Math.max(0, hp / maxHp);
  ctx.fillStyle = hpPercent > 0.5 ? '#2ECC71' : (hpPercent > 0.2 ? '#F1C40F' : '#E74C3C');
  ctx.fillRect(x, y, width * hpPercent, height);
  
  // HP Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(hp)} / ${maxHp}`, x + width / 2, y + 12);
  
  // Energy Bar BG
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y + height + 5, width, energyHeight);
  
  // Energy Bar Fill
  const energyPercent = Math.max(0, energy / MAX_ENERGY);
  ctx.fillStyle = '#3498DB';
  ctx.fillRect(x, y + height + 5, width * energyPercent, energyHeight);
}

// ... existing initiation and selection logic ...
// (Modified promptTurn to use Canvas)

async function promptTurn(battle, channel, data) {
  // ... (effect processing and HP/Energy updates) ...

  const buffer = await createBattleCanvas(battle);
  const attachment = new AttachmentBuilder(buffer, { name: 'battle.png' });

  // ... (Embed construction) ...
  const turnEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle(`⚡ <@${currentPlayer}>'s Turn!`)
    .setImage('attachment://battle.png');

  const turnMessage = await channel.send({ 
    embeds: [turnEmbed], 
    files: [attachment],
    components: rows 
  });
  // ... (Collector logic) ...
}

module.exports = { initiateBattle, activeBattles };