const { EmbedBuilder } = require('discord.js');
const { saveData, saveDataImmediate } = require('./dataManager.js');
const characterManager = require('./characterManager.js');
const { isMainServer, getServerConfig, getDropInterval, isServerSetup, saveServerConfig, getServerSelectedCharacters, hasServerSelectedCharacters } = require('./serverConfigManager.js');
const { updateTaskProgress } = require('./seasonSystem.js');
const { isKeyRushActive, getKeyRushTimeRemaining } = require('./characterKeySystem.js');
const { awardCollectibleItem, awardServerCollectible, getRarityTier, getDroppableServerCollectibles } = require('./collectibleItemsSystem.js');
const { addAura } = require('./serverAuraSystem.js');
const { shouldDropChristmasGift, addChristmasGift, isEventActive, createCommunityMilestoneAnnouncement, distributeMilestoneRewards } = require('./christmasEventSystem.js');
const { BOT_CONFIG } = require('./config.js');

let dropIntervals = new Map();
let activeClient = null;
let activeData = null;
let serverInactivityStatus = new Map();

const MAIN_SERVER_ID = BOT_CONFIG.MAIN_SERVER_ID;
const MAIN_DROP_CHANNEL = BOT_CONFIG.MAIN_DROP_CHANNEL;

const DROP_CODES = BOT_CONFIG.DROPS.CODES;
const DROP_DURATION = BOT_CONFIG.DROPS.DURATION;
const DROP_COST = BOT_CONFIG.DROPS.COST;
const INACTIVITY_TIMEOUT = BOT_CONFIG.DROPS.INACTIVITY_TIMEOUT;

// ======================================================
//  DROP PAYMENT & STATUS FUNCTIONS
// ======================================================

function areDropsActive(serverId) {
  if (isMainServer(serverId)) return true; // Main server always has drops
  
  const config = getServerConfig(serverId);
  if (!config) return false;
  
  if (!config.dropsPaidUntil) return false;
  
  return Date.now() < config.dropsPaidUntil;
}

async function payForDrops(serverId, userId, data) {
  if (isMainServer(serverId)) {
    return { success: false, message: '❌ Main server has unlimited drops - no payment needed!' };
  }
  
  if (!isServerSetup(serverId)) {
    return { success: false, message: '❌ Server not set up yet! Complete setup with `!setup` before activating drops.' };
  }
  
  // No character requirement for drops as default characters are auto-loaded
  const characterCount = 5; // Simulating enough characters since defaults are always there
  if (false) { // Condition disabled
    return { success: false, message: `❌ Not enough characters! You need at least 5 characters to activate drops.\n\n📊 Current count: ${characterCount}/5\n\nAdd characters using:\n• \`!sc create\` - Create a custom character\n• \`!chars add <id>\` - Add a public character` };
  }
  
  const config = getServerConfig(serverId);
  if (!config || !config.dropChannelId) {
    return { success: false, message: '❌ No drop channel configured! Use `!setdropchannel #channel` first.' };
  }
  
  const userData = data.users[userId];
  if (!userData) {
    return { success: false, message: '❌ User data not found!' };
  }
  
  if ((userData.gems || 0) < DROP_COST) {
    return { success: false, message: `❌ You need ${DROP_COST} gems to activate drops for 3 hours!\n💎 You have: ${userData.gems || 0} gems` };
  }
  
  userData.gems -= DROP_COST;
  const expiryTime = Date.now() + DROP_DURATION;
  
  config.dropsPaidUntil = expiryTime;
  
  await saveServerConfig(serverId, config);
  await saveDataImmediate(data);
  
  // Restart drops for this server to begin immediately
  await startDropsForServer(serverId);
  
  // Force an immediate drop execution to confirm it works
  setTimeout(() => executeDrop(serverId), 5000);
  
  console.log(`✅ payForDrops: Drops started for server ${serverId}, expires at ${new Date(expiryTime).toISOString()}`);
  
  const expiryDate = new Date(expiryTime);
  return {
    success: true,
    message: `✅ Drops activated for 3 hours!\n💎 Gems spent: ${DROP_COST}\n⏰ Drops expire: ${expiryDate.toLocaleTimeString()}\n\n🎁 Drops will now spawn in <#${config.dropChannelId}>!`,
    expiryTime
  };
}

