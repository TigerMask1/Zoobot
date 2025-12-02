const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { 
  isSuperAdmin, 
  isGlobalBotAdmin, 
  isServerAdmin, 
  isZooAdmin, 
  canModerate,
  canBanInServer,
  canMuteInServer,
  getUserRole,
  getFeatureSettings
} = require('./serverConfigManager.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const warningsCache = new Map();
const bansCache = new Map();
const mutesCache = new Map();
const modLogCache = [];

const CONFIG = {
  MAX_WARNINGS_BEFORE_AUTO_BAN: 5,
  DEFAULT_MUTE_DURATION_MS: 3600000,
  MAX_CLEAR_MESSAGES: 100,
  SUPER_ADMINS: []
};

function initModeration(superAdmins = []) {
  CONFIG.SUPER_ADMINS = superAdmins;
  console.log('🛡️ Moderation System initialized');
}

function canWarnUser(userId, guildId, member = null) {
  return canMuteInServer(userId, guildId, member);
}

function canClearWarnings(userId, guildId, member = null) {
  return canBanInServer(userId, guildId, member);
}

function canBotBanUser(userId, guildId, member = null) {
  return canBanInServer(userId, guildId, member);
}

function canBotMuteUser(userId, guildId, member = null) {
  return canMuteInServer(userId, guildId, member);
}

function getMaxWarningsForServer(guildId) {
  const settings = getFeatureSettings(guildId);
  return settings.maxWarningsBeforeBan || CONFIG.MAX_WARNINGS_BEFORE_AUTO_BAN;
}

async function loadModerationData() {
  if (!USE_MONGODB || !mongoManager) return;
  
  try {
    const db = mongoManager.getDb();
    if (!db) return;
    
    const warnings = await db.collection('modWarnings').find({}).toArray();
    warnings.forEach(w => {
      if (!warningsCache.has(w.guildId)) {
        warningsCache.set(w.guildId, new Map());
      }
      warningsCache.get(w.guildId).set(w.userId, w.warnings || []);
    });
    
    const bans = await db.collection('modBans').find({}).toArray();
    bans.forEach(b => {
      if (!bansCache.has(b.guildId)) {
        bansCache.set(b.guildId, new Map());
      }
      bansCache.get(b.guildId).set(b.userId, b);
    });
    
    const mutes = await db.collection('modMutes').find({}).toArray();
    const now = Date.now();
    let expiredMutes = 0;
    
    for (const m of mutes) {
      if (m.endTime <= now) {
        expiredMutes++;
        await db.collection('modMutes').deleteOne({ guildId: m.guildId, userId: m.userId });
        continue;
      }
      
      if (!mutesCache.has(m.guildId)) {
        mutesCache.set(m.guildId, new Map());
      }
      mutesCache.get(m.guildId).set(m.userId, m);
      
      const remainingTime = m.endTime - now;
      setTimeout(async () => {
        if (mutesCache.has(m.guildId)) {
          mutesCache.get(m.guildId).delete(m.userId);
        }
        try {
          const db = mongoManager.getDb();
          if (db) {
            await db.collection('modMutes').deleteOne({ guildId: m.guildId, userId: m.userId });
          }
        } catch (e) {
          console.error('Failed to remove expired mute from MongoDB:', e);
        }
      }, remainingTime);
    }
    
    console.log(`📋 Moderation data loaded from MongoDB (${expiredMutes} expired mutes cleaned)`);
  } catch (error) {
    console.error('Failed to load moderation data:', error);
  }
}

async function warnUser(guildId, userId, moderatorId, reason = 'No reason provided') {
  if (!warningsCache.has(guildId)) {
    warningsCache.set(guildId, new Map());
  }
  
  const guildWarnings = warningsCache.get(guildId);
  if (!guildWarnings.has(userId)) {
    guildWarnings.set(userId, []);
  }
  
  const warning = {
    id: Date.now().toString(36),
    moderatorId,
    reason,
    timestamp: Date.now()
  };
  
  guildWarnings.get(userId).push(warning);
  
  const totalWarnings = guildWarnings.get(userId).length;
  
  logModAction({
    guildId,
    action: 'warn',
    targetId: userId,
    moderatorId,
    reason,
    warningCount: totalWarnings
  });
  
  if (USE_MONGODB && mongoManager) {
    try {
      const db = mongoManager.getDb();
      if (db) {
        await db.collection('modWarnings').updateOne(
          { guildId, userId },
          { $set: { guildId, userId, warnings: guildWarnings.get(userId) } },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error('Failed to save warning to MongoDB:', error);
    }
  }
  
  return {
    success: true,
    warning,
    totalWarnings,
    autoAction: totalWarnings >= CONFIG.MAX_WARNINGS_BEFORE_AUTO_BAN ? 'ban_recommended' : null
  };
}

function getWarnings(guildId, userId) {
  if (!warningsCache.has(guildId)) return [];
  const guildWarnings = warningsCache.get(guildId);
  return guildWarnings.get(userId) || [];
}

async function clearWarnings(guildId, userId, moderatorId) {
  if (!warningsCache.has(guildId)) {
    return { success: true, cleared: 0 };
  }
  
  const guildWarnings = warningsCache.get(guildId);
  const previousCount = (guildWarnings.get(userId) || []).length;
  guildWarnings.set(userId, []);
  
  logModAction({
    guildId,
    action: 'clear_warnings',
    targetId: userId,
    moderatorId,
    clearedCount: previousCount
  });
  
  if (USE_MONGODB && mongoManager) {
    try {
      const db = mongoManager.getDb();
      if (db) {
        await db.collection('modWarnings').deleteOne({ guildId, userId });
      }
    } catch (error) {
      console.error('Failed to clear warnings from MongoDB:', error);
    }
  }
  
  return { success: true, cleared: previousCount };
}

async function banUserFromBot(guildId, userId, moderatorId, reason = 'No reason provided', data = null) {
  if (!bansCache.has(guildId)) {
    bansCache.set(guildId, new Map());
  }
  
  const ban = {
    guildId,
    userId: userId,
    moderatorId,
    reason,
    timestamp: Date.now(),
    active: true
  };
  
  bansCache.get(guildId).set(userId, ban);
  
  logModAction({
    guildId,
    action: 'bot_ban',
    targetId: userId,
    moderatorId,
    reason
  });
  
  if (USE_MONGODB && mongoManager) {
    try {
      const db = mongoManager.getDb();
      if (db) {
        await db.collection('modBans').updateOne(
          { guildId, userId },
          { $set: ban },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error('Failed to save ban to MongoDB:', error);
    }
  }
  
  return { success: true, ban };
}

async function unbanUserFromBot(guildId, userId, moderatorId) {
  if (!bansCache.has(guildId)) {
    return { success: false, error: 'User is not banned' };
  }
  
  const guildBans = bansCache.get(guildId);
  if (!guildBans.has(userId)) {
    return { success: false, error: 'User is not banned' };
  }
  
  guildBans.delete(userId);
  
  logModAction({
    guildId,
    action: 'bot_unban',
    targetId: userId,
    moderatorId
  });
  
  if (USE_MONGODB && mongoManager) {
    try {
      const db = mongoManager.getDb();
      if (db) {
        await db.collection('modBans').deleteOne({ guildId, userId });
      }
    } catch (error) {
      console.error('Failed to remove ban from MongoDB:', error);
    }
  }
  
  return { success: true };
}

function isUserBanned(guildId, userId) {
  if (!bansCache.has(guildId)) return false;
  const ban = bansCache.get(guildId).get(userId);
  return ban && ban.active;
}

function getBanInfo(guildId, userId) {
  if (!bansCache.has(guildId)) return null;
  return bansCache.get(guildId).get(userId) || null;
}

async function muteUser(guildId, userId, moderatorId, durationMs = CONFIG.DEFAULT_MUTE_DURATION_MS, reason = 'No reason provided') {
  if (!mutesCache.has(guildId)) {
    mutesCache.set(guildId, new Map());
  }
  
  const mute = {
    guildId,
    userId,
    moderatorId,
    reason,
    startTime: Date.now(),
    endTime: Date.now() + durationMs,
    duration: durationMs
  };
  
  mutesCache.get(guildId).set(userId, mute);
  
  logModAction({
    guildId,
    action: 'mute',
    targetId: userId,
    moderatorId,
    reason,
    duration: durationMs
  });
  
  if (USE_MONGODB && mongoManager) {
    try {
      const db = mongoManager.getDb();
      if (db) {
        await db.collection('modMutes').updateOne(
          { guildId, userId },
          { $set: mute },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error('Failed to save mute to MongoDB:', error);
    }
  }
  
  setTimeout(async () => {
    if (mutesCache.has(guildId)) {
      const currentMute = mutesCache.get(guildId).get(userId);
      if (currentMute && currentMute.startTime === mute.startTime) {
        mutesCache.get(guildId).delete(userId);
        if (USE_MONGODB && mongoManager) {
          try {
            const db = mongoManager.getDb();
            if (db) {
              await db.collection('modMutes').deleteOne({ guildId, userId });
            }
          } catch (e) {
            console.error('Failed to remove expired mute from MongoDB:', e);
          }
        }
      }
    }
  }, durationMs);
  
  return { success: true, mute };
}

async function unmuteUser(guildId, userId, moderatorId) {
  if (!mutesCache.has(guildId)) {
    return { success: false, error: 'User is not muted' };
  }
  
  const guildMutes = mutesCache.get(guildId);
  if (!guildMutes.has(userId)) {
    return { success: false, error: 'User is not muted' };
  }
  
  guildMutes.delete(userId);
  
  logModAction({
    guildId,
    action: 'unmute',
    targetId: userId,
    moderatorId
  });
  
  if (USE_MONGODB && mongoManager) {
    try {
      const db = mongoManager.getDb();
      if (db) {
        await db.collection('modMutes').deleteOne({ guildId, userId });
      }
    } catch (error) {
      console.error('Failed to remove mute from MongoDB:', error);
    }
  }
  
  return { success: true };
}

function isUserMuted(guildId, userId) {
  if (!mutesCache.has(guildId)) return false;
  const mute = mutesCache.get(guildId).get(userId);
  if (!mute) return false;
  
  if (Date.now() >= mute.endTime) {
    mutesCache.get(guildId).delete(userId);
    return false;
  }
  
  return true;
}

function getMuteInfo(guildId, userId) {
  if (!mutesCache.has(guildId)) return null;
  const mute = mutesCache.get(guildId).get(userId);
  if (!mute) return null;
  
  if (Date.now() >= mute.endTime) {
    mutesCache.get(guildId).delete(userId);
    return null;
  }
  
  return {
    ...mute,
    remainingMs: mute.endTime - Date.now()
  };
}

async function clearMessages(channel, count, filterUserId = null) {
  const limit = Math.min(count, CONFIG.MAX_CLEAR_MESSAGES);
  
  try {
    let messages = await channel.messages.fetch({ limit: limit + 10 });
    
    messages = messages.filter(msg => {
      const age = Date.now() - msg.createdTimestamp;
      if (age > 14 * 24 * 60 * 60 * 1000) return false;
      if (filterUserId && msg.author.id !== filterUserId) return false;
      return true;
    });
    
    const toDelete = Array.from(messages.values()).slice(0, limit);
    
    if (toDelete.length === 0) {
      return { success: true, deleted: 0 };
    }
    
    if (toDelete.length === 1) {
      await toDelete[0].delete();
      return { success: true, deleted: 1 };
    }
    
    const deleted = await channel.bulkDelete(toDelete, true);
    return { success: true, deleted: deleted.size };
    
  } catch (error) {
    console.error('Failed to clear messages:', error);
    return { success: false, error: error.message };
  }
}

async function announceToChannel(channel, content, options = {}) {
  const { title, color = 0x5865F2, footer = null, thumbnail = null } = options;
  
  try {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(content)
      .setTimestamp();
    
    if (title) embed.setTitle(title);
    if (footer) embed.setFooter({ text: footer });
    if (thumbnail) embed.setThumbnail(thumbnail);
    
    const message = await channel.send({ embeds: [embed] });
    return { success: true, messageId: message.id };
    
  } catch (error) {
    console.error('Failed to send announcement:', error);
    return { success: false, error: error.message };
  }
}

function logModAction(action) {
  const logEntry = {
    ...action,
    timestamp: Date.now()
  };
  
  modLogCache.push(logEntry);
  
  while (modLogCache.length > 1000) {
    modLogCache.shift();
  }
  
  console.log(`🔨 [MOD] ${action.action} | Target: ${action.targetId} | By: ${action.moderatorId} | Reason: ${action.reason || 'N/A'}`);
  
  if (USE_MONGODB && mongoManager) {
    saveModLogToMongo(logEntry);
  }
}

async function saveModLogToMongo(logEntry) {
  try {
    const db = mongoManager.getDb();
    if (db) {
      await db.collection('modLogs').insertOne(logEntry);
    }
  } catch (error) {
    console.error('Failed to save mod log to MongoDB:', error);
  }
}

function getModLogs(guildId, options = {}) {
  const { limit = 50, action = null, moderatorId = null, targetId = null } = options;
  
  let filtered = modLogCache.filter(log => log.guildId === guildId);
  
  if (action) filtered = filtered.filter(log => log.action === action);
  if (moderatorId) filtered = filtered.filter(log => log.moderatorId === moderatorId);
  if (targetId) filtered = filtered.filter(log => log.targetId === targetId);
  
  return filtered.slice(-limit);
}

async function getFullModLogs(guildId, options = {}) {
  if (!USE_MONGODB || !mongoManager) {
    return getModLogs(guildId, options);
  }
  
  try {
    const db = mongoManager.getDb();
    if (!db) return getModLogs(guildId, options);
    
    const query = { guildId };
    if (options.action) query.action = options.action;
    if (options.moderatorId) query.moderatorId = options.moderatorId;
    if (options.targetId) query.targetId = options.targetId;
    
    const logs = await db.collection('modLogs')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(options.limit || 50)
      .toArray();
    
    return logs;
  } catch (error) {
    console.error('Failed to get mod logs from MongoDB:', error);
    return getModLogs(guildId, options);
  }
}

function createWarningsEmbed(userId, warnings, guildName) {
  const embed = new EmbedBuilder()
    .setColor(warnings.length >= 3 ? 0xFF0000 : warnings.length >= 1 ? 0xFFA500 : 0x00FF00)
    .setTitle(`⚠️ Warnings for User`)
    .setDescription(`<@${userId}> has **${warnings.length}** warning(s) in ${guildName}`)
    .setTimestamp();
  
  if (warnings.length === 0) {
    embed.addFields({ name: 'No Warnings', value: 'This user has a clean record.' });
  } else {
    const warningList = warnings.slice(-10).map((w, i) => {
      const date = new Date(w.timestamp).toLocaleDateString();
      return `**${i + 1}.** \`${date}\` - ${w.reason}\n   By: <@${w.moderatorId}>`;
    }).join('\n\n');
    
    embed.addFields({ name: `Recent Warnings (${Math.min(10, warnings.length)} shown)`, value: warningList });
    
    if (warnings.length >= CONFIG.MAX_WARNINGS_BEFORE_AUTO_BAN) {
      embed.addFields({
        name: '⚠️ Ban Recommended',
        value: `This user has reached ${CONFIG.MAX_WARNINGS_BEFORE_AUTO_BAN}+ warnings. Consider banning them from bot features.`
      });
    }
  }
  
  return embed;
}

function createModLogEmbed(logs, guildName) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📋 Moderation Logs`)
    .setDescription(`Recent moderation actions in ${guildName}`)
    .setTimestamp();
  
  if (logs.length === 0) {
    embed.addFields({ name: 'No Logs', value: 'No moderation actions recorded.' });
  } else {
    const logText = logs.slice(0, 10).map(log => {
      const date = new Date(log.timestamp).toLocaleString();
      const actionEmoji = {
        'warn': '⚠️',
        'bot_ban': '🔨',
        'bot_unban': '🔓',
        'mute': '🔇',
        'unmute': '🔊',
        'clear_warnings': '🧹'
      }[log.action] || '📝';
      
      return `${actionEmoji} \`${date}\`\n**${log.action.toUpperCase()}** - <@${log.targetId}>\nBy: <@${log.moderatorId}>`;
    }).join('\n\n');
    
    embed.addFields({ name: `Last ${Math.min(10, logs.length)} Actions`, value: logText });
  }
  
  return embed;
}

function createBanInfoEmbed(userId, banInfo) {
  if (!banInfo) {
    return new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ User Not Banned')
      .setDescription(`<@${userId}> is not banned from bot features.`)
      .setTimestamp();
  }
  
  return new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🔨 Ban Information')
    .setDescription(`<@${userId}> is banned from bot features.`)
    .addFields(
      { name: 'Reason', value: banInfo.reason, inline: false },
      { name: 'Banned By', value: `<@${banInfo.moderatorId}>`, inline: true },
      { name: 'Date', value: new Date(banInfo.timestamp).toLocaleString(), inline: true }
    )
    .setTimestamp();
}

function createMuteInfoEmbed(userId, muteInfo) {
  if (!muteInfo) {
    return new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🔊 User Not Muted')
      .setDescription(`<@${userId}> is not currently muted.`)
      .setTimestamp();
  }
  
  const remainingMinutes = Math.ceil(muteInfo.remainingMs / 60000);
  
  return new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle('🔇 Mute Information')
    .setDescription(`<@${userId}> is currently muted.`)
    .addFields(
      { name: 'Reason', value: muteInfo.reason, inline: false },
      { name: 'Muted By', value: `<@${muteInfo.moderatorId}>`, inline: true },
      { name: 'Time Remaining', value: `${remainingMinutes} minute(s)`, inline: true }
    )
    .setTimestamp();
}

function formatDuration(input) {
  const match = input.match(/^(\d+)(s|m|h|d)?$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  
  const multipliers = {
    's': 1000,
    'm': 60000,
    'h': 3600000,
    'd': 86400000
  };
  
  return value * multipliers[unit];
}

function getModerationStats(guildId) {
  const warnings = warningsCache.get(guildId);
  const bans = bansCache.get(guildId);
  const mutes = mutesCache.get(guildId);
  const logs = getModLogs(guildId, { limit: 1000 });
  
  let totalWarnings = 0;
  if (warnings) {
    for (const userWarnings of warnings.values()) {
      totalWarnings += userWarnings.length;
    }
  }
  
  return {
    usersWarned: warnings ? warnings.size : 0,
    totalWarnings,
    activeBans: bans ? bans.size : 0,
    activeMutes: mutes ? mutes.size : 0,
    recentActions: logs.length
  };
}

module.exports = {
  initModeration,
  loadModerationData,
  warnUser,
  getWarnings,
  clearWarnings,
  banUserFromBot,
  unbanUserFromBot,
  isUserBanned,
  getBanInfo,
  muteUser,
  unmuteUser,
  isUserMuted,
  getMuteInfo,
  clearMessages,
  announceToChannel,
  getModLogs,
  getFullModLogs,
  createWarningsEmbed,
  createModLogEmbed,
  createBanInfoEmbed,
  createMuteInfoEmbed,
  formatDuration,
  getModerationStats,
  canWarnUser,
  canClearWarnings,
  canBotBanUser,
  canBotMuteUser,
  getMaxWarningsForServer,
  CONFIG
};
