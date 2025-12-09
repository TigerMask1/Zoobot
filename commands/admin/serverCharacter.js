const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { canSetupServer, isServerOwner, getServerConfig, saveServerConfig } = require('../../serverConfigManager.js');
const characterManager = require('../../characterManager.js');
const crypto = require('crypto');

function generateUniqueId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

const VALID_EFFECT_TYPES = [
  'criticalDamageBonus', 'energyCostReduction', 'startingShield', 'firstAttackBonus',
  'healPerTurn', 'healingBonus', 'damageReduction', 'dodgeChance', 'startingEnergyBonus',
  'burnChance', 'criticalChanceBonus', 'highHpDamageBonus', 'lifesteal', 'defenseBonus',
  'flatDamageBonus', 'doubleAttackChance', 'extraTurnChance', 'freezeChance',
  'opponentCritReduction', 'healToEnergy', 'statusImmunity', 'energyRegenPerTurn',
  'paralyzeChance', 'healRestoresEnergy', 'lowHpDamageBonus', 'stackingDefense',
  'specialEnergyRefund', 'energySteal', 'defenseIgnore', 'specialDamageBonus',
  'lowHpSelfDamageBonus', 'hpRegenPerTurn', 'firstHitReduction', 'energyRegenBonus',
  'allHealingBonus', 'burnDamageChance', 'startWithMaxEnergy', 'debuffDurationReduction',
  'normalMoveCostReduction', 'criticalEnergyGain', 'immovable', 'opponentMissChance',
  'damagePerBuff', 'damageBlock', 'emergencyHeal', 'stackingDamage', 'randomStartBuff',
  'damageToEnergy', 'autoCleansePerTurn', 'opponentEndTurnDamage', 'highHpDefenseBonus'
];

const EFFECT_DESCRIPTIONS = {
  'criticalDamageBonus': 'Critical hits deal X% more damage (e.g., 0.5 = 50%)',
  'energyCostReduction': 'All moves cost X% less energy (e.g., 0.2 = 20%)',
  'startingShield': 'Gain X% max HP as shield at battle start (e.g., 0.1 = 10%)',
  'firstAttackBonus': 'First attack deals X% bonus damage (e.g., 1.0 = 100%)',
  'healPerTurn': 'Heal X% max HP every turn (e.g., 0.05 = 5%)',
  'healingBonus': 'Healing moves restore X% more HP (e.g., 0.3 = 30%)',
  'damageReduction': 'Take X% reduced damage (e.g., 0.15 = 15%)',
  'dodgeChance': 'X% chance to dodge attacks (e.g., 0.15 = 15%)',
  'startingEnergyBonus': 'Start battle with +X energy (e.g., 20)',
  'burnChance': 'X% chance to burn opponent (e.g., 0.25 = 25%)',
  'criticalChanceBonus': '+X% critical hit chance (e.g., 0.15 = 15%)',
  'highHpDamageBonus': 'Deal X% more damage when HP is above 70% (e.g., 0.1 = 10%)',
  'lifesteal': 'Lifesteal X% of damage dealt (e.g., 0.15 = 15%)',
  'defenseBonus': '+X% defense bonus (e.g., 0.1 = 10%)',
  'flatDamageBonus': 'Deal +X flat damage on all attacks (e.g., 5)',
  'doubleAttackChance': 'X% chance to attack twice (e.g., 0.3 = 30%)',
  'extraTurnChance': 'X% chance to get an extra turn (e.g., 0.2 = 20%)',
  'freezeChance': 'X% chance to freeze opponent (e.g., 0.2 = 20%)',
  'energyRegenPerTurn': 'Regenerate +X energy per turn (e.g., 3)',
  'paralyzeChance': 'X% chance to paralyze opponent (e.g., 0.2 = 20%)',
  'hpRegenPerTurn': 'Restore +X HP every turn (e.g., 3)',
  'specialDamageBonus': 'Deal X% more damage with special move (e.g., 0.15 = 15%)',
  'opponentEndTurnDamage': 'Opponent takes X damage at end of their turn (e.g., 3)'
};

const pendingCreations = new Map();

