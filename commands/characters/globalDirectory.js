const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const characterManager = require('../../characterManager.js');
const { getCollection } = require('../../mongoManager.js');
const { canSetupServer, isServerOwner } = require('../../serverConfigManager.js');

const ITEMS_PER_PAGE = 9;

module.exports = {
  name: 'chars',
  aliases: ['characters', 'globalchars', 'chardir', 'directory', 'browse'],
  category: 'characters',
  description: 'Browse the global character directory - view and add public characters to your server',
  usage: '!chars [page] or !chars view <name> or !chars add <name>',
  
  async execute({ message, args, data, client }) {
    const serverId = message.guild?.id;
    const userId = message.author.id;
    
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const subcommand = args[0]?.toLowerCase();
    
    if (subcommand === 'view' || subcommand === 'show' || subcommand === 'info') {
      return handleViewCharacter(message, args.slice(1).join(' '));
    }
    
    if (subcommand === 'add') {
      return handleAddCharacter(message, serverId, args.slice(1).join(' '), userId, message.member);
    }
    
    const page = parseInt(args[0]) || 1;
    return handleListCharacters(message, serverId, page, userId);
  }
};

async function handleListCharacters(message, serverId, page, userId) {
  try {
    const allCharacters = characterManager.listAllCharacters();
    
    const publicCharacters = allCharacters.filter(c => c.isPublic === true);
    
    if (publicCharacters.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('Global Character Directory')
        .setDescription(
          'No public characters available yet!\n\n' +
          '**Server Owners can:**\n' +
          '• `!sc create` - Create a character and make it public\n\n' +
          'Public characters can be browsed and added by other servers.'
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
    
    const totalPages = Math.ceil(publicCharacters.length / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageChars = publicCharacters.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    
    const charGrid = pageChars.map((c, i) => {
      const idx = startIdx + i + 1;
      const addCount = c.addCount || 0;
      return `\`${idx}.\` ${c.emoji} **${c.name}**\n└ ${c.description?.substring(0, 40) || 'No description'}${c.description?.length > 40 ? '...' : ''}\n└ Added by ${addCount} server${addCount !== 1 ? 's' : ''}`;
    }).join('\n\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle(`Global Character Directory (${publicCharacters.length})`)
      .setDescription(charGrid)
      .addFields({
        name: 'Commands',
        value: '• `!chars view <name>` - View character details\n• `!chars add <name>` - Add character to your server'
      })
      .setFooter({ text: `Page ${currentPage}/${totalPages} | Use !chars <page> to browse` })
      .setTimestamp();
    
    const row = new ActionRowBuilder();
    
    if (currentPage > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`chars_page_${currentPage - 1}_${serverId}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }
    
    if (currentPage < totalPages) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`chars_page_${currentPage + 1}_${serverId}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
      );
    }
    
    const replyOptions = { embeds: [embed] };
    if (row.components.length > 0) {
      replyOptions.components = [row];
    }
    
    const reply = await message.reply(replyOptions);
    
    if (row.components.length > 0) {
      const collector = reply.createMessageComponentCollector({ time: 120000 });
      
      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== userId) {
          await interaction.reply({ content: 'Use your own command to browse!', ephemeral: true });
          return;
        }
        
        const newPage = parseInt(interaction.customId.split('_')[2]);
        const newPageChars = publicCharacters.slice((newPage - 1) * ITEMS_PER_PAGE, newPage * ITEMS_PER_PAGE);
        
        const newCharGrid = newPageChars.map((c, i) => {
          const idx = (newPage - 1) * ITEMS_PER_PAGE + i + 1;
          const addCount = c.addCount || 0;
          return `\`${idx}.\` ${c.emoji} **${c.name}**\n└ ${c.description?.substring(0, 40) || 'No description'}${c.description?.length > 40 ? '...' : ''}\n└ Added by ${addCount} server${addCount !== 1 ? 's' : ''}`;
        }).join('\n\n');
        
        const newEmbed = new EmbedBuilder()
          .setColor(0x00D9FF)
          .setTitle(`Global Character Directory (${publicCharacters.length})`)
          .setDescription(newCharGrid)
          .addFields({
            name: 'Commands',
            value: '• `!chars view <name>` - View character details\n• `!chars add <name>` - Add character to your server'
          })
          .setFooter({ text: `Page ${newPage}/${totalPages} | Use !chars <page> to browse` })
          .setTimestamp();
        
        const newRow = new ActionRowBuilder();
        if (newPage > 1) {
          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`chars_page_${newPage - 1}_${serverId}`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⬅️')
          );
        }
        if (newPage < totalPages) {
          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`chars_page_${newPage + 1}_${serverId}`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('➡️')
          );
        }
        
        await interaction.update({ embeds: [newEmbed], components: newRow.components.length > 0 ? [newRow] : [] });
      });
      
      collector.on('end', async () => {
        try {
          await reply.edit({ components: [] });
        } catch (e) {}
      });
    }
    
  } catch (error) {
    console.error('Error listing global characters:', error);
    return message.reply('An error occurred while fetching characters.');
  }
}

