const { getCollection } = require('./mongoManager.js');
const { isSuperAdmin } = require('./serverConfigManager.js');

let CHARACTERS = [];
let CHARACTER_ABILITIES = {};
let SPECIAL_MOVES = {};

const DEFAULT_GAME = 'ZooBot';
const DEFAULT_CREATOR = 'ZooBot';

const VALID_EFFECT_TYPES = [
  'criticalDamageBonus', 'energyCostReduction', 'startingShield', 'firstAttackBonus',
  'healPerTurn', 'healingBonus', 'damageReduction', 'dodgeChance', 'startingEnergyBonus',
  'burnChance', 'opponentCritReduction', 'healToEnergy', 'criticalChanceBonus',
  'highHpDamageBonus', 'statusImmunity', 'energyRegenPerTurn', 'paralyzeChance',
  'healRestoresEnergy', 'lowHpDamageBonus', 'stackingDefense', 'specialEnergyRefund',
  'energySteal', 'defenseIgnore', 'specialDamageBonus', 'lowHpSelfDamageBonus',
  'hpRegenPerTurn', 'firstHitReduction', 'energyRegenBonus', 'allHealingBonus',
  'freezeChance', 'burnDamageChance', 'extraTurnChance', 'startWithMaxEnergy',
  'flatDamageBonus', 'debuffDurationReduction', 'lifesteal', 'normalMoveCostReduction',
  'criticalEnergyGain', 'immovable', 'defenseBonus', 'opponentMissChance',
  'damagePerBuff', 'damageBlock', 'emergencyHeal', 'stackingDamage', 'randomStartBuff',
  'doubleAttackChance', 'damageToEnergy', 'autoCleansePerTurn', 'opponentEndTurnDamage',
  'highHpDefenseBonus'
];

const OBTAINABLE_TYPES = ['crate', 'starter', 'drop', 'event', 'exclusive'];

