const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { getEventsChannel } = require('./serverConfigManager.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

let activeLotteries = {};
let activeClient = null;
let autoScheduleTimeouts = {};

function getNextUTCMidnight() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.getTime();
}

function formatTimeUntil(timestamp) {
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'Starting soon...';
  
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getLotteryData() {
  return activeLotteries;
}

function setLotteryData(data) {
  if (data) {
    activeLotteries = { ...data };
    for (const serverId in activeLotteries) {
      const lottery = activeLotteries[serverId];
      if (lottery) {
        if (!lottery.participants) {
          lottery.participants = [];
        }
        if (!lottery.winnersHistory) {
          lottery.winnersHistory = [];
        }
        if (lottery.prizePool === undefined) {
          lottery.prizePool = 0;
        }
        if (lottery.active === undefined) {
          lottery.active = false;
        }
        if (!lottery.autoSchedule) {
          lottery.autoSchedule = {
            enabled: false,
            interval: 12 * 60 * 60 * 1000,
            nextRunTime: null
          };
        }
      }
    }
  }
}

async function saveLotteryToMongo() {
  if (!USE_MONGODB || !mongoManager) return;
  
  try {
    await mongoManager.saveLotteryData(activeLotteries);
  } catch (error) {
    console.error('Error saving lottery to MongoDB:', error);
  }
}

async function loadLotteryFromMongo() {
  if (!USE_MONGODB || !mongoManager) return null;
  
  try {
    return await mongoManager.loadLotteryData();
  } catch (error) {
    console.error('Error loading lottery from MongoDB:', error);
    return null;
  }
}

async function enableAutoLottery(serverId, entryFee, currency, channelId) {
  const nextMidnight = getNextUTCMidnight();
  
  if (!activeLotteries[serverId]) {
    activeLotteries[serverId] = {
      active: false,
      channelId: channelId,
      duration: 12,
      startTime: null,
      endTime: null,
      entryFee: entryFee,
      currency: currency,
      prizePool: 0,
      participants: [],
      winnersHistory: [],
      autoSchedule: {
        enabled: true,
        interval: 12 * 60 * 60 * 1000,
        nextRunTime: nextMidnight,
        startHourUTC: 0,
        startMinuteUTC: 0
      }
    };
  } else {
    activeLotteries[serverId].autoSchedule = {
      enabled: true,
      interval: 12 * 60 * 60 * 1000,
      nextRunTime: nextMidnight,
      startHourUTC: 0,
      startMinuteUTC: 0
    };
    activeLotteries[serverId].entryFee = entryFee;
    activeLotteries[serverId].currency = currency;
    activeLotteries[serverId].channelId = channelId;
  }
  
  if (USE_MONGODB) {
    await saveLotteryToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.lotteryData = activeLotteries;
    await saveDataImmediate(data);
  }
  
  scheduleNextAutoLottery(serverId);
  
  return { 
    success: true, 
    message: `✅ Auto lottery enabled!\n🕛 Starts every 12 hours at **00:00 UTC** and **12:00 UTC**\n⏰ Next lottery: <t:${Math.floor(nextMidnight / 1000)}:F> (${formatTimeUntil(nextMidnight)})`
  };
}

async function disableAutoLottery(serverId) {
  if (!activeLotteries[serverId]) {
    return { success: false, message: '❌ No lottery configuration found for this server!' };
  }
  
  activeLotteries[serverId].autoSchedule.enabled = false;
  activeLotteries[serverId].autoSchedule.nextRunTime = null;
  
  if (autoScheduleTimeouts[serverId]) {
    clearTimeout(autoScheduleTimeouts[serverId]);
    delete autoScheduleTimeouts[serverId];
  }
  
  if (USE_MONGODB) {
    await saveLotteryToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.lotteryData = activeLotteries;
    await saveDataImmediate(data);
  }
  
  return { success: true, message: '✅ Auto lottery disabled.' };
}

function scheduleNextAutoLottery(serverId) {
  const lottery = activeLotteries[serverId];
  if (!lottery || !lottery.autoSchedule || !lottery.autoSchedule.enabled) return;
  
  if (autoScheduleTimeouts[serverId]) {
    clearTimeout(autoScheduleTimeouts[serverId]);
  }
  
  const now = Date.now();
  let nextRunTime = lottery.autoSchedule.nextRunTime;
  
  // If past scheduled time, calculate next 00:00 or 12:00 UTC
  if (nextRunTime <= now) {
    const currentDate = new Date();
    const currentHour = currentDate.getUTCHours();
    
    if (currentHour < 12) {
      // Next is 12:00 UTC today
      nextRunTime = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        12, 0, 0, 0
      )).getTime();
    } else {
      // Next is 00:00 UTC tomorrow
      nextRunTime = getNextUTCMidnight();
    }
    
    lottery.autoSchedule.nextRunTime = nextRunTime;
  }
  
  const timeUntilNext = nextRunTime - now;
  
  if (timeUntilNext <= 0) {
    startAutomaticLottery(serverId);
  } else {
    autoScheduleTimeouts[serverId] = setTimeout(() => {
      startAutomaticLottery(serverId);
    }, Math.min(timeUntilNext, 2147483647));
    
    const nextDate = new Date(nextRunTime);
    console.log(`⏰ Next auto lottery for ${serverId}: ${nextDate.toUTCString()} (in ${formatTimeUntil(nextRunTime)})`);
  }
}

