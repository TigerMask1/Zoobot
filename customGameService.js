const { getCollection } = require('./mongoManager.js');

let customGames = {};
let customCharacters = {};

const GAME_MODES = {
  ZOOBOT: 'zoobot',
  CUSTOM: 'custom'
};

async function loadCustomGames() {
  try {
    // Skip loading if not using MongoDB
    if (process.env.USE_MONGODB !== 'true') {
      console.log('✅ Custom games ready (MongoDB not enabled)');
      return;
    }

    const gamesCollection = await getCollection('customGames');
    const charsCollection = await getCollection('customCharacters');
    
    const games = await gamesCollection.find({}).toArray();
    const chars = await charsCollection.find({}).toArray();
    
    customGames = {};
    for (const game of games) {
      customGames[game.serverId] = game;
    }
    
    customCharacters = {};
    for (const char of chars) {
      if (!customCharacters[char.gameId]) {
        customCharacters[char.gameId] = [];
      }
      customCharacters[char.gameId].push(char);
    }
    
    console.log(`✅ Loaded ${games.length} custom games with ${chars.length} custom characters`);
  } catch (error) {
    console.error('Error loading custom games:', error);
    customGames = {};
    customCharacters = {};
  }
}

async function createCustomGame(serverId, gameName, createdBy) {
  try {
    const collection = await getCollection('customGames');
    
    const existingGame = await collection.findOne({ serverId });
    if (existingGame) {
      return { success: false, message: '❌ This server already has a custom game!' };
    }
    
    const gameId = `custom_${serverId}_${Date.now()}`;
    
    const newGame = {
      gameId,
      serverId,
      gameName,
      createdBy,
      createdAt: Date.now(),
      starterCharacterIds: [],
      status: 'setup',
      characterCount: 0,
      approvedCharacterCount: 0
    };
    
    await collection.insertOne(newGame);
    customGames[serverId] = newGame;
    
    return { 
      success: true, 
      message: `✅ Custom game "${gameName}" created! Game ID: \`${gameId}\`\n\nNext steps:\n1. Create characters with \`!createcharacter\`\n2. Set 3 starter characters with \`!setstarters\`\n3. Submit characters for approval`,
      game: newGame
    };
  } catch (error) {
    console.error('Error creating custom game:', error);
    return { success: false, message: '❌ Failed to create custom game!' };
  }
}

async function getCustomGame(serverId) {
  if (customGames[serverId]) {
    return customGames[serverId];
  }
  
  try {
    const collection = await getCollection('customGames');
    const game = await collection.findOne({ serverId });
    if (game) {
      customGames[serverId] = game;
    }
    return game;
  } catch (error) {
    console.error('Error getting custom game:', error);
    return null;
  }
}

async function getCustomGameByGameId(gameId) {
  for (const serverId in customGames) {
    if (customGames[serverId].gameId === gameId) {
      return customGames[serverId];
    }
  }
  
  try {
    const collection = await getCollection('customGames');
    const game = await collection.findOne({ gameId });
    return game;
  } catch (error) {
    console.error('Error getting custom game by gameId:', error);
    return null;
  }
}