async function loadCharactersFromDB() {
  try {
    const collection = await getCollection('characters');
    const charDoc = await collection.findOne({ _id: 'character_data' });
    
    if (charDoc && charDoc.characters && charDoc.characters.length > 0) {
      CHARACTERS = charDoc.characters;
      CHARACTER_ABILITIES = charDoc.abilities || {};
      SPECIAL_MOVES = charDoc.specialMoves || {};
      console.log(`✅ Loaded ${CHARACTERS.length} characters from MongoDB`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading characters from MongoDB:', error);
    return false;
  }
}

async function saveCharactersToDB() {
  try {
    const collection = await getCollection('characters');
    await collection.updateOne(
      { _id: 'character_data' },
      { 
        $set: { 
          characters: CHARACTERS,
          abilities: CHARACTER_ABILITIES,
          specialMoves: SPECIAL_MOVES,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    console.log(`✅ Saved ${CHARACTERS.length} characters to MongoDB`);
    return true;
  } catch (error) {
    console.error('Error saving characters to MongoDB:', error);
    return false;
  }
}

async function migrateHardcodedCharacters() {
  try {
    const hardcodedChars = require('./characters.js');
    const hardcodedAbilities = require('./characterAbilities.js').CHARACTER_ABILITIES;
    const hardcodedMoves = require('./moves.js').SPECIAL_MOVES;
    
    CHARACTERS = hardcodedChars.map(c => ({
      ...c,
      game: DEFAULT_GAME,
      createdBy: DEFAULT_CREATOR
    }));
    CHARACTER_ABILITIES = { ...hardcodedAbilities };
    SPECIAL_MOVES = { ...hardcodedMoves };
    
    await saveCharactersToDB();
    console.log(`✅ Migrated ${CHARACTERS.length} hardcoded characters to MongoDB with game/createdBy fields`);
    return true;
  } catch (error) {
    console.error('Error migrating hardcoded characters:', error);
    return false;
  }
}

async function backfillGameAndCreator() {
  let updated = 0;
  
  for (let i = 0; i < CHARACTERS.length; i++) {
    let changed = false;
    
    if (!CHARACTERS[i].game) {
      CHARACTERS[i].game = DEFAULT_GAME;
      changed = true;
    }
    
    if (!CHARACTERS[i].createdBy) {
      CHARACTERS[i].createdBy = DEFAULT_CREATOR;
      changed = true;
    }
    
    if (changed) {
      updated++;
    }
  }
  
  if (updated > 0) {
    await saveCharactersToDB();
    console.log(`✅ Backfilled ${updated} characters with game/createdBy fields`);
  }
  
  return { 
    success: true, 
    message: `✅ Backfilled ${updated} characters with game/createdBy fields`,
    updated 
  };
}

async function initializeCharacterSystem() {
  const loaded = await loadCharactersFromDB();
  
  if (!loaded) {
    console.log('📦 No characters in MongoDB, migrating from hardcoded files...');
    await migrateHardcodedCharacters();
  } else {
    await backfillGameAndCreator();
  }
  
  return {
    characters: CHARACTERS,
    abilities: CHARACTER_ABILITIES,
    moves: SPECIAL_MOVES
  };
}

function getCharacters() {
  return CHARACTERS;
}

function getCharactersByGame(gameName) {
  if (!gameName) return CHARACTERS;
  return CHARACTERS.filter(c => c.game === gameName);
}

function getCharactersForServer(serverId, serverConfigManager, gameSystem) {
  const serverGame = gameSystem.getServerGame(serverId);
  if (!serverGame) {
    return CHARACTERS.filter(c => c.game === DEFAULT_GAME);
  }
  return CHARACTERS.filter(c => c.game === serverGame);
}

function getObtainableCharactersByGame(gameName, obtainableType) {
  return CHARACTERS.filter(c => 
    c.game === gameName && 
    c.obtainable === obtainableType
  );
}

function getCharacterAbilities() {
  return CHARACTER_ABILITIES;
}

function getSpecialMoves() {
  return SPECIAL_MOVES;
}

function getCharacterByName(name) {
  return CHARACTERS.find(c => c.name.toLowerCase() === name.toLowerCase());
}

function getCharacterAbility(characterName) {
  return CHARACTER_ABILITIES[characterName] || null;
}

function getAbilityDescription(characterName) {
  const ability = getCharacterAbility(characterName);
  if (!ability) return 'No ability';
  return `${ability.emoji} **${ability.name}**: ${ability.description}`;
}

function getSpecialMove(characterName) {
  return SPECIAL_MOVES[characterName] || null;
}

async function createCharacter(userId, charData) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can create characters!' };
  }
  
  const { name, emoji, obtainable, ability, specialMove, game } = charData;
  
  if (!name || !emoji || !obtainable) {
    return { success: false, message: '❌ Missing required fields: name, emoji, obtainable' };
  }
  
  if (!OBTAINABLE_TYPES.includes(obtainable)) {
    return { success: false, message: `❌ Invalid obtainable type! Must be one of: ${OBTAINABLE_TYPES.join(', ')}` };
  }
  
  if (getCharacterByName(name)) {
    return { success: false, message: `❌ Character "${name}" already exists!` };
  }
  
  const newChar = {
    name: name,
    emoji: emoji,
    obtainable: obtainable,
    customEmojiId: charData.customEmojiId || null,
    game: game || DEFAULT_GAME,
    createdBy: charData.createdBy || userId,
    createdAt: new Date().toISOString()
  };
  
  CHARACTERS.push(newChar);
  
  if (ability) {
    if (!ability.name || !ability.emoji || !ability.description || !ability.effectType) {
      return { success: false, message: '❌ Ability requires: name, emoji, description, effectType, effectValue' };
    }
    
    if (!VALID_EFFECT_TYPES.includes(ability.effectType)) {
      return { success: false, message: `❌ Invalid effect type! Valid types:\n${VALID_EFFECT_TYPES.slice(0, 15).join(', ')}...` };
    }
    
    const effect = {};
    effect[ability.effectType] = ability.effectValue;
    
    if (ability.secondaryEffectType && ability.secondaryEffectValue !== undefined) {
      effect[ability.secondaryEffectType] = ability.secondaryEffectValue;
    }
    
    CHARACTER_ABILITIES[name] = {
      name: ability.name,
      emoji: ability.emoji,
      description: ability.description,
      type: 'passive',
      effect: effect
    };
  } else {
    CHARACTER_ABILITIES[name] = {
      name: `${name}'s Power`,
      emoji: '⭐',
      description: `${name} gains a small damage bonus on all attacks.`,
      type: 'passive',
      effect: { flatDamageBonus: 5 }
    };
  }
  
  if (specialMove) {
    if (!specialMove.name || specialMove.damage === undefined) {
      return { success: false, message: '❌ Special move requires: name, damage' };
    }
    
    SPECIAL_MOVES[name] = {
      name: specialMove.name,
      damage: parseInt(specialMove.damage)
    };
  } else {
    SPECIAL_MOVES[name] = {
      name: `${name}'s Strike`,
      damage: 90
    };
  }
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Character **${emoji} ${name}** created successfully!\n🎮 Game: **${newChar.game}**`,
    character: newChar
  };
}

async function createCharacterFromSubmission(charData) {
  const { name, emoji, obtainable, ability, specialMove, game, createdBy } = charData;
  
  if (!name || !emoji) {
    return { success: false, message: '❌ Missing required fields: name, emoji' };
  }
  
  if (getCharacterByName(name)) {
    return { success: false, message: `❌ Character "${name}" already exists!` };
  }
  
  const newChar = {
    name: name,
    emoji: emoji,
    obtainable: obtainable || 'crate',
    customEmojiId: charData.customEmojiId || null,
    game: game || DEFAULT_GAME,
    createdBy: createdBy || DEFAULT_CREATOR,
    createdAt: new Date().toISOString(),
    fromSubmission: true
  };
  
  CHARACTERS.push(newChar);
  
  if (ability && ability.name && ability.effectType) {
    const effect = {};
    effect[ability.effectType] = ability.effectValue || 0.1;
    
    CHARACTER_ABILITIES[name] = {
      name: ability.name,
      emoji: ability.emoji || '⭐',
      description: ability.description || `${name}'s special ability`,
      type: 'passive',
      effect: effect
    };
  } else {
    CHARACTER_ABILITIES[name] = {
      name: `${name}'s Power`,
      emoji: '⭐',
      description: `${name} gains a small damage bonus on all attacks.`,
      type: 'passive',
      effect: { flatDamageBonus: 5 }
    };
  }
  
  if (specialMove && specialMove.name) {
    SPECIAL_MOVES[name] = {
      name: specialMove.name,
      damage: parseInt(specialMove.damage) || 90
    };
  } else {
    SPECIAL_MOVES[name] = {
      name: `${name}'s Strike`,
      damage: 90
    };
  }
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Character **${emoji} ${name}** created from submission!`,
    character: newChar
  };
}

async function editCharacter(userId, charName, updates) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can edit characters!' };
  }
  
  const charIndex = CHARACTERS.findIndex(c => c.name.toLowerCase() === charName.toLowerCase());
  
  if (charIndex === -1) {
    return { success: false, message: `❌ Character "${charName}" not found!` };
  }
  
  const char = CHARACTERS[charIndex];
  const oldName = char.name;
  
  if (updates.name) char.name = updates.name;
  if (updates.emoji) char.emoji = updates.emoji;
  if (updates.obtainable) {
    if (!OBTAINABLE_TYPES.includes(updates.obtainable)) {
      return { success: false, message: `❌ Invalid obtainable type!` };
    }
    char.obtainable = updates.obtainable;
  }
  if (updates.customEmojiId !== undefined) char.customEmojiId = updates.customEmojiId;
  if (updates.game !== undefined) char.game = updates.game;
  if (updates.createdBy !== undefined) char.createdBy = updates.createdBy;
  
  char.updatedAt = new Date().toISOString();
  char.updatedBy = userId;
  
  CHARACTERS[charIndex] = char;
  
  if (updates.name && updates.name !== oldName) {
    if (CHARACTER_ABILITIES[oldName]) {
      CHARACTER_ABILITIES[updates.name] = CHARACTER_ABILITIES[oldName];
      delete CHARACTER_ABILITIES[oldName];
    }
    if (SPECIAL_MOVES[oldName]) {
      SPECIAL_MOVES[updates.name] = SPECIAL_MOVES[oldName];
      delete SPECIAL_MOVES[oldName];
    }
  }
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Character **${char.emoji} ${char.name}** updated!`,
    character: char
  };
}

