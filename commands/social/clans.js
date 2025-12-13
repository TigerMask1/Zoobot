const { EmbedBuilder } = require('discord.js');
const clanSystem = require('../../clanSystem.js');

module.exports = {
  name: 'clans',
  aliases: ['clanleaderboard', 'clanlb', 'topclans'],
  category: 'social',
  description: 'View the clan leaderboard',
  usage: '!clans [page]',
  
  async execute({ message, args, data }) {
    const serverId = message.guild?.id;
    const page = parseInt(args[0]) || 1;
    
    const leaderboard = await clanSystem.formatClanLeaderboard(data, page, serverId);
    
    if (typeof leaderboard === 'string') {
      return message.reply(leaderboard);
    }
    
    return message.reply({ embeds: [leaderboard] });
  }
};
