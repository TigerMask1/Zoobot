const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveData, saveDataImmediate } = require('./dataManager.js');
const { calculateBaseHP, calculateDamage, calculateEnergyCost, calculateCriticalHit, getMoveDisplay } = require('./battleUtils.js');
const { getCharacterAbility } = require('./characterAbilities.js');
const { MOVE_EFFECTS, applyEffect, processEffects, hasEffect, getEffectsDisplay, clearAllEffects } = require('./moveEffects.js');
const { getUserBattleItems, useItem } = require('./itemsSystem.js');
const eventSystem = require('./eventSystem.js');
const { checkTaskProgress, completePersonalizedTask, initializePersonalizedTaskData } = require('./personalizedTaskSystem.js');
const { trackChallengeProgress } = require('./weeklyChallengeSystem.js');
const { checkAchievements } = require('./achievementSystem.js');
const { recordEvent } = require('./analyticsSystem.js');
const { updateTaskProgress } = require('./seasonSystem.js');
const { addAura } = require('./serverAuraSystem.js');

const activeBattles = new Map();
const battleInvites = new Map();

const STARTING_ENERGY = 50;
const ENERGY_PER_TURN = 10;
const MAX_ENERGY = 100;

async function initiateBattle(message, data, challengerId, opponentId) {
  if (battleInvites.has(challengerId)) {
    await message.reply('❌ You already have a pending battle invite!');
    return;
  }
  
  if (battleInvites.has(opponentId)) {
    await message.reply('❌ That user already has a pending battle invite!');
    return;
  }
  
  if (activeBattles.has(challengerId)) {
    await message.reply('❌ You are already in a battle!');
    return;
  }
  
  if (activeBattles.has(opponentId)) {
    await message.reply('❌ That user is already in a battle!');
    return;
  }
  
  if (!data.users[opponentId]) {
    await message.reply('❌ That user hasn\'t started yet!');
    return;
  }
  
  if (data.users[challengerId].characters.length === 0) {
    await message.reply('❌ You don\'t have any characters! Use `!start` and `!select` to get started.');
    return;
  }
  
  if (data.users[opponentId].characters.length === 0) {
    await message.reply('❌ That user doesn\'t have any characters yet!');
    return;
  }
  
  const inviteId = `${challengerId}-${opponentId}-${Date.now()}`;
  
  const invite = {
    id: inviteId,
    challenger: challengerId,
    opponent: opponentId,
    channel: message.channel,
    timeout: null
  };
  
  battleInvites.set(challengerId, invite);
  battleInvites.set(opponentId, invite);
  
  const acceptButton = new ButtonBuilder()
    .setCustomId(`battle_accept_${inviteId}`)
    .setLabel('Accept')
    .setStyle(ButtonStyle.Success);
  
  const declineButton = new ButtonBuilder()
    .setCustomId(`battle_decline_${inviteId}`)
    .setLabel('Decline')
    .setStyle(ButtonStyle.Danger);
  
  const row = new ActionRowBuilder().addComponents(acceptButton, declineButton);
  
  const inviteEmbed = new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('⚔️ BATTLE CHALLENGE!')
    .setDescription(`<@${challengerId}> challenges <@${opponentId}> to a battle!\n\n<@${opponentId}>, click Accept or Decline.\n\nInvite expires in 60 seconds.`);
  
  const inviteMessage = await message.channel.send({ embeds: [inviteEmbed], components: [row] });
  
  invite.message = inviteMessage;
  invite.timeout = setTimeout(() => {
    if (battleInvites.has(challengerId)) {
      expireBattleInvite(invite);
    }
  }, 60000);
  
  const filter = (interaction) => {
    return interaction.customId.startsWith('battle_') && 
           (interaction.user.id === challengerId || interaction.user.id === opponentId);
  };
  
  const collector = inviteMessage.createMessageComponentCollector({ filter, time: 60000 });
  
  collector.on('collect', async (interaction) => {
    if (interaction.customId === `battle_decline_${inviteId}`) {
      if (interaction.user.id !== opponentId) {
        await interaction.reply({ content: '❌ Only the challenged player can decline!', flags: 64 });
        return;
      }
      
      await interaction.update({ 
        embeds: [new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('⚔️ Battle Declined')
          .setDescription(`<@${opponentId}> declined the battle challenge.`)],
        components: []
      });
      
      clearTimeout(invite.timeout);
      battleInvites.delete(challengerId);
      battleInvites.delete(opponentId);
      collector.stop();
    } else if (interaction.customId === `battle_accept_${inviteId}`) {
      if (interaction.user.id !== opponentId) {
        await interaction.reply({ content: '❌ Only the challenged player can accept!', flags: 64 });
        return;
      }
      
      await interaction.update({ 
        embeds: [new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('⚔️ Battle Accepted!')
          .setDescription(`<@${opponentId}> accepted the challenge!\n\nBoth players, select your character!`)],
        components: []
      });
      
      clearTimeout(invite.timeout);
      battleInvites.delete(challengerId);
      battleInvites.delete(opponentId);
      collector.stop();
      
      await startCharacterSelection(message.channel, data, challengerId, opponentId);
    }
  });
}

async function expireBattleInvite(invite) {
  battleInvites.delete(invite.challenger);
  battleInvites.delete(invite.opponent);
  
  const expireEmbed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('⏱️ Battle Invite Expired')
    .setDescription('The battle invite has expired.');
  
  await invite.message.edit({ embeds: [expireEmbed], components: [] });
}

