const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { saveDataImmediate, saveData } = require('./dataManager.js');
const characterManager = require('./characterManager.js');
const { isMainServer, getServerConfig, getServerGame, hasSelectedGame, DEFAULT_GAME, isSuperAdmin, saveServerConfig } = require('./serverConfigManager.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const KEYS_TO_UNLOCK = 750;
const KEY_RUSH_COST = 250;
const KEY_RUSH_DURATION = 3600000;
const MAIN_SERVER_ID = '1430516117851340893';
const MAIN_DROP_CHANNEL = '1430525383635107850';
const EVENT_ROLE_NAME = 'event';

const KEY_RUSH_SCHEDULE = [
  { hour: 10, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 22, minute: 0 }
];

let dropsWerePausedBefore = false;

let keyRushIntervals = new Map();
let keyRushScheduler = null;
let activeClient = null;
let activeData = null;

const CHARACTER_KEY_EMOJIS = {
  'default': '🔑'
};

function initializeCharacterKeys(userData) {
  if (!userData.characterKeys) {
    userData.characterKeys = {};
  }
  return userData.characterKeys;
}

function getCharacterKeyEmoji(characterName) {
  return CHARACTER_KEY_EMOJIS[characterName] || CHARACTER_KEY_EMOJIS['default'];
}

function setCharacterKeyEmoji(characterName, emoji) {
  CHARACTER_KEY_EMOJIS[characterName] = emoji;
}

function addCharacterKeys(userData, characterName, amount = 1) {
  initializeCharacterKeys(userData);
  
  if (!userData.characterKeys[characterName]) {
    userData.characterKeys[characterName] = 0;
  }
  
  userData.characterKeys[characterName] += amount;
  return userData.characterKeys[characterName];
}

function getCharacterKeyCount(userData, characterName) {
  initializeCharacterKeys(userData);
  return userData.characterKeys[characterName] || 0;
}

function hasCharacter(userData, characterName) {
  return (userData.characters || []).some(c => c.name === characterName);
}

function canUnlockCharacter(userData, characterName) {
  const keys = getCharacterKeyCount(userData, characterName);
  return keys >= KEYS_TO_UNLOCK && !hasCharacter(userData, characterName);
}

function isCharacterInBundle(characterName, serverId) {
  const serverGame = getServerGame(serverId) || DEFAULT_GAME;
  const bundleChars = characterManager.getCharactersByGame(serverGame);
  return bundleChars.some(c => c.name.toLowerCase() === characterName.toLowerCase());
}

function getBundleCharacters(serverId) {
  const serverGame = getServerGame(serverId) || DEFAULT_GAME;
  return characterManager.getCharactersByGame(serverGame);
}

async function unlockCharacterWithKeys(userData, characterName, data, serverId) {
  if (!serverId) {
    return { success: false, message: '❌ Server ID required for key unlocks!' };
  }
  
  // Look up the character first to get the canonical name
  const char = characterManager.getCharacterByName(characterName);
  if (!char) {
    return { success: false, message: '❌ Character not found!' };
  }
  
  // Use the canonical character name from the database for all operations
  const canonicalName = char.name;
  
  if (!isCharacterInBundle(canonicalName, serverId)) {
    const serverGame = getServerGame(serverId) || DEFAULT_GAME;
    return { success: false, message: `❌ **${canonicalName}** is not available in this server's bundle (**${serverGame}**)!\n\nYou can only unlock characters from your server's selected game.` };
  }
  
  if (!canUnlockCharacter(userData, canonicalName)) {
    const keys = getCharacterKeyCount(userData, canonicalName);
    if (hasCharacter(userData, canonicalName)) {
      return { success: false, message: `❌ You already own **${canonicalName}**!` };
    }
    return { success: false, message: `❌ You need ${KEYS_TO_UNLOCK} keys to unlock **${canonicalName}**!\n\n📊 You have: ${keys}/${KEYS_TO_UNLOCK} keys` };
  }
  
  userData.characterKeys[canonicalName] -= KEYS_TO_UNLOCK;
  
  const { assignMovesToCharacter, calculateBaseHP } = require('./battleUtils.js');
  const st = parseFloat((Math.random() * 100).toFixed(2));
  const moves = assignMovesToCharacter(char.name, st);
  const baseHp = calculateBaseHP(st);
  
  userData.characters.push({
    name: char.name,
    emoji: char.emoji,
    level: 1,
    tokens: 0,
    st: st,
    moves: moves,
    baseHp: baseHp,
    currentSkin: 'default',
    ownedSkins: ['default']
  });
  
  await saveDataImmediate(data);
  
  return {
    success: true,
    message: `🎉 **CHARACTER UNLOCKED!**\n\nYou unlocked **${char.emoji} ${char.name}**!\n\n**ST:** ${st}%\n**Level:** 1\n**HP:** ${baseHp}\n\nYou used ${KEYS_TO_UNLOCK} ${char.name} keys!`,
    character: char,
    st: st
  };
}

function convertExcessKeysToTokens(userData, characterName) {
  if (!hasCharacter(userData, characterName)) {
    return { converted: 0, message: 'Character not owned yet' };
  }
  
  const keys = getCharacterKeyCount(userData, characterName);
  if (keys <= 0) {
    return { converted: 0, message: 'No keys to convert' };
  }
  
  const userChar = userData.characters.find(c => c.name === characterName);
  if (userChar) {
    userChar.tokens = (userChar.tokens || 0) + keys;
  }
  
  userData.characterKeys[characterName] = 0;
  
  return { 
    converted: keys, 
    message: `Converted ${keys} keys to ${characterName} tokens!` 
  };
}

function convertAllExcessKeysToTokens(userData) {
  let totalConverted = 0;
  const conversions = [];
  
  initializeCharacterKeys(userData);
  
  for (const charName of Object.keys(userData.characterKeys)) {
    if (hasCharacter(userData, charName)) {
      const result = convertExcessKeysToTokens(userData, charName);
      if (result.converted > 0) {
        totalConverted += result.converted;
        conversions.push({ character: charName, amount: result.converted });
      }
    }
  }
  
  return { totalConverted, conversions };
}

function distributeExcessKeysToOtherChars(userData) {
  let totalDistributed = 0;
  const distributions = [];
  
  initializeCharacterKeys(userData);
  
  const ownedCharNames = (userData.characters || []).map(c => c.name);
  const unownedWithKeys = Object.entries(userData.characterKeys)
    .filter(([name, count]) => !ownedCharNames.includes(name) && count > KEYS_TO_UNLOCK)
    .map(([name, count]) => ({ name, excess: count - KEYS_TO_UNLOCK }));
  
  for (const { name, excess } of unownedWithKeys) {
    const unlockedChar = userData.characters.find(c => c.name !== name);
    if (unlockedChar) {
      unlockedChar.tokens = (unlockedChar.tokens || 0) + excess;
      userData.characterKeys[name] -= excess;
      totalDistributed += excess;
      distributions.push({ from: name, to: unlockedChar.name, amount: excess });
    }
  }
  
  return { totalDistributed, distributions };
}

function createProgressBar(current, max, length = 20) {
  const progress = Math.min(current / max, 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  
  const filledChar = '█';
  const emptyChar = '░';
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

async function displayCharacterKeysMenu(message, data, userId, page = 1) {
  const userData = data.users[userId];
  const serverId = message.guild?.id;
  
  if (!userData || !userData.started) {
    return message.reply('❌ You need to use `!start` first!');
  }
  
  initializeCharacterKeys(userData);
  
  const serverGame = getServerGame(serverId) || DEFAULT_GAME;
  const bundleChars = getBundleCharacters(serverId);
  const keysData = [];
  
  for (const char of bundleChars) {
    const keyCount = userData.characterKeys[char.name] || 0;
    const owned = hasCharacter(userData, char.name);
    const emoji = getCharacterKeyEmoji(char.name);
    
    keysData.push({
      name: char.name,
      charEmoji: char.emoji,
      keyEmoji: emoji,
      keys: keyCount,
      owned: owned,
      progress: Math.min((keyCount / KEYS_TO_UNLOCK) * 100, 100).toFixed(1),
      canUnlock: keyCount >= KEYS_TO_UNLOCK && !owned
    });
  }
  
  keysData.sort((a, b) => {
    if (a.canUnlock && !b.canUnlock) return -1;
    if (!a.canUnlock && b.canUnlock) return 1;
    if (a.owned && !b.owned) return 1;
    if (!a.owned && b.owned) return -1;
    return b.keys - a.keys;
  });
  
  const itemsPerPage = 10;
  const totalPages = Math.ceil(keysData.length / itemsPerPage) || 1;
  page = Math.max(1, Math.min(page, totalPages));
  
  const startIdx = (page - 1) * itemsPerPage;
  const pageData = keysData.slice(startIdx, startIdx + itemsPerPage);
  
  let description = '';
  
  for (const item of pageData) {
    const progressBar = createProgressBar(item.keys, KEYS_TO_UNLOCK, 15);
    let statusIcon = '';
    
    if (item.owned) {
      statusIcon = '✅';
    } else if (item.canUnlock) {
      statusIcon = '🔓';
    } else {
      statusIcon = '🔒';
    }
    
    description += `${item.charEmoji} **${item.name}** ${statusIcon}\n`;
    description += `${item.keyEmoji} \`${progressBar}\` ${item.keys}/${KEYS_TO_UNLOCK}\n\n`;
  }
  
  if (description === '') {
    description = '*No character keys collected yet!*\n\nCollect keys from drops during Key Rush events!';
  }
  
  const bundleCharNames = new Set(bundleChars.map(c => c.name));
  const totalKeys = Object.entries(userData.characterKeys)
    .filter(([name, _]) => bundleCharNames.has(name))
    .reduce((sum, [_, count]) => sum + count, 0);
  const unlocksReady = keysData.filter(k => k.canUnlock).length;
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🔑 Character Keys Collection (${serverGame})`)
    .setDescription(description)
    .addFields(
      { 
        name: '📊 Summary', 
        value: `**Total Keys:** ${totalKeys}\n**Ready to Unlock:** ${unlocksReady} characters\n**Keys Needed:** ${KEYS_TO_UNLOCK} per character\n**Bundle:** ${serverGame}`, 
        inline: false 
      }
    )
    .setFooter({ text: `Page ${page}/${totalPages} | Use !keyunlock <character> to unlock | !convertkeys to convert excess` })
    .setTimestamp();
  
  const components = [];
  
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`charkeys_prev_${page}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`charkeys_next_${page}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages)
    );
    components.push(navRow);
  }
  
  if (unlocksReady > 0) {
    const unlockOptions = keysData
      .filter(k => k.canUnlock)
      .slice(0, 25)
      .map(k => ({
        label: `Unlock ${k.name}`,
        description: `${k.keys} keys available`,
        value: `unlock_${k.name}`,
        emoji: k.charEmoji
      }));
    
    if (unlockOptions.length > 0) {
      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('charkeys_unlock_select')
          .setPlaceholder('🔓 Select a character to unlock...')
          .addOptions(unlockOptions)
      );
      components.push(selectRow);
    }
  }
  
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('charkeys_convert')
      .setLabel('Convert Excess Keys')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('charkeys_refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(actionRow);
  
  return message.reply({ embeds: [embed], components });
}

async function handleCharacterKeysButton(interaction, data) {
  const userId = interaction.user.id;
  const userData = data.users[userId];
  
  if (!userData) {
    return interaction.reply({ content: '❌ You need to start the game first!', ephemeral: true });
  }
  
  const customId = interaction.customId;
  
  if (customId.startsWith('charkeys_prev_')) {
    const currentPage = parseInt(customId.split('_')[2]);
    await displayCharacterKeysMenuUpdate(interaction, data, userId, currentPage - 1);
  } else if (customId.startsWith('charkeys_next_')) {
    const currentPage = parseInt(customId.split('_')[2]);
    await displayCharacterKeysMenuUpdate(interaction, data, userId, currentPage + 1);
  } else if (customId === 'charkeys_convert') {
    const result = convertAllExcessKeysToTokens(userData);
    await saveDataImmediate(data);
    
    if (result.totalConverted > 0) {
      const conversionList = result.conversions.map(c => `${c.character}: +${c.amount} tokens`).join('\n');
      await interaction.reply({ 
        content: `✅ **Keys Converted to Tokens!**\n\n${conversionList}\n\n**Total:** ${result.totalConverted} keys converted`, 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: '❌ No excess keys to convert! Keys for owned characters are automatically convertible.', 
        ephemeral: true 
      });
    }
  } else if (customId === 'charkeys_refresh') {
    await displayCharacterKeysMenuUpdate(interaction, data, userId, 1);
  }
}

async function handleCharacterKeysSelect(interaction, data) {
  const userId = interaction.user.id;
  const userData = data.users[userId];
  const selected = interaction.values[0];
  const serverId = interaction.guild?.id;
  
  if (!userData) {
    return interaction.reply({ content: '❌ You need to start the game first!', ephemeral: true });
  }
  
  if (selected.startsWith('unlock_')) {
    const charName = selected.replace('unlock_', '');
    const result = await unlockCharacterWithKeys(userData, charName, data, serverId);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 CHARACTER UNLOCKED!')
        .setDescription(`You unlocked **${result.character.emoji} ${result.character.name}**!\n\n**ST:** ${result.st}%\n**Level:** 1\n\nUsed ${KEYS_TO_UNLOCK} keys!`)
        .setFooter({ text: 'Use !profile to view your characters!' });
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({ content: result.message, ephemeral: true });
    }
  }
}

async function displayCharacterKeysMenuUpdate(interaction, data, userId, page) {
  const userData = data.users[userId];
  const serverId = interaction.guild?.id;
  
  if (!userData || !userData.started) {
    return interaction.reply({ content: '❌ You need to use `!start` first!', ephemeral: true });
  }
  
  initializeCharacterKeys(userData);
  
  const serverGame = getServerGame(serverId) || DEFAULT_GAME;
  const bundleChars = getBundleCharacters(serverId);
  const keysData = [];
  
  for (const char of bundleChars) {
    const keyCount = userData.characterKeys[char.name] || 0;
    const owned = hasCharacter(userData, char.name);
    const emoji = getCharacterKeyEmoji(char.name);
    
    keysData.push({
      name: char.name,
      charEmoji: char.emoji,
      keyEmoji: emoji,
      keys: keyCount,
      owned: owned,
      progress: Math.min((keyCount / KEYS_TO_UNLOCK) * 100, 100).toFixed(1),
      canUnlock: keyCount >= KEYS_TO_UNLOCK && !owned
    });
  }
  
  keysData.sort((a, b) => {
    if (a.canUnlock && !b.canUnlock) return -1;
    if (!a.canUnlock && b.canUnlock) return 1;
    if (a.owned && !b.owned) return 1;
    if (!a.owned && b.owned) return -1;
    return b.keys - a.keys;
  });
  
  const itemsPerPage = 10;
  const totalPages = Math.ceil(keysData.length / itemsPerPage) || 1;
  page = Math.max(1, Math.min(page, totalPages));
  
  const startIdx = (page - 1) * itemsPerPage;
  const pageData = keysData.slice(startIdx, startIdx + itemsPerPage);
  
  let description = '';
  
  for (const item of pageData) {
    const progressBar = createProgressBar(item.keys, KEYS_TO_UNLOCK, 15);
    let statusIcon = '';
    
    if (item.owned) {
      statusIcon = '✅';
    } else if (item.canUnlock) {
      statusIcon = '🔓';
    } else {
      statusIcon = '🔒';
    }
    
    description += `${item.charEmoji} **${item.name}** ${statusIcon}\n`;
    description += `${item.keyEmoji} \`${progressBar}\` ${item.keys}/${KEYS_TO_UNLOCK}\n\n`;
  }
  
  if (description === '') {
    description = '*No character keys collected yet!*\n\nCollect keys from drops during Key Rush events!';
  }
  
  const bundleCharNames = new Set(bundleChars.map(c => c.name));
  const totalKeys = Object.entries(userData.characterKeys)
    .filter(([name, _]) => bundleCharNames.has(name))
    .reduce((sum, [_, count]) => sum + count, 0);
  const unlocksReady = keysData.filter(k => k.canUnlock).length;
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🔑 Character Keys Collection (${serverGame})`)
    .setDescription(description)
    .addFields(
      { 
        name: '📊 Summary', 
        value: `**Total Keys:** ${totalKeys}\n**Ready to Unlock:** ${unlocksReady} characters\n**Keys Needed:** ${KEYS_TO_UNLOCK} per character\n**Bundle:** ${serverGame}`, 
        inline: false 
      }
    )
    .setFooter({ text: `Page ${page}/${totalPages} | Use !keyunlock <character> to unlock | !convertkeys to convert excess` })
    .setTimestamp();
  
  const components = [];
  
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`charkeys_prev_${page}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`charkeys_next_${page}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages)
    );
    components.push(navRow);
  }
  
  if (unlocksReady > 0) {
    const unlockOptions = keysData
      .filter(k => k.canUnlock)
      .slice(0, 25)
      .map(k => ({
        label: `Unlock ${k.name}`,
        description: `${k.keys} keys available`,
        value: `unlock_${k.name}`,
        emoji: k.charEmoji
      }));
    
    if (unlockOptions.length > 0) {
      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('charkeys_unlock_select')
          .setPlaceholder('🔓 Select a character to unlock...')
          .addOptions(unlockOptions)
      );
      components.push(selectRow);
    }
  }
  
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('charkeys_convert')
      .setLabel('Convert Excess Keys')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('charkeys_refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(actionRow);
  
  await interaction.update({ embeds: [embed], components });
}

function isKeyRushActive(serverId) {
  const config = getServerConfig(serverId);
  if (!config) return false;
  
  if (!config.keyRushUntil) return false;
  
  return Date.now() < config.keyRushUntil;
}

function getKeyRushTimeRemaining(serverId) {
  const config = getServerConfig(serverId);
  if (!config || !config.keyRushUntil) return '0m';
  
  const remaining = config.keyRushUntil - Date.now();
  if (remaining <= 0) return '0m';
  
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

async function activateKeyRush(serverId, userId, data, isGranted = false) {
  const { areDropsActive, stopDropsForServer } = require('./dropSystem.js');
  
  if (areDropsActive(serverId) && !isMainServer(serverId)) {
    return { 
      success: false, 
      message: '⚠️ **Warning:** Regular drops are currently active!\n\nKey Rush will replace regular drops for 1 hour. Regular drops will resume after Key Rush ends.\n\nUse `!keyrush confirm` to proceed anyway.',
      needsConfirmation: true
    };
  }
  
  const config = getServerConfig(serverId);
  if (!config) {
    return { success: false, message: '❌ Server not configured!' };
  }
  
  if (!isGranted) {
    const userData = data.users[userId];
    if (!userData) {
      return { success: false, message: '❌ User data not found!' };
    }
    
    if ((userData.gems || 0) < KEY_RUSH_COST) {
      return { 
        success: false, 
        message: `❌ You need ${KEY_RUSH_COST} gems to activate Key Rush!\n💎 You have: ${userData.gems || 0} gems` 
      };
    }
    
    userData.gems -= KEY_RUSH_COST;
    await saveDataImmediate(data);
  }
  
  const expiryTime = Date.now() + KEY_RUSH_DURATION;
  config.keyRushUntil = expiryTime;
  config.keyRushActivatedBy = userId;
  
  await saveServerConfig(serverId, config);
  
  startKeyRushDrops(serverId);
  
  const expiryDate = new Date(expiryTime);
  return {
    success: true,
    message: `🔑 **KEY RUSH ACTIVATED!**\n\n⏰ Duration: 1 hour\n📍 Channel: <#${config.dropChannelId || KEY_RUSH_CHANNEL}>\n\n🎁 For the next hour, all drops will be **Character Keys**!\nCollect ${KEYS_TO_UNLOCK} keys of any character to unlock them!\n\n⏰ Ends at: ${expiryDate.toLocaleTimeString()}`,
    expiryTime
  };
}

async function activateKeyRushConfirmed(serverId, userId, data, isGranted = false) {
  const { stopDropsForServer } = require('./dropSystem.js');
  
  await stopDropsForServer(serverId, false);
  
  const config = getServerConfig(serverId);
  if (!config) {
    return { success: false, message: '❌ Server not configured!' };
  }
  
  if (!isGranted) {
    const userData = data.users[userId];
    if (!userData) {
      return { success: false, message: '❌ User data not found!' };
    }
    
    if ((userData.gems || 0) < KEY_RUSH_COST) {
      return { 
        success: false, 
        message: `❌ You need ${KEY_RUSH_COST} gems to activate Key Rush!\n💎 You have: ${userData.gems || 0} gems` 
      };
    }
    
    userData.gems -= KEY_RUSH_COST;
    await saveDataImmediate(data);
  }
  
  const expiryTime = Date.now() + KEY_RUSH_DURATION;
  config.keyRushUntil = expiryTime;
  config.keyRushActivatedBy = userId;
  
  await saveServerConfig(serverId, config);
  
  startKeyRushDrops(serverId);
  
  const expiryDate = new Date(expiryTime);
  return {
    success: true,
    message: `🔑 **KEY RUSH ACTIVATED!**\n\n⚠️ Regular drops have been stopped.\n⏰ Duration: 1 hour\n📍 Channel: <#${config.dropChannelId || KEY_RUSH_CHANNEL}>\n\n🎁 For the next hour, all drops will be **Character Keys**!\nCollect ${KEYS_TO_UNLOCK} keys of any character to unlock them!\n\n⏰ Ends at: ${expiryDate.toLocaleTimeString()}`,
    expiryTime
  };
}

async function grantKeyRush(serverId, grantedByUserId) {
  if (!isSuperAdmin(grantedByUserId)) {
    return { success: false, message: '❌ Only Super Admins can grant Key Rush!' };
  }
  
  const config = getServerConfig(serverId);
  if (!config) {
    return { success: false, message: '❌ Server not configured!' };
  }
  
  const expiryTime = Date.now() + KEY_RUSH_DURATION;
  config.keyRushUntil = expiryTime;
  config.keyRushActivatedBy = grantedByUserId;
  config.keyRushGranted = true;
  
  await saveServerConfig(serverId, config);
  
  startKeyRushDrops(serverId);
  
  const expiryDate = new Date(expiryTime);
  return {
    success: true,
    message: `🔑 **KEY RUSH GRANTED!**\n\n⏰ Duration: 1 hour\n📍 Channel: <#${config.dropChannelId || KEY_RUSH_CHANNEL}>\n\n🎁 Character Key drops are now active!\n\n⏰ Ends at: ${expiryDate.toLocaleTimeString()}`,
    expiryTime
  };
}

function startKeyRushDrops(serverId) {
  if (keyRushIntervals.has(serverId)) {
    clearInterval(keyRushIntervals.get(serverId));
  }
  
  const interval = isMainServer(serverId) ? 45000 : 60000;
  
  const intervalId = setInterval(() => {
    executeKeyDrop(serverId);
  }, interval);
  
  keyRushIntervals.set(serverId, intervalId);
  console.log(`🔑 Key Rush drops started for server ${serverId}`);
}

function stopKeyRushDrops(serverId, sendNotification = true) {
  if (keyRushIntervals.has(serverId)) {
    clearInterval(keyRushIntervals.get(serverId));
    keyRushIntervals.delete(serverId);
    console.log(`🔑 Key Rush drops stopped for server ${serverId}`);
    
    if (sendNotification && activeClient) {
      sendKeyRushEndNotification(serverId);
    }
  }
}

async function sendKeyRushEndNotification(serverId) {
  try {
    const config = getServerConfig(serverId);
    const channelId = isMainServer(serverId) ? MAIN_DROP_CHANNEL : config?.dropChannelId;
    
    if (!channelId || !activeClient) return;
    
    const channel = await activeClient.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    
    let resumeMessage = '';
    
    if (!dropsWerePausedBefore && activeData) {
      const { startDropsForServer, areDropsActive } = require('./dropSystem.js');
      if (!areDropsActive(serverId)) {
        console.log(`🎮 Auto-resuming drops after Key Rush for server ${serverId}`);
        try {
          await startDropsForServer(activeClient, activeData, serverId);
          resumeMessage = '\n\n✅ **Regular drops are resuming now!**';
        } catch (err) {
          console.error('Error auto-resuming drops:', err);
          resumeMessage = '\n\n⚠️ Use `!revive` to resume drops.';
        }
      }
    } else {
      resumeMessage = '\n\n*Use `!revive` to start drops if needed.*';
    }
    
    dropsWerePausedBefore = false;
    
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('🔑 Key Rush Ended!')
      .setDescription(`The Key Rush event has ended!\n\n📊 Check your collected keys with \`!charkeys\`\n🔓 Unlock characters with \`!keyunlock <name>\`\n🔄 Convert excess keys with \`!convertkeys\`${resumeMessage}`)
      .setFooter({ text: 'Thanks for participating!' })
      .setTimestamp();
    
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending Key Rush end notification:', error);
  }
}

async function getEventRole(guild) {
  try {
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === EVENT_ROLE_NAME.toLowerCase());
    return role;
  } catch (error) {
    console.error('Error finding event role:', error);
    return null;
  }
}

