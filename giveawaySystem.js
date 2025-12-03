const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

let activeGiveaway = {
  active: false,
  channelId: '1430526386593861733',
  messageId: null,
  participants: [],
  endTime: null,
  prizes: {
    gems: 500,
    coins: 10000,
    crates: { legendary: 2 }
  },
  autoSchedule: {
    enabled: false,
    interval: 24 * 60 * 60 * 1000,
    nextRunTime: null,
    startHourUTC: 0, // 00:00 UTC
    startMinuteUTC: 0
  }
};

let activeClient = null;
let sharedData = null;
let autoScheduleTimeout = null;

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

function getGiveawayData() {
  return activeGiveaway;
}

function setSharedData(data) {
  sharedData = data;
}

function getSharedData() {
  return sharedData;
}

async function setGiveawayData(data) {
  if (data && data.giveaway) {
    activeGiveaway = {
      active: data.giveaway.active || false,
      channelId: data.giveaway.channelId || null,
      messageId: data.giveaway.messageId || null,
      participants: data.giveaway.participants || [],
      endTime: data.giveaway.endTime || null,
      prizes: data.giveaway.prizes || {
        gems: 5000,
        coins: 10000,
        crates: { legendary: 2 }
      },
      autoSchedule: data.giveaway.autoSchedule || {
        enabled: false,
        interval: 24 * 60 * 60 * 1000,
        nextRunTime: null,
        startHourUTC: data.giveaway.autoSchedule?.startHourUTC ?? 0,
        startMinuteUTC: data.giveaway.autoSchedule?.startMinuteUTC ?? 0
      }
    };
  }
}

async function saveGiveawayState() {
  if (USE_MONGODB) {
    try {
      await mongoManager.saveGiveawayData(activeGiveaway);
    } catch (error) {
      console.error('Error saving giveaway to MongoDB:', error);
    }
  } else if (sharedData) {
    sharedData.giveaway = { ...activeGiveaway };
    await saveDataImmediate(sharedData);
  }
}

async function loadGiveawayFromMongo() {
  if (!USE_MONGODB || !mongoManager) return null;

  try {
    return await mongoManager.loadGiveawayData();
  } catch (error) {
    console.error('Error loading giveaway from MongoDB:', error);
    return null;
  }
}

async function enableAutoGiveaway(channelId, startHour = 0, startMinute = 0) {
  if (!activeClient) {
    return { success: false, message: '❌ Bot client not initialized.' };
  }
  
  activeGiveaway.channelId = channelId;
  activeGiveaway.autoSchedule.enabled = true;
  activeGiveaway.autoSchedule.startHourUTC = startHour;
  activeGiveaway.autoSchedule.startMinuteUTC = startMinute;

  // Calculate the first run time precisely at the next specified UTC time
  const now = new Date();
  const targetTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startHour, startMinute));
  
  let nextRunTime;
  if (targetTime.getTime() <= now.getTime()) {
    // If the target time has already passed today, schedule for tomorrow
    nextRunTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, startHour, startMinute)).getTime();
  } else {
    nextRunTime = targetTime.getTime();
  }
  
  activeGiveaway.autoSchedule.nextRunTime = nextRunTime;

  await saveGiveawayState();
  scheduleNextAutoGiveaway(channelId);

  return { success: true, message: `✅ Auto giveaway enabled! Giveaways will run every 24 hours, starting at ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} UTC.` };
}

async function disableAutoGiveaway() {
  activeGiveaway.autoSchedule.enabled = false;
  activeGiveaway.autoSchedule.nextRunTime = null;

  if (autoScheduleTimeout) {
    clearTimeout(autoScheduleTimeout);
    autoScheduleTimeout = null;
  }

  await saveGiveawayState();

  return { success: true, message: '✅ Auto giveaway disabled.' };
}

