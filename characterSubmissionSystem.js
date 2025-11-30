const mongoManager = require('./mongoManager.js');

const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const ABILITY_TEMPLATES = {
  'damage_boost': {
    id: 'damage_boost',
    name: 'Power Surge',
    emoji: '⚔️',
    description: 'Deal {value}% more damage with all attacks',
    type: 'passive',
    effectKey: 'damageBonus',
    minValue: 5,
    maxValue: 25,
    defaultValue: 15
  },
  'critical_boost': {
    id: 'critical_boost',
    name: 'Sharp Eye',
    emoji: '🎯',
    description: '+{value}% critical hit chance',
    type: 'passive',
    effectKey: 'criticalChanceBonus',
    minValue: 5,
    maxValue: 20,
    defaultValue: 10,
    valueMultiplier: 0.01
  },
  'critical_damage': {
    id: 'critical_damage',
    name: 'Brutal Force',
    emoji: '💥',
    description: 'Critical hits deal {value}% more damage',
    type: 'passive',
    effectKey: 'criticalDamageBonus',
    minValue: 20,
    maxValue: 60,
    defaultValue: 40,
    valueMultiplier: 0.01
  },
  'damage_reduction': {
    id: 'damage_reduction',
    name: 'Tough Skin',
    emoji: '🛡️',
    description: 'Take {value}% reduced damage from all attacks',
    type: 'passive',
    effectKey: 'damageReduction',
    minValue: 5,
    maxValue: 20,
    defaultValue: 12,
    valueMultiplier: 0.01
  },
  'starting_shield': {
    id: 'starting_shield',
    name: 'Guardian Aura',
    emoji: '✨',
    description: 'Gain {value}% max HP as a shield at battle start',
    type: 'passive',
    effectKey: 'startingShield',
    minValue: 5,
    maxValue: 15,
    defaultValue: 10,
    valueMultiplier: 0.01
  },
  'heal_per_turn': {
    id: 'heal_per_turn',
    name: 'Regeneration',
    emoji: '💚',
    description: 'Heal {value}% max HP every turn',
    type: 'passive',
    effectKey: 'healPerTurn',
    minValue: 2,
    maxValue: 8,
    defaultValue: 5,
    valueMultiplier: 0.01
  },
  'energy_regen': {
    id: 'energy_regen',
    name: 'Inner Focus',
    emoji: '⚡',
    description: 'Regenerate {value} extra energy per turn',
    type: 'passive',
    effectKey: 'energyRegenPerTurn',
    minValue: 2,
    maxValue: 6,
    defaultValue: 4
  },
  'starting_energy': {
    id: 'starting_energy',
    name: 'Quick Start',
    emoji: '🚀',
    description: 'Start battle with +{value} energy',
    type: 'passive',
    effectKey: 'startingEnergyBonus',
    minValue: 10,
    maxValue: 30,
    defaultValue: 20
  },
  'energy_cost_reduction': {
    id: 'energy_cost_reduction',
    name: 'Efficiency',
    emoji: '💨',
    description: 'All moves cost {value}% less energy',
    type: 'passive',
    effectKey: 'energyCostReduction',
    minValue: 10,
    maxValue: 25,
    defaultValue: 15,
    valueMultiplier: 0.01
  },
  'dodge_chance': {
    id: 'dodge_chance',
    name: 'Evasion',
    emoji: '🌀',
    description: '{value}% chance to dodge attacks completely',
    type: 'passive',
    effectKey: 'dodgeChance',
    minValue: 5,
    maxValue: 18,
    defaultValue: 12,
    valueMultiplier: 0.01
  },
  'first_attack_bonus': {
    id: 'first_attack_bonus',
    name: 'First Strike',
    emoji: '⚡',
    description: 'First attack each battle deals {value}% bonus damage',
    type: 'passive',
    effectKey: 'firstAttackBonus',
    minValue: 50,
    maxValue: 100,
    defaultValue: 75,
    valueMultiplier: 0.01
  },
  'healing_bonus': {
    id: 'healing_bonus',
    name: 'Nature\'s Touch',
    emoji: '🌿',
    description: 'Healing moves restore {value}% more HP',
    type: 'passive',
    effectKey: 'healingBonus',
    minValue: 15,
    maxValue: 40,
    defaultValue: 25,
    valueMultiplier: 0.01
  },
  'burn_chance': {
    id: 'burn_chance',
    name: 'Scorching Touch',
    emoji: '🔥',
    description: '{value}% chance to burn opponent (5 damage/turn for 3 turns)',
    type: 'passive',
    effectKey: 'burnChance',
    minValue: 10,
    maxValue: 30,
    defaultValue: 20,
    valueMultiplier: 0.01
  },
  'freeze_chance': {
    id: 'freeze_chance',
    name: 'Frost Touch',
    emoji: '❄️',
    description: '{value}% chance to freeze opponent (lose next turn)',
    type: 'passive',
    effectKey: 'freezeChance',
    minValue: 10,
    maxValue: 25,
    defaultValue: 15,
    valueMultiplier: 0.01
  },
  'paralyze_chance': {
    id: 'paralyze_chance',
    name: 'Static Shock',
    emoji: '⚡',
    description: '{value}% chance to paralyze opponent (skip turn)',
    type: 'passive',
    effectKey: 'paralyzeChance',
    minValue: 10,
    maxValue: 25,
    defaultValue: 15,
    valueMultiplier: 0.01
  },
  'energy_steal': {
    id: 'energy_steal',
    name: 'Energy Drain',
    emoji: '🌑',
    description: 'Steal {value} energy from opponent on hit',
    type: 'passive',
    effectKey: 'energySteal',
    minValue: 2,
    maxValue: 8,
    defaultValue: 5
  },
  'special_damage_bonus': {
    id: 'special_damage_bonus',
    name: 'Signature Style',
    emoji: '⭐',
    description: 'Deal {value}% more damage with special move',
    type: 'passive',
    effectKey: 'specialDamageBonus',
    minValue: 10,
    maxValue: 25,
    defaultValue: 15,
    valueMultiplier: 0.01
  },
  'low_hp_damage_bonus': {
    id: 'low_hp_damage_bonus',
    name: 'Desperation',
    emoji: '💢',
    description: 'Deal {value}% more damage when HP is below 30%',
    type: 'passive',
    effectKey: 'lowHpSelfDamageBonus',
    additionalEffect: { selfHpThreshold: 0.3 },
    minValue: 15,
    maxValue: 35,
    defaultValue: 25,
    valueMultiplier: 0.01
  },
  'high_hp_damage_bonus': {
    id: 'high_hp_damage_bonus',
    name: 'Peak Performance',
    emoji: '💪',
    description: 'Deal {value}% more damage when HP is above 70%',
    type: 'passive',
    effectKey: 'highHpDamageBonus',
    additionalEffect: { hpThreshold: 0.7 },
    minValue: 8,
    maxValue: 18,
    defaultValue: 12,
    valueMultiplier: 0.01
  },
  'first_hit_reduction': {
    id: 'first_hit_reduction',
    name: 'Brace Impact',
    emoji: '🛡️',
    description: 'First hit taken each battle deals {value}% less damage',
    type: 'passive',
    effectKey: 'firstHitReduction',
    minValue: 30,
    maxValue: 60,
    defaultValue: 50,
    valueMultiplier: 0.01
  },
  'hp_regen_per_turn': {
    id: 'hp_regen_per_turn',
    name: 'Vital Force',
    emoji: '❤️',
    description: 'Restore {value} HP every turn',
    type: 'passive',
    effectKey: 'hpRegenPerTurn',
    minValue: 2,
    maxValue: 8,
    defaultValue: 5
  },
  'special_energy_refund': {
    id: 'special_energy_refund',
    name: 'Energy Echo',
    emoji: '🔄',
    description: 'Special moves refund {value}% energy on use',
    type: 'passive',
    effectKey: 'specialEnergyRefund',
    minValue: 10,
    maxValue: 30,
    defaultValue: 20,
    valueMultiplier: 0.01
  }
};

