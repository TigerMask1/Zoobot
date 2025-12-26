const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getCollection } = require('../../mongoManager.js');
const { getServerConfig, isServerAdmin, isSuperAdmin } = require('../../serverConfigManager.js');

const ITEMS_PER_PAGE = 10;
const RARITY_COLORS = {
  common: 0x95A5A6,
  uncommon: 0x2ECC71,
  rare: 0x3498DB,
  'ultra rare': 0x00CED1,
  epic: 0x9B59B6,
  legendary: 0xFFD700
};

const RARITY_EMOJIS = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  'ultra rare': '💎',
  epic: '💜',
  legendary: '🌟'
};

module.exports = {
  name: 'characters',
  aliases: ['chars', 'serverchars', 'viewchars'],
  category: 'characters',
  description: 'View all characters available in this server',
  usage: '!characters [page] or !characters view <id/name>',
  
  async execute({ message, args, data, client }) {
    const serverId = message.guild?.id;
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const subcommand = args[0]?.toLowerCase();
    
    if (subcommand === 'view' || subcommand === 'show' || subcommand === 'info') {
      return handleViewCharacter(message, serverId, args.slice(1).join(' '));
    }
    
    if (subcommand === 'add') {
      return handleAddCharacter(message, serverId, args.slice(1).join(' '), message.author.id, message.member);
    }
    
    if (subcommand === 'remove') {
      return handleRemoveCharacter(message, serverId, args.slice(1).join(' '), message.author.id, message.member);
    }
    
    const page = parseInt(args[0]) || 1;
    return handleListCharacters(message, serverId, page, message.author.id);
  }
};

