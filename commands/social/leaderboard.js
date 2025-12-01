const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getTopCoins, getTopGems, getTopBattles, getTopCollectors, getTopTrophies, formatLeaderboard } = require('../../leaderboardSystem.js');

const LEADERBOARD_TYPES = {
  coins: { name: 'Coins', emoji: '💰', getter: getTopCoins },
  gems: { name: 'Gems', emoji: '💎', getter: getTopGems },
  battles: { name: 'Battle Wins', emoji: '⚔️', getter: getTopBattles },
  collectors: { name: 'Collection', emoji: '🦁', getter: getTopCollectors },
  trophies: { name: 'Trophies', emoji: '🏆', getter: getTopTrophies }
};

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top', 'rankings'],
  category: 'social',
  description: 'View the server leaderboard',
  usage: '!leaderboard [type]',
  
  async execute({ message, args, data, client }) {
    let type = 'coins';
    
    if (args[0]) {
      const requestedType = args[0].toLowerCase();
      if (LEADERBOARD_TYPES[requestedType]) {
        type = requestedType;
      }
    }
    
    const typeInfo = LEADERBOARD_TYPES[type];
    const topUsers = typeInfo.getter(data, 10);
    
    if (!topUsers || topUsers.length === 0) {
      return message.reply(`❌ No data available for the ${typeInfo.name} leaderboard yet!`);
    }
    
    const leaderboardLines = await Promise.all(
      topUsers.map(async (entry, index) => {
        let username = 'Unknown User';
        try {
          const user = await client.users.fetch(entry.id);
          username = user.username;
        } catch {}
        
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`${index + 1}.\``;
        return `${medal} **${username}** - ${typeInfo.emoji} ${entry.value.toLocaleString()}`;
      })
    );
    
    const userRank = topUsers.findIndex(u => u.id === message.author.id);
    const userData = data.users[message.author.id];
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`${typeInfo.emoji} ${typeInfo.name} Leaderboard`)
      .setDescription(leaderboardLines.join('\n'))
      .setTimestamp();
    
    if (userRank >= 0) {
      embed.setFooter({ text: `Your rank: #${userRank + 1}` });
    } else if (userData) {
      embed.setFooter({ text: 'Keep playing to get on the leaderboard!' });
    }
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('leaderboard_type')
      .setPlaceholder('Select leaderboard type')
      .addOptions(
        Object.entries(LEADERBOARD_TYPES).map(([key, info]) => ({
          label: info.name,
          value: key,
          emoji: info.emoji,
          default: key === type
        }))
      );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    return message.reply({ embeds: [embed], components: [row] });
  }
};