const OBTAINABLE_TYPES = ['crate', 'drop', 'both'];

async function getSubmissionsCollection() {
  return await mongoManager.getCollection('character_submissions');
}

async function getApprovedCharactersCollection() {
  return await mongoManager.getCollection('custom_characters');
}

async function generateSubmissionId() {
  const collection = await mongoManager.getCollection('counters');
  const result = await collection.findOneAndUpdate(
    { _id: 'character_submission' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return `CS${String(result.seq).padStart(5, '0')}`;
}

function validateCharacterName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Character name is required' };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2 || trimmedName.length > 15) {
    return { valid: false, error: 'Character name must be 2-15 characters long' };
  }
  
  if (!/^[A-Za-z][A-Za-z0-9\s-]*$/.test(trimmedName)) {
    return { valid: false, error: 'Character name must start with a letter and contain only letters, numbers, spaces, or hyphens' };
  }
  
  return { valid: true, name: trimmedName.charAt(0).toUpperCase() + trimmedName.slice(1) };
}

function validateEmoji(emoji) {
  if (!emoji || typeof emoji !== 'string') {
    return { valid: false, error: 'Emoji is required' };
  }
  
  const customEmojiMatch = emoji.match(/^<(?:a)?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (customEmojiMatch) {
    return { 
      valid: true, 
      emoji: emoji,
      customEmojiId: customEmojiMatch[2],
      emojiName: customEmojiMatch[1]
    };
  }
  
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
  if (emojiRegex.test(emoji) || emoji.length <= 4) {
    return { valid: true, emoji: emoji };
  }
  
  return { valid: false, error: 'Invalid emoji format. Use a standard emoji or custom Discord emoji' };
}

function validateSpecialMove(moveName, damage) {
  if (!moveName || typeof moveName !== 'string') {
    return { valid: false, error: 'Special move name is required' };
  }
  
  const trimmedName = moveName.trim();
  if (trimmedName.length < 3 || trimmedName.length > 25) {
    return { valid: false, error: 'Special move name must be 3-25 characters long' };
  }
  
  const parsedDamage = parseInt(damage);
  if (isNaN(parsedDamage) || parsedDamage < 60 || parsedDamage > 120) {
    return { valid: false, error: 'Special move damage must be between 60 and 120' };
  }
  
  return { 
    valid: true, 
    move: {
      name: trimmedName,
      damage: parsedDamage
    }
  };
}

function validateAbility(templateId, customName, customDescription, value) {
  const template = ABILITY_TEMPLATES[templateId];
  if (!template) {
    return { valid: false, error: `Invalid ability template. Available: ${Object.keys(ABILITY_TEMPLATES).join(', ')}` };
  }
  
  const parsedValue = parseInt(value);
  if (isNaN(parsedValue) || parsedValue < template.minValue || parsedValue > template.maxValue) {
    return { 
      valid: false, 
      error: `Ability value must be between ${template.minValue} and ${template.maxValue}` 
    };
  }
  
  const abilityName = customName && customName.trim().length >= 3 
    ? customName.trim().substring(0, 25) 
    : template.name;
    
  const abilityDescription = template.description.replace('{value}', parsedValue);
  
  const effectValue = template.valueMultiplier ? parsedValue * template.valueMultiplier : parsedValue;
  
  const effect = { [template.effectKey]: effectValue };
  if (template.additionalEffect) {
    Object.assign(effect, template.additionalEffect);
  }
  
  return {
    valid: true,
    ability: {
      templateId: templateId,
      name: abilityName,
      emoji: template.emoji,
      description: customDescription && customDescription.trim().length >= 10 
        ? customDescription.trim().substring(0, 100)
        : abilityDescription,
      type: template.type,
      effect: effect,
      rawValue: parsedValue
    }
  };
}

async function submitCharacter(submitterId, submitterName, characterData) {
  const CHARACTERS = require('./characters.js');
  
  const nameValidation = validateCharacterName(characterData.name);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }
  
  const existingChar = CHARACTERS.find(c => c.name.toLowerCase() === nameValidation.name.toLowerCase());
  if (existingChar) {
    return { success: false, error: 'A character with this name already exists!' };
  }
  
  const existingCustom = await findApprovedCharacterByName(nameValidation.name);
  if (existingCustom) {
    return { success: false, error: 'A custom character with this name already exists!' };
  }
  
  const pendingSubmission = await findPendingSubmissionByName(nameValidation.name);
  if (pendingSubmission) {
    return { success: false, error: 'A submission with this character name is already pending!' };
  }
  
  const emojiValidation = validateEmoji(characterData.emoji);
  if (!emojiValidation.valid) {
    return { success: false, error: emojiValidation.error };
  }
  
  const moveValidation = validateSpecialMove(characterData.specialMoveName, characterData.specialMoveDamage);
  if (!moveValidation.valid) {
    return { success: false, error: moveValidation.error };
  }
  
  const abilityValidation = validateAbility(
    characterData.abilityTemplate,
    characterData.abilityName,
    characterData.abilityDescription,
    characterData.abilityValue
  );
  if (!abilityValidation.valid) {
    return { success: false, error: abilityValidation.error };
  }
  
  const obtainableType = OBTAINABLE_TYPES.includes(characterData.obtainableType) 
    ? characterData.obtainableType 
    : 'crate';
  
  const submissionId = await generateSubmissionId();
  
  const submission = {
    submissionId: submissionId,
    status: SUBMISSION_STATUS.PENDING,
    submitterId: submitterId,
    submitterName: submitterName,
    submittedAt: new Date(),
    
    character: {
      name: nameValidation.name,
      emoji: emojiValidation.emoji,
      customEmojiId: emojiValidation.customEmojiId || null,
      obtainable: obtainableType,
      isCustom: true
    },
    
    specialMove: moveValidation.move,
    
    ability: abilityValidation.ability,
    
    defaultSkinUrl: characterData.defaultSkinUrl || null,
    
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null
  };
  
  const collection = await getSubmissionsCollection();
  await collection.insertOne(submission);
  
  return { 
    success: true, 
    submissionId: submissionId,
    character: submission.character,
    message: `Character "${nameValidation.name}" submitted successfully! Submission ID: ${submissionId}`
  };
}

