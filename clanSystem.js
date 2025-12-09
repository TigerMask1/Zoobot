const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { distributeUSTRewards } = require('./ustSystem.js');

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const MINIMUM_REWARD_POOL = 1000;

function initializeClanData(data) {
  if (!data.clans) {
    data.clans = {};
  }
  if (!data.clanWars) {
    data.clanWars = {
      currentWeekStart: Date.now(),
      lastReset: Date.now(),
      weekNumber: 1
    };
  }
}

function getClan(data, serverId) {
  initializeClanData(data);
  
  if (!data.clans[serverId]) {
    data.clans[serverId] = {
      serverId: serverId,
      clanName: null,
      clanPoints: 0,
      members: {},
      totalDonations: {
        coins: 0,
        gems: 0,
        trophies: 0
      },
      weeklyRank: null,
      lastWeekReward: 0,
      lastWeekUSTReward: 0
    };
  }
  
  if (data.clans[serverId].lastWeekUSTReward === undefined) {
    data.clans[serverId].lastWeekUSTReward = 0;
  }
  
  return data.clans[serverId];
}

function getUserClan(data, userId) {
  initializeClanData(data);
  
  for (const serverId in data.clans) {
    if (data.clans[serverId].members[userId]) {
      return { serverId, clan: data.clans[serverId] };
    }
  }
  
  return null;
}

function joinClan(data, userId, serverId) {
  const existingClan = getUserClan(data, userId);
  
  if (existingClan) {
    return {
      success: false,
      message: `❌ You're already in a clan! Leave your current clan first with \`!leaveclan\``
    };
  }
  
  const clan = getClan(data, serverId);
  
  if (!clan.members[userId]) {
    clan.members[userId] = {
      totalContribution: 0,
      weeklyContribution: 0,
      donations: {
        coins: 0,
        gems: 0,
        trophies: 0
      },
      joinedAt: Date.now()
    };
  }
  
  return {
    success: true,
    message: `✅ You've joined this server's clan!`,
    clan: clan
  };
}

function leaveClan(data, userId) {
  const userClan = getUserClan(data, userId);
  
  if (!userClan) {
    return {
      success: false,
      message: `❌ You're not in any clan!`
    };
  }
  
  delete userClan.clan.members[userId];
  
  return {
    success: true,
    message: `✅ You've left the clan!`
  };
}

function donateToClan(data, userId, serverId, type, amount) {
  const userClan = getUserClan(data, userId);
  
  if (!userClan || userClan.serverId !== serverId) {
    return {
      success: false,
      message: `❌ You must be in this server's clan to donate! Use \`!joinclan\` first.`
    };
  }
  
  const user = data.users[userId];
  if (!user) {
    return {
      success: false,
      message: `❌ User data not found!`
    };
  }
  
  if (type !== 'coins' && type !== 'gems' && type !== 'trophies') {
    return {
      success: false,
      message: `❌ Invalid donation type! Use: coins, gems, or trophies`
    };
  }
  
  const userAmount = user[type] || 0;
  if (userAmount < amount) {
    return {
      success: false,
      message: `❌ You don't have enough ${type}! You have: ${userAmount}`
    };
  }
  
  const pointsMultiplier = {
    coins: 1,
    gems: 10,
    trophies: 5
  };
  
  const clanPoints = amount * pointsMultiplier[type];
  
  user[type] -= amount;
  
  const clan = userClan.clan;
  clan.clanPoints += clanPoints;
  clan.totalDonations[type] += amount;
  
  const memberData = clan.members[userId];
  memberData.totalContribution += clanPoints;
  memberData.weeklyContribution += clanPoints;
  memberData.donations[type] += amount;
  
  return {
    success: true,
    message: `✅ Donated **${amount} ${type}** to the clan!\n💎 Clan gained **${clanPoints} points**!`,
    clanPoints: clan.clanPoints
  };
}

function getClanLeaderboard(data) {
  initializeClanData(data);
  
  const clans = Object.values(data.clans)
    .filter(clan => clan.clanPoints > 0)
    .sort((a, b) => b.clanPoints - a.clanPoints);
  
  return clans;
}

