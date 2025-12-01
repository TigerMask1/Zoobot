const BOT_CONFIG = {
  PREFIX: process.env.BOT_PREFIX || '!',
  
  MAIN_SERVER_ID: process.env.MAIN_SERVER_ID || '1430516117851340893',
  MAIN_DROP_CHANNEL: process.env.MAIN_DROP_CHANNEL || '1430525383635107850',
  
  SUPER_ADMINS: (process.env.SUPER_ADMINS || '1296110901057032202,1296109674361520146,1178728978488504400').split(','),
  
  USE_MONGODB: process.env.USE_MONGODB === 'true',
  
  COOLDOWNS: {
    WORK: 900000,
    DAILY: 86400000,
    BATTLE: 5000,
    TRADE: 10000,
    DROP_CATCH: 500
  },
  
  LIMITS: {
    MAX_CHARACTERS_PER_USER: 500,
    MAX_TRADES_PER_DAY: 50,
    MAX_BATTLES_PER_DAY: 100,
    MAX_CRATES_BULK_OPEN: 50,
    LEADERBOARD_SIZE: 10,
    HISTORY_SIZE: 50
  },
  
  ECONOMY: {
    STARTER_COINS: 500,
    STARTER_GEMS: 50,
    STARTER_CRATES: 3,
    DEFAULT_TROPHIES: 200,
    WORK_BASE_COINS: 50,
    WORK_BASE_GEMS: 5,
    DAILY_BASE_COINS: 100,
    DAILY_BASE_GEMS: 10
  },
  
  DROPS: {
    DURATION: 3 * 3600000,
    COST: 100,
    INACTIVITY_TIMEOUT: 5 * 60 * 1000,
    CODES: ['tyrant', 'zooba', 'zoo', 'catch', 'grab', 'quick', 'fast', 'win', 'get', 'take']
  },
  
  ANTI_CHEAT: {
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
    }
  },
  
  MESSAGES: {
    NO_PERMISSION: '❌ You don\'t have permission to use this command!',
    NO_CHARACTERS: '❌ You don\'t have any characters yet! Use `!start` to begin.',
    USER_NOT_FOUND: '❌ User not found!',
    COOLDOWN: '⏰ Please wait before using this command again!',
    ERROR: '❌ An error occurred. Please try again later.',
    INVALID_AMOUNT: '❌ Please enter a valid amount!',
    INSUFFICIENT_FUNDS: '❌ You don\'t have enough funds for this transaction!'
  },
  
  COLORS: {
    SUCCESS: 0x00FF00,
    ERROR: 0xFF0000,
    WARNING: 0xFFA500,
    INFO: 0x3498DB,
    GOLD: 0xFFD700,
    PURPLE: 0x9B59B6,
    TEAL: 0x1ABC9C
  },
  
  SEASON: {
    DURATION_DAYS: 14,
    MAX_LEVEL: 40,
    TASK_RESET_HOUR_UTC: 0,
    POINTS_PER_EASY_TASK: 10,
    POINTS_PER_MEDIUM_TASK: 25,
    POINTS_PER_HARD_TASK: 50
  }
};

const RARITY_CONFIG = {
  common: { color: 0x808080, emoji: '⬜', weight: 50 },
  uncommon: { color: 0x00FF00, emoji: '🟩', weight: 30 },
  rare: { color: 0x0000FF, emoji: '🟦', weight: 15 },
  epic: { color: 0x800080, emoji: '🟪', weight: 4 },
  legendary: { color: 0xFFD700, emoji: '🟨', weight: 1 }
};

const CURRENCY_CONFIG = {
  coins: { emoji: '💰', name: 'Coins' },
  gems: { emoji: '💎', name: 'Gems' },
  trophies: { emoji: '🏆', name: 'Trophies' },
  ust: { emoji: '🌟', name: 'UST' },
  shards: { emoji: '💠', name: 'Shards' },
  tokens: { emoji: '🎫', name: 'Tokens' }
};

function getConfig(key) {
  const keys = key.split('.');
  let value = BOT_CONFIG;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return value;
}

function isSuperAdmin(userId) {
  return BOT_CONFIG.SUPER_ADMINS.includes(userId);
}

function isMainServer(serverId) {
  return serverId === BOT_CONFIG.MAIN_SERVER_ID;
}

module.exports = {
  BOT_CONFIG,
  RARITY_CONFIG,
  CURRENCY_CONFIG,
  getConfig,
  isSuperAdmin,
  isMainServer
};