async function updateCustomGame(serverId, updates) {
  try {
    const collection = await getCollection('customGames');
    await collection.updateOne(
      { serverId },
      { $set: updates }
    );
    
    if (customGames[serverId]) {
      customGames[serverId] = { ...customGames[serverId], ...updates };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating custom game:', error);
    return { success: false };
  }
}

function createDefaultCharacterStats() {
  return {
    baseHP: 300,
    baseAttack: 50,
    baseDefense: 30,
    baseSpeed: 40,
    growthRate: 1.0
  };
}

function createDefaultTraits() {
  return {
    primary: null,
    secondary: null,
    hidden: null
  };
}

function createDefaultTokenConfig() {
  return {
    enabled: true,
    tokenName: 'Token',
    tokenEmoji: '🪙',
    maxTokens: 100,
    tokenRewards: {
      battle: 5,
      daily: 10,
      quest: 15
    }
  };
}

function createDefaultSkinConfig() {
  return {
    available: [],
    unlockMethods: ['tokens', 'gems', 'special']
  };
}

async function createCustomCharacter(gameId, characterData) {
  try {
    const collection = await getCollection('customCharacters');
    
    const existingChar = await collection.findOne({ 
      gameId, 
      name: { $regex: new RegExp(`^${characterData.name}$`, 'i') }
    });
    
    if (existingChar) {
      return { success: false, message: `❌ A character named "${characterData.name}" already exists in this game!` };
    }
    
    const characterId = `char_${gameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newCharacter = {
      characterId,
      gameId,
      name: characterData.name,
      emoji: characterData.emoji || '🎮',
      customEmojiId: characterData.customEmojiId || null,
      description: characterData.description || '',
      imageUrl: characterData.imageUrl || null,
      obtainable: characterData.obtainable || 'crate',
      uniqueMove: {
        name: characterData.uniqueMoveName,
        damage: characterData.uniqueMoveDamage
      },
      stats: characterData.stats || createDefaultCharacterStats(),
      traits: characterData.traits || createDefaultTraits(),
      tokenConfig: characterData.tokenConfig || createDefaultTokenConfig(),
      skinConfig: characterData.skinConfig || createDefaultSkinConfig(),
      skins: characterData.skins || [],
      stBoostMultiplier: characterData.stBoostMultiplier || 1.0,
      levelCapConfig: {
        maxLevel: characterData.maxLevel || 100,
        xpCurve: characterData.xpCurve || 'standard'
      },
      battleCompatible: true,
      createdBy: characterData.createdBy,
      createdAt: Date.now(),
      approvalStatus: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      serverId: characterData.serverId || null
    };
    
    await collection.insertOne(newCharacter);
    
    if (!customCharacters[gameId]) {
      customCharacters[gameId] = [];
    }
    customCharacters[gameId].push(newCharacter);
    
    const gamesCollection = await getCollection('customGames');
    await gamesCollection.updateOne(
      { gameId },
      { $inc: { characterCount: 1 } }
    );
    
    return { 
      success: true, 
      message: `✅ Character "${characterData.name}" created!\nCharacter ID: \`${characterId}\`\n\n⏳ **Status:** Pending Approval\nBot admins will review this character. Use \`!viewcharacter ${characterData.name}\` to see details.`,
      character: newCharacter
    };
  } catch (error) {
    console.error('Error creating custom character:', error);
    return { success: false, message: '❌ Failed to create character!' };
  }
}

async function getCustomCharacters(gameId, approvedOnly = false) {
  try {
    const collection = await getCollection('customCharacters');
    const query = { gameId };
    
    if (approvedOnly) {
      query.approvalStatus = 'approved';
    }
    
    const characters = await collection.find(query).toArray();
    return characters;
  } catch (error) {
    console.error('Error getting custom characters:', error);
    return [];
  }
}

async function getCustomCharacter(gameId, characterName) {
  try {
    const collection = await getCollection('customCharacters');
    const character = await collection.findOne({ 
      gameId, 
      name: { $regex: new RegExp(`^${characterName}$`, 'i') }
    });
    return character;
  } catch (error) {
    console.error('Error getting custom character:', error);
    return null;
  }
}

async function getCustomCharacterById(characterId) {
  try {
    const collection = await getCollection('customCharacters');
    const character = await collection.findOne({ characterId });
    return character;
  } catch (error) {
    console.error('Error getting custom character by ID:', error);
    return null;
  }
}

