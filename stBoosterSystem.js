const { calculateBaseHP } = require('./battleUtils.js');
const { updateTaskProgress } = require('./seasonSystem.js');

const SHARDS_PER_BOOSTER = 100;
const MAX_BOOSTS_PER_CHARACTER = 3;

// Generate a weighted ST value that favors lower results as current ST increases
function generateWeightedST(currentST) {
  // Generate a base random ST (0-100)
  const rawST = Math.random() * 100;
  
  // Calculate weights based on current ST
  // The higher the current ST, the more we bias towards lower results
  const stFactor = currentST / 100; // 0 to 1
  
  // For low ST (0-50): relatively balanced, slight favor for improvement
  // For medium ST (50-75): more balanced
  // For high ST (75-90): favor lower results
  // For very high ST (90+): heavily favor lower results
  
  let lowerBias;
  if (currentST < 50) {
    // Low ST: 40% chance to get lower, 60% chance to get higher
    lowerBias = 0.4;
  } else if (currentST < 75) {
    // Medium ST: 55% chance to get lower, 45% chance to get higher
    lowerBias = 0.55;
  } else if (currentST < 90) {
    // High ST: 75% chance to get lower, 25% chance to get higher
    lowerBias = 0.75;
  } else {
    // Very high ST (90+): 90% chance to get lower, 10% chance to get higher
    lowerBias = 0.90;
  }
  
  const roll = Math.random();
  
  if (roll < lowerBias) {
    // Generate ST lower than current
    // Use exponential distribution to favor much lower values
    const range = currentST;
    const exponentialFactor = Math.pow(Math.random(), 2); // Squares favor lower values
    const newST = range * exponentialFactor;
    return parseFloat(newST.toFixed(2));
  } else {
    // Generate ST higher than current
    // For high ST characters, the gains are minimal
    const range = 100 - currentST;
    let boost;
    
    if (currentST >= 90) {
      // Very small gains for 90+ ST
      boost = Math.random() * Math.min(range, 5); // Max +5%
    } else if (currentST >= 75) {
      // Small gains for 75-90 ST
      boost = Math.random() * Math.min(range, 15); // Max +15%
    } else {
      // Normal gains below 75
      boost = Math.random() * range;
    }
    
    const newST = currentST + boost;
    return parseFloat(Math.min(100, newST).toFixed(2));
  }
}

function canCraftBooster(userData) {
  const shards = userData.shards || 0;
  return shards >= SHARDS_PER_BOOSTER;
}

function craftBooster(userData) {
  if (!canCraftBooster(userData)) {
    return { 
      success: false, 
      message: `❌ You need ${SHARDS_PER_BOOSTER} shards to craft an ST Booster! You have ${userData.shards || 0}.` 
    };
  }
  
  userData.shards -= SHARDS_PER_BOOSTER;
  userData.stBoosters = (userData.stBoosters || 0) + 1;
  
  return {
    success: true,
    message: `✅ Successfully crafted an ST Booster! You now have ${userData.stBoosters} booster(s).\n\n⚠️ **Warning:** ST Boosters re-roll your character's ST completely!\n• Can only use 3 times per character\n• Higher ST = higher chance to get LOWER ST\n• 90+ ST = 90% chance to decrease!\n\nUse !boost <character> when ready!`
  };
}

function getCharacterBoostCount(character) {
  return character.boostCount || 0;
}

function useBooster(userData, characterName) {
  if (!userData.stBoosters || userData.stBoosters <= 0) {
    return { 
      success: false, 
      message: "❌ You don't have any ST Boosters! Craft one with 100 shards using !craft" 
    };
  }
  
  // Find character in the array
  const character = userData.characters.find(c => c.name.toLowerCase() === characterName.toLowerCase());
  
  if (!character) {
    return { 
      success: false, 
      message: "❌ You don't own this character!" 
    };
  }
  
  // Check boost count for this character
  const boostCount = getCharacterBoostCount(character);
  if (boostCount >= MAX_BOOSTS_PER_CHARACTER) {
    return { 
      success: false, 
      message: `❌ **${character.name}** has already been boosted ${MAX_BOOSTS_PER_CHARACTER} times! You cannot boost this character anymore.` 
    };
  }
  
  const oldST = character.st;
  
  // Generate new weighted ST
  const newST = generateWeightedST(oldST);
  const change = newST - oldST;
  const increased = change > 0;
  
  // Update character
  character.st = newST;
  character.boostCount = boostCount + 1;
  
  // Recalculate HP based on new ST
  if (character.baseHp !== undefined) {
    character.baseHp = calculateBaseHP(newST);
  }
  
  // Use up the booster
  userData.stBoosters -= 1;
  
  // Track quest progress
  if (!userData.questProgress) userData.questProgress = {};
  userData.questProgress.boostsUsed = (userData.questProgress.boostsUsed || 0) + 1;
  
  // Track season daily task progress
  updateTaskProgress(userData, 'boostersUsed', 1);
  
  // Determine result message
  let resultEmoji, resultText, resultColor;
  
  if (increased) {
    if (change >= 20) {
      resultEmoji = '💫';
      resultText = 'LEGENDARY BOOST';
      resultColor = '#FFD700';
    } else if (change >= 10) {
      resultEmoji = '🌟';
      resultText = 'RARE BOOST';
      resultColor = '#9B59B6';
    } else {
      resultEmoji = '⭐';
      resultText = 'BOOST';
      resultColor = '#3498DB';
    }
  } else {
    if (change <= -20) {
      resultEmoji = '💔';
      resultText = 'MAJOR DECREASE';
      resultColor = '#E74C3C';
    } else if (change <= -10) {
      resultEmoji = '⚠️';
      resultText = 'DECREASE';
      resultColor = '#E67E22';
    } else {
      resultEmoji = '📉';
      resultText = 'MINOR DECREASE';
      resultColor = '#F39C12';
    }
  }
  
  return {
    success: true,
    character: character.name,
    emoji: character.emoji,
    oldST: oldST.toFixed(2),
    newST: newST.toFixed(2),
    change: change.toFixed(2),
    changeAbs: Math.abs(change).toFixed(2),
    increased: increased,
    boostCount: character.boostCount,
    remainingBoosts: MAX_BOOSTS_PER_CHARACTER - character.boostCount,
    resultEmoji: resultEmoji,
    resultText: resultText,
    resultColor: resultColor
  };
}

function getBoosterInfo(userData) {
  const shards = userData.shards || 0;
  const boosters = userData.stBoosters || 0;
  const boostsUsed = userData.questProgress?.boostsUsed || 0;
  
  return {
    shards,
    boosters,
    boostsUsed,
    canCraft: shards >= SHARDS_PER_BOOSTER,
    shardsNeeded: Math.max(0, SHARDS_PER_BOOSTER - shards)
  };
}

module.exports = {
  SHARDS_PER_BOOSTER,
  MAX_BOOSTS_PER_CHARACTER,
  canCraftBooster,
  craftBooster,
  useBooster,
  getBoosterInfo,
  getCharacterBoostCount
};