async function sendLotteryDMsToAllPlayers() {
  if (!activeClient) return;
  
  try {
    const { loadData } = require('./dataManager.js');
    const data = USE_MONGODB && mongoManager ? await mongoManager.loadData() : await loadData();
    
    const userIds = Object.keys(data.users || {});
    let sentCount = 0;
    
    for (const userId of userIds) {
      if (!data.users[userId].started) continue;
      
      try {
        const user = await activeClient.users.fetch(userId);
        
        const dmEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🎰 NEW LOTTERY ANNOUNCED!')
          .setDescription(
            `A new lottery has just been announced!\n\n` +
            `Use \`!lottery\` to check the details and join!\n` +
            `Good luck! 🍀`
          )
          .setTimestamp();
        
        await user.send({ embeds: [dmEmbed] }).catch(() => {});
        sentCount++;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
      }
    }
    
    console.log(`📧 Sent lottery announcement DMs to ${sentCount} players`);
  } catch (error) {
    console.error('Error sending lottery DMs:', error);
  }
}

async function startAutomaticLottery(serverId) {
  const lottery = activeLotteries[serverId];
  if (!lottery) return;
  
  // If manual lottery is running, force end it first
  if (lottery.active) {
    console.log(`⚠️ Manual lottery running during auto schedule for ${serverId} - ending it`);
    await performLotteryDraw(serverId);
  }
  
  await startLottery(serverId, 12, lottery.entryFee, lottery.currency, lottery.channelId);
  
  await sendLotteryDMsToAllPlayers();
  
  // Send announcement to specific channel
  const LOTTERY_ANNOUNCEMENT_CHANNEL = '1445441639064801322';
  if (activeClient) {
    try {
      const announcementChannel = await activeClient.channels.fetch(LOTTERY_ANNOUNCEMENT_CHANNEL);
      if (announcementChannel) {
        const announcementEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🎰 NEW LOTTERY STARTED!')
          .setDescription(
            `A new 12-hour lottery has just begun!\n\n` +
            `**Entry Fee:** ${lottery.entryFee} ${lottery.currency === 'gems' ? '💎 Gems' : '💰 Coins'}\n` +
            `**Duration:** 12 hours\n` +
            `**Winners:** Top 3 participants\n` +
            `**Prize Distribution:** 50%, 30%, 20%\n\n` +
            `Use \`!lottery join <tickets>\` to participate!\n` +
            `Ends: <t:${Math.floor((Date.now() + 12 * 60 * 60 * 1000) / 1000)}:R>`
          )
          .setTimestamp();
        
        await announcementChannel.send({ embeds: [announcementEmbed] });
        console.log(`📢 Lottery announcement sent to channel ${LOTTERY_ANNOUNCEMENT_CHANNEL}`);
      }
    } catch (error) {
      console.error('Error sending lottery announcement:', error);
    }
  }
  
  // Calculate next run time (either 12:00 UTC today or 00:00 UTC tomorrow)
  const currentDate = new Date();
  const currentHour = currentDate.getUTCHours();
  
  if (currentHour < 12) {
    lottery.autoSchedule.nextRunTime = new Date(Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      12, 0, 0, 0
    )).getTime();
  } else {
    lottery.autoSchedule.nextRunTime = getNextUTCMidnight();
  }
  
  console.log(`✅ Auto lottery started at ${new Date().toUTCString()}`);
  
  if (USE_MONGODB) {
    await saveLotteryToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.lotteryData = activeLotteries;
    await saveDataImmediate(data);
  }
  
  scheduleNextAutoLottery(serverId);
}

