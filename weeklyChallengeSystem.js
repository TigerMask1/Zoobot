const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const WEEKLY_CHALLENGES = [
  {
    id: 'earn_coins',
    name: 'Coin Collector',
    emoji: '💰',
    description: 'Earn coins through any activity',
    target: 100000,
    trackField: 'coinsEarned',
    reward: { gems: 50, coins: 5000 }
  },
  {
    id: 'catch_drops',
    name: 'Drop Hunter',
    emoji: '🎯',
    description: 'Catch drops from the drop channel',
    target: 50,
    trackField: 'dropsCaught',
    reward: { gems: 30, bronzeCrates: 2 }
  },
  {
    id: 'win_battles',
    name: 'Battle Champion',
    emoji: '⚔️',
    description: 'Win battles against other players or AI',
    target: 10,
    trackField: 'battlesWon',
    reward: { gems: 40, coins: 3000 }
  },
  {
    id: 'complete_trades',
    name: 'Master Trader',
    emoji: '🤝',
    description: 'Complete trades with other players',
    target: 5,
    trackField: 'tradesCompleted',
    reward: { gems: 25, silverCrates: 1 }
  },
  {
    id: 'open_crates',
    name: 'Crate Crusher',
    emoji: '📦',
    description: 'Open any type of crate',
    target: 20,
    trackField: 'cratesOpened',
    reward: { gems: 35, goldCrates: 1 }
  },
  {
    id: 'level_characters',
    name: 'Character Trainer',
    emoji: '⬆️',
    description: 'Level up your characters',
    target: 5,
    trackField: 'levelsGained',
    reward: { gems: 30, coins: 2000 }
  },
  {
    id: 'use_daily',
    name: 'Daily Devotee',
    emoji: '📅',
    description: 'Claim your daily reward',
    target: 1,
    trackField: 'dailyClaimed',
    reward: { coins: 1000 }
  }
];

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 604800000;
  return Math.floor(diff / oneWeek);
}

function getWeekStartEnd() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  
  return { weekStart, weekEnd };
}

function initializeWeeklyChallengeData(userData) {
  if (!userData.weeklyChallenge) {
    userData.weeklyChallenge = {
      weekNumber: getWeekNumber(),
      progress: {},
      claimed: []
    };
  }
  
  const currentWeek = getWeekNumber();
  if (userData.weeklyChallenge.weekNumber !== currentWeek) {
    userData.weeklyChallenge = {
      weekNumber: currentWeek,
      progress: {},
      claimed: []
    };
  }
  
  WEEKLY_CHALLENGES.forEach(challenge => {
    if (userData.weeklyChallenge.progress[challenge.id] === undefined) {
      userData.weeklyChallenge.progress[challenge.id] = 0;
    }
  });
  
  return userData.weeklyChallenge;
}

function trackChallengeProgress(userData, trackField, amount = 1) {
  initializeWeeklyChallengeData(userData);
  
  WEEKLY_CHALLENGES.forEach(challenge => {
    if (challenge.trackField === trackField) {
      userData.weeklyChallenge.progress[challenge.id] = 
        (userData.weeklyChallenge.progress[challenge.id] || 0) + amount;
    }
  });
}

function getChallengeStatus(userData) {
  const wcData = initializeWeeklyChallengeData(userData);
  
  return WEEKLY_CHALLENGES.map(challenge => {
    const progress = wcData.progress[challenge.id] || 0;
    const completed = progress >= challenge.target;
    const claimed = wcData.claimed.includes(challenge.id);
    
    return {
      ...challenge,
      progress,
      completed,
      claimed,
      canClaim: completed && !claimed
    };
  });
}

function createProgressBar(current, target, length = 10) {
  const percentage = Math.min(current / target, 1);
  const filled = Math.floor(percentage * length);
  const empty = length - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `\`${bar}\` ${current}/${target}`;
}

async function displayChallenges(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const challenges = getChallengeStatus(userData);
  const { weekEnd } = getWeekStartEnd();
  
  const timeLeft = weekEnd - Date.now();
  const daysLeft = Math.floor(timeLeft / 86400000);
  const hoursLeft = Math.floor((timeLeft % 86400000) / 3600000);
  
  const completedCount = challenges.filter(c => c.completed).length;
  const claimedCount = challenges.filter(c => c.claimed).length;
  
  let description = challenges.map(c => {
    let statusIcon = '⬜';
    if (c.claimed) statusIcon = '✅';
    else if (c.completed) statusIcon = '🎁';
    
    const progress = createProgressBar(c.progress, c.target, 8);
    const rewardText = formatReward(c.reward);
    
    return `${statusIcon} **${c.emoji} ${c.name}**\n${c.description}\n${progress}\n🎁 ${rewardText}`;
  }).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setColor('#00D9FF')
    .setTitle('📋 Weekly Challenges')
    .setDescription(description)
    .addFields(
      { name: '⏰ Time Remaining', value: `${daysLeft}d ${hoursLeft}h`, inline: true },
      { name: '✅ Completed', value: `${completedCount}/${challenges.length}`, inline: true },
      { name: '🎁 Claimed', value: `${claimedCount}/${challenges.length}`, inline: true }
    )
    .setFooter({ text: 'Use !claimchallenge <id> to claim rewards • Resets every Monday' });
  
  const claimableCount = challenges.filter(c => c.canClaim).length;
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('challenge_claim_all')
      .setLabel(`🎁 Claim All (${claimableCount})`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(claimableCount === 0)
  );
  
  await message.reply({ embeds: [embed], components: [row] });
}