async function handleListCharacters(message, serverId, page, userId) {
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverAddedCol = await getCollection('serverAddedCharacters');
    const globalCharsCol = await getCollection('globalCharacters');
    
    const serverChars = await serverCharsCol.find({ 
      serverId, 
      status: 'active' 
    }).toArray();
    
    const addedCharIds = await serverAddedCol.find({ serverId }).toArray();
    const addedGlobalChars = [];
    
    if (addedCharIds.length > 0) {
      const globalIds = addedCharIds.map(a => a.characterId);
      const globalChars = await globalCharsCol.find({ 
        uniqueId: { $in: globalIds },
        status: 'active'
      }).toArray();
      addedGlobalChars.push(...globalChars);
    }
    
    const allChars = [
      ...serverChars.map(c => ({ ...c, source: 'server' })),
      ...addedGlobalChars.map(c => ({ ...c, source: 'global' }))
    ];

    // Load default characters if list is empty
    if (allChars.length === 0) {
      const defaultChars = require('../../characters.js');
      allChars.push(...defaultChars.map(c => ({ ...c, source: 'global', uniqueId: c.customEmojiId || c.name.toUpperCase() })));
    }
    
    const totalPages = Math.ceil(allChars.length / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageChars = allChars.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    
    const charList = pageChars.map((c, i) => {
      const idx = startIdx + i + 1;
      const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
      const sourceIcon = c.source === 'global' ? '🌐' : '🏠';
      const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
      return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\``;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle(`Server Characters (${allChars.length})`)
      .setDescription(charList)
      .addFields(
        { name: 'Legend', value: '🏠 Server-created | 🌐 Added from public | ⚪🟢🔵💎💜🌟 Rarity' }
      )
      .setFooter({ text: `Page ${currentPage}/${totalPages} | Use !characters <page> or !characters view <id>` })
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
        const newPageChars = allChars.slice((newPage - 1) * ITEMS_PER_PAGE, newPage * ITEMS_PER_PAGE);
        
        const newCharList = newPageChars.map((c, i) => {
          const idx = (newPage - 1) * ITEMS_PER_PAGE + i + 1;
          const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
          const sourceIcon = c.source === 'global' ? '🌐' : '🏠';
          const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
          return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\``;
        }).join('\n');
        
        const newEmbed = new EmbedBuilder()
          .setColor(0x00D9FF)
          .setTitle(`Server Characters (${allChars.length})`)
          .setDescription(newCharList)
          .addFields(
            { name: 'Legend', value: '🏠 Server-created | 🌐 Added from public | ⚪🟢🔵💎💜🌟 Rarity' }
          )
          .setFooter({ text: `Page ${newPage}/${totalPages} | Use !characters <page> or !characters view <id>` })
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
    console.error('Error listing characters:', error);
    return message.reply('An error occurred while fetching characters.');
  }
}

async function handleViewCharacter(message, serverId, identifier) {
  if (!identifier) {
    return message.reply('Please specify a character ID or name: `!characters view <id/name>`');
  }
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const globalCharsCol = await getCollection('globalCharacters');
    
    let character = await serverCharsCol.findOne({
      serverId,
      $or: [
        { uniqueId: identifier.toUpperCase() },
        { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ]
    });
    
    let source = 'server';
    
    if (!character) {
      character = await globalCharsCol.findOne({
        $or: [
          { uniqueId: identifier.toUpperCase() },
          { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
        ]
      });
      source = 'global';
    }
    
    if (!character) {
      return message.reply(`No character found with ID or name "${identifier}".`);
    }
    
    const uniqueId = character.uniqueId || character._id?.toString().slice(-6) || 'N/A';
    
    const embed = new EmbedBuilder()
      .setColor(RARITY_COLORS[character.rarity] || 0x00D9FF)
      .setTitle(`${character.emoji} ${character.name}`)
      .setDescription(character.description || 'No description available.')
      .addFields(
        { name: 'Unique ID', value: `\`${uniqueId}\``, inline: true },
        { name: 'Rarity', value: `${RARITY_EMOJIS[character.rarity] || '⚪'} ${character.rarity?.toUpperCase() || 'COMMON'}`, inline: true },
        { name: 'Source', value: source === 'global' ? '🌐 Public Character' : '🏠 Server Character', inline: true },
        { name: 'Obtainable', value: character.obtainable || 'drop', inline: true },
        { name: 'Status', value: character.status === 'active' ? '✅ Active' : '❌ Disabled', inline: true },
        { name: 'Visibility', value: character.isPublic ? '🌐 Public' : '🔒 Private', inline: true }
      );
    
    if (character.stats) {
      embed.addFields({
        name: 'Stats',
        value: `❤️ HP: ${character.stats.hp || 100}\n⚔️ ATK: ${character.stats.attack || 15}\n🛡️ DEF: ${character.stats.defense || 10}\n💨 SPD: ${character.stats.speed || 10}`,
        inline: true
      });
    }
    
    if (character.ability) {
      embed.addFields({
        name: 'Ability',
        value: `**${character.ability.name || 'Unknown'}**\n${character.ability.description || 'No description'}`,
        inline: true
      });
    }
    
    if (character.specialMove) {
      embed.addFields({
        name: 'Special Move',
        value: `**${character.specialMove.name || 'Unknown'}**\nDamage: ${character.specialMove.damage || 30}`,
        inline: true
      });
    }
    
    if (character.imageUrl) {
      embed.setImage(character.imageUrl);
    }
    
    embed.setFooter({ text: `Created by ${character.createdBy || 'Unknown'} | To add: !characters add ${uniqueId}` });
    embed.setTimestamp(character.createdAt);
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error viewing character:', error);
    return message.reply('An error occurred while fetching the character.');
  }
}

async function handleAddCharacter(message, serverId, identifier, userId, member) {
  if (!isServerAdmin(userId, serverId, member)) {
    return message.reply('Only server owners and admins can add characters to the server!');
  }
  
  if (!identifier) {
    return message.reply('Please specify a character ID: `!characters add <id>`');
  }
  
  try {
    const globalCharsCol = await getCollection('globalCharacters');
    const serverAddedCol = await getCollection('serverAddedCharacters');
    
    const character = await globalCharsCol.findOne({
      $or: [
        { uniqueId: identifier.toUpperCase() },
        { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ],
      isPublic: true,
      status: 'active'
    });
    
    if (!character) {
      return message.reply(`No public character found with ID "${identifier}". Use \`!publicchars\` to browse available characters.`);
    }
    
    const existing = await serverAddedCol.findOne({
      serverId,
      characterId: character.uniqueId
    });
    
    if (existing) {
      return message.reply(`**${character.name}** is already added to this server!`);
    }
    
    await serverAddedCol.insertOne({
      serverId,
      characterId: character.uniqueId,
      addedBy: userId,
      addedAt: new Date()
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Character Added!')
      .setDescription(`${character.emoji} **${character.name}** has been added to this server's drop pool!`)
      .addFields(
        { name: 'Unique ID', value: `\`${character.uniqueId}\``, inline: true },
        { name: 'Rarity', value: character.rarity?.toUpperCase() || 'COMMON', inline: true }
      )
      .setFooter({ text: 'This character will now appear in drops on your server!' })
      .setTimestamp();
    
    if (character.imageUrl) {
      embed.setThumbnail(character.imageUrl);
    }
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error adding character:', error);
    return message.reply('An error occurred while adding the character.');
  }
}

async function handleRemoveCharacter(message, serverId, identifier, userId, member) {
  if (!isServerAdmin(userId, serverId, member)) {
    return message.reply('Only server owners and admins can remove characters from the server!');
  }
  
  if (!identifier) {
    return message.reply('Please specify a character ID or name: `!characters remove <id/name>`');
  }
  
  try {
    const serverAddedCol = await getCollection('serverAddedCharacters');
    const globalCharsCol = await getCollection('globalCharacters');
    
    const character = await globalCharsCol.findOne({
      $or: [
        { uniqueId: identifier.toUpperCase() },
        { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ]
    });
    
    if (character) {
      const result = await serverAddedCol.deleteOne({
        serverId,
        characterId: character.uniqueId
      });
      
      if (result.deletedCount > 0) {
        return message.reply(`✅ **${character.name}** has been removed from this server's drop pool.`);
      }
    }
    
    return message.reply(`Character "${identifier}" is not in this server's added characters list.`);
    
  } catch (error) {
    console.error('Error removing character:', error);
    return message.reply('An error occurred while removing the character.');
  }
}
