const { EmbedBuilder } = require('discord.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const rateLimitMap = new Map();
const commandHistory = new Map();
const suspiciousFlags = new Map();
const transactionLog = [];

const CONFIG = {
  RATE_LIMIT: {
    COMMANDS_PER_WINDOW: 10,
    WINDOW_MS: 5000,
    COOLDOWN_MS: 10000
  },
  THRESHOLDS: {
    COINS_PER_HOUR: 1000000,
    GEMS_PER_HOUR: 10000,
    TRADES_PER_10_MIN: 50,
    COMMANDS_PER_MINUTE: 60,
    FAILED_COMMANDS_PER_5_MIN: 20
  },
  MAX_TRANSACTION_LOG: 10000,
  ALERT_CHANNEL_ID: null,
  SUPER_ADMINS: []
};

function initAntiCheat(superAdmins = [], alertChannelId = null) {
  CONFIG.SUPER_ADMINS = superAdmins;
  CONFIG.ALERT_CHANNEL_ID = alertChannelId;
  console.log('🛡️ Anti-Cheat System initialized');
}

function checkRateLimit(userId, commandName) {
  const now = Date.now();
  const key = `${userId}`;
  
  if (CONFIG.SUPER_ADMINS.includes(userId)) {
    return { allowed: true };
  }
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, {
      commands: [],
      cooldownUntil: 0
    });
  }
  
  const userData = rateLimitMap.get(key);
  
  if (now < userData.cooldownUntil) {
    const remaining = Math.ceil((userData.cooldownUntil - now) / 1000);
    return { 
      allowed: false, 
      reason: 'rate_limited',
      message: `You're sending commands too fast! Please wait ${remaining} seconds.`,
      remaining
    };
  }
  
  userData.commands = userData.commands.filter(
    timestamp => now - timestamp < CONFIG.RATE_LIMIT.WINDOW_MS
  );
  
  if (userData.commands.length >= CONFIG.RATE_LIMIT.COMMANDS_PER_WINDOW) {
    userData.cooldownUntil = now + CONFIG.RATE_LIMIT.COOLDOWN_MS;
    recordSuspiciousActivity(userId, 'rate_limit_exceeded', {
      commandCount: userData.commands.length,
      window: CONFIG.RATE_LIMIT.WINDOW_MS
    });
    return {
      allowed: false,
      reason: 'rate_limit_exceeded',
      message: `Too many commands! You've been rate limited for ${CONFIG.RATE_LIMIT.COOLDOWN_MS / 1000} seconds.`
    };
  }
  
  userData.commands.push(now);
  return { allowed: true };
}

function trackCommand(userId, commandName, success = true, details = {}) {
  const now = Date.now();
  
  if (!commandHistory.has(userId)) {
    commandHistory.set(userId, {
      commands: [],
      failedCommands: [],
      economyChanges: {
        coins: { gained: 0, lost: 0, timestamp: now },
        gems: { gained: 0, lost: 0, timestamp: now }
      },
      trades: [],
      lastReset: now
    });
  }
  
  const history = commandHistory.get(userId);
  
  if (now - history.lastReset > 3600000) {
    history.commands = [];
    history.failedCommands = [];
    history.economyChanges.coins = { gained: 0, lost: 0, timestamp: now };
    history.economyChanges.gems = { gained: 0, lost: 0, timestamp: now };
    history.trades = [];
    history.lastReset = now;
  }
  
  history.commands.push({
    command: commandName,
    timestamp: now,
    success,
    details
  });
  
  if (!success) {
    history.failedCommands.push({
      command: commandName,
      timestamp: now,
      details
    });
    
    const recentFails = history.failedCommands.filter(
      f => now - f.timestamp < 300000
    );
    if (recentFails.length >= CONFIG.THRESHOLDS.FAILED_COMMANDS_PER_5_MIN) {
      recordSuspiciousActivity(userId, 'excessive_failed_commands', {
        count: recentFails.length,
        commands: recentFails.map(f => f.command)
      });
    }
  }
  
  const recentCommands = history.commands.filter(
    c => now - c.timestamp < 60000
  );
  if (recentCommands.length >= CONFIG.THRESHOLDS.COMMANDS_PER_MINUTE) {
    recordSuspiciousActivity(userId, 'high_command_frequency', {
      count: recentCommands.length,
      timeWindow: '1 minute'
    });
  }
}

function trackEconomyChange(userId, currency, amount, source, targetUserId = null) {
  const now = Date.now();
  
  if (!commandHistory.has(userId)) {
    trackCommand(userId, 'economy_init', true);
  }
  
  const history = commandHistory.get(userId);
  
  if (currency === 'coins' || currency === 'gems') {
    if (amount > 0) {
      history.economyChanges[currency].gained += amount;
    } else {
      history.economyChanges[currency].lost += Math.abs(amount);
    }
    
    const threshold = currency === 'coins' 
      ? CONFIG.THRESHOLDS.COINS_PER_HOUR 
      : CONFIG.THRESHOLDS.GEMS_PER_HOUR;
    
    if (history.economyChanges[currency].gained >= threshold) {
      recordSuspiciousActivity(userId, `excessive_${currency}_gain`, {
        amount: history.economyChanges[currency].gained,
        threshold,
        source
      });
    }
  }
  
  logTransaction({
    userId,
    targetUserId,
    type: source,
    currency,
    amount,
    timestamp: now
  });
}

