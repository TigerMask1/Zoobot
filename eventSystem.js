const { EmbedBuilder } = require('discord.js');
const dataManager = require('./dataManager');
const { sendMailToAll, addMailToUser } = require('./mailSystem');
const { addCageKeys, initializeKeys } = require('./keySystem');
const { getEventsChannel, isMainServer } = require('./serverConfigManager');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager');
}

const EVENT_TYPES = ['trophy_hunt', 'crate_master', 'drop_catcher'];
const EVENT_DURATION_MS = 24 * 60 * 60 * 1000;

const EVENT_DISPLAY_NAMES = {
  trophy_hunt: '🏆 Trophy Hunt',
  crate_master: '📦 Crate Master',
  drop_catcher: '💰 Drop Catcher'
};

const EVENT_DESCRIPTIONS = {
  trophy_hunt: 'Earn the most trophies from battles to win!',
  crate_master: 'Open the most crates to claim victory!',
  drop_catcher: 'Catch the most drops to dominate!'
};

let currentEventTimer = null;
let botClient = null;
let eventChannelId = null;
let scheduleCheckInterval = null;
let sharedData = null;
let isTransitioning = false;

// In-memory event state for JSON mode
let jsonModeEvent = null;
let jsonModeParticipants = {};
let jsonModeSchedule = {
  timezone: 'Asia/Kolkata',
  startTime: '05:30',
  enabled: true,
  lastRun: null
};

// Fixed channel ID
const FIXED_CHANNEL_ID = '1432171168168808620';

// IST is UTC+5:30
const IST_OFFSET_HOURS = 5;
const IST_OFFSET_MINUTES = 30;

function convertISTToUTC(istHour, istMinute) {
  let utcHour = istHour - IST_OFFSET_HOURS;
  let utcMinute = istMinute - IST_OFFSET_MINUTES;
  
  if (utcMinute < 0) {
    utcMinute += 60;
    utcHour -= 1;
  }
  
  if (utcHour < 0) {
    utcHour += 24;
  }
  
  return { hour: utcHour, minute: utcMinute };
}

function getISTTime(date = new Date()) {
  const utcTime = date.getTime();
  const istOffset = (IST_OFFSET_HOURS * 60 + IST_OFFSET_MINUTES) * 60 * 1000;
  const istTime = new Date(utcTime + istOffset);
  
  return {
    hour: istTime.getUTCHours(),
    minute: istTime.getUTCMinutes(),
    date: istTime
  };
}

async function getEventSchedule() {
  if (!USE_MONGODB) {
    return jsonModeSchedule;
  }
  return await mongoManager.getEventSchedule();
}

async function upsertEventSchedule(config) {
  if (!USE_MONGODB) {
    jsonModeSchedule = { ...jsonModeSchedule, ...config };
    return true;
  }
  return await mongoManager.upsertEventSchedule(config);
}

async function getCurrentEvent() {
  if (!USE_MONGODB) {
    return jsonModeEvent;
  }
  return await mongoManager.getCurrentEvent();
}

async function getEventParticipants(eventId) {
  if (!USE_MONGODB) {
    const participants = Object.values(jsonModeParticipants);
    return participants.sort((a, b) => b.score - a.score);
  }
  return await mongoManager.getEventParticipants(eventId);
}

async function getEventParticipant(eventId, userId) {
  if (!USE_MONGODB) {
    return jsonModeParticipants[userId] || null;
  }
  return await mongoManager.getEventParticipant(eventId, userId);
}