module.exports = {
  name: 'servercharacter',
  aliases: ['sc', 'createchar', 'addchar', 'mychar'],
  category: 'admin',
  description: 'Create and manage server-specific characters',
  usage: '!servercharacter <create|list|view|edit|delete|toggle>',
  adminOnly: true,
  
  async execute({ message, args, data, client }) {
    const member = message.member;
    const userId = message.author.id;
    const serverId = message.guild?.id;
    
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const hasPermission = canSetupServer(userId, serverId, member) || isServerOwner(member);
    
    if (!hasPermission) {
      return message.reply('You need to be the server owner or a server admin to manage server characters!');
    }
    
    const subcommand = args[0]?.toLowerCase() || 'help';
    
    switch (subcommand) {
      case 'create':
      case 'add':
      case 'new':
        return handleCreate(message, serverId, userId, client);
      case 'list':
      case 'ls':
        return handleList(message, serverId);
      case 'view':
      case 'show':
        return handleView(message, serverId, args.slice(1).join(' '));
      case 'delete':
      case 'remove':
        return handleDelete(message, serverId, args.slice(1).join(' '), userId, client);
      default:
        return showHelp(message);
    }
  }
};

function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('Server Character Management')
    .setDescription('Create and manage characters for your server!')
    .addFields(
      { name: '`!sc create`', value: 'Start creating a new character (interactive)', inline: true },
      { name: '`!sc list`', value: 'View all your server characters', inline: true },
      { name: '`!sc view <name>`', value: 'View details of a character', inline: true },
      { name: '`!sc delete <name>`', value: 'Delete a character', inline: true }
    )
    .addFields(
      { name: 'Important Notes', value: 
        '- Characters are added to the main character pool\n' +
        '- They can be obtained from **crates** with a set chance\n' +
        '- All battle commands work with your characters\n' +
        '- You **cannot** create coins, gems, or currency items'
      }
    )
    .setFooter({ text: 'Server owners and admins only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleCreate(message, serverId, userId, client) {
  const creationId = `${serverId}-${userId}-${Date.now()}`;
  const uniqueId = generateUniqueId();
  
  const newCharacter = {
    serverId,
    uniqueId,
    createdBy: userId,
    step: 1,
    name: null,
    emoji: null,
    description: null,
    imageUrl: null,
    ability: {
      name: null,
      emoji: '⚡',
      description: null,
      effectType: 'flatDamageBonus',
      effectValue: 5
    },
    specialMove: {
      name: null,
      damage: 90
    }
  };
  
  pendingCreations.set(creationId, newCharacter);
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('Create New Character - Step 1/9')
    .setDescription(
      'Let\'s create a new character for your server!\n\n' +
      '**Step 1: Character Name**\n' +
      'Please reply with the name of your character.\n\n' +
      '*Example: Fluffy, Dragon King, Shadow Wolf*'
    )
    .setFooter({ text: `Type your answer below or "cancel" to stop | ID: ${uniqueId}` })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 600000, max: 30 });
  
  collector.on('collect', async (m) => {
    const charData = pendingCreations.get(creationId);
    if (!charData) {
      collector.stop('cancelled');
      return;
    }
    
    const content = m.content.trim();
    
    if (content.toLowerCase() === 'cancel') {
      pendingCreations.delete(creationId);
      collector.stop('cancelled');
      await m.reply('Character creation cancelled.');
      return;
    }
    
    switch (charData.step) {
      case 1:
        if (content.length < 2 || content.length > 30) {
          await m.reply('Name must be between 2 and 30 characters. Please try again.');
          return;
        }
        const existingChar = characterManager.getCharacterByName(content);
        if (existingChar) {
          await m.reply('A character with this name already exists. Please choose a different name.');
          return;
        }
        charData.name = content;
        charData.step = 2;
        await sendStep2(m, charData);
        break;
        
      case 2:
        charData.emoji = content.substring(0, 50);
        charData.step = 3;
        await sendStep3(m, charData);
        break;
        
      case 3:
        if (content.length < 10 || content.length > 200) {
          await m.reply('Description must be between 10 and 200 characters. Please try again.');
          return;
        }
        charData.description = content;
        charData.step = 4;
        await sendStep4(m, charData);
        break;
        
      case 4:
        if (content.toLowerCase() === 'skip') {
          charData.imageUrl = null;
        } else if (!content.startsWith('http')) {
          await m.reply('Please enter a valid image URL starting with http:// or https://, or type "skip".');
          return;
        } else {
          charData.imageUrl = content;
        }
        charData.step = 5;
        await sendStep5(m, charData);
        break;
        
      case 5:
        charData.ability.name = content.substring(0, 50);
        charData.step = 6;
        await sendStep6(m, charData);
        break;
        
      case 6:
        if (content.length < 10 || content.length > 150) {
          await m.reply('Ability description must be between 10 and 150 characters. Please try again.');
          return;
        }
        charData.ability.description = content;
        charData.step = 7;
        await sendStep7(m, charData);
        break;
        
      case 7:
        const effectTypeLower = content.toLowerCase();
        const matchedType = VALID_EFFECT_TYPES.find(t => t.toLowerCase() === effectTypeLower);
        if (!matchedType) {
          await m.reply(`Invalid effect type. Please choose from the list above or type "list" to see all options.`);
          if (content.toLowerCase() === 'list') {
            await sendEffectTypeList(m);
          }
          return;
        }
        charData.ability.effectType = matchedType;
        charData.step = 8;
        await sendStep8(m, charData);
        break;
        
      case 8:
        const effectValue = parseFloat(content);
        if (isNaN(effectValue)) {
          await m.reply('Please enter a valid number for the effect value.');
          return;
        }
        charData.ability.effectValue = effectValue;
        charData.step = 9;
        await sendStep9(m, charData);
        break;
        
      case 9:
        charData.specialMove.name = content.substring(0, 50);
        charData.step = 10;
        await sendStep10(m, charData);
        break;
        
      case 10:
        const damage = parseInt(content);
        if (isNaN(damage) || damage < 50 || damage > 150) {
          await m.reply('Special move damage must be a number between 50 and 150. Please try again.');
          return;
        }
        charData.specialMove.damage = damage;
        await finalizeCharacter(m, serverId, charData, creationId);
        collector.stop('completed');
        break;
    }
    
    pendingCreations.set(creationId, charData);
  });
  
  collector.on('end', (collected, reason) => {
    if (reason !== 'completed' && reason !== 'cancelled') {
      pendingCreations.delete(creationId);
      message.channel.send('Character creation timed out. Please start again with `!sc create`.');
    }
  });
}

