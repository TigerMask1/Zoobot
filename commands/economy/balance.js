const { EmbedBuilder } = require('discord.js');
const { initializeUserData, formatNumber, parseUserMention } = require('../../utils/shared.js');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'coins', 'money'],
  category: 'economy',
  description: 'Check your or another user\'s balance',
  usage: '!balance [@user]',
  
  async execute({ message, args, data }) {
    let targetId = message.author.id;
    let targetUser = message.author;
    
    if (args[0]) {
      const mentioned = parseUserMention(args[0]);
      if (mentioned) {
        targetId = mentioned;
        try {
          targetUser = await message.client.users.fetch(targetId);
        } catch {
          return message.reply('❌ Could not find that user!');
        }
      }
    }
    
    const userData = initializeUserData(targetId, data);
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`💰 ${targetUser.username}'s Balance`)
      .addFields(
        { name: '💰 Coins', value: formatNumber(userData.coins || 0), inline: true },
        { name: '💎 Gems', value: formatNumber(userData.gems || 0), inline: true },
        { name: '🏆 Trophies', value: formatNumber(userData.trophies || 0), inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Requested by ${message.author.username}` })
      .setTimestamp();
    
    if (userData.ust && userData.ust > 0) {
      embed.addFields({ name: '🌟 UST', value: formatNumber(userData.ust), inline: true });
    }
    
    return message.reply({ embeds: [embed] });
  }
};
