const { getCollection } = require('./mongoManager.js');

const MAIN_SERVER_ID = '1430516117851340893';
const SUPER_ADMINS = ['1296110901057032202', '1296109674361520146','1178728978488504400'];
const DEFAULT_GAME = 'ZooBot';

let serverConfigs = {};

async function loadServerConfigs() {
  try {
    const collection = await getCollection('serverConfigs');
    const configs = await collection.find({}).toArray();
    
    serverConfigs = {};
    for (const config of configs) {
      serverConfigs[config.serverId] = config;
    }
    
    console.log(`✅ Loaded ${configs.length} server configurations`);
  } catch (error) {
    console.error('Error loading server configs:', error);
    serverConfigs = {};
  }
}

async function saveServerConfig(serverId, config) {
  try {
    const collection = await getCollection('serverConfigs');
    await collection.updateOne(
      { serverId },
      { $set: config },
      { upsert: true }
    );
    
    serverConfigs[serverId] = { ...serverConfigs[serverId], ...config };
    return true;
  } catch (error) {
    console.error('Error saving server config:', error);
    return false;
  }
}

function getServerConfig(serverId) {
  return serverConfigs[serverId] || null;
}

function isMainServer(serverId) {
  return serverId === MAIN_SERVER_ID;
}

function isSuperAdmin(userId) {
  return SUPER_ADMINS.includes(userId);
}

function isBotAdmin(userId, serverId) {
  if (isSuperAdmin(userId)) return true;
  
  const config = getServerConfig(serverId);
  if (!config || !config.botAdmins) return false;
  
  return config.botAdmins.includes(userId);
}

function isZooAdmin(member) {
  if (!member || !member.roles) return false;
  
  return member.roles.cache.some(role => 
    role.name.toLowerCase() === 'zooadmin'
  );
}