async function setStarterCharacters(serverId, characterNames) {
  try {
    const game = await getCustomGame(serverId);
    if (!game) {
      return { success: false, message: '❌ No custom game found for this server!' };
    }
    
    if (characterNames.length !== 3) {
      return { success: false, message: '❌ You must set exactly 3 starter characters!' };
    }
    
    const characters = await getCustomCharacters(game.gameId, true);
    const characterMap = {};
    for (const char of characters) {
      characterMap[char.name.toLowerCase()] = char;
    }
    
    const starterIds = [];
    const notFound = [];
    const notApproved = [];
    
    for (const name of characterNames) {
      const char = characterMap[name.toLowerCase()];
      if (!char) {
        const pendingChar = await getCustomCharacter(game.gameId, name);
        if (pendingChar) {
          notApproved.push(name);
        } else {
          notFound.push(name);
        }
      } else {
        starterIds.push(char.characterId);
      }
    }
    
    if (notFound.length > 0) {
      return { success: false, message: `❌ Characters not found: ${notFound.join(', ')}` };
    }
    
    if (notApproved.length > 0) {
      return { success: false, message: `❌ Characters not approved yet: ${notApproved.join(', ')}\n\nOnly approved characters can be set as starters.` };
    }
    
    await updateCustomGame(serverId, { 
      starterCharacterIds: starterIds,
      status: 'active'
    });
    
    const collection = await getCollection('customCharacters');
    await collection.updateMany(
      { gameId: game.gameId },
      { $set: { obtainable: 'crate' } }
    );
    
    await collection.updateMany(
      { characterId: { $in: starterIds } },
      { $set: { obtainable: 'starter' } }
    );
    
    if (customCharacters[game.gameId]) {
      for (const char of customCharacters[game.gameId]) {
        char.obtainable = starterIds.includes(char.characterId) ? 'starter' : 'crate';
      }
    }
    
    return { 
      success: true, 
      message: `✅ Starter characters set!\n\n🌟 **Starters:** ${characterNames.join(', ')}\n\n🎮 Your custom game is now **active**! Players can use \`!start\` to begin.`
    };
  } catch (error) {
    console.error('Error setting starter characters:', error);
    return { success: false, message: '❌ Failed to set starter characters!' };
  }
}

async function getStarterCharacters(serverId) {
  try {
    const game = await getCustomGame(serverId);
    if (!game || !game.starterCharacterIds || game.starterCharacterIds.length === 0) {
      return [];
    }
    
    const collection = await getCollection('customCharacters');
    const starters = await collection.find({ 
      characterId: { $in: game.starterCharacterIds } 
    }).toArray();
    
    return starters;
  } catch (error) {
    console.error('Error getting starter characters:', error);
    return [];
  }
}

function isCustomGameServer(serverId) {
  return !!customGames[serverId];
}

function getGameMode(serverId) {
  if (customGames[serverId]) {
    return GAME_MODES.CUSTOM;
  }
  return GAME_MODES.ZOOBOT;
}

async function deleteCustomGame(serverId, deletedBy) {
  try {
    const game = await getCustomGame(serverId);
    if (!game) {
      return { success: false, message: '❌ No custom game found for this server!' };
    }
    
    const gamesCollection = await getCollection('customGames');
    const charsCollection = await getCollection('customCharacters');
    
    await charsCollection.deleteMany({ gameId: game.gameId });
    await gamesCollection.deleteOne({ serverId });
    
    delete customGames[serverId];
    delete customCharacters[game.gameId];
    
    return { 
      success: true, 
      message: `✅ Custom game "${game.gameName}" and all its characters have been deleted.`
    };
  } catch (error) {
    console.error('Error deleting custom game:', error);
    return { success: false, message: '❌ Failed to delete custom game!' };
  }
}

async function getAllCustomGames() {
  try {
    const collection = await getCollection('customGames');
    const games = await collection.find({}).toArray();
    return games;
  } catch (error) {
    console.error('Error getting all custom games:', error);
    return [];
  }
}

function getCachedCustomGames() {
  return customGames;
}

function getCachedCustomCharacters(gameId) {
  return customCharacters[gameId] || [];
}

