const CHARACTERS = require('./characters.js');
const { SPECIAL_MOVES, getMovesForST } = require('./moves.js');
const { 
  getCustomGame, 
  getCustomCharacters, 
  getCustomCharacter,
  getStarterCharacters
} = require('./customGameService.js');
const { 
  getServerGameMode, 
  isCustomGameServer,
  GAME_MODES 
} = require('./serverConfigManager.js');

const characterCache = new Map();
const CACHE_TTL = 60000;

function getCacheKey(serverId, options = {}) {
  return `${serverId}:${options.approvedOnly || true}:${options.obtainableType || 'all'}`;
}

function getCachedCharacters(serverId, options = {}) {
  const key = getCacheKey(serverId, options);
  const cached = characterCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  return null;
}

function setCachedCharacters(serverId, options, data) {
  const key = getCacheKey(serverId, options);
  characterCache.set(key, { data, timestamp: Date.now() });
}

function invalidateServerCache(serverId) {
  for (const key of characterCache.keys()) {
    if (key.startsWith(serverId + ':')) {
      characterCache.delete(key);
    }
  }
}

async function getCharactersForServer(serverId, options = {}) {
  const { approvedOnly = true, obtainableType = null } = options;
  
  const gameMode = getServerGameMode(serverId);
  
  if (gameMode === GAME_MODES.CUSTOM) {
    const game = await getCustomGame(serverId);
    if (!game) {
      return [];
    }
    
    let characters = await getCustomCharacters(game.gameId, approvedOnly);
    
    if (obtainableType) {
      characters = characters.filter(c => c.obtainable === obtainableType);
    }
    
    return characters.map(char => ({
      name: char.name,
      emoji: char.emoji,
      obtainable: char.obtainable,
      customEmojiId: char.customEmojiId || null,
      isCustom: true,
      gameId: char.gameId,
      characterId: char.characterId,
      description: char.description,
      imageUrl: char.imageUrl,
      uniqueMove: char.uniqueMove
    }));
  }
  
  let characters = [...CHARACTERS];
  
  if (obtainableType) {
    characters = characters.filter(c => c.obtainable === obtainableType);
  }
  
  return characters.map(char => ({
    name: char.name,
    emoji: char.emoji,
    obtainable: char.obtainable,
    customEmojiId: char.customEmojiId || null,
    isCustom: false,
    gameId: 'zoobot',
    characterId: null
  }));
}

async function getStartersForServer(serverId) {
  const gameMode = getServerGameMode(serverId);
  
  if (gameMode === GAME_MODES.CUSTOM) {
    const starters = await getStarterCharacters(serverId);
    return starters.map(char => ({
      name: char.name,
      emoji: char.emoji,
      obtainable: 'starter',
      isCustom: true,
      gameId: char.gameId,
      characterId: char.characterId,
      uniqueMove: char.uniqueMove
    }));
  }
  
  return CHARACTERS
    .filter(c => c.obtainable === 'starter')
    .map(char => ({
      name: char.name,
      emoji: char.emoji,
      obtainable: 'starter',
      isCustom: false,
      gameId: 'zoobot'
    }));
}

async function getCrateCharactersForServer(serverId) {
  return getCharactersForServer(serverId, { approvedOnly: true, obtainableType: 'crate' });
}

function getSpecialMoveForCharacter(characterName, gameId = 'zoobot', customCharacterData = null) {
  if (gameId !== 'zoobot' && customCharacterData && customCharacterData.uniqueMove) {
    return customCharacterData.uniqueMove;
  }
  
  return SPECIAL_MOVES[characterName] || { name: 'Unknown Attack', damage: 50 };
}

function getMovesPoolForST(st) {
  return getMovesForST(st);
}

function assignMovesToCharacterCatalog(characterName, st, gameId = 'zoobot', customCharacterData = null) {
  const specialMove = getSpecialMoveForCharacter(characterName, gameId, customCharacterData);
  
  const tierMoves = getMovesPoolForST(st);
  const shuffled = [...tierMoves].sort(() => Math.random() - 0.5);
  const selectedMoves = shuffled.slice(0, 2);
  
  return {
    special: specialMove,
    tierMoves: selectedMoves
  };
}

async function resolveCharacter(characterName, serverId = null) {
  if (serverId) {
    const gameMode = getServerGameMode(serverId);
    
    if (gameMode === GAME_MODES.CUSTOM) {
      const game = await getCustomGame(serverId);
      if (game) {
        const customChar = await getCustomCharacter(game.gameId, characterName);
        if (customChar && customChar.approvalStatus === 'approved') {
          return {
            name: customChar.name,
            emoji: customChar.emoji,
            obtainable: customChar.obtainable,
            isCustom: true,
            gameId: customChar.gameId,
            characterId: customChar.characterId,
            uniqueMove: customChar.uniqueMove,
            imageUrl: customChar.imageUrl,
            description: customChar.description
          };
        }
      }
    }
  }
  
  const zoobotChar = CHARACTERS.find(c => c.name.toLowerCase() === characterName.toLowerCase());
  if (zoobotChar) {
    return {
      name: zoobotChar.name,
      emoji: zoobotChar.emoji,
      obtainable: zoobotChar.obtainable,
      isCustom: false,
      gameId: 'zoobot',
      characterId: null
    };
  }
  
  return null;
}

async function characterExistsInServer(characterName, serverId) {
  const char = await resolveCharacter(characterName, serverId);
  return char !== null;
}

async function getCharacterCount(serverId) {
  const characters = await getCharactersForServer(serverId);
  return characters.length;
}

function formatCharacterForDisplay(character, st = null, level = null) {
  let display = `${character.emoji} **${character.name}**`;
  
  if (st !== null) {
    display += ` (ST: ${st})`;
  }
  
  if (level !== null) {
    display += ` [Lv. ${level}]`;
  }
  
  if (character.isCustom) {
    display += ' 🎮';
  }
  
  return display;
}

async function getCharacterSources(characterName) {
  const sources = [];
  
  const zoobotChar = CHARACTERS.find(c => c.name.toLowerCase() === characterName.toLowerCase());
  if (zoobotChar) {
    sources.push({
      gameId: 'zoobot',
      gameName: 'ZooBot',
      obtainable: zoobotChar.obtainable
    });
  }
  
  return sources;
}

module.exports = {
  getCharactersForServer,
  getStartersForServer,
  getCrateCharactersForServer,
  getSpecialMoveForCharacter,
  getMovesPoolForST,
  assignMovesToCharacterCatalog,
  resolveCharacter,
  characterExistsInServer,
  getCharacterCount,
  formatCharacterForDisplay,
  getCharacterSources,
  invalidateServerCache
};
