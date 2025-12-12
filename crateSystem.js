const characterManager = require('./characterManager.js');
const { assignMovesToCharacter, calculateBaseHP } = require('./battleUtils.js');
const eventSystem = require('./eventSystem.js');
const { checkTaskProgress, completePersonalizedTask, initializePersonalizedTaskData } = require('./personalizedTaskSystem.js');
const { trackChallengeProgress } = require('./weeklyChallengeSystem.js');
const { checkAchievements } = require('./achievementSystem.js');
const { recordEvent } = require('./analyticsSystem.js');
const { getEmojiForCharacter } = require('./emojiAssetManager.js');
const { getServerGame, DEFAULT_GAME, getServerSelectedCharacters, isMainServer } = require('./serverConfigManager.js');
const { updateTaskProgress } = require('./seasonSystem.js');
const { generateST } = require('./utils/shared.js');
const { tryDropCollectibleFromCrate, getCrateServerCollectibles, awardCollectibleItem, awardServerCollectible } = require('./collectibleItemsSystem.js');
const { isMongoConnected } = require('./mongoManager.js');
const { addAura } = require('./serverAuraSystem.js');

async function safeDropCollectibleFromCrate(userId, serverGame, crateType, serverId) {
  if (!isMongoConnected()) {
    return null;
  }
  
  if (!userId || typeof userId !== 'string') {
    console.error('[CrateSystem] Invalid userId for collectible drop');
    return null;
  }
  
  if (!crateType || typeof crateType !== 'string') {
    console.error('[CrateSystem] Invalid crateType for collectible drop:', crateType);
    return null;
  }
  
  try {
    // For non-main servers, use server-specific collectibles from serverCollectibles collection
    if (serverId && !isMainServer(serverId)) {
      const serverCollectibles = await getCrateServerCollectibles(serverId, crateType);
      if (serverCollectibles && serverCollectibles.length > 0) {
        // Roll for each eligible collectible
        for (const item of serverCollectibles) {
          const roll = Math.random();
          const dropProbability = item.crateObtainable?.probability || 0.1;
          if (roll < dropProbability) {
            // Award the server-specific collectible
            const result = await awardServerCollectible(userId, serverId, item._id.toString());
            if (result && result.success) {
              return {
                item: {
                  name: item.name,
                  emoji: item.emoji || '📦',
                  rarity: item.rarity,
                  isServerSpecific: true
                },
                message: `🎁 **Bonus Collectible:** ${item.emoji || '📦'} ${item.name} (${item.rarity || 'common'})`
              };
            }
          }
        }
        return null;
      }
    }
    
    // Fallback to global collectibles for main server or if no server-specific items
    const collectibleDrop = await tryDropCollectibleFromCrate(userId, serverGame, crateType, serverId);
    if (collectibleDrop && collectibleDrop.item && collectibleDrop.message) {
      return collectibleDrop;
    }
    return null;
  } catch (error) {
    console.error('[CrateSystem] Error in safe collectible drop:', error.message);
    return null;
  }
}

const CRATE_TYPES = {
  bronze: {
    cost: 0,
    charChance: 0.02,
    tokens: 15,
    coins: 100,
    points: 1,
    emoji: '🟫'
  },
  silver: {
    cost: 0,
    charChance: 1,
    tokens: 30,
    coins: 250,
    points: 2,
    emoji: '⚪'
  },
  gold: {
    cost: 100,
    charChance: 1.5,
    tokens: 50,
    coins: 500,
    points: 3,
    emoji: '<:emoji_2:1439429824862093445>'
  },
  emerald: {
    cost: 250,
    charChance: 5,
    tokens: 130,
    coins: 1800,
    points: 5,
    emoji: '🟢'
  },
  legendary: {
    cost: 500,
    charChance: 10,
    tokens: 200,
    coins: 2500,
    points: 8,
    emoji: '🟣'
  },
  tyrant: {
    cost: 750,
    charChance: 15,
    tokens: 300,
    coins: 3500,
    points: 12,
    emoji: '🔴'
  }
};

module.exports.CRATE_TYPES = CRATE_TYPES;

async function buyCrate(data, userId, crateType) {
  const crate = CRATE_TYPES[crateType];
  const user = data.users[userId];
  
  if (!crate) {
    return {
      success: false,
      message: `Invalid crate type! Available: gold, emerald, legendary, tyrant`
    };
  }
  
  if (crate.cost === 0) {
    return {
      success: false,
      message: `You can't buy ${crateType} crates! They are earned through message rewards.`
    };
  }
  
  if (user.gems < crate.cost) {
    return {
      success: false,
      message: `Not enough gems! You need ${crate.cost} gems but have ${user.gems}.`
    };
  }
  
  user.gems -= crate.cost;
  
  const crateKey = `${crateType}Crates`;
  if (!user[crateKey]) {
    user[crateKey] = 0;
  }
  user[crateKey] += 1;
  
  return {
    success: true,
    message: `Successfully purchased 1 ${crate.emoji} ${crateType} crate for ${crate.cost} gems!\nUse \`!pickcrate ${crateType}\` to open it.`
  };
}