async function recordEventProgressInternal(eventId, userId, username, delta) {
  if (!USE_MONGODB) {
    if (!jsonModeParticipants[userId]) {
      jsonModeParticipants[userId] = {
        userId,
        username,
        score: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    jsonModeParticipants[userId].score += delta;
    jsonModeParticipants[userId].username = username;
    jsonModeParticipants[userId].updatedAt = new Date();
    return true;
  }
  return await mongoManager.recordEventProgress(eventId, userId, username, delta);
}

async function createEventInternal(eventData) {
  if (!USE_MONGODB) {
    jsonModeEvent = {
      ...eventData,
      _id: 'json_event_' + Date.now()
    };
    jsonModeParticipants = {};
    return jsonModeEvent._id;
  }
  return await mongoManager.createEvent(eventData);
}

async function updateEventInternal(eventId, updateData) {
  if (!USE_MONGODB) {
    if (jsonModeEvent) {
      jsonModeEvent = { ...jsonModeEvent, ...updateData };
    }
    return true;
  }
  return await mongoManager.updateEvent(eventId, updateData);
}

async function checkAndStartScheduledEvent() {
  const schedule = await getEventSchedule();
  
  if (!schedule.enabled) {
    return;
  }
  
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  const istNow = getISTTime();
  
  if (istNow.hour === startHour && istNow.minute === startMinute) {
    const lastRun = schedule.lastRun ? new Date(schedule.lastRun) : null;
    const now = new Date();
    
    if (!lastRun || (now - lastRun) > 60 * 1000) {
      while (isTransitioning) {
        console.log('⏰ Waiting for ongoing event transition to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      isTransitioning = true;
      try {
        const activeEvent = await getCurrentEvent();
        
        if (activeEvent && activeEvent.status === 'active') {
          console.log('🛑 Stopping current event before starting scheduled event');
          if (currentEventTimer) {
            clearTimeout(currentEventTimer);
            currentEventTimer = null;
          }
          await endEvent(activeEvent);
        }
        
        await startNextEvent();
        await upsertEventSchedule({ ...schedule, lastRun: now });
        console.log(`⏰ Started scheduled event at ${schedule.startTime} IST`);
      } finally {
        isTransitioning = false;
      }
    }
  }
}

function startScheduler() {
  if (scheduleCheckInterval) {
    clearInterval(scheduleCheckInterval);
  }
  
  scheduleCheckInterval = setInterval(async () => {
    await checkAndStartScheduledEvent();
  }, 60 * 1000);
  
  console.log('⏰ Event scheduler started - checking every minute for scheduled events');
}

function stopScheduler() {
  if (scheduleCheckInterval) {
    clearInterval(scheduleCheckInterval);
    scheduleCheckInterval = null;
    console.log('⏰ Event scheduler stopped');
  }
}

async function init(client, data) {
  botClient = client;
  sharedData = data;

  // Always force event channel to the fixed ID
  eventChannelId = FIXED_CHANNEL_ID;
  data.eventChannelId = FIXED_CHANNEL_ID;

  // Save it for consistency
  await dataManager.saveData(data);

  // Initialize event schedule
  await getEventSchedule();

  // Check if an active event exists
  const activeEvent = await getCurrentEvent();

  if (activeEvent) {
    // If it uses an old/wrong channel, fix it
    if (activeEvent.announcementChannelId !== FIXED_CHANNEL_ID) {
      await updateEventInternal(activeEvent._id, {
        announcementChannelId: FIXED_CHANNEL_ID
      });
      console.log(`🔧 Updated active event channel to fixed ID: ${FIXED_CHANNEL_ID}`);
    }

    const now = new Date();
    const endAt = new Date(activeEvent.endAt);

    if (now >= endAt) {
      await endEvent(activeEvent);
      await startNextEvent();
    } else {
      const timeUntilEnd = endAt - now;
      scheduleEventEnd(activeEvent, timeUntilEnd);
      console.log(
        `📅 Event "${EVENT_DISPLAY_NAMES[activeEvent.eventType]}" is active, ends in ${Math.round(timeUntilEnd / 1000 / 60)} minutes`
      );
    }
  } else {
    await startNextEvent();
  }
  
  startScheduler();
}

function scheduleEventEnd(event, timeUntilEnd) {
  if (currentEventTimer) {
    clearTimeout(currentEventTimer);
  }

  currentEventTimer = setTimeout(async () => {
    while (isTransitioning) {
      console.log('⏱️ Timer waiting for ongoing transition to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    isTransitioning = true;
    try {
      await endEvent(event);
      await startNextEvent();
      
      const schedule = await getEventSchedule();
      await upsertEventSchedule({ ...schedule, lastRun: new Date() });
      console.log('⏰ Updated lastRun after timer-driven transition');
    } finally {
      isTransitioning = false;
    }
  }, timeUntilEnd);
}

async function startNextEvent() {
  let rotationIndex = 0;
  
  if (USE_MONGODB) {
    const eventsCollection = await mongoManager.getCollection('events');
    const lastEvent = await eventsCollection.findOne({}, { sort: { startAt: -1 } });
    if (lastEvent && lastEvent.rotationIndex !== undefined) {
      rotationIndex = (lastEvent.rotationIndex + 1) % EVENT_TYPES.length;
    }
  } else {
    // In JSON mode, rotate based on current event
    if (jsonModeEvent && jsonModeEvent.rotationIndex !== undefined) {
      rotationIndex = (jsonModeEvent.rotationIndex + 1) % EVENT_TYPES.length;
    }
  }

  const eventType = EVENT_TYPES[rotationIndex];
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + EVENT_DURATION_MS);

  const eventData = {
    eventType,
    status: 'active',
    startAt,
    endAt,
    rotationIndex,
    announcementChannelId: FIXED_CHANNEL_ID,
    leaderboardSnapshot: null,
    rewardsDistributed: false
  };

  const eventId = await createEventInternal(eventData);
  eventData._id = eventId;

  scheduleEventEnd(eventData, EVENT_DURATION_MS);
  await announceEventStart(eventData);

  console.log(`🎉 Started new event: ${EVENT_DISPLAY_NAMES[eventType]}`);
}

async function endEvent(event) {
  const participants = await getEventParticipants(event._id);

  const leaderboard = participants.map((p, index) => ({
    rank: index + 1,
    userId: p.userId,
    username: p.username,
    score: p.score
  }));

  await updateEventInternal(event._id, {
    status: 'ended',
    leaderboardSnapshot: leaderboard
  });

  await distributeRewards(event, leaderboard);
  await announceEventEnd(event, leaderboard);

  console.log(`🏁 Ended event: ${EVENT_DISPLAY_NAMES[event.eventType]}`);
}

async function distributeRewards(event, leaderboard) {
  if (leaderboard.length === 0) {
    console.log('⚠️ No participants to distribute rewards to');
    return;
  }

  if (!sharedData) {
    console.error('❌ sharedData is null in distributeRewards - event system not initialized properly');
    return;
  }

  const rewards = [
    { gems: 500, coins: 5000, cageKeys: 5, crates: [{ type: 'legendary', count: 1 }], place: '🥇 1st Place' },
    { gems: 250, coins: 2500, cageKeys: 3, crates: [{ type: 'emerald', count: 1 }], place: '🥈 2nd Place' },
    { gems: 150, coins: 1500, cageKeys: 1, crates: [{ type: 'gold', count: 2 }], place: '🥉 3rd Place' }
  ];

  const top5PercentCount = Math.max(1, Math.ceil(leaderboard.length * 0.05));
  const eventName = EVENT_DISPLAY_NAMES[event.eventType];

  for (let i = 0; i < leaderboard.length; i++) {
    const participant = leaderboard[i];
    const userId = participant.userId;

    if (!sharedData.users[userId]) {
      sharedData.users[userId] = {
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

    const userData = sharedData.users[userId];
    initializeKeys(userData);

    let rewardGems = 0;
    let rewardCoins = 0;
    let rewardCageKeys = 0;
    let rewardCrates = null;
    let mailMessage = '';
    let crateSummary = '';

    if (i < 3 && i < rewards.length) {
      rewardGems = rewards[i].gems;
      rewardCoins = rewards[i].coins;
      rewardCageKeys = rewards[i].cageKeys;
      rewardCrates = rewards[i].crates;
      
      if (rewardCrates && rewardCrates.length > 0) {
        const crateDesc = rewardCrates.map(c => `${c.count}x ${c.type.charAt(0).toUpperCase() + c.type.slice(1)}`).join(', ');
        crateSummary = `\n📦 ${crateDesc} Crate${rewardCrates.length > 1 || rewardCrates[0].count > 1 ? 's' : ''}`;
      }
      
      mailMessage = `🎉 Congratulations! You placed ${rewards[i].place} in ${eventName}!\n\n✅ Rewards automatically added to your account:\n💎 ${rewardGems} Gems\n💰 ${rewardCoins} Coins\n🎫 ${rewardCageKeys} Cage Keys${crateSummary}\n\nNo claiming needed - check your balance with !profile!`;
      
      if (rewardCoins) {
        userData.coins = (userData.coins || 0) + rewardCoins;
      }
      if (rewardGems) {
        userData.gems = (userData.gems || 0) + rewardGems;
      }
      if (rewardCageKeys) {
        addCageKeys(userData, rewardCageKeys);
      }
      
      if (rewardCrates && rewardCrates.length > 0) {
        for (const crate of rewardCrates) {
          const crateKey = `${crate.type}Crates`;
          userData[crateKey] = (userData[crateKey] || 0) + crate.count;
        }
      }
    } else if (i < top5PercentCount) {
      rewardGems = 75;
      rewardCoins = 750;
      mailMessage = `🎖️ Congratulations! You placed in the Top 5% of ${eventName}!\n\n✅ Rewards automatically added to your account:\n💎 ${rewardGems} Gems\n💰 ${rewardCoins} Coins\n\nNo claiming needed - check your balance with !profile!`;
      
      if (rewardGems) {
        userData.gems = (userData.gems || 0) + rewardGems;
      }
      if (rewardCoins) {
        userData.coins = (userData.coins || 0) + rewardCoins;
      }
    }

    if (rewardGems > 0 || rewardCoins > 0 || rewardCageKeys > 0 || rewardCrates) {
      const notificationMail = {
        id: Date.now() + Math.random(),
        from: 'Event System',
        subject: `${eventName} - ${i < 3 ? rewards[i].place : 'Top 5%'}`,
        message: mailMessage,
        rewards: {},
        claimed: true,
        timestamp: new Date()
      };
      addMailToUser(userData, notificationMail);
      console.log(`✅ Auto-distributed event rewards to user ${userId}: ${rewardGems} gems, ${rewardCoins} coins, ${rewardCageKeys} cage keys${crateSummary}`);
    }
  }

  await dataManager.saveDataImmediate(sharedData);
  console.log(`💾 Saved event rewards to database for ${leaderboard.length} participants`);
  
  await updateEventInternal(event._id, { rewardsDistributed: true });
  console.log(`🎁 Distributed rewards to ${leaderboard.length} participants`);
}

async function announceEventStart(event) {
  if (!botClient) return;

  try {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`${EVENT_DISPLAY_NAMES[event.eventType]} Has Started! 🎉`)
      .setDescription(EVENT_DESCRIPTIONS[event.eventType])
      .addFields(
        { name: '⏰ Duration', value: '24 Hours', inline: true },
        { name: '🏆 Rewards', value: 'Top 3 and Top 5% get prizes!', inline: true }
      )
      .addFields(
        { name: '🥇 1st Place', value: '500 💎 + 5,000 💰 + 5 🎫 + 1 <:emoji_6:1439554298693550102> Legendary Crate', inline: true },
        { name: '🥈 2nd Place', value: '250 💎 + 2,500 💰 + 3 🎫 + 1 <:emoji_4:1439554205709766747> Emerald Crate', inline: true },
        { name: '🥉 3rd Place', value: '150 💎 + 1,500 💰 + 1 🎫 + 2 <:emoji_2:1439429824862093445> Gold Crates', inline: true },
        { name: '🎖️ Top 5%', value: '75 💎 + 750 💰', inline: true }
      )
      .addFields({
        name: '📊 Track Progress',
        value: 'Use `!event` to see your current points!',
        inline: false
      })
      .setTimestamp();

    for (const guild of botClient.guilds.cache.values()) {
      let targetChannelId;
      
      if (isMainServer(guild.id)) {
        targetChannelId = FIXED_CHANNEL_ID;
      } else {
        targetChannelId = getEventsChannel(guild.id);
      }
      
      if (targetChannelId) {
        const channel = await botClient.channels.fetch(targetChannelId).catch(() => null);
        if (channel) {
          await channel.send({ content: '@everyone', embeds: [embed] }).catch(err => {
            console.error(`Failed to announce event start to server ${guild.id}:`, err.message);
          });
        }
      }
    }
    console.log('✅ Event start announced to all servers');
  } catch (error) {
    console.error('Error announcing event start:', error);
  }
}

async function announceEventEnd(event, leaderboard) {
  if (!botClient) return;

  try {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`${EVENT_DISPLAY_NAMES[event.eventType]} Has Ended! 🏁`)
      .setDescription('Thank you to all participants! Here are the winners:')
      .setTimestamp();

    if (leaderboard.length === 0) {
      embed.addFields({
        name: '🏆 Winners',
        value: 'None - No participants',
        inline: false
      });
    } else {
      const top3 = leaderboard.slice(0, 3);
      const medals = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < 3; i++) {
        if (i < top3.length) {
          const participant = top3[i];
          embed.addFields({
            name: `${medals[i]} ${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'} Place`,
            value: `${participant.username} - ${participant.score} points`,
            inline: false
          });
        } else {
          embed.addFields({
            name: `${medals[i]} ${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'} Place`,
            value: 'None',
            inline: false
          });
        }
      }

      const top5PercentCount = Math.max(1, Math.ceil(leaderboard.length * 0.05));
      const top5PercentOthers = Math.max(0, top5PercentCount - 3);

      if (top5PercentOthers > 0) {
        embed.addFields({
          name: '🎖️ Top 5%',
          value: `${top5PercentOthers} other ${top5PercentOthers === 1 ? 'player' : 'players'} also received rewards!`,
          inline: false
        });
      }
    }

    embed.addFields({
      name: '📊 View Results',
      value: 'Use `!event` to see your rank and points!',
      inline: false
    });

    for (const guild of botClient.guilds.cache.values()) {
      let targetChannelId;
      
      if (isMainServer(guild.id)) {
        targetChannelId = FIXED_CHANNEL_ID;
      } else {
        targetChannelId = getEventsChannel(guild.id);
      }
      
      if (targetChannelId) {
        const channel = await botClient.channels.fetch(targetChannelId).catch(() => null);
        if (channel) {
          await channel.send({ content: '@everyone', embeds: [embed] }).catch(err => {
            console.error(`Failed to announce event end to server ${guild.id}:`, err.message);
          });
        }
      }
    }
    console.log('✅ Event end announced to all servers');
  } catch (error) {
    console.error('Error announcing event end:', error);
  }
}

async function recordProgress(userId, username, delta, eventType) {
  const activeEvent = await getCurrentEvent();

  if (!activeEvent || activeEvent.status !== 'active') {
    return false;
  }

  if (activeEvent.eventType !== eventType) {
    return false;
  }

  return await recordEventProgressInternal(
    activeEvent._id,
    userId,
    username,
    delta
  );
}

async function getEventInfo(userId) {
  const activeEvent = await getCurrentEvent();

  if (!activeEvent) {
    return { status: 'no_event', message: 'No event is currently active.' };
  }

  const now = new Date();
  const endAt = new Date(activeEvent.endAt);

  if (activeEvent.status === 'active' && now < endAt) {
    const participants = await getEventParticipants(activeEvent._id);
    const userParticipant = await getEventParticipant(
      activeEvent._id,
      userId
    );

    const userScore = userParticipant ? userParticipant.score : 0;
    const userRank = participants.findIndex(p => p.userId === userId) + 1;

    const timeRemaining = endAt - now;
    const hoursRemaining = Math.floor(timeRemaining / 1000 / 60 / 60);
    const minutesRemaining = Math.floor((timeRemaining / 1000 / 60) % 60);

    return {
      status: 'active',
      eventType: activeEvent.eventType,
      displayName: EVENT_DISPLAY_NAMES[activeEvent.eventType],
      description: EVENT_DESCRIPTIONS[activeEvent.eventType],
      userScore,
      userRank: userRank > 0 ? userRank : 'Unranked',
      totalParticipants: participants.length,
      timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`,
      endAt
    };
  } else {
    const leaderboard = activeEvent.leaderboardSnapshot || [];
    const userEntry = leaderboard.find(p => p.userId === userId);

    return {
      status: 'ended',
      eventType: activeEvent.eventType,
      displayName: EVENT_DISPLAY_NAMES[activeEvent.eventType],
      userScore: userEntry ? userEntry.score : 0,
      userRank: userEntry ? userEntry.rank : 'Did not participate',
      totalParticipants: leaderboard.length,
      leaderboard: leaderboard.slice(0, 3)
    };
  }
}

async function startEventManually(eventType = null) {
  const activeEvent = await getCurrentEvent();
  
  if (activeEvent && activeEvent.status === 'active') {
    return {
      success: false,
      message: `❌ An event is already active: ${EVENT_DISPLAY_NAMES[activeEvent.eventType]}\nUse !stopevent first to stop it.`
    };
  }
  
  if (eventType && !EVENT_TYPES.includes(eventType)) {
    return {
      success: false,
      message: `❌ Invalid event type! Valid types: trophy, drop, crate\n\nUsage: \`!startevent <type>\` or \`!startevent\` to start next in rotation.`
    };
  }
  
  if (eventType) {
    await startSpecificEvent(eventType);
  } else {
    await startNextEvent();
  }
  
  return {
    success: true,
    message: '✅ Event started manually! Check the events channel for details.'
  };
}

async function startSpecificEvent(eventType) {
  let rotationIndex = 0;
  
  if (USE_MONGODB) {
    const eventsCollection = await mongoManager.getCollection('events');
    const lastEvent = await eventsCollection.findOne({}, { sort: { startAt: -1 } });
    if (lastEvent && lastEvent.rotationIndex !== undefined) {
      rotationIndex = (lastEvent.rotationIndex + 1) % EVENT_TYPES.length;
    }
  }
  
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + EVENT_DURATION_MS);
  
  const eventData = {
    eventType,
    status: 'active',
    startAt,
    endAt,
    rotationIndex,
    announcementChannelId: FIXED_CHANNEL_ID,
    leaderboardSnapshot: null,
    rewardsDistributed: false
  };
  
  const eventId = await createEventInternal(eventData);
  eventData._id = eventId;
  
  scheduleEventEnd(eventData, EVENT_DURATION_MS);
  await announceEventStart(eventData);
  
  console.log(`🎉 Started specific event: ${EVENT_DISPLAY_NAMES[eventType]}`);
}

async function stopEventManually() {
  const activeEvent = await getCurrentEvent();
  
  if (!activeEvent || activeEvent.status !== 'active') {
    return {
      success: false,
      message: '❌ No active event to stop.'
    };
  }
  
  if (isTransitioning) {
    return {
      success: false,
      message: '⚠️ Event transition already in progress. Please wait a moment and try again.'
    };
  }
  
  if (currentEventTimer) {
    clearTimeout(currentEventTimer);
    currentEventTimer = null;
  }
  
  await endEvent(activeEvent);
  
  return {
    success: true,
    message: `✅ ${EVENT_DISPLAY_NAMES[activeEvent.eventType]} has been stopped and rewards have been distributed.`
  };
}

async function getScheduleInfo() {
  const schedule = await getEventSchedule();
  const istNow = getISTTime();
  
  return {
    enabled: schedule.enabled,
    startTime: schedule.startTime,
    timezone: schedule.timezone,
    currentISTTime: `${String(istNow.hour).padStart(2, '0')}:${String(istNow.minute).padStart(2, '0')}`,
    lastRun: schedule.lastRun ? new Date(schedule.lastRun).toISOString() : 'Never'
  };
}

async function toggleSchedule(enabled) {
  const schedule = await getEventSchedule();
  await upsertEventSchedule({ ...schedule, enabled });
  
  return {
    success: true,
    message: enabled 
      ? `✅ Automatic event scheduling enabled! Events will start daily at ${schedule.startTime} IST.`
      : '✅ Automatic event scheduling disabled. Use !startevent to start events manually.'
  };
}

async function updateScheduleTime(newTime) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  
  if (!timeRegex.test(newTime)) {
    return {
      success: false,
      message: '❌ Invalid time format. Use HH:MM format (e.g., 05:30)'
    };
  }
  
  const schedule = await getEventSchedule();
  await upsertEventSchedule({ ...schedule, startTime: newTime });
  
  return {
    success: true,
    message: `✅ Event start time updated to ${newTime} IST!`
  };
}

module.exports = {
  init,
  recordProgress,
  getEventInfo,
  startEventManually,
  stopEventManually,
  getScheduleInfo,
  toggleSchedule,
  updateScheduleTime,
  EVENT_TYPES,
  EVENT_DISPLAY_NAMES,
  EVENT_DESCRIPTIONS
};
