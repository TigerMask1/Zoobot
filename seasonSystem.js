const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const SEASON_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const DAILY_RESET_HOUR_UTC = 0;
const DAILY_RESET_MINUTE_UTC = 0;

const SEASON_THEMES = {
  winter: {
    months: [12, 1, 2],
    names: ['Frostfall Festival', 'Winter Wonderland', 'Ice Crystal Celebration', 'Snowflake Spectacular'],
    emoji: '❄️',
    color: '#87CEEB'
  },
  spring: {
    months: [3, 4, 5],
    names: ['Blossom Bloom', 'Spring Awakening', 'Flower Power Festival', 'Renewal Rush'],
    emoji: '🌸',
    color: '#FF69B4'
  },
  summer: {
    months: [6, 7, 8],
    names: ['Sizzling Summer', 'Tropical Thunder', 'Beach Bash Bonanza', 'Sunfire Showdown'],
    emoji: '☀️',
    color: '#FFD700'
  },
  autumn: {
    months: [9, 10, 11],
    names: ['Harvest Homecoming', 'Autumn Adventure', 'Falling Leaves Festival', 'Pumpkin Pursuit'],
    emoji: '🍂',
    color: '#FF8C00'
  }
};

const SPECIAL_EVENTS = {
  '12-25': { name: 'Holiday Miracle', emoji: '🎄', color: '#228B22' },
  '10-31': { name: 'Spooky Spectacular', emoji: '🎃', color: '#FF4500' },
  '02-14': { name: 'Heartfelt Heroes', emoji: '💕', color: '#FF1493' },
  '01-01': { name: 'New Year Kickoff', emoji: '🎉', color: '#FFD700' },
  '07-04': { name: 'Firecracker Frenzy', emoji: '🎆', color: '#FF0000' }
};

const LEVEL_REQUIREMENTS = [
  100, 150, 200, 250, 300,
  400, 500, 600, 700, 800,
  950, 1100, 1250, 1400, 1600,
  1800, 2000, 2250, 2500, 2800,
  3100, 3400, 3700, 4100, 4500,
  5000, 5500, 6000, 6600, 7200,
  7900, 8600, 9400, 10200, 11100,
  12000, 13000, 14000, 15200, 16500
];

function getSeasonRewards(seasonTheme) {
  const baseRewards = {
    1: { coins: 100, gems: 5 },
    2: { coins: 150, gems: 8 },
    3: { coins: 200, gems: 10 },
    4: { coins: 250, gems: 12 },
    5: { coins: 500, gems: 25, bronzeCrates: 1, milestone: true },
    6: { coins: 300, gems: 15 },
    7: { coins: 350, gems: 18 },
    8: { coins: 400, gems: 20 },
    9: { coins: 450, gems: 22 },
    10: { coins: 750, gems: 40, silverCrates: 1, shards: 2, milestone: true },
    11: { coins: 500, gems: 25 },
    12: { coins: 550, gems: 28 },
    13: { coins: 600, gems: 30 },
    14: { coins: 650, gems: 32 },
    15: { coins: 1000, gems: 50, goldCrates: 1, shards: 3, milestone: true },
    16: { coins: 700, gems: 35 },
    17: { coins: 750, gems: 38 },
    18: { coins: 800, gems: 40 },
    19: { coins: 850, gems: 42 },
    20: { coins: 1500, gems: 75, emeraldCrates: 1, shards: 5, milestone: true },
    21: { coins: 900, gems: 45 },
    22: { coins: 950, gems: 48 },
    23: { coins: 1000, gems: 50 },
    24: { coins: 1050, gems: 52 },
    25: { coins: 2000, gems: 100, tyrantCrates: 1, shards: 8, milestone: true },
    26: { coins: 1100, gems: 55 },
    27: { coins: 1150, gems: 58 },
    28: { coins: 1200, gems: 60 },
    29: { coins: 1250, gems: 62 },
    30: { coins: 2500, gems: 125, emeraldCrates: 2, shards: 10, stBoosters: 1, milestone: true },
    31: { coins: 1300, gems: 65 },
    32: { coins: 1350, gems: 68 },
    33: { coins: 1400, gems: 70 },
    34: { coins: 1450, gems: 72 },
    35: { coins: 3000, gems: 150, tyrantCrates: 1, shards: 12, stBoosters: 2, milestone: true },
    36: { coins: 1500, gems: 75 },
    37: { coins: 1550, gems: 78 },
    38: { coins: 1600, gems: 80 },
    39: { coins: 1700, gems: 85 },
    40: { coins: 5000, gems: 300, tyrantCrates: 2, shards: 25, stBoosters: 3, ust: 100, grandPrize: true, milestone: true }
  };
  return baseRewards;
}

