const { EmbedBuilder } = require('discord.js');

const COOLDOWNS = new Map();

function generateST() {
  return parseFloat((Math.random() * 100).toFixed(2));
}

function generateCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function initializeUserData(userId, data) {
  if (!data.users[userId]) {
    data.users[userId] = {
      coins: 0,
      gems: 0,
      trophies: 0,
      characters: [],
      battleStats: { wins: 0, losses: 0 },
      crates: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
      ust: 0,
      createdAt: Date.now()
    };
  }
  return data.users[userId];
}

function formatNumber(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function checkCooldown(userId, commandName, cooldownMs) {
  const key = `${userId}-${commandName}`;
  const now = Date.now();
  
  if (COOLDOWNS.has(key)) {
    const expiresAt = COOLDOWNS.get(key);
    if (now < expiresAt) {
      const remaining = expiresAt - now;
      return { onCooldown: true, remaining: formatDuration(remaining) };
    }
  }
  
  COOLDOWNS.set(key, now + cooldownMs);
  return { onCooldown: false };
}

function clearCooldown(userId, commandName) {
  const key = `${userId}-${commandName}`;
  COOLDOWNS.delete(key);
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function createInfoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function validatePositiveInteger(value, fieldName = 'value') {
  const num = parseInt(value);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: `${fieldName} must be a positive number!` };
  }
  return { valid: true, value: num };
}

function validateUsername(mention) {
  const match = mention.match(/^<@!?(\d+)>$/);
  if (!match) return { valid: false, error: 'Please mention a valid user!' };
  return { valid: true, userId: match[1] };
}

function parseUserMention(mention) {
  if (!mention) return null;
  const match = mention.match(/^<@!?(\d+)>$/);
  return match ? match[1] : null;
}

async function safeReply(message, content) {
  try {
    return await message.reply(content);
  } catch (error) {
    console.error('Error sending reply:', error.message);
    try {
      return await message.channel.send(content);
    } catch (err) {
      console.error('Error sending to channel:', err.message);
      return null;
    }
  }
}

async function safeEdit(message, content) {
  try {
    return await message.edit(content);
  } catch (error) {
    console.error('Error editing message:', error.message);
    return null;
  }
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculatePercentage(part, whole) {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

function randomChoice(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedRandom(options) {
  const totalWeight = options.reduce((sum, opt) => sum + (opt.weight || 1), 0);
  let random = Math.random() * totalWeight;
  
  for (const option of options) {
    random -= option.weight || 1;
    if (random <= 0) return option;
  }
  
  return options[options.length - 1];
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(str, maxLength, suffix = '...') {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

function isValidEmoji(str) {
  const unicodeEmojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
  const discordEmojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>/;
  return unicodeEmojiRegex.test(str) || discordEmojiRegex.test(str);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateST,
  generateCode,
  initializeUserData,
  formatNumber,
  formatDuration,
  checkCooldown,
  clearCooldown,
  createErrorEmbed,
  createSuccessEmbed,
  createInfoEmbed,
  validatePositiveInteger,
  validateUsername,
  parseUserMention,
  safeReply,
  safeEdit,
  shuffleArray,
  clamp,
  calculatePercentage,
  randomChoice,
  randomInt,
  weightedRandom,
  capitalizeFirst,
  truncate,
  isValidEmoji,
  delay
};