async function handleViewCharacter(message, name) {
  if (!name) {
    return message.reply('Please specify a character name: `!chars view <name>`');
  }
  
  const character = characterManager.getCharacterByName(name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}". Use \`!chars\` to browse available characters.`);
  }
  
  if (!character.isPublic) {
    return message.reply('This character is private and cannot be viewed in the global directory.');
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
      { name: 'Added By', value: `${character.addCount || 0} servers`, inline: true }
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
    embed.setImage(character.imageUrl);
  }
  
  embed.addFields({
    name: 'Add to Your Server',
    value: `\`!chars add ${character.name}\``
  });
  
  embed.setFooter({ text: `Created by ${character.createdBy || 'Unknown'}` });
  embed.setTimestamp(character.createdAt ? new Date(character.createdAt) : new Date());
  
  return message.reply({ embeds: [embed] });
}

async function handleAddCharacter(message, serverId, name, userId, member) {
  if (!canSetupServer(userId, serverId, member) && !isServerOwner(member)) {
    return message.reply('Only server owners and admins can add characters to the server!');
  }
  
  if (!name) {
    return message.reply('Please specify a character name: `!chars add <name>`');
  }
  
  const character = characterManager.getCharacterByName(name);
  
  if (!character) {
    return message.reply(`No character found with name "${name}". Use \`!chars\` to browse available characters.`);
  }
  
  if (!character.isPublic) {
    return message.reply('This character is private and cannot be added to your server.');
  }
  
  if (character.serverId === serverId) {
    return message.reply('This character was created by your server - it\'s already available!');
  }
  
  // Check character slot limits (with fallback for non-MongoDB environments)
  try {
    const { getServerSlotLimits } = require('../../serverAuraSystem.js');
    const slotLimits = await getServerSlotLimits(serverId);
    const currentCharCount = await characterManager.getServerCharacterCount(serverId);
    
    if (currentCharCount >= slotLimits.characterSlots) {
      return message.reply(`❌ Character slot limit reached! You have **${currentCharCount}/${slotLimits.characterSlots}** slots.\nUse \`!serveraura buy character\` to purchase more slots.`);
    }
  } catch (slotError) {
    // If slot system unavailable, allow the operation
    console.warn('Could not check character slot limits:', slotError.message);
  }
  
  try {
    const collection = await getCollection('serverAddedCharacters');
    
    const existing = await collection.findOne({ 
      serverId, 
      characterName: character.name 
    });
    
    if (existing) {
      return message.reply(`**${character.emoji} ${character.name}** is already added to your server!`);
    }
    
    await collection.insertOne({
      serverId,
      characterName: character.name,
      addedBy: userId,
      addedAt: new Date()
    });
    
    const result = await characterManager.incrementCharacterAddCount(character.name, serverId);
    
    const allCharacters = characterManager.listAllCharacters();
    const serverCreatedChars = allCharacters.filter(c => c.serverId === serverId);
    const addedFromGlobal = await collection.find({ serverId }).toArray();
    const totalCharacters = serverCreatedChars.length + addedFromGlobal.length;
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Character Added!')
      .setDescription(`**${character.emoji} ${character.name}** has been added to your server!`)
      .addFields(
        { name: 'Description', value: character.description || 'No description', inline: false },
        { name: 'Your Server Now Has', value: `${totalCharacters} custom/added characters`, inline: true },
        { name: 'Now Available', value: 'Players can now obtain this character from crates!', inline: false }
      )
      .setFooter({ text: `Added by ${message.author.tag} | Use !sc list to see all` })
      .setTimestamp();
    
    if (character.imageUrl) {
      embed.setThumbnail(character.imageUrl);
    }
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error adding character to server:', error);
    return message.reply('An error occurred while adding the character. Please try again.');
  }
}
