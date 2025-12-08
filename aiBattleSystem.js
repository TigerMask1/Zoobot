const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { calculateBaseHP, assignMovesToCharacter, calculateEnergyCost, calculateDamage, calculateCriticalHit } = require('./battleUtils.js');
const { getCharacterAbility } = require('./characterAbilities.js');
const { MOVE_EFFECTS, applyEffect, processEffects, hasEffect, getEffectsDisplay, clearAllEffects } = require('./moveEffects.js');
const { checkTaskProgress, completePersonalizedTask, initializePersonalizedTaskData } = require('./personalizedTaskSystem.js');
const characterManager = require('./characterManager.js');
const { generateBattleAttachment } = require('./battleImageGenerator.js');

const STARTING_ENERGY = 50;
const ENERGY_PER_TURN = 10;
const MAX_ENERGY = 100;
const aiActiveBattles = new Map();

function createAIOpponent(difficulty = 'normal', playerCharacter = null) {
  const CHARACTERS = characterManager.getCharacters();
  const allCharNames = CHARACTERS.map(c => c.name);
  const aiCharName = allCharNames[Math.floor(Math.random() * allCharNames.length)];
  const charData = CHARACTERS.find(c => c.name === aiCharName);
  
  let level, st;
  
  if (difficulty === 'hard' && playerCharacter) {
    const playerLevel = playerCharacter.level || 1;
    const playerST = playerCharacter.st || 50;
    
    level = Math.floor(playerLevel * 1.2) + Math.floor(Math.random() * 4) + 2;
    level = Math.max(playerLevel + 3, level);
    
    const calculatedST = Math.floor(playerST * 1.1) + Math.floor(Math.random() * 8) + 5;
    
    if (playerST < 80) {
      const targetST = 90;
      const interpolated = playerST + ((targetST - playerST) * 0.5);
      st = Math.max(Math.round(interpolated), calculatedST);
    } else {
      st = Math.max(90, Math.min(115, calculatedST));
    }
  } else {
    switch (difficulty) {
      case 'easy':
        level = Math.floor(Math.random() * 3) + 1;
        st = Math.floor(Math.random() * 30) + 20;
        break;
      case 'hard':
        level = Math.floor(Math.random() * 5) + 8;
        st = Math.floor(Math.random() * 11) + 90;
        break;
      case 'normal':
      default:
        level = Math.floor(Math.random() * 5) + 3;
        st = Math.floor(Math.random() * 40) + 40;
        break;
    }
  }
  
  const moves = assignMovesToCharacter(charData.name, st);
  const baseHp = calculateBaseHP(st);
  const ability = getCharacterAbility(charData.name);
  
  return {
    ...charData,
    level,
    st,
    moves,
    baseHp,
    ability,
    isAI: true
  };
}

async function startAIBattle(message, data, playerId, botId, difficulty) {
  if (aiActiveBattles.has(playerId)) {
    await message.reply('❌ You are already in an AI battle!');
    return;
  }
  
  if (!data.users[playerId]) {
    await message.reply('❌ You need to use `!start` first!');
    return;
  }
  
  if (data.users[playerId].characters.length === 0) {
    await message.reply('❌ You don\'t have any characters! Use `!start` and `!select` to get started.');
    return;
  }
  
  const difficultyEmojis = {
    'easy': '🟢',
    'normal': '🟡',
    'hard': '🔴'
  };
  
  await message.reply(`${difficultyEmojis[difficulty]} Starting AI battle (${difficulty.toUpperCase()} difficulty)! Select your character by typing its name:`);
  
  const playerChars = data.users[playerId].characters;
  
  const charListEmbed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('🎮 Select Your Character')
    .setDescription(playerChars.map(c => `${c.emoji} **${c.name}** (Lvl ${c.level}, ST: ${c.st}%)`).join('\n'));
  
  await message.channel.send({ embeds: [charListEmbed] });
  
  const filter = (m) => m.author.id === playerId && !m.content.startsWith('!');
  const collector = message.channel.createMessageCollector({ filter, time: 60000 });
  
  collector.on('collect', async (m) => {
    const charName = m.content.toLowerCase().trim();
    const selectedChar = playerChars.find(c => c.name.toLowerCase() === charName);
    
    if (!selectedChar) {
      await m.reply('❌ You don\'t own that character! Try again.');
      return;
    }
    
    if (!selectedChar.moves || !selectedChar.baseHp) {
      await m.reply('❌ This character doesn\'t have moves assigned yet!');
      return;
    }
    
    collector.stop();
    
    const aiOpponent = createAIOpponent(difficulty, selectedChar);
    
    await m.reply(`✅ You selected **${selectedChar.name} ${selectedChar.emoji}**!`);
    await message.channel.send(`🤖 AI selected **${aiOpponent.name} ${aiOpponent.emoji}** (Lvl ${aiOpponent.level}, ST: ${aiOpponent.st}%)!`);
    
    await initializeAIBattle(message.channel, data, playerId, selectedChar, aiOpponent, difficulty);
  });
}