async function startCharacterSelection(channel, data, player1Id, player2Id) {
  const battle = {
    id: `battle-${player1Id}-${player2Id}-${Date.now()}`,
    player1: player1Id,
    player2: player2Id,
    player1Character: null,
    player2Character: null,
    player1HP: 0,
    player2HP: 0,
    player1MaxHP: 0,
    player2MaxHP: 0,
    player1Energy: STARTING_ENERGY,
    player2Energy: STARTING_ENERGY,
    player1Shield: 0,
    player2Shield: 0,
    player1Buffs: {},
    player2Buffs: {},
    player1Ability: null,
    player2Ability: null,
    player1AbilityState: {},
    player2AbilityState: {},
    currentTurn: null,
    channel: channel,
    timeout: null,
    started: false,
    effects: { player1: [], player2: [] },
    turnCount: 0
  };
  
  activeBattles.set(player1Id, battle);
  activeBattles.set(player2Id, battle);
  
  const player1Chars = data.users[player1Id].characters;
  const player2Chars = data.users[player2Id].characters;
  
  const p1SelectEmbed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('🎮 Select Your Character')
    .setDescription(`<@${player1Id}>, choose your character by typing its name:\n\n${player1Chars.map(c => `${c.emoji} **${c.name}** (Lvl ${c.level}, ST: ${c.st}%)`).join('\n')}`);
  
  const p2SelectEmbed = new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('🎮 Select Your Character')
    .setDescription(`<@${player2Id}>, choose your character by typing its name:\n\n${player2Chars.map(c => `${c.emoji} **${c.name}** (Lvl ${c.level}, ST: ${c.st}%)`).join('\n')}`);
  
  await channel.send({ embeds: [p1SelectEmbed] });
  await channel.send({ embeds: [p2SelectEmbed] });
  
  const filter = (m) => {
    return (m.author.id === player1Id || m.author.id === player2Id) && !m.content.startsWith('!');
  };
  
  const collector = channel.createMessageCollector({ filter, time: 120000 });
  
  collector.on('collect', async (m) => {
    const userId = m.author.id;
    const charName = m.content.toLowerCase().trim();
    
    const userChars = data.users[userId].characters;
    const selectedChar = userChars.find(c => c.name.toLowerCase() === charName);
    
    if (!selectedChar) {
      await m.reply('❌ You don\'t own that character! Try again.');
      return;
    }
    
    if (!selectedChar.moves || !selectedChar.baseHp) {
      await m.reply('❌ This character doesn\'t have moves assigned yet! Please contact an admin.');
      return;
    }
    
    const ability = getCharacterAbility(selectedChar.name);
    
    if (userId === player1Id && !battle.player1Character) {
      battle.player1Character = selectedChar;
      battle.player1HP = selectedChar.baseHp;
      battle.player1MaxHP = selectedChar.baseHp;
      battle.player1Ability = ability;
      
      if (ability && ability.effect.startingEnergyBonus) {
        battle.player1Energy += ability.effect.startingEnergyBonus;
      }
      if (ability && ability.effect.startWithMaxEnergy) {
        battle.player1Energy = MAX_ENERGY;
      }
      if (ability && ability.effect.startingShield) {
        battle.player1Shield = Math.round(selectedChar.baseHp * ability.effect.startingShield);
      }
      
      await m.reply(`✅ You selected **${selectedChar.name} ${selectedChar.emoji}**!${ability ? `\n${ability.emoji} **${ability.name}**: ${ability.description}` : ''}`);
    } else if (userId === player2Id && !battle.player2Character) {
      battle.player2Character = selectedChar;
      battle.player2HP = selectedChar.baseHp;
      battle.player2MaxHP = selectedChar.baseHp;
      battle.player2Ability = ability;
      
      if (ability && ability.effect.startingEnergyBonus) {
        battle.player2Energy += ability.effect.startingEnergyBonus;
      }
      if (ability && ability.effect.startWithMaxEnergy) {
        battle.player2Energy = MAX_ENERGY;
      }
      if (ability && ability.effect.startingShield) {
        battle.player2Shield = Math.round(selectedChar.baseHp * ability.effect.startingShield);
      }
      
      await m.reply(`✅ You selected **${selectedChar.name} ${selectedChar.emoji}**!${ability ? `\n${ability.emoji} **${ability.name}**: ${ability.description}` : ''}`);
    }
    
    if (battle.player1Character && battle.player2Character) {
      collector.stop();
      await startBattle(battle, channel, data);
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time' && (!battle.player1Character || !battle.player2Character)) {
      channel.send('⏱️ Character selection timed out! Battle cancelled.');
      activeBattles.delete(player1Id);
      activeBattles.delete(player2Id);
    }
  });
}

async function startBattle(battle, channel, data) {
  battle.started = true;
  battle.currentTurn = Math.random() < 0.5 ? battle.player1 : battle.player2;
  
  const ability1 = battle.player1Ability;
  const ability2 = battle.player2Ability;
  
  if (ability1 && ability1.effect.randomStartBuff) {
    const buffTypes = ['attack', 'defense', 'critical'];
    const randomBuff = buffTypes[Math.floor(Math.random() * buffTypes.length)];
    battle.player1Buffs[randomBuff] = { value: 1.2, duration: 4 };
  }
  
  if (ability2 && ability2.effect.randomStartBuff) {
    const buffTypes = ['attack', 'defense', 'critical'];
    const randomBuff = buffTypes[Math.floor(Math.random() * buffTypes.length)];
    battle.player2Buffs[randomBuff] = { value: 1.2, duration: 4 };
  }
  
  const battleStartEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('⚔️ BATTLE BEGINS!')
    .setDescription(`**${battle.player1Character.emoji} ${battle.player1Character.name}** vs **${battle.player2Character.emoji} ${battle.player2Character.name}**\n\n<@${battle.currentTurn}> goes first!`)
    .addFields(
      { 
        name: `${battle.player1Character.emoji} ${battle.player1Character.name}`, 
        value: `HP: ${battle.player1HP}/${battle.player1MaxHP}${battle.player1Shield > 0 ? ` 🛡️${battle.player1Shield}` : ''}\n⚡ Energy: ${battle.player1Energy}/${MAX_ENERGY}${battle.player1Ability ? `\n${battle.player1Ability.emoji} ${battle.player1Ability.name}` : ''}`, 
        inline: true 
      },
      { 
        name: `${battle.player2Character.emoji} ${battle.player2Character.name}`, 
        value: `HP: ${battle.player2HP}/${battle.player2MaxHP}${battle.player2Shield > 0 ? ` 🛡️${battle.player2Shield}` : ''}\n⚡ Energy: ${battle.player2Energy}/${MAX_ENERGY}${battle.player2Ability ? `\n${battle.player2Ability.emoji} ${battle.player2Ability.name}` : ''}`, 
        inline: true 
      }
    );
  
  await channel.send({ embeds: [battleStartEmbed] });
  
  battle.timeout = setTimeout(() => {
    if (activeBattles.has(battle.player1)) {
      endBattle(battle, channel, data, 'timeout');
    }
  }, 600000);
  
  await promptTurn(battle, channel, data);
}