const TASK_POOL = {
  easy: [
    { id: 'catch_drops', name: 'Drop Catcher', description: 'Catch {count} drops', type: 'dropsCaught', count: 2, points: 15 },
    { id: 'claim_daily', name: 'Daily Devotion', description: 'Claim your daily reward', type: 'dailyClaimed', count: 1, points: 10 },
    { id: 'view_profile', name: 'Self Reflection', description: 'Check your profile', type: 'profileViewed', count: 1, points: 10 },
    { id: 'open_crate', name: 'Treasure Hunter', description: 'Open any crate', type: 'cratesOpened', count: 1, points: 15 },
    { id: 'check_chars', name: 'Collection Check', description: 'View your characters', type: 'charsViewed', count: 1, points: 10 },
    { id: 'battle_once', name: 'Quick Skirmish', description: 'Participate in 1 battle', type: 'battlesParticipated', count: 1, points: 15 },
    { id: 'send_message', name: 'Social Butterfly', description: 'Send {count} messages', type: 'messagesSent', count: 10, points: 10 }
  ],
  medium: [
    { id: 'catch_drops_med', name: 'Drop Hunter', description: 'Catch {count} drops', type: 'dropsCaught', count: 5, points: 30 },
    { id: 'win_battle', name: 'Victorious', description: 'Win {count} battle', type: 'battlesWon', count: 1, points: 35 },
    { id: 'open_crates_med', name: 'Crate Collector', description: 'Open {count} crates', type: 'cratesOpened', count: 3, points: 30 },
    { id: 'trade_complete', name: 'Merchant', description: 'Complete a trade', type: 'tradesCompleted', count: 1, points: 35 },
    { id: 'earn_coins', name: 'Gold Digger', description: 'Earn {count} coins', type: 'coinsEarned', count: 500, points: 25 },
    { id: 'level_up_char', name: 'Power Trainer', description: 'Level up any character', type: 'levelsGained', count: 1, points: 35 },
    { id: 'use_work', name: 'Hard Worker', description: 'Complete {count} work sessions', type: 'workCompleted', count: 2, points: 30 }
  ],
  hard: [
    { id: 'catch_drops_hard', name: 'Drop Master', description: 'Catch {count} drops', type: 'dropsCaught', count: 10, points: 60 },
    { id: 'win_battles_hard', name: 'Champion', description: 'Win {count} battles', type: 'battlesWon', count: 3, points: 65 },
    { id: 'open_rare_crate', name: 'Rare Finder', description: 'Open a Gold+ crate', type: 'raresCratesOpened', count: 1, points: 55 },
    { id: 'streak_battle', name: 'Undefeated', description: 'Win {count} battles in a row', type: 'winStreak', count: 2, points: 70 },
    { id: 'complete_quest', name: 'Quest Master', description: 'Complete any quest', type: 'questsCompleted', count: 1, points: 50 },
    { id: 'earn_coins_hard', name: 'Wealthy', description: 'Earn {count} coins', type: 'coinsEarned', count: 2000, points: 55 },
    { id: 'max_boost', name: 'Booster Pro', description: 'Use an ST Booster', type: 'boostersUsed', count: 1, points: 60 }
  ]
};