async function getSubmission(submissionId) {
  const collection = await getSubmissionsCollection();
  return await collection.findOne({ submissionId: submissionId });
}

async function getPendingSubmissions(limit = 20, skip = 0) {
  const collection = await getSubmissionsCollection();
  return await collection.find({ status: SUBMISSION_STATUS.PENDING })
    .sort({ submittedAt: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();
}

async function getUserSubmissions(userId) {
  const collection = await getSubmissionsCollection();
  return await collection.find({ submitterId: userId })
    .sort({ submittedAt: -1 })
    .toArray();
}

async function findPendingSubmissionByName(name) {
  const collection = await getSubmissionsCollection();
  return await collection.findOne({ 
    'character.name': { $regex: new RegExp(`^${name}$`, 'i') },
    status: SUBMISSION_STATUS.PENDING
  });
}

async function approveSubmission(submissionId, reviewerId, reviewerName, reviewNote = null) {
  const submission = await getSubmission(submissionId);
  
  if (!submission) {
    return { success: false, error: 'Submission not found' };
  }
  
  if (submission.status !== SUBMISSION_STATUS.PENDING) {
    return { success: false, error: `Submission already ${submission.status}` };
  }
  
  const submissionsCollection = await getSubmissionsCollection();
  await submissionsCollection.updateOne(
    { submissionId: submissionId },
    { 
      $set: { 
        status: SUBMISSION_STATUS.APPROVED,
        reviewedBy: reviewerId,
        reviewerName: reviewerName,
        reviewedAt: new Date(),
        reviewNote: reviewNote
      }
    }
  );
  
  const customCharacter = {
    characterId: submissionId,
    name: submission.character.name,
    emoji: submission.character.emoji,
    customEmojiId: submission.character.customEmojiId,
    obtainable: submission.character.obtainable,
    isCustom: true,
    
    specialMove: submission.specialMove,
    ability: submission.ability,
    
    defaultSkinUrl: submission.defaultSkinUrl,
    skins: submission.defaultSkinUrl ? { default: submission.defaultSkinUrl } : {},
    
    createdBy: submission.submitterId,
    createdByName: submission.submitterName,
    approvedBy: reviewerId,
    approvedByName: reviewerName,
    approvedAt: new Date(),
    
    stats: {
      timesObtained: 0,
      battleWins: 0,
      battleLosses: 0
    },
    
    active: true
  };
  
  const customCollection = await getApprovedCharactersCollection();
  await customCollection.insertOne(customCharacter);
  
  return { 
    success: true, 
    character: customCharacter,
    message: `Character "${submission.character.name}" has been approved and is now available in the game!`
  };
}

async function rejectSubmission(submissionId, reviewerId, reviewerName, reviewNote) {
  const submission = await getSubmission(submissionId);
  
  if (!submission) {
    return { success: false, error: 'Submission not found' };
  }
  
  if (submission.status !== SUBMISSION_STATUS.PENDING) {
    return { success: false, error: `Submission already ${submission.status}` };
  }
  
  const collection = await getSubmissionsCollection();
  await collection.updateOne(
    { submissionId: submissionId },
    { 
      $set: { 
        status: SUBMISSION_STATUS.REJECTED,
        reviewedBy: reviewerId,
        reviewerName: reviewerName,
        reviewedAt: new Date(),
        reviewNote: reviewNote || 'No reason provided'
      }
    }
  );
  
  return { 
    success: true, 
    message: `Submission ${submissionId} has been rejected.`
  };
}

async function getAllApprovedCharacters() {
  const collection = await getApprovedCharactersCollection();
  return await collection.find({ active: true }).toArray();
}

async function getApprovedCharacter(characterId) {
  const collection = await getApprovedCharactersCollection();
  return await collection.findOne({ characterId: characterId, active: true });
}

async function findApprovedCharacterByName(name) {
  const collection = await getApprovedCharactersCollection();
  return await collection.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    active: true
  });
}