function createEnergyBar(current, max) {
  const barLength = 10;
  const filledBars = Math.round((current / max) * barLength);
  const emptyBars = barLength - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars) + ` ${current}/${max}`;
}

function createHPBar(current, max) {
  const barLength = 10;
  const filledBars = Math.round((current / max) * barLength);
  const emptyBars = barLength - filledBars;
  const percentage = Math.round((current / max) * 100);
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars) + ` ${current}/${max} (${percentage}%)`;
}

async function promptTurn(battle, channel, data) {
  battle.turnCount++;
  
  const currentPlayer = battle.currentTurn;
  const isPlayer1 = currentPlayer === battle.player1;
  const currentChar = isPlayer1 ? battle.player1Character : battle.player2Character;
  const opponentChar = isPlayer1 ? battle.player2Character : battle.player1Character;
  
  let currentEnergy = isPlayer1 ? battle.player1Energy : battle.player2Energy;
  const currentAbility = isPlayer1 ? battle.player1Ability : battle.player2Ability;
  const currentAbilityState = isPlayer1 ? battle.player1AbilityState : battle.player2AbilityState;
  
  if (currentAbility && currentAbility.effect.healPerTurn) {
    const healAmount = Math.round((isPlayer1 ? battle.player1MaxHP : battle.player2MaxHP) * currentAbility.effect.healPerTurn);
    if (isPlayer1) {
      battle.player1HP = Math.min(battle.player1HP + healAmount, battle.player1MaxHP);
    } else {
      battle.player2HP = Math.min(battle.player2HP + healAmount, battle.player2MaxHP);
    }
    await channel.send(`${currentAbility.emoji} **${currentAbility.name}**: ${currentChar.emoji} ${currentChar.name} healed ${healAmount} HP!`);
  }
  
  if (currentAbility && currentAbility.effect.hpRegenPerTurn) {
    const healAmount = currentAbility.effect.hpRegenPerTurn;
    if (isPlayer1) {
      battle.player1HP = Math.min(battle.player1HP + healAmount, battle.player1MaxHP);
    } else {
      battle.player2HP = Math.min(battle.player2HP + healAmount, battle.player2MaxHP);
    }
    await channel.send(`${currentAbility.emoji} **${currentAbility.name}**: ${currentChar.emoji} ${currentChar.name} regenerated ${healAmount} HP!`);
  }
  
  if (currentAbility && currentAbility.effect.energyRegenPerTurn) {
    currentEnergy = Math.min(currentEnergy + currentAbility.effect.energyRegenPerTurn, MAX_ENERGY);
    if (isPlayer1) {
      battle.player1Energy = currentEnergy;
    } else {
      battle.player2Energy = currentEnergy;
    }
  }
  
  currentEnergy = Math.min(currentEnergy + ENERGY_PER_TURN, MAX_ENERGY);
  if (isPlayer1) {
    battle.player1Energy = currentEnergy;
  } else {
    battle.player2Energy = currentEnergy;
  }
  
  if (currentAbility && currentAbility.effect.energyRegenBonus) {
    const bonusEnergy = Math.round(ENERGY_PER_TURN * currentAbility.effect.energyRegenBonus);
    currentEnergy = Math.min(currentEnergy + bonusEnergy, MAX_ENERGY);
    if (isPlayer1) {
      battle.player1Energy = currentEnergy;
    } else {
      battle.player2Energy = currentEnergy;
    }
  }
  
  const effectsResult = processEffects(battle, currentPlayer);
  
  if (effectsResult.damage > 0) {
    if (isPlayer1) {
      battle.player1HP = Math.max(0, battle.player1HP - effectsResult.damage);
    } else {
      battle.player2HP = Math.max(0, battle.player2HP - effectsResult.damage);
    }
  }
  
  if (effectsResult.heal > 0) {
    if (isPlayer1) {
      battle.player1HP = Math.min(battle.player1HP + effectsResult.heal, battle.player1MaxHP);
    } else {
      battle.player2HP = Math.min(battle.player2HP + effectsResult.heal, battle.player2MaxHP);
    }
  }
  
  if (effectsResult.messages.length > 0) {
    await channel.send(`${currentChar.emoji} **${currentChar.name}**:\n${effectsResult.messages.join('\n')}`);
  }
  
  if ((isPlayer1 ? battle.player1HP : battle.player2HP) <= 0) {
    const winner = isPlayer1 ? battle.player2 : battle.player1;
    await endBattle(battle, channel, data, 'knockout', winner);
    return;
  }
  
  if (effectsResult.skipTurn) {
    await channel.send(`${currentChar.emoji} **${currentChar.name}** is frozen/stunned and skips this turn!`);
    battle.currentTurn = isPlayer1 ? battle.player2 : battle.player1;
    setTimeout(() => {
      if (activeBattles.has(battle.player1)) {
        promptTurn(battle, channel, data);
      }
    }, 2000);
    return;
  }
  
  const moves = currentChar.moves;
  const allMoves = [moves.special, ...moves.tierMoves];
  
  const moveButtons = [];
  for (let i = 0; i < allMoves.length; i++) {
    const move = allMoves[i];
    const isSpecial = i === 0;
    let energyCost = calculateEnergyCost(move, isSpecial);
    
    if (currentAbility && currentAbility.effect.energyCostReduction) {
      energyCost = Math.round(energyCost * (1 - currentAbility.effect.energyCostReduction));
    }
    if (currentAbility && currentAbility.effect.normalMoveCostReduction && !isSpecial) {
      energyCost = Math.round(energyCost * (1 - currentAbility.effect.normalMoveCostReduction));
    }
    
    const display = getMoveDisplay(move, currentChar.level, currentChar.st, isSpecial, energyCost);
    const canAfford = currentEnergy >= energyCost;
    
    moveButtons.push(
      new ButtonBuilder()
        .setCustomId(`move_${i}_${battle.id}`)
        .setLabel(`${display}`)
        .setStyle(isSpecial ? ButtonStyle.Danger : ButtonStyle.Primary)
        .setDisabled(!canAfford)
    );
  }
  
  const passButton = new ButtonBuilder()
    .setCustomId(`pass_${battle.id}`)
    .setLabel('Pass Turn')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏭️');
  
  const fleeButton = new ButtonBuilder()
    .setCustomId(`flee_${battle.id}`)
    .setLabel('Flee')
    .setStyle(ButtonStyle.Danger);
  
  const itemButton = new ButtonBuilder()
    .setCustomId(`items_${battle.id}`)
    .setLabel('Items')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🎒');
  
  const rows = [
    new ActionRowBuilder().addComponents(moveButtons.slice(0, 3)),
    new ActionRowBuilder().addComponents(passButton, itemButton, fleeButton)
  ];
  
  const effectsDisplay1 = getEffectsDisplay(battle, battle.player1);
  const effectsDisplay2 = getEffectsDisplay(battle, battle.player2);
  
  const { getSkinUrl } = require('./skinSystem.js');
  const player1Skin = battle.player1Character.skin || 'default';
  const player2Skin = battle.player2Character.skin || 'default';
  const currentCharSkin = isPlayer1 ? player1Skin : player2Skin;
  const currentCharSkinUrl = await getSkinUrl(currentChar.name, currentCharSkin);
  
  const turnEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle(`⚡ <@${currentPlayer}>'s Turn! (Turn ${battle.turnCount})`)
    .setDescription(`**Your Character:** ${currentChar.emoji} ${currentChar.name}${currentAbility ? `\n${currentAbility.emoji} **${currentAbility.name}**` : ''}\n\n**Choose your action:**`)
    .addFields(
      { 
        name: `${battle.player1Character.emoji} ${battle.player1Character.name}`, 
        value: `HP: ${createHPBar(battle.player1HP, battle.player1MaxHP)}${battle.player1Shield > 0 ? `\n🛡️ Shield: ${battle.player1Shield}` : ''}\n⚡ ${createEnergyBar(battle.player1Energy, MAX_ENERGY)}${effectsDisplay1 ? `\n${effectsDisplay1}` : ''}`, 
        inline: false 
      },
      { 
        name: `${battle.player2Character.emoji} ${battle.player2Character.name}`, 
        value: `HP: ${createHPBar(battle.player2HP, battle.player2MaxHP)}${battle.player2Shield > 0 ? `\n🛡️ Shield: ${battle.player2Shield}` : ''}\n⚡ ${createEnergyBar(battle.player2Energy, MAX_ENERGY)}${effectsDisplay2 ? `\n${effectsDisplay2}` : ''}`, 
        inline: false 
      }
    );
  
  if (currentCharSkinUrl) {
    turnEmbed.setThumbnail(currentCharSkinUrl);
  }
  
  const turnMessage = await channel.send({ embeds: [turnEmbed], components: rows });
  
  const filter = (interaction) => {
    return interaction.user.id === currentPlayer && 
           (interaction.customId.endsWith(battle.id));
  };
  
  const collector = turnMessage.createMessageComponentCollector({ filter, max: 1, time: 60000 });
  
  collector.on('collect', async (interaction) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
      
      if (interaction.customId === `pass_${battle.id}`) {
        await interaction.editReply({ content: `⏭️ ${currentChar.emoji} ${currentChar.name} passed their turn!`, embeds: [], components: [] }).catch(async () => {
          await interaction.update({ content: `⏭️ ${currentChar.emoji} ${currentChar.name} passed their turn!`, embeds: [], components: [] });
        });
        battle.currentTurn = isPlayer1 ? battle.player2 : battle.player1;
        setTimeout(() => {
          if (activeBattles.has(battle.player1)) {
            promptTurn(battle, channel, data);
          }
        }, 1500);
        return;
      } else if (interaction.customId === `flee_${battle.id}`) {
        const winner = isPlayer1 ? battle.player2 : battle.player1;
        await interaction.editReply({ content: `💨 ${currentChar.emoji} ${currentChar.name} fled from battle!`, embeds: [], components: [] }).catch(async () => {
          await interaction.update({ content: `💨 ${currentChar.emoji} ${currentChar.name} fled from battle!`, embeds: [], components: [] });
        });
        await endBattle(battle, channel, data, 'flee', winner);
        return;
      } else if (interaction.customId === `items_${battle.id}`) {
        await showItemMenu(interaction, battle, data, isPlayer1);
        return;
      } else if (interaction.customId.startsWith('move_')) {
        const moveIndex = parseInt(interaction.customId.split('_')[1]);
        await executeMove(interaction, battle, channel, data, moveIndex, isPlayer1);
      }
    } catch (error) {
      console.error('Battle interaction error:', error);
      try {
        if (!interaction.replied) {
          await interaction.followUp({ content: '❌ An error occurred. Continuing battle...', flags: 64 });
        }
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time' && activeBattles.has(battle.player1)) {
      channel.send(`⏱️ <@${currentPlayer}> took too long! Battle ended.`);
      const winner = isPlayer1 ? battle.player2 : battle.player1;
      endBattle(battle, channel, data, 'timeout', winner);
    }
  });
}

