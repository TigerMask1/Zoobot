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
  name: 'publiccharacters',
  aliases: ['publicchars', 'pubchars', 'globalchars', 'browsechars'],
  category: 'characters',
  description: 'Browse all public characters available to add to your server',
  usage: '!publicchars [page]',
  
  async execute({ message, args, data, client }) {
    const page = parseInt(args[0]) || 1;
    const userId = message.author.id;
    const serverId = message.guild?.id;
    
    try {
      const globalCharsCol = await getCollection('globalCharacters');
      const serverCharsCol = await getCollection('serverCharacters');
      
      const publicGlobalChars = await globalCharsCol.find({ 
        isPublic: true, 
        status: 'active' 
      }).sort({ createdAt: -1 }).toArray();
      
      const publicServerChars = await serverCharsCol.find({ 
        isPublic: true, 
        status: 'active' 
      }).sort({ createdAt: -1 }).toArray();
      
      const allPublicChars = [
        ...publicGlobalChars.map(c => ({ ...c, source: 'global' })),
        ...publicServerChars.map(c => ({ ...c, source: 'community' }))
      ];
      
      if (allPublicChars.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('No Public Characters')
          .setDescription(
            'There are no public characters available yet!\n\n' +
            'When server owners create characters and set them as **public**, they will appear here for other servers to add.'
          )
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }
      
      const totalPages = Math.ceil(allPublicChars.length / ITEMS_PER_PAGE);
      const currentPage = Math.max(1, Math.min(page, totalPages));
      const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
      const pageChars = allPublicChars.slice(startIdx, startIdx + ITEMS_PER_PAGE);
      
      const charList = pageChars.map((c, i) => {
        const idx = startIdx + i + 1;
        const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
        const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
        const sourceIcon = c.source === 'global' ? '👑' : '🌐';
        return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\``;
      }).join('\n');
      
      const embed = new EmbedBuilder()
        .setColor(0x00D9FF)
        .setTitle(`Public Characters (${allPublicChars.length})`)
        .setDescription(charList)
        .addFields(
          { name: 'How to Add', value: 'Use `!characters add <ID>` to add a character to your server\'s drop pool!' },
          { name: 'Legend', value: '👑 Official | 🌐 Community-created' }
        )
        .setFooter({ text: `Page ${currentPage}/${totalPages} | Use !publicchars <page> to browse` })
        .setTimestamp();
      
      const row = new ActionRowBuilder();
      
      if (currentPage > 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`pubchars_page_${currentPage - 1}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
        );
      }
      
      if (currentPage < totalPages) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`pubchars_page_${currentPage + 1}`)
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
          const newPageChars = allPublicChars.slice((newPage - 1) * ITEMS_PER_PAGE, newPage * ITEMS_PER_PAGE);
          
          const newCharList = newPageChars.map((c, i) => {
            const idx = (newPage - 1) * ITEMS_PER_PAGE + i + 1;
            const rarityEmoji = RARITY_EMOJIS[c.rarity] || '⚪';
            const uniqueId = c.uniqueId || c._id?.toString().slice(-6) || 'N/A';
            const sourceIcon = c.source === 'global' ? '👑' : '🌐';
            return `\`${idx}.\` ${sourceIcon} ${c.emoji} **${c.name}** ${rarityEmoji} \`ID: ${uniqueId}\``;
          }).join('\n');
          
          const newEmbed = new EmbedBuilder()
            .setColor(0x00D9FF)
            .setTitle(`Public Characters (${allPublicChars.length})`)
            .setDescription(newCharList)
            .addFields(
              { name: 'How to Add', value: 'Use `!characters add <ID>` to add a character to your server\'s drop pool!' },
              { name: 'Legend', value: '👑 Official | 🌐 Community-created' }
            )
            .setFooter({ text: `Page ${newPage}/${totalPages} | Use !publicchars <page> to browse` })
            .setTimestamp();
          
          const newRow = new ActionRowBuilder();
          if (newPage > 1) {
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`pubchars_page_${newPage - 1}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
            );
          }
          if (newPage < totalPages) {
            newRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`pubchars_page_${newPage + 1}`)
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
      console.error('Error listing public characters:', error);
      return message.reply('An error occurred while fetching public characters.');
    }
  }
};