function getSeasonInfo(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dateKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  if (SPECIAL_EVENTS[dateKey]) {
    return SPECIAL_EVENTS[dateKey];
  }
  
  for (const [season, config] of Object.entries(SEASON_THEMES)) {
    if (config.months.includes(month)) {
      const weekOfMonth = Math.ceil(day / 7);
      const nameIndex = (weekOfMonth - 1) % config.names.length;
      return {
        name: config.names[nameIndex],
        emoji: config.emoji,
        color: config.color,
        season: season
      };
    }
  }
  
  return SEASON_THEMES.winter;
}

function getSeasonStartDate(date = new Date()) {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const weekNumber = Math.floor(date.getUTCDate() / 14);
  
  const seasonStart = new Date(date);
  seasonStart.setUTCDate(date.getUTCDate() - daysSinceMonday - (weekNumber % 2) * 7);
  seasonStart.setUTCHours(0, 0, 0, 0);
  
  return seasonStart;
}

function getCurrentSeasonId(date = new Date()) {
  const startOfYear = new Date(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const seasonNumber = Math.floor(dayOfYear / 14);
  return `${date.getUTCFullYear()}-S${String(seasonNumber + 1).padStart(2, '0')}`;
}

function getSeasonEndDate(date = new Date()) {
  const startDate = getSeasonStartDate(date);
  const endDate = new Date(startDate.getTime() + SEASON_DURATION_MS);
  return endDate;
}

function getTimeUntilSeasonEnd(date = new Date()) {
  const endDate = getSeasonEndDate(date);
  const diff = endDate - date;
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  return { days, hours, minutes, totalMs: diff };
}

function getDailyResetTime() {
  const now = new Date();
  const resetTime = new Date(now);
  resetTime.setUTCHours(DAILY_RESET_HOUR_UTC, DAILY_RESET_MINUTE_UTC, 0, 0);
  
  if (now >= resetTime) {
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
  }
  
  return resetTime;
}

function getTimeUntilDailyReset() {
  const resetTime = getDailyResetTime();
  const diff = resetTime - new Date();
  
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  return { hours, minutes };
}

function initializeSeasonData(userData) {
  const currentSeasonId = getCurrentSeasonId();
  
  if (!userData.seasonPass) {
    userData.seasonPass = {};
  }
  
  if (!userData.seasonPass[currentSeasonId]) {
    userData.seasonPass[currentSeasonId] = {
      points: 0,
      level: 0,
      claimedRewards: [],
      dailyTasks: null,
      dailyTasksDate: null,
      dailyTaskProgress: {},
      totalPointsEarned: 0
    };
  }
  
  return userData.seasonPass[currentSeasonId];
}

function selectDailyTasks(seed) {
  const random = (s) => {
    const x = Math.sin(s++) * 10000;
    return x - Math.floor(x);
  };
  
  let currentSeed = seed;
  
  const shuffle = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random(currentSeed++) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  const easyTasks = shuffle(TASK_POOL.easy).slice(0, 2);
  const mediumTasks = shuffle(TASK_POOL.medium).slice(0, 2);
  const hardTasks = shuffle(TASK_POOL.hard).slice(0, 1);
  
  return [...easyTasks, ...mediumTasks, ...hardTasks];
}

function getTodaysSeed() {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return utcDate.getTime();
}

function getDailyTasks(userData) {
  const seasonData = initializeSeasonData(userData);
  const todaysSeed = getTodaysSeed();
  const todaysDate = new Date().toISOString().split('T')[0];
  
  if (seasonData.dailyTasksDate !== todaysDate) {
    seasonData.dailyTasks = selectDailyTasks(todaysSeed);
    seasonData.dailyTasksDate = todaysDate;
    seasonData.dailyTaskProgress = {};
    
    seasonData.dailyTasks.forEach(task => {
      seasonData.dailyTaskProgress[task.id] = {
        current: 0,
        completed: false,
        claimed: false
      };
    });
  }
  
  return seasonData.dailyTasks;
}

function updateTaskProgress(userData, taskType, amount = 1) {
  const seasonData = initializeSeasonData(userData);
  getDailyTasks(userData);
  
  if (!seasonData.dailyTasks) return [];
  
  const completedTasks = [];
  
  for (const task of seasonData.dailyTasks) {
    if (task.type !== taskType) continue;
    
    const progress = seasonData.dailyTaskProgress[task.id];
    if (!progress || progress.completed) continue;
    
    progress.current = Math.min(progress.current + amount, task.count);
    
    if (progress.current >= task.count && !progress.completed) {
      progress.completed = true;
      completedTasks.push(task);
    }
  }
  
  return completedTasks;
}

function claimTaskReward(userData, taskId) {
  const seasonData = initializeSeasonData(userData);
  
  if (!seasonData.dailyTaskProgress || !seasonData.dailyTaskProgress[taskId]) {
    return { success: false, message: 'Task not found' };
  }
  
  const progress = seasonData.dailyTaskProgress[taskId];
  const task = seasonData.dailyTasks.find(t => t.id === taskId);
  
  if (!task) {
    return { success: false, message: 'Task not found' };
  }
  
  if (!progress.completed) {
    return { success: false, message: 'Task not completed yet' };
  }
  
  if (progress.claimed) {
    return { success: false, message: 'Reward already claimed' };
  }
  
  progress.claimed = true;
  seasonData.points += task.points;
  seasonData.totalPointsEarned += task.points;
  
  checkLevelUp(userData, seasonData);
  
  return { success: true, points: task.points, task };
}

function claimAllTaskRewards(userData) {
  const seasonData = initializeSeasonData(userData);
  getDailyTasks(userData);
  
  if (!seasonData.dailyTasks) {
    return { success: false, claimed: 0, points: 0 };
  }
  
  let totalPoints = 0;
  let claimedCount = 0;
  const claimedTasks = [];
  
  for (const task of seasonData.dailyTasks) {
    const progress = seasonData.dailyTaskProgress[task.id];
    
    if (progress && progress.completed && !progress.claimed) {
      progress.claimed = true;
      totalPoints += task.points;
      claimedCount++;
      claimedTasks.push(task);
    }
  }
  
  if (claimedCount > 0) {
    seasonData.points += totalPoints;
    seasonData.totalPointsEarned += totalPoints;
    checkLevelUp(userData, seasonData);
  }
  
  return { success: true, claimed: claimedCount, points: totalPoints, tasks: claimedTasks };
}

function checkLevelUp(userData, seasonData) {
  let levelsGained = 0;
  
  while (seasonData.level < 40) {
    const pointsNeeded = getPointsForLevel(seasonData.level + 1);
    if (seasonData.points >= pointsNeeded) {
      seasonData.level++;
      levelsGained++;
    } else {
      break;
    }
  }
  
  return levelsGained;
}

function getPointsForLevel(level) {
  if (level <= 0) return 0;
  if (level > 40) return Infinity;
  
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += LEVEL_REQUIREMENTS[i];
  }
  return total;
}