async function showItemMenu(interaction, battle, data, isPlayer1) {
  const userId = isPlayer1 ? battle.player1 : battle.player2;
  const user = data.users[userId];
  const items = getUserBattleItems(user);
  
  if (items.length === 0) {
    await interaction.editReply({ content: '❌ You don\'t have any battle items! Visit the shop with `!shop`.', embeds: [], components: [] }).catch(async () => {
      await interaction.followUp({ content: '❌ You don\'t have any battle items! Visit the shop with `!shop`.', flags: 64 });
    });
    setTimeout(() => {
      if (activeBattles.has(battle.player1)) {
        promptTurn(battle, battle.channel, data);
      }
    }, 2000);
    return;
  }
  
  const itemButtons = items.slice(0, 5).map(item => 
    new ButtonBuilder()
      .setCustomId(`use_item_${item.id}_${battle.id}`)
      .setLabel(`${item.emoji} ${item.name} (${item.count})`)
      .setStyle(ButtonStyle.Success)
  );
  
  const backButton = new ButtonBuilder()
    .setCustomId(`back_to_battle_${battle.id}`)
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);
  
  const rows = [];
  if (itemButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(itemButtons.slice(0, Math.min(5, itemButtons.length))));
  }
  rows.push(new ActionRowBuilder().addComponents(backButton));
  
  const itemEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎒 Battle Items')
    .setDescription(items.map(i => `${i.emoji} **${i.name}** x${i.count}\n${i.description}`).join('\n\n'))
    .setFooter({ text: 'Select an item to use' });
  
  await interaction.editReply({ embeds: [itemEmbed], components: rows }).catch(async () => {
    await interaction.update({ embeds: [itemEmbed], components: rows });
  });
  
  const filter = (i) => i.user.id === userId && i.customId.endsWith(battle.id);
  const collector = interaction.message.createMessageComponentCollector({ filter, max: 1, time: 30000 });
  
  collector.on('collect', async (i) => {
    try {
      if (!i.deferred && !i.replied) {
        await i.deferUpdate().catch(() => {});
      }
      
      if (i.customId === `back_to_battle_${battle.id}`) {
        await i.editReply({ content: 'Returning to battle...', embeds: [], components: [] }).catch(async () => {
          await i.update({ content: 'Returning to battle...', embeds: [], components: [] });
        });
        setTimeout(() => {
          if (activeBattles.has(battle.player1)) {
            promptTurn(battle, battle.channel, data);
          }
        }, 1000);
      } else if (i.customId.startsWith('use_item_')) {
        const itemId = i.customId.split('_')[2];
        await useItemInBattle(i, battle, data, itemId, isPlayer1);
      }
    } catch (error) {
      console.error('Item menu error:', error);
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0 && activeBattles.has(battle.player1)) {
      battle.channel.send('⏱️ Item selection timed out, returning to battle...');
      promptTurn(battle, battle.channel, data);
    }
  });
}