function scheduleNextAutoGiveaway(channelId) {
  if (!activeGiveaway.autoSchedule.enabled || !channelId) {
    console.log('Auto giveaway not enabled or channel ID missing. Skipping scheduling.');
    return;
  }

  if (autoScheduleTimeout) {
    clearTimeout(autoScheduleTimeout);
    autoScheduleTimeout = null;
    console.log('Cleared existing auto giveaway timeout.');
  }

  const nowTimestamp = Date.now();
  const nowDate = new Date(nowTimestamp);
  let timeUntilNext = activeGiveaway.autoSchedule.nextRunTime - nowTimestamp;

  console.log(`Current time: ${nowDate.toISOString()}`);
  console.log(`Next scheduled run: ${new Date(activeGiveaway.autoSchedule.nextRunTime).toISOString()}`);
  console.log(`Time until next auto giveaway: ${formatTimeUntil(activeGiveaway.autoSchedule.nextRunTime)}`);

  if (timeUntilNext <= 0) {
    // If it's time or past time, start immediately and reschedule for the *next* day
    console.log('Time for auto giveaway. Starting now.');
    startAutomaticGiveaway(channelId);
    // Ensure nextRunTime is set for the *following* day's scheduled time
    const { startHourUTC, startMinuteUTC } = activeGiveaway.autoSchedule;
    activeGiveaway.autoSchedule.nextRunTime = new Date(Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1, // Schedule for tomorrow
      startHourUTC,
      startMinuteUTC
    )).getTime();
    scheduleNextAutoGiveaway(channelId); // Re-schedule with the new time
  } else {
    // Schedule for the calculated future time
    autoScheduleTimeout = setTimeout(() => {
      startAutomaticGiveaway(channelId);
    }, timeUntilNext);
    console.log(`⏰ Next auto giveaway scheduled via setTimeout for ${Math.floor(timeUntilNext / 1000)} seconds from now.`);
  }
  saveGiveawayState(); // Save the potentially updated nextRunTime
}


async function startAutomaticGiveaway(channelId) {
  console.log(`Attempting to start automatic giveaway in channel ${channelId}...`);
  if (!activeClient) {
    console.error('❌ Bot client not initialized. Cannot start automatic giveaway.');
    return;
  }
  
  // Check if a giveaway is already running - don't try to end it, just skip
  if (activeGiveaway.active) {
    console.log('An active giveaway is already running. Skipping auto-start to avoid conflicts.');
    // Just reschedule for later, don't try to end the current one
    return;
  }

  const giveawayDurationMinutes = 1440; // Default to 24 hours for auto giveaways if not specified otherwise
  const result = await startGiveaway(channelId, giveawayDurationMinutes);

  if (result.success) {
    const nowDate = new Date();
    const { startHourUTC, startMinuteUTC } = activeGiveaway.autoSchedule;
    
    // Set next run time for the *following* day at the specified UTC time
    activeGiveaway.autoSchedule.nextRunTime = new Date(Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1,
      startHourUTC,
      startMinuteUTC
    )).getTime();
    
    await saveGiveawayState();
    scheduleNextAutoGiveaway(channelId); // Schedule the *next* one
  } else {
    console.error('Failed to start automatic giveaway:', result.message);
    // If starting failed, still try to schedule the next one
    const nowDate = new Date();
    const { startHourUTC, startMinuteUTC } = activeGiveaway.autoSchedule;
    activeGiveaway.autoSchedule.nextRunTime = new Date(Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1,
      startHourUTC,
      startMinuteUTC
    )).getTime();
    scheduleNextAutoGiveaway(channelId);
  }
}