async function setCharacterGame(userId, charName, gameName) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can change character games!' };
  }
  
  const charIndex = CHARACTERS.findIndex(c => c.name.toLowerCase() === charName.toLowerCase());
  
  if (charIndex === -1) {
    return { success: false, message: `❌ Character "${charName}" not found!` };
  }
  
  const oldGame = CHARACTERS[charIndex].game;
  CHARACTERS[charIndex].game = gameName;
  CHARACTERS[charIndex].updatedAt = new Date().toISOString();
  CHARACTERS[charIndex].updatedBy = userId;
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Character **${CHARACTERS[charIndex].emoji} ${CHARACTERS[charIndex].name}** moved from **${oldGame}** to **${gameName}**!`,
    character: CHARACTERS[charIndex]
  };
}

async function bulkSetCharacterGame(userId, charNames, gameName) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can change character games!' };
  }
  
  let updated = 0;
  const errors = [];
  
  for (const charName of charNames) {
    const charIndex = CHARACTERS.findIndex(c => c.name.toLowerCase() === charName.toLowerCase());
    
    if (charIndex === -1) {
      errors.push(`"${charName}" not found`);
      continue;
    }
    
    CHARACTERS[charIndex].game = gameName;
    CHARACTERS[charIndex].updatedAt = new Date().toISOString();
    CHARACTERS[charIndex].updatedBy = userId;
    updated++;
  }
  
  if (updated > 0) {
    await saveCharactersToDB();
  }
  
  let message = `✅ Moved ${updated} character(s) to **${gameName}**!`;
  if (errors.length > 0) {
    message += `\n⚠️ Errors: ${errors.join(', ')}`;
  }
  
  return { success: true, message, updated, errors };
}

async function importCharactersToGame(userId, sourceGame, targetGame, charNames = null) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can import characters!' };
  }
  
  const sourceChars = CHARACTERS.filter(c => c.game === sourceGame);
  
  if (sourceChars.length === 0) {
    return { success: false, message: `❌ No characters found in game "${sourceGame}"!` };
  }
  
  let charsToImport = sourceChars;
  if (charNames && charNames.length > 0) {
    const lowerNames = charNames.map(n => n.toLowerCase());
    charsToImport = sourceChars.filter(c => lowerNames.includes(c.name.toLowerCase()));
  }
  
  if (charsToImport.length === 0) {
    return { success: false, message: '❌ No matching characters to import!' };
  }
  
  let imported = 0;
  for (const char of charsToImport) {
    const existsInTarget = CHARACTERS.some(
      c => c.name.toLowerCase() === char.name.toLowerCase() && c.game === targetGame
    );
    
    if (!existsInTarget) {
      const newChar = {
        ...char,
        game: targetGame,
        importedFrom: sourceGame,
        importedAt: new Date().toISOString(),
        importedBy: userId
      };
      
      const newName = `${char.name}_${targetGame}`;
      if (getCharacterByName(char.name)) {
        newChar.name = newName;
        
        if (CHARACTER_ABILITIES[char.name]) {
          CHARACTER_ABILITIES[newName] = { ...CHARACTER_ABILITIES[char.name] };
        }
        if (SPECIAL_MOVES[char.name]) {
          SPECIAL_MOVES[newName] = { ...SPECIAL_MOVES[char.name] };
        }
      }
      
      CHARACTERS.push(newChar);
      imported++;
    }
  }
  
  if (imported > 0) {
    await saveCharactersToDB();
  }
  
  return { 
    success: true, 
    message: `✅ Imported ${imported} character(s) from **${sourceGame}** to **${targetGame}**!`,
    imported
  };
}

async function editCharacterAbility(userId, charName, abilityData) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can edit abilities!' };
  }
  
  const char = getCharacterByName(charName);
  if (!char) {
    return { success: false, message: `❌ Character "${charName}" not found!` };
  }
  
  if (!abilityData.name || !abilityData.emoji || !abilityData.description || !abilityData.effectType) {
    return { success: false, message: '❌ Ability requires: name, emoji, description, effectType, effectValue' };
  }
  
  if (!VALID_EFFECT_TYPES.includes(abilityData.effectType)) {
    return { success: false, message: `❌ Invalid effect type!` };
  }
  
  const effect = {};
  effect[abilityData.effectType] = abilityData.effectValue;
  
  if (abilityData.secondaryEffectType && abilityData.secondaryEffectValue !== undefined) {
    effect[abilityData.secondaryEffectType] = abilityData.secondaryEffectValue;
  }
  
  CHARACTER_ABILITIES[char.name] = {
    name: abilityData.name,
    emoji: abilityData.emoji,
    description: abilityData.description,
    type: 'passive',
    effect: effect
  };
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Ability for **${char.emoji} ${char.name}** updated!\n${abilityData.emoji} **${abilityData.name}**: ${abilityData.description}`
  };
}