async function useItemInBattle(interaction, battle, data, itemId, isPlayer1) {
  const userId = isPlayer1 ? battle.player1 : battle.player2;
  const user = data.users[userId];
  const char = isPlayer1 ? battle.player1Character : battle.player2Character;
  
  const result = useItem(user, itemId);
  
  if (!result.success) {
    await interaction.editReply({ content: `❌ ${result.message}`, embeds: [], components: [] }).catch(async () => {
      await interaction.update({ content: `❌ ${result.message}`, embeds: [], components: [] });
    });
    setTimeout(() => {
      if (activeBattles.has(battle.player1)) {
        promptTurn(battle, battle.channel, data);
      }
    }, 2000);
    return;
  }
  
  const effect = result.effect;
  let message = `${result.item.emoji} ${char.emoji} **${char.name}** used **${result.item.name}**!\n\n`;
  
  if (effect.type === 'heal') {
    const currentHP = isPlayer1 ? battle.player1HP : battle.player2HP;
    const maxHP = isPlayer1 ? battle.player1MaxHP : battle.player2MaxHP;
    const healAmount = Math.min(effect.value, maxHP - currentHP);
    
    if (isPlayer1) {
      battle.player1HP = Math.min(battle.player1HP + healAmount, battle.player1MaxHP);
    } else {
      battle.player2HP = Math.min(battle.player2HP + healAmount, battle.player2MaxHP);
    }
    
    message += `💚 Restored ${healAmount} HP!`;
  } else if (effect.type === 'energy') {
    const currentEnergy = isPlayer1 ? battle.player1Energy : battle.player2Energy;
    const energyGain = Math.min(effect.value, MAX_ENERGY - currentEnergy);
    
    if (isPlayer1) {
      battle.player1Energy = Math.min(battle.player1Energy + energyGain, MAX_ENERGY);
    } else {
      battle.player2Energy = Math.min(battle.player2Energy + energyGain, MAX_ENERGY);
    }
    
    message += `⚡ Restored ${energyGain} energy!`;
  } else if (effect.type === 'buff') {
    const buffs = isPlayer1 ? battle.player1Buffs : battle.player2Buffs;
    buffs[effect.stat] = { value: effect.value, duration: effect.duration };
    if (isPlayer1) {
      battle.player1Buffs = buffs;
    } else {
      battle.player2Buffs = buffs;
    }
    message += `✨ ${effect.stat.toUpperCase()} boosted for ${effect.duration} turns!`;
  } else if (effect.type === 'cleanse') {
    clearAllEffects(battle, userId);
    message += `✨ All negative effects removed!`;
  }
  
  await saveDataImmediate(data);
  
  await interaction.editReply({ content: message, embeds: [], components: [] }).catch(async () => {
    await interaction.update({ content: message, embeds: [], components: [] });
  });
  
  setTimeout(() => {
    if (activeBattles.has(battle.player1)) {
      promptTurn(battle, battle.channel, data);
    }
  }, 2000);
}