async function exportCustomGame(gameId) {
  try {
    const gamesCollection = await getCollection('customGames');
    const charsCollection = await getCollection('customCharacters');
    
    const game = await gamesCollection.findOne({ gameId });
    if (!game) {
      return { success: false, message: '❌ Game not found!' };
    }
    
    const characters = await charsCollection.find({ 
      gameId, 
      approvalStatus: 'approved' 
    }).toArray();
    
    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      game: {
        gameName: game.gameName,
        originalGameId: game.gameId,
        createdBy: game.createdBy,
        starterCharacterNames: []
      },
      characters: characters.map(char => ({
        name: char.name,
        emoji: char.emoji,
        customEmojiId: char.customEmojiId,
        description: char.description,
        imageUrl: char.imageUrl,
        obtainable: char.obtainable,
        uniqueMove: char.uniqueMove,
        stats: char.stats,
        traits: char.traits,
        tokenConfig: char.tokenConfig,
        skinConfig: char.skinConfig,
        skins: char.skins || [],
        stBoostMultiplier: char.stBoostMultiplier || 1.0,
        levelCapConfig: char.levelCapConfig,
        battleCompatible: char.battleCompatible !== false
      })),
      metadata: {
        characterCount: characters.length,
        starterCount: game.starterCharacterIds?.length || 0
      }
    };
    
    if (game.starterCharacterIds && game.starterCharacterIds.length > 0) {
      const starters = characters.filter(c => game.starterCharacterIds.includes(c.characterId));
      exportData.game.starterCharacterNames = starters.map(s => s.name);
    }
    
    const exportCode = Buffer.from(JSON.stringify(exportData)).toString('base64');
    
    return { 
      success: true, 
      exportCode,
      exportData,
      message: `✅ Game "${game.gameName}" exported successfully!\n\n📦 **Export Code:** \`${exportCode.substring(0, 50)}...\`\n\n📋 **Contains:**\n• ${characters.length} approved characters\n• ${exportData.game.starterCharacterNames.length} starters`
    };
  } catch (error) {
    console.error('Error exporting custom game:', error);
    return { success: false, message: '❌ Failed to export game!' };
  }
}

