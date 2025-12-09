const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCollection } = require('../../mongoManager.js');

const ITEMS_PER_PAGE = 10;
const RARITY_EMOJIS = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  'ultra rare': '💎',
  epic: '💜',
  legendary: '🌟'
};

module.exports = {
  name: 'publiccollectibles',
  aliases: ['publiccols', 'pubcols', 'globalcols', 'browsecols'],
  category: 'characters',
  description: 'Browse all public collectibles available to add to your server',
  usage: '!publiccols [page]',
  
  async execute({ message, args, data, client }) {
    const page = parseInt(args[0]) || 1;
    const userId = message.author.id;
    
    try {
      const globalColsCol = await getCollection('globalCollectibles');
      const serverColsCol = await getCollection('serverCollectibles');
      
      const publicGlobalCols = await globalColsCol.find({ 
        isPublic: true, 
        status: 'active' 
      }).sort({ createdAt: -1 }).toArray();
      
      const publicServerCols = await serverColsCol.find({ 
        isPublic: true, 
        status: 'active' 
      }).sort({ createdAt: -1 }).toArray();
      
      const allPublicCols = [
        ...publicGlobalCols.map(c => ({ ...c, source: 'global' })),
        ...publicServerCols.map(c => ({ ...c, source: 'community' }))
      ];
      
      if (allPublicCols.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('No Public Collectibles')
          .setDescription(
            'There are no public collectibles available yet!\n\n' +
            'When server owners create collectibles and set them as **public**, they will appear here for other servers to add.'
          )
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }
      
      const totalPages = Math.ceil(allPublicCols.length / ITEMS_PER_PAGE);
      const currentPage = Math.max(1, Math.min(page, totalPages));
      const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
      const pageCols = allPublicCols.slice(startIdx, startIdx + ITEMS_PER_PAGE);
      
      const colList = pageCols.map((c, i) => {
        const idx = startIdx + i + 1;
        const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
        const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
        const sourceIcon = c.source === 'global' ? '👑' : '🌐';
        return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\` (${c.baseValue || 0} coins)`;
      }).join('\n');
      
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`Public Collectibles (${allPublicCols.length})`)
        .setDescription(colList)
        .addFields(
          { name: 'How to Add', value: 'Use `!collectibles add <ID>` to add a collectible to your server\'s drop pool!' },
          { name: 'Legend', value: '👑 Official | 🌐 Community-created' }
        )
        .setFooter({ text: `Page ${currentPage}/${totalPages} | Use !publiccols <page> to browse` })
        .setTimestamp();
      
      const row = new ActionRowBuilder();
      
      if (currentPage > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`pubcols_page_${currentPage - 1}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
        );
      }
      
      if (currentPage < totalPages) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`pubcols_page_${currentPage + 1}`)
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
          const newPageCols = allPublicCols.slice((newPage - 1) * ITEMS_PER_PAGE, newPage * ITEMS_PER_PAGE);
          
          const newColList = newPageCols.map((c, i) => {
            const idx = (newPage - 1) * ITEMS_PER_PAGE + i + 1;
            const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
            const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
            const sourceIcon = c.source === 'global' ? '👑' : '🌐';
            return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\` (${c.baseValue || 0} coins)`;
          }).join('\n');
          
          const newEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`Public Collectibles (${allPublicCols.length})`)
            .setDescription(newColList)
            .addFields(
              { name: 'How to Add', value: 'Use `!collectibles add <ID>` to add a collectible to your server\'s drop pool!' },
              { name: 'Legend', value: '👑 Official | 🌐 Community-created' }
            )
            .setFooter({ text: `Page ${newPage}/${totalPages} | Use !publiccols <page> to browse` })
            .setTimestamp();
          
          const newRow = new ActionRowBuilder();
          if (newPage > 1) {
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`pubcols_page_${newPage - 1}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
            );
          }
          if (newPage < totalPages) {
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`pubcols_page_${newPage + 1}`)
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
      console.error('Error listing public collectibles:', error);
      return message.reply('An error occurred while fetching public collectibles.');
    }
  }
};