async function openCrate(data, userId, crateType, client = null, serverId = null) {
  const crate = CRATE_TYPES[crateType];
  const user = data.users[userId];
  
  if (!crate) {
    return {
      success: false,
      message: `Invalid crate type! Available: bronze, silver, gold, emerald, legendary, tyrant`
    };
  }
  
  const crateKey = `${crateType}Crates`;
  const userCrates = user[crateKey] || 0;
  
  if (userCrates < 1) {
    return {
      success: false,
      message: `You don't have any ${crateType} crates! ${crate.cost > 0 ? `Use \`!crate ${crateType}\` to buy one for ${crate.cost} gems.` : 'Earn them through message rewards!'}`
    };
  }
  
  user[crateKey] = userCrates - 1;
  
  user.coins += crate.coins;
  
  if (!user.questProgress) user.questProgress = {};
  user.questProgress.cratesOpened = (user.questProgress.cratesOpened || 0) + 1;
  user.lastActivity = Date.now();
  
  trackChallengeProgress(user, 'cratesOpened', 1);
  checkAchievements(user);
  updateTaskProgress(user, 'cratesOpened', 1);
  
  // Track coins earned for season daily tasks
  if (crate.coins > 0) {
    updateTaskProgress(user, 'coinsEarned', crate.coins);
  }
  
  // Track rare crate openings for daily tasks (gold, emerald, legendary, tyrant)
  if (['gold', 'emerald', 'legendary', 'tyrant'].includes(crateType)) {
    updateTaskProgress(user, 'raresCratesOpened', 1);
  }
  
  if (serverId) {
    recordEvent(data, serverId, 'cratesOpened', 1, userId);
    addAura(serverId, 4, 'crate_open').catch(e => console.error('Error adding crate aura:', e));
  }
  
  if (client) {
    const ptData = initializePersonalizedTaskData(user);
    if (ptData.taskProgress.cratesOpened !== undefined) {
      const completedTask = checkTaskProgress(user, 'cratesOpened', 1);
      if (completedTask) {
        await completePersonalizedTask(client, userId, data, completedTask);
      }
    }
  }
  
  if (crateType === 'tyrant') {
    user.questProgress.tyrantCratesOpened = (user.questProgress.tyrantCratesOpened || 0) + 1;
  }
  
  await eventSystem.recordProgress(userId, user.username, crate.points, 'crate_master');
  
  let rewards = `💰 ${crate.coins} coins`;
  
  if (!user.pendingTokens) {
    user.pendingTokens = 0;
  }
  
  if (user.characters.length > 0) {
    const randomOwnedChar = user.characters[Math.floor(Math.random() * user.characters.length)];
    randomOwnedChar.tokens += crate.tokens;
    
    if (user.pendingTokens > 0) {
      randomOwnedChar.tokens += user.pendingTokens;
      rewards += `\n🎫 ${crate.tokens + user.pendingTokens} ${randomOwnedChar.name} tokens (including ${user.pendingTokens} pending!)`;
      user.pendingTokens = 0;
    } else {
      rewards += `\n🎫 ${crate.tokens} ${randomOwnedChar.name} tokens`;
    }
  } else {
    user.pendingTokens += crate.tokens;
    rewards += `\n🎫 ${crate.tokens} tokens saved (Total pending: ${user.pendingTokens})`;
  }
  
  const roll = Math.random() * 100;
  
  if (roll < crate.charChance) {
    let crateChars = [];
    
    if (serverId && !isMainServer(serverId)) {
      // Non-main servers ONLY use their own server-specific characters
      const serverCrateChars = await characterManager.getCrateServerCharacters(serverId, crateType);
      if (serverCrateChars && serverCrateChars.length > 0) {
        crateChars = serverCrateChars.map(c => ({
          name: c.name,
          emoji: c.emoji,
          rarity: c.rarity,
          isServerSpecific: true,
          ability: c.ability,
          specialMove: c.specialMove
        }));
      }
    } else {
      // Main server uses game-based characters
      const serverGame = serverId ? (getServerGame(serverId) || DEFAULT_GAME) : DEFAULT_GAME;
      const crateEligibleChars = characterManager.getCharacters().filter(c => c.obtainable === 'crate' && c.game === serverGame);
      crateChars = crateEligibleChars;
    }
    
    const ownedCharNames = user.characters.map(c => c.name);
    const availableChars = crateChars.filter(c => !ownedCharNames.includes(c.name));
    
    if (availableChars.length > 0) {
      const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
      const newST = generateST();
      
      let startingTokens = 0;
      if (user.characters.length === 0 && user.pendingTokens > 0) {
        startingTokens = user.pendingTokens;
        user.pendingTokens = 0;
      }
      
      const newMoves = assignMovesToCharacter(randomChar.name, newST);
      const newHP = calculateBaseHP(newST);
      
      const newCharacter = {
        name: randomChar.name,
        emoji: getEmojiForCharacter(randomChar.name),
        level: 1,
        tokens: startingTokens,
        st: newST,
        moves: newMoves,
        baseHp: newHP,
        currentSkin: 'default',
        ownedSkins: ['default']
      };
      
      user.characters.push(newCharacter);
      
      user.questProgress.charsFromCrates = (user.questProgress.charsFromCrates || 0) + 1;
      
      rewards += `\n\n🎉 **NEW CHARACTER!** ${randomChar.emoji} ${randomChar.name}\n**ST:** ${newST}%`;
      if (startingTokens > 0) {
        rewards += `\n🎁 Received ${startingTokens} pending tokens!`;
      }
    } else {
      user.gems += 50;
      rewards += `\n\n✨ Bonus: 50 gems (all characters owned!)`;
    }
  }
  
  const serverGame = serverId ? (getServerGame(serverId) || DEFAULT_GAME) : DEFAULT_GAME;
  const collectibleDrop = await safeDropCollectibleFromCrate(userId, serverGame, crateType, serverId);
  if (collectibleDrop) {
    rewards += `\n\n${collectibleDrop.message}`;
  }
  
  return {
    success: true,
    message: rewards
  };
}

async function openCratesInBulk(data, userId, crateType, quantity, client = null, serverId = null) {
  const crate = CRATE_TYPES[crateType];
  const user = data.users[userId];
  
  if (!crate) {
    return {
      success: false,
      message: `Invalid crate type! Available: bronze, silver, gold, emerald, legendary, tyrant`
    };
  }
  
  if (quantity < 1 || quantity > 50) {
    return {
      success: false,
      message: 'Quantity must be between 1 and 50!'
    };
  }
  
  const crateKey = `${crateType}Crates`;
  const userCrates = user[crateKey] || 0;
  
  if (userCrates < quantity) {
    return {
      success: false,
      message: `You only have ${userCrates} ${crateType} crate${userCrates === 1 ? '' : 's'}! You need ${quantity}.`
    };
  }
  
  let totalCoins = 0;
  let totalTokens = 0;
  let charactersGained = [];
  let collectiblesGained = [];
  let totalGems = 0;
  
  const serverGame = serverId ? (getServerGame(serverId) || DEFAULT_GAME) : DEFAULT_GAME;
  
  let serverSelectedChars = null;
  if (serverId && !isMainServer(serverId)) {
    serverSelectedChars = await getServerSelectedCharacters(serverId);
  }
  
  user[crateKey] -= quantity;
  
  for (let i = 0; i < quantity; i++) {
    totalCoins += crate.coins;
    
    if (user.characters.length > 0) {
      const randomOwnedChar = user.characters[Math.floor(Math.random() * user.characters.length)];
      randomOwnedChar.tokens += crate.tokens;
      totalTokens += crate.tokens;
    } else {
      user.pendingTokens = (user.pendingTokens || 0) + crate.tokens;
      totalTokens += crate.tokens;
    }
    
    const roll = Math.random() * 100;
    
    if (roll < crate.charChance) {
      let crateChars = [];
      
      if (serverId && !isMainServer(serverId)) {
        // Non-main servers ONLY use their own server-specific characters
        const serverCrateChars = await characterManager.getCrateServerCharacters(serverId, crateType);
        if (serverCrateChars && serverCrateChars.length > 0) {
          crateChars = serverCrateChars.map(c => ({
            name: c.name,
            emoji: c.emoji,
            rarity: c.rarity,
            isServerSpecific: true,
            ability: c.ability,
            specialMove: c.specialMove
          }));
        }
      } else {
        // Main server uses game-based characters
        const crateEligibleChars = characterManager.getCharacters().filter(c => c.obtainable === 'crate' && c.game === serverGame);
        crateChars = crateEligibleChars;
      }
      
      const ownedCharNames = user.characters.map(c => c.name);
      const availableChars = crateChars.filter(c => !ownedCharNames.includes(c.name));
      
      if (availableChars.length > 0) {
        const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
        const newST = generateST();
        
        let startingTokens = 0;
        if (user.characters.length === 0 && user.pendingTokens > 0) {
          startingTokens = user.pendingTokens;
          user.pendingTokens = 0;
        }
        
        const newMoves = assignMovesToCharacter(randomChar.name, newST);
        const newHP = calculateBaseHP(newST);
        
        const newCharacter = {
          name: randomChar.name,
          emoji: getEmojiForCharacter(randomChar.name),
          level: 1,
          tokens: startingTokens,
          st: newST,
          moves: newMoves,
          baseHp: newHP,
          currentSkin: 'default',
          ownedSkins: ['default']
        };
        
        user.characters.push(newCharacter);
        charactersGained.push({ name: randomChar.name, emoji: randomChar.emoji, st: newST, startingTokens });
        
        if (!user.questProgress) user.questProgress = {};
        user.questProgress.charsFromCrates = (user.questProgress.charsFromCrates || 0) + 1;
      } else {
        totalGems += 50;
      }
    }
    
    const collectibleDrop = await safeDropCollectibleFromCrate(userId, serverGame, crateType, serverId);
    if (collectibleDrop && collectibleDrop.item) {
      collectiblesGained.push(collectibleDrop.item);
    }
  }
  
  user.coins += totalCoins;
  user.gems = (user.gems || 0) + totalGems;
  
  if (!user.questProgress) user.questProgress = {};
  user.questProgress.cratesOpened = (user.questProgress.cratesOpened || 0) + quantity;
  user.lastActivity = Date.now();
  
  trackChallengeProgress(user, 'cratesOpened', quantity);
  checkAchievements(user);
  
  // Track season daily tasks for bulk crate opening
  updateTaskProgress(user, 'cratesOpened', quantity);
  
  // Track coins earned for season daily tasks
  if (totalCoins > 0) {
    updateTaskProgress(user, 'coinsEarned', totalCoins);
  }
  
  // Track rare crate openings for daily tasks (gold, emerald, legendary, tyrant)
  if (['gold', 'emerald', 'legendary', 'tyrant'].includes(crateType)) {
    updateTaskProgress(user, 'raresCratesOpened', quantity);
  }
  
  if (serverId) {
    recordEvent(data, serverId, 'cratesOpened', quantity, userId);
  }
  
  if (crateType === 'tyrant') {
    user.questProgress.tyrantCratesOpened = (user.questProgress.tyrantCratesOpened || 0) + quantity;
  }
  
  if (client) {
    try {
      await eventSystem.recordProgress(userId, user.username, crate.points * quantity, 'crate_master');
    } catch (error) {
      console.error('Error recording event progress:', error);
    }
    
    try {
      const ptData = initializePersonalizedTaskData(user);
      if (ptData.taskProgress.cratesOpened !== undefined) {
        const completedTask = checkTaskProgress(user, 'cratesOpened', quantity);
        if (completedTask) {
          await completePersonalizedTask(client, userId, data, completedTask);
        }
      }
    } catch (error) {
      console.error('Error checking personalized tasks:', error);
    }
  }
  
  let summary = `Opened **${quantity}** ${crate.emoji} ${crateType} crate${quantity > 1 ? 's' : ''}!\n\n`;
  summary += `💰 Total Coins: ${totalCoins}\n`;
  summary += `🎫 Total Tokens: ${totalTokens}\n`;
  
  if (totalGems > 0) {
    summary += `💎 Bonus Gems: ${totalGems} (all characters owned!)\n`;
  }
  
  if (charactersGained.length > 0) {
    summary += `\n🎉 **New Characters Obtained:**\n`;
    charactersGained.forEach((char, i) => {
      summary += `${i + 1}. ${char.emoji} ${char.name} (ST: ${char.st}%)`;
      if (char.startingTokens > 0) {
        summary += ` +${char.startingTokens} pending tokens`;
      }
      summary += `\n`;
    });
  }
  
  if (collectiblesGained.length > 0) {
    summary += `\n🎁 **Collectible Items Obtained:**\n`;
    collectiblesGained.forEach((item, i) => {
      summary += `${i + 1}. ${item.emoji || '📦'} ${item.name}\n`;
    });
  }
  
  return {
    success: true,
    message: summary,
    charactersGained: charactersGained.length,
    collectiblesGained: collectiblesGained.length
  };
}

module.exports = { openCrate, buyCrate, openCratesInBulk, CRATE_TYPES };