function trackTrade(userId, targetUserId, tradeDetails) {
  const now = Date.now();
  
  if (!commandHistory.has(userId)) {
    trackCommand(userId, 'trade_init', true);
  }
  
  const history = commandHistory.get(userId);
  
  history.trades.push({
    target: targetUserId,
    details: tradeDetails,
    timestamp: now
  });
  
  const recentTrades = history.trades.filter(
    t => now - t.timestamp < 600000
  );
  
  if (recentTrades.length >= CONFIG.THRESHOLDS.TRADES_PER_10_MIN) {
    recordSuspiciousActivity(userId, 'excessive_trading', {
      tradeCount: recentTrades.length,
      timeWindow: '10 minutes',
      partners: [...new Set(recentTrades.map(t => t.target))]
    });
  }
  
  logTransaction({
    userId,
    targetUserId,
    type: 'trade',
    details: tradeDetails,
    timestamp: now
  });
}

function recordSuspiciousActivity(userId, activityType, details = {}) {
  const now = Date.now();
  
  if (!suspiciousFlags.has(userId)) {
    suspiciousFlags.set(userId, []);
  }
  
  const flags = suspiciousFlags.get(userId);
  flags.push({
    type: activityType,
    details,
    timestamp: now
  });
  
  const recentFlags = flags.filter(f => now - f.timestamp < 3600000);
  suspiciousFlags.set(userId, recentFlags);
  
  console.log(`⚠️ [ANTI-CHEAT] Suspicious activity detected for user ${userId}: ${activityType}`, details);
  
  return {
    userId,
    activityType,
    details,
    timestamp: now,
    totalFlags: recentFlags.length
  };
}

function logTransaction(transaction) {
  transactionLog.push(transaction);
  
  while (transactionLog.length > CONFIG.MAX_TRANSACTION_LOG) {
    transactionLog.shift();
  }
  
  if (USE_MONGODB && mongoManager) {
    saveTransactionToMongo(transaction);
  }
}

async function saveTransactionToMongo(transaction) {
  try {
    const db = mongoManager.getDb();
    if (db) {
      await db.collection('transactionLog').insertOne(transaction);
    }
  } catch (error) {
    console.error('Failed to save transaction to MongoDB:', error);
  }
}

function getTransactionHistory(userId, options = {}) {
  const { limit = 50, type = null, startTime = null, endTime = null } = options;
  
  let filtered = transactionLog.filter(t => 
    t.userId === userId || t.targetUserId === userId
  );
  
  if (type) {
    filtered = filtered.filter(t => t.type === type);
  }
  
  if (startTime) {
    filtered = filtered.filter(t => t.timestamp >= startTime);
  }
  
  if (endTime) {
    filtered = filtered.filter(t => t.timestamp <= endTime);
  }
  
  return filtered.slice(-limit);
}

async function getFullTransactionHistory(userId, options = {}) {
  if (!USE_MONGODB || !mongoManager) {
    return getTransactionHistory(userId, options);
  }
  
  try {
    const db = mongoManager.getDb();
    if (!db) return getTransactionHistory(userId, options);
    
    const query = {
      $or: [
        { userId: userId },
        { targetUserId: userId }
      ]
    };
    
    if (options.type) query.type = options.type;
    if (options.startTime || options.endTime) {
      query.timestamp = {};
      if (options.startTime) query.timestamp.$gte = options.startTime;
      if (options.endTime) query.timestamp.$lte = options.endTime;
    }
    
    const transactions = await db.collection('transactionLog')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(options.limit || 50)
      .toArray();
    
    return transactions;
  } catch (error) {
    console.error('Failed to get transactions from MongoDB:', error);
    return getTransactionHistory(userId, options);
  }
}

function getSuspiciousUsers(threshold = 3) {
  const suspicious = [];
  const now = Date.now();
  
  for (const [userId, flags] of suspiciousFlags.entries()) {
    const recentFlags = flags.filter(f => now - f.timestamp < 3600000);
    if (recentFlags.length >= threshold) {
      suspicious.push({
        userId,
        flagCount: recentFlags.length,
        flags: recentFlags
      });
    }
  }
  
  return suspicious.sort((a, b) => b.flagCount - a.flagCount);
}

function getUserFlags(userId) {
  const flags = suspiciousFlags.get(userId) || [];
  const now = Date.now();
  return flags.filter(f => now - f.timestamp < 86400000);
}

function clearUserFlags(userId) {
  suspiciousFlags.delete(userId);
  return true;
}