async function deleteCustomCharacter(characterIdOrName, deletedById, deletedByName) {
  const collection = await getApprovedCharactersCollection();
  
  // Try to find by characterId first, then by name
  let character = await collection.findOne({ characterId: characterIdOrName.toUpperCase() });
  
  if (!character) {
    character = await collection.findOne({ 
      name: { $regex: new RegExp(`^${characterIdOrName}$`, 'i') }
    });
  }
  
  if (!character) {
    return { success: false, error: `Custom character **${characterIdOrName}** not found. Use character ID (e.g., CS00001) or character name (e.g., Shadow)` };
  }
  
  await collection.updateOne(
    { characterId: character.characterId },
    { 
      $set: { 
        active: false,
        deletedBy: deletedById,
        deletedByName: deletedByName,
        deletedAt: new Date()
      }
    }
  );
  
  return { 
    success: true, 
    characterName: character.name,
    message: `Custom character "${character.name}" has been deleted and removed from the game.`
  };
}

async function updateCustomCharacterStats(characterId, statsUpdate) {
  const collection = await getApprovedCharactersCollection();
  const updateFields = {};
  
  if (statsUpdate.timesObtained) {
    updateFields['stats.timesObtained'] = statsUpdate.timesObtained;
  }
  if (statsUpdate.battleWins) {
    updateFields['stats.battleWins'] = statsUpdate.battleWins;
  }
  if (statsUpdate.battleLosses) {
    updateFields['stats.battleLosses'] = statsUpdate.battleLosses;
  }
  
  if (Object.keys(updateFields).length > 0) {
    await collection.updateOne(
      { characterId: characterId },
      { $inc: updateFields }
    );
  }
}