async function sendKeyRushStartNotification(serverId, duration = '1 hour') {
  try {
    const config = getServerConfig(serverId);
    const channelId = isMainServer(serverId) ? MAIN_DROP_CHANNEL : config?.dropChannelId;
    
    if (!channelId || !activeClient) return;
    
    const channel = await activeClient.channels.fetch(channelId).catch(() => null);
    if (!channel) return;
    
    const eventRole = await getEventRole(channel.guild);
    const pingMessage = eventRole ? `<@&${eventRole.id}>` : '';
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🔑✨ KEY RUSH EVENT STARTED! ✨🔑')
      .setDescription(`**Get ready to collect Character Keys!**\n\n⏰ **Duration:** ${duration}\n🎁 **All drops are now Character Keys!**\n\n**How it works:**\n• Catch drops to collect character keys\n• Each character needs **${KEYS_TO_UNLOCK} keys** to unlock\n• Keys drop for random characters from this server's bundle\n\n**Commands:**\n• \`!charkeys\` - View your key collection\n• \`!keyunlock <name>\` - Unlock a character\n• \`!convertkeys\` - Convert excess keys to tokens\n\n*Happy hunting!* 🎯`)
      .setFooter({ text: 'Key Rush Event | Type !c <code> to catch drops!' })
      .setTimestamp();
    
    await channel.send({ content: pingMessage, embeds: [embed] });
  } catch (error) {
    console.error('Error sending Key Rush start notification:', error);
  }
}

