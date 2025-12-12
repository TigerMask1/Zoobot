const { EmbedBuilder } = require('discord.js');
const { getCollection } = require('./mongoManager.js');

const SERVER_LEVEL_CONFIG = [
  { level: 1, auraRequired: 0, maxCharSlots: 5, maxCollectSlots: 10, badgeGrantLimit: 0, canCreateProfile: false },
  { level: 2, auraRequired: 500, maxCharSlots: 8, maxCollectSlots: 15, badgeGrantLimit: 0, canCreateProfile: false },
  { level: 3, auraRequired: 1500, maxCharSlots: 12, maxCollectSlots: 20, badgeGrantLimit: 3, canCreateProfile: true },
  { level: 4, auraRequired: 3500, maxCharSlots: 18, maxCollectSlots: 30, badgeGrantLimit: 3, canCreateProfile: true },
  { level: 5, auraRequired: 7000, maxCharSlots: 25, maxCollectSlots: 45, badgeGrantLimit: 5, canCreateProfile: true },
  { level: 6, auraRequired: 12000, maxCharSlots: 35, maxCollectSlots: 60, badgeGrantLimit: 5, canCreateProfile: true },
  { level: 7, auraRequired: 20000, maxCharSlots: 50, maxCollectSlots: 80, badgeGrantLimit: 10, canCreateProfile: true },
  { level: 8, auraRequired: 32000, maxCharSlots: 70, maxCollectSlots: 100, badgeGrantLimit: 10, canCreateProfile: true },
  { level: 9, auraRequired: 50000, maxCharSlots: 100, maxCollectSlots: 130, badgeGrantLimit: 15, canCreateProfile: true },
  { level: 10, auraRequired: 80000, maxCharSlots: 150, maxCollectSlots: 175, badgeGrantLimit: 15, canCreateProfile: true },
  { level: 11, auraRequired: 120000, maxCharSlots: 200, maxCollectSlots: 225, badgeGrantLimit: 15, canCreateProfile: true },
  { level: 12, auraRequired: 180000, maxCharSlots: 275, maxCollectSlots: 300, badgeGrantLimit: 15, canCreateProfile: true },
  { level: 13, auraRequired: 260000, maxCharSlots: 375, maxCollectSlots: 400, badgeGrantLimit: 15, canCreateProfile: true },
  { level: 14, auraRequired: 370000, maxCharSlots: 500, maxCollectSlots: 550, badgeGrantLimit: 15, canCreateProfile: true },
  { level: 15, auraRequired: 500000, maxCharSlots: 750, maxCollectSlots: 800, badgeGrantLimit: 15, canCreateProfile: true }
];

const AURA_REWARDS = {
  command: 1,
  drop_catch: 5,
  battle_win: 8,
  battle_loss: 3,
  crate_open: 4,
  daily_claim: 10,
  quest_complete: 15,
  work_complete: 3,
  trade_complete: 5,
  collectible_drop: 6,
  minigame: 2,
  trivia_correct: 4
};

const SLOT_BASE_COST = {
  character: 50,
  collectible: 25
};

const SLOT_COST_MULTIPLIER = 1.15;

async function initializeServerAuraIndexes() {
  try {
    const collection = await getCollection('serverAura');
    await collection.createIndex({ serverId: 1 }, { unique: true });
    console.log('✅ Server Aura indexes created');
  } catch (error) {
    console.error('Error creating server aura indexes:', error);
  }
}

