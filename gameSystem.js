const { getCollection } = require('./mongoManager.js');
const { isSuperAdmin, isZooAdmin, getServerConfig, saveServerConfig } = require('./serverConfigManager.js');

let games = {};
const DEFAULT_GAME = 'ZooBot';

async function loadGames() {
  try {
    const collection = await getCollection('games');
    const gamesDoc = await collection.findOne({ _id: 'games_data' });
    
    if (gamesDoc && gamesDoc.games) {
      games = gamesDoc.games;
      console.log(`✅ Loaded ${Object.keys(games).length} games/bundles`);
    } else {
      games = {
        [DEFAULT_GAME]: {
          name: DEFAULT_GAME,
          description: 'The default ZooBot game with all original characters',
          createdBy: 'ZooBot',
          createdAt: new Date().toISOString(),
          isDefault: true,
          isActive: true,
          characterCount: 0
        }
      };
      await saveGames();
      console.log('✅ Created default ZooBot game');
    }
    
    return games;
  } catch (error) {
    console.error('Error loading games:', error);
    games = {};
    return games;
  }
}

async function saveGames() {
  try {
    const collection = await getCollection('games');
    await collection.updateOne(
      { _id: 'games_data' },
      { 
        $set: { 
          games: games,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error saving games:', error);
    return false;
  }
}

function getGames() {
  return games;
}

function getGame(gameName) {
  const normalizedName = gameName.toLowerCase();
  for (const [key, game] of Object.entries(games)) {
    if (key.toLowerCase() === normalizedName) {
      return game;
    }
  }
  return null;
}

function getGameNames() {
  return Object.keys(games);
}

function getActiveGames() {
  return Object.entries(games)
    .filter(([_, game]) => game.isActive)
    .map(([name, game]) => ({ name, ...game }));
}

function getUsableGames(characterManager) {
  const allChars = characterManager.getCharacters();
  
  return Object.entries(games)
    .filter(([gameName, game]) => {
      if (!game.isActive) return false;
      const gameChars = allChars.filter(c => c.game === gameName);
      return gameChars.length > 0;
    })
    .map(([name, game]) => {
      const gameChars = allChars.filter(c => c.game === name);
      return { 
        name, 
        ...game, 
        characterCount: gameChars.length 
      };
    });
}

async function createGame(userId, gameName, description, member = null) {
  if (!isSuperAdmin(userId) && !isZooAdmin(member)) {
    return { success: false, message: '❌ Only Super Admins or ZooAdmins can create games/bundles!' };
  }
  
  if (!gameName || gameName.trim().length < 2) {
    return { success: false, message: '❌ Game name must be at least 2 characters!' };
  }
  
  const normalizedName = gameName.trim();
  
  if (getGame(normalizedName)) {
    return { success: false, message: `❌ A game/bundle named "${normalizedName}" already exists!` };
  }
  
  games[normalizedName] = {
    name: normalizedName,
    description: description || `Custom game bundle: ${normalizedName}`,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    isDefault: false,
    isActive: true,
    characterCount: 0
  };
  
  await saveGames();
  
  return { 
    success: true, 
    message: `✅ Game/Bundle **${normalizedName}** created successfully!\n\n⚠️ Note: This bundle needs at least 1 character before it can be used by servers.`,
    game: games[normalizedName]
  };
}

async function editGame(userId, gameName, updates) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can edit games/bundles!' };
  }
  
  const game = getGame(gameName);
  if (!game) {
    return { success: false, message: `❌ Game/bundle "${gameName}" not found!` };
  }
  
  const actualKey = Object.keys(games).find(k => k.toLowerCase() === gameName.toLowerCase());
  
  if (updates.name && updates.name !== actualKey) {
    if (getGame(updates.name)) {
      return { success: false, message: `❌ A game named "${updates.name}" already exists!` };
    }
    
    games[updates.name] = { ...games[actualKey], name: updates.name };
    delete games[actualKey];
  }
  
  const targetKey = updates.name || actualKey;
  
  if (updates.description !== undefined) {
    games[targetKey].description = updates.description;
  }
  
  if (updates.isActive !== undefined) {
    games[targetKey].isActive = updates.isActive;
  }
  
  games[targetKey].updatedAt = new Date().toISOString();
  games[targetKey].updatedBy = userId;
  
  await saveGames();
  
  return { 
    success: true, 
    message: `✅ Game/Bundle **${targetKey}** updated!`,
    game: games[targetKey]
  };
}

async function deleteGame(userId, gameName) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can delete games/bundles!' };
  }
  
  const game = getGame(gameName);
  if (!game) {
    return { success: false, message: `❌ Game/bundle "${gameName}" not found!` };
  }
  
  if (game.isDefault) {
    return { success: false, message: '❌ Cannot delete the default ZooBot game!' };
  }
  
  const actualKey = Object.keys(games).find(k => k.toLowerCase() === gameName.toLowerCase());
  delete games[actualKey];
  
  await saveGames();
  
  return { 
    success: true, 
    message: `✅ Game/Bundle **${actualKey}** has been deleted!`
  };
}