async function initializeGiveawaySystem(client, data) {
  activeClient = client;
  sharedData = data; // Store the reference to the main bot's data object

  console.log('📊 Giveaway system: sharedData reference established');

  if (USE_MONGODB) {
    const mongoData = await loadGiveawayFromMongo();
    if (mongoData) {
      await setGiveawayData({ giveaway: mongoData });
      console.log('Loaded giveaway data from MongoDB.');
    }
  } else if (data && data.giveaway) {
    await setGiveawayData(data);
    console.log('Loaded giveaway data from shared data.');
  }

  // Initialize nextRunTime for auto schedule if enabled but not set
  if (activeGiveaway.autoSchedule.enabled && !activeGiveaway.autoSchedule.nextRunTime) {
    console.log('Auto giveaway enabled but nextRunTime not set. Calculating initial nextRunTime.');
    const nowTimestamp = Date.now();
    const nowDate = new Date(nowTimestamp);
    const { startHourUTC, startMinuteUTC } = activeGiveaway.autoSchedule;
    let nextRunTime = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate(), startHourUTC, startMinuteUTC)).getTime();
    
    if (nextRunTime <= nowTimestamp) {
      nextRunTime = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() + 1, startHourUTC, startMinuteUTC)).getTime();
    }
    activeGiveaway.autoSchedule.nextRunTime = nextRunTime;
    await saveGiveawayState();
  }


  // Clean up stale giveaway data on startup
  if (activeGiveaway.active && activeGiveaway.endTime) {
    const remaining = activeGiveaway.endTime - Date.now();
    if (remaining > 0) {
      // Verify the giveaway message still exists before resuming
      if (activeGiveaway.messageId && activeGiveaway.channelId) {
        try {
          const channel = await activeClient.channels.fetch(activeGiveaway.channelId).catch(() => null);
          if (channel) {
            const message = await channel.messages.fetch(activeGiveaway.messageId).catch(() => null);
            if (!message) {
              console.log('⚠️ Giveaway message was deleted - clearing stale giveaway');
              activeGiveaway.active = false;
              activeGiveaway.messageId = null;
              activeGiveaway.participants = [];
              activeGiveaway.endTime = null;
              await saveGiveawayState();
            } else {
              setTimeout(async () => {
                await endGiveaway();
              }, remaining);
              console.log(`⏰ Resumed giveaway - ${Math.floor(remaining / 60000)} minutes remaining`);
            }
          } else {
            console.log('⚠️ Giveaway channel not found - clearing stale giveaway');
            activeGiveaway.active = false;
            activeGiveaway.messageId = null;
            activeGiveaway.participants = [];
            activeGiveaway.endTime = null;
            await saveGiveawayState();
          }
        } catch (error) {
          console.log('⚠️ Error checking giveaway message:', error.message);
        }
      } else {
        setTimeout(async () => {
          await endGiveaway();
        }, remaining);
        console.log(`⏰ Resumed giveaway - ${Math.floor(remaining / 60000)} minutes remaining`);
      }
    } else {
      console.log('⚠️ Giveaway time has expired - ending now');
      await endGiveaway(); // End giveaway if its time has already passed
    }
  }

  if (activeGiveaway.autoSchedule.enabled && activeGiveaway.channelId) {
    console.log(`Initializing auto giveaway scheduler for channel ${activeGiveaway.channelId}`);
    scheduleNextAutoGiveaway(activeGiveaway.channelId);
  }

  console.log('✅ Giveaway system initialized with shared data reference');
}

async function startGiveaway(channelId, durationMinutes) {
  if (!activeClient) {
    return { success: false, message: '❌ Bot client not initialized.' };
  }

  // Check for conflicting auto-giveaway schedule
  if (activeGiveaway.autoSchedule.enabled && activeGiveaway.autoSchedule.nextRunTime > Date.now()) {
    const timeUntilNextAuto = activeGiveaway.autoSchedule.nextRunTime - Date.now();
    const giveawayDurationMs = durationMinutes * 60 * 1000;
    
    // If the manual giveaway starts before the next auto giveaway is scheduled to end
    if (Date.now() + giveawayDurationMs >= activeGiveaway.autoSchedule.nextRunTime) {
      console.log('Manual giveaway started, interrupting the next scheduled auto giveaway.');
      // Clear the existing auto schedule timeout
      if (autoScheduleTimeout) {
        clearTimeout(autoScheduleTimeout);
        autoScheduleTimeout = null;
      }
      // Update nextRunTime to be after this manual giveaway ends, plus the interval
      activeGiveaway.autoSchedule.nextRunTime = Date.now() + giveawayDurationMs + activeGiveaway.autoSchedule.interval;
      await saveGiveawayState();
      // Re-schedule the auto giveaway for after this one finishes
      scheduleNextAutoGiveaway(activeGiveaway.channelId);
    }
  }

  if (activeGiveaway.active) {
    return { success: false, message: '❌ A giveaway is already running! Use `!endgiveaway` to end it first.' };
  }

  activeGiveaway = {
    ...activeGiveaway,
    active: true,
    channelId: channelId,
    messageId: null,
    participants: [],
    endTime: Date.now() + (durationMinutes * 60 * 1000),
    prizes: {
      gems: 5000,
      coins: 10000,
      crates: { legendary: 2 }
    }
  };

  await saveGiveawayState();

  const giveawayEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🎉 GIVEAWAY STARTED!')
    .setDescription(
      `**Duration:** ${durationMinutes} minutes\n` +
      `**Ends:** <t:${Math.floor(activeGiveaway.endTime / 1000)}:R>\n\n` +
      `**Prizes:**\n` +
      `💎 ${activeGiveaway.prizes.gems.toLocaleString()} Gems\n` +
      `💰 ${activeGiveaway.prizes.coins.toLocaleString()} Coins\n` +
      `📦 ${activeGiveaway.prizes.crates.legendary}x Legendary Crate\n\n` +
      `**Click the button below to enter!**\n` +
      `👥 Participants: 0`
    )
    .setFooter({ text: 'Good luck everyone!' })
    .setTimestamp();

  const button = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('join_giveaway')
        .setLabel('🎁 Join Giveaway')
        .setStyle(ButtonStyle.Success)
    );

  try {
    const channel = await activeClient.channels.fetch(channelId);
    const message = await channel.send({ embeds: [giveawayEmbed], components: [button] });

    activeGiveaway.messageId = message.id;
    await saveGiveawayState();

    setTimeout(async () => {
      // Check if the giveaway is still active and the end time matches before ending
      if (activeGiveaway.active && activeGiveaway.endTime <= Date.now() + 1000) {
        await endGiveaway();
      }
    }, durationMinutes * 60 * 1000);

    return { 
      success: true, 
      message: `✅ Giveaway started! It will end <t:${Math.floor(activeGiveaway.endTime / 1000)}:R>` 
    };
  } catch (error) {
    console.error('Error starting giveaway:', error);
    activeGiveaway.active = false;
    activeGiveaway.messageId = null; // Ensure messageId is cleared on failure
    activeGiveaway.endTime = null; // Ensure endTime is cleared on failure
    await saveGiveawayState(); // Save the cleared state
    return { success: false, message: '❌ Failed to start giveaway. Check the channel ID.' };
  }
}