function formatReward(reward) {
  const parts = [];
  if (reward.coins) parts.push(`💰 ${reward.coins.toLocaleString()}`);
  if (reward.gems) parts.push(`💎 ${reward.gems}`);
  if (reward.bronzeCrates) parts.push(`🟫 ${reward.bronzeCrates} Bronze`);
  if (reward.silverCrates) parts.push(`⬜ ${reward.silverCrates} Silver`);
  if (reward.goldCrates) parts.push(`🟨 ${reward.goldCrates} Gold`);
  if (reward.emeraldCrates) parts.push(`🟩 ${reward.emeraldCrates} Emerald`);
  return parts.join(' ');
}

async function claimChallenge(message, args, data) {
  const userId = message.author.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await message.reply('❌ Start your journey with `!start` first!');
    return;
  }
  
  const userData = data.users[userId];
  const challenges = getChallengeStatus(userData);
  const challengeId = args[0]?.toLowerCase();
  
  if (!challengeId) {
    await message.reply('Usage: `!claimchallenge <challenge_id>` or use `!challenges` and click Claim All');
    return;
  }
  
  const challenge = challenges.find(c => c.id === challengeId || c.name.toLowerCase().includes(challengeId));
  
  if (!challenge) {
    await message.reply('❌ Challenge not found! Use `!challenges` to see available challenges.');
    return;
  }
  
  if (challenge.claimed) {
    await message.reply('❌ You already claimed this challenge reward!');
    return;
  }
  
  if (!challenge.completed) {
    await message.reply(`❌ Challenge not complete! Progress: ${challenge.progress}/${challenge.target}`);
    return;
  }
  
  applyReward(userData, challenge.reward);
  userData.weeklyChallenge.claimed.push(challenge.id);
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎉 Challenge Complete!')
    .setDescription(`You claimed the **${challenge.emoji} ${challenge.name}** challenge reward!`)
    .addFields({ name: '🎁 Rewards', value: formatReward(challenge.reward) });
  
  await message.reply({ embeds: [embed] });
}

async function claimAllChallenges(interaction, data) {
  const userId = interaction.user.id;
  
  if (!data.users[userId] || !data.users[userId].started) {
    await interaction.reply({ content: '❌ Start your journey with `!start` first!', ephemeral: true });
    return;
  }
  
  const userData = data.users[userId];
  const challenges = getChallengeStatus(userData);
  const claimable = challenges.filter(c => c.canClaim);
  
  if (claimable.length === 0) {
    await interaction.reply({ content: '❌ No challenges ready to claim!', ephemeral: true });
    return;
  }
  
  let totalRewards = { coins: 0, gems: 0, bronzeCrates: 0, silverCrates: 0, goldCrates: 0, emeraldCrates: 0 };
  
  claimable.forEach(challenge => {
    applyReward(userData, challenge.reward);
    userData.weeklyChallenge.claimed.push(challenge.id);
    
    Object.keys(challenge.reward).forEach(key => {
      totalRewards[key] = (totalRewards[key] || 0) + challenge.reward[key];
    });
  });
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎉 Claimed All Challenges!')
    .setDescription(`You claimed **${claimable.length}** challenge rewards!`)
    .addFields({ name: '🎁 Total Rewards', value: formatReward(totalRewards) });
  
  await interaction.reply({ embeds: [embed] });
}

function applyReward(userData, reward) {
  if (reward.coins) userData.coins = (userData.coins || 0) + reward.coins;
  if (reward.gems) userData.gems = (userData.gems || 0) + reward.gems;
  if (reward.bronzeCrates) userData.bronzeCrates = (userData.bronzeCrates || 0) + reward.bronzeCrates;
  if (reward.silverCrates) userData.silverCrates = (userData.silverCrates || 0) + reward.silverCrates;
  if (reward.goldCrates) userData.goldCrates = (userData.goldCrates || 0) + reward.goldCrates;
  if (reward.emeraldCrates) userData.emeraldCrates = (userData.emeraldCrates || 0) + reward.emeraldCrates;
}

async function handleChallengeButton(interaction, data) {
  if (interaction.customId === 'challenge_claim_all') {
    await claimAllChallenges(interaction, data);
  }
}

module.exports = {
  WEEKLY_CHALLENGES,
  initializeWeeklyChallengeData,
  trackChallengeProgress,
  getChallengeStatus,
  displayChallenges,
  claimChallenge,
  claimAllChallenges,
  handleChallengeButton,
  getWeekNumber,
  getWeekStartEnd
};
