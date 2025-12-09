const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCollection } = require('../../mongoManager.js');
const { isServerAdmin } = require('../../serverConfigManager.js');

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
  name: 'collectibles',
  aliases: ['cols', 'servercols', 'viewcols', 'items'],
  category: 'characters',
  description: 'View all collectibles available in this server',
  usage: '!collectibles [page] or !collectibles view <id/name>',
  
  async execute({ message, args, data, client }) {
    const serverId = message.guild?.id;
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const subcommand = args[0]?.toLowerCase();
    
    if (subcommand === 'view' || subcommand === 'show' || subcommand === 'info') {
      return handleViewCollectible(message, serverId, args.slice(1).join(' '));
    }
    
    if (subcommand === 'add') {
      return handleAddCollectible(message, serverId, args.slice(1).join(' '), message.author.id, message.member);
    }
    
    if (subcommand === 'remove') {
      return handleRemoveCollectible(message, serverId, args.slice(1).join(' '), message.author.id, message.member);
    }
    
    const page = parseInt(args[0]) || 1;
    return handleListCollectibles(message, serverId, page, message.author.id);
  }
};

async function handleListCollectibles(message, serverId, page, userId) {
  try {
    const serverColsCol = await getCollection('serverCollectibles');
    const serverAddedCol = await getCollection('serverAddedCollectibles');
    const globalColsCol = await getCollection('globalCollectibles');
    
    const serverCols = await serverColsCol.find({ 
      serverId, 
      status: 'active' 
    }).toArray();
    
    const addedColIds = await serverAddedCol.find({ serverId }).toArray();
    const addedGlobalCols = [];
    
    if (addedColIds.length > 0) {
      const globalIds = addedColIds.map(a => a.collectibleId);
      const globalCols = await globalColsCol.find({ 
        uniqueId: { $in: globalIds },
        status: 'active'
      }).toArray();
      addedGlobalCols.push(...globalCols);
    }
    
    const allCols = [
      ...serverCols.map(c => ({ ...c, source: 'server' })),
      ...addedGlobalCols.map(c => ({ ...c, source: 'global' }))
    ];
    
    if (allCols.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('No Collectibles Available')
        .setDescription(
          'This server has no collectibles configured for drops yet!\n\n' +
          '**Server Owners can:**\n' +
          '• `!scol create` - Create a custom collectible\n' +
          '• `!collectibles add <id>` - Add a public collectible by ID\n\n' +
          '**Browse public collectibles:**\n' +
          '• `!publiccols` - View all public collectibles available to add'
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
    
    const totalPages = Math.ceil(allCols.length / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageCols = allCols.slice(startIdx, startIdx + ITEMS_PER_PAGE);
    
    const colList = pageCols.map((c, i) => {
      const idx = startIdx + i + 1;
      const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
      const sourceIcon = c.source === 'global' ? '🌐' : '🏠';
      const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
      return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\` (${c.baseValue || 0} coins)`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`Server Collectibles (${allCols.length})`)
      .setDescription(colList)
      .addFields(
        { name: 'Legend', value: '🏠 Server-created | 🌐 Added from public | ⚪🟢🔵💎💜🌟 Rarity' }
      )
      .setFooter({ text: `Page ${currentPage}/${totalPages} | Use !collectibles <page> or !collectibles view <id>` })
      .setTimestamp();
    
    const row = new ActionRowBuilder();
    
    if (currentPage > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`cols_page_${currentPage - 1}_${serverId}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }
    
    if (currentPage < totalPages) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`cols_page_${currentPage + 1}_${serverId}`)
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
        const newPageCols = allCols.slice((newPage - 1) * ITEMS_PER_PAGE, newPage * ITEMS_PER_PAGE);
        
        const newColList = newPageCols.map((c, i) => {
          const idx = (newPage - 1) * ITEMS_PER_PAGE + i + 1;
          const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
          const sourceIcon = c.source === 'global' ? '🌐' : '🏠';
          const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
          return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\` (${c.baseValue || 0} coins)`;
        }).join('\n');
        
        const newEmbed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(`Server Collectibles (${allCols.length})`)
          .setDescription(newColList)
          .addFields(
            { name: 'Legend', value: '🏠 Server-created | 🌐 Added from public | ⚪🟢🔵💎💜🌟 Rarity' }
          )
          .setFooter({ text: `Page ${newPage}/${totalPages} | Use !collectibles <page> or !collectibles view <id>` })
          .setTimestamp();
        
        const newRow = new ActionRowBuilder();
        if (newPage > 1) {
          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`cols_page_${newPage - 1}_${serverId}`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⬅️')
          );
        }
        if (newPage < totalPages) {
          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`cols_page_${newPage + 1}_${serverId}`)
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
    console.error('Error listing collectibles:', error);
    return message.reply('An error occurred while fetching collectibles.');
  }
}

async function handleViewCollectible(message, serverId, identifier) {
  if (!identifier) {
    return message.reply('Please specify a collectible ID or name: `!collectibles view <id/name>`');
  }
  
  try {
    const serverColsCol = await getCollection('serverCollectibles');
    const globalColsCol = await getCollection('globalCollectibles');
    
    let collectible = await serverColsCol.findOne({
      serverId,
      $or: [
        { uniqueId: identifier.toUpperCase() },
        { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ]
    });
    
    let source = 'server';
    
    if (!collectible) {
      collectible = await globalColsCol.findOne({
        $or: [
          { uniqueId: identifier.toUpperCase() },
          { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
        ]
      });
      source = 'global';
    }
    
    if (!collectible) {
      return message.reply(`No collectible found with ID or name "${identifier}".`);
    }
    
    const uniqueId = collectible.uniqueId || collectible._id?.toString().slice(-6) || 'N/A';
    
    const tradingInfo = [];
    if (collectible.tradable) tradingInfo.push('Tradable');
    if (collectible.giftable) tradingInfo.push('Giftable');
    if (collectible.sellable) tradingInfo.push('Sellable');
    
    const embed = new EmbedBuilder()
      .setColor(RARITY_COLORS[collectible.rarity] || 0x9B59B6)
      .setTitle(`${collectible.emoji} ${collectible.name}`)
      .setDescription(collectible.description || 'No description available.')
      .addFields(
        { name: 'Unique ID', value: `\`${uniqueId}\``, inline: true },
        { name: 'Rarity', value: `${RARITY_EMOJIS[collectible.rarity] || '⚪'} ${collectible.rarity?.toUpperCase() || 'COMMON'}`, inline: true },
        { name: 'Source', value: source === 'global' ? '🌐 Public Collectible' : '🏠 Server Collectible', inline: true },
        { name: 'Base Value', value: `${collectible.baseValue || 0} coins`, inline: true },
        { name: 'Status', value: collectible.status === 'active' ? '✅ Active' : '❌ Disabled', inline: true },
        { name: 'Visibility', value: collectible.isPublic ? '🌐 Public' : '🔒 Private', inline: true },
        { name: 'Trading Options', value: tradingInfo.length > 0 ? tradingInfo.join(', ') : 'Soulbound', inline: false }
      )
      .setFooter({ text: `Created by ${collectible.createdBy || 'Unknown'} | To add: !collectibles add ${uniqueId}` })
      .setTimestamp(collectible.createdAt);
    
    if (collectible.imageUrl) {
      embed.setImage(collectible.imageUrl);
    }
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error viewing collectible:', error);
    return message.reply('An error occurred while fetching the collectible.');
  }
}

async function handleAddCollectible(message, serverId, identifier, userId, member) {
  if (!isServerAdmin(userId, serverId, member)) {
    return message.reply('Only server owners and admins can add collectibles to the server!');
  }
  
  if (!identifier) {
    return message.reply('Please specify a collectible ID: `!collectibles add <id>`');
  }
  
  try {
    const globalColsCol = await getCollection('globalCollectibles');
    const serverAddedCol = await getCollection('serverAddedCollectibles');
    
    const collectible = await globalColsCol.findOne({
      $or: [
        { uniqueId: identifier.toUpperCase() },
        { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ],
      isPublic: true,
      status: 'active'
    });
    
    if (!collectible) {
      return message.reply(`No public collectible found with ID "${identifier}". Use \`!publiccols\` to browse available collectibles.`);
    }
    
    const existing = await serverAddedCol.findOne({
      serverId,
      collectibleId: collectible.uniqueId
    });
    
    if (existing) {
      return message.reply(`**${collectible.name}** is already added to this server!`);
    }
    
    await serverAddedCol.insertOne({
      serverId,
      collectibleId: collectible.uniqueId,
      addedBy: userId,
      addedAt: new Date()
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Collectible Added!')
      .setDescription(`${collectible.emoji} **${collectible.name}** has been added to this server's drop pool!`)
      .addFields(
        { name: 'Unique ID', value: `\`${collectible.uniqueId}\``, inline: true },
        { name: 'Rarity', value: collectible.rarity?.toUpperCase() || 'COMMON', inline: true }
      )
      .setFooter({ text: 'This collectible will now appear in drops on your server!' })
      .setTimestamp();
    
    if (collectible.imageUrl) {
      embed.setThumbnail(collectible.imageUrl);
    }
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error adding collectible:', error);
    return message.reply('An error occurred while adding the collectible.');
  }
}

async function handleRemoveCollectible(message, serverId, identifier, userId, member) {
  if (!isServerAdmin(userId, serverId, member)) {
    return message.reply('Only server owners and admins can remove collectibles from the server!');
  }
  
  if (!identifier) {
    return message.reply('Please specify a collectible ID or name: `!collectibles remove <id/name>`');
  }
  
  try {
    const serverAddedCol = await getCollection('serverAddedCollectibles');
    const globalColsCol = await getCollection('globalCollectibles');
    
    const collectible = await globalColsCol.findOne({
      $or: [
        { uniqueId: identifier.toUpperCase() },
        { name: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ]
    });
    
    if (collectible) {
      const result = await serverAddedCol.deleteOne({
        serverId,
        collectibleId: collectible.uniqueId
      });
      
      if (result.deletedCount > 0) {
        return message.reply(`✅ **${collectible.name}** has been removed from this server's drop pool.`);
      }
    }
    
    return message.reply(`Collectible "${identifier}" is not in this server's added collectibles list.`);
    
  } catch (error) {
    console.error('Error removing collectible:', error);
    return message.reply('An error occurred while removing the collectible.');
  }
}
