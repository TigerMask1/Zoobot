const COLLECTIONS = {
  GLOBAL_CHARACTERS: 'globalCharacters',
  GLOBAL_COLLECTIBLES: 'globalCollectibles',
  SERVER_CONFIGS: 'dashboardServerConfigs',
  CHARACTER_SUBMISSIONS: 'characterSubmissions',
  COLLECTIBLE_SUBMISSIONS: 'collectibleSubmissions',
  ADMIN_SESSIONS: 'adminSessions',
  DASHBOARD_LOGS: 'dashboardLogs'
};

const CHARACTER_SCHEMA = {
  name: String,
  emoji: String,
  customEmojiId: String,
  description: String,
  imageUrl: String,
  rarity: String,
  obtainable: String,
  ability: {
    name: String,
    emoji: String,
    description: String,
    effectType: String,
    effectValue: Number
  },
  specialMove: {
    name: String,
    damage: Number
  },
  stats: {
    hp: Number,
    attack: Number,
    defense: Number,
    speed: Number
  },
  status: String,
  createdBy: String,
  createdAt: Date,
  updatedAt: Date,
  approvedBy: String,
  approvedAt: Date
};

const COLLECTIBLE_SCHEMA = {
  name: String,
  description: String,
  emoji: String,
  imageUrl: String,
  rarity: String,
  bundle: String,
  isGlobal: Boolean,
  droppable: {
    enabled: Boolean,
    probability: Number
  },
  crateObtainable: {
    enabled: Boolean,
    probability: Number,
    crates: Array
  },
  tradable: Boolean,
  giftable: Boolean,
  sellable: Boolean,
  baseValue: Number,
  stackable: Boolean,
  status: String,
  createdBy: String,
  createdAt: Date,
  updatedAt: Date,
  approvedBy: String,
  approvedAt: Date
};

const SERVER_CONFIG_SCHEMA = {
  identity: {
    serverId: String,
    serverName: String,
    serverIcon: String,
    ownerId: String,
    version: String,
    createdAt: Date,
    updatedAt: Date,
    lastSyncedAt: Date
  },

  core: {
    prefix: String,
    fallbackPrefixes: Array,
    disabledCommands: Array,
    commandCooldowns: Object,
    slashCommandsEnabled: Boolean
  },

  permissions: {
    zooAdminRoleName: String,
    adminRoleIds: Array,
    moderatorRoleIds: Array,
    trustedRoleIds: Array,
    blockedRoleIds: Array,
    allowEveryoneUseBasicCommands: Boolean
  },

  channels: {
    dropChannelId: String,
    eventsChannelId: String,
    updatesChannelId: String,
    battleChannelId: String,
    logChannelId: String,
    giveawayChannelId: String,
    welcomeChannelId: String,
    leaveChannelId: String,
    announcementChannelId: String
  },

  features: {
    drops: Boolean,
    events: Boolean,
    giveaways: Boolean,
    lottery: Boolean,
    trading: Boolean,
    marketplace: Boolean,
    auctions: Boolean,
    battles: Boolean,
    work: Boolean,
    quests: Boolean,
    dailies: Boolean,
    minigames: Boolean,
    trivia: Boolean,
    clans: Boolean,
    leaderboards: Boolean,
    seasonPass: Boolean,
    customCommands: Boolean,
    reactRoles: Boolean,
    autoRoles: Boolean,
    afkResponder: Boolean,
    logging: Boolean,
    welcomeNewPlayers: Boolean,
    showTutorialHints: Boolean
  },

  notificationSettings: {
    pingOnDrops: Boolean,
    pingOnEvents: Boolean,
    pingOnGiveaways: Boolean,
    pingOnLottery: Boolean,
    pingOnUpdates: Boolean,
    pingOnBattles: Boolean,
    dropPingRoleId: String,
    eventPingRoleId: String,
    giveawayPingRoleId: String,
    lotteryPingRoleId: String,
    updatePingRoleId: String,
    battlePingRoleId: String,
    dmReminders: Boolean,
    throttleMinutes: Number
  },

  moderationSettings: {
    autoModEnabled: Boolean,
    profanityFilterMode: String,
    spamProtection: {
      enabled: Boolean,
      maxMentions: Number,
      maxLines: Number
    },
    maxWarningsBeforeBan: Number,
    banDurations: {
      temporary: Number,
      repeat: Number
    },
    muteDurations: {
      short: Number,
      medium: Number,
      long: Number
    }
  },

  economySettings: {
    earnRates: {
      work: Number,
      daily: Number,
      weekly: Number
    },
    dropRates: {
      character: Number,
      collectible: Number,
      gem: Number,
      coin: Number
    },
    rewardMultipliers: {
      events: Number,
      weekends: Number
    },
    crateConfigs: Object,
    marketplaceFee: Number,
    tradeTax: Number
  },

  onboardingSettings: {
    welcomeEnabled: Boolean,
    welcomeMessage: String,
    welcomeEmbed: Object,
    leaveEnabled: Boolean,
    leaveMessage: String,
    autoRoles: Array,
    verificationEnabled: Boolean
  },

  automationSettings: {
    timezone: String,
    locale: String,
    scheduledJobs: Array
  },

  audit: {
    schemaVersion: String,
    lastEditedBy: String,
    changeLog: Array
  },

  setupComplete: Boolean,
  setupCompletedAt: Date,

  selectedCharacterNames: Array,
  selectedCollectibleIds: Array,

  serverAdmins: Array
};