async function initializeAIBattle(channel, data, playerId, playerChar, aiChar, difficulty) {
  const playerAbility = getCharacterAbility(playerChar.name);
  const aiAbility = aiChar.ability;
  
  let aiMaxHP = aiChar.baseHp;
  if (difficulty === 'hard' && playerChar.st >= 115) {
    const hpMultiplier = 1 + ((playerChar.st - 115) / 200);
    aiMaxHP = Math.round(aiChar.baseHp * hpMultiplier);
  }
  
  const battle = {
    id: `ai-battle-${playerId}-${Date.now()}`,
    player1: playerId,
    player2: 'ai-opponent',
    player1Character: playerChar,
    player2Character: aiChar,
    player1HP: playerChar.baseHp,
    player2HP: aiMaxHP,
    player1MaxHP: playerChar.baseHp,
    player2MaxHP: aiMaxHP,
    player1Energy: STARTING_ENERGY,
    player2Energy: STARTING_ENERGY,
    player1Shield: 0,
    player2Shield: 0,
    player1Buffs: {},
    player2Buffs: {},
    player1Ability: playerAbility,
    player2Ability: aiAbility,
    player1AbilityState: {},
    player2AbilityState: {},
    currentTurn: 'player',
    channel: channel,
    difficulty: difficulty,
    effects: { player1: [], player2: [] },
    turnCount: 0,
    isAIBattle: true
  };
  
  if (playerAbility && playerAbility.effect.startingEnergyBonus) {
    battle.player1Energy += playerAbility.effect.startingEnergyBonus;
  }
  if (playerAbility && playerAbility.effect.startingShield) {
    battle.player1Shield = Math.round(playerChar.baseHp * playerAbility.effect.startingShield);
  }
  if (aiAbility && aiAbility.effect.startingEnergyBonus) {
    battle.player2Energy += aiAbility.effect.startingEnergyBonus;
  }
  if (aiAbility && aiAbility.effect.startingShield) {
    battle.player2Shield = Math.round(aiChar.baseHp * aiAbility.effect.startingShield);
  }
  
  aiActiveBattles.set(playerId, battle);
  
  const startEmbed = new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('⚔️ BATTLE START!')
    .setDescription(`${playerChar.emoji} **${playerChar.name}** vs ${aiChar.emoji} **${aiChar.name}** (AI)\n\n${playerAbility ? `Your Ability: ${playerAbility.emoji} **${playerAbility.name}**\n${playerAbility.description}\n\n` : ''}${aiAbility ? `AI Ability: ${aiAbility.emoji} **${aiAbility.name}**\n${aiAbility.description}` : ''}`)
    .addFields(
      { name: `Your ${playerChar.emoji} ${playerChar.name}`, value: `HP: ${battle.player1HP}\nEnergy: ${battle.player1Energy}`, inline: true },
      { name: `AI ${aiChar.emoji} ${aiChar.name}`, value: `HP: ${battle.player2HP}\nEnergy: ${battle.player2Energy}`, inline: true }
    );
  
  await channel.send({ embeds: [startEmbed] });
  
  setTimeout(() => {
    aiBattlePromptTurn(battle, channel, data);
  }, 2000);
}

