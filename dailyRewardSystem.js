const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { trackChallengeProgress } = require('./weeklyChallengeSystem.js');
const { checkAchievements } = require('./achievementSystem.js');
const { recordEvent } = require('./analyticsSystem.js');

const STREAK_REWARDS = {
  1: { coins: 100, gems: 0, bonus: null },
  2: { coins: 150, gems: 0, bonus: null },
  3: { coins: 200, gems: 5, bonus: null },
  4: { coins: 250, gems: 5, bonus: null },
  5: { coins: 300, gems: 10, bonus: null },
  6: { coins: 400, gems: 15, bonus: null },
  7: { coins: 500, gems: 50, bonus: 'Bronze Crate', bonusType: 'bronzeCrates', bonusAmount: 1 },
  14: { coins: 750, gems: 75, bonus: 'Silver Crate', bonusType: 'silverCrates', bonusAmount: 1 },
  21: { coins: 1000, gems: 100, bonus: 'Gold Crate', bonusType: 'goldCrates', bonusAmount: 1 },
  30: { coins: 1500, gems: 150, bonus: 'Emerald Crate', bonusType: 'emeraldCrates', bonusAmount: 2 }
};

function getStreakReward(streakDay) {
  if (STREAK_REWARDS[streakDay]) {
    return STREAK_REWARDS[streakDay];
  }
  
  const baseCoins = Math.min(100 + (streakDay - 1) * 50, 500);
  const baseGems = Math.floor(streakDay / 3) * 5;
  return { coins: baseCoins, gems: baseGems, bonus: null };
}

function initializeDailyData(userData) {
  if (userData.dailyStreak === undefined) {
    userData.dailyStreak = 0;
  }
  if (userData.highestDailyStreak === undefined) {
    userData.highestDailyStreak = 0;
  }
  if (userData.lastDailyClaim === undefined) {
    userData.lastDailyClaim = null;
  }
  if (userData.totalDailyClaims === undefined) {
    userData.totalDailyClaims = 0;
  }
  return userData;
}

function canClaimDaily(userData) {
  if (!userData.lastDailyClaim) {
    return { canClaim: true, hoursLeft: 0, streakBroken: false };
  }
  
  const now = new Date();
  const lastClaim = new Date(userData.lastDailyClaim);
  const timeDiff = now - lastClaim;
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff < 24) {
    return { canClaim: false, hoursLeft: Math.ceil(24 - hoursDiff), streakBroken: false };
  }
  
  if (hoursDiff > 48) {
    return { canClaim: true, hoursLeft: 0, streakBroken: true };
  }
  
  return { canClaim: true, hoursLeft: 0, streakBroken: false };
}