function getCurrentLevelProgress(seasonData) {
  const currentLevel = seasonData.level;
  const currentPoints = seasonData.points;
  
  if (currentLevel >= 40) {
    return { current: 0, needed: 0, percentage: 100 };
  }
  
  const pointsForCurrentLevel = getPointsForLevel(currentLevel);
  const pointsForNextLevel = getPointsForLevel(currentLevel + 1);
  const pointsNeededForNext = pointsForNextLevel - pointsForCurrentLevel;
  const currentProgress = currentPoints - pointsForCurrentLevel;
  
  return {
    current: currentProgress,
    needed: pointsNeededForNext,
    percentage: Math.min(100, Math.floor((currentProgress / pointsNeededForNext) * 100))
  };
}

function claimSeasonReward(userData, level) {
  const seasonData = initializeSeasonData(userData);
  const rewards = getSeasonRewards();
  
  if (level < 1 || level > 40) {
    return { success: false, message: 'Invalid level' };
  }
  
  if (seasonData.level < level) {
    return { success: false, message: `You need to reach level ${level} first!` };
  }
  
  if (seasonData.claimedRewards.includes(level)) {
    return { success: false, message: 'Reward already claimed' };
  }
  
  const reward = rewards[level];
  if (!reward) {
    return { success: false, message: 'Reward not found' };
  }
  
  seasonData.claimedRewards.push(level);
  
  if (reward.coins) userData.coins = (userData.coins || 0) + reward.coins;
  if (reward.gems) userData.gems = (userData.gems || 0) + reward.gems;
  if (reward.shards) userData.shards = (userData.shards || 0) + reward.shards;
  if (reward.bronzeCrates) userData.bronzeCrates = (userData.bronzeCrates || 0) + reward.bronzeCrates;
  if (reward.silverCrates) userData.silverCrates = (userData.silverCrates || 0) + reward.silverCrates;
  if (reward.goldCrates) userData.goldCrates = (userData.goldCrates || 0) + reward.goldCrates;
  if (reward.emeraldCrates) userData.emeraldCrates = (userData.emeraldCrates || 0) + reward.emeraldCrates;
  if (reward.tyrantCrates) userData.tyrantCrates = (userData.tyrantCrates || 0) + reward.tyrantCrates;
  if (reward.stBoosters) userData.stBoosters = (userData.stBoosters || 0) + reward.stBoosters;
  if (reward.ust) userData.ust = (userData.ust || 0) + reward.ust;
  
  return { success: true, reward, level };
}