async function executeMove(interaction, battle, channel, data, moveIndex, isPlayer1) {
  const currentChar = isPlayer1 ? battle.player1Character : battle.player2Character;
  const opponentChar = isPlayer1 ? battle.player2Character : battle.player1Character;
  const currentAbility = isPlayer1 ? battle.player1Ability : battle.player2Ability;
  const currentAbilityState = isPlayer1 ? battle.player1AbilityState : battle.player2AbilityState;
  
  const moves = currentChar.moves;
  const allMoves = [moves.special, ...moves.tierMoves];
  const selectedMove = allMoves[moveIndex];
  const isSpecial = moveIndex === 0;
  
  let energyCost = calculateEnergyCost(selectedMove, isSpecial);
  
  if (currentAbility && currentAbility.effect.energyCostReduction) {
    energyCost = Math.round(energyCost * (1 - currentAbility.effect.energyCostReduction));
  }
  if (currentAbility && currentAbility.effect.normalMoveCostReduction && !isSpecial) {
    energyCost = Math.round(energyCost * (1 - currentAbility.effect.normalMoveCostReduction));
  }
  
  const currentEnergy = isPlayer1 ? battle.player1Energy : battle.player2Energy;
  
  if (currentEnergy < energyCost) {
    await interaction.editReply({ content: '❌ Not enough energy! Try a different move or use an energy item.', embeds: [], components: [] }).catch(async () => {
      await interaction.update({ content: '❌ Not enough energy! Try a different move or use an energy item.', embeds: [], components: [] });
    });
    setTimeout(() => {
      if (activeBattles.has(battle.player1)) {
        promptTurn(battle, channel, data);
      }
    }, 2000);
    return;
  }
  
  if (isPlayer1) {
    battle.player1Energy -= energyCost;
  } else {
    battle.player2Energy -= energyCost;
  }
  
  if (currentAbility && currentAbility.effect.specialEnergyRefund && isSpecial) {
    const refund = Math.round(energyCost * currentAbility.effect.specialEnergyRefund);
    if (isPlayer1) {
      battle.player1Energy = Math.min(battle.player1Energy + refund, MAX_ENERGY);
    } else {
      battle.player2Energy = Math.min(battle.player2Energy + refund, MAX_ENERGY);
    }
  }
  
  let baseDamage = calculateDamage(selectedMove, currentChar.level, currentChar.st, isSpecial);
  
  if (baseDamage > 0) {
    let critChance = 0.15;
    
    if (currentAbility && currentAbility.effect.criticalChanceBonus) {
      critChance += currentAbility.effect.criticalChanceBonus;
    }
    
    const buffs = isPlayer1 ? battle.player1Buffs : battle.player2Buffs;
    if (buffs.critical) {
      critChance += buffs.critical.value / 100;
    }
    
    const opponentAbility = isPlayer1 ? battle.player2Ability : battle.player1Ability;
    if (opponentAbility && opponentAbility.effect.opponentCritReduction) {
      critChance = Math.max(0, critChance - opponentAbility.effect.opponentCritReduction);
    }
    
    const critResult = calculateCriticalHit(baseDamage, critChance);
    baseDamage = critResult.damage;
    const isCritical = critResult.isCritical;
    
    if (isCritical && currentAbility && currentAbility.effect.criticalDamageBonus) {
      baseDamage = Math.round(baseDamage * (1 + currentAbility.effect.criticalDamageBonus));
    }
    
    if (isCritical && currentAbility && currentAbility.effect.criticalEnergyGain) {
      if (isPlayer1) {
        battle.player1Energy = Math.min(battle.player1Energy + currentAbility.effect.criticalEnergyGain, MAX_ENERGY);
      } else {
        battle.player2Energy = Math.min(battle.player2Energy + currentAbility.effect.criticalEnergyGain, MAX_ENERGY);
      }
    }
    
    if (currentAbility && currentAbility.effect.firstAttackBonus && !currentAbilityState.firstAttackUsed) {
      baseDamage = Math.round(baseDamage * (1 + currentAbility.effect.firstAttackBonus));
      currentAbilityState.firstAttackUsed = true;
    }
    
    if (currentAbility && currentAbility.effect.specialDamageBonus && isSpecial) {
      baseDamage = Math.round(baseDamage * (1 + currentAbility.effect.specialDamageBonus));
    }
    
    if (currentAbility && currentAbility.effect.flatDamageBonus) {
      baseDamage += currentAbility.effect.flatDamageBonus;
    }
    
    if (buffs.attack) {
      baseDamage = Math.round(baseDamage * buffs.attack.value);
    }
    
    const opponentBuffs = isPlayer1 ? battle.player2Buffs : battle.player1Buffs;
    if (opponentBuffs.defense) {
      baseDamage = Math.round(baseDamage * opponentBuffs.defense.value);
    }
    
    const currentHP = isPlayer1 ? battle.player1HP : battle.player2HP;
    const currentMaxHP = isPlayer1 ? battle.player1MaxHP : battle.player2MaxHP;
    const currentHPPercent = currentHP / currentMaxHP;
    
    if (currentAbility && currentAbility.effect.highHpDamageBonus && currentHPPercent >= (currentAbility.effect.hpThreshold || 0.7)) {
      baseDamage = Math.round(baseDamage * (1 + currentAbility.effect.highHpDamageBonus));
    }
    
    if (currentAbility && currentAbility.effect.lowHpSelfDamageBonus && currentHPPercent <= 0.3) {
      baseDamage = Math.round(baseDamage * (1 + currentAbility.effect.lowHpSelfDamageBonus));
    }
    
    if (opponentAbility && opponentAbility.effect.damageReduction) {
      baseDamage = Math.round(baseDamage * (1 - opponentAbility.effect.damageReduction));
    }
    
    const opponentHP = isPlayer1 ? battle.player2HP : battle.player1HP;
    const opponentMaxHP = isPlayer1 ? battle.player2MaxHP : battle.player1MaxHP;
    let opponentShield = isPlayer1 ? battle.player2Shield : battle.player1Shield;
    
    if (opponentAbility && opponentAbility.effect.dodgeChance && Math.random() < opponentAbility.effect.dodgeChance) {
      baseDamage = 0;
      await channel.send(`${opponentAbility.emoji} **${opponentAbility.name}**: ${opponentChar.emoji} ${opponentChar.name} dodged the attack!`);
    }
    
    if (opponentAbility && opponentAbility.effect.firstHitReduction && !((isPlayer1 ? battle.player2AbilityState : battle.player1AbilityState).firstHitTaken)) {
      baseDamage = Math.round(baseDamage * (1 - opponentAbility.effect.firstHitReduction));
      if (isPlayer1) {
        battle.player2AbilityState.firstHitTaken = true;
      } else {
        battle.player1AbilityState.firstHitTaken = true;
      }
    }
    
    if (opponentAbility && opponentAbility.effect.damageBlock && opponentShield === 0) {
      const blockRemaining = opponentAbility.effect.damageBlock - ((isPlayer1 ? battle.player2AbilityState : battle.player1AbilityState).damageBlocked || 0);
      if (blockRemaining > 0) {
        const blocked = Math.min(baseDamage, blockRemaining);
        baseDamage = Math.max(0, baseDamage - blocked);
        if (isPlayer1) {
          battle.player2AbilityState.damageBlocked = (battle.player2AbilityState.damageBlocked || 0) + blocked;
        } else {
          battle.player1AbilityState.damageBlocked = (battle.player1AbilityState.damageBlocked || 0) + blocked;
        }
      }
    }
    
    let finalDamage = baseDamage;
    if (opponentShield > 0) {
      const shieldDamage = Math.min(opponentShield, finalDamage);
      opponentShield -= shieldDamage;
      finalDamage -= shieldDamage;
      
      if (isPlayer1) {
        battle.player2Shield = opponentShield;
      } else {
        battle.player1Shield = opponentShield;
      }
    }
    
    if (isPlayer1) {
      battle.player2HP = Math.max(0, battle.player2HP - finalDamage);
    } else {
      battle.player1HP = Math.max(0, battle.player1HP - finalDamage);
    }
    
    if (currentAbility && currentAbility.effect.lifesteal) {
      const lifeStealAmount = Math.round(finalDamage * currentAbility.effect.lifesteal);
      if (isPlayer1) {
        battle.player1HP = Math.min(battle.player1HP + lifeStealAmount, battle.player1MaxHP);
      } else {
        battle.player2HP = Math.min(battle.player2HP + lifeStealAmount, battle.player2MaxHP);
      }
    }
    
    if (currentAbility && currentAbility.effect.energySteal) {
      const energyStolen = currentAbility.effect.energySteal;
      if (isPlayer1) {
        battle.player1Energy = Math.min(battle.player1Energy + energyStolen, MAX_ENERGY);
        battle.player2Energy = Math.max(0, battle.player2Energy - energyStolen);
      } else {
        battle.player2Energy = Math.min(battle.player2Energy + energyStolen, MAX_ENERGY);
        battle.player1Energy = Math.max(0, battle.player1Energy - energyStolen);
      }
    }
    
    if (currentAbility && currentAbility.effect.damageToEnergy) {
      const energyGained = Math.floor(finalDamage / 10);
      if (isPlayer1) {
        battle.player1Energy = Math.min(battle.player1Energy + energyGained, MAX_ENERGY);
      } else {
        battle.player2Energy = Math.min(battle.player2Energy + energyGained, MAX_ENERGY);
      }
    }
    
    if (currentAbility && currentAbility.effect.burnChance && Math.random() < currentAbility.effect.burnChance) {
      applyEffect(battle, isPlayer1 ? battle.player2 : battle.player1, MOVE_EFFECTS.BURN, 3);
    }
    
    if (currentAbility && currentAbility.effect.paralyzeChance && Math.random() < currentAbility.effect.paralyzeChance) {
      applyEffect(battle, isPlayer1 ? battle.player2 : battle.player1, MOVE_EFFECTS.PARALYZE, 1);
    }
    
    if (currentAbility && currentAbility.effect.freezeChance && Math.random() < currentAbility.effect.freezeChance) {
      applyEffect(battle, isPlayer1 ? battle.player2 : battle.player1, MOVE_EFFECTS.FREEZE, 1);
    }
    
    let abilityEffects = '';
    if (currentAbility && currentAbility.effect.lifesteal) {
      abilityEffects += `\n💉 Lifesteal: Gained ${Math.round(finalDamage * currentAbility.effect.lifesteal)} HP!`;
    }
    if (currentAbility && currentAbility.effect.energySteal) {
      abilityEffects += `\n⚡ Energy Steal: +${currentAbility.effect.energySteal} energy!`;
    }
    if (currentAbility && currentAbility.effect.damageToEnergy) {
      abilityEffects += `\n⚡ Gained ${Math.floor(finalDamage / 10)} energy from damage!`;
    }
    
    const attackEmbed = new EmbedBuilder()
      .setColor(isCritical ? '#FF0000' : '#FFA500')
      .setTitle(isCritical ? '💥 CRITICAL HIT!' : '⚔️ Attack!')
      .setDescription(`${currentChar.emoji} **${currentChar.name}** used **${selectedMove.name}**!\n\nDealt ${finalDamage} damage to ${opponentChar.emoji} **${opponentChar.name}**!${isCritical ? ' ⭐' : ''}${abilityEffects}`)
      .setFooter({ text: `Energy used: ${energyCost}⚡` });
    
    await interaction.editReply({ embeds: [], components: [] }).catch(() => {});
    await channel.send({ embeds: [attackEmbed] });
  } else if (baseDamage < 0) {
    const healAmount = Math.abs(baseDamage);
    const currentHP = isPlayer1 ? battle.player1HP : battle.player2HP;
    const maxHP = isPlayer1 ? battle.player1MaxHP : battle.player2MaxHP;
    const actualHeal = Math.min(healAmount, maxHP - currentHP);
    
    let bonusHeal = 0;
    if (currentAbility && currentAbility.effect.healingBonus) {
      bonusHeal = Math.round(actualHeal * currentAbility.effect.healingBonus);
      if (isPlayer1) {
        battle.player1HP = Math.min(battle.player1HP + actualHeal + bonusHeal, battle.player1MaxHP);
      } else {
        battle.player2HP = Math.min(battle.player2HP + actualHeal + bonusHeal, battle.player2MaxHP);
      }
    } else {
      if (isPlayer1) {
        battle.player1HP = Math.min(battle.player1HP + actualHeal, battle.player1MaxHP);
      } else {
        battle.player2HP = Math.min(battle.player2HP + actualHeal, battle.player2MaxHP);
      }
    }
    
    let energyBonus = 0;
    if (currentAbility && currentAbility.effect.healToEnergy) {
      energyBonus = currentAbility.effect.healToEnergy;
      if (isPlayer1) {
        battle.player1Energy = Math.min(battle.player1Energy + energyBonus, MAX_ENERGY);
      } else {
        battle.player2Energy = Math.min(battle.player2Energy + energyBonus, MAX_ENERGY);
      }
    }
    
    if (currentAbility && currentAbility.effect.healRestoresEnergy) {
      energyBonus += currentAbility.effect.healRestoresEnergy;
      if (isPlayer1) {
        battle.player1Energy = Math.min(battle.player1Energy + currentAbility.effect.healRestoresEnergy, MAX_ENERGY);
      } else {
        battle.player2Energy = Math.min(battle.player2Energy + currentAbility.effect.healRestoresEnergy, MAX_ENERGY);
      }
    }
    
    const healEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('💚 Heal!')
      .setDescription(`${currentChar.emoji} **${currentChar.name}** used **${selectedMove.name}**!\n\nRestored ${actualHeal}${bonusHeal > 0 ? ` + ${bonusHeal} (bonus)` : ''} HP!${energyBonus > 0 ? `\n⚡ Gained ${energyBonus} energy!` : ''}`)
      .setFooter({ text: `Energy used: ${energyCost}⚡` });
    
    await interaction.editReply({ embeds: [], components: [] }).catch(() => {});
    await channel.send({ embeds: [healEmbed] });
  } else {
    const buffEmbed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle('✨ Support Move!')
      .setDescription(`${currentChar.emoji} **${currentChar.name}** used **${selectedMove.name}**!`)
      .setFooter({ text: `Energy used: ${energyCost}⚡` });
    
    await interaction.editReply({ embeds: [], components: [] }).catch(() => {});
    await channel.send({ embeds: [buffEmbed] });
  }
  
  if ((isPlayer1 ? battle.player2HP : battle.player1HP) <= 0) {
    const winner = isPlayer1 ? battle.player1 : battle.player2;
    await endBattle(battle, channel, data, 'knockout', winner);
    return;
  }
  
  battle.currentTurn = isPlayer1 ? battle.player2 : battle.player1;
  
  setTimeout(() => {
    if (activeBattles.has(battle.player1)) {
      promptTurn(battle, channel, data);
    }
  }, 3000);
}