async function claimDaily(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = initializeDailyData(data.users[userId]);
  const { canClaim, hoursLeft, streakBroken } = canClaimDaily(userData);
  
  if (!canClaim) {
    const minutesLeft = Math.ceil((hoursLeft % 1) * 60);
    const fullHours = Math.floor(hoursLeft);
    let timeText = '';
    if (fullHours > 0) timeText += `${fullHours}h `;
    if (minutesLeft > 0) timeText += `${minutesLeft}m`;
    
    const waitEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('⏰ Daily Reward Cooldown')
      .setDescription(`You already claimed your daily reward!\n\nCome back in **${timeText.trim()}**`)
      .addFields(
        { name: '🔥 Current Streak', value: `${userData.dailyStreak} day${userData.dailyStreak !== 1 ? 's' : ''}`, inline: true },
        { name: '🏆 Best Streak', value: `${userData.highestDailyStreak} days`, inline: true }
      );
    
    await message.reply({ embeds: [waitEmbed] });
    return;
  }
  
  if (streakBroken) {
    const lostStreak = userData.dailyStreak;
    userData.dailyStreak = 1;
    
    if (lostStreak > 0) {
      const lostEmbed = new EmbedBuilder()
        .setColor('#FF9500')
        .setTitle('💔 Streak Broken!')
        .setDescription(`You missed a day and lost your **${lostStreak} day** streak!\n\nDon't worry - starting fresh with Day 1!`);
      await message.channel.send({ embeds: [lostEmbed] });
    }
  } else {
    userData.dailyStreak = (userData.dailyStreak || 0) + 1;
  }
  
  if (userData.dailyStreak > userData.highestDailyStreak) {
    userData.highestDailyStreak = userData.dailyStreak;
  }
  
  userData.totalDailyClaims = (userData.totalDailyClaims || 0) + 1;
  
  const reward = getStreakReward(userData.dailyStreak);
  
  userData.coins += reward.coins;
  userData.gems += reward.gems;
  userData.trophies = (userData.trophies || 200) + 10;
  
  let bonusText = '';
  if (reward.bonus) {
    userData[reward.bonusType] = (userData[reward.bonusType] || 0) + reward.bonusAmount;
    bonusText = `\n🎁 **BONUS:** ${reward.bonusAmount}x ${reward.bonus}!`;
  }
  
  userData.lastDailyClaim = new Date().toISOString();
  
  trackChallengeProgress(userData, 'dailyClaimed', 1);
  checkAchievements(userData);
  
  if (message.guild) {
    recordEvent(data, message.guild.id, 'dailysClaimed', 1, userId);
  }
  
  await saveDataImmediate(data);
  
  const streakEmoji = getStreakEmoji(userData.dailyStreak);
  const nextMilestone = getNextMilestone(userData.dailyStreak);
  
  const dailyEmbed = new EmbedBuilder()
    .setColor('#00D9FF')
    .setTitle(`${streakEmoji} Daily Reward - Day ${userData.dailyStreak}!`)
    .setDescription(`<@${userId}> claimed their daily rewards!${bonusText}`)
    .addFields(
      { name: '💰 Coins', value: `+${reward.coins.toLocaleString()}`, inline: true },
      { name: '💎 Gems', value: `+${reward.gems}`, inline: true },
      { name: '🏆 Trophies', value: '+10', inline: true },
      { name: '🔥 Streak', value: `${userData.dailyStreak} day${userData.dailyStreak !== 1 ? 's' : ''}`, inline: true },
      { name: '⭐ Best Streak', value: `${userData.highestDailyStreak} days`, inline: true },
      { name: '📅 Total Claims', value: `${userData.totalDailyClaims}`, inline: true }
    );
  
  if (nextMilestone) {
    dailyEmbed.setFooter({ text: `${nextMilestone.daysLeft} day${nextMilestone.daysLeft !== 1 ? 's' : ''} until ${nextMilestone.reward}!` });
  }
  
  if (userData.dailyStreak === 7 || userData.dailyStreak === 14 || userData.dailyStreak === 21 || userData.dailyStreak === 30) {
    dailyEmbed.setThumbnail('https://cdn.discordapp.com/emojis/1234567890.png');
  }
  
  await message.reply({ embeds: [dailyEmbed] });
}

function getStreakEmoji(streak) {
  if (streak >= 30) return '🌟';
  if (streak >= 21) return '💎';
  if (streak >= 14) return '🔥';
  if (streak >= 7) return '✨';
  if (streak >= 3) return '⚡';
  return '🎁';
}

function getNextMilestone(currentStreak) {
  const milestones = [
    { day: 7, reward: 'Bronze Crate + 50 Gems' },
    { day: 14, reward: 'Silver Crate + 75 Gems' },
    { day: 21, reward: 'Gold Crate + 100 Gems' },
    { day: 30, reward: '2x Emerald Crates + 150 Gems' }
  ];
  
  for (const milestone of milestones) {
    if (currentStreak < milestone.day) {
      return { daysLeft: milestone.day - currentStreak, reward: milestone.reward };
    }
  }
  
  return null;
}

function formatStreakDisplay(userData) {
  initializeDailyData(userData);
  
  if (userData.dailyStreak === 0) {
    return '`No streak yet - use !daily`';
  }
  
  const emoji = getStreakEmoji(userData.dailyStreak);
  return `${emoji} ${userData.dailyStreak} day${userData.dailyStreak !== 1 ? 's' : ''} (Best: ${userData.highestDailyStreak})`;
}

module.exports = {
  claimDaily,
  initializeDailyData,
  canClaimDaily,
  getStreakReward,
  formatStreakDisplay,
  STREAK_REWARDS
};
