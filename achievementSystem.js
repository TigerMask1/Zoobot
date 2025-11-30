const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const ACHIEVEMENTS = {
  first_catch: {
    id: 'first_catch',
    name: 'First Catch',
    emoji: '🎯',
    description: 'Catch your first drop',
    category: 'drops',
    tier: 'bronze',
    requirement: 1,
    trackField: 'dropsCaught'
  },
  drop_hunter: {
    id: 'drop_hunter',
    name: 'Drop Hunter',
    emoji: '🏹',
    description: 'Catch 100 drops',
    category: 'drops',
    tier: 'silver',
    requirement: 100,
    trackField: 'dropsCaught'
  },
  drop_master: {
    id: 'drop_master',
    name: 'Drop Master',
    emoji: '🎪',
    description: 'Catch 500 drops',
    category: 'drops',
    tier: 'gold',
    requirement: 500,
    trackField: 'dropsCaught'
  },
  first_trade: {
    id: 'first_trade',
    name: 'First Trade',
    emoji: '🤝',
    description: 'Complete your first trade',
    category: 'trading',
    tier: 'bronze',
    requirement: 1,
    trackField: 'tradesCompleted'
  },
  trader: {
    id: 'trader',
    name: 'Active Trader',
    emoji: '💹',
    description: 'Complete 50 trades',
    category: 'trading',
    tier: 'silver',
    requirement: 50,
    trackField: 'tradesCompleted'
  },
  master_trader: {
    id: 'master_trader',
    name: 'Master Trader',
    emoji: '🏛️',
    description: 'Complete 200 trades',
    category: 'trading',
    tier: 'gold',
    requirement: 200,
    trackField: 'tradesCompleted'
  },
  first_victory: {
    id: 'first_victory',
    name: 'First Victory',
    emoji: '⚔️',
    description: 'Win your first battle',
    category: 'battles',
    tier: 'bronze',
    requirement: 1,
    trackField: 'battlesWon'
  },
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    emoji: '🗡️',
    description: 'Win 50 battles',
    category: 'battles',
    tier: 'silver',
    requirement: 50,
    trackField: 'battlesWon'
  },
  battle_legend: {
    id: 'battle_legend',
    name: 'Battle Legend',
    emoji: '👑',
    description: 'Win 200 battles',
    category: 'battles',
    tier: 'gold',
    requirement: 200,
    trackField: 'battlesWon'
  },
  collector_5: {
    id: 'collector_5',
    name: 'Starter Collector',
    emoji: '📦',
    description: 'Own 5 unique characters',
    category: 'collection',
    tier: 'bronze',
    requirement: 5,
    trackField: 'characterCount'
  },
  collector_25: {
    id: 'collector_25',
    name: 'Collector',
    emoji: '🎭',
    description: 'Own 25 unique characters',
    category: 'collection',
    tier: 'silver',
    requirement: 25,
    trackField: 'characterCount'
  },
  collector_50: {
    id: 'collector_50',
    name: 'Master Collector',
    emoji: '🏆',
    description: 'Own all 51 characters',
    category: 'collection',
    tier: 'gold',
    requirement: 51,
    trackField: 'characterCount'
  },
  rich_1k: {
    id: 'rich_1k',
    name: 'Getting Started',
    emoji: '💵',
    description: 'Have 1,000 coins',
    category: 'economy',
    tier: 'bronze',
    requirement: 1000,
    trackField: 'coins'
  },
  rich_100k: {
    id: 'rich_100k',
    name: 'Wealthy',
    emoji: '💰',
    description: 'Have 100,000 coins',
    category: 'economy',
    tier: 'silver',
    requirement: 100000,
    trackField: 'coins'
  },
  millionaire: {
    id: 'millionaire',
    name: 'Millionaire',
    emoji: '🤑',
    description: 'Have 1,000,000 coins',
    category: 'economy',
    tier: 'gold',
    requirement: 1000000,
    trackField: 'coins'
  },
  streak_7: {
    id: 'streak_7',
    name: 'Week Warrior',
    emoji: '🔥',
    description: 'Achieve a 7-day daily streak',
    category: 'daily',
    tier: 'bronze',
    requirement: 7,
    trackField: 'highestDailyStreak'
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Master',
    emoji: '⚡',
    description: 'Achieve a 30-day daily streak',
    category: 'daily',
    tier: 'silver',
    requirement: 30,
    trackField: 'highestDailyStreak'
  },
  streak_100: {
    id: 'streak_100',
    name: 'Dedication Legend',
    emoji: '💎',
    description: 'Achieve a 100-day daily streak',
    category: 'daily',
    tier: 'gold',
    requirement: 100,
    trackField: 'highestDailyStreak'
  },
  crate_opener: {
    id: 'crate_opener',
    name: 'Crate Opener',
    emoji: '📦',
    description: 'Open 10 crates',
    category: 'crates',
    tier: 'bronze',
    requirement: 10,
    trackField: 'cratesOpened'
  },
  crate_addict: {
    id: 'crate_addict',
    name: 'Crate Addict',
    emoji: '🎁',
    description: 'Open 100 crates',
    category: 'crates',
    tier: 'silver',
    requirement: 100,
    trackField: 'cratesOpened'
  },
  crate_legend: {
    id: 'crate_legend',
    name: 'Crate Legend',
    emoji: '✨',
    description: 'Open 500 crates',
    category: 'crates',
    tier: 'gold',
    requirement: 500,
    trackField: 'cratesOpened'
  }
};

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700'
};