async function startLottery(serverId, duration, entryFee, currency, channelId) {
  if (activeLotteries[serverId] && activeLotteries[serverId].active) {
    return { success: false, message: '❌ A lottery is already active in this server!' };
  }
  
  const durationMs = duration * 60 * 60 * 1000;
  const endTime = Date.now() + durationMs;
  
  const existingAutoSchedule = activeLotteries[serverId]?.autoSchedule || {
    enabled: false,
    interval: 12 * 60 * 60 * 1000,
    nextRunTime: null
  };
  
  activeLotteries[serverId] = {
    active: true,
    channelId: channelId,
    duration: duration,
    startTime: Date.now(),
    endTime: endTime,
    entryFee: entryFee,
    currency: currency,
    prizePool: 0,
    participants: [],
    winnersHistory: activeLotteries[serverId]?.winnersHistory || [],
    autoSchedule: existingAutoSchedule
  };
  
  if (USE_MONGODB) {
    await saveLotteryToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    if (!data.lotteryData) {
      data.lotteryData = {};
    }
    data.lotteryData = activeLotteries;
    await saveDataImmediate(data);
  }
  
  setTimeout(async () => {
    await performLotteryDraw(serverId);
  }, durationMs);
  
  const startEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🎰 LOTTERY STARTED!')
    .setDescription(
      `A new ${duration}-hour lottery has begun!\n\n` +
      `**Entry Fee:** ${entryFee} ${currency === 'gems' ? '💎 Gems' : '💰 Coins'}\n` +
      `**Duration:** ${duration} hour(s)\n` +
      `**Winners:** Top 3 participants\n` +
      `**Prize Pool:** Splits among 3 winners (50%, 30%, 20%)\n\n` +
      `Use \`!lottery join\` to buy tickets!\n` +
      `Ends: <t:${Math.floor(endTime / 1000)}:R>`
    )
    .setTimestamp();
  
  return { success: true, message: 'Lottery started!', embed: startEmbed };
}

