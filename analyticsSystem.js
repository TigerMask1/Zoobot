const { EmbedBuilder } = require('discord.js');

function initializeServerAnalytics(data, guildId) {
  if (!data.serverAnalytics) {
    data.serverAnalytics = {};
  }
  
  if (!data.serverAnalytics[guildId]) {
    data.serverAnalytics[guildId] = {
      createdAt: Date.now(),
      stats: {
        dropsClaimed: 0,
        battlesPlayed: 0,
        tradesCompleted: 0,
        cratesOpened: 0,
        coinsEarned: 0,
        gemsSpent: 0,
        charactersCollected: 0,
        dailysClaimed: 0
      },
      daily: {},
      activePlayers: new Set()
    };
  }
  
  return data.serverAnalytics[guildId];
}

function getDateKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function recordEvent(data, guildId, eventType, amount = 1, userId = null) {
  const analytics = initializeServerAnalytics(data, guildId);
  const dateKey = getDateKey();
  
  if (!analytics.daily[dateKey]) {
    analytics.daily[dateKey] = {
      dropsClaimed: 0,
      battlesPlayed: 0,
      tradesCompleted: 0,
      cratesOpened: 0,
      coinsEarned: 0,
      gemsSpent: 0,
      charactersCollected: 0,
      dailysClaimed: 0,
      activePlayers: []
    };
  }
  
  if (analytics.stats[eventType] !== undefined) {
    analytics.stats[eventType] += amount;
  }
  
  if (analytics.daily[dateKey][eventType] !== undefined) {
    analytics.daily[dateKey][eventType] += amount;
  }
  
  if (userId && !analytics.daily[dateKey].activePlayers.includes(userId)) {
    analytics.daily[dateKey].activePlayers.push(userId);
  }
  
  cleanOldData(analytics);
}

function cleanOldData(analytics) {
  const keys = Object.keys(analytics.daily).sort();
  while (keys.length > 14) {
    const oldestKey = keys.shift();
    delete analytics.daily[oldestKey];
  }
}

function getLast7DaysStats(data, guildId) {
  const analytics = initializeServerAnalytics(data, guildId);
  const now = new Date();
  const stats = {
    dropsClaimed: 0,
    battlesPlayed: 0,
    tradesCompleted: 0,
    cratesOpened: 0,
    coinsEarned: 0,
    gemsSpent: 0,
    charactersCollected: 0,
    dailysClaimed: 0,
    uniquePlayers: new Set()
  };
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    
    if (analytics.daily[dateKey]) {
      const day = analytics.daily[dateKey];
      stats.dropsClaimed += day.dropsClaimed || 0;
      stats.battlesPlayed += day.battlesPlayed || 0;
      stats.tradesCompleted += day.tradesCompleted || 0;
      stats.cratesOpened += day.cratesOpened || 0;
      stats.coinsEarned += day.coinsEarned || 0;
      stats.gemsSpent += day.gemsSpent || 0;
      stats.charactersCollected += day.charactersCollected || 0;
      stats.dailysClaimed += day.dailysClaimed || 0;
      
      if (day.activePlayers) {
        day.activePlayers.forEach(p => stats.uniquePlayers.add(p));
      }
    }
  }
  
  stats.activePlayerCount = stats.uniquePlayers.size;
  delete stats.uniquePlayers;
  
  return stats;
}

function getTodayStats(data, guildId) {
  const analytics = initializeServerAnalytics(data, guildId);
  const dateKey = getDateKey();
  
  if (!analytics.daily[dateKey]) {
    return {
      dropsClaimed: 0,
      battlesPlayed: 0,
      tradesCompleted: 0,
      cratesOpened: 0,
      coinsEarned: 0,
      gemsSpent: 0,
      charactersCollected: 0,
      dailysClaimed: 0,
      activePlayers: 0
    };
  }
  
  const day = analytics.daily[dateKey];
  return {
    ...day,
    activePlayers: day.activePlayers?.length || 0
  };
}

function createSparkline(values, length = 7) {
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  while (values.length < length) {
    values.unshift(0);
  }
  values = values.slice(-length);
  
  const max = Math.max(...values, 1);
  
  return values.map(v => {
    const idx = Math.floor((v / max) * (chars.length - 1));
    return chars[idx];
  }).join('');
}

function getDailyTrend(data, guildId, field) {
  const analytics = initializeServerAnalytics(data, guildId);
  const now = new Date();
  const values = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    
    const dayData = analytics.daily[dateKey];
    values.push(dayData ? (dayData[field] || 0) : 0);
  }
  
  return values;
}

async function displayServerStats(message, data) {
  const guildId = message.guild.id;
  
  const weekStats = getLast7DaysStats(data, guildId);
  const todayStats = getTodayStats(data, guildId);
  const analytics = initializeServerAnalytics(data, guildId);
  
  const dropsTrend = getDailyTrend(data, guildId, 'dropsClaimed');
  const battlesTrend = getDailyTrend(data, guildId, 'battlesPlayed');
  const playersTrend = getDailyTrend(data, guildId, 'activePlayers').map(d => 
    typeof d === 'number' ? d : (Array.isArray(d) ? d.length : 0)
  );
  
  const embed = new EmbedBuilder()
    .setColor('#00D9FF')
    .setTitle(`📊 Server Stats - ${message.guild.name}`)
    .setDescription(`Analytics for the last 7 days`)
    .addFields(
      { name: '👥 Active Players', value: `Today: ${todayStats.activePlayers}\nWeek: ${weekStats.activePlayerCount}\n${createSparkline(playersTrend)}`, inline: true },
      { name: '🎯 Drops Claimed', value: `Today: ${todayStats.dropsClaimed}\nWeek: ${weekStats.dropsClaimed}\n${createSparkline(dropsTrend)}`, inline: true },
      { name: '⚔️ Battles Played', value: `Today: ${todayStats.battlesPlayed}\nWeek: ${weekStats.battlesPlayed}\n${createSparkline(battlesTrend)}`, inline: true },
      { name: '🤝 Trades', value: `Week: ${weekStats.tradesCompleted}`, inline: true },
      { name: '📦 Crates Opened', value: `Week: ${weekStats.cratesOpened}`, inline: true },
      { name: '📅 Dailys Claimed', value: `Week: ${weekStats.dailysClaimed}`, inline: true },
      { name: '💰 Coins Earned', value: `Week: ${weekStats.coinsEarned.toLocaleString()}`, inline: true },
      { name: '💎 Gems Spent', value: `Week: ${weekStats.gemsSpent.toLocaleString()}`, inline: true },
      { name: '🎭 New Characters', value: `Week: ${weekStats.charactersCollected}`, inline: true }
    )
    .setFooter({ text: `Tracking since ${new Date(analytics.createdAt).toLocaleDateString()} • Sparklines show 7-day trend` })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
}

module.exports = {
  initializeServerAnalytics,
  recordEvent,
  getLast7DaysStats,
  getTodayStats,
  getDailyTrend,
  displayServerStats,
  createSparkline,
  getDateKey
};
