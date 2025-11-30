const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

let leaderboardCache = {
  coins: null,
  gems: null,
  trophies: null,
  battles: null,
  collectors: null,
  streaks: null,
  lastUpdate: null
};

const CACHE_DURATION = 10 * 60 * 1000;
const ITEMS_PER_PAGE = 10;

function shouldRefreshCache() {
  if (!leaderboardCache.lastUpdate) return true;
  return Date.now() - leaderboardCache.lastUpdate > CACHE_DURATION;
}

function refreshGlobalLeaderboards(allUserData) {
  const users = Object.entries(allUserData)
    .filter(([userId, data]) => data.started)
    .map(([userId, data]) => ({
      userId,
      username: data.username || 'Unknown',
      coins: data.coins || 0,
      gems: data.gems || 0,
      trophies: data.trophies || 200,
      battlesWon: data.questProgress?.battlesWon || 0,
      characterCount: data.characters ? data.characters.length : 0,
      dailyStreak: data.dailyStreak || 0,
      highestStreak: data.highestDailyStreak || 0,
      totalDailyClaims: data.totalDailyClaims || 0
    }));

  leaderboardCache.coins = [...users].sort((a, b) => b.coins - a.coins).slice(0, 100);
  leaderboardCache.gems = [...users].sort((a, b) => b.gems - a.gems).slice(0, 100);
  leaderboardCache.trophies = [...users].sort((a, b) => b.trophies - a.trophies).slice(0, 100);
  leaderboardCache.battles = [...users].sort((a, b) => b.battlesWon - a.battlesWon).slice(0, 100);
  leaderboardCache.collectors = [...users].sort((a, b) => b.characterCount - a.characterCount).slice(0, 100);
  leaderboardCache.streaks = [...users].sort((a, b) => b.highestStreak - a.highestStreak).slice(0, 100);
  
  leaderboardCache.lastUpdate = Date.now();
  
  return leaderboardCache;
}

function getGlobalLeaderboard(allUserData, category = 'coins', forceRefresh = false) {
  if (forceRefresh || shouldRefreshCache()) {
    refreshGlobalLeaderboards(allUserData);
  }
  
  return leaderboardCache[category] || [];
}

function getUserRank(allUserData, userId, category = 'coins') {
  if (shouldRefreshCache()) {
    refreshGlobalLeaderboards(allUserData);
  }
  
  const leaderboard = leaderboardCache[category] || [];
  const index = leaderboard.findIndex(u => u.userId === userId);
  
  if (index === -1) return null;
  
  return {
    rank: index + 1,
    user: leaderboard[index],
    total: leaderboard.length
  };
}

function formatGlobalLeaderboard(leaderboard, category, page = 1) {
  const totalPages = Math.ceil(leaderboard.length / ITEMS_PER_PAGE);
  page = Math.max(1, Math.min(page, totalPages));
  
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = leaderboard.slice(start, end);
  
  const medals = ['🥇', '🥈', '🥉'];
  const categoryConfig = {
    coins: { emoji: '💰', field: 'coins', label: 'coins', format: (v) => v.toLocaleString() },
    gems: { emoji: '💎', field: 'gems', label: 'gems', format: (v) => v.toLocaleString() },
    trophies: { emoji: '🏆', field: 'trophies', label: 'trophies', format: (v) => v.toLocaleString() },
    battles: { emoji: '⚔️', field: 'battlesWon', label: 'wins', format: (v) => v.toLocaleString() },
    collectors: { emoji: '🎭', field: 'characterCount', label: 'characters', format: (v) => v.toString() },
    streaks: { emoji: '🔥', field: 'highestStreak', label: 'day streak', format: (v) => v.toString() }
  };
  
  const config = categoryConfig[category];
  
  let lines = [];
  pageItems.forEach((user, index) => {
    const globalRank = start + index + 1;
    const rankDisplay = globalRank <= 3 ? medals[globalRank - 1] : `\`${globalRank}.\``;
    const value = user[config.field];
    lines.push(`${rankDisplay} **${user.username}** - ${config.emoji} ${config.format(value)} ${config.label}`);
  });
  
  return {
    content: lines.join('\n') || 'No players found.',
    page,
    totalPages,
    totalPlayers: leaderboard.length
  };
}