async function sendStep2(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 2/9`)
    .setDescription(
      '**Step 2: Character Emoji**\n' +
      'Enter an emoji or custom emoji for your character.\n\n' +
      '*Example: 🐺, 🐉, <:myemoji:123456789>*'
    )
    .setFooter({ text: 'Type your answer or "cancel" to stop' });
  await m.reply({ embeds: [embed] });
}

async function sendStep3(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 3/9`)
    .setDescription(
      '**Step 3: Character Description**\n' +
      'Enter a description for your character (10-200 characters).\n\n' +
      '*Example: A fierce wolf who guards the forest with unwavering loyalty.*'
    )
    .setFooter({ text: 'Type your answer or "cancel" to stop' });
  await m.reply({ embeds: [embed] });
}

async function sendStep4(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 4/9`)
    .setDescription(
      '**Step 4: Character Image (Optional)**\n' +
      'Enter an image URL for your character, or type "skip".\n\n' +
      '*The image will be shown when viewing the character.*'
    )
    .setFooter({ text: 'Enter a URL or type "skip"' });
  await m.reply({ embeds: [embed] });
}

async function sendStep5(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 5/9`)
    .setDescription(
      '**Step 5: Ability Name**\n' +
      'Enter the name of your character\'s special ability.\n\n' +
      '*Example: Forest Guardian, Shadow Strike, Healing Aura*'
    )
    .setFooter({ text: 'Type the ability name' });
  await m.reply({ embeds: [embed] });
}