async function executeKeyDrop(serverId) {
  if (!activeClient || !activeData) return;
  
  try {
    if (!isKeyRushActive(serverId)) {
      stopKeyRushDrops(serverId);
      return;
    }
    
    const config = getServerConfig(serverId);
    const channelId = isMainServer(serverId) ? MAIN_DROP_CHANNEL : (config?.dropChannelId || null);
    
    if (!channelId) {
      console.error(`❌ No channel configured for Key Rush in server ${serverId}`);
      return;
    }
    
    const channel = await activeClient.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error(`❌ Channel ${channelId} not found for server ${serverId}`);
      return;
    }
    
    const serverGame = getServerGame(serverId) || DEFAULT_GAME;
    const gameChars = characterManager.getCharactersByGame(serverGame);
    
    if (gameChars.length === 0) {
      console.error(`❌ No characters found for game ${serverGame}`);
      return;
    }
    
    const randomChar = gameChars[Math.floor(Math.random() * gameChars.length)];
    const keyEmoji = getCharacterKeyEmoji(randomChar.name);
    const amount = Math.floor(Math.random() * 3) + 1;
    
    const DROP_CODES = ['tyrant', 'zooba', 'zoo', 'catch', 'grab', 'quick', 'fast', 'win', 'get', 'take'];
    const code = DROP_CODES[Math.floor(Math.random() * DROP_CODES.length)];
    
    const timeRemaining = getKeyRushTimeRemaining(serverId);
    
    const dropEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🔑 CHARACTER KEY DROP!')
      .setDescription(`A **${randomChar.emoji} ${randomChar.name}** key appeared!\n\n${keyEmoji} **Reward:** ${amount} ${randomChar.name} Key${amount > 1 ? 's' : ''}\n\nType \`!c ${code}\` to catch it!`)
      .setFooter({ text: `⏰ Key Rush: ${timeRemaining} | First to catch wins!` })
      .setTimestamp();
    
    const dropMessage = await channel.send({ embeds: [dropEmbed] });
    
    if (!activeData.serverDrops) {
      activeData.serverDrops = {};
    }
    
    activeData.serverDrops[serverId] = {
      type: 'characterKey',
      amount,
      code,
      characterName: randomChar.name,
      characterEmoji: randomChar.emoji,
      messageId: dropMessage.id,
      serverId,
      spawnedAt: Date.now()
    };
    
    saveData(activeData);
    
  } catch (error) {
    console.error('❌ Key drop execution error:', error);
  }
}

