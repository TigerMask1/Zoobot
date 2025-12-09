const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { canSetupServer, isServerOwner, getServerConfig, saveServerConfig } = require('../../serverConfigManager.js');
const { getCollection } = require('../../mongoManager.js');

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'ultra rare', 'epic', 'legendary'];
const OBTAINABLE_OPTIONS = ['drop', 'crate', 'event', 'exclusive'];
const VALID_EFFECT_TYPES = [
  'criticalDamageBonus', 'energyCostReduction', 'startingShield', 'firstAttackBonus',
  'healPerTurn', 'healingBonus', 'damageReduction', 'dodgeChance', 'startingEnergyBonus',
  'burnChance', 'criticalChanceBonus', 'highHpDamageBonus', 'lifesteal', 'defenseBonus',
  'flatDamageBonus', 'doubleAttackChance', 'extraTurnChance', 'freezeChance'
];

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
      case 'edit':
      case 'modify':
        return handleEdit(message, serverId, args.slice(1).join(' '), userId, client);
      case 'delete':
      case 'remove':
        return handleDelete(message, serverId, args.slice(1).join(' '), userId, client);
      case 'toggle':
        return handleToggle(message, serverId, args.slice(1).join(' '), userId);
      default:
        return showHelp(message);
    }
  }
};

function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('Server Character Management')
    .setDescription('Create and manage characters exclusive to your server!')
    .addFields(
      { name: '`!sc create`', value: 'Start creating a new character (interactive)', inline: true },
      { name: '`!sc list`', value: 'View all your server characters', inline: true },
      { name: '`!sc view <name>`', value: 'View details of a character', inline: true },
      { name: '`!sc edit <name>`', value: 'Edit an existing character', inline: true },
      { name: '`!sc delete <name>`', value: 'Delete a character', inline: true },
      { name: '`!sc toggle <name>`', value: 'Enable/disable a character', inline: true }
    )
    .addFields(
      { name: 'Important Notes', value: 
        '- Characters you create are **exclusive** to your server\n' +
        '- They will only appear in drops on **your server**\n' +
        '- Players can only collect them in **your server**\n' +
        '- You **cannot** create coins, gems, or currency items'
      }
    )
    .setFooter({ text: 'Server owners and admins only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleCreate(message, serverId, userId, client) {
  const creationId = `${serverId}-${userId}-${Date.now()}`;
  
  const newCharacter = {
    serverId,
    createdBy: userId,
    createdAt: new Date(),
    status: 'active',
    step: 1,
    name: null,
    emoji: null,
    description: null,
    imageUrl: null,
    rarity: 'common',
    obtainable: 'drop',
    ability: {
      name: null,
      emoji: '⚡',
      description: null,
      effectType: 'flatDamageBonus',
      effectValue: 5
    },
    specialMove: {
      name: null,
      damage: 30
    },
    stats: {
      hp: 100,
      attack: 15,
      defense: 10,
      speed: 10
    },
    dropSettings: {
      enabled: true,
      probability: 5
    },
    crateSettings: {
      enabled: true,
      probability: 10,
      crates: ['bronze', 'silver', 'gold']
    }
  };
  
  pendingCreations.set(creationId, newCharacter);
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('Create New Server Character - Step 1/10')
    .setDescription(
      'Let\'s create a new character for your server!\n\n' +
      '**Step 1: Character Name**\n' +
      'Please reply with the name of your character.\n\n' +
      '*Example: Fluffy, Dragon King, Shadow Wolf*'
    )
    .setFooter({ text: 'Type your answer below or "cancel" to stop' })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 300000, max: 20 });
  
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
        const existingChar = await getServerCharacterByName(serverId, content);
        if (existingChar) {
          await m.reply('A character with this name already exists in your server. Please choose a different name.');
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
        const rarityLower = content.toLowerCase();
        if (!RARITY_OPTIONS.includes(rarityLower)) {
          await m.reply(`Invalid rarity. Please choose from: ${RARITY_OPTIONS.join(', ')}`);
          return;
        }
        charData.rarity = rarityLower;
        charData.step = 6;
        await sendStep6(m, charData);
        break;
        
      case 6:
        const obtainableLower = content.toLowerCase();
        if (!OBTAINABLE_OPTIONS.includes(obtainableLower)) {
          await m.reply(`Invalid option. Please choose from: ${OBTAINABLE_OPTIONS.join(', ')}`);
          return;
        }
        charData.obtainable = obtainableLower;
        charData.step = 7;
        await sendStep7(m, charData);
        break;
        
      case 7:
        charData.ability.name = content.substring(0, 50);
        charData.step = 8;
        await sendStep8(m, charData);
        break;
        
      case 8:
        if (content.length < 10 || content.length > 150) {
          await m.reply('Ability description must be between 10 and 150 characters. Please try again.');
          return;
        }
        charData.ability.description = content;
        charData.step = 9;
        await sendStep9(m, charData);
        break;
        
      case 9:
        charData.specialMove.name = content.substring(0, 50);
        charData.step = 10;
        await sendStep10(m, charData);
        break;
        
      case 10:
        const stats = content.split(/[\s,]+/).map(s => parseInt(s));
        if (stats.length !== 4 || stats.some(isNaN)) {
          await m.reply('Please enter 4 numbers separated by spaces: HP Attack Defense Speed (e.g., 100 15 10 10)');
          return;
        }
        const [hp, attack, defense, speed] = stats;
        if (hp < 50 || hp > 200 || attack < 5 || attack > 50 || defense < 5 || defense > 50 || speed < 5 || speed > 50) {
          await m.reply('Stats must be in range: HP (50-200), Attack (5-50), Defense (5-50), Speed (5-50). Please try again.');
          return;
        }
        charData.stats = { hp, attack, defense, speed };
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
    .setTitle(`Create "${charData.name}" - Step 2/10`)
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
    .setTitle(`Create "${charData.name}" - Step 3/10`)
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
    .setTitle(`Create "${charData.name}" - Step 4/10`)
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
    .setTitle(`Create "${charData.name}" - Step 5/10`)
    .setDescription(
      '**Step 5: Character Rarity**\n' +
      'Choose how rare this character will be:\n\n' +
      '• `common` - Easy to find (40% drop chance)\n' +
      '• `uncommon` - Somewhat rare (20% drop chance)\n' +
      '• `rare` - Hard to find (10% drop chance)\n' +
      '• `ultra rare` - Very hard to find (5% drop chance)\n' +
      '• `epic` - Extremely rare (2% drop chance)\n' +
      '• `legendary` - Almost impossible (0.5% drop chance)'
    )
    .setFooter({ text: 'Type a rarity level' });
  await m.reply({ embeds: [embed] });
}