async function sendStep6(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 6/9`)
    .setDescription(
      '**Step 6: Ability Description**\n' +
      'Describe what the ability does (10-150 characters).\n\n' +
      '*Example: Deals 20% extra damage when HP is above 50%*'
    )
    .setFooter({ text: 'Type the ability description' });
  await m.reply({ embeds: [embed] });
}

async function sendStep7(m, charData) {
  const popularTypes = [
    'flatDamageBonus', 'criticalDamageBonus', 'lifesteal', 'damageReduction',
    'dodgeChance', 'healPerTurn', 'burnChance', 'freezeChance',
    'doubleAttackChance', 'extraTurnChance', 'energyRegenPerTurn', 'defenseBonus'
  ];
  
  const typeList = popularTypes.map(t => {
    const desc = EFFECT_DESCRIPTIONS[t] || t;
    return `\`${t}\` - ${desc}`;
  }).join('\n');
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 7/9`)
    .setDescription(
      '**Step 7: Ability Effect Type**\n' +
      'Choose an effect type for your ability. Popular options:\n\n' +
      typeList + '\n\n' +
      '*Type "list" to see all available effect types.*'
    )
    .setFooter({ text: 'Type an effect type name' });
  await m.reply({ embeds: [embed] });
}

async function sendEffectTypeList(m) {
  const chunks = [];
  for (let i = 0; i < VALID_EFFECT_TYPES.length; i += 15) {
    chunks.push(VALID_EFFECT_TYPES.slice(i, i + 15));
  }
  
  let description = '**All Available Effect Types:**\n\n';
  description += chunks[0].map(t => `\`${t}\``).join(', ');
  if (chunks[1]) description += ',\n' + chunks[1].map(t => `\`${t}\``).join(', ');
  if (chunks[2]) description += ',\n' + chunks[2].map(t => `\`${t}\``).join(', ');
  if (chunks[3]) description += ',\n' + chunks[3].map(t => `\`${t}\``).join(', ');
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('All Effect Types')
    .setDescription(description)
    .setFooter({ text: 'Type one of these effect types' });
  await m.reply({ embeds: [embed] });
}

async function sendStep8(m, charData) {
  const desc = EFFECT_DESCRIPTIONS[charData.ability.effectType] || 'Enter the numeric value for this effect';
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 8/9`)
    .setDescription(
      '**Step 8: Ability Effect Value**\n' +
      `You selected: \`${charData.ability.effectType}\`\n\n` +
      `${desc}\n\n` +
      '*Enter a number (decimals allowed for percentages)*\n\n' +
      '**Examples:**\n' +
      '- For 25% bonus, enter: `0.25`\n' +
      '- For 50% bonus, enter: `0.5`\n' +
      '- For flat +5 damage, enter: `5`\n' +
      '- For +20 energy, enter: `20`'
    )
    .setFooter({ text: 'Type a number value' });
  await m.reply({ embeds: [embed] });
}

async function sendStep9(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 9/9`)
    .setDescription(
      '**Step 9: Special Move Name**\n' +
      'Enter the name of your character\'s special attack move.\n\n' +
      '*Example: Thunder Strike, Dark Slash, Healing Wave*'
    )
    .setFooter({ text: 'Type the special move name' });
  await m.reply({ embeds: [embed] });
}

async function sendStep10(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Final Step`)
    .setDescription(
      '**Step 10: Special Move Damage**\n' +
      'Enter the base damage for your character\'s special move.\n\n' +
      '**Recommended ranges:**\n' +
      '- Balanced: 85-95 damage\n' +
      '- Strong: 95-100 damage\n' +
      '- Very Strong: 100-110 damage\n\n' +
      '*Enter a number between 50 and 150*'
    )
    .setFooter({ text: 'Type a damage number' });
  await m.reply({ embeds: [embed] });
}

