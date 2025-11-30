const { getCollection } = require('./mongoManager.js');
const { isSuperAdmin } = require('./serverConfigManager.js');

let CHARACTERS = [];
let CHARACTER_ABILITIES = {};
let SPECIAL_MOVES = {};

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
    
    CHARACTERS = [...hardcodedChars];
    CHARACTER_ABILITIES = { ...hardcodedAbilities };
    SPECIAL_MOVES = { ...hardcodedMoves };
    
    await saveCharactersToDB();
    console.log(`✅ Migrated ${CHARACTERS.length} hardcoded characters to MongoDB`);
    return true;
  } catch (error) {
    console.error('Error migrating hardcoded characters:', error);
    return false;
  }
}

async function initializeCharacterSystem() {
  const loaded = await loadCharactersFromDB();
  
  if (!loaded) {
    console.log('📦 No characters in MongoDB, migrating from hardcoded files...');
    await migrateHardcodedCharacters();
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
  
  const { name, emoji, obtainable, ability, specialMove } = charData;
  
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
    createdAt: new Date().toISOString(),
    createdBy: userId
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
  }
  
  if (specialMove) {
    if (!specialMove.name || specialMove.damage === undefined) {
      return { success: false, message: '❌ Special move requires: name, damage' };
    }
    
    SPECIAL_MOVES[name] = {
      name: specialMove.name,
      damage: parseInt(specialMove.damage)
    };
  }
  
  await saveCharactersToDB();
  
  return { 
    success: true, 
    message: `✅ Character **${emoji} ${name}** created successfully!`,
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

function getCharacterCount() {
  return CHARACTERS.length;
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
  getCharacterAbilities,
  getSpecialMoves,
  getCharacterByName,
  getCharacterAbility,
  getAbilityDescription,
  getSpecialMove,
  createCharacter,
  editCharacter,
  editCharacterAbility,
  editSpecialMove,
  removeCharacter,
  listAllCharacters,
  getCharacterCount,
  getEffectTypes,
  getObtainableTypes,
  saveCharactersToDB,
  loadCharactersFromDB,
  VALID_EFFECT_TYPES,
  OBTAINABLE_TYPES
};