const TIER_EMOJIS = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇'
};

function initializeAchievementData(userData) {
  if (!userData.achievements) {
    userData.achievements = {};
  }
  return userData.achievements;
}

function getFieldValue(userData, trackField) {
  switch (trackField) {
    case 'dropsCaught':
      return userData.questProgress?.dropsCaught || 0;
    case 'tradesCompleted':
      return userData.questProgress?.tradesCompleted || 0;
    case 'battlesWon':
      return userData.questProgress?.battlesWon || 0;
    case 'cratesOpened':
      return userData.questProgress?.cratesOpened || 0;
    case 'characterCount':
      return userData.characters?.length || 0;
    case 'coins':
      return userData.coins || 0;
    case 'highestDailyStreak':
      return userData.highestDailyStreak || 0;
    default:
      return 0;
  }
}

function checkAchievements(userData, client = null) {
  initializeAchievementData(userData);
  
  const newlyEarned = [];
  
  Object.values(ACHIEVEMENTS).forEach(achievement => {
    if (userData.achievements[achievement.id]) return;
    
    const currentValue = getFieldValue(userData, achievement.trackField);
    
    if (currentValue >= achievement.requirement) {
      userData.achievements[achievement.id] = {
        earnedAt: Date.now(),
        value: currentValue
      };
      newlyEarned.push(achievement);
    }
  });
  
  return newlyEarned;
}

function getEarnedAchievements(userData) {
  initializeAchievementData(userData);
  
  return Object.entries(ACHIEVEMENTS)
    .filter(([id]) => userData.achievements[id])
    .map(([id, achievement]) => ({
      ...achievement,
      earnedAt: userData.achievements[id].earnedAt
    }));
}

function getAchievementProgress(userData) {
  initializeAchievementData(userData);
  
  return Object.values(ACHIEVEMENTS).map(achievement => {
    const currentValue = getFieldValue(userData, achievement.trackField);
    const earned = !!userData.achievements[achievement.id];
    const progress = Math.min(currentValue / achievement.requirement, 1);
    
    return {
      ...achievement,
      currentValue,
      earned,
      progress,
      earnedAt: earned ? userData.achievements[achievement.id].earnedAt : null
    };
  });
}

async function displayAchievements(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const achievements = getAchievementProgress(userData);
  
  const categories = {
    drops: { name: '🎯 Drops', items: [] },
    trading: { name: '🤝 Trading', items: [] },
    battles: { name: '⚔️ Battles', items: [] },
    collection: { name: '🎭 Collection', items: [] },
    economy: { name: '💰 Economy', items: [] },
    daily: { name: '🔥 Daily Streak', items: [] },
    crates: { name: '📦 Crates', items: [] }
  };
  
  achievements.forEach(a => {
    if (categories[a.category]) {
      categories[a.category].items.push(a);
    }
  });
  
  const earned = achievements.filter(a => a.earned).length;
  const total = achievements.length;
  const percentage = Math.round((earned / total) * 100);
  
  let description = '';
  
  Object.values(categories).forEach(category => {
    if (category.items.length === 0) return;
    
    const categoryAchievements = category.items.map(a => {
      const status = a.earned ? '✅' : '⬜';
      const tierEmoji = TIER_EMOJIS[a.tier];
      const progressText = a.earned ? '' : ` (${a.currentValue}/${a.requirement})`;
      return `${status} ${tierEmoji} **${a.emoji} ${a.name}**${progressText}`;
    }).join('\n');
    
    description += `\n**${category.name}**\n${categoryAchievements}\n`;
  });
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🏅 Achievements - ${message.author.username}`)
    .setDescription(description)
    .addFields(
      { name: '✅ Earned', value: `${earned}/${total}`, inline: true },
      { name: '📊 Completion', value: `${percentage}%`, inline: true }
    )
    .setFooter({ text: 'Keep playing to unlock more achievements!' });
  
  await message.reply({ embeds: [embed] });
}

function formatAchievementBadges(userData, limit = 5) {
  const earned = getEarnedAchievements(userData);
  
  if (earned.length === 0) {
    return 'No badges yet';
  }
  
  const sorted = earned.sort((a, b) => {
    const tierOrder = { gold: 0, silver: 1, bronze: 2 };
    return tierOrder[a.tier] - tierOrder[b.tier];
  });
  
  const display = sorted.slice(0, limit).map(a => a.emoji).join(' ');
  const remaining = earned.length - limit;
  
  return remaining > 0 ? `${display} +${remaining}` : display;
}

async function notifyNewAchievement(channel, userId, achievement) {
  const embed = new EmbedBuilder()
    .setColor(TIER_COLORS[achievement.tier])
    .setTitle('🎉 Achievement Unlocked!')
    .setDescription(`<@${userId}> earned **${achievement.emoji} ${achievement.name}**!`)
    .addFields(
      { name: '📜 Description', value: achievement.description, inline: true },
      { name: '🏅 Tier', value: `${TIER_EMOJIS[achievement.tier]} ${achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}`, inline: true }
    );
  
  await channel.send({ embeds: [embed] });
}

module.exports = {
  ACHIEVEMENTS,
  initializeAchievementData,
  checkAchievements,
  getEarnedAchievements,
  getAchievementProgress,
  displayAchievements,
  formatAchievementBadges,
  notifyNewAchievement,
  TIER_COLORS,
  TIER_EMOJIS
};
