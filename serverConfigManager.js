const fs = require('fs');
const path = require('path');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const SERVER_CONFIGS_FILE = path.join(__dirname, 'serverConfigs.json');

const MAIN_SERVER_ID = '1430516117851340893';
const SUPER_ADMINS = ['1296110901057032202', '1296109674361520146','1178728978488504400'];

const GAME_MODES = {
  ZOOBOT: 'zoobot',
  CUSTOM: 'custom',
  NONE: null
};

const SETUP_EXEMPT_COMMANDS = [
  'setup', 'help', 'setgamemode', 'creategame', 'loadgame',
  'setdropchannel', 'seteventschannel', 'setupdateschannel',
  'addadmin', 'removeadmin', 'ping'
];

let serverConfigs = {};

function loadServerConfigsFromFile() {
  try {
    if (fs.existsSync(SERVER_CONFIGS_FILE)) {
      const rawData = fs.readFileSync(SERVER_CONFIGS_FILE, 'utf8');
      serverConfigs = JSON.parse(rawData);
      console.log(`✅ Loaded ${Object.keys(serverConfigs).length} server configurations (JSON mode)`);
    } else {
      serverConfigs = {};
      console.log('✅ Server configs ready (JSON mode - no existing configs)');
    }
  } catch (error) {
    console.error('Error loading server configs from file:', error);
    serverConfigs = {};
  }
}

function saveServerConfigsToFile() {
  try {
    fs.writeFileSync(SERVER_CONFIGS_FILE, JSON.stringify(serverConfigs, null, 2));
  } catch (error) {
    console.error('Error saving server configs to file:', error);
  }
}

async function loadServerConfigs() {
  if (!USE_MONGODB) {
    loadServerConfigsFromFile();
    return;
  }

  try {
    const collection = await mongoManager.getCollection('serverConfigs');
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
  if (!USE_MONGODB) {
    serverConfigs[serverId] = { ...serverConfigs[serverId], ...config, serverId };
    saveServerConfigsToFile();
    return true;
  }

  try {
    const collection = await mongoManager.getCollection('serverConfigs');
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

function getServerGameMode(serverId) {
  if (isMainServer(serverId)) return GAME_MODES.ZOOBOT;
  
  const config = getServerConfig(serverId);
  return config?.gameMode || null;
}

function isGameModeSet(serverId) {
  if (isMainServer(serverId)) return true;
  
  const config = getServerConfig(serverId);
  return config?.gameMode && (config.gameMode === GAME_MODES.ZOOBOT || config.gameMode === GAME_MODES.CUSTOM);
}

function isSetupExemptCommand(command) {
  return SETUP_EXEMPT_COMMANDS.includes(command.toLowerCase());
}

function requiresGameModeCheck(serverId, command) {
  if (isMainServer(serverId)) return false;
  if (isSetupExemptCommand(command)) return false;
  return !isGameModeSet(serverId);
}

async function setServerGameMode(serverId, gameMode, setBy, member) {
  if (isMainServer(serverId)) {
    return { success: false, message: '❌ Cannot change game mode on the main server!' };
  }
  
  if (!isSuperAdmin(setBy) && !isZooAdmin(member)) {
    return { success: false, message: '❌ Only users with the **ZooAdmin** role can set the game mode!' };
  }
  
  if (!Object.values(GAME_MODES).includes(gameMode)) {
    return { success: false, message: `❌ Invalid game mode! Use: ${Object.values(GAME_MODES).join(', ')}` };
  }
  
  const config = getServerConfig(serverId) || { serverId, botAdmins: [] };
  
  if (config.gameMode && config.gameMode !== gameMode) {
    return { 
      success: false, 
      message: `❌ This server already has game mode set to "${config.gameMode}". Changing game modes would affect existing players. Contact a super admin if you need to switch.`
    };
  }
  
  config.gameMode = gameMode;
  config.gameModeSetAt = Date.now();
  config.gameModeSetBy = setBy;
  
  await saveServerConfig(serverId, config);
  
  return { 
    success: true, 
    message: gameMode === GAME_MODES.CUSTOM 
      ? `✅ Game mode set to **Custom**!\n\nNext steps:\n1. Create your custom game with \`!creategame <name>\`\n2. Create characters with \`!createcharacter\`\n3. Set 3 starter characters with \`!setstarters\``
      : `✅ Game mode set to **ZooBot**!\n\nYour server will use the standard ZooBot characters and systems.`
  };
}

function isCustomGameServer(serverId) {
  return getServerGameMode(serverId) === GAME_MODES.CUSTOM;
}

function isZooBotServer(serverId) {
  return getServerGameMode(serverId) === GAME_MODES.ZOOBOT;
}

async function getGameModeInfo(serverId) {
  const config = getServerConfig(serverId);
  const gameMode = getServerGameMode(serverId);
  
  return {
    serverId,
    gameMode,
    gameModeSetAt: config?.gameModeSetAt || null,
    gameModeSetBy: config?.gameModeSetBy || null,
    customGameId: config?.customGameId || null
  };
}

async function linkCustomGame(serverId, customGameId) {
  const config = getServerConfig(serverId) || { serverId };
  config.customGameId = customGameId;
  await saveServerConfig(serverId, config);
  return { success: true };
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
  getDropInterval,
  getDropChannel,
  getEventsChannel,
  getUpdatesChannel,
  setDropChannel,
  setEventsChannel,
  setUpdatesChannel,
  getServerGameMode,
  setServerGameMode,
  isGameModeSet,
  isSetupExemptCommand,
  requiresGameModeCheck,
  isCustomGameServer,
  isZooBotServer,
  getGameModeInfo,
  linkCustomGame,
  MAIN_SERVER_ID,
  SUPER_ADMINS,
  GAME_MODES,
  SETUP_EXEMPT_COMMANDS
};