async function performLotteryDraw(serverId) {
  const lottery = activeLotteries[serverId];
  
  if (!lottery || !lottery.active) {
    console.log(`⚠️ Lottery draw skipped for server ${serverId} - not active`);
    return;
  }
  
  if (!activeClient) {
    console.log('⚠️ Lottery draw skipped - client not ready');
    return;
  }
  
  try {
    // Handle no participants case
    if (lottery.participants.length === 0) {
      const noParticipantsEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🎰 LOTTERY ENDED')
        .setDescription(
          `No one participated in the ${lottery.duration}-hour lottery!\n\nBetter luck next time!`
        )
        .setTimestamp();
      
      const channel = await activeClient.channels.fetch(lottery.channelId).catch(() => null);
      if (channel) {
        await channel.send({ embeds: [noParticipantsEmbed] });
      }
      
      lottery.active = false;
      if (USE_MONGODB) {
        await saveLotteryToMongo();
      } else {
        const { loadData } = require('./dataManager.js');
        const data = await loadData();
        data.lotteryData = activeLotteries;
        await saveDataImmediate(data);
      }
      return;
    }
    
    // RULE 1: Load data ONLY once
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    
    // Get unique participants and select winners
    const uniqueParticipants = [...new Set(lottery.participants.map(p => p.userId))];
    const totalEntries = lottery.participants.length;
    const numWinners = Math.min(3, uniqueParticipants.length);
    
    const winners = [];
    const selectedUsers = new Set();
    
    while (winners.length < numWinners) {
      const randomIndex = Math.floor(Math.random() * lottery.participants.length);
      const participant = lottery.participants[randomIndex];
      if (!selectedUsers.has(participant.userId)) {
        selectedUsers.add(participant.userId);
        winners.push(participant);
      }
    }
    
    // Calculate prize shares
    let prizeShares = [];
    if (numWinners === 1) {
      prizeShares = [1.0];
    } else if (numWinners === 2) {
      prizeShares = [0.60, 0.40];
    } else {
      prizeShares = [0.50, 0.30, 0.20];
    }
    
    const placeLabels = ['🥇 1st', '🥈 2nd', '🥉 3rd'];
    let resultDescription = `**Prize Pool:** ${lottery.prizePool.toLocaleString()} ${lottery.currency === 'gems' ? '💎 Gems' : '💰 Coins'}\n\n**Winners:**\n\n`;
    
    // RULE 2 & 3: Update all winners in memory (NEVER save inside loop)
    for (let i = 0; i < winners.length; i++) {
      const winnerId = winners[i].userId;
      const shareRatio = prizeShares[i];
      
      // RULE 6: Calculate prize using formula
      const prize = Math.floor(lottery.prizePool * shareRatio);
      const sharePercent = Math.floor(shareRatio * 100);
      
      // RULE 5: Ensure user record exists
      if (!data.users[winnerId]) {
        data.users[winnerId] = {
          coins: 0,
          gems: 0,
          characters: [],
          selectedCharacter: null,
          pendingTokens: 0,
          started: false,
          trophies: 200,
          messageCount: 0,
          lastDailyClaim: null,
          mailbox: []
        };
      }
      
      // Award reward using += pattern
      if (lottery.currency === 'gems') {
        data.users[winnerId].gems += prize;
      } else {
        data.users[winnerId].coins += prize;
      }
      
      // Get winner tag for display
      const winner = await activeClient.users.fetch(winnerId).catch(() => null);
      const winnerTag = winner?.tag || `User ${winnerId}`;
      
      resultDescription += `${placeLabels[i]} Place (${sharePercent}%): **${winnerTag}**\n💰 Prize: ${prize.toLocaleString()} ${lottery.currency === 'gems' ? '💎 Gems' : '💰 Coins'}\n\n`;
      
      console.log(`✅ LOTTERY REWARD IN MEMORY: ${winnerTag} → ${prize} ${lottery.currency === 'gems' ? 'gems' : 'coins'} (${sharePercent}%)`);
    }
    
    // RULE 4: Save data ONCE after loop completes
    await saveDataImmediate(data);
    console.log(`✅ LOTTERY REWARDS SAVED: All ${numWinners} winners - coins/gems added to profiles`);
    
    // Build result message
    resultDescription += `**Statistics:**\n👥 Total Participants: ${uniqueParticipants.length}\n🎟️ Total Entries: ${totalEntries}\n\nCongratulations to all winners! 🎊`;
    
    const winnerEmbed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🎰 LOTTERY RESULTS!')
      .setDescription(resultDescription)
      .setFooter({ text: 'Thanks for participating!' })
      .setTimestamp();
    
    // Announce winners
    const channel = await activeClient.channels.fetch(lottery.channelId).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [winnerEmbed] });
    }
    
    await broadcastToAllServers(winnerEmbed);
    
    // Update lottery history
    if (!lottery.winnersHistory) {
      lottery.winnersHistory = [];
    }
    lottery.winnersHistory.unshift({
      winners: winners.map((w, i) => ({ userId: w.userId, place: i + 1, prize: Math.floor(lottery.prizePool * prizeShares[i]) })),
      date: new Date().toISOString(),
      prizePool: lottery.prizePool,
      participants: uniqueParticipants.length,
      totalEntries: totalEntries
    });
    
    lottery.active = false;
    
    // Save lottery state ONLY (user data already saved above)
    if (USE_MONGODB) {
      await saveLotteryToMongo();
    } else {
      // Reload fresh data to get latest state
      const lotteryData = await loadData();
      lotteryData.lotteryData = activeLotteries;
      await saveDataImmediate(lotteryData);
    }
    
    console.log(`✅ Lottery completed for server ${serverId} - ${numWinners} winners with ${numWinners} prizes distributed`);
    
  } catch (error) {
    console.error(`❌ Error performing lottery draw for server ${serverId}:`, error);
  }
}

