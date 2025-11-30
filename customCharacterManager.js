const { 
  getAllApprovedCharacters, 
  getApprovedCharacter, 
  findApprovedCharacterByName,
  updateCustomCharacterStats 
} = require('./characterSubmissionSystem.js');

let customCharactersCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60 * 1000;

async function refreshCache() {
  try {
    customCharactersCache = await getAllApprovedCharacters();
    cacheTimestamp = Date.now();
    return customCharactersCache;
  } catch (error) {
    console.error('Error refreshing custom characters cache:', error);
    return [];
  }
}

async function getCustomCharacters() {
  if (customCharactersCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return customCharactersCache;
  }
  return await refreshCache();
}

function invalidateCache() {
  customCharactersCache = null;
  cacheTimestamp = null;
}

async function getAllCharactersWithCustom() {
  const CHARACTERS = require('./characters.js');
  const customCharacters = await getCustomCharacters();
  
  const formattedCustom = customCharacters.map(cc => ({
    name: cc.name,
    emoji: cc.emoji,
    customEmojiId: cc.customEmojiId,
    obtainable: cc.obtainable === 'both' ? 'crate' : cc.obtainable,
    isCustom: true,
    characterId: cc.characterId
  }));
  
  return [...CHARACTERS, ...formattedCustom];
}

async function getCrateEligibleCharacters() {
  const CHARACTERS = require('./characters.js');
  const customCharacters = await getCustomCharacters();
  
  const baseChars = CHARACTERS.filter(c => c.obtainable === 'crate');
  
  const customCrateChars = customCharacters
    .filter(cc => cc.obtainable === 'crate' || cc.obtainable === 'both')
    .map(cc => ({
      name: cc.name,
      emoji: cc.emoji,
      customEmojiId: cc.customEmojiId,
      obtainable: 'crate',
      isCustom: true,
      characterId: cc.characterId
    }));
  
  return [...baseChars, ...customCrateChars];
}

async function getDropEligibleCharacters() {
  const CHARACTERS = require('./characters.js');
  const customCharacters = await getCustomCharacters();
  
  const baseChars = CHARACTERS.filter(c => c.obtainable === 'crate' || c.obtainable === 'drop');
  
  const customDropChars = customCharacters
    .filter(cc => cc.obtainable === 'drop' || cc.obtainable === 'both' || cc.obtainable === 'crate')
    .map(cc => ({
      name: cc.name,
      emoji: cc.emoji,
      customEmojiId: cc.customEmojiId,
      obtainable: cc.obtainable,
      isCustom: true,
      characterId: cc.characterId
    }));
  
  return [...baseChars, ...customDropChars];
}

async function isCustomCharacter(characterName) {
  const customCharacters = await getCustomCharacters();
  return customCharacters.some(cc => cc.name.toLowerCase() === characterName.toLowerCase());
}

async function getCharacterByName(characterName) {
  const CHARACTERS = require('./characters.js');
  
  const baseChar = CHARACTERS.find(c => c.name.toLowerCase() === characterName.toLowerCase());
  if (baseChar) {
    return { ...baseChar, isCustom: false };
  }
  
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar && customChar.active) {
    return {
      name: customChar.name,
      emoji: customChar.emoji,
      customEmojiId: customChar.customEmojiId,
      obtainable: customChar.obtainable,
      isCustom: true,
      characterId: customChar.characterId,
      fullData: customChar
    };
  }
  
  return null;
}

async function getCustomCharacterSpecialMove(characterName) {
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar && customChar.active && customChar.specialMove) {
    return customChar.specialMove;
  }
  return null;
}

async function getCustomCharacterAbility(characterName) {
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar && customChar.active && customChar.ability) {
    return {
      name: customChar.ability.name,
      emoji: customChar.ability.emoji,
      description: customChar.ability.description,
      type: customChar.ability.type,
      effect: customChar.ability.effect
    };
  }
  return null;
}

async function recordCustomCharacterObtained(characterName) {
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar) {
    await updateCustomCharacterStats(customChar.characterId, { timesObtained: 1 });
  }
}

async function recordCustomCharacterBattleResult(characterName, won) {
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar) {
    if (won) {
      await updateCustomCharacterStats(customChar.characterId, { battleWins: 1 });
    } else {
      await updateCustomCharacterStats(customChar.characterId, { battleLosses: 1 });
    }
  }
}

async function getCustomCharacterSkin(characterName, skinName = 'default') {
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar && customChar.active) {
    if (customChar.skins && customChar.skins[skinName]) {
      return customChar.skins[skinName];
    }
    if (skinName === 'default' && customChar.defaultSkinUrl) {
      return customChar.defaultSkinUrl;
    }
  }
  return null;
}

async function getCustomCharacterAvailableSkins(characterName) {
  const customChar = await findApprovedCharacterByName(characterName);
  if (customChar && customChar.active && customChar.skins) {
    return Object.keys(customChar.skins);
  }
  return ['default'];
}

async function getCharacterEmoji(characterName, client = null) {
  const char = await getCharacterByName(characterName);
  if (!char) return '❓';
  
  if (char.customEmojiId && client) {
    const emoji = client.emojis.cache.get(char.customEmojiId);
    if (emoji) {
      return emoji.toString();
    }
  }
  
  return char.emoji || '❓';
}

async function getCharacterDisplayInfo(characterName) {
  const char = await getCharacterByName(characterName);
  if (!char) return null;
  
  const info = {
    name: char.name,
    emoji: char.emoji,
    isCustom: char.isCustom || false
  };
  
  if (char.isCustom && char.fullData) {
    info.createdBy = char.fullData.createdByName;
    info.specialMove = char.fullData.specialMove;
    info.ability = char.fullData.ability;
    info.stats = char.fullData.stats;
  }
  
  return info;
}

async function getAllCharacterNames() {
  const CHARACTERS = require('./characters.js');
  const customCharacters = await getCustomCharacters();
  
  const baseNames = CHARACTERS.map(c => c.name);
  const customNames = customCharacters.map(cc => cc.name);
  
  return [...baseNames, ...customNames];
}

async function getRandomCharacter(excludeNames = [], preferCrate = true) {
  let eligibleChars;
  
  if (preferCrate) {
    eligibleChars = await getCrateEligibleCharacters();
  } else {
    eligibleChars = await getAllCharactersWithCustom();
  }
  
  const available = eligibleChars.filter(c => !excludeNames.includes(c.name));
  
  if (available.length === 0) {
    return null;
  }
  
  return available[Math.floor(Math.random() * available.length)];
}

async function characterExists(characterName) {
  const char = await getCharacterByName(characterName);
  return char !== null;
}

async function getCustomCharactersList() {
  const customCharacters = await getCustomCharacters();
  return customCharacters.map(cc => ({
    name: cc.name,
    emoji: cc.emoji,
    characterId: cc.characterId,
    createdBy: cc.createdByName,
    obtainable: cc.obtainable,
    stats: cc.stats
  }));
}

module.exports = {
  getCustomCharacters,
  invalidateCache,
  refreshCache,
  
  getAllCharactersWithCustom,
  getCrateEligibleCharacters,
  getDropEligibleCharacters,
  
  isCustomCharacter,
  getCharacterByName,
  characterExists,
  getAllCharacterNames,
  getRandomCharacter,
  
  getCustomCharacterSpecialMove,
  getCustomCharacterAbility,
  
  recordCustomCharacterObtained,
  recordCustomCharacterBattleResult,
  
  getCustomCharacterSkin,
  getCustomCharacterAvailableSkins,
  
  getCharacterEmoji,
  getCharacterDisplayInfo,
  getCustomCharactersList
};