function claimAllSeasonRewards(userData) {
  const seasonData = initializeSeasonData(userData);
  const rewards = getSeasonRewards();
  const claimedRewards = [];
  
  for (let level = 1; level <= seasonData.level; level++) {
    if (!seasonData.claimedRewards.includes(level)) {
      const result = claimSeasonReward(userData, level);
      if (result.success) {
        claimedRewards.push({ level, reward: result.reward });
      }
    }
  }
  
  return { success: true, claimed: claimedRewards };
}

function getNextMilestoneReward(seasonData) {
  const milestones = [5, 10, 15, 20, 25, 30, 35, 40];
  const rewards = getSeasonRewards();
  
  for (const level of milestones) {
    if (seasonData.level < level) {
      return {
        level,
        reward: rewards[level],
        levelsAway: level - seasonData.level
      };
    }
  }
  
  return null;
}

function formatReward(reward) {
  const parts = [];
  if (reward.coins) parts.push(`${reward.coins.toLocaleString()} Coins`);
  if (reward.gems) parts.push(`${reward.gems} Gems`);
  if (reward.shards) parts.push(`${reward.shards} Shards`);
  if (reward.bronzeCrates) parts.push(`${reward.bronzeCrates}x Bronze Crate`);
  if (reward.silverCrates) parts.push(`${reward.silverCrates}x Silver Crate`);
  if (reward.goldCrates) parts.push(`${reward.goldCrates}x Gold Crate`);
  if (reward.emeraldCrates) parts.push(`${reward.emeraldCrates}x Emerald Crate`);
  if (reward.tyrantCrates) parts.push(`${reward.tyrantCrates}x Tyrant Crate`);
  if (reward.stBoosters) parts.push(`${reward.stBoosters}x ST Booster`);
  if (reward.ust) parts.push(`${reward.ust} UST`);
  return parts.join(', ');
}