async function addSkinToCustomCharacter(characterId, skinName, skinUrl) {
  const collection = await getApprovedCharactersCollection();
  await collection.updateOne(
    { characterId: characterId },
    { $set: { [`skins.${skinName}`]: skinUrl } }
  );
  return { success: true };
}

async function removeSkinFromCustomCharacter(characterId, skinName) {
  if (skinName === 'default') {
    return { success: false, error: 'Cannot remove default skin' };
  }
  
  const collection = await getApprovedCharactersCollection();
  await collection.updateOne(
    { characterId: characterId },
    { $unset: { [`skins.${skinName}`]: '' } }
  );
  return { success: true };
}

async function getCustomCharacterSkins(characterId) {
  const character = await getApprovedCharacter(characterId);
  return character ? character.skins : {};
}

async function editCustomCharacter(characterId, updates) {
  const collection = await getApprovedCharactersCollection();
  const character = await collection.findOne({ characterId: characterId });
  
  if (!character) {
    return { success: false, error: 'Custom character not found' };
  }
  
  const allowedUpdates = {};
  
  if (updates.specialMoveName !== undefined || updates.specialMoveDamage !== undefined) {
    const moveName = updates.specialMoveName || character.specialMove.name;
    const moveDamage = updates.specialMoveDamage !== undefined ? updates.specialMoveDamage : character.specialMove.damage;
    const moveValidation = validateSpecialMove(moveName, moveDamage);
    if (moveValidation.valid) {
      allowedUpdates.specialMove = moveValidation.move;
    }
  }
  
  if (updates.emoji !== undefined) {
    const emojiValidation = validateEmoji(updates.emoji);
    if (emojiValidation.valid) {
      allowedUpdates.emoji = emojiValidation.emoji;
      allowedUpdates.customEmojiId = emojiValidation.customEmojiId || null;
    }
  }
  
  if (updates.obtainable !== undefined && OBTAINABLE_TYPES.includes(updates.obtainable)) {
    allowedUpdates.obtainable = updates.obtainable;
  }
  
  if (updates.defaultSkinUrl !== undefined) {
    allowedUpdates.defaultSkinUrl = updates.defaultSkinUrl;
    allowedUpdates['skins.default'] = updates.defaultSkinUrl;
  }
  
  if (Object.keys(allowedUpdates).length > 0) {
    await collection.updateOne(
      { characterId: characterId },
      { $set: allowedUpdates }
    );
    return { success: true, updated: Object.keys(allowedUpdates) };
  }
  
  return { success: false, error: 'No valid updates provided' };
}