async function rollbackUserEconomy(userId, data, snapshot) {
  if (!data.users[userId]) {
    return { success: false, error: 'User not found' };
  }
  
  const currentUser = data.users[userId];
  const changes = [];
  
  if (snapshot.coins !== undefined && currentUser.coins !== snapshot.coins) {
    changes.push(`Coins: ${currentUser.coins} → ${snapshot.coins}`);
    currentUser.coins = snapshot.coins;
  }
  
  if (snapshot.gems !== undefined && currentUser.gems !== snapshot.gems) {
    changes.push(`Gems: ${currentUser.gems} → ${snapshot.gems}`);
    currentUser.gems = snapshot.gems;
  }
  
  if (snapshot.trophies !== undefined && currentUser.trophies !== snapshot.trophies) {
    changes.push(`Trophies: ${currentUser.trophies} → ${snapshot.trophies}`);
    currentUser.trophies = snapshot.trophies;
  }
  
  if (snapshot.ust !== undefined && currentUser.ust !== snapshot.ust) {
    changes.push(`UST: ${currentUser.ust} → ${snapshot.ust}`);
    currentUser.ust = snapshot.ust;
  }
  
  logTransaction({
    userId,
    type: 'rollback',
    details: { changes, snapshot },
    timestamp: Date.now(),
    adminAction: true
  });
  
  return { success: true, changes };
}

function createUserSnapshot(userId, data) {
  if (!data.users[userId]) {
    return null;
  }
  
  const user = data.users[userId];
  return {
    userId,
    timestamp: Date.now(),
    coins: user.coins,
    gems: user.gems,
    trophies: user.trophies,
    ust: user.ust || 0,
    characterCount: user.characters ? user.characters.length : 0
  };
}

function createSuspiciousActivityEmbed(activity) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('⚠️ Suspicious Activity Detected')
    .setDescription(`A potential exploit or suspicious behavior has been detected.`)
    .addFields(
      { name: 'User ID', value: activity.userId, inline: true },
      { name: 'Activity Type', value: activity.activityType, inline: true },
      { name: 'Total Flags (1h)', value: activity.totalFlags.toString(), inline: true }
    )
    .setTimestamp();
  
  if (activity.details) {
    embed.addFields({
      name: 'Details',
      value: '```json\n' + JSON.stringify(activity.details, null, 2).slice(0, 1000) + '\n```'
    });
  }
  
  return embed;
}

function createTransactionLogEmbed(transactions, userId) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📊 Transaction History`)
    .setDescription(`Recent transactions for user <@${userId}>`)
    .setTimestamp();
  
  if (transactions.length === 0) {
    embed.addFields({ name: 'No Transactions', value: 'No transactions found for this user.' });
    return embed;
  }
  
  const transactionText = transactions.slice(0, 10).map(t => {
    const date = new Date(t.timestamp).toLocaleString();
    const amount = t.amount > 0 ? `+${t.amount}` : t.amount;
    return `\`${date}\` | ${t.type} | ${t.currency || 'N/A'}: ${amount}`;
  }).join('\n');
  
  embed.addFields({ name: `Last ${Math.min(10, transactions.length)} Transactions`, value: transactionText || 'None' });
  
  return embed;
}

function createFlagsEmbed(userId, flags) {
  const embed = new EmbedBuilder()
    .setColor(flags.length > 5 ? 0xFF0000 : flags.length > 2 ? 0xFFA500 : 0xFFFF00)
    .setTitle(`🚩 User Flags Report`)
    .setDescription(`Suspicious activity flags for <@${userId}>`)
    .addFields(
      { name: 'Total Flags (24h)', value: flags.length.toString(), inline: true },
      { name: 'Risk Level', value: flags.length > 5 ? '🔴 High' : flags.length > 2 ? '🟠 Medium' : '🟡 Low', inline: true }
    )
    .setTimestamp();
  
  if (flags.length > 0) {
    const flagSummary = flags.slice(0, 5).map(f => {
      const date = new Date(f.timestamp).toLocaleString();
      return `• \`${date}\`: ${f.type}`;
    }).join('\n');
    
    embed.addFields({ name: 'Recent Flags', value: flagSummary });
  }
  
  return embed;
}

function getAntiCheatStats() {
  const now = Date.now();
  let totalFlags = 0;
  let usersWithFlags = 0;
  
  for (const [userId, flags] of suspiciousFlags.entries()) {
    const recentFlags = flags.filter(f => now - f.timestamp < 3600000);
    if (recentFlags.length > 0) {
      totalFlags += recentFlags.length;
      usersWithFlags++;
    }
  }
  
  return {
    activeRateLimits: rateLimitMap.size,
    trackedUsers: commandHistory.size,
    usersWithFlags,
    totalFlags,
    transactionLogSize: transactionLog.length
  };
}

module.exports = {
  initAntiCheat,
  checkRateLimit,
  trackCommand,
  trackEconomyChange,
  trackTrade,
  recordSuspiciousActivity,
  getTransactionHistory,
  getFullTransactionHistory,
  getSuspiciousUsers,
  getUserFlags,
  clearUserFlags,
  rollbackUserEconomy,
  createUserSnapshot,
  createSuspiciousActivityEmbed,
  createTransactionLogEmbed,
  createFlagsEmbed,
  getAntiCheatStats,
  CONFIG
};
