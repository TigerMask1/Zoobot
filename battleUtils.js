const { LOW_ST_MOVES, MID_ST_MOVES, HIGH_ST_MOVES, SPECIAL_MOVES, getMovesForST } = require('./moves.js');
const characterManager = require('./characterManager.js');

function calculateBaseHP(st) {
  const minHP = 250;
  const maxHP = 400;
  const hpRange = maxHP - minHP;
  return Math.round(minHP + (st / 100) * hpRange);
}

function calculateDamage(move, level, st, isSpecial = false) {
  const baseDamage = move.damage;
  
  if (baseDamage === 0) {
    return 0;
  }
  
  if (baseDamage < 0) {
    const healAmount = Math.abs(baseDamage);
    const levelMultiplier = 1 + (level - 1) * 0.08;
    const stMultiplier = 0.6 + (st / 100) * 0.4;
    return -Math.round(healAmount * levelMultiplier * stMultiplier);
  }
  
  if (isSpecial) {
    const levelMultiplier = 1 + (level - 1) * 0.08;
    const stMultiplier = 0.8 + (st / 100) * 0.6;
    return Math.max(1, Math.round(baseDamage * levelMultiplier * stMultiplier));
  }
  
  const levelMultiplier = 1 + (level - 1) * 0.08;
  const stMultiplier = 0.6 + (st / 100) * 0.4;
  return Math.max(1, Math.round(baseDamage * levelMultiplier * stMultiplier));
}

function calculateEnergyCost(move, isSpecial = false) {
  const baseDamage = Math.abs(move.damage);
  
  if (baseDamage === 0) {
    return 5;
  }
  
  if (isSpecial) {
    return Math.min(60, Math.max(30, Math.round(baseDamage * 0.5)));
  }
  
  if (baseDamage < 20) {
    return 5;
  } else if (baseDamage < 50) {
    return Math.round(baseDamage * 0.3);
  } else {
    return Math.round(baseDamage * 0.35);
  }
}

function calculateCriticalHit(baseDamage, critChance = 0.15) {
  const roll = Math.random();
  if (roll < critChance) {
    return {
      isCritical: true,
      damage: Math.round(baseDamage * 1.5)
    };
  }
  return {
    isCritical: false,
    damage: baseDamage
  };
}

function assignMovesToCharacter(characterName, st) {
  let specialMove = SPECIAL_MOVES[characterName];
  
  if (!specialMove) {
    const dynamicMove = characterManager.getSpecialMove(characterName);
    if (dynamicMove) {
      specialMove = dynamicMove;
    }
  }
  
  if (!specialMove) {
    console.log(`⚠️ No special move found for ${characterName}, creating default`);
    specialMove = { name: `${characterName}'s Strike`, damage: 90 };
  }
  
  const tierMoves = getMovesForST(st);
  
  const shuffled = [...tierMoves].sort(() => Math.random() - 0.5);
  const selectedMoves = shuffled.slice(0, 2);
  
  return {
    special: specialMove,
    tierMoves: selectedMoves
  };
}

function getMoveDisplay(move, level, st, isSpecial = false, energyCost = null) {
  const damage = calculateDamage(move, level, st, isSpecial);
  const cost = energyCost !== null ? energyCost : calculateEnergyCost(move, isSpecial);
  
  if (damage === 0) {
    return `${move.name} (${cost}⚡)`;
  } else if (damage < 0) {
    return `${move.name} (Heal ${Math.abs(damage)} HP, ${cost}⚡)`;
  } else {
    return `${move.name} (${damage} DMG, ${cost}⚡)`;
  }
}

module.exports = {
  calculateBaseHP,
  calculateDamage,
  calculateEnergyCost,
  calculateCriticalHit,
  assignMovesToCharacter,
  getMoveDisplay
};