async function catchKeyDrop(userId, serverId, data) {
  const drop = data.serverDrops?.[serverId];
  
  if (!drop || drop.type !== 'characterKey') {
    return null;
  }
  
  const userData = data.users[userId];
  if (!userData) {
    return { success: false, message: '❌ User not found!' };
  }
  
  initializeCharacterKeys(userData);
  
  const bundleChars = getBundleCharacters(serverId);
  if (bundleChars.length === 0) {
    delete data.serverDrops[serverId];
    return { success: false, message: '❌ No characters available in this bundle!' };
  }
  
  let characterName = drop.characterName || '';
  let characterEmoji = drop.characterEmoji || '🔑';
  const amount = drop.amount || 1;
  
  if (!characterName || !isCharacterInBundle(characterName, serverId)) {
    const randomChar = bundleChars[Math.floor(Math.random() * bundleChars.length)];
    characterName = randomChar.name;
    characterEmoji = randomChar.emoji;
  }
  
  const newTotal = addCharacterKeys(userData, characterName, amount);
  const owned = hasCharacter(userData, characterName);
  
  delete data.serverDrops[serverId];
  await saveDataImmediate(data);
  
  let bonusMessage = '';
  if (owned) {
    const converted = convertExcessKeysToTokens(userData, characterName);
    if (converted.converted > 0) {
      await saveDataImmediate(data);
      bonusMessage = `\n🔄 **Auto-converted to ${converted.converted} tokens** (you own this character!)`;
    }
  } else if (newTotal >= KEYS_TO_UNLOCK) {
    bonusMessage = `\n🔓 **You can now unlock ${characterName}!** Use \`!keyunlock ${characterName}\``;
  } else {
    const remaining = KEYS_TO_UNLOCK - newTotal;
    bonusMessage = `\n📊 Progress: ${newTotal}/${KEYS_TO_UNLOCK} (${remaining} more needed)`;
  }
  
  return {
    success: true,
    type: 'characterKey',
    characterName: characterName,
    characterEmoji: characterEmoji,
    amount: amount,
    newTotal,
    bonusMessage
  };
}