async function finalizeCharacter(m, serverId, charData, creationId) {
  try {
    const result = await characterManager.createCharacterFromSubmission({
      name: charData.name,
      emoji: charData.emoji,
      obtainable: 'crate',
      customEmojiId: null,
      game: 'ZooBot',
      createdBy: charData.createdBy,
      serverId: serverId,
      imageUrl: charData.imageUrl,
      description: charData.description,
      ability: {
        name: charData.ability.name,
        emoji: charData.ability.emoji,
        description: charData.ability.description,
        effectType: charData.ability.effectType,
        effectValue: charData.ability.effectValue
      },
      specialMove: {
        name: charData.specialMove.name,
        damage: charData.specialMove.damage
      }
    });
    
    pendingCreations.delete(creationId);
    
    if (!result.success) {
      await m.reply(`Failed to create character: ${result.message}`);
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Character Created Successfully!')
      .setDescription(`${charData.emoji} **${charData.name}** has been added to the game!`)
      .addFields(
        { name: 'Unique ID', value: `\`${charData.uniqueId}\``, inline: true },
        { name: 'Obtainable', value: 'Crate', inline: true },
        { name: 'Description', value: charData.description || 'No description', inline: false },
        { name: 'Ability', value: `**${charData.ability.name}**: ${charData.ability.description}\n*Effect: ${charData.ability.effectType} = ${charData.ability.effectValue}*`, inline: false },
        { name: 'Special Move', value: `**${charData.specialMove.name}** (${charData.specialMove.damage} DMG)`, inline: true }
      )
      .setFooter({ text: 'Character can be obtained from crates!' })
      .setTimestamp();
    
    if (charData.imageUrl) {
      embed.setThumbnail(charData.imageUrl);
    }
    
    await m.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error creating server character:', error);
    await m.reply('An error occurred while creating the character. Please try again.');
    pendingCreations.delete(creationId);
  }
}

async function handleList(message, serverId) {
  try {
    const allCharacters = characterManager.listAllCharacters();
    const serverCharacters = allCharacters.filter(c => c.serverId === serverId);
    
    if (serverCharacters.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('No Server Characters')
        .setDescription('Your server doesn\'t have any custom characters yet!\n\nUse `!sc create` to create your first character.')
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
    
    const charList = serverCharacters.map((c, i) => {
      return `${i + 1}. ${c.emoji} **${c.name}** - Obtainable: ${c.obtainable}`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle(`Server Characters (${serverCharacters.length})`)
      .setDescription(charList)
      .setFooter({ text: 'Use !sc view <name> to see details' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error listing server characters:', error);
    return message.reply('An error occurred while fetching characters.');
  }
}

async function handleView(message, serverId, name) {
  if (!name) {
    return message.reply('Please specify a character name: `!sc view <name>`');
  }
  
  const character = characterManager.getCharacterByName(name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}". Use \`!sc list\` to see all characters.`);
  }
  
  const ability = characterManager.getCharacterAbility(name);
  const move = characterManager.getSpecialMove(name);
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`${character.emoji} ${character.name}`)
    .setDescription(character.description || 'No description')
    .addFields(
      { name: 'Obtainable', value: character.obtainable || 'crate', inline: true },
      { name: 'Game', value: character.game || 'ZooBot', inline: true },
      { name: 'Created By', value: `<@${character.createdBy}>`, inline: true }
    );
  
  if (ability) {
    let abilityText = `${ability.emoji} **${ability.name}**\n${ability.description}`;
    if (ability.effect) {
      const effectEntries = Object.entries(ability.effect);
      if (effectEntries.length > 0) {
        abilityText += `\n*Effect: ${effectEntries.map(([k, v]) => `${k}: ${v}`).join(', ')}*`;
      }
    }
    embed.addFields({ name: 'Ability', value: abilityText, inline: false });
  }
  
  if (move) {
    embed.addFields({ name: 'Special Move', value: `**${move.name}** (${move.damage} DMG)`, inline: true });
  }
  
  if (character.imageUrl) {
    embed.setThumbnail(character.imageUrl);
  }
  
  embed.setFooter({ text: `Server ID: ${character.serverId || 'Global'}` });
  embed.setTimestamp(character.createdAt ? new Date(character.createdAt) : new Date());
  
  return message.reply({ embeds: [embed] });
}

async function handleDelete(message, serverId, name, userId, client) {
  if (!name) {
    return message.reply('Please specify a character name: `!sc delete <name>`');
  }
  
  const character = characterManager.getCharacterByName(name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}".`);
  }
  
  if (character.serverId !== serverId) {
    return message.reply('You can only delete characters created by your server!');
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Confirm Deletion')
    .setDescription(`Are you sure you want to delete **${character.emoji} ${character.name}**?\n\nThis action cannot be undone!`)
    .setFooter({ text: 'Reply with "yes" to confirm or "no" to cancel' });
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId && ['yes', 'no'].includes(m.content.toLowerCase());
  const collector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });
  
  collector.on('collect', async (m) => {
    if (m.content.toLowerCase() === 'yes') {
      const result = await characterManager.removeCharacter(userId, name);
      if (result.success) {
        await m.reply(`Character **${character.emoji} ${character.name}** has been deleted.`);
      } else {
        await m.reply(`Failed to delete character: ${result.message}`);
      }
    } else {
      await m.reply('Deletion cancelled.');
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (collected.size === 0) {
      message.channel.send('Deletion timed out. Please try again.');
    }
  });
}
