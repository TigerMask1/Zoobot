const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { initializeUserData, parseUserMention } = require('../../utils/shared.js');

const CHARACTERS_PER_PAGE = 10;

module.exports = {
  name: 'collection',
  aliases: ['chars', 'characters', 'col'],
  category: 'characters',
  description: 'View your character collection',
  usage: '!collection [@user] [page]',
  
  async execute({ message, args, data }) {
    let targetId = message.author.id;
    let targetUser = message.author;
    let page = 1;
    
    for (const arg of args) {
      const mentioned = parseUserMention(arg);
      if (mentioned) {
        targetId = mentioned;
        try {
          targetUser = await message.client.users.fetch(targetId);
        } catch {
          return message.reply('❌ Could not find that user!');
        }
      } else {
        const pageNum = parseInt(arg);
        if (!isNaN(pageNum) && pageNum > 0) {
          page = pageNum;
        }
      }
    }
    
    const userData = initializeUserData(targetId, data);
    const characters = userData.characters || [];
    
    if (characters.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF6B6B)
        .setTitle(`🦁 ${targetUser.username}'s Collection`)
        .setDescription(targetId === message.author.id 
          ? 'You don\'t have any characters yet! Use `!start` to begin your journey.'
          : 'This user doesn\'t have any characters yet.')
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
    
    const totalPages = Math.ceil(characters.length / CHARACTERS_PER_PAGE);
    page = Math.max(1, Math.min(page, totalPages));
    
    const startIndex = (page - 1) * CHARACTERS_PER_PAGE;
    const endIndex = Math.min(startIndex + CHARACTERS_PER_PAGE, characters.length);
    const pageChars = characters.slice(startIndex, endIndex);
    
    const charList = pageChars.map((char, index) => {
      const charNum = startIndex + index + 1;
      const level = char.level || 1;
      const tokens = char.tokens || 0;
      const skinIndicator = char.equippedSkin ? ' 🎨' : '';
      return `\`${charNum}.\` ${char.emoji || '🦁'} **${char.name}** Lv.${level}${skinIndicator} | 🎫 ${tokens}`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🦁 ${targetUser.username}'s Collection`)
      .setDescription(charList)
      .addFields(
        { name: 'Total Characters', value: `${characters.length}`, inline: true },
        { name: 'Page', value: `${page}/${totalPages}`, inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Use !char <name/number> to view details' })
      .setTimestamp();
    
    const components = [];
    if (totalPages > 1) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`collection_prev_${targetId}_${page}`)
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId(`collection_page_${targetId}_${page}`)
          .setLabel(`${page}/${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`collection_next_${targetId}_${page}`)
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages)
      );
      components.push(row);
    }
    
    return message.reply({ embeds: [embed], components });
  }
};