function createSeasonProgressBar(current, max, length = 10) {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function showSeasonPass(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const seasonData = initializeSeasonData(userData);
  const seasonInfo = getSeasonInfo();
  const seasonId = getCurrentSeasonId();
  const timeLeft = getTimeUntilSeasonEnd();
  const progress = getCurrentLevelProgress(seasonData);
  const rewards = getSeasonRewards();
  
  const unclaimedRewards = [];
  for (let i = 1; i <= seasonData.level; i++) {
    if (!seasonData.claimedRewards.includes(i)) {
      unclaimedRewards.push(i);
    }
  }
  
  const nextMilestone = getNextMilestoneReward(seasonData);
  
  const embed = new EmbedBuilder()
    .setColor(seasonInfo.color)
    .setTitle(`${seasonInfo.emoji} ${seasonInfo.name} - Season Pass`)
    .setDescription(`**Season ID:** ${seasonId}\n**Time Remaining:** ${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`)
    .addFields(
      { name: '📊 Level', value: `**${seasonData.level}** / 40`, inline: true },
      { name: '⭐ Points', value: `**${seasonData.points.toLocaleString()}**`, inline: true },
      { name: '🏆 Total Earned', value: `**${seasonData.totalPointsEarned.toLocaleString()}**`, inline: true }
    );
  
  if (seasonData.level < 40) {
    embed.addFields({
      name: '📈 Progress to Next Level',
      value: `${createSeasonProgressBar(progress.current, progress.needed, 15)} ${progress.percentage}%\n${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} points`,
      inline: false
    });
  } else {
    embed.addFields({
      name: '🎉 Season Complete!',
      value: 'You have reached the maximum level! Claim all your rewards!',
      inline: false
    });
  }
  
  if (unclaimedRewards.length > 0) {
    embed.addFields({
      name: '🎁 Unclaimed Rewards',
      value: `**${unclaimedRewards.length}** reward${unclaimedRewards.length > 1 ? 's' : ''} available! Use \`!seasonclaimall\` to claim all!`,
      inline: false
    });
  }
  
  if (nextMilestone && seasonData.level < 40) {
    const lureText = `🔮 **${formatReward(nextMilestone.reward)}** is waiting for you at Level ${nextMilestone.level}!`;
    embed.addFields({
      name: `✨ Next Milestone (${nextMilestone.levelsAway} level${nextMilestone.levelsAway > 1 ? 's' : ''} away)`,
      value: lureText,
      inline: false
    });
  }
  
  embed.setFooter({ text: 'Use !seasontasks to view daily tasks | !seasonrewards to see all rewards' });
  
  await message.reply({ embeds: [embed] });
}

async function showDailyTasks(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const seasonData = initializeSeasonData(userData);
  const tasks = getDailyTasks(userData);
  const seasonInfo = getSeasonInfo();
  const resetTime = getTimeUntilDailyReset();
  
  let completedCount = 0;
  let claimedCount = 0;
  let totalPoints = 0;
  let earnedPoints = 0;
  
  const taskLines = tasks.map((task, index) => {
    const progress = seasonData.dailyTaskProgress[task.id] || { current: 0, completed: false, claimed: false };
    totalPoints += task.points;
    
    let status = '⬜';
    let progressText = `${progress.current}/${task.count}`;
    
    if (progress.claimed) {
      status = '✅';
      claimedCount++;
      completedCount++;
      earnedPoints += task.points;
      progressText = 'Claimed!';
    } else if (progress.completed) {
      status = '🎁';
      completedCount++;
      progressText = 'Ready to claim!';
    }
    
    const difficulty = task.points >= 50 ? '🔴 Hard' : (task.points >= 25 ? '🟡 Medium' : '🟢 Easy');
    const description = task.description.replace('{count}', task.count);
    
    return `${status} **${task.name}** [${difficulty}]\n└ ${description} (${progressText}) - **${task.points}** pts`;
  });
  
  const embed = new EmbedBuilder()
    .setColor(seasonInfo.color)
    .setTitle(`${seasonInfo.emoji} Daily Season Tasks`)
    .setDescription(`Complete tasks to earn Season Pass points!\n\n${taskLines.join('\n\n')}`)
    .addFields(
      { name: '📊 Progress', value: `${completedCount}/5 completed`, inline: true },
      { name: '⭐ Points', value: `${earnedPoints}/${totalPoints} earned`, inline: true },
      { name: '⏰ Resets In', value: `${resetTime.hours}h ${resetTime.minutes}m`, inline: true }
    );
  
  const unclaimedTasks = tasks.filter(t => {
    const p = seasonData.dailyTaskProgress[t.id];
    return p && p.completed && !p.claimed;
  });
  
  if (unclaimedTasks.length > 0) {
    embed.addFields({
      name: '💡 Tip',
      value: `You have **${unclaimedTasks.length}** reward${unclaimedTasks.length > 1 ? 's' : ''} ready to claim! Use \`!taskclaimall\` to claim all!`,
      inline: false
    });
  }
  
  const nextMilestone = getNextMilestoneReward(seasonData);
  if (nextMilestone && seasonData.level < 40) {
    embed.addFields({
      name: '🎯 Next Milestone Goal',
      value: `Complete daily tasks to unlock **${formatReward(nextMilestone.reward)}** at Level ${nextMilestone.level}!`,
      inline: false
    });
  }
  
  embed.setFooter({ text: 'Tasks reset daily at 5:30 AM IST (00:00 UTC)' });
  
  await saveDataImmediate(data);
  await message.reply({ embeds: [embed] });
}

async function showSeasonRewards(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const seasonData = initializeSeasonData(userData);
  const seasonInfo = getSeasonInfo();
  const rewards = getSeasonRewards();
  
  const milestones = [5, 10, 15, 20, 25, 30, 35, 40];
  
  const rewardLines = milestones.map(level => {
    const reward = rewards[level];
    const claimed = seasonData.claimedRewards.includes(level);
    const unlocked = seasonData.level >= level;
    
    let status = '🔒';
    if (claimed) status = '✅';
    else if (unlocked) status = '🎁';
    
    return `${status} **Level ${level}${level === 40 ? ' 🏆' : ''}**\n└ ${formatReward(reward)}`;
  });
  
  const embed = new EmbedBuilder()
    .setColor(seasonInfo.color)
    .setTitle(`${seasonInfo.emoji} Season Pass Milestone Rewards`)
    .setDescription(`Your Level: **${seasonData.level}**/40\n\n${rewardLines.join('\n\n')}`)
    .setFooter({ text: '🔒 = Locked | 🎁 = Claimable | ✅ = Claimed' });
  
  await message.reply({ embeds: [embed] });
}

async function claimTaskRewardCommand(message, data, taskId) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const result = claimTaskReward(userData, taskId);
  
  if (!result.success) {
    await message.reply(`❌ ${result.message}`);
    return;
  }
  
  const seasonData = initializeSeasonData(userData);
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Task Reward Claimed!')
    .setDescription(`**${result.task.name}** completed!`)
    .addFields(
      { name: '⭐ Points Earned', value: `+${result.points}`, inline: true },
      { name: '📊 Total Points', value: `${seasonData.points.toLocaleString()}`, inline: true },
      { name: '📈 Season Level', value: `${seasonData.level}`, inline: true }
    );
  
  const nextMilestone = getNextMilestoneReward(seasonData);
  if (nextMilestone) {
    embed.addFields({
      name: '✨ Keep Going!',
      value: `**${formatReward(nextMilestone.reward)}** awaits you at Level ${nextMilestone.level}!`,
      inline: false
    });
  }
  
  await message.reply({ embeds: [embed] });
}