async function aiBattlePromptTurn(battle, channel, data) {
  battle.turnCount++;
  
  const isPlayerTurn = battle.currentTurn === 'player';
  const currentChar = isPlayerTurn ? battle.player1Character : battle.player2Character;
  const currentAbility = isPlayerTurn ? battle.player1Ability : battle.player2Ability;
  const currentAbilityState = isPlayerTurn ? battle.player1AbilityState : battle.player2AbilityState;
  
  let currentEnergy = isPlayerTurn ? battle.player1Energy : battle.player2Energy;
  
  if (currentAbility && currentAbility.effect.healPerTurn) {
    const healAmount = Math.round((isPlayerTurn ? battle.player1MaxHP : battle.player2MaxHP) * currentAbility.effect.healPerTurn);
    if (isPlayerTurn) {
      battle.player1HP = Math.min(battle.player1HP + healAmount, battle.player1MaxHP);
    } else {
      battle.player2HP = Math.min(battle.player2HP + healAmount, battle.player2MaxHP);
    }
    await channel.send(`${currentAbility.emoji} **${currentAbility.name}**: ${currentChar.emoji} ${currentChar.name} healed ${healAmount} HP!`);
  }
  
  if (currentAbility && currentAbility.effect.energyRegenPerTurn) {
    currentEnergy = Math.min(currentEnergy + currentAbility.effect.energyRegenPerTurn, MAX_ENERGY);
    if (isPlayerTurn) {
      battle.player1Energy = currentEnergy;
    } else {
      battle.player2Energy = currentEnergy;
    }
  }
  
  currentEnergy = Math.min(currentEnergy + ENERGY_PER_TURN, MAX_ENERGY);
  if (isPlayerTurn) {
    battle.player1Energy = currentEnergy;
  } else {
    battle.player2Energy = currentEnergy;
  }
  
  const effectsResult = processEffects(battle, isPlayerTurn ? battle.player1 : battle.player2);
  
  if (effectsResult.damage > 0) {
    if (isPlayerTurn) {
      battle.player1HP = Math.max(0, battle.player1HP - effectsResult.damage);
    } else {
      battle.player2HP = Math.max(0, battle.player2HP - effectsResult.damage);
    }
  }
  
  if (effectsResult.heal > 0) {
    if (isPlayerTurn) {
      battle.player1HP = Math.min(battle.player1HP + effectsResult.heal, battle.player1MaxHP);
    } else {
      battle.player2HP = Math.min(battle.player2HP + effectsResult.heal, battle.player2MaxHP);
    }
  }
  
  if (effectsResult.messages.length > 0) {
    await channel.send(effectsResult.messages.join('\n'));
  }
  
  if (battle.player1HP <= 0 || battle.player2HP <= 0) {
    await endAIBattle(battle, channel, data);
    return;
  }
  
  if (effectsResult.skipTurn) {
    await channel.send(`${currentChar.emoji} **${currentChar.name}** skips their turn!`);
    battle.currentTurn = isPlayerTurn ? 'ai' : 'player';
    setTimeout(() => aiBattlePromptTurn(battle, channel, data), 2000);
    return;
  }
  
  if (isPlayerTurn) {
    await promptPlayerTurn(battle, channel, data);
  } else {
    await executeAITurn(battle, channel, data);
  }
}

