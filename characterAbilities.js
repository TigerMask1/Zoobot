// Character Abilities System
// Each character has a unique ability that provides strategic advantages in battle

let characterManager = null;

function getCharacterManager() {
  if (!characterManager) {
    characterManager = require('./characterManager.js');
  }
  return characterManager;
}

const CHARACTER_ABILITIES = {
  'Bali': {
    name: 'Fierce Claws',
    emoji: '🐯',
    description: 'Critical hits deal 50% more damage',
    type: 'passive',
    effect: { criticalDamageBonus: 0.5 }
  },
  'Betsy': {
    name: 'Swift Strike',
    emoji: '🐦',
    description: 'All moves cost 20% less energy',
    type: 'passive',
    effect: { energyCostReduction: 0.2 }
  },
  'Bruce': {
    name: 'Fortitude',
    emoji: '🦘',
    description: 'Gain 10% max HP as a shield at battle start',
    type: 'passive',
    effect: { startingShield: 0.1 }
  },
  'Buck': {
    name: 'Charging Bull',
    emoji: '🦌',
    description: 'First attack each battle deals double damage',
    type: 'passive',
    effect: { firstAttackBonus: 1.0 }
  },
  'Buddy': {
    name: 'Pack Leader',
    emoji: '🐕',
    description: 'Heal 5% max HP every turn',
    type: 'passive',
    effect: { healPerTurn: 0.05 }
  },
  'Caly': {
    name: 'Nature\'s Blessing',
    emoji: '🐱',
    description: 'Healing moves restore 30% more HP',
    type: 'passive',
    effect: { healingBonus: 0.3 }
  },
  'Dillo': {
    name: 'Armored Shell',
    emoji: '🦔',
    description: 'Take 15% reduced damage from all attacks',
    type: 'passive',
    effect: { damageReduction: 0.15 }
  },
  'Donna': {
    name: 'Graceful Dance',
    emoji: '🦌',
    description: '15% chance to dodge attacks completely',
    type: 'passive',
    effect: { dodgeChance: 0.15 }
  },
  'Duke': {
    name: 'Royal Authority',
    emoji: '🦁',
    description: 'Start battle with +20 energy',
    type: 'passive',
    effect: { startingEnergyBonus: 20 }
  },
  'Earl': {
    name: 'Burning Rage',
    emoji: '🦊',
    description: '25% chance to burn opponent (5 damage/turn for 3 turns)',
    type: 'passive',
    effect: { burnChance: 0.25 }
  },
  'Edna': {
    name: 'Web Trap',
    emoji: '🕷️',
    description: 'Opponents have -10% critical hit chance',
    type: 'passive',
    effect: { opponentCritReduction: 0.1 }
  },
  'Elaine': {
    name: 'Petal Power',
    emoji: '🌸',
    description: 'Gain +5 energy each time you heal',
    type: 'passive',
    effect: { healToEnergy: 5 }
  },
  'Faye': {
    name: 'Fairy Luck',
    emoji: '🧚',
    description: '+15% critical hit chance',
    type: 'passive',
    effect: { criticalChanceBonus: 0.15 }
  },
  'Finn': {
    name: 'Tidal Force',
    emoji: '🐟',
    description: 'Deal 10% more damage when HP is above 70%',
    type: 'passive',
    effect: { highHpDamageBonus: 0.1, hpThreshold: 0.7 }
  },
  'Frank': {
    name: 'Hard Head',
    emoji: '🦏',
    description: 'Cannot be stunned or frozen',
    type: 'passive',
    effect: { statusImmunity: ['stun', 'freeze'] }
  },
  'Fuzzy': {
    name: 'Wild Spirit',
    emoji: '🐰',
    description: 'Regenerate 3 energy per turn',
    type: 'passive',
    effect: { energyRegenPerTurn: 3 }
  },
  'Henry': {
    name: 'Electric Surge',
    emoji: '⚡',
    description: '20% chance to paralyze opponent (skip turn)',
    type: 'passive',
    effect: { paralyzeChance: 0.2 }
  },
  'Iris': {
    name: 'Life Aura',
    emoji: '🦄',
    description: 'When healing, also restore 10 energy',
    type: 'passive',
    effect: { healRestoresEnergy: 10 }
  },
  'Jack': {
    name: 'Shadow Strike',
    emoji: '🐺',
    description: 'Deal 25% more damage when opponent HP is below 30%',
    type: 'passive',
    effect: { lowHpDamageBonus: 0.25, enemyHpThreshold: 0.3 }
  },
  'Jade': {
    name: 'Stone Skin',
    emoji: '🐢',
    description: 'Reduce damage by 5 for every hit taken (stacks)',
    type: 'passive',
    effect: { stackingDefense: 5 }
  },
  'Joy': {
    name: 'Radiant Energy',
    emoji: '🌟',
    description: 'Special moves refund 20% energy on use',
    type: 'passive',
    effect: { specialEnergyRefund: 0.2 }
  },
  'Larry': {
    name: 'Cunning Thief',
    emoji: '🦝',
    description: 'Steal 5 energy from opponent on hit',
    type: 'passive',
    effect: { energySteal: 5 }
  },
  'Lennon': {
    name: 'Sound Wave',
    emoji: '🦜',
    description: 'Attacks ignore 20% of opponent defense buffs',
    type: 'passive',
    effect: { defenseIgnore: 0.2 }
  },
  'Lizzy': {
    name: 'Dragon Heart',
    emoji: '🐲',
    description: 'Deal 15% more damage with special move',
    type: 'passive',
    effect: { specialDamageBonus: 0.15 }
  },
  'Louie': {
    name: 'Tech Armor',
    emoji: '🤖',
    description: 'Immune to burn and poison effects',
    type: 'passive',
    effect: { statusImmunity: ['burn', 'poison'] }
  },
  'Max': {
    name: 'Fighting Spirit',
    emoji: '🐵',
    description: 'Deal 20% more damage when HP is below 30%',
    type: 'passive',
    effect: { lowHpSelfDamageBonus: 0.2, selfHpThreshold: 0.3 }
  },
  'Milo': {
    name: 'Vine Heal',
    emoji: '🌿',
    description: 'Restore 3 HP every turn',
    type: 'passive',
    effect: { hpRegenPerTurn: 3 }
  },
  'Molly': {
    name: 'Bubble Shield',
    emoji: '🐠',
    description: 'First hit taken each battle deals 50% damage',
    type: 'passive',
    effect: { firstHitReduction: 0.5 }
  },
  'Nico': {
    name: 'Speedster',
    emoji: '🦔',
    description: 'Energy regenerates 50% faster',
    type: 'passive',
    effect: { energyRegenBonus: 0.5 }
  },
  'Nina': {
    name: 'Moonlight',
    emoji: '🌙',
    description: 'All healing effects are 25% more effective',
    type: 'passive',
    effect: { allHealingBonus: 0.25 }
  },
  'Nix': {
    name: 'Frost Bite',
    emoji: '❄️',
    description: '20% chance to freeze opponent (lose next turn)',
    type: 'passive',
    effect: { freezeChance: 0.2 }
  },
  'Ollie': {
    name: 'Inferno',
    emoji: '🔥',
    description: 'Attacks have a 30% chance to deal bonus burn damage (10 HP)',
    type: 'passive',
    effect: { burnDamageChance: 0.3, burnDamage: 10 }
  },
  'Paco': {
    name: 'Wind Walker',
    emoji: '💨',
    description: '20% chance to get a free extra turn',
    type: 'passive',
    effect: { extraTurnChance: 0.2 }
  },
  'Paolo': {
    name: 'Overcharge',
    emoji: '⚙️',
    description: 'Start battle with max energy (100)',
    type: 'passive',
    effect: { startWithMaxEnergy: true }
  },
  'Pepper': {
    name: 'Spicy Heat',
    emoji: '🌶️',
    description: 'Deal 3 extra damage on all attacks',
    type: 'passive',
    effect: { flatDamageBonus: 3 }
  },
  'Phil': {
    name: 'Mind Shield',
    emoji: '🧠',
    description: 'Negative effects have 50% reduced duration',
    type: 'passive',
    effect: { debuffDurationReduction: 0.5 }
  },
  'Poe': {
    name: 'Dark Veil',
    emoji: '🦇',
    description: 'Lifesteal 15% of damage dealt',
    type: 'passive',
    effect: { lifesteal: 0.15 }
  },
  'Quinn': {
    name: 'Lightning Fast',
    emoji: '⚡',
    description: 'Non-special moves cost half energy',
    type: 'passive',
    effect: { normalMoveCostReduction: 0.5 }
  },
  'Ravi': {
    name: 'Thunder Strike',
    emoji: '⛈️',
    description: 'Critical hits restore 10 energy',
    type: 'passive',
    effect: { criticalEnergyGain: 10 }
  },
  'Rocky': {
    name: 'Mountain Stance',
    emoji: '🪨',
    description: 'Cannot be moved or knocked back, +10% defense',
    type: 'passive',
    effect: { immovable: true, defenseBonus: 0.1 }
  },
  'Romeo': {
    name: 'Charm',
    emoji: '💝',
    description: '15% chance opponent misses their attack',
    type: 'passive',
    effect: { opponentMissChance: 0.15 }
  },
  'Rubie': {
    name: 'Gem Power',
    emoji: '💎',
    description: 'Deal 10% more damage for each buff active',
    type: 'passive',
    effect: { damagePerBuff: 0.1 }
  },
  'Shelly': {
    name: 'Shell Defense',
    emoji: '🐚',
    description: 'Block first 25 damage taken each battle',
    type: 'passive',
    effect: { damageBlock: 25 }
  },
  'Skippy': {
    name: 'Bounce Back',
    emoji: '🦘',
    description: 'Restore 15% HP when falling below 25% HP (once per battle)',
    type: 'passive',
    effect: { emergencyHeal: 0.15, emergencyThreshold: 0.25 }
  },
  'Steve': {
    name: 'Builder\'s Strength',
    emoji: '🔨',
    description: 'Deal 5% more damage each turn (stacks up to 25%)',
    type: 'passive',
    effect: { stackingDamage: 0.05, maxStacks: 5 }
  },
  'Suzy': {
    name: 'Starlight',
    emoji: '⭐',
    description: 'Chance to get a random buff at battle start',
    type: 'passive',
    effect: { randomStartBuff: true }
  },
  'Tony': {
    name: 'Twin Power',
    emoji: '👥',
    description: '30% chance to attack twice in one turn',
    type: 'passive',
    effect: { doubleAttackChance: 0.3 }
  },
  'Ursula': {
    name: 'Ocean\'s Might',
    emoji: '🌊',
    description: 'Gain +1 energy for each 10 damage dealt',
    type: 'passive',
    effect: { damageToEnergy: true }
  },
  'Wanda': {
    name: 'Flower Power',
    emoji: '🌺',
    description: 'Remove one negative effect at end of each turn',
    type: 'passive',
    effect: { autoCleansePerTurn: 1 }
  },
  'Yara': {
    name: 'Sandstorm',
    emoji: '🏜️',
    description: 'Opponent takes 3 damage at end of their turn',
    type: 'passive',
    effect: { opponentEndTurnDamage: 3 }
  },
  'Zac': {
    name: 'Steel Wall',
    emoji: '🛡️',
    description: 'Take 20% reduced damage when HP is above 50%',
    type: 'passive',
    effect: { highHpDefenseBonus: 0.2, defenseHpThreshold: 0.5 }
  }
};

function getCharacterAbility(characterName) {
  if (CHARACTER_ABILITIES[characterName]) {
    return CHARACTER_ABILITIES[characterName];
  }
  
  const cm = getCharacterManager();
  const dynamicAbility = cm.getCharacterAbility(characterName);
  if (dynamicAbility) {
    return dynamicAbility;
  }
  
  return null;
}

function getAbilityDescription(characterName) {
  const ability = getCharacterAbility(characterName);
  if (!ability) return 'No ability';
  return `${ability.emoji} **${ability.name}**: ${ability.description}`;
}

module.exports = {
  CHARACTER_ABILITIES,
  getCharacterAbility,
  getAbilityDescription
};