async function sendStep6(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 6/10`)
    .setDescription(
      '**Step 6: How to Obtain**\n' +
      'Choose how players can get this character:\n\n' +
      '• `drop` - Appears in drops in your drop channel\n' +
      '• `crate` - Can be found in crates\n' +
      '• `event` - Only available during special events\n' +
      '• `exclusive` - Can only be given by admins'
    )
    .setFooter({ text: 'Type an option' });
  await m.reply({ embeds: [embed] });
}

async function sendStep7(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 7/10`)
    .setDescription(
      '**Step 7: Ability Name**\n' +
      'Enter the name of your character\'s special ability.\n\n' +
      '*Example: Forest Guardian, Shadow Strike, Healing Aura*'
    )
    .setFooter({ text: 'Type the ability name' });
  await m.reply({ embeds: [embed] });
}

async function sendStep8(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 8/10`)
    .setDescription(
      '**Step 8: Ability Description**\n' +
      'Describe what the ability does (10-150 characters).\n\n' +
      '*Example: Deals 20% extra damage when HP is above 50%*'
    )
    .setFooter({ text: 'Type the ability description' });
  await m.reply({ embeds: [embed] });
}

async function sendStep9(m, charData) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Create "${charData.name}" - Step 9/10`)
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
    .setTitle(`Create "${charData.name}" - Step 10/10`)
    .setDescription(
      '**Step 10: Character Stats**\n' +
      'Enter 4 numbers separated by spaces:\n' +
      '**HP** **Attack** **Defense** **Speed**\n\n' +
      'Ranges:\n' +
      '• HP: 50-200\n' +
      '• Attack: 5-50\n' +
      '• Defense: 5-50\n' +
      '• Speed: 5-50\n\n' +
      '*Example: 100 15 10 10*'
    )
    .setFooter({ text: 'Enter 4 numbers: HP Attack Defense Speed' });
  await m.reply({ embeds: [embed] });
}