function initKeyRushScheduler(client, data) {
  activeClient = client;
  activeData = data;
  
  if (keyRushScheduler) {
    clearInterval(keyRushScheduler);
  }
  
  keyRushScheduler = setInterval(() => {
    checkScheduledKeyRush();
  }, 60000);
  
  console.log('🔑 Key Rush scheduler initialized');
}

async function checkScheduledKeyRush() {
  if (!activeClient || !isMainServer(MAIN_SERVER_ID)) return;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  for (const schedule of KEY_RUSH_SCHEDULE) {
    if (currentHour === schedule.hour && currentMinute === schedule.minute) {
      if (!isKeyRushActive(MAIN_SERVER_ID)) {
        console.log(`🔑 Starting scheduled Key Rush at ${currentHour}:${currentMinute}`);
        
        const { areDropsActive, stopDropsForServer, startDropsForServer } = require('./dropSystem.js');
        dropsWerePausedBefore = !areDropsActive(MAIN_SERVER_ID);
        
        if (areDropsActive(MAIN_SERVER_ID)) {
          console.log('⏸️ Pausing regular drops for Key Rush event');
          await stopDropsForServer(MAIN_SERVER_ID, false);
        }
        
        const config = getServerConfig(MAIN_SERVER_ID) || {};
        config.keyRushUntil = Date.now() + KEY_RUSH_DURATION;
        config.keyRushActivatedBy = 'SYSTEM';
        await saveServerConfig(MAIN_SERVER_ID, config);
        
        await sendKeyRushStartNotification(MAIN_SERVER_ID, '1 hour');
        startKeyRushDrops(MAIN_SERVER_ID);
      }
    }
  }
  
  if (isKeyRushActive(MAIN_SERVER_ID)) {
    const config = getServerConfig(MAIN_SERVER_ID);
    if (config && config.keyRushUntil && Date.now() >= config.keyRushUntil) {
      stopKeyRushDrops(MAIN_SERVER_ID, true);
      config.keyRushUntil = null;
      await saveServerConfig(MAIN_SERVER_ID, config);
    }
  }
}

