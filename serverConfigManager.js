const { getCollection } = require('./mongoManager.js');
const { BOT_CONFIG } = require('./config.js');

const MAIN_SERVER_ID = BOT_CONFIG.MAIN_SERVER_ID;
const SUPER_ADMINS = BOT_CONFIG.SUPER_ADMINS;
const DEFAULT_GAME = 'ZooBot';

let serverConfigs = {};
let globalBotAdmins = [];

const DEFAULT_FEATURE_SETTINGS = {
  pingOnDrops: false,
  pingOnEvents: false,
  pingOnGiveaways: true,
  pingOnLottery: true,
  pingOnUpdates: false,
  dropPingRole: null,
  eventPingRole: null,
  giveawayPingRole: null,
  lotteryPingRole: null,
  updatePingRole: null,
  dropsEnabled: true,
  eventsEnabled: true,
  giveawaysEnabled: true,
  lotteryEnabled: true,
  tradingEnabled: true,
  marketEnabled: true,
  battlesEnabled: true,
  minigamesEnabled: true,
  triviaEnabled: true,
  clanSystemEnabled: true,
  leaderboardsEnabled: true,
  workSystemEnabled: true,
  questsEnabled: true,
  dailyRewardsEnabled: true,
  profanityFilter: false,
  autoModEnabled: false,
  maxWarningsBeforeBan: 5,
  welcomeNewPlayers: true,
  showTutorialHints: true
};

