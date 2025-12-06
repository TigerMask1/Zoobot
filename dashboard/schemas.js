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
  serverId: String,
  serverName: String,
  serverIcon: String,
  ownerId: String,
  
  setupComplete: Boolean,
  setupCompletedAt: Date,
  
  selectedCharacterIds: Array,
  selectedCollectibleIds: Array,
  
  channels: {
    dropChannelId: String,
    eventsChannelId: String,
    updatesChannelId: String,
    battleChannelId: String,
    logChannelId: String
  },
  
  features: {
    dropsEnabled: Boolean,
    eventsEnabled: Boolean,
    giveawaysEnabled: Boolean,
    lotteryEnabled: Boolean,
    tradingEnabled: Boolean,
    marketEnabled: Boolean,
    battlesEnabled: Boolean,
    minigamesEnabled: Boolean,
    triviaEnabled: Boolean,
    clanSystemEnabled: Boolean,
    leaderboardsEnabled: Boolean,
    workSystemEnabled: Boolean,
    questsEnabled: Boolean,
    dailyRewardsEnabled: Boolean,
    profanityFilter: Boolean,
    autoModEnabled: Boolean,
    welcomeNewPlayers: Boolean,
    showTutorialHints: Boolean
  },
  
  pingSettings: {
    pingOnDrops: Boolean,
    pingOnEvents: Boolean,
    pingOnGiveaways: Boolean,
    pingOnLottery: Boolean,
    pingOnUpdates: Boolean,
    dropPingRole: String,
    eventPingRole: String,
    giveawayPingRole: String,
    lotteryPingRole: String,
    updatePingRole: String
  },
  
  moderationSettings: {
    maxWarningsBeforeBan: Number,
    autoModEnabled: Boolean,
    profanityFilter: Boolean
  },
  
  commandSettings: {
    prefix: String,
    disabledCommands: Array,
    commandCooldowns: Object
  },
  
  serverAdmins: Array,
  zooAdminRoleName: String,
  
  createdAt: Date,
  updatedAt: Date,
  lastSyncedAt: Date
};

const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const RARITY_TYPES = ['common', 'uncommon', 'rare', 'ultra rare', 'epic', 'legendary'];

const OBTAINABLE_TYPES = ['crate', 'starter', 'drop', 'event', 'exclusive', 'submission'];

const DEFAULT_FEATURES = {
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
  welcomeNewPlayers: true,
  showTutorialHints: true
};

const DEFAULT_PING_SETTINGS = {
  pingOnDrops: false,
  pingOnEvents: false,
  pingOnGiveaways: true,
  pingOnLottery: true,
  pingOnUpdates: false,
  dropPingRole: null,
  eventPingRole: null,
  giveawayPingRole: null,
  lotteryPingRole: null,
  updatePingRole: null
};

const MINIMUM_CHARACTERS_REQUIRED = 5;

module.exports = {
  COLLECTIONS,
  CHARACTER_SCHEMA,
  COLLECTIBLE_SCHEMA,
  SERVER_CONFIG_SCHEMA,
  SUBMISSION_STATUS,
  RARITY_TYPES,
  OBTAINABLE_TYPES,
  DEFAULT_FEATURES,
  DEFAULT_PING_SETTINGS,
  MINIMUM_CHARACTERS_REQUIRED
};