function getCategoryTitle(category) {
  const titles = {
    coins: '💰 Richest Players',
    gems: '💎 Most Gems',
    trophies: '🏆 Trophy Leaders',
    battles: '⚔️ Battle Champions',
    collectors: '🎭 Top Collectors',
    streaks: '🔥 Longest Streaks'
  };
  return titles[category] || '🌍 Global Leaderboard';
}

async function displayGlobalLeaderboard(message, args, data) {
  const validCategories = ['coins', 'gems', 'trophies', 'battles', 'collectors', 'streaks'];
  let category = 'coins';
  let page = 1;
  
  for (const arg of args) {
    if (validCategories.includes(arg.toLowerCase())) {
      category = arg.toLowerCase();
    } else if (!isNaN(parseInt(arg))) {
      page = parseInt(arg);
    }
  }
  
  const leaderboard = getGlobalLeaderboard(data.users, category);
  const formatted = formatGlobalLeaderboard(leaderboard, category, page);
  const userId = message.author.id;
  const userRank = getUserRank(data.users, userId, category);
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🌍 Global Leaderboard - ${getCategoryTitle(category)}`)
    .setDescription(formatted.content)
    .setFooter({ 
      text: `Page ${formatted.page}/${formatted.totalPages} • ${formatted.totalPlayers} players • Updates every 10 min` 
    });
  
  if (userRank) {
    embed.addFields({
      name: '📍 Your Rank',
      value: `#${userRank.rank} of ${userRank.total}`,
      inline: true
    });
  }
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`globalboard_${category}_${Math.max(1, formatted.page - 1)}`)
      .setLabel('◀️ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(formatted.page <= 1),
    new ButtonBuilder()
      .setCustomId(`globalboard_${category}_${Math.min(formatted.totalPages, formatted.page + 1)}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(formatted.page >= formatted.totalPages),
    new ButtonBuilder()
      .setCustomId('globalboard_menu')
      .setLabel('📋 Categories')
      .setStyle(ButtonStyle.Primary)
  );
  
  await message.reply({ embeds: [embed], components: [row] });
}

async function handleGlobalLeaderboardButton(interaction, data) {
  const customId = interaction.customId;
  
  if (customId === 'globalboard_menu') {
    const menuEmbed = new EmbedBuilder()
      .setColor('#00D9FF')
      .setTitle('🌍 Global Leaderboard Categories')
      .setDescription('Use `!globalboard <category>` to view:\n\n' +
        '💰 **coins** - Richest players\n' +
        '💎 **gems** - Most gems\n' +
        '🏆 **trophies** - Trophy leaders\n' +
        '⚔️ **battles** - Most battle wins\n' +
        '🎭 **collectors** - Most characters\n' +
        '🔥 **streaks** - Longest daily streaks');
    
    await interaction.reply({ embeds: [menuEmbed], ephemeral: true });
    return;
  }
  
  const parts = customId.split('_');
  if (parts.length < 3) return;
  
  const category = parts[1];
  const page = parseInt(parts[2]);
  
  const leaderboard = getGlobalLeaderboard(data.users, category);
  const formatted = formatGlobalLeaderboard(leaderboard, category, page);
  const userId = interaction.user.id;
  const userRank = getUserRank(data.users, userId, category);
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🌍 Global Leaderboard - ${getCategoryTitle(category)}`)
    .setDescription(formatted.content)
    .setFooter({ 
      text: `Page ${formatted.page}/${formatted.totalPages} • ${formatted.totalPlayers} players • Updates every 10 min` 
    });
  
  if (userRank) {
    embed.addFields({
      name: '📍 Your Rank',
      value: `#${userRank.rank} of ${userRank.total}`,
      inline: true
    });
  }
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`globalboard_${category}_${Math.max(1, formatted.page - 1)}`)
      .setLabel('◀️ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(formatted.page <= 1),
    new ButtonBuilder()
      .setCustomId(`globalboard_${category}_${Math.min(formatted.totalPages, formatted.page + 1)}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(formatted.page >= formatted.totalPages),
    new ButtonBuilder()
      .setCustomId('globalboard_menu')
      .setLabel('📋 Categories')
      .setStyle(ButtonStyle.Primary)
  );
  
  await interaction.update({ embeds: [embed], components: [row] });
}

module.exports = {
  getGlobalLeaderboard,
  getUserRank,
  formatGlobalLeaderboard,
  displayGlobalLeaderboard,
  handleGlobalLeaderboardButton,
  refreshGlobalLeaderboards,
  getCategoryTitle
};