async function handleButtonJoin(interaction) {
  if (!activeGiveaway.active) {
    return await interaction.reply({ 
      content: '❌ This giveaway has ended!', 
      ephemeral: true 
    });
  }

  const userId = interaction.user.id;

  if (activeGiveaway.participants.includes(userId)) {
    return await interaction.reply({ 
      content: '✅ You are already entered in this giveaway!', 
      ephemeral: true 
    });
  }

  activeGiveaway.participants.push(userId);
  await saveGiveawayState();

  const updatedEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🎉 GIVEAWAY STARTED!')
    .setDescription(
      `**Duration:** Ends <t:${Math.floor(activeGiveaway.endTime / 1000)}:R>\n\n` +
      `**Prizes:**\n` +
      `💎 ${activeGiveaway.prizes.gems.toLocaleString()} Gems\n` +
      `💰 ${activeGiveaway.prizes.coins.toLocaleString()} Coins\n` +
      `📦 ${activeGiveaway.prizes.crates.legendary}x Legendary Crate\n\n` +
      `**Click the button below to enter!**\n` +
      `👥 Participants: ${activeGiveaway.participants.length}`
    )
    .setFooter({ text: 'Good luck everyone!' })
    .setTimestamp();

  try {
    await interaction.update({ embeds: [updatedEmbed] });
  } catch (error) {
    console.error('Error updating giveaway message:', error);
  }

  return await interaction.followUp({ 
    content: '🎉 You have successfully joined the giveaway! Good luck!', 
    ephemeral: true 
  });
}

