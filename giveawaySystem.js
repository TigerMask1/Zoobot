const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

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
    interval: 24 * 60 * 60 * 1000,
    nextRunTime: null
  }
};

let activeClient = null;
let autoScheduleTimeout = null;

function getGiveawayData() {
  return activeGiveaway;
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

async function saveGiveawayToMongo() {
  if (!USE_MONGODB || !mongoManager) return;
  
  try {
    await mongoManager.saveGiveawayData(activeGiveaway);
  } catch (error) {
    console.error('Error saving giveaway to MongoDB:', error);
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

async function enableAutoGiveaway(channelId) {
  activeGiveaway.channelId = channelId;
  activeGiveaway.autoSchedule.enabled = true;
  activeGiveaway.autoSchedule.nextRunTime = Date.now() + (24 * 60 * 60 * 1000);
  
  if (USE_MONGODB) {
    await saveGiveawayToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.giveaway = activeGiveaway;
    await saveDataImmediate(data);
  }
  
  scheduleNextAutoGiveaway(channelId);
  
  return { success: true, message: '✅ Auto giveaway enabled! A giveaway will run every 24 hours.' };
}

async function disableAutoGiveaway() {
  activeGiveaway.autoSchedule.enabled = false;
  activeGiveaway.autoSchedule.nextRunTime = null;
  
  if (autoScheduleTimeout) {
    clearTimeout(autoScheduleTimeout);
    autoScheduleTimeout = null;
  }
  
  if (USE_MONGODB) {
    await saveGiveawayToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.giveaway = activeGiveaway;
    await saveDataImmediate(data);
  }
  
  return { success: true, message: '✅ Auto giveaway disabled.' };
}

function scheduleNextAutoGiveaway(channelId) {
  if (!activeGiveaway.autoSchedule.enabled || !channelId) return;
  
  if (autoScheduleTimeout) {
    clearTimeout(autoScheduleTimeout);
  }
  
  const timeUntilNext = activeGiveaway.autoSchedule.nextRunTime - Date.now();
  
  if (timeUntilNext <= 0) {
    startAutomaticGiveaway(channelId);
  } else {
    autoScheduleTimeout = setTimeout(() => {
      startAutomaticGiveaway(channelId);
    }, timeUntilNext);
    
    console.log(`⏰ Next auto giveaway scheduled in ${Math.floor(timeUntilNext / 1000 / 60 / 60)} hours`);
  }
}

async function startAutomaticGiveaway(channelId) {
  if (activeGiveaway.active) {
    activeGiveaway.autoSchedule.nextRunTime = Date.now() + (24 * 60 * 60 * 1000);
    scheduleNextAutoGiveaway(channelId);
    return;
  }
  
  await startGiveaway(channelId, 1440);
  
  activeGiveaway.autoSchedule.nextRunTime = Date.now() + (24 * 60 * 60 * 1000);
  
  if (USE_MONGODB) {
    await saveGiveawayToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.giveaway = activeGiveaway;
    await saveDataImmediate(data);
  }
  
  scheduleNextAutoGiveaway(channelId);
}

async function initializeGiveawaySystem(client, data) {
  activeClient = client;
  
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
  
  if (activeGiveaway.autoSchedule.enabled && activeGiveaway.channelId) {
    scheduleNextAutoGiveaway(activeGiveaway.channelId);
  }
  
  console.log('✅ Giveaway system initialized with auto-scheduling');
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

  if (USE_MONGODB) {
    await saveGiveawayToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    if (!data.giveaway) {
      data.giveaway = {};
    }
    data.giveaway = activeGiveaway;
    await saveDataImmediate(data);
  }

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
    
    if (USE_MONGODB) {
      await saveGiveawayToMongo();
    } else {
      const { loadData } = require('./dataManager.js');
      const data = await loadData();
      data.giveaway.messageId = message.id;
      await saveDataImmediate(data);
    }

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

  if (USE_MONGODB) {
    await saveGiveawayToMongo();
  } else {
    const { loadData } = require('./dataManager.js');
    const data = await loadData();
    data.giveaway = activeGiveaway;
    await saveDataImmediate(data);
  }

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
    
    if (USE_MONGODB) {
      await saveGiveawayToMongo();
    } else {
      const { loadData } = require('./dataManager.js');
      const data = await loadData();
      data.giveaway = activeGiveaway;
      await saveDataImmediate(data);
    }

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
    
    const { loadData } = require('./dataManager.js');
    const data = await loadData();

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

    const userData = data.users[winnerId];
    
    if (!userData.legendaryCrates) {
      userData.legendaryCrates = 0;
    }

    userData.gems = (userData.gems || 0) + activeGiveaway.prizes.gems;
    userData.coins = (userData.coins || 0) + activeGiveaway.prizes.coins;
    userData.legendaryCrates = (userData.legendaryCrates || 0) + activeGiveaway.prizes.crates.legendary;
    
    await saveDataImmediate(data);

    const winnerEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎊 GIVEAWAY WINNER!')
      .setDescription(
        `**Winner:** ${winner.tag}\n\n` +
        `**Prizes Won:**\n` +
        `💎 ${activeGiveaway.prizes.gems.toLocaleString()} Gems\n` +
        `💰 ${activeGiveaway.prizes.coins.toLocaleString()} Coins\n` +
        `📦 ${activeGiveaway.prizes.crates.legendary}x Legendary Crate\n\n` +
        `Congratulations! 🎉\n` +
        `Total Participants: ${activeGiveaway.participants.length}`
      )
      .setFooter({ text: 'Thanks everyone for participating!' })
      .setTimestamp();

    if (preservedChannelId && activeGiveaway.messageId) {
      const channel = await activeClient.channels.fetch(preservedChannelId);
      const message = await channel.messages.fetch(activeGiveaway.messageId);
      await message.edit({ embeds: [winnerEmbed], components: [] });
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
    
    if (USE_MONGODB) {
      await saveGiveawayToMongo();
    } else {
      const { loadData } = require('./dataManager.js');
      const data = await loadData();
      data.giveaway = activeGiveaway;
      await saveDataImmediate(data);
    }

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
    
    if (USE_MONGODB) {
      await saveGiveawayToMongo();
    } else {
      const { loadData } = require('./dataManager.js');
      const data = await loadData();
      data.giveaway = activeGiveaway;
      await saveDataImmediate(data);
    }

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
  enableAutoGiveaway,
  disableAutoGiveaway
};