async function getServerAura(serverId) {
  try {
    const collection = await getCollection('serverAura');
    let serverAura = await collection.findOne({ serverId });
    
    if (!serverAura) {
      serverAura = {
        serverId,
        totalAura: 0,
        weeklyAura: 0,
        weekStartTime: Date.now(),
        level: 1,
        purchasedCharSlots: 0,
        purchasedCollectSlots: 0,
        profileImage: null,
        profileImageSetBy: null,
        badgeImage: null,
        badgeGrantedTo: [],
        createdAt: new Date(),
        lastActivity: new Date()
      };
      await collection.insertOne(serverAura);
    }
    
    if (serverAura.weeklyAura === undefined) serverAura.weeklyAura = 0;
    if (serverAura.weekStartTime === undefined) serverAura.weekStartTime = Date.now();
    if (serverAura.badgeGrantedTo === undefined) serverAura.badgeGrantedTo = [];
    if (serverAura.purchasedCharSlots === undefined) serverAura.purchasedCharSlots = 0;
    if (serverAura.purchasedCollectSlots === undefined) serverAura.purchasedCollectSlots = 0;
    
    return serverAura;
  } catch (error) {
    console.error('Error getting server aura:', error);
    return null;
  }
}

async function addAura(serverId, amount, source = 'command') {
  try {
    const collection = await getCollection('serverAura');
    const auraAmount = AURA_REWARDS[source] || amount;
    
    const result = await collection.findOneAndUpdate(
      { serverId },
      {
        $inc: { 
          totalAura: auraAmount,
          weeklyAura: auraAmount
        },
        $set: { lastActivity: new Date() },
        $setOnInsert: {
          serverId,
          level: 1,
          purchasedCharSlots: 0,
          purchasedCollectSlots: 0,
          profileImage: null,
          profileImageSetBy: null,
          badgeImage: null,
          badgeGrantedTo: [],
          weekStartTime: Date.now(),
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    const serverAura = result;
    if (serverAura) {
      const newLevel = calculateServerLevel(serverAura.totalAura);
      if (newLevel > serverAura.level) {
        await collection.updateOne(
          { serverId },
          { $set: { level: newLevel } }
        );
        return { auraAdded: auraAmount, leveledUp: true, newLevel, totalAura: serverAura.totalAura };
      }
    }
    
    return { auraAdded: auraAmount, leveledUp: false, totalAura: serverAura?.totalAura || 0 };
  } catch (error) {
    console.error('Error adding aura:', error);
    return { auraAdded: 0, leveledUp: false, error: true };
  }
}

function calculateServerLevel(totalAura) {
  let level = 1;
  for (let i = SERVER_LEVEL_CONFIG.length - 1; i >= 0; i--) {
    if (totalAura >= SERVER_LEVEL_CONFIG[i].auraRequired) {
      level = SERVER_LEVEL_CONFIG[i].level;
      break;
    }
  }
  return level;
}

function getServerLevelConfig(level) {
  const config = SERVER_LEVEL_CONFIG.find(c => c.level === level);
  if (!config) {
    const lastConfig = SERVER_LEVEL_CONFIG[SERVER_LEVEL_CONFIG.length - 1];
    const extraLevels = level - lastConfig.level;
    return {
      level,
      auraRequired: lastConfig.auraRequired + (extraLevels * 100000),
      maxCharSlots: lastConfig.maxCharSlots + (extraLevels * 100),
      maxCollectSlots: lastConfig.maxCollectSlots + (extraLevels * 100),
      badgeGrantLimit: 15,
      canCreateProfile: true
    };
  }
  return config;
}

function getNextLevelConfig(currentLevel) {
  return getServerLevelConfig(currentLevel + 1);
}

function calculateSlotCost(currentPurchased, slotType) {
  const baseCost = SLOT_BASE_COST[slotType] || 50;
  return Math.floor(baseCost * Math.pow(SLOT_COST_MULTIPLIER, currentPurchased));
}

async function purchaseSlot(serverId, slotType, userId) {
  try {
    const serverAura = await getServerAura(serverId);
    if (!serverAura) {
      return { success: false, message: '❌ Server aura data not found!' };
    }
    
    const levelConfig = getServerLevelConfig(serverAura.level);
    const currentSlots = slotType === 'character' 
      ? serverAura.purchasedCharSlots 
      : serverAura.purchasedCollectSlots;
    const maxSlots = slotType === 'character' 
      ? levelConfig.maxCharSlots 
      : levelConfig.maxCollectSlots;
    
    if (currentSlots >= maxSlots) {
      return { 
        success: false, 
        message: `❌ You've reached the maximum ${slotType} slots for level ${serverAura.level}!\nLevel up your server to unlock more slots.`
      };
    }
    
    const cost = calculateSlotCost(currentSlots, slotType);
    
    if (serverAura.totalAura < cost) {
      return { 
        success: false, 
        message: `❌ Not enough aura! Need **${cost}** aura, you have **${serverAura.totalAura}**.`
      };
    }
    
    const collection = await getCollection('serverAura');
    const updateField = slotType === 'character' ? 'purchasedCharSlots' : 'purchasedCollectSlots';
    
    await collection.updateOne(
      { serverId },
      { 
        $inc: { 
          totalAura: -cost,
          [updateField]: 1
        }
      }
    );
    
    const newSlotCount = currentSlots + 1;
    const nextCost = calculateSlotCost(newSlotCount, slotType);
    
    return { 
      success: true, 
      message: `✅ Purchased 1 ${slotType} slot for **${cost}** aura!\nYou now have **${newSlotCount}** ${slotType} slots.\nNext slot costs: **${nextCost}** aura.`,
      newSlotCount,
      cost,
      remainingAura: serverAura.totalAura - cost
    };
  } catch (error) {
    console.error('Error purchasing slot:', error);
    return { success: false, message: '❌ An error occurred while purchasing the slot.' };
  }
}

async function getServerSlotLimits(serverId) {
  const serverAura = await getServerAura(serverId);
  if (!serverAura) {
    const defaultConfig = getServerLevelConfig(1);
    return {
      characterSlots: defaultConfig.maxCharSlots,
      collectibleSlots: defaultConfig.maxCollectSlots,
      purchasedCharSlots: 0,
      purchasedCollectSlots: 0,
      level: 1
    };
  }
  
  const levelConfig = getServerLevelConfig(serverAura.level);
  return {
    characterSlots: Math.min(serverAura.purchasedCharSlots, levelConfig.maxCharSlots) || 5,
    collectibleSlots: Math.min(serverAura.purchasedCollectSlots, levelConfig.maxCollectSlots) || 10,
    maxCharSlots: levelConfig.maxCharSlots,
    maxCollectSlots: levelConfig.maxCollectSlots,
    purchasedCharSlots: serverAura.purchasedCharSlots,
    purchasedCollectSlots: serverAura.purchasedCollectSlots,
    level: serverAura.level
  };
}

async function setServerProfileImage(serverId, imageUrl, setBy, isOwner = false) {
  try {
    const serverAura = await getServerAura(serverId);
    if (!serverAura) {
      return { success: false, message: '❌ Server aura data not found!' };
    }
    
    const levelConfig = getServerLevelConfig(serverAura.level);
    if (!levelConfig.canCreateProfile) {
      return { 
        success: false, 
        message: `❌ Your server needs to be level 3 or higher to set a profile image!\nCurrent level: ${serverAura.level}`
      };
    }
    
    const collection = await getCollection('serverAura');
    await collection.updateOne(
      { serverId },
      { 
        $set: { 
          profileImage: imageUrl,
          profileImageSetBy: setBy
        }
      }
    );
    
    return { success: true, message: '✅ Server profile image has been set!' };
  } catch (error) {
    console.error('Error setting server profile image:', error);
    return { success: false, message: '❌ An error occurred while setting the profile image.' };
  }
}

async function setServerBadge(serverId, imageUrl, setBy) {
  try {
    const serverAura = await getServerAura(serverId);
    if (!serverAura) {
      return { success: false, message: '❌ Server aura data not found!' };
    }
    
    const levelConfig = getServerLevelConfig(serverAura.level);
    if (!levelConfig.canCreateProfile) {
      return { 
        success: false, 
        message: `❌ Your server needs to be level 3 or higher to set a badge!\nCurrent level: ${serverAura.level}`
      };
    }
    
    const collection = await getCollection('serverAura');
    await collection.updateOne(
      { serverId },
      { 
        $set: { 
          badgeImage: imageUrl,
          badgeSetBy: setBy
        }
      }
    );
    
    return { success: true, message: '✅ Server badge has been set!' };
  } catch (error) {
    console.error('Error setting server badge:', error);
    return { success: false, message: '❌ An error occurred while setting the badge.' };
  }
}

async function grantBadgeToUser(serverId, targetUserId, grantedBy) {
  try {
    const serverAura = await getServerAura(serverId);
    if (!serverAura) {
      return { success: false, message: '❌ Server aura data not found!' };
    }
    
    if (!serverAura.badgeImage) {
      return { success: false, message: '❌ This server has no badge set! Use `!setserverbadge` first.' };
    }
    
    const levelConfig = getServerLevelConfig(serverAura.level);
    const currentGranted = serverAura.badgeGrantedTo || [];
    
    if (currentGranted.length >= levelConfig.badgeGrantLimit) {
      return { 
        success: false, 
        message: `❌ You've reached the badge grant limit (${levelConfig.badgeGrantLimit}) for level ${serverAura.level}!\nLevel up to grant more badges.`
      };
    }
    
    if (currentGranted.includes(targetUserId)) {
      return { success: false, message: '❌ This user already has the server badge!' };
    }
    
    const collection = await getCollection('serverAura');
    await collection.updateOne(
      { serverId },
      { $push: { badgeGrantedTo: targetUserId } }
    );
    
    const { addPfp } = require('./pfpSystem.js');
    const { saveDataImmediate } = require('./dataManager.js');
    const data = require('./dataManager.js').getData ? require('./dataManager.js').getData() : null;
    
    if (data && data.users && data.users[targetUserId]) {
      const guildName = 'Server Badge';
      await addPfp(targetUserId, serverAura.badgeImage, `${guildName} Badge`, data);
      await saveDataImmediate(data);
    }
    
    return { 
      success: true, 
      message: `✅ Badge granted to <@${targetUserId}>!\nThey now have access to the server badge as a profile image.\n(${currentGranted.length + 1}/${levelConfig.badgeGrantLimit} grants used)`
    };
  } catch (error) {
    console.error('Error granting badge:', error);
    return { success: false, message: '❌ An error occurred while granting the badge.' };
  }
}

async function revokeBadgeFromUser(serverId, targetUserId) {
  try {
    const collection = await getCollection('serverAura');
    await collection.updateOne(
      { serverId },
      { $pull: { badgeGrantedTo: targetUserId } }
    );
    
    return { success: true, message: `✅ Badge revoked from <@${targetUserId}>.` };
  } catch (error) {
    console.error('Error revoking badge:', error);
    return { success: false, message: '❌ An error occurred while revoking the badge.' };
  }
}

async function resetWeeklyAura(serverId) {
  try {
    const collection = await getCollection('serverAura');
    const serverAura = await collection.findOne({ serverId });
    
    const weeklyAura = serverAura?.weeklyAura || 0;
    
    await collection.updateOne(
      { serverId },
      { 
        $set: { 
          weeklyAura: 0,
          weekStartTime: Date.now()
        }
      }
    );
    
    return { weeklyAura, reset: true };
  } catch (error) {
    console.error('Error resetting weekly aura:', error);
    return { weeklyAura: 0, reset: false, error: true };
  }
}

async function getWeeklyAura(serverId) {
  try {
    const serverAura = await getServerAura(serverId);
    return serverAura?.weeklyAura || 0;
  } catch (error) {
    console.error('Error getting weekly aura:', error);
    return 0;
  }
}

async function getAllServersWeeklyAura() {
  try {
    const collection = await getCollection('serverAura');
    const servers = await collection.find({ weeklyAura: { $gt: 0 } })
      .sort({ weeklyAura: -1 })
      .toArray();
    return servers;
  } catch (error) {
    console.error('Error getting all servers weekly aura:', error);
    return [];
  }
}

function formatServerAuraEmbed(serverAura, guildName, guildIcon) {
  const levelConfig = getServerLevelConfig(serverAura.level);
  const nextLevelConfig = getNextLevelConfig(serverAura.level);
  
  const currentAura = serverAura.totalAura;
  const nextLevelAura = nextLevelConfig.auraRequired;
  const currentLevelAura = levelConfig.auraRequired;
  const progress = nextLevelAura > currentLevelAura 
    ? ((currentAura - currentLevelAura) / (nextLevelAura - currentLevelAura) * 100).toFixed(1)
    : 100;
  
  const progressBar = createProgressBar(parseFloat(progress), 15);
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`✨ ${guildName} - Server Aura`)
    .setDescription(`**Level ${serverAura.level}** Server`)
    .addFields(
      { name: '✨ Total Aura', value: `${serverAura.totalAura.toLocaleString()}`, inline: true },
      { name: '📅 Weekly Aura', value: `${(serverAura.weeklyAura || 0).toLocaleString()}`, inline: true },
      { name: '📊 Level Progress', value: `${progressBar}\n${currentAura.toLocaleString()} / ${nextLevelAura.toLocaleString()}`, inline: false },
      { name: '🎭 Character Slots', value: `${serverAura.purchasedCharSlots || 0} / ${levelConfig.maxCharSlots}`, inline: true },
      { name: '🎁 Collectible Slots', value: `${serverAura.purchasedCollectSlots || 0} / ${levelConfig.maxCollectSlots}`, inline: true },
      { name: '🏅 Badge Grants', value: `${(serverAura.badgeGrantedTo || []).length} / ${levelConfig.badgeGrantLimit}`, inline: true }
    );
  
  if (serverAura.profileImage) {
    embed.setThumbnail(serverAura.profileImage);
  } else if (guildIcon) {
    embed.setThumbnail(guildIcon);
  }
  
  const perks = [];
  if (levelConfig.canCreateProfile) perks.push('✅ Server Profile');
  if (levelConfig.badgeGrantLimit > 0) perks.push(`✅ Grant ${levelConfig.badgeGrantLimit} Badges`);
  
  if (perks.length > 0) {
    embed.addFields({ name: '🎁 Level Perks', value: perks.join('\n'), inline: false });
  }
  
  embed.setFooter({ text: 'Earn aura by being active! Use !buyslot to purchase more slots.' });
  embed.setTimestamp();
  
  return embed;
}

function createProgressBar(percent, length = 15) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

async function getServerAuraLeaderboard(limit = 10) {
  try {
    const collection = await getCollection('serverAura');
    const servers = await collection.find({})
      .sort({ totalAura: -1 })
      .limit(limit)
      .toArray();
    return servers;
  } catch (error) {
    console.error('Error getting server aura leaderboard:', error);
    return [];
  }
}

module.exports = {
  SERVER_LEVEL_CONFIG,
  AURA_REWARDS,
  SLOT_BASE_COST,
  SLOT_COST_MULTIPLIER,
  initializeServerAuraIndexes,
  getServerAura,
  addAura,
  calculateServerLevel,
  getServerLevelConfig,
  getNextLevelConfig,
  calculateSlotCost,
  purchaseSlot,
  getServerSlotLimits,
  setServerProfileImage,
  setServerBadge,
  grantBadgeToUser,
  revokeBadgeFromUser,
  resetWeeklyAura,
  getWeeklyAura,
  getAllServersWeeklyAura,
  formatServerAuraEmbed,
  getServerAuraLeaderboard
};