function getDropsTimeRemaining(serverId) {
  if (isMainServer(serverId)) return '∞'; // Infinite for main server
  
  const config = getServerConfig(serverId);
  if (!config || !config.dropsPaidUntil) return '0m';
  
  const remaining = config.dropsPaidUntil - Date.now();
  if (remaining <= 0) return '0m';
  
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ======================================================
//  START / STOP SYSTEM
// ======================================================

async function startDropSystem(client, data) {
  activeClient = client;
  activeData = data;

  for (const guild of client.guilds.cache.values()) {
    // Check if this server has active drops before sending notification
    const hasActiveDrops = !isMainServer(guild.id) && areDropsActive(guild.id);
    await startDropsForServer(guild.id, hasActiveDrops); // Only notify servers with active drops
  }

  console.log(`✅ Drop system initialized for ${dropIntervals.size} servers`);
}

async function startDropsForServer(serverId, sendResumeNotification = false) {
  if (dropIntervals.has(serverId)) {
    clearInterval(dropIntervals.get(serverId));
  }

  if (!isMainServer(serverId) && !isServerSetup(serverId)) {
    console.log(`⚠️ Server ${serverId} not set up yet, skipping drops`);
    return;
  }
  
  // Ensure we have active data and client
  if (!activeClient || !activeData) {
    console.log(`⚠️ Bot not fully ready, delaying drops for ${serverId}`);
    return;
  }

  if (false) { // Character requirement removed as defaults are auto-loaded
    const MINIMUM_CHARACTERS_REQUIRED = 5;
    const charCount = await characterManager.getServerCharacterCount(serverId);
    if (charCount < MINIMUM_CHARACTERS_REQUIRED) {
      console.log(`⚠️ Server ${serverId}: Not enough characters (${charCount}/${MINIMUM_CHARACTERS_REQUIRED}), skipping drops`);
      return;
    }
  }

  if (!isMainServer(serverId) && !areDropsActive(serverId)) {
    console.log(`⚠️ Server ${serverId}: Drops not active (not paid or expired)`);
    return;
  }

  const interval = getDropInterval(serverId);
  
  const intervalId = setInterval(() => {
    executeDrop(serverId);
  }, interval);

  dropIntervals.set(serverId, intervalId);
  console.log(`✅ Drops started for server ${serverId} (every ${interval/1000}s)`);
  
  // Send resume notification if this is an auto-resume after bot restart
  if (sendResumeNotification && activeClient && !isMainServer(serverId)) {
    try {
      const config = getServerConfig(serverId);
      const dropChannelId = config?.dropChannelId;
      
      if (dropChannelId) {
        const channel = await activeClient.channels.fetch(dropChannelId).catch(() => null);
        if (channel) {
          const timeRemaining = getDropsTimeRemaining(serverId);
          const resumeEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔄 Bot Restarted - Drops Resumed!')
            .setDescription(`✅ The bot has restarted and drops are back online!\n\n⏰ **Time Remaining:** ${timeRemaining}\n🎁 Drops will continue spawning every ${interval/1000} seconds\n\n💡 Drops will automatically stop when the timer expires.`)
            .setFooter({ text: 'Drops are now active!' })
            .setTimestamp();
          
          await channel.send({ embeds: [resumeEmbed] });
          console.log(`✅ Server ${serverId}: Resume notification sent successfully.`);
        }
      }
    } catch (error) {
      console.error(`❌ Error sending resume notification for server ${serverId}:`, error);
    }
  }
}

function stopDropSystem() {
  dropIntervals.forEach((intervalId, serverId) => {
    clearInterval(intervalId);
  });
  dropIntervals.clear();
  console.log('⏹️ Drop system stopped for all servers!');
}

async function stopDropsForServer(serverId, sendNotification = false) {
  if (dropIntervals.has(serverId)) {
    clearInterval(dropIntervals.get(serverId));
    dropIntervals.delete(serverId);
    console.log(`⏹️ Drops stopped for server ${serverId}`);
    
    // Send notification to channel if requested
    if (sendNotification && activeClient) {
      try {
        let dropChannelId;
        if (isMainServer(serverId)) {
          dropChannelId = MAIN_DROP_CHANNEL;
        } else {
          const config = getServerConfig(serverId);
          dropChannelId = config?.dropChannelId;
        }
        
        if (dropChannelId) {
          const channel = await activeClient.channels.fetch(dropChannelId).catch(() => null);
          if (channel) {
            const stopEmbed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('⏰ Drops Expired!')
              .setDescription(`❌ The drop system has stopped because your 3-hour drop period has expired.\n\n💎 Use \`!paydrops\` to activate drops again for 3 hours (costs 100 gems)\n\n**Only users with the ZooAdmin role can activate drops!**`)
              .setFooter({ text: 'Need help? Use !setup to see server configuration' });
            
            await channel.send({ embeds: [stopEmbed] });
            console.log(`✅ Server ${serverId}: Expiry notification sent successfully.`);
          }
        }
      } catch (error) {
        console.error(`❌ Error sending stop notification for server ${serverId}:`, error);
      }
    }
  }
}

// ======================================================
//  CORE DROP LOGIC
// ======================================================

async function executeDrop(serverId) {
  if (!activeClient || !activeData) return;

  try {
    // Check if drops are paused due to inactivity
    if (isDropsPaused(serverId)) {
      console.log(`⏸️ Server ${serverId}: Drops paused, skipping execution`);
      return;
    }
    
    // Check for inactivity and pause if needed
    if (checkInactivity(serverId)) {
      await pauseDropsForInactivity(serverId);
      return;
    }
    
    // Check if payment is still valid
    if (!areDropsActive(serverId)) {
      await stopDropsForServer(serverId, true); // Send expiry notification
      return;
    }
    
    let dropChannelId;
    
    if (isMainServer(serverId)) {
      dropChannelId = MAIN_DROP_CHANNEL;
    } else {
      const config = getServerConfig(serverId);
      if (!config || !config.dropChannelId) {
        console.error(`❌ No drop channel configured for server ${serverId}`);
        return;
      }
      dropChannelId = config.dropChannelId;
    }

    const channel = await activeClient.channels.fetch(dropChannelId).catch(() => null);
    if (!channel) {
      console.error(`❌ Drop channel ${dropChannelId} not found for server ${serverId}!`);
      return;
    }

    // Initialize server drops if needed
    if (!activeData.serverDrops) {
      activeData.serverDrops = {};
    }

    // ===== PHASE 1: Clear previous drop data (optimized - no message deletion) =====
    if (activeData.serverDrops[serverId]) {
      // Simply remove the old drop data without deleting messages to reduce API calls
      delete activeData.serverDrops[serverId];
    }

    // ===== PHASE 2: Create a new drop =====
    const dropTypeRoll = Math.random();
    let selectedDrop, characterName = '';
    
    const keyRushActive = isKeyRushActive(serverId);
    
    // ===== CHRISTMAS EVENT: 15% chance to drop Christmas gifts during event =====
    if (isEventActive() && !keyRushActive) {
      const christmasGiftChance = 0.15; // 15% chance for Christmas gift drop
      if (Math.random() < christmasGiftChance) {
        const giftAmount = Math.floor(Math.random() * 3) + 1; // 1-3 gifts
        selectedDrop = { 
          type: 'christmasGift', 
          min: giftAmount, 
          max: giftAmount, 
          emoji: '🎁',
          amount: giftAmount
        };
      }
    }
    
    // Get server-configured characters from !sc list (works for ALL servers including main)
    let availableChars = [];
    
    const serverDropChars = await characterManager.getDroppableServerCharacters(serverId);
    if (serverDropChars && serverDropChars.length > 0) {
      availableChars = serverDropChars.map(c => ({ 
        name: c.name, 
        emoji: c.emoji, 
        rarity: c.rarity,
        isServerSpecific: c.isServerSpecific !== false,
        source: c.source || 'server'
      }));
    }
    
    // If no characters, notify once and skip this drop (unless Christmas gift already selected)
    if (availableChars.length === 0 && !selectedDrop) {
      console.log(`⚠️ Server ${serverId} has no characters configured for drops. Use !sc create or !chars add to add characters.`);
      return;
    }
    
    // Skip regular drop selection if Christmas gift was already selected
    if (selectedDrop && selectedDrop.type === 'christmasGift') {
      // Christmas gift drop - skip to drop creation
    } else if (keyRushActive) {
      // During Key Rush, ONLY character keys drop
      if (availableChars.length > 0) {
        const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
        characterName = randomChar.name;
        selectedDrop = { type: 'characterKey', min: 1, max: 1, emoji: '🔑', characterName, characterEmoji: randomChar.emoji };
      } else {
        selectedDrop = { type: 'coins', min: 1, max: 10, emoji: '💰' };
      }
    } else if (dropTypeRoll < 0.02) {
      // 2% chance: Shards
      selectedDrop = { type: 'shards', min: 1, max: 2, emoji: '🔷' };
    } else if (dropTypeRoll < 0.07) {
      // 5% chance: Character Keys (1-2 keys) - bonus keys even outside Key Rush!
      if (availableChars.length > 0) {
        const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
        characterName = randomChar.name;
        selectedDrop = { type: 'characterKey', min: 1, max: 2, emoji: '🔑', characterName, characterEmoji: randomChar.emoji };
      } else {
        selectedDrop = { type: 'coins', min: 1, max: 10, emoji: '💰' };
      }
    } else if (dropTypeRoll < 0.62) {
      // 55% chance: Character Tokens
      const availableCharNames = new Set(availableChars.map(c => c.name));
      
      const allOwnedChars = new Set();
      Object.values(activeData.users).forEach(user => {
        user?.characters?.forEach(char => {
          if (availableCharNames.has(char.name)) {
            allOwnedChars.add(char.name);
          }
        });
      });

      const ownedCharArray = Array.from(allOwnedChars);
      if (ownedCharArray.length > 0) {
        characterName = ownedCharArray[Math.floor(Math.random() * ownedCharArray.length)];
        selectedDrop = { type: 'tokens', min: 1, max: 10, emoji: '🎫', characterName };
      } else {
        selectedDrop = { type: 'coins', min: 1, max: 10, emoji: '💰' };
      }
    } else if (dropTypeRoll < 0.92) {
      // 30% chance: Coins
      selectedDrop = { type: 'coins', min: 1, max: 10, emoji: '💰' };
    } else {
      // 8% chance: Gems
      selectedDrop = { type: 'gems', min: 1, max: 2, emoji: '💎' };
    }
    
    // Check for collectible item drop - TWO STAGE SYSTEM:
    // Stage 1: Roll to see if ANY collectible drops (small base chance)
    // Stage 2: If yes, weighted selection among all collectibles based on their rarity/probability
    try {
      const droppableItems = await getDroppableServerCollectibles(serverId);
      
      if (droppableItems.length > 0 && !keyRushActive) {
        // STAGE 1: Base chance for ANY collectible to drop (3% chance)
        const collectibleBaseChance = 0.03;
        const shouldDropCollectible = Math.random() < collectibleBaseChance;
        
        if (shouldDropCollectible) {
          // STAGE 2: Weighted selection - collectibles compete based on their probability/rarity
          // Higher probability = higher weight = more likely to be selected
          const itemsWithWeights = droppableItems.map(item => {
            const weight = item.dropSettings?.probability || item.droppable?.probability || 0.5;
            return { item, weight };
          });
          
          // Calculate total weight
          const totalWeight = itemsWithWeights.reduce((sum, iw) => sum + iw.weight, 0);
          
          // Pick a random value between 0 and totalWeight
          let randomValue = Math.random() * totalWeight;
          let selectedItem = null;
          
          // Find which item this random value falls into
          for (const { item, weight } of itemsWithWeights) {
            randomValue -= weight;
            if (randomValue <= 0) {
              selectedItem = item;
              break;
            }
          }
          
          // Fallback to first item if something went wrong
          if (!selectedItem && droppableItems.length > 0) {
            selectedItem = droppableItems[0];
          }
          
          if (selectedItem) {
            const rarity = getRarityTier(selectedItem.ownerCount || 0);
            const collectibleId = selectedItem.id || (selectedItem._id ? selectedItem._id.toString() : null);
            
            if (collectibleId) {
              selectedDrop = { 
                type: 'collectibleItem', 
                itemId: collectibleId,
                itemName: selectedItem.name,
                itemImage: selectedItem.imageUrl,
                itemValue: selectedItem.computedValue || selectedItem.baseValue || 100,
                rarity: rarity,
                emoji: rarity.emoji,
                min: 1, 
                max: 1,
                isServerSpecific: selectedItem.isServerSpecific === true
              };
            }
          }
        }
      }
    } catch (itemError) {
      console.error('Error checking collectible items:', itemError);
    }

    const amount = Math.floor(Math.random() * (selectedDrop.max - selectedDrop.min + 1)) + selectedDrop.min;
    const code = DROP_CODES[Math.floor(Math.random() * DROP_CODES.length)];

    let rewardText;
    if (selectedDrop.type === 'christmasGift') {
      const giftText = selectedDrop.amount === 1 ? '1 Christmas Gift' : `${selectedDrop.amount} Christmas Gifts`;
      rewardText = `**Reward:** 🎁🎄 **${giftText}** 🎄🎁\n✨ Festive holiday gifts!`;
    } else if (selectedDrop.type === 'collectibleItem') {
      rewardText = `**Reward:** ${selectedDrop.emoji} **${selectedDrop.itemName}** (${selectedDrop.rarity.name})\n💰 Value: ${selectedDrop.itemValue} coins`;
    } else if (selectedDrop.type === 'characterKey') {
      const charEmoji = selectedDrop.characterEmoji || '🔑';
      rewardText = `**Reward:** ${charEmoji} ${characterName} Key ${selectedDrop.emoji}`;
    } else if (selectedDrop.type === 'tokens') {
      rewardText = `**Reward:** ${amount} ${characterName} tokens ${selectedDrop.emoji}`;
    } else {
      rewardText = `**Reward:** ${amount} ${selectedDrop.type} ${selectedDrop.emoji}`;
    }

    const timeRemaining = getDropsTimeRemaining(serverId);
    const keyRushTimeRemaining = keyRushActive ? getKeyRushTimeRemaining(serverId) : '';
    
    let footerText;
    if (keyRushActive) {
      footerText = `🔑 KEY RUSH ACTIVE! ⏰ ${keyRushTimeRemaining} remaining | First to catch wins!`;
    } else if (isMainServer(serverId)) {
      footerText = 'First person to type the command gets it!';
    } else {
      footerText = `⏰ Drops expire in: ${timeRemaining} | First person to catch wins!`;
    }

    const dropEmbed = new EmbedBuilder()
      .setColor(keyRushActive ? '#FF6B00' : '#FFD700')
      .setTitle(keyRushActive ? '🔑 KEY DROP!' : '🎁 DROP APPEARED!')
      .setDescription(`A wild drop appeared!\n\n${rewardText}\n\nType \`!c ${code}\` to catch it!`)
      .setFooter({ text: footerText })
      .setTimestamp();

    const dropMessage = await channel.send({ embeds: [dropEmbed] });

    // Store new drop data per server
    activeData.serverDrops[serverId] = {
      type: selectedDrop.type,
      amount,
      code,
      characterName,
      characterEmoji: selectedDrop.characterEmoji || '',
      messageId: dropMessage.id,
      serverId,
      spawnedAt: Date.now(),
      // Collectible-specific fields
      itemId: selectedDrop.itemId || null,
      itemName: selectedDrop.itemName || null,
      itemImage: selectedDrop.itemImage || null,
      itemValue: selectedDrop.itemValue || null,
      rarity: selectedDrop.rarity || null,
      emoji: selectedDrop.emoji || null,
      isServerSpecific: selectedDrop.isServerSpecific || false
    };

    saveData(activeData);

  } catch (error) {
    console.error('❌ Drop execution error:', error);
  }
}

function getActiveData() {
  return activeData;
}

function getActiveClient() {
  return activeClient;
}

function recordCatchAttempt(serverId) {
  if (!serverInactivityStatus.has(serverId)) {
    serverInactivityStatus.set(serverId, {
      lastCatchAttempt: Date.now(),
      paused: false
    });
  } else {
    const status = serverInactivityStatus.get(serverId);
    status.lastCatchAttempt = Date.now();
    
    if (status.paused) {
      status.paused = false;
      console.log(`✅ Server ${serverId}: Inactivity pause cleared due to catch attempt`);
    }
  }
}

function getLastCatchAttempt(serverId) {
  if (!serverInactivityStatus.has(serverId)) {
    return null;
  }
  return serverInactivityStatus.get(serverId).lastCatchAttempt;
}

function ensureInactivityStatus(serverId) {
  if (!serverInactivityStatus.has(serverId)) {
    serverInactivityStatus.set(serverId, {
      lastCatchAttempt: Date.now(),
      paused: false
    });
  }
}

async function pauseDropsForInactivity(serverId) {
  if (!serverInactivityStatus.has(serverId)) {
    serverInactivityStatus.set(serverId, {
      lastCatchAttempt: Date.now(),
      paused: false
    });
  }
  
  const status = serverInactivityStatus.get(serverId);
  
  if (status.paused) return;
  
  status.paused = true;
  
  if (dropIntervals.has(serverId)) {
    clearInterval(dropIntervals.get(serverId));
    dropIntervals.delete(serverId);
    console.log(`⏸️ Drops paused for server ${serverId} due to inactivity`);
    
    if (activeClient) {
      try {
        let dropChannelId;
        if (isMainServer(serverId)) {
          dropChannelId = MAIN_DROP_CHANNEL;
        } else {
          const config = getServerConfig(serverId);
          dropChannelId = config?.dropChannelId;
        }
        
        if (dropChannelId) {
          const channel = await activeClient.channels.fetch(dropChannelId).catch(() => null);
          if (channel) {
            let pauseEmbed;

if (isMainServer(serverId)) {
  // Special message for MAIN SERVER
  pauseEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('⏸️ Main Server Drops Paused')
    .setDescription(
      `Drops have been paused due to 5 minutes of inactivity.\n\n` +
      `💡 Type \`!revive\` to instantly resume drops!\n\n` +
      `This server has unlimited drops — pausing only helps reduce spam when nobody is active.`
    )
    .setFooter({ text: 'Main Server · Type !revive to resume' });

} else {
  // Message for other servers
  pauseEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('⏸️ Drops Paused (Inactivity)')
    .setDescription(
      `Drops have been paused due to 5 minutes of inactivity.\n\n` +
      `💡 Use \`!revive\` to resume drops!\n\n` +
      `**Note:** Your paid drop time is still running. This pause only reduces spam when inactive.`
    )
    .setFooter({ text: 'Type !revive to resume drops' });
}
            
            await channel.send({ embeds: [pauseEmbed] });
          }
        }
      } catch (error) {
        console.error(`❌ Error sending pause notification for server ${serverId}:`, error);
      }
    }
  }
}

async function reviveDrops(serverId) {
  if (!serverInactivityStatus.has(serverId)) {
    return { success: false, message: '❌ Drops are not paused!' };
  }
  
  const status = serverInactivityStatus.get(serverId);
  
  if (!status.paused) {
    return { success: false, message: '❌ Drops are already active!' };
  }
  
  if (!areDropsActive(serverId)) {
    return { success: false, message: '❌ Drops have expired! Use `!paydrops` to activate them again.' };
  }
  
  status.paused = false;
  status.lastCatchAttempt = Date.now();
  
  startDropsForServer(serverId);
  
  return { success: true, message: '✅ Drops revived! They will start spawning again.' };
}

function isDropsPaused(serverId) {
  if (!serverInactivityStatus.has(serverId)) return false;
  return serverInactivityStatus.get(serverId).paused;
}

function checkInactivity(serverId) {
  
  
  if (!serverInactivityStatus.has(serverId)) {
    return false;
  }
  
  const status = serverInactivityStatus.get(serverId);
  
  if (status.paused) {
    return true;
  }
  
  const lastCatch = getLastCatchAttempt(serverId);
  
  if (lastCatch === null) {
    return false;
  }
  
  const timeSinceLastCatch = Date.now() - lastCatch;
  
  if (timeSinceLastCatch > INACTIVITY_TIMEOUT && !status.paused) {
    return true;
  }
  
  return false;
}

module.exports = { 
  startDropSystem, 
  stopDropSystem,
  stopDropsForServer,
  startDropsForServer,
  getActiveData,
  getActiveClient,
  payForDrops,
  areDropsActive,
  getDropsTimeRemaining,
  recordCatchAttempt,
  pauseDropsForInactivity,
  reviveDrops,
  isDropsPaused,
  checkInactivity
};