async function loadServerConfigs() {
  try {
    const collection = await getCollection('serverConfigs');
    const configs = await collection.find({}).toArray();
    
    serverConfigs = {};
    for (const config of configs) {
      serverConfigs[config.serverId] = config;
    }
    
    const globalConfig = await collection.findOne({ _id: 'global_bot_admins' });
    if (globalConfig && globalConfig.admins) {
      globalBotAdmins = globalConfig.admins;
    }
    
    console.log(`✅ Loaded ${configs.length} server configurations`);
    console.log(`✅ Loaded ${globalBotAdmins.length} global bot admins`);
  } catch (error) {
    console.error('Error loading server configs:', error);
    serverConfigs = {};
    globalBotAdmins = [];
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

async function saveGlobalBotAdmins() {
  try {
    const collection = await getCollection('serverConfigs');
    await collection.updateOne(
      { _id: 'global_bot_admins' },
      { $set: { admins: globalBotAdmins, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error saving global bot admins:', error);
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

function isGlobalBotAdmin(userId) {
  if (isSuperAdmin(userId)) return true;
  return globalBotAdmins.includes(userId);
}

function isServerOwner(member) {
  if (!member || !member.guild) return false;
  return member.guild.ownerId === member.id;
}

function isServerAdmin(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (isGlobalBotAdmin(userId)) return true;
  
  if (member && isServerOwner(member)) return true;
  
  const config = getServerConfig(serverId);
  if (config && config.serverAdmins && config.serverAdmins.includes(userId)) {
    return true;
  }
  
  return false;
}

function isZooAdmin(member) {
  if (!member || !member.roles) return false;
  
  const config = getServerConfig(member.guild?.id);
  const zooAdminRoleName = config?.zooAdminRoleName || 'zooadmin';
  
  return member.roles.cache.some(role => 
    role.name.toLowerCase() === zooAdminRoleName.toLowerCase()
  );
}

function isBotAdmin(userId, serverId = null) {
  return isGlobalBotAdmin(userId);
}

function canManageBot(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (isGlobalBotAdmin(userId)) return true;
  if (member && isServerOwner(member)) return true;
  if (isServerAdmin(userId, serverId, member)) return true;
  if (member && isZooAdmin(member)) return true;
  return false;
}

function canModerate(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (isGlobalBotAdmin(userId)) return true;
  if (member && isServerOwner(member)) return true;
  if (isServerAdmin(userId, serverId, member)) return true;
  if (member && isZooAdmin(member)) return true;
  return false;
}

function canManageEconomy(userId) {
  return isSuperAdmin(userId);
}

function canApproveContent(userId) {
  return isSuperAdmin(userId) || isGlobalBotAdmin(userId);
}

function canBanGlobally(userId) {
  return isSuperAdmin(userId) || isGlobalBotAdmin(userId);
}

function canBanInServer(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (isGlobalBotAdmin(userId)) return true;
  if (member && isServerOwner(member)) return true;
  if (isServerAdmin(userId, serverId, member)) return true;
  return false;
}

function canMuteInServer(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (isGlobalBotAdmin(userId)) return true;
  if (member && isServerOwner(member)) return true;
  if (isServerAdmin(userId, serverId, member)) return true;
  if (member && isZooAdmin(member)) return true;
  return false;
}

function canToggleFeatures(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (member && isServerOwner(member)) return true;
  if (isServerAdmin(userId, serverId, member)) return true;
  return false;
}

function canSetupServer(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return true;
  if (member && isServerOwner(member)) return true;
  if (isServerAdmin(userId, serverId, member)) return true;
  return false;
}

function getUserRole(userId, serverId, member = null) {
  if (isSuperAdmin(userId)) return { level: 5, name: 'Super Admin', emoji: '👑', color: 0xFFD700 };
  if (isGlobalBotAdmin(userId)) return { level: 4, name: 'Bot Admin', emoji: '⚡', color: 0xFF6B6B };
  if (member && isServerOwner(member)) return { level: 3, name: 'Server Owner', emoji: '🏠', color: 0x9B59B6 };
  if (isServerAdmin(userId, serverId, member)) return { level: 2, name: 'Server Admin', emoji: '🛡️', color: 0x3498DB };
  if (member && isZooAdmin(member)) return { level: 1, name: 'ZooAdmin', emoji: '🔧', color: 0x2ECC71 };
  return { level: 0, name: 'Player', emoji: '🎮', color: 0x95A5A6 };
}

async function addGlobalBotAdmin(userId, addedBy) {
  if (!isSuperAdmin(addedBy)) {
    return { success: false, message: '❌ Only **Super Admins** can add global Bot Admins!' };
  }
  
  if (isSuperAdmin(userId)) {
    return { success: false, message: '❌ This user is already a Super Admin!' };
  }
  
  if (globalBotAdmins.includes(userId)) {
    return { success: false, message: '❌ This user is already a Bot Admin!' };
  }
  
  globalBotAdmins.push(userId);
  await saveGlobalBotAdmins();
  
  return { success: true, message: `✅ <@${userId}> is now a **Global Bot Admin**!` };
}

async function removeGlobalBotAdmin(userId, removedBy) {
  if (!isSuperAdmin(removedBy)) {
    return { success: false, message: '❌ Only **Super Admins** can remove global Bot Admins!' };
  }
  
  const index = globalBotAdmins.indexOf(userId);
  if (index === -1) {
    return { success: false, message: '❌ This user is not a Bot Admin!' };
  }
  
  globalBotAdmins.splice(index, 1);
  await saveGlobalBotAdmins();
  
  return { success: true, message: `✅ <@${userId}> is no longer a Bot Admin.` };
}

async function addServerAdmin(serverId, userId, addedBy, member = null) {
  if (!isSuperAdmin(addedBy) && !isGlobalBotAdmin(addedBy) && !(member && isServerOwner(member))) {
    return { success: false, message: '❌ Only **Super Admins**, **Bot Admins**, or the **Server Owner** can add Server Admins!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, serverAdmins: [] };
  
  if (!config.serverAdmins) {
    config.serverAdmins = [];
  }
  
  if (config.serverAdmins.includes(userId)) {
    return { success: false, message: '❌ This user is already a Server Admin!' };
  }
  
  config.serverAdmins.push(userId);
  await saveServerConfig(serverId, config);
  
  return { success: true, message: `✅ <@${userId}> is now a **Server Admin** for this server!` };
}

async function removeServerAdmin(serverId, userId, removedBy, member = null) {
  if (!isSuperAdmin(removedBy) && !isGlobalBotAdmin(removedBy) && !(member && isServerOwner(member))) {
    return { success: false, message: '❌ Only **Super Admins**, **Bot Admins**, or the **Server Owner** can remove Server Admins!' };
  }
  
  const config = getServerConfig(serverId);
  if (!config || !config.serverAdmins) {
    return { success: false, message: '❌ This user is not a Server Admin!' };
  }
  
  const index = config.serverAdmins.indexOf(userId);
  if (index === -1) {
    return { success: false, message: '❌ This user is not a Server Admin!' };
  }
  
  config.serverAdmins.splice(index, 1);
  await saveServerConfig(serverId, config);
  
  return { success: true, message: `✅ <@${userId}> is no longer a Server Admin.` };
}

function getFeatureSettings(serverId) {
  const config = getServerConfig(serverId);
  if (!config || !config.features) {
    return { ...DEFAULT_FEATURE_SETTINGS };
  }
  return { ...DEFAULT_FEATURE_SETTINGS, ...config.features };
}

async function updateFeatureSetting(serverId, featureName, value, updatedBy, member = null) {
  if (!canToggleFeatures(updatedBy, serverId, member)) {
    return { success: false, message: '❌ Only **Server Owners** or **Server Admins** can change feature settings!' };
  }
  
  if (!(featureName in DEFAULT_FEATURE_SETTINGS)) {
    return { success: false, message: `❌ Unknown feature: ${featureName}` };
  }
  
  const config = getServerConfig(serverId) || { serverId };
  if (!config.features) {
    config.features = { ...DEFAULT_FEATURE_SETTINGS };
  }
  
  config.features[featureName] = value;
  await saveServerConfig(serverId, config);
  
  return { success: true, message: `✅ Feature **${featureName}** has been ${typeof value === 'boolean' ? (value ? 'enabled' : 'disabled') : `set to ${value}`}!` };
}

async function updateMultipleFeatures(serverId, features, updatedBy, member = null) {
  if (!canToggleFeatures(updatedBy, serverId, member)) {
    return { success: false, message: '❌ Only **Server Owners** or **Server Admins** can change feature settings!' };
  }
  
  const config = getServerConfig(serverId) || { serverId };
  if (!config.features) {
    config.features = { ...DEFAULT_FEATURE_SETTINGS };
  }
  
  for (const [key, value] of Object.entries(features)) {
    if (key in DEFAULT_FEATURE_SETTINGS) {
      config.features[key] = value;
    }
  }
  
  await saveServerConfig(serverId, config);
  
  return { success: true, message: '✅ Feature settings have been updated!' };
}

function isFeatureEnabled(serverId, featureName) {
  const settings = getFeatureSettings(serverId);
  return settings[featureName] !== false;
}

function getPingSettings(serverId, eventType) {
  const settings = getFeatureSettings(serverId);
  
  const pingMap = {
    drops: { enabled: settings.pingOnDrops, role: settings.dropPingRole },
    events: { enabled: settings.pingOnEvents, role: settings.eventPingRole },
    giveaways: { enabled: settings.pingOnGiveaways, role: settings.giveawayPingRole },
    lottery: { enabled: settings.pingOnLottery, role: settings.lotteryPingRole },
    updates: { enabled: settings.pingOnUpdates, role: settings.updatePingRole }
  };
  
  return pingMap[eventType] || { enabled: false, role: null };
}

function formatPingMention(serverId, eventType) {
  const config = getServerConfig(serverId);
  
  if (config && config.notifyRoleId) {
    const pingSettings = config.pingSettings || {};
    if (pingSettings[eventType] === false) return '';
    return `<@&${config.notifyRoleId}>`;
  }
  
  if (config && config.notifyRoleEnabled === false) {
    return '';
  }
  
  const pingSettings = getPingSettings(serverId, eventType);
  
  if (!pingSettings.enabled) return '';
  
  if (pingSettings.role === 'everyone') return '';
  if (pingSettings.role === 'here') return '';
  if (pingSettings.role) return `<@&${pingSettings.role}>`;
  
  return '';
}

function getServerNotifyRole(serverId) {
  const config = getServerConfig(serverId);
  if (!config) return null;
  if (config.notifyRoleEnabled === false) return null;
  if (config.notifyRoleId) return config.notifyRoleId;
  return null;
}

async function setZooAdminRole(serverId, roleName, setBy, member = null) {
  if (!canSetupServer(setBy, serverId, member)) {
    return { success: false, message: '❌ Only **Server Owners** or **Server Admins** can set the ZooAdmin role!' };
  }
  
  const config = getServerConfig(serverId) || { serverId };
  config.zooAdminRoleName = roleName;
  await saveServerConfig(serverId, config);
  
  return { success: true, message: `✅ ZooAdmin role name set to **${roleName}**!` };
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
    serverAdmins: [],
    features: { ...DEFAULT_FEATURE_SETTINGS }
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
  
  if (!canSetupServer(setBy, serverId, member)) {
    return { success: false, message: '❌ Only **Server Owners**, **Server Admins**, or users with the **ZooAdmin** role can set the drop channel!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, serverAdmins: [] };
  config.dropChannelId = channelId;
  config.dropInterval = 30000;
  
  // Setup complete when drop and events channels are set (updates channel no longer required)
  if (config.dropChannelId && config.eventsChannelId && !config.setupComplete) {
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
  
  if (!canSetupServer(setBy, serverId, member)) {
    return { success: false, message: '❌ Only **Server Owners**, **Server Admins**, or users with the **ZooAdmin** role can set the events channel!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, serverAdmins: [] };
  config.eventsChannelId = channelId;
  
  // Setup complete when drop and events channels are set (updates channel no longer required)
  if (config.dropChannelId && config.eventsChannelId && !config.setupComplete) {
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
  if (!canSetupServer(setBy, serverId, member)) {
    return { success: false, message: '❌ Only **Server Owners**, **Server Admins**, or users with the **ZooAdmin** role can set the updates channel!' };
  }
  
  const config = getServerConfig(serverId) || { serverId, serverAdmins: [] };
  config.updatesChannelId = channelId;
  
  // Setup complete when drop and events channels are set (updates channel no longer required)
  if (config.dropChannelId && config.eventsChannelId && !config.setupComplete) {
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

function getSuperAdminIds() {
  return SUPER_ADMINS;
}

function getGlobalBotAdmins() {
  return globalBotAdmins;
}

function getServerAdmins(serverId) {
  const config = getServerConfig(serverId);
  return config?.serverAdmins || [];
}

function getAllAdminsInfo(serverId) {
  return {
    superAdmins: SUPER_ADMINS,
    globalBotAdmins: globalBotAdmins,
    serverAdmins: getServerAdmins(serverId)
  };
}

function getHierarchyInfo() {
  return [
    { level: 5, name: 'Super Admin', emoji: '👑', description: 'Full control over the entire bot, can manage economy and all settings globally', color: 0xFFD700 },
    { level: 4, name: 'Bot Admin', emoji: '⚡', description: 'Global bot management, can approve content and moderate globally, but cannot modify economy', color: 0xFF6B6B },
    { level: 3, name: 'Server Owner', emoji: '🏠', description: 'Full control over bot settings in their server, can ban/mute users and toggle features', color: 0x9B59B6 },
    { level: 2, name: 'Server Admin', emoji: '🛡️', description: 'Manage bot settings in this server, can moderate users and configure features', color: 0x3498DB },
    { level: 1, name: 'ZooAdmin', emoji: '🔧', description: 'Help manage the bot in this server, can warn/mute users and assist with moderation', color: 0x2ECC71 },
    { level: 0, name: 'Player', emoji: '🎮', description: 'Regular player who can use all gameplay features', color: 0x95A5A6 }
  ];
}

function addBotAdmin(serverId, userId, addedBy) {
  return addServerAdmin(serverId, userId, addedBy);
}

function removeBotAdmin(serverId, userId, removedBy) {
  return removeServerAdmin(serverId, userId, removedBy);
}

async function initializeNewServer(guild) {
  try {
    const serverId = guild.id;
    const serverName = guild.name;
    const ownerId = guild.ownerId;
    
    const existingConfig = getServerConfig(serverId);
    if (existingConfig && existingConfig.initialized) {
      console.log(`⚙️ Server ${serverName} (${serverId}) already initialized, checking owner...`);
      await ensureServerOwnerRegistered(serverId, ownerId, serverName);
      return { success: true, message: 'Server already initialized, owner verified' };
    }
    
    const defaultConfig = {
      serverId,
      serverName,
      serverOwnerId: ownerId,
      serverAdmins: [],
      zooAdminRoleName: 'zooadmin',
      featureSettings: { ...DEFAULT_FEATURE_SETTINGS },
      initialized: true,
      initializedAt: new Date(),
      dropChannel: null,
      eventsChannel: null,
      updatesChannel: null,
      selectedGame: DEFAULT_GAME,
      isSetup: false
    };
    
    serverConfigs[serverId] = defaultConfig;
    
    const saved = await saveServerConfig(serverId, defaultConfig);
    
    if (saved) {
      console.log(`✅ Initialized new server: ${serverName} (${serverId})`);
      console.log(`   Owner: ${ownerId}`);
      return { success: true, message: `Server ${serverName} initialized with owner as admin` };
    } else {
      console.log(`⚠️ Server ${serverName} initialized in memory (MongoDB save pending)`);
      return { success: true, message: 'Server initialized in memory', mongoSaved: false };
    }
  } catch (error) {
    console.error('Error initializing new server:', error);
    return { success: false, message: error.message };
  }
}

async function ensureServerOwnerRegistered(serverId, ownerId, serverName = 'Unknown') {
  try {
    const config = getServerConfig(serverId);
    
    if (!config) {
      return { success: false, message: 'Server config not found' };
    }
    
    if (config.serverOwnerId === ownerId) {
      return { success: true, message: 'Owner already registered', changed: false };
    }
    
    const oldOwnerId = config.serverOwnerId;
    config.serverOwnerId = ownerId;
    config.ownerChangedAt = new Date();
    config.previousOwners = config.previousOwners || [];
    if (oldOwnerId && !config.previousOwners.includes(oldOwnerId)) {
      config.previousOwners.push(oldOwnerId);
    }
    
    serverConfigs[serverId] = config;
    await saveServerConfig(serverId, config);
    
    console.log(`🔄 Server ownership updated for ${serverName}: ${oldOwnerId} → ${ownerId}`);
    return { success: true, message: 'Owner updated', changed: true, oldOwnerId, newOwnerId: ownerId };
  } catch (error) {
    console.error('Error ensuring server owner registered:', error);
    return { success: false, message: error.message };
  }
}

async function handleOwnershipTransfer(guild) {
  try {
    const serverId = guild.id;
    const newOwnerId = guild.ownerId;
    const serverName = guild.name;
    
    const result = await ensureServerOwnerRegistered(serverId, newOwnerId, serverName);
    
    if (result.changed) {
      console.log(`👑 Ownership transfer detected in ${serverName}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error handling ownership transfer:', error);
    return { success: false, message: error.message };
  }
}

function getServerOwnerId(serverId) {
  const config = getServerConfig(serverId);
  return config?.serverOwnerId || null;
}

function isRegisteredServerOwner(userId, serverId) {
  const config = getServerConfig(serverId);
  return config?.serverOwnerId === userId;
}

async function getServerSelectedCharacters(serverId) {
  try {
    const collection = await getCollection('dashboardServerConfigs');
    const config = await collection.findOne({ serverId });
    
    if (!config || !config.selectedCharacterIds || config.selectedCharacterIds.length === 0) {
      return null;
    }
    
    const { ObjectId } = require('mongodb');
    const globalCharsCollection = await getCollection('globalCharacters');
    
    const characterIds = config.selectedCharacterIds.map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return id;
      }
    });
    
    const dashboardChars = await globalCharsCollection.find({
      _id: { $in: characterIds },
      status: { $ne: 'deleted' }
    }).toArray();
    
    const characterManager = require('./characterManager.js');
    const botCharacters = characterManager.getCharacters();
    const botCharMap = new Map(botCharacters.map(c => [c.name.toLowerCase(), c]));
    
    const validatedChars = dashboardChars
      .map(dashChar => {
        const botChar = botCharMap.get(dashChar.name.toLowerCase());
        if (botChar) {
          return {
            name: botChar.name,
            emoji: botChar.emoji || dashChar.emoji,
            rarity: dashChar.rarity || botChar.rarity || 'common',
            obtainable: botChar.obtainable,
            game: botChar.game
          };
        }
        return null;
      })
      .filter(c => c !== null);
    
    return validatedChars.length > 0 ? validatedChars : null;
  } catch (error) {
    console.error('Error getting server selected characters:', error);
    return null;
  }
}

async function hasServerSelectedCharacters(serverId) {
  try {
    const collection = await getCollection('dashboardServerConfigs');
    const config = await collection.findOne({ serverId });
    return config?.selectedCharacterIds?.length > 0;
  } catch (error) {
    console.error('Error checking server selected characters:', error);
    return false;
  }
}

async function isDashboardSetupComplete(serverId) {
  const MINIMUM_CHARACTERS_REQUIRED = 5;
  
  if (isMainServer(serverId)) return true;
  
  try {
    const collection = await getCollection('dashboardServerConfigs');
    const config = await collection.findOne({ serverId });
    
    if (!config) return false;
    
    const characterCount = config.selectedCharacterIds?.length || 0;
    return characterCount >= MINIMUM_CHARACTERS_REQUIRED;
  } catch (error) {
    console.error('Error checking dashboard setup status:', error);
    return false;
  }
}

async function getDashboardServerConfig(serverId) {
  try {
    const collection = await getCollection('dashboardServerConfigs');
    const config = await collection.findOne({ serverId });
    return config || null;
  } catch (error) {
    console.error('Error getting dashboard server config:', error);
    return null;
  }
}

async function reloadServerConfigFromMongo(serverId) {
  try {
    const collection = await getCollection('serverConfigs');
    const config = await collection.findOne({ serverId });
    
    if (config) {
      serverConfigs[serverId] = config;
      console.log(`[ServerConfig] Reloaded config for server ${serverId} from MongoDB`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[ServerConfig] Error reloading config for ${serverId}:`, error);
    return false;
  }
}

module.exports = {
  loadServerConfigs,
  saveServerConfig,
  getServerConfig,
  isMainServer,
  isSuperAdmin,
  isGlobalBotAdmin,
  isServerOwner,
  isServerAdmin,
  isZooAdmin,
  isBotAdmin,
  canManageBot,
  canModerate,
  canManageEconomy,
  canApproveContent,
  canBanGlobally,
  canBanInServer,
  canMuteInServer,
  canToggleFeatures,
  canSetupServer,
  getUserRole,
  addGlobalBotAdmin,
  removeGlobalBotAdmin,
  addServerAdmin,
  removeServerAdmin,
  addBotAdmin,
  removeBotAdmin,
  getFeatureSettings,
  updateFeatureSetting,
  updateMultipleFeatures,
  isFeatureEnabled,
  getPingSettings,
  formatPingMention,
  getServerNotifyRole,
  setZooAdminRole,
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
  getSuperAdminIds,
  getGlobalBotAdmins,
  getServerAdmins,
  getAllAdminsInfo,
  getHierarchyInfo,
  initializeNewServer,
  ensureServerOwnerRegistered,
  handleOwnershipTransfer,
  getServerOwnerId,
  isRegisteredServerOwner,
  getServerSelectedCharacters,
  hasServerSelectedCharacters,
  isDashboardSetupComplete,
  getDashboardServerConfig,
  reloadServerConfigFromMongo,
  DEFAULT_FEATURE_SETTINGS,
  MAIN_SERVER_ID,
  SUPER_ADMINS,
  DEFAULT_GAME
};