async function finalizeCharacter(m, serverId, charData, creationId) {
  try {
    const collection = await getCollection('serverCharacters');
    
    const characterDoc = {
      serverId: charData.serverId,
      name: charData.name,
      emoji: charData.emoji,
      description: charData.description,
      imageUrl: charData.imageUrl,
      rarity: charData.rarity,
      obtainable: charData.obtainable,
      ability: charData.ability,
      specialMove: charData.specialMove,
      stats: charData.stats,
      dropSettings: charData.dropSettings,
      crateSettings: charData.crateSettings,
      status: 'active',
      createdBy: charData.createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await collection.insertOne(characterDoc);
    
    pendingCreations.delete(creationId);
    
    const rarityColors = {
      common: 0x95A5A6,
      uncommon: 0x2ECC71,
      rare: 0x3498DB,
      'ultra rare': 0x00CED1,
      epic: 0x9B59B6,
      legendary: 0xFFD700
    };
    
    const embed = new EmbedBuilder()
      .setColor(rarityColors[charData.rarity] || 0x00D9FF)
      .setTitle('Character Created Successfully!')
      .setDescription(`${charData.emoji} **${charData.name}** has been added to your server!`)
      .addFields(
        { name: 'Description', value: charData.description, inline: false },
        { name: 'Rarity', value: charData.rarity.toUpperCase(), inline: true },
        { name: 'Obtainable', value: charData.obtainable, inline: true },
        { name: 'Stats', value: `HP: ${charData.stats.hp} | ATK: ${charData.stats.attack} | DEF: ${charData.stats.defense} | SPD: ${charData.stats.speed}`, inline: false },
        { name: 'Ability', value: `**${charData.ability.name}**: ${charData.ability.description}`, inline: false },
        { name: 'Special Move', value: charData.specialMove.name, inline: true }
      )
      .setFooter({ text: 'This character is exclusive to your server!' })
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

async function getServerCharacterByName(serverId, name) {
  try {
    const collection = await getCollection('serverCharacters');
    return await collection.findOne({ 
      serverId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
  } catch (error) {
    console.error('Error getting server character:', error);
    return null;
  }
}

async function handleList(message, serverId) {
  try {
    const collection = await getCollection('serverCharacters');
    const characters = await collection.find({ serverId }).sort({ createdAt: -1 }).toArray();
    
    if (characters.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('No Server Characters')
        .setDescription('Your server doesn\'t have any custom characters yet!\n\nUse `!sc create` to create your first character.')
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
    
    const rarityEmojis = {
      common: '⚪',
      uncommon: '🟢',
      rare: '🔵',
      'ultra rare': '💎',
      epic: '💜',
      legendary: '🌟'
    };
    
    const charList = characters.map((c, i) => {
      const statusIcon = c.status === 'active' ? '✅' : '❌';
      const rarityIcon = rarityEmojis[c.rarity] || '⚪';
      return `${i + 1}. ${statusIcon} ${c.emoji} **${c.name}** ${rarityIcon} ${c.rarity}`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle(`Server Characters (${characters.length})`)
      .setDescription(charList)
      .addFields(
        { name: 'Legend', value: '✅ Active | ❌ Disabled | ⚪ Common | 🟢 Uncommon | 🔵 Rare | 💎 Ultra Rare | 💜 Epic | 🌟 Legendary' }
      )
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
  
  const character = await getServerCharacterByName(serverId, name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}". Use \`!sc list\` to see all characters.`);
  }
  
  const rarityColors = {
    common: 0x95A5A6,
    uncommon: 0x2ECC71,
    rare: 0x3498DB,
    'ultra rare': 0x00CED1,
    epic: 0x9B59B6,
    legendary: 0xFFD700
  };
  
  const embed = new EmbedBuilder()
    .setColor(rarityColors[character.rarity] || 0x00D9FF)
    .setTitle(`${character.emoji} ${character.name}`)
    .setDescription(character.description || 'No description')
    .addFields(
      { name: 'Rarity', value: character.rarity.toUpperCase(), inline: true },
      { name: 'Obtainable', value: character.obtainable, inline: true },
      { name: 'Status', value: character.status === 'active' ? '✅ Active' : '❌ Disabled', inline: true },
      { name: 'Stats', value: `❤️ HP: ${character.stats.hp}\n⚔️ ATK: ${character.stats.attack}\n🛡️ DEF: ${character.stats.defense}\n💨 SPD: ${character.stats.speed}`, inline: true },
      { name: 'Ability', value: `**${character.ability.name}**\n${character.ability.description}`, inline: true },
      { name: 'Special Move', value: character.specialMove.name, inline: true },
      { name: 'Drop Settings', value: `Enabled: ${character.dropSettings?.enabled ? 'Yes' : 'No'}\nProbability: ${character.dropSettings?.probability || 5}%`, inline: true },
      { name: 'Crate Settings', value: `Enabled: ${character.crateSettings?.enabled ? 'Yes' : 'No'}\nProbability: ${character.crateSettings?.probability || 10}%`, inline: true }
    )
    .setFooter({ text: `Created by ${character.createdBy} | ID: ${character._id}` })
    .setTimestamp(character.createdAt);
  
  if (character.imageUrl) {
    embed.setThumbnail(character.imageUrl);
  }
  
  return message.reply({ embeds: [embed] });
}

async function handleDelete(message, serverId, name, userId, client) {
  if (!name) {
    return message.reply('Please specify a character name: `!sc delete <name>`');
  }
  
  const character = await getServerCharacterByName(serverId, name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}".`);
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Confirm Deletion')
    .setDescription(`Are you sure you want to delete **${character.name}**?\n\n⚠️ This action cannot be undone!`)
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`delete_char_confirm_${character._id}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`delete_char_cancel_${character._id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const reply = await message.reply({ embeds: [embed], components: [row] });
  
  const filter = i => i.user.id === userId && i.customId.includes(character._id.toString());
  
  try {
    const interaction = await reply.awaitMessageComponent({ filter, time: 30000 });
    
    if (interaction.customId.startsWith('delete_char_confirm')) {
      const collection = await getCollection('serverCharacters');
      await collection.deleteOne({ _id: character._id });
      
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Character Deleted')
          .setDescription(`**${character.name}** has been deleted.`)
          .setTimestamp()
        ],
        components: []
      });
    } else {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x95A5A6)
          .setTitle('Deletion Cancelled')
          .setDescription('The character was not deleted.')
          .setTimestamp()
        ],
        components: []
      });
    }
  } catch (error) {
    await reply.edit({
      embeds: [new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('Timed Out')
        .setDescription('Deletion cancelled due to timeout.')
        .setTimestamp()
      ],
      components: []
    });
  }
}

async function handleToggle(message, serverId, name, userId) {
  if (!name) {
    return message.reply('Please specify a character name: `!sc toggle <name>`');
  }
  
  const character = await getServerCharacterByName(serverId, name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}".`);
  }
  
  try {
    const collection = await getCollection('serverCharacters');
    const newStatus = character.status === 'active' ? 'disabled' : 'active';
    
    await collection.updateOne(
      { _id: character._id },
      { $set: { status: newStatus, updatedAt: new Date() } }
    );
    
    const embed = new EmbedBuilder()
      .setColor(newStatus === 'active' ? 0x00FF00 : 0xFF6B6B)
      .setTitle('Character Status Updated')
      .setDescription(`${character.emoji} **${character.name}** is now ${newStatus === 'active' ? '✅ **Active**' : '❌ **Disabled**'}`)
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error toggling character:', error);
    return message.reply('An error occurred while updating the character.');
  }
}

async function handleEdit(message, serverId, name, userId, client) {
  if (!name) {
    return message.reply('Please specify a character name: `!sc edit <name>`');
  }
  
  const character = await getServerCharacterByName(serverId, name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}".`);
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle(`Edit ${character.name}`)
    .setDescription('What would you like to edit? Reply with a number:\n\n' +
      '1. Name\n' +
      '2. Emoji\n' +
      '3. Description\n' +
      '4. Image URL\n' +
      '5. Rarity\n' +
      '6. Obtainable Type\n' +
      '7. Stats (HP, ATK, DEF, SPD)\n' +
      '8. Ability Name\n' +
      '9. Ability Description\n' +
      '10. Special Move Name\n' +
      '11. Drop Settings\n' +
      '12. Crate Settings\n\n' +
      'Or type "cancel" to exit.'
    )
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 120000, max: 10 });
  
  let editField = null;
  
  collector.on('collect', async (m) => {
    const content = m.content.trim().toLowerCase();
    
    if (content === 'cancel') {
      collector.stop('cancelled');
      await m.reply('Edit cancelled.');
      return;
    }
    
    if (!editField) {
      const choice = parseInt(content);
      if (isNaN(choice) || choice < 1 || choice > 12) {
        await m.reply('Please enter a number between 1 and 12.');
        return;
      }
      
      editField = choice;
      await sendEditPrompt(m, choice, character);
      return;
    }
    
    try {
      const collection = await getCollection('serverCharacters');
      let updateData = {};
      
      switch (editField) {
        case 1:
          if (m.content.length < 2 || m.content.length > 30) {
            await m.reply('Name must be 2-30 characters.');
            return;
          }
          updateData.name = m.content;
          break;
        case 2:
          updateData.emoji = m.content.substring(0, 50);
          break;
        case 3:
          if (m.content.length < 10 || m.content.length > 200) {
            await m.reply('Description must be 10-200 characters.');
            return;
          }
          updateData.description = m.content;
          break;
        case 4:
          if (m.content.toLowerCase() !== 'clear' && !m.content.startsWith('http')) {
            await m.reply('Enter a valid URL or "clear".');
            return;
          }
          updateData.imageUrl = m.content.toLowerCase() === 'clear' ? null : m.content;
          break;
        case 5:
          if (!RARITY_OPTIONS.includes(m.content.toLowerCase())) {
            await m.reply(`Invalid. Options: ${RARITY_OPTIONS.join(', ')}`);
            return;
          }
          updateData.rarity = m.content.toLowerCase();
          break;
        case 6:
          if (!OBTAINABLE_OPTIONS.includes(m.content.toLowerCase())) {
            await m.reply(`Invalid. Options: ${OBTAINABLE_OPTIONS.join(', ')}`);
            return;
          }
          updateData.obtainable = m.content.toLowerCase();
          break;
        case 7:
          const stats = m.content.split(/[\s,]+/).map(s => parseInt(s));
          if (stats.length !== 4 || stats.some(isNaN)) {
            await m.reply('Enter 4 numbers: HP Attack Defense Speed');
            return;
          }
          const [hp, atk, def, spd] = stats;
          if (hp < 50 || hp > 200 || atk < 5 || atk > 50 || def < 5 || def > 50 || spd < 5 || spd > 50) {
            await m.reply('Stats out of range.');
            return;
          }
          updateData.stats = { hp, attack: atk, defense: def, speed: spd };
          break;
        case 8:
          updateData['ability.name'] = m.content.substring(0, 50);
          break;
        case 9:
          if (m.content.length < 10 || m.content.length > 150) {
            await m.reply('Must be 10-150 characters.');
            return;
          }
          updateData['ability.description'] = m.content;
          break;
        case 10:
          updateData['specialMove.name'] = m.content.substring(0, 50);
          break;
        case 11:
          const dropParts = m.content.toLowerCase().split(/[\s,]+/);
          const dropEnabled = dropParts[0] === 'on' || dropParts[0] === 'true' || dropParts[0] === 'yes';
          const dropProb = parseInt(dropParts[1]) || 5;
          updateData.dropSettings = { enabled: dropEnabled, probability: Math.min(100, Math.max(1, dropProb)) };
          break;
        case 12:
          const crateParts = m.content.toLowerCase().split(/[\s,]+/);
          const crateEnabled = crateParts[0] === 'on' || crateParts[0] === 'true' || crateParts[0] === 'yes';
          const crateProb = parseInt(crateParts[1]) || 10;
          updateData.crateSettings = { enabled: crateEnabled, probability: Math.min(100, Math.max(1, crateProb)) };
          break;
      }
      
      updateData.updatedAt = new Date();
      
      await collection.updateOne(
        { _id: character._id },
        { $set: updateData }
      );
      
      await m.reply(`✅ Character updated successfully!`);
      collector.stop('completed');
      
    } catch (error) {
      console.error('Error updating character:', error);
      await m.reply('Error updating character.');
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason !== 'completed' && reason !== 'cancelled') {
      message.channel.send('Edit timed out.');
    }
  });
}