async function stopKeyRush(serverId, stoppedByUserId) {
  if (!isSuperAdmin(stoppedByUserId)) {
    return { success: false, message: '❌ Only Super Admins can stop Key Rush!' };
  }
  
  if (!isKeyRushActive(serverId)) {
    return { success: false, message: '❌ No Key Rush event is currently active!' };
  }
  
  const config = getServerConfig(serverId);
  if (!config) {
    return { success: false, message: '❌ Server not configured!' };
  }
  
  stopKeyRushDrops(serverId, true);
  
  config.keyRushUntil = null;
  config.keyRushActivatedBy = null;
  config.keyRushGranted = false;
  await saveServerConfig(serverId, config);
  
  const { startDropsForServer } = require('./dropSystem.js');
  if (isMainServer(serverId)) {
    try {
      await startDropsForServer(serverId);
      console.log('🎮 Regular drops resumed after Key Rush stopped');
    } catch (err) {
      console.error('Error resuming drops:', err);
    }
  }
  
  return {
    success: true,
    message: `🛑 **KEY RUSH STOPPED!**\n\nThe Key Rush event has been manually stopped.\n✅ Regular drops are resuming now.`
  };
}

module.exports = {
  KEYS_TO_UNLOCK,
  KEY_RUSH_COST,
  KEY_RUSH_DURATION,
  initializeCharacterKeys,
  getCharacterKeyEmoji,
  setCharacterKeyEmoji,
  addCharacterKeys,
  getCharacterKeyCount,
  hasCharacter,
  canUnlockCharacter,
  isCharacterInBundle,
  getBundleCharacters,
  unlockCharacterWithKeys,
  convertExcessKeysToTokens,
  convertAllExcessKeysToTokens,
  distributeExcessKeysToOtherChars,
  createProgressBar,
  displayCharacterKeysMenu,
  handleCharacterKeysButton,
  handleCharacterKeysSelect,
  isKeyRushActive,
  getKeyRushTimeRemaining,
  activateKeyRush,
  activateKeyRushConfirmed,
  grantKeyRush,
  startKeyRushDrops,
  stopKeyRushDrops,
  executeKeyDrop,
  catchKeyDrop,
  initKeyRushScheduler,
  sendKeyRushStartNotification,
  sendKeyRushEndNotification,
  stopKeyRush
};