async function editSpecialMove(userId, charName, moveData) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can edit special moves!' };
  }
  
  const char = getCharacterByName(charName);
  if (!char) {
    return { success: false, message: `❌ Character "${charName}" not found!` };
  }
  
  if (!moveData.name || moveData.damage === undefined) {
    return { success: false, message: '❌ Special move requires: name, damage' };
  }
  
  SPECIAL_MOVES[char.name] = {
    name: moveData.name,
    damage: parseInt(moveData.damage)
  };
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Special move for **${char.emoji} ${char.name}** updated!\n⚔️ **${moveData.name}** (${moveData.damage} DMG)`
  };
}

async function removeCharacter(userId, charName) {
  if (!isSuperAdmin(userId)) {
    return { success: false, message: '❌ Only Super Admins can remove characters!' };
  }
  
  const charIndex = CHARACTERS.findIndex(c => c.name.toLowerCase() === charName.toLowerCase());
  
  if (charIndex === -1) {
    return { success: false, message: `❌ Character "${charName}" not found!` };
  }
  
  const removedChar = CHARACTERS[charIndex];
  CHARACTERS.splice(charIndex, 1);
  
  delete CHARACTER_ABILITIES[removedChar.name];
  delete SPECIAL_MOVES[removedChar.name];
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Character **${removedChar.emoji} ${removedChar.name}** has been removed!`
  };
}