async function promptPlayerTurn(battle, channel, data) {
  const moves = battle.player1Character.moves;
  const allMoves = [moves.special, ...moves.tierMoves];
  
  const hpBar = createHPBar(battle.player1HP, battle.player1MaxHP);
  const aiHPBar = createHPBar(battle.player2HP, battle.player2MaxHP);
  
  const turnEmbed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle(`⚔️ Your Turn! (Turn ${battle.turnCount})`)
    .setDescription(`**${battle.player1Character.emoji} ${battle.player1Character.name}**\n${hpBar} **${battle.player1HP}/${battle.player1MaxHP} HP**\n⚡ ${battle.player1Energy}/${MAX_ENERGY} Energy${battle.player1Shield > 0 ? `\n🛡️ Shield: ${battle.player1Shield}` : ''}${getEffectsDisplay(battle, battle.player1) ? `\n${getEffectsDisplay(battle, battle.player1)}` : ''}\n\n**VS**\n\n**${battle.player2Character.emoji} ${battle.player2Character.name} (AI)**\n${aiHPBar} **${battle.player2HP}/${battle.player2MaxHP} HP**\n⚡ ${battle.player2Energy}/${MAX_ENERGY} Energy${battle.player2Shield > 0 ? `\n🛡️ Shield: ${battle.player2Shield}` : ''}${getEffectsDisplay(battle, battle.player2) ? `\n${getEffectsDisplay(battle, battle.player2)}` : ''}`)
    .setFooter({ text: 'Select your move!' });
  
  const moveButtons = [];
  for (let i = 0; i < allMoves.length; i++) {
    const move = allMoves[i];
    const isSpecial = i === 0;
    let energyCost = calculateEnergyCost(move, isSpecial);
    
    if (battle.player1Ability && battle.player1Ability.effect.energyCostReduction) {
      energyCost = Math.round(energyCost * (1 - battle.player1Ability.effect.energyCostReduction));
    }
    
    const damage = calculateDamage(move, battle.player1Character.level, battle.player1Character.st, isSpecial);
    const label = damage > 0 ? `${move.name} (${damage} DMG, ${energyCost}⚡)` : 
                  damage < 0 ? `${move.name} (Heal ${Math.abs(damage)}, ${energyCost}⚡)` : 
                  `${move.name} (${energyCost}⚡)`;
    
    moveButtons.push(
      new ButtonBuilder()
        .setCustomId(`aimove_${i}_${battle.player1}`)
        .setLabel(label)
        .setStyle(battle.player1Energy >= energyCost ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(battle.player1Energy < energyCost)
    );
  }
  
  const passButton = new ButtonBuilder()
    .setCustomId(`aipass_${battle.player1}`)
    .setLabel('Pass Turn')
    .setStyle(ButtonStyle.Secondary);
  
  const rows = [];
  for (let i = 0; i < moveButtons.length; i += 3) {
    rows.push(new ActionRowBuilder().addComponents(moveButtons.slice(i, i + 3)));
  }
  rows.push(new ActionRowBuilder().addComponents(passButton));
  
  let battleAttachment = null;
  try {
    const battleImageData = {
      player1Character: battle.player1Character,
      player2Character: battle.player2Character,
      player1HP: battle.player1HP,
      player2HP: battle.player2HP,
      player1MaxHP: battle.player1MaxHP,
      player2MaxHP: battle.player2MaxHP,
      player1Energy: battle.player1Energy,
      player2Energy: battle.player2Energy,
      player1Shield: battle.player1Shield || 0,
      player2Shield: battle.player2Shield || 0,
      currentTurn: 'player',
      turnCount: battle.turnCount,
      player1: battle.player1,
      player2: 'AI'
    };
    const imageResult = await generateBattleAttachment(battleImageData);
    if (imageResult && imageResult.attachment) {
      battleAttachment = new AttachmentBuilder(imageResult.attachment, { name: imageResult.name });
      turnEmbed.setImage(`attachment://${imageResult.name}`);
    }
  } catch (error) {
    console.error('Failed to generate AI battle image:', error);
  }
  
  const messageOptions = { embeds: [turnEmbed], components: rows };
  if (battleAttachment) {
    messageOptions.files = [battleAttachment];
  }
  
  const turnMessage = await channel.send(messageOptions);
  
  const filter = (interaction) => {
    return interaction.user.id === battle.player1 && 
           (interaction.customId.startsWith('aimove_') || interaction.customId.startsWith('aipass_'));
  };
  
  const collector = turnMessage.createMessageComponentCollector({ filter, time: 120000 });
  
  collector.on('collect', async (interaction) => {
    if (interaction.customId.startsWith('aipass_')) {
      await interaction.update({ components: [] });
      collector.stop();
      await channel.send(`${battle.player1Character.emoji} **${battle.player1Character.name}** passed their turn!`);
      battle.currentTurn = 'ai';
      setTimeout(() => aiBattlePromptTurn(battle, channel, data), 2000);
    } else if (interaction.customId.startsWith('aimove_')) {
      const moveIndex = parseInt(interaction.customId.split('_')[1]);
      await interaction.update({ components: [] });
      collector.stop();
      await executePlayerMove(battle, channel, data, moveIndex);
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      channel.send(`⏱️ Time expired! ${battle.player1Character.emoji} **${battle.player1Character.name}** passed their turn!`);
      battle.currentTurn = 'ai';
      setTimeout(() => aiBattlePromptTurn(battle, channel, data), 2000);
    }
  });
}

async function executePlayerMove(battle, channel, data, moveIndex) {
  const moves = battle.player1Character.moves;
  const allMoves = [moves.special, ...moves.tierMoves];
  const selectedMove = allMoves[moveIndex];
  const isSpecial = moveIndex === 0;
  
  let energyCost = calculateEnergyCost(selectedMove, isSpecial);
  if (battle.player1Ability && battle.player1Ability.effect.energyCostReduction) {
    energyCost = Math.round(energyCost * (1 - battle.player1Ability.effect.energyCostReduction));
  }
  
  battle.player1Energy -= energyCost;
  
  let baseDamage = calculateDamage(selectedMove, battle.player1Character.level, battle.player1Character.st, isSpecial);
  
  if (baseDamage > 0) {
    let critChance = 0.15;
    if (battle.player1Ability && battle.player1Ability.effect.criticalChanceBonus) {
      critChance += battle.player1Ability.effect.criticalChanceBonus;
    }
    
    const critResult = calculateCriticalHit(baseDamage, critChance);
    baseDamage = critResult.damage;
    const isCritical = critResult.isCritical;
    
    if (isCritical && battle.player1Ability && battle.player1Ability.effect.criticalDamageBonus) {
      baseDamage = Math.round(baseDamage * (1 + battle.player1Ability.effect.criticalDamageBonus));
    }
    
    if (battle.player2Ability && battle.player2Ability.effect.damageReduction) {
      baseDamage = Math.round(baseDamage * (1 - battle.player2Ability.effect.damageReduction));
    }
    
    if (battle.player2Ability && battle.player2Ability.effect.dodgeChance && Math.random() < battle.player2Ability.effect.dodgeChance) {
      baseDamage = 0;
      await channel.send(`${battle.player2Ability.emoji} **${battle.player2Ability.name}**: ${battle.player2Character.emoji} **${battle.player2Character.name}** dodged the attack!`);
    }
    
    let finalDamage = baseDamage;
    if (battle.player2Shield > 0 && finalDamage > 0) {
      const shieldDamage = Math.min(battle.player2Shield, finalDamage);
      battle.player2Shield -= shieldDamage;
      finalDamage -= shieldDamage;
    }
    
    battle.player2HP = Math.max(0, battle.player2HP - finalDamage);
    
    await channel.send(`${battle.player1Character.emoji} **${battle.player1Character.name}** used **${selectedMove.name}**!${isCritical ? ' 💥 **CRITICAL HIT!**' : ''}\n💥 Dealt ${finalDamage} damage to ${battle.player2Character.emoji} **${battle.player2Character.name}**!`);
    
    if (battle.player1Ability && battle.player1Ability.effect.burnChance && Math.random() < battle.player1Ability.effect.burnChance && finalDamage > 0) {
      applyEffect(battle, battle.player2, MOVE_EFFECTS.BURN, 3);
      await channel.send(`🔥 ${battle.player2Character.emoji} **${battle.player2Character.name}** is burned!`);
    }
  } else if (baseDamage < 0) {
    const healAmount = Math.min(Math.abs(baseDamage), battle.player1MaxHP - battle.player1HP);
    battle.player1HP += healAmount;
    await channel.send(`${battle.player1Character.emoji} **${battle.player1Character.name}** used **${selectedMove.name}**!\n💚 Healed ${healAmount} HP!`);
  }
  
  if (battle.player2HP <= 0) {
    await endAIBattle(battle, channel, data);
    return;
  }
  
  battle.currentTurn = 'ai';
  setTimeout(() => aiBattlePromptTurn(battle, channel, data), 2000);
}

async function executeAITurn(battle, channel, data) {
  await channel.send(`🤖 AI is thinking...`);
  
  setTimeout(async () => {
    const decision = makeAIDecision(battle);
    
    if (decision.type === 'pass') {
      await channel.send(`${battle.player2Character.emoji} **${battle.player2Character.name}** (AI) passed their turn!`);
      battle.currentTurn = 'player';
      setTimeout(() => aiBattlePromptTurn(battle, channel, data), 2000);
      return;
    }
    
    const moves = battle.player2Character.moves;
    const allMoves = [moves.special, ...moves.tierMoves];
    const selectedMove = allMoves[decision.moveIndex];
    const isSpecial = decision.moveIndex === 0;
    
    let energyCost = calculateEnergyCost(selectedMove, isSpecial);
    if (battle.player2Ability && battle.player2Ability.effect.energyCostReduction) {
      energyCost = Math.round(energyCost * (1 - battle.player2Ability.effect.energyCostReduction));
    }
    
    battle.player2Energy -= energyCost;
    
    let baseDamage = calculateDamage(selectedMove, battle.player2Character.level, battle.player2Character.st, isSpecial);
    
    if (baseDamage > 0) {
      let critChance = 0.15;
      if (battle.player2Ability && battle.player2Ability.effect.criticalChanceBonus) {
        critChance += battle.player2Ability.effect.criticalChanceBonus;
      }
      
      const critResult = calculateCriticalHit(baseDamage, critChance);
      baseDamage = critResult.damage;
      const isCritical = critResult.isCritical;
      
      if (isCritical && battle.player2Ability && battle.player2Ability.effect.criticalDamageBonus) {
        baseDamage = Math.round(baseDamage * (1 + battle.player2Ability.effect.criticalDamageBonus));
      }
      
      if (battle.player1Ability && battle.player1Ability.effect.damageReduction) {
        baseDamage = Math.round(baseDamage * (1 - battle.player1Ability.effect.damageReduction));
      }
      
      if (battle.player1Ability && battle.player1Ability.effect.dodgeChance && Math.random() < battle.player1Ability.effect.dodgeChance) {
        baseDamage = 0;
        await channel.send(`${battle.player1Ability.emoji} **${battle.player1Ability.name}**: ${battle.player1Character.emoji} **${battle.player1Character.name}** dodged the attack!`);
      }
      
      let finalDamage = baseDamage;
      if (battle.player1Shield > 0 && finalDamage > 0) {
        const shieldDamage = Math.min(battle.player1Shield, finalDamage);
        battle.player1Shield -= shieldDamage;
        finalDamage -= shieldDamage;
      }
      
      battle.player1HP = Math.max(0, battle.player1HP - finalDamage);
      
      await channel.send(`${battle.player2Character.emoji} **${battle.player2Character.name}** (AI) used **${selectedMove.name}**!${isCritical ? ' 💥 **CRITICAL HIT!**' : ''}\n💥 Dealt ${finalDamage} damage to ${battle.player1Character.emoji} **${battle.player1Character.name}**!`);
      
      if (battle.player2Ability && battle.player2Ability.effect.burnChance && Math.random() < battle.player2Ability.effect.burnChance && finalDamage > 0) {
        applyEffect(battle, battle.player1, MOVE_EFFECTS.BURN, 3);
        await channel.send(`🔥 ${battle.player1Character.emoji} **${battle.player1Character.name}** is burned!`);
      }
    } else if (baseDamage < 0) {
      const healAmount = Math.min(Math.abs(baseDamage), battle.player2MaxHP - battle.player2HP);
      battle.player2HP += healAmount;
      await channel.send(`${battle.player2Character.emoji} **${battle.player2Character.name}** (AI) used **${selectedMove.name}**!\n💚 Healed ${healAmount} HP!`);
    }
    
    if (battle.player1HP <= 0) {
      await endAIBattle(battle, channel, data);
      return;
    }
    
    battle.currentTurn = 'player';
    setTimeout(() => aiBattlePromptTurn(battle, channel, data), 2000);
  }, 1500);
}

function makeAIDecision(battle) {
  const moves = battle.player2Character.moves;
  const allMoves = [moves.special, ...moves.tierMoves];
  const aiEnergy = battle.player2Energy;
  const aiHP = battle.player2HP;
  const aiMaxHP = battle.player2MaxHP;
  const playerHP = battle.player1HP;
  const playerMaxHP = battle.player1MaxHP;
  
  const hpPercent = aiHP / aiMaxHP;
  const playerHPPercent = playerHP / playerMaxHP;
  
  if (aiEnergy < 15 && Math.random() < 0.3) {
    return { type: 'pass' };
  }
  
  const availableMoves = [];
  for (let i = 0; i < allMoves.length; i++) {
    const move = allMoves[i];
    const isSpecial = i === 0;
    let energyCost = calculateEnergyCost(move, isSpecial);
    
    if (battle.player2Ability && battle.player2Ability.effect.energyCostReduction) {
      energyCost = Math.round(energyCost * (1 - battle.player2Ability.effect.energyCostReduction));
    }
    
    if (aiEnergy >= energyCost) {
      const damage = calculateDamage(move, battle.player2Character.level, battle.player2Character.st, isSpecial);
      availableMoves.push({
        index: i,
        move,
        energyCost,
        damage,
        isSpecial,
        priority: calculateMovePriority(damage, energyCost, hpPercent, playerHPPercent, isSpecial)
      });
    }
  }
  
  if (availableMoves.length === 0) {
    return { type: 'pass' };
  }
  
  availableMoves.sort((a, b) => b.priority - a.priority);
  
  const topMoves = availableMoves.filter(m => m.priority >= availableMoves[0].priority * 0.75);
  const selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];
  
  return { type: 'move', moveIndex: selectedMove.index };
}