async function broadcastToAllServers(embed) {
  if (!activeClient) return;
  
  try {
    for (const guild of activeClient.guilds.cache.values()) {
      const eventsChannelId = getEventsChannel(guild.id);
      
      if (eventsChannelId) {
        const channel = await activeClient.channels.fetch(eventsChannelId).catch(() => null);
        if (channel) {
          await channel.send({ embeds: [embed] }).catch(err => {
            console.error(`Failed to send lottery result to server ${guild.id}:`, err.message);
          });
        }
      }
    }
    console.log('✅ Lottery results broadcasted to all servers');
  } catch (error) {
    console.error('❌ Error broadcasting lottery results:', error);
  }
}

async function initializeLotterySystem(client, data) {
  activeClient = client;
  
  if (USE_MONGODB) {
    const mongoData = await loadLotteryFromMongo();
    if (mongoData) {
      setLotteryData(mongoData);
    }
  } else if (data && data.lotteryData) {
    activeLotteries = { ...data.lotteryData };
  }
  
  for (const [serverId, lottery] of Object.entries(activeLotteries)) {
    if (lottery && lottery.active && lottery.endTime) {
      const remaining = lottery.endTime - Date.now();
      if (remaining > 0) {
        setTimeout(async () => {
          await performLotteryDraw(serverId);
        }, remaining);
        console.log(`⏰ Resumed lottery for server ${serverId} - ${Math.floor(remaining / 60000)} minutes remaining`);
      } else {
        performLotteryDraw(serverId);
      }
    }
    
    if (lottery && lottery.autoSchedule && lottery.autoSchedule.enabled) {
      scheduleNextAutoLottery(serverId);
    }
  }
  
  console.log('✅ Lottery system initialized with auto-scheduling');
}

async function stopLottery(serverId) {
  const lottery = activeLotteries[serverId];
  
  if (!lottery || !lottery.active) {
    return { success: false, message: '❌ No lottery is currently active in this server!' };
  }
  
  await performLotteryDraw(serverId);
  
  return { success: true, message: '✅ Lottery ended and winners announced!' };
}

async function joinLottery(userId, serverId, ticketCount, userData) {
  const lottery = activeLotteries[serverId];
  
  if (!lottery || !lottery.active) {
    return { success: false, message: '❌ No lottery is currently active in this server!' };
  }
  
  if (ticketCount < 1) {
    return { success: false, message: '❌ You must buy at least 1 ticket!' };
  }
  
  const totalCost = lottery.entryFee * ticketCount;
  
  if (lottery.currency === 'gems') {
    if ((userData.gems || 0) < totalCost) {
      return { 
        success: false, 
        message: `❌ Not enough gems!\nCost: ${totalCost} 💎 gems\nYou have: ${userData.gems || 0} 💎 gems`
      };
    }
  } else {
    if ((userData.coins || 0) < totalCost) {
      return { 
        success: false, 
        message: `❌ Not enough coins!\nCost: ${totalCost} 💰 coins\nYou have: ${userData.coins || 0} 💰 coins`
      };
    }
  }
  
  for (let i = 0; i < ticketCount; i++) {
    lottery.participants.push({ userId, ticketNumber: Date.now() + i });
  }
  
  lottery.prizePool += totalCost;
  
  if (USE_MONGODB) {
    await saveLotteryToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.lotteryData = activeLotteries;
    await saveDataImmediate(data);
  }
  
  const userTickets = lottery.participants.filter(p => p.userId === userId).length;
  const winChance = ((userTickets / lottery.participants.length) * 100).toFixed(2);
  
  const timeRemaining = lottery.endTime - Date.now();
  
  return { 
    success: true, 
    message: `✅ Purchased ${ticketCount} lottery ticket(s)!\n` +
      `💰 Cost: ${totalCost} ${lottery.currency === 'gems' ? '💎 gems' : '💰 coins'}\n` +
      `🎫 Your total tickets: ${userTickets}\n` +
      `📊 Your chance: ${winChance}%\n` +
      `💵 Current prize pool: ${lottery.prizePool.toLocaleString()} ${lottery.currency === 'gems' ? '💎 gems' : '💰 coins'}\n` +
      `⏰ Ends: <t:${Math.floor(lottery.endTime / 1000)}:R>`,
    cost: totalCost,
    currency: lottery.currency
  };
}