async function sendEditPrompt(m, choice, character) {
  const prompts = {
    1: `Current name: **${character.name}**\nEnter new name:`,
    2: `Current emoji: ${character.emoji}\nEnter new emoji:`,
    3: `Current description: ${character.description}\nEnter new description (10-200 chars):`,
    4: `Current image: ${character.imageUrl || 'None'}\nEnter new URL or "clear":`,
    5: `Current rarity: ${character.rarity}\nOptions: ${RARITY_OPTIONS.join(', ')}`,
    6: `Current type: ${character.obtainable}\nOptions: ${OBTAINABLE_OPTIONS.join(', ')}`,
    7: `Current: HP ${character.stats.hp}, ATK ${character.stats.attack}, DEF ${character.stats.defense}, SPD ${character.stats.speed}\nEnter 4 numbers:`,
    8: `Current: ${character.ability.name}\nEnter new ability name:`,
    9: `Current: ${character.ability.description}\nEnter new description (10-150 chars):`,
    10: `Current: ${character.specialMove.name}\nEnter new special move name:`,
    11: `Current: ${character.dropSettings?.enabled ? 'On' : 'Off'}, ${character.dropSettings?.probability}%\nEnter: on/off probability (e.g., "on 5")`,
    12: `Current: ${character.crateSettings?.enabled ? 'On' : 'Off'}, ${character.crateSettings?.probability}%\nEnter: on/off probability (e.g., "on 10")`
  };
  
  await m.reply(prompts[choice]);
}