function calculateMovePriority(damage, energyCost, hpPercent, opponentHPPercent, isSpecial) {
  let priority = 0;
  
  if (damage > 0) {
    priority = (damage / energyCost) * 100;
    
    if (isSpecial) {
      priority *= 1.3;
    }
    
    if (opponentHPPercent < 0.3) {
      priority *= 1.6;
    }
    
    if (hpPercent < 0.5 && damage > 50) {
      priority *= 1.2;
    }
  } else if (damage < 0) {
    if (hpPercent < 0.4) {
      priority = Math.abs(damage) * 3;
    } else if (hpPercent < 0.7) {
      priority = Math.abs(damage) * 1.5;
    } else {
      priority = Math.abs(damage) * 0.3;
    }
  }
  
  return priority + (Math.random() * 25);
}

async function endAIBattle(battle, channel, data) {
  const winner = battle.player1HP > 0 ? battle.player1 : battle.player2;
  const isPlayerWinner = winner === battle.player1;
  
  if (isPlayerWinner) {
    const user = data.users[battle.player1];
    const rewardCoins = 50 + (battle.difficulty === 'easy' ? 0 : battle.difficulty === 'hard' ? 50 : 25);
    const rewardTrophies = battle.difficulty === 'easy' ? 1 : battle.difficulty === 'hard' ? 5 : 3;
    
    user.coins += rewardCoins;
    const oldTrophies = user.trophies || 0;
    user.trophies = Math.min(9999, oldTrophies + rewardTrophies);
    const actualTrophyGain = user.trophies - oldTrophies;
    user.battlesWon = (user.battlesWon || 0) + 1;
    
    if (!user.questProgress) user.questProgress = {};
    user.questProgress.battlesWon = (user.questProgress.battlesWon || 0) + 1;
    user.questProgress.totalBattles = (user.questProgress.totalBattles || 0) + 1;
    user.lastActivity = Date.now();
    
    const ptData = initializePersonalizedTaskData(user);
    if (ptData.taskProgress.battlesWon !== undefined) {
      const completedTask = checkTaskProgress(user, 'battlesWon', 1);
      if (completedTask) {
        await completePersonalizedTask(channel.client, battle.player1, data, completedTask);
      }
    }
    if (ptData.taskProgress.totalBattles !== undefined) {
      const completedTaskTotal = checkTaskProgress(user, 'totalBattles', 1);
      if (completedTaskTotal) {
        await completePersonalizedTask(channel.client, battle.player1, data, completedTaskTotal);
      }
    }
    
    if (actualTrophyGain > 0) {
      const eventSystemLazy = require('./eventSystem.js');
      await eventSystemLazy.recordProgress(battle.player1, user.username || 'Unknown', actualTrophyGain, 'trophy_hunt');
    }
    
    await saveDataImmediate(data);
    
    const victoryEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 VICTORY!')
      .setDescription(`${battle.player1Character.emoji} **${battle.player1Character.name}** defeated ${battle.player2Character.emoji} **${battle.player2Character.name}** (AI)!\n\n**Rewards:**\n💰 +${rewardCoins} Coins\n🏆 +${actualTrophyGain} Trophies\n\n**Final Stats:**`)
      .addFields(
        { name: `Your ${battle.player1Character.emoji} ${battle.player1Character.name}`, value: `HP: ${battle.player1HP}/${battle.player1MaxHP}`, inline: true },
        { name: `AI ${battle.player2Character.emoji} ${battle.player2Character.name}`, value: `HP: 0/${battle.player2MaxHP}`, inline: true }
      );
    
    await channel.send({ embeds: [victoryEmbed] });
  } else {
    const user = data.users[battle.player1];
    if (!user.questProgress) user.questProgress = {};
    user.questProgress.totalBattles = (user.questProgress.totalBattles || 0) + 1;
    
    const ptData = initializePersonalizedTaskData(user);
    if (ptData.taskProgress.totalBattles !== undefined) {
      const completedTaskTotal = checkTaskProgress(user, 'totalBattles', 1);
      if (completedTaskTotal) {
        await completePersonalizedTask(channel.client, battle.player1, data, completedTaskTotal);
      }
    }
    
    await saveDataImmediate(data);
    
    const defeatEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('💀 DEFEAT')
      .setDescription(`${battle.player2Character.emoji} **${battle.player2Character.name}** (AI) defeated ${battle.player1Character.emoji} **${battle.player1Character.name}**!\n\nBetter luck next time!`)
      .addFields(
        { name: `Your ${battle.player1Character.emoji} ${battle.player1Character.name}`, value: `HP: 0/${battle.player1MaxHP}`, inline: true },
        { name: `AI ${battle.player2Character.emoji} ${battle.player2Character.name}`, value: `HP: ${battle.player2HP}/${battle.player2MaxHP}`, inline: true }
      );
    
    await channel.send({ embeds: [defeatEmbed] });
  }
  
  aiActiveBattles.delete(battle.player1);
}

function createHPBar(current, max) {
  const percentage = (current / max) * 100;
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  
  let color = '🟩';
  if (percentage < 30) color = '🟥';
  else if (percentage < 60) color = '🟨';
  
  return `[${color.repeat(filled)}${'⬛'.repeat(empty)}]`;
}

module.exports = {
  startAIBattle,
  createAIOpponent,
  makeAIDecision
};
