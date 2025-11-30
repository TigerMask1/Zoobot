const { getCollection } = require('./mongoManager.js');

let customGames = {};
let customCharacters = {};

const GAME_MODES = {
  ZOOBOT: 'zoobot',
  CUSTOM: 'custom'
};

async function loadCustomGames() {
  try {
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
      description: characterData.description || '',
      imageUrl: characterData.imageUrl || null,
      obtainable: characterData.obtainable || 'crate',
      uniqueMove: {
        name: characterData.uniqueMoveName,
        damage: characterData.uniqueMoveDamage
      },
      createdBy: characterData.createdBy,
      createdAt: Date.now(),
      approvalStatus: 'pending',
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null
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
  getCachedCustomCharacters
};