async function getLotteryInfo(serverId, userId) {
  const lottery = activeLotteries[serverId];
  
  if (!lottery || !lottery.active) {
    return { success: false, message: '❌ No lottery is currently active in this server!' };
  }
  
  const uniqueParticipants = [...new Set(lottery.participants.map(p => p.userId))].length;
  const userTickets = lottery.participants.filter(p => p.userId === userId).length;
  const hasJoined = userTickets > 0;
  
  let statusMessage = `**🎰 Lottery Status**\n\n` +
    `**Entry Fee:** ${lottery.entryFee} ${lottery.currency === 'gems' ? '💎 Gems' : '💰 Coins'}\n` +
    `**Duration:** ${lottery.duration} hour(s)\n` +
    `**Prize Pool:** ${lottery.prizePool.toLocaleString()} ${lottery.currency === 'gems' ? '💎 Gems' : '💰 Coins'}\n` +
    `**Winners:** Top 3 participants (50%, 30%, 20% split)\n` +
    `👥 Participants: ${uniqueParticipants}\n` +
    `🎟️ Total entries: ${lottery.participants.length}\n` +
    `⏰ Ends: <t:${Math.floor(lottery.endTime / 1000)}:R>\n\n`;
  
  if (hasJoined) {
    const winChance = ((userTickets / lottery.participants.length) * 100).toFixed(2);
    statusMessage += `✅ **You have already joined this lottery!**\n` +
      `🎫 Your tickets: ${userTickets}\n` +
      `📊 Your win chance: ${winChance}%\n\n`;
  }
  
  statusMessage += `Use \`!lottery join <tickets>\` to participate!`;
  
  return {
    success: true,
    message: statusMessage
  };
}

function getLotteryScheduleInfo(serverId) {
  const lottery = activeLotteries[serverId];
  
  if (!lottery) {
    return {
      exists: false,
      message: '❌ No lottery configured for this server!'
    };
  }
  
  const info = {
    exists: true,
    autoEnabled: lottery.autoSchedule?.enabled || false,
    currentlyActive: lottery.active,
    participants: lottery.participants?.length || 0,
    prizePool: lottery.prizePool || 0,
    currency: lottery.currency,
    entryFee: lottery.entryFee,
    nextRunTime: lottery.autoSchedule?.nextRunTime,
    timeUntilNext: null,
    currentEndTime: lottery.endTime,
    timeUntilEnd: null
  };
  
  if (info.nextRunTime) {
    info.timeUntilNext = formatTimeUntil(info.nextRunTime);
  }
  
  if (info.currentEndTime) {
    info.timeUntilEnd = formatTimeUntil(info.currentEndTime);
  }
  
  return info;
}

module.exports = {
  initializeLotterySystem,
  startLottery,
  stopLottery,
  joinLottery,
  getLotteryInfo,
  performLotteryDraw,
  getLotteryData,
  setLotteryData,
  enableAutoLottery,
  disableAutoLottery,
  getLotteryScheduleInfo
};