async function endBattle(battle, channel, data, reason, winner = null) {
  clearTimeout(battle.timeout);
  activeBattles.delete(battle.player1);
  activeBattles.delete(battle.player2);
  
  if (reason === 'timeout') {
    const timeoutEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⏱️ Battle Timeout')
      .setDescription('The battle has ended due to inactivity.');
    
    await channel.send({ embeds: [timeoutEmbed] });
  } else if (reason === 'flee' || reason === 'knockout') {
    const loser = winner === battle.player1 ? battle.player2 : battle.player1;
    
    data.users[winner].trophies = Math.min(9999, (data.users[winner].trophies || 200) + 5);
    data.users[loser].trophies = Math.max(0, (data.users[loser].trophies || 200) - 7);
    
    if (!data.users[winner].questProgress) data.users[winner].questProgress = {};
    data.users[winner].questProgress.battlesWon = (data.users[winner].questProgress.battlesWon || 0) + 1;
    data.users[winner].questProgress.totalBattles = (data.users[winner].questProgress.totalBattles || 0) + 1;
    data.users[winner].lastActivity = Date.now();
    
    trackChallengeProgress(data.users[winner], 'battlesWon', 1);
    checkAchievements(data.users[winner]);
    updateTaskProgress(data.users[winner], 'battlesWon', 1);
    updateTaskProgress(data.users[winner], 'battlesParticipated', 1);
    updateTaskProgress(data.users[loser], 'battlesParticipated', 1);
    
    if (channel.guild) {
      recordEvent(data, channel.guild.id, 'battlesPlayed', 1, winner);
      addAura(channel.guild.id, 8, 'battle_win').catch(e => console.error('Error adding battle win aura:', e));
      addAura(channel.guild.id, 3, 'battle_loss').catch(e => console.error('Error adding battle loss aura:', e));
    }
    
    const ptDataWinner = initializePersonalizedTaskData(data.users[winner]);
    if (ptDataWinner.taskProgress.battlesWon !== undefined) {
      const completedTask = checkTaskProgress(data.users[winner], 'battlesWon', 1);
      if (completedTask) {
        const client = channel.client;
        await completePersonalizedTask(client, winner, data, completedTask);
      }
    }
    if (ptDataWinner.taskProgress.userBattles !== undefined) {
      const completedTaskUser = checkTaskProgress(data.users[winner], 'userBattles', 1);
      if (completedTaskUser) {
        const client = channel.client;
        await completePersonalizedTask(client, winner, data, completedTaskUser);
      }
    }
    
    data.users[winner].questProgress.currentWinStreak = (data.users[winner].questProgress.currentWinStreak || 0) + 1;
    data.users[winner].questProgress.maxWinStreak = Math.max(
      data.users[winner].questProgress.maxWinStreak || 0,
      data.users[winner].questProgress.currentWinStreak
    );
    
    // Track win streak for season daily tasks
    updateTaskProgress(data.users[winner], 'winStreak', data.users[winner].questProgress.currentWinStreak);
    
    const winnerChar = winner === battle.player1 ? battle.player1Character : battle.player2Character;
    if (winnerChar.level >= 30) {
      data.users[winner].questProgress.highLevelWin = 1;
    }
    
    if (!data.users[loser].questProgress) data.users[loser].questProgress = {};
    data.users[loser].questProgress.totalBattles = (data.users[loser].questProgress.totalBattles || 0) + 1;
    data.users[loser].questProgress.currentWinStreak = 0;
    data.users[loser].lastActivity = Date.now();
    
    const ptDataLoser = initializePersonalizedTaskData(data.users[loser]);
    if (ptDataLoser.taskProgress.userBattles !== undefined) {
      const completedTaskLoser = checkTaskProgress(data.users[loser], 'userBattles', 1);
      if (completedTaskLoser) {
        const client = channel.client;
        await completePersonalizedTask(client, loser, data, completedTaskLoser);
      }
    }
    
    await eventSystem.recordProgress(winner, data.users[winner].username, 5, 'trophy_hunt');
    
    await saveDataImmediate(data);
    
    if (reason === 'flee') {
      const fleeEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Victory by Forfeit!')
        .setDescription(`<@${winner}> wins the battle!\n\n**Trophy Changes:**\n🏆 <@${winner}>: +5 (${data.users[winner].trophies})\n🏆 <@${loser}>: -7 (${data.users[loser].trophies})`);
      
      await channel.send({ embeds: [fleeEmbed] });
    } else {
      const winnerChar = winner === battle.player1 ? battle.player1Character : battle.player2Character;
      const loserChar = winner === battle.player1 ? battle.player2Character : battle.player1Character;
      
      const victoryEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 VICTORY!')
        .setDescription(`${winnerChar.emoji} **${winnerChar.name}** defeated ${loserChar.emoji} **${loserChar.name}**!\n\n<@${winner}> wins the battle!\n\n**Trophy Changes:**\n🏆 <@${winner}>: +5 (${data.users[winner].trophies})\n🏆 <@${loser}>: -7 (${data.users[loser].trophies})`)
        .addFields(
          { name: `${battle.player1Character.emoji} ${battle.player1Character.name}`, value: `HP: ${battle.player1HP}/${battle.player1MaxHP}`, inline: true },
          { name: `${battle.player2Character.emoji} ${battle.player2Character.name}`, value: `HP: ${battle.player2HP}/${battle.player2MaxHP}`, inline: true }
        );
      
      await channel.send({ embeds: [victoryEmbed] });
    }
  }
}

module.exports = {
  initiateBattle
};