function getAbilityTemplates() {
  return ABILITY_TEMPLATES;
}

function getAbilityTemplateById(templateId) {
  return ABILITY_TEMPLATES[templateId] || null;
}

function formatAbilityTemplatesList() {
  let output = '**Available Ability Templates:**\n\n';
  
  for (const [id, template] of Object.entries(ABILITY_TEMPLATES)) {
    output += `${template.emoji} **${template.name}** (\`${id}\`)\n`;
    output += `   ${template.description.replace('{value}', `${template.minValue}-${template.maxValue}`)}\n`;
    output += `   Value range: ${template.minValue} - ${template.maxValue}\n\n`;
  }
  
  return output;
}

async function getSubmissionStats() {
  const submissionsCollection = await getSubmissionsCollection();
  const customCollection = await getApprovedCharactersCollection();
  
  const pending = await submissionsCollection.countDocuments({ status: SUBMISSION_STATUS.PENDING });
  const approved = await submissionsCollection.countDocuments({ status: SUBMISSION_STATUS.APPROVED });
  const rejected = await submissionsCollection.countDocuments({ status: SUBMISSION_STATUS.REJECTED });
  const activeCustomChars = await customCollection.countDocuments({ active: true });
  
  return {
    pending,
    approved,
    rejected,
    totalSubmissions: pending + approved + rejected,
    activeCustomCharacters: activeCustomChars
  };
}

module.exports = {
  SUBMISSION_STATUS,
  ABILITY_TEMPLATES,
  OBTAINABLE_TYPES,
  
  submitCharacter,
  getSubmission,
  getPendingSubmissions,
  getUserSubmissions,
  approveSubmission,
  rejectSubmission,
  
  getAllApprovedCharacters,
  getApprovedCharacter,
  findApprovedCharacterByName,
  deleteCustomCharacter,
  editCustomCharacter,
  updateCustomCharacterStats,
  
  addSkinToCustomCharacter,
  removeSkinFromCustomCharacter,
  getCustomCharacterSkins,
  
  getAbilityTemplates,
  getAbilityTemplateById,
  formatAbilityTemplatesList,
  
  getSubmissionStats,
  
  validateCharacterName,
  validateEmoji,
  validateSpecialMove,
  validateAbility
};