async function importCustomGame(serverId, exportCode, importedBy) {
  try {
    let exportData;
    try {
      const decoded = Buffer.from(exportCode, 'base64').toString('utf8');
      exportData = JSON.parse(decoded);
    } catch (parseError) {
      return { success: false, message: '❌ Invalid export code! Please check and try again.' };
    }
    
    if (!exportData.version || !exportData.game || !exportData.characters) {
      return { success: false, message: '❌ Invalid game data format!' };
    }
    
    const gamesCollection = await getCollection('customGames');
    const existingGame = await gamesCollection.findOne({ serverId });
    if (existingGame) {
      return { success: false, message: '❌ This server already has a custom game! Delete it first with `!deletegame confirm`' };
    }
    
    const newGameId = `custom_${serverId}_${Date.now()}`;
    const newGame = {
      gameId: newGameId,
      serverId,
      gameName: exportData.game.gameName,
      createdBy: importedBy,
      importedFrom: exportData.game.originalGameId,
      createdAt: Date.now(),
      starterCharacterIds: [],
      status: 'setup',
      characterCount: exportData.characters.length,
      approvedCharacterCount: exportData.characters.length
    };
    
    await gamesCollection.insertOne(newGame);
    customGames[serverId] = newGame;
    
    const charsCollection = await getCollection('customCharacters');
    const characterIdMap = {};
    
    for (const charData of exportData.characters) {
      const newCharId = `char_${newGameId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      characterIdMap[charData.name.toLowerCase()] = newCharId;
      
      const newChar = {
        characterId: newCharId,
        gameId: newGameId,
        serverId,
        name: charData.name,
        emoji: charData.emoji,
        customEmojiId: charData.customEmojiId || null,
        description: charData.description || '',
        imageUrl: charData.imageUrl || null,
        obtainable: charData.obtainable || 'crate',
        uniqueMove: charData.uniqueMove,
        stats: charData.stats || createDefaultCharacterStats(),
        traits: charData.traits || createDefaultTraits(),
        tokenConfig: charData.tokenConfig || createDefaultTokenConfig(),
        skinConfig: charData.skinConfig || createDefaultSkinConfig(),
        skins: charData.skins || [],
        stBoostMultiplier: charData.stBoostMultiplier || 1.0,
        levelCapConfig: charData.levelCapConfig || { maxLevel: 100, xpCurve: 'standard' },
        battleCompatible: charData.battleCompatible !== false,
        createdBy: importedBy,
        createdAt: Date.now(),
        approvalStatus: 'approved',
        approvedBy: importedBy,
        approvedAt: Date.now(),
        importedFrom: exportData.game.originalGameId
      };
      
      await charsCollection.insertOne(newChar);
      
      if (!customCharacters[newGameId]) {
        customCharacters[newGameId] = [];
      }
      customCharacters[newGameId].push(newChar);
    }
    
    if (exportData.game.starterCharacterNames && exportData.game.starterCharacterNames.length > 0) {
      const starterIds = exportData.game.starterCharacterNames
        .map(name => characterIdMap[name.toLowerCase()])
        .filter(id => id);
      
      if (starterIds.length > 0) {
        await gamesCollection.updateOne(
          { gameId: newGameId },
          { $set: { starterCharacterIds: starterIds, status: 'active' } }
        );
        newGame.starterCharacterIds = starterIds;
        newGame.status = 'active';
        
        await charsCollection.updateMany(
          { characterId: { $in: starterIds } },
          { $set: { obtainable: 'starter' } }
        );
      }
    }
    
    return { 
      success: true, 
      game: newGame,
      message: `✅ Game "${exportData.game.gameName}" imported successfully!\n\n📦 **Imported:**\n• ${exportData.characters.length} characters\n• ${exportData.game.starterCharacterNames?.length || 0} starters\n\n${newGame.status === 'active' ? '🎮 Game is ready! Players can use `!start` to begin.' : '⚠️ Set starters with `!setstarters` to activate the game.'}`
    };
  } catch (error) {
    console.error('Error importing custom game:', error);
    return { success: false, message: '❌ Failed to import game!' };
  }
}

async function listAvailableGames() {
  try {
    const gamesCollection = await getCollection('customGames');
    const games = await gamesCollection.find({ status: 'active' }).toArray();
    
    return games.map(game => ({
      gameId: game.gameId,
      gameName: game.gameName,
      characterCount: game.approvedCharacterCount || 0,
      starterCount: game.starterCharacterIds?.length || 0,
      createdAt: game.createdAt
    }));
  } catch (error) {
    console.error('Error listing available games:', error);
    return [];
  }
}

async function cloneGameToServer(sourceGameId, targetServerId, clonedBy) {
  try {
    const exportResult = await exportCustomGame(sourceGameId);
    if (!exportResult.success) {
      return exportResult;
    }
    
    return await importCustomGame(targetServerId, exportResult.exportCode, clonedBy);
  } catch (error) {
    console.error('Error cloning game:', error);
    return { success: false, message: '❌ Failed to clone game!' };
  }
}

module.exports = {
  GAME_MODES,
  loadCustomGames,
  createCustomGame,
  getCustomGame,
  getCustomGameByGameId,
  updateCustomGame,
  createCustomCharacter,
  getCustomCharacters,
  getCustomCharacter,
  getCustomCharacterById,
  setStarterCharacters,
  getStarterCharacters,
  isCustomGameServer,
  getGameMode,
  deleteCustomGame,
  getAllCustomGames,
  getCachedCustomGames,
  getCachedCustomCharacters,
  exportCustomGame,
  importCustomGame,
  listAvailableGames,
  cloneGameToServer,
  createDefaultCharacterStats,
  createDefaultTraits,
  createDefaultTokenConfig,
  createDefaultSkinConfig
};