async function endGiveaway() {
  if (!activeGiveaway.active) {
    return { success: false, message: '❌ No giveaway is currently active!' };
  }

  const preservedChannelId = activeGiveaway.channelId;
  const preservedAutoSchedule = { ...activeGiveaway.autoSchedule };
  const isAutoGiveaway = activeGiveaway.autoSchedule.enabled && activeGiveaway.channelId === preservedChannelId; // Heuristic to determine if this was an auto giveaway

  if (activeGiveaway.participants.length === 0) {
    const messageId = activeGiveaway.messageId;

    activeGiveaway.active = false;
    activeGiveaway.messageId = null;
    activeGiveaway.participants = [];
    activeGiveaway.endTime = null;

    if (preservedAutoSchedule.enabled && isAutoGiveaway) {
      activeGiveaway.channelId = preservedChannelId; // Keep channelId for auto
      activeGiveaway.autoSchedule = preservedAutoSchedule; // Keep auto schedule settings
      // Schedule the next auto giveaway if it was an auto giveaway that ended with no participants
      scheduleNextAutoGiveaway(preservedChannelId); 
    } else {
      activeGiveaway.channelId = null; // Clear channelId if it was a manual giveaway
      activeGiveaway.autoSchedule.enabled = false; // Disable auto if it was manual
    }

    await saveGiveawayState();

    try {
      if (preservedChannelId && messageId) {
        const channel = await activeClient.channels.fetch(preservedChannelId).catch(() => null);
        if (channel) {
          const message = await channel.messages.fetch(messageId).catch(() => null);
          if (message) {
            const noParticipantsEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('🎉 GIVEAWAY ENDED')
              .setDescription('No one participated in this giveaway. Better luck next time!')
              .setTimestamp();

            await message.edit({ embeds: [noParticipantsEmbed], components: [] }).catch(() => {
              console.log('Could not edit giveaway message - it may have been deleted');
            });
          } else {
            console.log('Giveaway message not found - it may have been deleted');
          }
        }
      }
    } catch (error) {
      console.log('Could not update giveaway message:', error.message);
    }

    return { success: true, message: '⚠️ Giveaway ended with no participants.' };
  }

  const winnerIndex = Math.floor(Math.random() * activeGiveaway.participants.length);
  const winnerId = activeGiveaway.participants[winnerIndex];

  try {
    if (!sharedData) {
      console.error('❌ CRITICAL: sharedData reference is null in giveaway system!');
      return { success: false, message: '❌ Internal error: Data not available.' };
    }

    console.log('✅ Using shared data reference for giveaway rewards');

    if (!sharedData.users[winnerId]) {
      sharedData.users[winnerId] = {
        username: 'Unknown', coins: 0, gems: 0, characters: [],
        selectedCharacter: null, pendingTokens: 0, started: false,
        trophies: 200, messageCount: 0, lastDailyClaim: null, mailbox: [],
        legendaryCrates: 0, emeraldCrates: 0, goldCrates: 0, silverCrates: 0,
        bronzeCrates: 0, tyrantCrates: 0
      };
    }

    const userData = sharedData.users[winnerId];

    if (!userData.legendaryCrates) userData.legendaryCrates = 0;
    if (!userData.emeraldCrates) userData.emeraldCrates = 0;
    if (!userData.goldCrates) userData.goldCrates = 0;

    const gemsToAdd = activeGiveaway.prizes.gems || 500;
    const coinsToAdd = activeGiveaway.prizes.coins || 10000;
    const cratesToAdd = activeGiveaway.prizes.crates?.legendary || 2;

    userData.gems += gemsToAdd;
    userData.coins += coinsToAdd;
    userData.legendaryCrates += cratesToAdd;

    const winner = await activeClient.users.fetch(winnerId).catch(() => null);
    const winnerTag = winner?.tag || `User ${winnerId}`;

    console.log(`🎁 Giveaway: Granted rewards to ${winnerTag} (${winnerId})`);
    console.log(`   💎 Gems: ${gemsToAdd} (new total: ${userData.gems})`);
    console.log(`   💰 Coins: ${coinsToAdd} (new total: ${userData.coins})`);
    console.log(`   📦 Legendary Crates: ${cratesToAdd} (new total: ${userData.legendaryCrates})`);

    await saveDataImmediate(sharedData);
    console.log('💾 Giveaway rewards saved to shared data');

    const winnerEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎊 GIVEAWAY WINNER!')
      .setDescription(
        `**Winner:** ${winnerTag}\n\n` +
        `**Prizes Won:**\n` +
        `💎 ${gemsToAdd.toLocaleString()} Gems\n` +
        `💰 ${coinsToAdd.toLocaleString()} Coins\n` +
        `📦 ${cratesToAdd}x Legendary Crate\n\n` +
        `Congratulations! 🎉\n` +
        `Total Participants: ${activeGiveaway.participants.length}`
      )
      .setFooter({ text: 'Thanks everyone for participating!' })
      .setTimestamp();

    const mainServerInviteEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎊 GIVEAWAY WINNER ANNOUNCEMENT!')
      .setDescription(
        `**Congratulations to ${winnerTag}!** 🎉\n\n` +
        `**Prizes Won:**\n` +
        `💎 ${gemsToAdd.toLocaleString()} Gems\n` +
        `💰 ${coinsToAdd.toLocaleString()} Coins\n` +
        `📦 ${cratesToAdd}x Legendary Crate\n\n` +
        `**Want to participate in future giveaways?**\n` +
        `Join our main server where giveaways happen regularly!\n\n` +
        `🎁 Regular giveaways with amazing prizes\n` +
        `🌟 Exclusive events and drops\n` +
        `👥 Active community of players\n` +
        `⚡ Faster drops (20s vs 30s)\n\n` +
        `Use \`!servers\` to find the main server invite!`
      )
      .setFooter({ text: 'Don\'t miss out on the next giveaway!' })
      .setTimestamp();

    if (preservedChannelId && activeGiveaway.messageId) {
      try {
        const channel = await activeClient.channels.fetch(preservedChannelId).catch(() => null);
        if (channel) {
          const message = await channel.messages.fetch(activeGiveaway.messageId).catch(() => null);
          if (message) {
            await message.edit({ embeds: [winnerEmbed], components: [] }).catch(() => {
              console.log('Could not edit winner message - it may have been deleted');
            });
          } else {
            console.log('Winner giveaway message not found - posting new announcement');
            await channel.send({ embeds: [winnerEmbed] }).catch(() => {});
          }
        }
      } catch (editError) {
        console.log('Error editing giveaway message:', editError.message);
      }
    }

    if (activeClient) {
      const { getEventsChannel } = require('./serverConfigManager.js');
      let broadcastCount = 0;

      for (const guild of activeClient.guilds.cache.values()) {
        try {
          const eventsChannelId = getEventsChannel(guild.id);
          if (eventsChannelId) {
            const channel = await activeClient.channels.fetch(eventsChannelId).catch(() => null);
            if (channel) {
              await channel.send({ embeds: [mainServerInviteEmbed] });
              broadcastCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to broadcast giveaway winner to ${guild.name}:`, error.message);
        }
      }

      console.log(`📢 Giveaway winner broadcasted to ${broadcastCount} servers`);
    }

    activeGiveaway.active = false;
    activeGiveaway.messageId = null;
    activeGiveaway.participants = [];
    activeGiveaway.endTime = null;

    if (preservedAutoSchedule.enabled && isAutoGiveaway) {
      activeGiveaway.channelId = preservedChannelId;
      activeGiveaway.autoSchedule = preservedAutoSchedule;
      scheduleNextAutoGiveaway(preservedChannelId); // Re-schedule the next auto giveaway
    } else {
      activeGiveaway.channelId = null;
      activeGiveaway.autoSchedule.enabled = false;
    }

    await saveGiveawayState();

    return { 
      success: true, 
      message: `🎉 Giveaway ended! Winner: ${winnerTag}`,
      winner: winnerTag
    };
  } catch (error) {
    console.error('Error ending giveaway:', error);

    activeGiveaway.active = false;
    activeGiveaway.messageId = null;
    activeGiveaway.participants = [];
    activeGiveaway.endTime = null;

    if (preservedAutoSchedule.enabled && isAutoGiveaway) {
      activeGiveaway.channelId = preservedChannelId;
      activeGiveaway.autoSchedule = preservedAutoSchedule;
      scheduleNextAutoGiveaway(preservedChannelId);
    } else {
      activeGiveaway.channelId = null;
      activeGiveaway.autoSchedule.enabled = false;
    }

    await saveGiveawayState();

    return { success: false, message: '❌ Error ending giveaway.' };
  }
}

function getGiveawayStatus() {
  if (!activeGiveaway.active) {
    return { active: false, message: '❌ No giveaway is currently active!' };
  }

  const timeLeft = activeGiveaway.endTime - Date.now();
  const minutesLeft = Math.floor(timeLeft / 60000);

  let statusMessage = `**Giveaway Status:**\n`;
  statusMessage += `  - **Active:** Yes\n`;
  statusMessage += `  - **Ends:** <t:${Math.floor(activeGiveaway.endTime / 1000)}:R> (${minutesLeft} minutes left)\n`;
  statusMessage += `  - **Participants:** ${activeGiveaway.participants.length}\n`;
  
  if (activeGiveaway.autoSchedule.enabled) {
    statusMessage += `  - **Auto Schedule:** Enabled\n`;
    if (activeGiveaway.autoSchedule.nextRunTime) {
      statusMessage += `  - **Next Auto Run:** <t:${Math.floor(activeGiveaway.autoSchedule.nextRunTime / 1000)}:R> (${formatTimeUntil(activeGiveaway.autoSchedule.nextRunTime)})\n`;
    } else {
      statusMessage += `  - **Next Auto Run:** Not yet scheduled\n`;
    }
  } else {
    statusMessage += `  - **Auto Schedule:** Disabled\n`;
  }

  return { active: true, message: statusMessage };
}

function getLotteryStatus() {
  // Placeholder for lottery status, similar to giveaway status
  return { active: false, message: 'Lottery system not implemented yet.' };
}

module.exports = {
  initializeGiveawaySystem,
  startGiveaway,
  endGiveaway,
  handleButtonJoin,
  getGiveawayStatus,
  getLotteryStatus, // Add lottery status
  getGiveawayData,
  setGiveawayData,
  setSharedData,
  getSharedData,
  enableAutoGiveaway,
  disableAutoGiveaway
};