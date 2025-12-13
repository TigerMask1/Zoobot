const { EmbedBuilder } = require('discord.js');
const { initializeUserData, formatNumber } = require('../../utils/shared.js');
const clanSystem = require('../../clanSystem.js');

module.exports = {
  name: 'clan',
  aliases: ['clanprofile', 'myclan'],
  category: 'social',
  description: 'View your clan profile or clan information',
  usage: '!clan [clanname]',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    const serverId = message.guild?.id;
    
    // If no args, show user's clan
    if (!args.length) {
      if (!userData.clanId) {
        const embed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('🏰 No Clan')
          .setDescription(
            'You are not in a clan yet!\n\n' +
            '**Join a clan:**\n' +
            '`!joinclan <clanname>` - Join an existing clan\n\n' +
            '**View clans:**\n' +
            '`!clans` - See clan leaderboard'
          );
        return message.reply({ embeds: [embed] });
      }
      
      // Show user's clan info
      const clanProfile = await clanSystem.formatClanProfile(userData.clanId, serverId);
      
      if (typeof clanProfile === 'string') {
        return message.reply(clanProfile);
      }
      
      return message.reply({ embeds: [clanProfile] });
    }
    
    // Search for a specific clan
    const clanName = args.join(' ');
    const clan = clanSystem.findClanByName(clanName, data);
    
    if (!clan) {
      return message.reply(`❌ Clan "${clanName}" not found!`);
    }
    
    const clanProfile = await clanSystem.formatClanProfile(clan.id, serverId);
    
    if (typeof clanProfile === 'string') {
      return message.reply(clanProfile);
    }
    
    return message.reply({ embeds: [clanProfile] });
  }
};