function listAllCharacters() {
  return CHARACTERS.map(c => {
    const ability = CHARACTER_ABILITIES[c.name];
    const move = SPECIAL_MOVES[c.name];
    return {
      ...c,
      ability: ability || null,
      specialMove: move || null
    };
  });
}

function listCharactersByGame(gameName) {
  return CHARACTERS
    .filter(c => c.game === gameName)
    .map(c => {
      const ability = CHARACTER_ABILITIES[c.name];
      const move = SPECIAL_MOVES[c.name];
      return {
        ...c,
        ability: ability || null,
        specialMove: move || null
      };
    });
}

function getCharacterCount() {
  return CHARACTERS.length;
}

function getCharacterCountByGame(gameName) {
  return CHARACTERS.filter(c => c.game === gameName).length;
}

function getGameStats() {
  const stats = {};
  
  for (const char of CHARACTERS) {
    const game = char.game || DEFAULT_GAME;
    if (!stats[game]) {
      stats[game] = { total: 0, byObtainable: {} };
    }
    stats[game].total++;
    
    const obt = char.obtainable || 'unknown';
    stats[game].byObtainable[obt] = (stats[game].byObtainable[obt] || 0) + 1;
  }
  
  return stats;
}

function getEffectTypes() {
  return VALID_EFFECT_TYPES;
}

function getObtainableTypes() {
  return OBTAINABLE_TYPES;
}

module.exports = {
  initializeCharacterSystem,
  getCharacters,
  getCharactersByGame,
  getCharactersForServer,
  getObtainableCharactersByGame,
  getCharacterAbilities,
  getSpecialMoves,
  getCharacterByName,
  getCharacterAbility,
  getAbilityDescription,
  getSpecialMove,
  createCharacter,
  createCharacterFromSubmission,
  editCharacter,
  setCharacterGame,
  bulkSetCharacterGame,
  importCharactersToGame,
  editCharacterAbility,
  editSpecialMove,
  removeCharacter,
  listAllCharacters,
  listCharactersByGame,
  getCharacterCount,
  getCharacterCountByGame,
  getGameStats,
  getEffectTypes,
  getObtainableTypes,
  saveCharactersToDB,
  loadCharactersFromDB,
  backfillGameAndCreator,
  VALID_EFFECT_TYPES,
  OBTAINABLE_TYPES,
  DEFAULT_GAME,
  DEFAULT_CREATOR
};