const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const RARITY_TYPES = ['common', 'uncommon', 'rare', 'ultra rare', 'epic', 'legendary'];

const OBTAINABLE_TYPES = ['crate', 'starter', 'drop', 'event', 'exclusive', 'submission'];

const DEFAULT_CORE = {
  prefix: "!",
  fallbackPrefixes: ["/", "?"],
  slashCommandsEnabled: true,
  disabledCommands: [],
  commandCooldowns: {}
};

const DEFAULT_PERMISSIONS = {
  zooAdminRoleName: "zooadmin",
  adminRoleIds: [],
  moderatorRoleIds: [],
  trustedRoleIds: [],
  blockedRoleIds: [],
  allowEveryoneUseBasicCommands: true
};

const DEFAULT_CHANNELS = {
  dropChannelId: null,
  eventsChannelId: null,
  updatesChannelId: null,
  battleChannelId: null,
  logChannelId: null,
  giveawayChannelId: null,
  welcomeChannelId: null,
  leaveChannelId: null,
  announcementChannelId: null
};

const DEFAULT_FEATURES = {
  drops: true,
  events: true,
  giveaways: true,
  lottery: true,
  trading: true,
  marketplace: true,
  auctions: false,
  battles: true,
  work: true,
  quests: true,
  dailies: true,
  minigames: true,
  trivia: true,
  clans: true,
  leaderboards: true,
  seasonPass: false,
  customCommands: false,
  reactRoles: false,
  autoRoles: false,
  afkResponder: false,
  logging: true,
  welcomeNewPlayers: true,
  showTutorialHints: true
};

const DEFAULT_NOTIFICATIONS = {
  pingOnDrops: false,
  pingOnEvents: false,
  pingOnGiveaways: true,
  pingOnLottery: true,
  pingOnUpdates: false,
  pingOnBattles: false,
  dropPingRoleId: null,
  eventPingRoleId: null,
  giveawayPingRoleId: null,
  lotteryPingRoleId: null,
  updatePingRoleId: null,
  battlePingRoleId: null,
  dmReminders: false,
  throttleMinutes: 0
};

const DEFAULT_MODERATION = {
  autoModEnabled: false,
  profanityFilterMode: "off",
  spamProtection: {
    enabled: false,
    maxMentions: 5,
    maxLines: 10
  },
  maxWarningsBeforeBan: 5,
  banDurations: {
    temporary: 86400000,
    repeat: 604800000
  },
  muteDurations: {
    short: 300000,
    medium: 1800000,
    long: 3600000
  }
};

const DEFAULT_ECONOMY = {
  earnRates: {
    work: 250,
    daily: 500,
    weekly: 1500
  },
  dropRates: {
    character: 0.05,
    collectible: 0.02,
    gem: 0.01,
    coin: 0.3
  },
  rewardMultipliers: {
    events: 1.5,
    weekends: 1.2
  },
  crateConfigs: {},
  marketplaceFee: 0.1,
  tradeTax: 0.05
};

const DEFAULT_ONBOARDING = {
  welcomeEnabled: true,
  welcomeMessage: null,
  welcomeEmbed: null,
  leaveEnabled: false,
  leaveMessage: null,
  autoRoles: [],
  verificationEnabled: false
};

const DEFAULT_AUTOMATION = {
  timezone: "UTC",
  locale: "en-US",
  scheduledJobs: []
};

const DEFAULT_PING_SETTINGS = DEFAULT_NOTIFICATIONS;

const MINIMUM_CHARACTERS_REQUIRED = 5;

module.exports = {
  COLLECTIONS,
  CHARACTER_SCHEMA,
  COLLECTIBLE_SCHEMA,
  SERVER_CONFIG_SCHEMA,
  SUBMISSION_STATUS,
  RARITY_TYPES,
  OBTAINABLE_TYPES,
  DEFAULT_CORE,
  DEFAULT_PERMISSIONS,
  DEFAULT_CHANNELS,
  DEFAULT_FEATURES,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_MODERATION,
  DEFAULT_ECONOMY,
  DEFAULT_ONBOARDING,
  DEFAULT_AUTOMATION,
  DEFAULT_PING_SETTINGS,
  MINIMUM_CHARACTERS_REQUIRED
};