async function addBotAdmin(serverId, userId, addedBy) {
  if (!isSuperAdmin(addedBy) && !isBotAdmin(addedBy, serverId)) {
    return { success: false, message: '❌ Only bot admins can add other admins!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, botAdmins: [] };
  
  if (!config.botAdmins) {
    config.botAdmins = [];
  }
  
  if (config.botAdmins.includes(userId)) {
    return { success: false, message: '❌ This user is already a bot admin!' };
  }
  
  config.botAdmins.push(userId);
  await saveServerConfig(serverId, config);
  
  return { success: true, message: `✅ <@${userId}> is now a bot admin!` };
}

async function removeBotAdmin(serverId, userId, removedBy) {
  if (!isSuperAdmin(removedBy)) {
    return { success: false, message: '❌ Only super admins can remove bot admins!' };
  }
  
  if (isSuperAdmin(userId)) {
    return { success: false, message: '❌ Cannot remove a super admin!' };
  }
  
  const config = getServerConfig(serverId);
  if (!config || !config.botAdmins) {
    return { success: false, message: '❌ This user is not a bot admin!' };
  }
  
  const index = config.botAdmins.indexOf(userId);
  if (index === -1) {
    return { success: false, message: '❌ This user is not a bot admin!' };
  }
  
  config.botAdmins.splice(index, 1);
  await saveServerConfig(serverId, config);
  
  return { success: true, message: `✅ <@${userId}> is no longer a bot admin!` };
}

async function setupServer(serverId, dropChannelId, eventsChannelId, updatesChannelId) {
  const config = {
    serverId,
    dropChannelId,
    eventsChannelId,
    updatesChannelId,
    dropInterval: isMainServer(serverId) ? 20000 : 30000,
    setupComplete: true,
    setupDate: new Date().toISOString(),
    botAdmins: []
  };
  
  await saveServerConfig(serverId, config);
  return config;
}

function isServerSetup(serverId) {
  if (isMainServer(serverId)) return true;
  
  const config = getServerConfig(serverId);
  return config && config.setupComplete === true;
}

function isServerFullySetup(serverId) {
  if (isMainServer(serverId)) return true;
  
  const config = getServerConfig(serverId);
  if (!config) return false;
  
  return config.setupComplete === true && 
         config.selectedGame && 
         config.dropChannelId && 
         config.eventsChannelId && 
         config.updatesChannelId;
}

function hasSelectedGame(serverId) {
  if (isMainServer(serverId)) return true;
  
  const config = getServerConfig(serverId);
  return config && config.selectedGame;
}

function getServerGame(serverId) {
  if (isMainServer(serverId)) return DEFAULT_GAME;
  
  const config = getServerConfig(serverId);
  return config ? config.selectedGame : null;
}

function getSetupStatus(serverId) {
  if (isMainServer(serverId)) {
    return {
      isComplete: true,
      hasGame: true,
      hasDropChannel: true,
      hasEventsChannel: true,
      hasUpdatesChannel: true,
      selectedGame: DEFAULT_GAME,
      missing: []
    };
  }
  
  const config = getServerConfig(serverId);
  if (!config) {
    return {
      isComplete: false,
      hasGame: false,
      hasDropChannel: false,
      hasEventsChannel: false,
      hasUpdatesChannel: false,
      selectedGame: null,
      missing: ['game', 'drop channel', 'events channel', 'updates channel']
    };
  }
  
  const missing = [];
  if (!config.selectedGame) missing.push('game');
  if (!config.dropChannelId) missing.push('drop channel');
  if (!config.eventsChannelId) missing.push('events channel');
  if (!config.updatesChannelId) missing.push('updates channel');
  
  return {
    isComplete: missing.length === 0,
    hasGame: !!config.selectedGame,
    hasDropChannel: !!config.dropChannelId,
    hasEventsChannel: !!config.eventsChannelId,
    hasUpdatesChannel: !!config.updatesChannelId,
    selectedGame: config.selectedGame || null,
    missing
  };
}

function getDropInterval(serverId) {
  return isMainServer(serverId) ? 20000 : 30000;
}

function getDropChannel(serverId) {
  if (isMainServer(serverId)) {
    return null;
  }
  
  const config = getServerConfig(serverId);
  return config ? config.dropChannelId : null;
}

function getEventsChannel(serverId) {
  if (isMainServer(serverId)) {
    return null;
  }
  
  const config = getServerConfig(serverId);
  return config ? config.eventsChannelId : null;
}

function getUpdatesChannel(serverId) {
  const config = getServerConfig(serverId);
  return config ? config.updatesChannelId : null;
}

async function setDropChannel(serverId, channelId, setBy, member) {
  if (isMainServer(serverId)) {
    return { success: false, message: '❌ Cannot change drop channel on main server!' };
  }
  
  if (!isSuperAdmin(setBy) && !isZooAdmin(member)) {
    return { success: false, message: '❌ Only users with the **ZooAdmin** role can set the drop channel!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, botAdmins: [] };
  config.dropChannelId = channelId;
  config.dropInterval = 30000;
  
  if (config.dropChannelId && config.eventsChannelId && config.updatesChannelId && !config.setupComplete) {
    config.setupComplete = true;
    config.setupDate = new Date().toISOString();
  }
  
  await saveServerConfig(serverId, config);
  
  let responseMessage = `✅ Drop channel set to <#${channelId}>!`;
  if (config.setupComplete) {
    responseMessage += '\n🎉 **Setup complete!** All channels configured!';
  } else {
    const missing = [];
    if (!config.eventsChannelId) missing.push('events channel');
    if (!config.updatesChannelId) missing.push('updates channel');
    if (missing.length > 0) {
      responseMessage += `\n⚠️ **Still need to set:** ${missing.join(', ')}`;
    }
  }
  
  return { success: true, message: responseMessage, setupComplete: config.setupComplete };
}

async function setEventsChannel(serverId, channelId, setBy, member) {
  if (isMainServer(serverId)) {
    return { success: false, message: '❌ Cannot change events channel on main server!' };
  }
  
  if (!isSuperAdmin(setBy) && !isZooAdmin(member)) {
    return { success: false, message: '❌ Only users with the **ZooAdmin** role can set the events channel!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, botAdmins: [] };
  config.eventsChannelId = channelId;
  
  if (config.dropChannelId && config.eventsChannelId && config.updatesChannelId && !config.setupComplete) {
    config.setupComplete = true;
    config.setupDate = new Date().toISOString();
  }
  
  await saveServerConfig(serverId, config);
  
  let responseMessage = `✅ Events channel set to <#${channelId}>!`;
  if (config.setupComplete) {
    responseMessage += '\n🎉 **Setup complete!** The bot is now fully configured for your server!';
  } else {
    const missing = [];
    if (!config.dropChannelId) missing.push('drop channel');
    if (!config.updatesChannelId) missing.push('updates channel');
    if (missing.length > 0) {
      responseMessage += `\n⚠️ **Still need to set:** ${missing.join(', ')}`;
    }
  }
  
  return { success: true, message: responseMessage, setupComplete: config.setupComplete };
}

async function setUpdatesChannel(serverId, channelId, setBy, member) {
  if (!isSuperAdmin(setBy) && !isZooAdmin(member)) {
    return { success: false, message: '❌ Only users with the **ZooAdmin** role can set the updates channel!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, botAdmins: [] };
  config.updatesChannelId = channelId;
  
  if (config.dropChannelId && config.eventsChannelId && config.updatesChannelId && !config.setupComplete) {
    config.setupComplete = true;
    config.setupDate = new Date().toISOString();
  }
  
  await saveServerConfig(serverId, config);
  
  let responseMessage = `✅ Updates channel set to <#${channelId}>!`;
  if (config.setupComplete) {
    responseMessage += '\n🎉 **Setup complete!** All channels configured!';
  } else {
    const missing = [];
    if (!config.dropChannelId) missing.push('drop channel');
    if (!config.eventsChannelId) missing.push('events channel');
    if (missing.length > 0) {
      responseMessage += `\n⚠️ **Still need to set:** ${missing.join(', ')}`;
    }
  }
  
  return { success: true, message: responseMessage, setupComplete: config.setupComplete };
}

module.exports = {
  loadServerConfigs,
  saveServerConfig,
  getServerConfig,
  isMainServer,
  isSuperAdmin,
  isBotAdmin,
  isZooAdmin,
  addBotAdmin,
  removeBotAdmin,
  setupServer,
  isServerSetup,
  isServerFullySetup,
  hasSelectedGame,
  getServerGame,
  getSetupStatus,
  getDropInterval,
  getDropChannel,
  getEventsChannel,
  getUpdatesChannel,
  setDropChannel,
  setEventsChannel,
  setUpdatesChannel,
  MAIN_SERVER_ID,
  SUPER_ADMINS,
  DEFAULT_GAME
};