async function claimAllTaskRewardsCommand(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const result = claimAllTaskRewards(userData);
  
  if (result.claimed === 0) {
    await message.reply('❌ No completed tasks to claim!');
    return;
  }
  
  const seasonData = initializeSeasonData(userData);
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ All Task Rewards Claimed!')
    .setDescription(`Claimed **${result.claimed}** task reward${result.claimed > 1 ? 's' : ''}!`)
    .addFields(
      { name: '⭐ Points Earned', value: `+${result.points}`, inline: true },
      { name: '📊 Total Points', value: `${seasonData.points.toLocaleString()}`, inline: true },
      { name: '📈 Season Level', value: `${seasonData.level}`, inline: true }
    );
  
  const nextMilestone = getNextMilestoneReward(seasonData);
  if (nextMilestone) {
    embed.addFields({
      name: '✨ Next Milestone',
      value: `**${formatReward(nextMilestone.reward)}** at Level ${nextMilestone.level} (${nextMilestone.levelsAway} level${nextMilestone.levelsAway > 1 ? 's' : ''} away)`,
      inline: false
    });
  }
  
  await message.reply({ embeds: [embed] });
}

async function claimSeasonRewardCommand(message, data, level) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const result = claimSeasonReward(userData, level);
  
  if (!result.success) {
    await message.reply(`❌ ${result.message}`);
    return;
  }
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🎁 Level ${level} Reward Claimed!`)
    .setDescription(formatReward(result.reward));
  
  if (result.reward.grandPrize) {
    embed.addFields({
      name: '🏆 GRAND PRIZE!',
      value: 'Congratulations on completing the Season Pass!',
      inline: false
    });
  }
  
  await message.reply({ embeds: [embed] });
}

async function claimAllSeasonRewardsCommand(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const result = claimAllSeasonRewards(userData);
  
  if (result.claimed.length === 0) {
    await message.reply('❌ No season rewards to claim! Level up to unlock more rewards.');
    return;
  }
  
  await saveDataImmediate(data);
  
  const totalCoins = result.claimed.reduce((sum, r) => sum + (r.reward.coins || 0), 0);
  const totalGems = result.claimed.reduce((sum, r) => sum + (r.reward.gems || 0), 0);
  const totalShards = result.claimed.reduce((sum, r) => sum + (r.reward.shards || 0), 0);
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🎁 Season Rewards Claimed!')
    .setDescription(`Claimed **${result.claimed.length}** reward${result.claimed.length > 1 ? 's' : ''}!`)
    .addFields(
      { name: '💰 Total Coins', value: `+${totalCoins.toLocaleString()}`, inline: true },
      { name: '💎 Total Gems', value: `+${totalGems}`, inline: true },
      { name: '✨ Total Shards', value: `+${totalShards}`, inline: true }
    );
  
  const claimedLevels = result.claimed.map(r => r.level).join(', ');
  embed.addFields({
    name: '📋 Levels Claimed',
    value: claimedLevels,
    inline: false
  });
  
  const seasonData = initializeSeasonData(userData);
  const nextMilestone = getNextMilestoneReward(seasonData);
  if (nextMilestone) {
    embed.addFields({
      name: '🎯 Next Goal',
      value: `Keep playing to unlock **${formatReward(nextMilestone.reward)}** at Level ${nextMilestone.level}!`,
      inline: false
    });
  }
  
  await message.reply({ embeds: [embed] });
}

module.exports = {
  initializeSeasonData,
  getDailyTasks,
  updateTaskProgress,
  claimTaskReward,
  claimAllTaskRewards,
  claimSeasonReward,
  claimAllSeasonRewards,
  getSeasonInfo,
  getCurrentSeasonId,
  getTimeUntilSeasonEnd,
  getTimeUntilDailyReset,
  getCurrentLevelProgress,
  getNextMilestoneReward,
  formatReward,
  showSeasonPass,
  showDailyTasks,
  showSeasonRewards,
  claimTaskRewardCommand,
  claimAllTaskRewardsCommand,
  claimSeasonRewardCommand,
  claimAllSeasonRewardsCommand,
  TASK_POOL,
  getSeasonRewards
};