async function toggleGameStatus(userId, gameName) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can toggle game status!' };
  }
  
  const game = getGame(gameName);
  if (!game) {
    return { success: false, message: `❌ Game/bundle "${gameName}" not found!` };
  }
  
  const actualKey = Object.keys(games).find(k => k.toLowerCase() === gameName.toLowerCase());
  games[actualKey].isActive = !games[actualKey].isActive;
  games[actualKey].updatedAt = new Date().toISOString();
  
  await saveGames();
  
  const status = games[actualKey].isActive ? '✅ Active' : '❌ Inactive';
  return { 
    success: true, 
    message: `✅ Game **${actualKey}** is now **${status}**!`,
    isActive: games[actualKey].isActive
  };
}

async function setServerGame(serverId, gameName, userId, member = null, characterManager = null) {
  if (!isSuperAdmin(userId) && !isZooAdmin(member)) {
    return { success: false, message: '❌ Only Super Admins or ZooAdmins can set the server game!' };
  }
  
  const game = getGame(gameName);
  if (!game) {
    return { success: false, message: `❌ Game/bundle "${gameName}" not found!\n\nUse \`!games\` to see available games or \`!creategame <name>\` to create one.` };
  }
  
  if (!game.isActive) {
    return { success: false, message: `❌ Game/bundle "${gameName}" is not active!` };
  }
  
  if (characterManager) {
    const allChars = characterManager.getCharacters();
    const gameChars = allChars.filter(c => c.game === game.name);
    if (gameChars.length === 0) {
      return { 
        success: false, 
        message: `❌ Game/bundle **${game.name}** has no characters yet!\n\nAdd characters to this bundle first, or choose a different game.`
      };
    }
  }
  
  const config = getServerConfig(serverId) || { serverId };
  config.selectedGame = game.name;
  config.gameSetAt = new Date().toISOString();
  config.gameSetBy = userId;
  
  await saveServerConfig(serverId, config);
  
  return { 
    success: true, 
    message: `✅ Server is now using game/bundle: **${game.name}**\n\n📝 ${game.description}\n\n🎮 Only characters from this game will appear in drops and crates!`
  };
}

function getServerGame(serverId) {
  const config = getServerConfig(serverId);
  if (!config || !config.selectedGame) {
    return null;
  }
  return config.selectedGame;
}

function hasServerSelectedGame(serverId) {
  const config = getServerConfig(serverId);
  return config && config.selectedGame && getGame(config.selectedGame);
}

function formatGameList(characterManager = null, detailed = false) {
  const gameList = [];
  
  for (const [name, game] of Object.entries(games)) {
    let charCount = game.characterCount || 0;
    
    if (characterManager) {
      const allChars = characterManager.getCharacters();
      charCount = allChars.filter(c => c.game === name).length;
    }
    
    const status = game.isActive ? '🟢' : '🔴';
    const usable = charCount > 0 ? '✅' : '⚠️';
    
    if (detailed) {
      gameList.push({
        name: name,
        description: game.description,
        status: status,
        usable: usable,
        characterCount: charCount,
        createdBy: game.createdBy,
        isDefault: game.isDefault
      });
    } else {
      gameList.push(`${status} **${name}** ${usable} (${charCount} chars)`);
    }
  }
  
  return gameList;
}

async function updateGameCharacterCount(gameName, characterManager) {
  const game = getGame(gameName);
  if (!game) return;
  
  const allChars = characterManager.getCharacters();
  const count = allChars.filter(c => c.game === gameName).length;
  
  const actualKey = Object.keys(games).find(k => k.toLowerCase() === gameName.toLowerCase());
  if (actualKey) {
    games[actualKey].characterCount = count;
    await saveGames();
  }
}

module.exports = {
  loadGames,
  saveGames,
  getGames,
  getGame,
  getGameNames,
  getActiveGames,
  getUsableGames,
  createGame,
  editGame,
  deleteGame,
  toggleGameStatus,
  setServerGame,
  getServerGame,
  hasServerSelectedGame,
  formatGameList,
  updateGameCharacterCount,
  DEFAULT_GAME
};
