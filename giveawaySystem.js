const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate, saveData } = require('./dataManager.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const GIVEAWAY_CHANNEL_ID = '1445441639064801322';
const GIVEAWAY_DURATION_HOURS = 24;
const GIVEAWAY_INTERVAL_MS = 24 * 60 * 60 * 1000;

let activeGiveaway = {
  active: false,
  channelId: null,
  messageId: null,
  participants: [],
  endTime: null,
  prizes: {
    gems: 5000,
    coins: 10000,
    crates: { legendary: 2 }
  },
  autoSchedule: {
    enabled: false,
    interval: GIVEAWAY_INTERVAL_MS,
    nextRunTime: null
  }
};

let activeClient = null;
let sharedData = null;
let autoScheduleTimeout = null;
let getMainDataRef = null;
let utcSchedulerInterval = null;

function getGiveawayData() {
  return activeGiveaway;
}

function setSharedData(data) {
  sharedData = data;
}

function setMainDataGetter(getter) {
  getMainDataRef = getter;
}

function getSharedData() {
  if (getMainDataRef) {
    const currentData = getMainDataRef();
    if (currentData && currentData !== sharedData) {
      sharedData = currentData;
    }
  }
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
        nextRunTime: null
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

function getNextUTCMidnight() {
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return nextMidnight.getTime();
}

function isUTCMidnight() {
  const now = new Date();
  return now.getUTCHours() === 0 && now.getUTCMinutes() === 0;
}

async function enableAutoGiveaway(channelId) {
  activeGiveaway.channelId = channelId || GIVEAWAY_CHANNEL_ID;
  activeGiveaway.autoSchedule.enabled = true;
  activeGiveaway.autoSchedule.nextRunTime = getNextUTCMidnight();
  
  await saveGiveawayState();
  startUTCGiveawayScheduler();
  
  const nextRunDate = new Date(activeGiveaway.autoSchedule.nextRunTime);
  return { 
    success: true, 
    message: `✅ Auto giveaway enabled!\n\n📅 **Schedule:** Every 24 hours at 00:00 UTC\n⏰ **Next:** <t:${Math.floor(activeGiveaway.autoSchedule.nextRunTime / 1000)}:F>\n📍 **Channel:** <#${activeGiveaway.channelId}>` 
  };
}

async function disableAutoGiveaway() {
  activeGiveaway.autoSchedule.enabled = false;
  activeGiveaway.autoSchedule.nextRunTime = null;
  
  if (autoScheduleTimeout) {
    clearTimeout(autoScheduleTimeout);
    autoScheduleTimeout = null;
  }
  
  if (utcSchedulerInterval) {
    clearInterval(utcSchedulerInterval);
    utcSchedulerInterval = null;
  }
  
  await saveGiveawayState();
  
  return { success: true, message: '✅ Auto giveaway disabled.' };
}

function startUTCGiveawayScheduler() {
  if (utcSchedulerInterval) {
    clearInterval(utcSchedulerInterval);
  }
  
  utcSchedulerInterval = setInterval(async () => {
    await checkUTCGiveawaySchedule();
  }, 60000);
  
  console.log('🎉 UTC Giveaway scheduler started (checks every minute)');
}

async function checkUTCGiveawaySchedule() {
  if (!activeGiveaway.autoSchedule.enabled) return;
  if (!activeClient) return;
  
  const now = new Date();
  
  if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
    if (activeGiveaway.active) {
      console.log('⚠️ Skipping automatic giveaway - one is already active');
      return;
    }
    
    console.log('🎉 Starting scheduled giveaway at 00:00 UTC');
    await startAutomaticGiveaway(activeGiveaway.channelId || GIVEAWAY_CHANNEL_ID);
  }
}

async function startAutomaticGiveaway(channelId) {
  if (activeGiveaway.active) {
    console.log('⚠️ Automatic giveaway skipped - already active');
    activeGiveaway.autoSchedule.nextRunTime = getNextUTCMidnight();
    await saveGiveawayState();
    return;
  }
  
  const targetChannel = channelId || GIVEAWAY_CHANNEL_ID;
  
  await startGiveaway(targetChannel, GIVEAWAY_DURATION_HOURS * 60);
  
  activeGiveaway.autoSchedule.nextRunTime = getNextUTCMidnight();
  await saveGiveawayState();
  
  console.log(`🎉 Auto giveaway started in channel ${targetChannel}, next at ${new Date(activeGiveaway.autoSchedule.nextRunTime).toISOString()}`);
}

async function initializeGiveawaySystem(client, data) {
  activeClient = client;
  sharedData = data;
  
  if (USE_MONGODB) {
    const mongoData = await loadGiveawayFromMongo();
    if (mongoData) {
      await setGiveawayData({ giveaway: mongoData });
    }
  } else if (data && data.giveaway) {
    await setGiveawayData(data);
  }
  
  if (activeGiveaway.active && activeGiveaway.endTime) {
    const remaining = activeGiveaway.endTime - Date.now();
    if (remaining > 0) {
      setTimeout(async () => {
        await endGiveaway();
      }, remaining);
      console.log(`⏰ Resumed giveaway - ${Math.floor(remaining / 60000)} minutes remaining`);
    } else {
      await endGiveaway();
    }
  }
  
  if (activeGiveaway.autoSchedule.enabled) {
    if (!activeGiveaway.channelId) {
      activeGiveaway.channelId = GIVEAWAY_CHANNEL_ID;
    }
    startUTCGiveawayScheduler();
  }
  
  console.log('✅ Giveaway system initialized with UTC scheduling');
}

async function startGiveaway(channelId, durationMinutes) {
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

  if (activeGiveaway.participants.length === 0) {
    const messageId = activeGiveaway.messageId;
    
    activeGiveaway.active = false;
    activeGiveaway.messageId = null;
    activeGiveaway.participants = [];
    activeGiveaway.endTime = null;
    
    if (preservedAutoSchedule.enabled) {
      activeGiveaway.channelId = preservedChannelId;
      activeGiveaway.autoSchedule = preservedAutoSchedule;
    } else {
      activeGiveaway.channelId = null;
    }
    
    await saveGiveawayState();

    try {
      if (preservedChannelId && messageId) {
        const channel = await activeClient.channels.fetch(preservedChannelId);
        const message = await channel.messages.fetch(messageId);
        
        const noParticipantsEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🎉 GIVEAWAY ENDED')
          .setDescription('No one participated in this giveaway. Better luck next time!')
          .setTimestamp();

        await message.edit({ embeds: [noParticipantsEmbed], components: [] });
      }
    } catch (error) {
      console.error('Error updating giveaway message:', error);
    }

    return { success: true, message: '⚠️ Giveaway ended with no participants.' };
  }

  const winnerIndex = Math.floor(Math.random() * activeGiveaway.participants.length);
  const winnerId = activeGiveaway.participants[winnerIndex];

  try {
    const winner = await activeClient.users.fetch(winnerId);
    
    const currentData = getSharedData();
    
    if (!currentData) {
      console.error('Error: sharedData is not available in giveaway system');
      return { success: false, message: '❌ Internal error: Data not available.' };
    }

    if (!currentData.users[winnerId]) {
      currentData.users[winnerId] = {
        username: winner.username,
        coins: 0,
        gems: 0,
        characters: [],
        selectedCharacter: null,
        pendingTokens: 0,
        started: false,
        trophies: 200,
        messageCount: 0,
        lastDailyClaim: null,
        mailbox: [],
        legendaryCrates: 0
      };
    }

    const userData = currentData.users[winnerId];
    
    if (!userData.legendaryCrates) {
      userData.legendaryCrates = 0;
    }

    const gemsToAdd = activeGiveaway.prizes.gems;
    const coinsToAdd = activeGiveaway.prizes.coins;
    const cratesToAdd = activeGiveaway.prizes.crates.legendary;

    const previousGems = userData.gems || 0;
    const previousCoins = userData.coins || 0;
    const previousCrates = userData.legendaryCrates || 0;

    userData.gems = previousGems + gemsToAdd;
    userData.coins = previousCoins + coinsToAdd;
    userData.legendaryCrates = previousCrates + cratesToAdd;
    
    console.log(`🎁 Giveaway: Granting rewards to ${winner.username} (${winnerId})`);
    console.log(`🎁 Giveaway: Before - ${previousGems} gems, ${previousCoins} coins, ${previousCrates} legendary crates`);
    console.log(`🎁 Giveaway: Adding - ${gemsToAdd} gems, ${coinsToAdd} coins, ${cratesToAdd} legendary crates`);
    console.log(`🎁 Giveaway: After - ${userData.gems} gems, ${userData.coins} coins, ${userData.legendaryCrates} legendary crates`);
    
    await saveDataImmediate(currentData);
    
    console.log(`🎁 Giveaway: Data saved immediately for ${winner.username}`);

    const winnerEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎊 GIVEAWAY WINNER!')
      .setDescription(
        `**Winner:** ${winner.tag}\n\n` +
        `**Prizes Won:**\n` +
        `💎 ${gemsToAdd.toLocaleString()} Gems\n` +
        `💰 ${coinsToAdd.toLocaleString()} Coins\n` +
        `📦 ${cratesToAdd}x Legendary Crate\n\n` +
        `Congratulations! 🎉\n` +
        `Total Participants: ${activeGiveaway.participants.length}`
      )
      .setFooter({ text: 'Thanks everyone for participating!' })
      .setTimestamp();

    if (preservedChannelId && activeGiveaway.messageId) {
      try {
        const channel = await activeClient.channels.fetch(preservedChannelId);
        const message = await channel.messages.fetch(activeGiveaway.messageId);
        await message.edit({ embeds: [winnerEmbed], components: [] });
      } catch (editError) {
        console.error('Error editing giveaway message:', editError);
      }
    }

    activeGiveaway.active = false;
    activeGiveaway.messageId = null;
    activeGiveaway.participants = [];
    activeGiveaway.endTime = null;
    
    if (preservedAutoSchedule.enabled) {
      activeGiveaway.channelId = preservedChannelId;
      activeGiveaway.autoSchedule = preservedAutoSchedule;
    } else {
      activeGiveaway.channelId = null;
    }
    
    await saveGiveawayState();

    return { 
      success: true, 
      message: `🎉 Giveaway ended! Winner: ${winner.tag}`,
      winner: winner.tag
    };
  } catch (error) {
    console.error('Error ending giveaway:', error);
    
    activeGiveaway.active = false;
    activeGiveaway.messageId = null;
    activeGiveaway.participants = [];
    activeGiveaway.endTime = null;
    
    if (preservedAutoSchedule.enabled) {
      activeGiveaway.channelId = preservedChannelId;
      activeGiveaway.autoSchedule = preservedAutoSchedule;
    } else {
      activeGiveaway.channelId = null;
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

  return {
    active: true,
    participants: activeGiveaway.participants.length,
    timeLeft: minutesLeft,
    endTime: activeGiveaway.endTime
  };
}

module.exports = {
  initializeGiveawaySystem,
  startGiveaway,
  endGiveaway,
  handleButtonJoin,
  getGiveawayStatus,
  getGiveawayData,
  setGiveawayData,
  setSharedData,
  setMainDataGetter,
  getSharedData,
  enableAutoGiveaway,
  disableAutoGiveaway
};