function formatClanProfile(clan, guildName = 'Unknown Server', data) {
  const memberCount = Object.keys(clan.members).length;
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🏰 ${guildName} - Clan Profile`)
    .addFields(
      { name: '💎 Clan Points', value: `${clan.clanPoints.toLocaleString()}`, inline: true },
      { name: '👥 Members', value: `${memberCount}`, inline: true },
      { name: '🏆 Weekly Rank', value: clan.weeklyRank ? `#${clan.weeklyRank}` : 'Unranked', inline: true }
    )
    .addFields(
      { name: '📊 Total Donations', value: `💰 ${clan.totalDonations.coins.toLocaleString()} coins\n💎 ${clan.totalDonations.gems.toLocaleString()} gems\n🏆 ${clan.totalDonations.trophies.toLocaleString()} trophies`, inline: false }
    );
  
  if (clan.lastWeekReward > 0) {
    embed.addFields({ name: '🎁 Last Week Reward', value: `${clan.lastWeekReward.toLocaleString()} points`, inline: true });
  }
  
  if (data && data.clanWars) {
    const timeRemaining = getTimeUntilReset(data);
    embed.addFields({ name: '⏰ Week Resets In', value: timeRemaining, inline: false });
  }
  
  return embed;
}

function getTimeUntilReset(data) {
  if (!data.clanWars || !data.clanWars.lastReset) {
    return 'Unknown';
  }
  
  const timeSinceReset = Date.now() - data.clanWars.lastReset;
  const timeRemaining = WEEK_IN_MS - timeSinceReset;
  
  if (timeRemaining <= 0) {
    return 'Resetting soon...';
  }
  
  const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatClanLeaderboard(clans, client, data) {
  const embed = new EmbedBuilder()
    .setColor('#00D9FF')
    .setTitle('🏆 Global Clan Wars Leaderboard')
    .setDescription('Top clans competing for weekly rewards!');
  
  if (clans.length === 0) {
    embed.setDescription('No clans have earned points yet! Be the first!');
    return embed;
  }
  
  const topClans = clans.slice(0, 10);
  
  const leaderboardText = topClans.map((clan, index) => {
    const guild = client.guilds.cache.get(clan.serverId);
    const guildName = guild ? guild.name : 'Unknown Server';
    const memberCount = Object.keys(clan.members).length;
    
    let medal = '';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';
    else medal = `**${index + 1}.**`;
    
    return `${medal} **${guildName}** - ${clan.clanPoints.toLocaleString()} pts (${memberCount} members)`;
  }).join('\n');
  
  embed.addFields({ name: '📊 Rankings', value: leaderboardText, inline: false });
  
  if (data && data.clanWars) {
    const timeRemaining = getTimeUntilReset(data);
    embed.setFooter({ text: `⏰ Week resets in: ${timeRemaining}` });
  }
  
  return embed;
}

async function performWeeklyReset(client, data) {
  initializeClanData(data);
  
  console.log('🏆 Starting weekly clan wars reset...');
  
  const clans = getClanLeaderboard(data);
  
  if (clans.length === 0) {
    console.log('No clans to process this week.');
    data.clanWars.currentWeekStart = Date.now();
    data.clanWars.lastReset = Date.now();
    data.clanWars.weekNumber += 1;
    await saveDataImmediate(data);
    return;
  }
  
  const top3 = clans.slice(0, 3);
  const others = clans.slice(3);
  
  let totalPointsFromLosers = 0;
  for (const clan of others) {
    const pointsLost = Math.floor(clan.clanPoints * 0.1);
    totalPointsFromLosers += pointsLost;
    clan.clanPoints -= pointsLost;
  }
  
  if (totalPointsFromLosers < MINIMUM_REWARD_POOL && top3.length > 0) {
    totalPointsFromLosers = MINIMUM_REWARD_POOL;
    console.log(`⚠️ Reward pool too small (only ${top3.length} clans), using minimum pool: ${MINIMUM_REWARD_POOL} points`);
  }
  
  const rewardDistribution = [0.5, 0.3, 0.2];
  
  for (let i = 0; i < top3.length; i++) {
    const clan = top3[i];
    const clanReward = Math.floor(totalPointsFromLosers * rewardDistribution[i]);
    clan.lastWeekReward = clanReward;
    clan.weeklyRank = i + 1;
    
    const totalWeeklyContribution = Object.values(clan.members)
      .reduce((sum, member) => sum + member.weeklyContribution, 0);
    
    for (const userId in clan.members) {
      const member = clan.members[userId];
      
      if (member.weeklyContribution === 0) continue;
      
      const userShare = (member.weeklyContribution / totalWeeklyContribution);
      const coinsReward = Math.floor(clanReward * 0.7 * userShare);
      const gemsReward = Math.floor(clanReward * 0.3 * userShare / 10);
      
      if (data.users[userId]) {
        data.users[userId].coins = (data.users[userId].coins || 0) + coinsReward;
        data.users[userId].gems = (data.users[userId].gems || 0) + gemsReward;
      }
      
      try {
        const user = await client.users.fetch(userId);
        const rewardEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🏆 Clan Wars Weekly Reward!')
          .setDescription(`Your clan ranked **#${i + 1}** this week!`)
          .addFields(
            { name: '💰 Coins Earned', value: `${coinsReward.toLocaleString()}`, inline: true },
            { name: '💎 Gems Earned', value: `${gemsReward.toLocaleString()}`, inline: true },
            { name: '📊 Your Contribution', value: `${member.weeklyContribution.toLocaleString()} points`, inline: true }
          )
          .setFooter({ text: 'Keep donating to help your clan win!' });
        
        await user.send({ embeds: [rewardEmbed] }).catch(() => {
          console.log(`Could not DM user ${userId}`);
        });
      } catch (error) {
        console.log(`Error sending reward to user ${userId}:`, error.message);
      }
    }
  }
  
  await distributeUSTRewards(client, data, top3);
  console.log('✅ Distributed UST rewards to top 3 clans');
  
  for (const serverId in data.clans) {
    const clan = data.clans[serverId];
    
    for (const userId in clan.members) {
      clan.members[userId].weeklyContribution = 0;
    }
    
    clan.clanPoints = 0;
  }
  
  const leaderboardEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Weekly Clan Wars Results!')
    .setDescription(`Week ${data.clanWars.weekNumber} has ended!\n\n**Winners:**`)
    .setTimestamp();
  
  if (top3.length > 0) {
    const winnersText = top3.map((clan, index) => {
      const guild = client.guilds.cache.get(clan.serverId);
      const guildName = guild ? guild.name : 'Unknown Server';
      const medals = ['🥇', '🥈', '🥉'];
      return `${medals[index]} **${guildName}** - Reward: ${clan.lastWeekReward.toLocaleString()} points`;
    }).join('\n');
    
    leaderboardEmbed.addFields({ name: '🎖️ Top 3 Clans', value: winnersText, inline: false });
  }
  
  leaderboardEmbed.addFields({ name: '🔄 New Week Started', value: 'Clan points have been reset! Start donating to compete for next week!', inline: false });
  
  for (const [serverId, clan] of Object.entries(data.clans)) {
    try {
      const guild = client.guilds.cache.get(serverId);
      if (!guild) continue;
      
      const channel = guild.channels.cache.find(ch => 
        ch.isTextBased() && ch.permissionsFor(guild.members.me).has(['SendMessages', 'MentionEveryone'])
      );
      
      if (channel) {
        const { formatPingMention } = require('./serverConfigManager.js');
        const pingMention = formatPingMention(serverId, 'events');
        const sendOptions = { embeds: [leaderboardEmbed] };
        if (pingMention) sendOptions.content = pingMention;
        await channel.send(sendOptions);
      }
    } catch (error) {
      console.log(`Error announcing to server ${serverId}:`, error.message);
    }
  }
  
  data.clanWars.currentWeekStart = Date.now();
  data.clanWars.lastReset = Date.now();
  data.clanWars.weekNumber += 1;
  
  await saveDataImmediate(data);
  
  console.log('✅ Weekly clan wars reset complete!');
}

function startWeeklyClanWars(client, data) {
  const checkInterval = 60 * 60 * 1000;
  
  setInterval(async () => {
    initializeClanData(data);
    
    const timeSinceReset = Date.now() - data.clanWars.lastReset;
    
    if (timeSinceReset >= WEEK_IN_MS) {
      await performWeeklyReset(client, data);
    }
  }, checkInterval);
  
  console.log('✅ Weekly Clan Wars system started!');
}

module.exports = {
  initializeClanData,
  getClan,
  getUserClan,
  joinClan,
  leaveClan,
  donateToClan,
  getClanLeaderboard,
  formatClanProfile,
  formatClanLeaderboard,
  performWeeklyReset,
  startWeeklyClanWars
};
