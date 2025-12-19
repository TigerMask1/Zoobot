// ZooBot Web Server + Discord Bot
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const PORT = process.env.PORT || 5000;
const WEBSITE_URL = process.env.WEBSITE_URL || process.env.RENDER_EXTERNAL_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "cdn.discordapp.com"],
      connectSrc: ["'self'", "discord.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please slow down.' },
  skip: (req) => req.ip === '::1'
});

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));

app.get('/api/stats', apiLimiter, (req, res) => {
  res.json({
    servers: '10+',
    users: '500+',
    characters: 51,
    uptime: '99.9%'
  });
});

app.get('/api/changelog', apiLimiter, (req, res) => {
  res.json({
    entries: [
      {
        version: 'v2.0',
        date: 'November 30, 2025',
        content: '<h4>Anti-Cheat & Moderation</h4><ul><li>Rate limiting and suspicious activity detection</li><li>Moderation commands for Bot Admins</li><li>Transaction logging and rollback capability</li></ul>'
      },
      {
        version: 'v1.9',
        date: 'November 2025',
        content: '<h4>Weekly Challenges & Achievements</h4><ul><li>Rotating weekly goals with rewards</li><li>Achievement badges for milestones</li><li>Global leaderboards</li></ul>'
      }
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bot is alive!', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:page.html', (req, res, next) => {
  const validPages = ['index', 'features', 'guide', 'changelog', 'about', 'admin', 'dashboard'];
  if (validPages.includes(req.params.page)) {
    res.sendFile(path.join(__dirname, 'public', `${req.params.page}.html`));
  } else {
    next();
  }
});

const { setupDashboardRoutes, setDiscordClient: setDashboardDiscordClient } = require('./dashboard/index.js');
const dashboardDb = require('./dashboard/database.js');
const { MINIMUM_CHARACTERS_REQUIRED } = require('./dashboard/schemas.js');
setupDashboardRoutes(app, null);
console.log('🔧 Dashboard routes configured at /admin');

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ success: false, message: 'Not found' });
  }
});

const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} in use, trying alternative port...`);
    server.listen(0, '0.0.0.0', () => {
      console.log(`🌐 Server running on port ${server.address().port}`);
    });
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const { loadData, saveData, saveDataImmediate, deleteUser } = require('./dataManager.js');
const { getLevelRequirements, calculateLevel } = require('./levelSystem.js');
const { openCrate, buyCrate, openCratesInBulk } = require('./crateSystem.js');
const { startDropSystem, stopDropSystem, payForDrops, areDropsActive, getDropsTimeRemaining, recordCatchAttempt, reviveDrops, stopDropsForServer } = require('./dropSystem.js');
const { initiateTrade } = require('./tradeSystem.js');
const { initiateBattle } = require('./battleSystem.js');
const { assignMovesToCharacter, calculateBaseHP, getMoveDisplay, calculateEnergyCost } = require('./battleUtils.js');
const { createLevelProgressBar } = require('./progressBar.js');
const { QUESTS, getQuestProgress, canClaimQuest, claimQuest, claimAllQuests, getAvailableQuests, formatQuestDisplay } = require('./questSystem.js');
const { craftBooster, useBooster, getBoosterInfo, getCharacterBoostCount, MAX_BOOSTS_PER_CHARACTER } = require('./stBoosterSystem.js');
const { sendMailToAll, addMailToUser, claimMail, getUnclaimedMailCount, formatMailDisplay, clearClaimedMail } = require('./mailSystem.js');
const { postNews, getLatestNews, formatNewsDisplay } = require('./newsSystem.js');
const { getTopCoins, getTopGems, getTopBattles, getTopCollectors, getTopTrophies, formatLeaderboard } = require('./leaderboardSystem.js');
const { getSkinUrl, getAvailableSkins, skinExists } = require('./skinSystem.js');
const { openShop } = require('./shopSystem.js');
const { openCosmeticsShop } = require('./cosmeticsShop.js');
const { 
  TIER_INFO,
  addCosmeticItem,
  removeCosmeticItem,
  updateCosmeticPrice,
  toggleCosmeticAvailability
} = require('./cosmeticsSystem.js');
const { 
  grantUST, 
  removeUST, 
  getUSTBalance, 
  setUSTRate, 
  getUSTRates, 
  formatUSTBalance 
} = require('./ustSystem.js');
const { getCharacterAbility, getAbilityDescription } = require('./characterAbilities.js');
const characterManager = require('./characterManager.js');
const eventSystem = require('./eventSystem.js');
const {
  initCollectibleItemsIndexes,
  seedDefaultCollectibles,
  displayCollectibleItemsList,
  displayUserCollectibleItems,
  handleCollectibleItemsButton,
  startCollectibleItemSubmission,
  handleCollectibleSubmissionStep,
  hasActiveCollectibleSubmissionSession,
  displayPendingCollectibleSubmissions,
  getCollectibleItemByName,
  setProfileCollectibleItem,
  clearProfileCollectibleItem,
  getProfileCollectibleItem,
  sellCollectibleItem,
  approveCollectibleSubmission,
  rejectCollectibleSubmission,
  createCollectibleItem,
  deleteCollectibleItem,
  updateCollectibleItem,
  giveCollectibleItem,
  takeCollectibleItem,
  setItemGlobal,
  toggleItemTrait,
  setItemProbability,
  setItemAvailability,
  recalculateAllItemValues,
  getDroppableCollectibleItems,
  getCrateCollectibleItems,
  awardCollectibleItem,
  awardServerCollectible,
  getRarityTier
} = require('./collectibleItemsSystem.js');
const { viewKeys, unlockCharacter, openRandomCage } = require('./keySystem.js');
const {
  displayCharacterKeysMenu,
  handleCharacterKeysButton,
  handleCharacterKeysSelect,
  isKeyRushActive,
  getKeyRushTimeRemaining,
  activateKeyRush,
  activateKeyRushConfirmed,
  grantKeyRush,
  stopKeyRush,
  catchKeyDrop,
  initKeyRushScheduler,
  convertAllExcessKeysToTokens,
  unlockCharacterWithKeys,
  KEYS_TO_UNLOCK
} = require('./characterKeySystem.js');
const { 
  loadServerConfigs, 
  isMainServer, 
  isSuperAdmin, 
  isGlobalBotAdmin,
  isServerOwner,
  isServerAdmin,
  isBotAdmin, 
  isZooAdmin, 
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
  setZooAdminRole,
  setupServer, 
  isServerSetup, 
  isServerFullySetup, 
  hasSelectedGame, 
  getServerGame, 
  getSetupStatus, 
  setDropChannel, 
  setEventsChannel, 
  setUpdatesChannel, 
  getUpdatesChannel,
  getSuperAdminIds,
  getGlobalBotAdmins,
  getServerAdmins,
  getAllAdminsInfo,
  getHierarchyInfo,
  DEFAULT_FEATURE_SETTINGS,
  DEFAULT_GAME,
  getServerConfig,
  saveServerConfig,
  reloadServerConfigFromMongo
} = require('./serverConfigManager.js');
const gameSystem = require('./gameSystem.js');
const charSubmissionSystem = require('./characterSubmissionSystem.js');
const { startPromotionSystem } = require('./promotionSystem.js');
const { initializeGiveawaySystem, setGiveawayData, setMainDataGetter, enableAutoGiveaway, disableAutoGiveaway } = require('./giveawaySystem.js');
const { initializeLotterySystem, setLotteryData, enableAutoLottery, disableAutoLottery } = require('./lotterySystem.js');
const { startDropsForServer } = require('./dropSystem.js');
const { addCommandXP, getAccountLevelDisplay } = require('./accountLevelSystem.js');
const { 
  PERSONALIZED_TASKS,
  sendPersonalizedTask, 
  checkTaskProgress, 
  completePersonalizedTask, 
  checkExpiredTasks, 
  getEligibleUsers, 
  trackInviteCompletion,
  togglePersonalizedTasks, 
  getTaskStats,
  initializePersonalizedTaskData,
  formatReward,
  formatTime,
  createCustomTask,
  sendCustomTask
} = require('./personalizedTaskSystem.js');
const { getHistory, getHistorySummary, formatHistory } = require('./historySystem.js');
const { claimDaily, formatStreakDisplay } = require('./dailyRewardSystem.js');
const { 
  showSeasonPass, 
  showDailyTasks, 
  showSeasonRewards, 
  claimAllTaskRewardsCommand, 
  claimAllSeasonRewardsCommand,
  updateTaskProgress,
  initializeSeasonData
} = require('./seasonSystem.js');
const { displayGlobalLeaderboard, handleGlobalLeaderboardButton } = require('./globalLeaderboardSystem.js');
const { displayChallenges, claimChallenge, handleChallengeButton, trackChallengeProgress } = require('./weeklyChallengeSystem.js');
const { displayAchievements, checkAchievements, formatAchievementBadges, notifyNewAchievement } = require('./achievementSystem.js');
const { displayServerStats, recordEvent } = require('./analyticsSystem.js');
const { 
  initializeClanData,
  getClan,
  getUserClan,
  joinClan,
  leaveClan,
  donateToClan,
  getClanLeaderboard,
  formatClanProfile,
  formatClanLeaderboard,
  startWeeklyClanWars
} = require('./clanSystem.js');
const { initializeEmojiAssets, getEmojiForCharacter, setCharacterEmoji, refreshAllCharacterEmojis } = require('./emojiAssetManager.js');
const { 
  initializeChestVisuals, 
  getChestVisual, 
  setChestGif, 
  startPickSession, 
  getActiveSession, 
  clearSession 
} = require('./chestInteractionManager.js');
const { 
  coinDuel, 
  diceClash, 
  doorOfFate, 
  almostWinMachine, 
  rockPaperScissors,
  handleDiceClashButton,
  handleDoorButton
} = require('./minigamesSystem.js');
const {
  uploadPfpFromAttachment,
  equipPfp,
  listAllPfps,
  getUserPfps,
  getEquippedPfp,
  adminAddPfpToUser,
  adminRemovePfpFromUser,
  uploadPfpToRegistry,
  grantPfpToUser,
  grantPfpToClan,
  equipPfpByName,
  listRegistryPfps
} = require('./pfpSystem.js');
const {
  addTriviaQuestion,
  removeTriviaQuestion,
  startTriviaSession,
  answerTrivia,
  clearExpiredSessions,
  listAllQuestions,
  getTriviaStats
} = require('./triviaSystem.js');
const { ORES, WOOD_TYPES, formatOreInventory, formatWoodInventory } = require('./resourceSystem.js');
const { TOOL_TYPES, CRAFTING_RECIPES, craftTool, getToolInfo } = require('./toolSystem.js');
const { getQAEntry, getAllQA, addQAEntry, editQAEntry, deleteQAEntry, formatQAEmbed } = require('./qaSystem.js');
const { submitQA, getPendingSubmissions, approveQASubmission, rejectQASubmission, formatSubmissionEmbed } = require('./qaSubmissionSystem.js');
const { JOBS, initializeWorkData, canWork, assignRandomJob, completeWork, handleMinerJob, handleCaretakerJob, handleFarmerJob, handleZookeeperJob, handleRangerJob } = require('./workSystem.js');
const { upgradeHouse, getHouseInfo } = require('./caretakingSystem.js');
const marketSystem = require('./marketSystem.js');
const auctionSystem = require('./auctionSystem.js');
const { ITEM_CATEGORIES, getItemInfo, listItemOnMarket, buyFromMarket, cancelListing, getMarketListings, clearMarket, createMarketEmbed, createMarketButtons, createMarketFilterButtons } = marketSystem;
const { createAuction, placeBid, getActiveAuctions, forceEndAuction, clearAllAuctions, createAuctionEmbed, createAuctionButtons } = auctionSystem;
const antiCheatSystem = require('./antiCheatSystem.js');
const moderationSystem = require('./moderationSystem.js');
const {
  openHub,
  openQuickStart,
  createMainHubEmbed,
  createHubCategoryButtons,
  HUB_CATEGORIES
} = require('./hubSystem.js');
const {
  createFirstTimeWelcome,
  shouldShowOnboarding,
  initializeOnboarding
} = require('./onboardingSystem.js');
const {
  trackFeatureUse,
  initializeDiscovery
} = require('./discoverySystem.js');
const {
  handleHubInteraction,
  isHubInteraction,
  initializeUserHubData
} = require('./hubInteractionHandler.js');
const { initializeCommands, executeCommand } = require('./commands/commandHandler.js');

const PREFIX = '!';
let data;

const USE_MONGODB = process.env.USE_MONGODB === 'true';

async function initializeBot() {
  if (USE_MONGODB) {
    try {
      await initializeEmojiAssets();
      await initializeChestVisuals();
    } catch (error) {
      console.warn('⚠️ MongoDB features disabled - running in JSON-only mode');
    }
  } else {
    console.log('ℹ️ Running in JSON-only mode (USE_MONGODB not set to true)');
  }
  
  await characterManager.initializeCharacterSystem();
  console.log('✅ Dynamic character system initialized');
  
  data = await loadData();
  console.log('✅ Data loaded successfully');
  
  if (USE_MONGODB) {
    try {
      await refreshAllCharacterEmojis(data.users);
      console.log('✅ Custom emojis applied to all characters');
    } catch (error) {
      console.warn('⚠️ Could not refresh character emojis');
    }
  }
}

const { generateST: sharedGenerateST, initializeUserData, formatNumber, createErrorEmbed, createSuccessEmbed, safeReply } = require('./utils/shared.js');

function generateST() {
  return sharedGenerateST();
}

function startPersonalizedTaskSystem(client, data) {
  console.log('📬 Starting Personalized Task System...');
  
  // Check for expired tasks every 30 minutes
  setInterval(async () => {
    await checkExpiredTasks(client, data);
  }, 1800000);
  
  // Send tasks to inactive players every 2 hours
  setInterval(async () => {
    const now = Date.now();
    const inactiveThreshold = 6 * 3600000; // 6 hours
    const minTimeBetweenTasks = 2 * 3600000; // 2 hours
    
    for (const userId in data.users) {
      const userData = data.users[userId];
      const ptData = initializePersonalizedTaskData(userData);
      
      if (!ptData.isActive) continue;
      
      const lastActivity = userData.lastActivity || 0;
      const timeSinceActivity = now - lastActivity;
      const timeSinceLastTask = now - (ptData.lastTaskSent || 0);
      
      // Inactive user ready for task
      if (timeSinceActivity > inactiveThreshold && timeSinceLastTask > minTimeBetweenTasks) {
        await sendPersonalizedTask(client, userId, data);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }, 7200000); // Every 2 hours
  
  // Send tasks to active players every 3 hours
  setInterval(async () => {
    const now = Date.now();
    const activeThreshold = 2 * 3600000; // Active if within 2 hours
    const minTimeBetweenTasks = 4 * 3600000; // 4 hours
    
    for (const userId in data.users) {
      const userData = data.users[userId];
      const ptData = initializePersonalizedTaskData(userData);
      
      if (!ptData.isActive) continue;
      
      const lastActivity = userData.lastActivity || 0;
      const timeSinceActivity = now - lastActivity;
      const timeSinceLastTask = now - (ptData.lastTaskSent || 0);
      
      // Active user ready for task
      if (timeSinceActivity < activeThreshold && timeSinceLastTask > minTimeBetweenTasks) {
        await sendPersonalizedTask(client, userId, data);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }, 14400000); // Every 4 hours
  
  console.log('✅ Personalized Task System started!');
}

client.on('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`🎮 Bot is ready to serve ${client.guilds.cache.size} servers!`);
  
  try {
    await initializeBot();
  } catch (error) {
    console.error('Error in initializeBot:', error.message);
  }
  
  // Initialize command handler for commands in /commands directory
  try {
    initializeCommands();
    console.log('✅ Command handler initialized');
  } catch (error) {
    console.error('Error initializing command handler:', error.message);
  }
  
  if (USE_MONGODB) {
    try {
      const { setupDatabaseIndexes } = require('./mongoManager.js');
      await setupDatabaseIndexes();
    } catch (error) {
      console.warn('⚠️ Could not setup database indexes:', error.message);
    }
    
    try {
      await loadServerConfigs();
    } catch (error) {
      console.warn('⚠️ Could not load server configs from MongoDB');
    }
    
    try {
      await gameSystem.loadGames();
    } catch (error) {
      console.warn('⚠️ Could not load games from MongoDB');
    }
    
    try {
      await charSubmissionSystem.loadSubmissions();
    } catch (error) {
      console.warn('⚠️ Could not load submissions from MongoDB');
    }
    
    try {
      const { initializeServerAuraIndexes } = require('./serverAuraSystem.js');
      await initializeServerAuraIndexes();
    } catch (error) {
      console.warn('⚠️ Could not initialize server aura indexes');
    }
    
    try {
      await dashboardDb.backfillServersFromBot(client);
      console.log('✅ Dashboard server backfill complete');
    } catch (error) {
      console.warn('⚠️ Could not backfill servers to dashboard:', error.message);
    }
  } else {
    console.log('ℹ️ Skipping MongoDB-dependent systems (server configs, games, submissions)');
  }
  
  initializeClanData(data);
  marketSystem.init(client);
  auctionSystem.init(client);
  
  try {
    await initializeGiveawaySystem(client, data);
    setMainDataGetter(() => data);
    console.log('✅ Giveaway system initialized with live data reference');
  } catch (error) {
    console.warn('⚠️ Giveaway system init error:', error.message);
  }
  
  try {
    await initializeLotterySystem(client, data);
  } catch (error) {
    console.warn('⚠️ Lottery system init error:', error.message);
  }
  
  if (USE_MONGODB) {
    try {
      await eventSystem.init(client, data);
    } catch (error) {
      console.warn('⚠️ Event system init error:', error.message);
    }
    
    try {
      await initCollectibleItemsIndexes();
      console.log('✅ Collectible items indexes initialized');
      await seedDefaultCollectibles();
    } catch (error) {
      console.warn('⚠️ Collectible items init error:', error.message);
    }
    
    // Auto-seed ZooBot characters to global directory so they show in !characters list
    try {
      await characterManager.seedDefaultGlobalCharacters();
      console.log('✅ ZooBot characters seeded to global directory');
    } catch (error) {
      console.warn('⚠️ Could not seed global characters:', error.message);
    }
    
    // Auto-backfill main server with ZooBot original characters and default collectibles
    try {
      await backfillMainServerData();
      console.log('✅ Main server characters and collectibles backfilled');
    } catch (error) {
      console.warn('⚠️ Could not backfill main server data:', error.message);
    }
  }
  
  try {
    await startDropSystem(client, data);
  } catch (error) {
    console.warn('⚠️ Drop system init error:', error.message);
  }
  
  try {
    initKeyRushScheduler(client, data);
  } catch (error) {
    console.warn('⚠️ Key Rush scheduler init error:', error.message);
  }
  
  // Promotion system disabled by default - simplified bot mode
  // startPromotionSystem(client);
  startPersonalizedTaskSystem(client, data);
  startWeeklyClanWars(client, data);
  
  const superAdminIds = require('./serverConfigManager.js').getSuperAdminIds ? require('./serverConfigManager.js').getSuperAdminIds() : [];
  antiCheatSystem.initAntiCheat(superAdminIds);
  moderationSystem.initModeration(superAdminIds);
  
  if (USE_MONGODB) {
    try {
      await moderationSystem.loadModerationData();
    } catch (error) {
      console.warn('⚠️ Could not load moderation data from MongoDB');
    }
  }
  
  setDashboardDiscordClient(client);
  console.log('✅ Dashboard Discord client configured');
  
  client.on('dashboardConfigUpdate', async (updateData) => {
    const { serverId, type, data: updatePayload } = updateData;
    console.log(`[Dashboard] Config update for server ${serverId}: ${type}`);
    
    try {
      switch (type) {
        case 'core':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for core settings`);
            }
          }
          console.log(`[Dashboard] Core settings updated for server ${serverId}`);
          break;
          
        case 'permissions':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for permission settings`);
            }
          }
          console.log(`[Dashboard] Permission settings updated for server ${serverId}`);
          break;
          
        case 'channels':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for channel settings`);
            }
          }
          console.log(`[Dashboard] Channel settings updated for server ${serverId}`);
          break;
          
        case 'features':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for feature toggles`);
            }
          }
          console.log(`[Dashboard] Feature toggles updated for server ${serverId}`);
          break;
          
        case 'notifications':
        case 'pingSettings':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for notification settings`);
            }
          }
          console.log(`[Dashboard] Notification settings updated for server ${serverId}`);
          break;
          
        case 'moderation':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for moderation settings`);
            }
          }
          console.log(`[Dashboard] Moderation settings updated for server ${serverId}`);
          break;
          
        case 'economy':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for economy settings`);
            }
          }
          console.log(`[Dashboard] Economy settings updated for server ${serverId}`);
          break;
          
        case 'onboarding':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for onboarding settings`);
            }
          }
          console.log(`[Dashboard] Onboarding settings updated for server ${serverId}`);
          break;
          
        case 'automation':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for automation settings`);
            }
          }
          console.log(`[Dashboard] Automation settings updated for server ${serverId}`);
          break;
          
        case 'characterAdded':
        case 'characterRemoved':
        case 'charactersUpdated':
          await dashboardDb.checkAndUpdateSetupStatus(serverId);
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for character configuration`);
            }
          }
          console.log(`[Dashboard] Character configuration updated for server ${serverId}`);
          break;
          
        case 'collectibleAdded':
        case 'collectibleRemoved':
        case 'collectiblesUpdated':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for collectible configuration`);
            }
          }
          console.log(`[Dashboard] Collectible configuration updated for server ${serverId}`);
          break;
          
        case 'setupCompleted':
          if (USE_MONGODB) {
            try {
              await reloadServerConfigFromMongo(serverId);
            } catch (e) {
              console.log(`[Dashboard] Using in-memory update for setup completion`);
            }
          }
          console.log(`[Dashboard] Setup completed for server ${serverId}`);
          break;
          
        default:
          console.log(`[Dashboard] Unhandled config update type: ${type}`);
      }
    } catch (error) {
      console.error(`[Dashboard] Error processing config update for ${serverId}:`, error);
    }
  });
  console.log('✅ Dashboard event listener configured');
  
  console.log('✅ All systems initialized!');
});

client.on('guildCreate', async (guild) => {
  console.log(`✅ Bot added to new server: ${guild.name} (${guild.id})`);
  
  if (!isMainServer(guild.id)) {
    // Auto-seed ZooBot characters to this server's collection
    if (USE_MONGODB) {
      try {
        const serverCharsCol = await mongoManager.getCollection('serverCharacters');
        const hardcodedChars = require('./characters.js');
        
        let seeded = 0;
        for (const char of hardcodedChars) {
          const existing = await serverCharsCol.findOne({ serverId: guild.id, name: char.name });
          if (existing) continue;
          
          const serverChar = {
            serverId: guild.id,
            name: char.name,
            emoji: char.emoji,
            customEmojiId: char.customEmojiId || null,
            game: 'ZooBot',
            createdBy: 'ZooBot',
            rarity: 'common',
            dropSettings: { enabled: true, probability: 5 },
            crateSettings: { enabled: true, probability: 5, crates: ['bronze', 'silver', 'gold', 'emerald'] },
            status: 'active',
            isPublic: true,
            createdAt: new Date()
          };
          await serverCharsCol.insertOne(serverChar);
          seeded++;
        }
        if (seeded > 0) console.log(`✅ Auto-seeded ${seeded} ZooBot characters to ${guild.name}`);
      } catch (error) {
        console.warn(`⚠️ Could not seed characters to new server:`, error.message);
      }
      
      // Auto-seed default collectibles
      try {
        await seedDefaultCollectibles(guild.id);
        console.log(`✅ Auto-seeded collectibles to ${guild.name}`);
      } catch (error) {
        console.warn(`⚠️ Could not seed collectibles to new server:`, error.message);
      }
    }
  }
  
  if (!isMainServer(guild.id) && !isServerSetup(guild.id)) {
    try {
      const owner = await guild.fetchOwner();
      const setupEmbed = new EmbedBuilder()
        .setColor('#00D9FF')
        .setTitle('👋 Thanks for adding ZooBot!')
        .setDescription('✅ **Default Setup Ready!** All 51 ZooBot characters and collectibles are loaded and ready to go!\n\n**QUICK START (2 steps):**\n1. `!setdropchannel #channel` - Where drops appear\n2. `!seteventschannel #channel` - Where events announced\n\n✨ **Done!** Users can catch creatures and play immediately.')
        .addFields(
          {
            name: '🎮 What Users Can Do',
            value: '• `!catch` - Catch drops\n• `!collection` - View creatures\n• `!battle @user` - Battle other players\n• `!trade @user` - Trade creatures\n• Earn rewards and climb leaderboards'
          },
          {
            name: '🎨 Want to Customize? (Server Owner/Admin)',
            value: '**Replace Characters:**\n• `!characters remove <name>` - Remove unwanted creatures\n• `!characters add <id>` - Add from global directory\n• `!sc create` - Design completely custom characters\n\n**Customize Collectibles:**\n• `!collectibles` - View all collectibles\n• `!collectibles remove <name>` - Remove unwanted items\n• `!collectibles add` - Add custom items\n\n**Visual Customization:**\n• `!setemoji <character> <emoji>` - Change character emojis\n• `!setchestgif <bronze/silver/gold/emerald/legendary/tyrant> <URL>` - Custom crate animations'
          },
          {
            name: '🔐 Admin Access (Optional)',
            value: 'Create a role called **"ZooAdmin"** in Discord and assign to trusted users who should manage the bot. They can use all customization commands without having to be owner.'
          },
          {
            name: '❓ Need Help?',
            value: '• `!help` - View all commands\n• `!guide` - Full gameplay guide\n• `!commands` - Detailed command list'
          }
        )
        .setFooter({ text: '✅ Play now with defaults or customize to make it yours!' });
      
      await owner.send({ embeds: [setupEmbed] }).catch(() => {
        console.log(`Could not DM owner of ${guild.name}`);
      });
    } catch (error) {
      console.error('Error sending setup message:', error);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isModalSubmit() && interaction.customId.startsWith('createchar_form_')) {
    if (!data) return;
    
    try {
      const userId = interaction.user.id;
      
      if (!isSuperAdmin(userId)) {
        await interaction.reply({ content: '❌ Only Super Admins can create characters!', ephemeral: true });
        return;
      }
      
      const charName = interaction.fields.getTextInputValue('char_name');
      const charEmoji = interaction.fields.getTextInputValue('char_emoji');
      const charObtainable = interaction.fields.getTextInputValue('char_obtainable').toLowerCase();
      const abilityData = interaction.fields.getTextInputValue('char_ability');
      const moveData = interaction.fields.getTextInputValue('char_move');
      
      let ability = null;
      if (abilityData && abilityData.trim()) {
        const abilityParts = abilityData.split('|').map(p => p.trim());
        if (abilityParts.length >= 4) {
          ability = {
            name: abilityParts[0],
            emoji: abilityParts[1],
            description: abilityParts[2],
            effectType: abilityParts[3],
            effectValue: parseFloat(abilityParts[4]) || 0.1
          };
        }
      }
      
      let specialMove = null;
      if (moveData && moveData.trim()) {
        const moveParts = moveData.split('|').map(p => p.trim());
        if (moveParts.length >= 2) {
          specialMove = {
            name: moveParts[0],
            damage: parseInt(moveParts[1]) || 90
          };
        }
      }
      
      const result = await characterManager.createCharacter(userId, {
        name: charName,
        emoji: charEmoji,
        obtainable: charObtainable,
        ability: ability,
        specialMove: specialMove
      });
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Character Created!')
          .setDescription(`**${charEmoji} ${charName}** has been added to the game!`)
          .addFields(
            { name: 'Obtainable', value: charObtainable, inline: true },
            { name: 'Ability', value: ability ? `${ability.emoji} ${ability.name}` : 'None set', inline: true },
            { name: 'Special Move', value: specialMove ? `${specialMove.name} (${specialMove.damage} DMG)` : 'None set', inline: true }
          )
          .setFooter({ text: 'Character is now available in drops and crates!' });
        
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({ content: result.message, ephemeral: true });
      }
    } catch (error) {
      console.error('Error creating character:', error);
      await interaction.reply({ content: '❌ An error occurred while creating the character!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isModalSubmit() && interaction.customId.startsWith('auction_create_form_')) {
    if (!data) return;
    
    try {
      const formParts = interaction.customId.split('_');
      const category = formParts[3];
      const itemName = formParts[4];
      const quantity = parseInt(interaction.fields.getTextInputValue('auction_quantity'));
      const startingBid = parseInt(interaction.fields.getTextInputValue('auction_bid'));
      
      const durationField = interaction.fields.getField('auction_duration');
      const durationHours = durationField ? (parseInt(durationField.value) || 24) : 24;
      
      const currencyField = interaction.fields.getField('auction_currency');
      const currencyInput = currencyField ? currencyField.value.toLowerCase() : 'coins';
      const currency = (currencyInput === 'gems' || currencyInput === 'gem') ? 'gems' : 'coins';
      
      if (!quantity || quantity <= 0 || isNaN(quantity)) {
        await interaction.reply({ content: '❌ Quantity must be a positive number!', ephemeral: true });
        return;
      }
      
      if (!startingBid || startingBid <= 0 || isNaN(startingBid)) {
        await interaction.reply({ content: '❌ Starting bid must be a positive number!', ephemeral: true });
        return;
      }
      
      if (durationHours <= 0 || isNaN(durationHours)) {
        await interaction.reply({ content: '❌ Duration must be a positive number of hours!', ephemeral: true });
        return;
      }
      
      const duration = durationHours * 3600000;
      const createResult = await createAuction(data, interaction.user.id, category, itemName, quantity, startingBid, duration, currency);
      
      if (!createResult.success) {
        await interaction.reply({ content: createResult.message, ephemeral: true });
        return;
      }
      
      const itemInfo = getItemInfo(category, itemName);
      const currencyEmoji = currency === 'gems' ? '💎' : '💰';
      await interaction.reply({
        content: 
          `✅ Auction created!\n` +
          `${itemInfo.emoji} ${quantity}x ${itemName}\n` +
          `Starting bid: ${startingBid} ${currency} ${currencyEmoji}\n` +
          `Duration: ${durationHours} hour(s)\n` +
          `ID: \`${createResult.auctionId.slice(0, 8)}\`\n` +
          `Ends: <t:${Math.floor(createResult.endsAt / 1000)}:R>`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error submitting auction form:', error);
      await interaction.reply({ content: '❌ An error occurred while creating the auction!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isStringSelectMenu() && interaction.customId === 'auction_category_select') {
    if (!data) return;
    const selectedCategory = interaction.values[0];
    const { ITEM_CATEGORIES } = require('./marketSystem.js');
    const categoryData = ITEM_CATEGORIES[selectedCategory];
    
    if (!categoryData) {
      await interaction.reply({ content: '❌ Invalid category!', ephemeral: true });
      return;
    }
    
    const itemOptions = Object.entries(categoryData.items).map(([key, item]) => ({
      label: item.name,
      value: key,
      emoji: item.emoji
    })).slice(0, 25);
    
    const itemSelect = new StringSelectMenuBuilder()
      .setCustomId(`auction_item_select_${selectedCategory}`)
      .setPlaceholder('📦 Select Item')
      .addOptions(itemOptions);
    
    await interaction.reply({
      content: `✅ **Category:** ${categoryData.display}\n**Step 2:** Select an item:`,
      components: [new ActionRowBuilder().addComponents(itemSelect)],
      ephemeral: true
    });
  }
  
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('auction_item_select_')) {
    if (!data) return;
    const selectedCategory = interaction.customId.split('_')[3];
    const selectedItem = interaction.values[0];
    
    try {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      
      const modal = new ModalBuilder()
        .setCustomId(`auction_create_form_${selectedCategory}_${selectedItem}`)
        .setTitle('🎯 Create Auction');
      
      const quantityInput = new TextInputBuilder()
        .setCustomId('auction_quantity')
        .setLabel('📊 Quantity')
        .setPlaceholder('Number of items (e.g., 5, 100)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);
      
      const bidInput = new TextInputBuilder()
        .setCustomId('auction_bid')
        .setLabel('💰 Starting Bid Amount')
        .setPlaceholder('e.g., 500, 1000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);
      
      const durationInput = new TextInputBuilder()
        .setCustomId('auction_duration')
        .setLabel('⏰ Duration (hours)')
        .setPlaceholder('Leave empty for 24 hours')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(3);
      
      const currencyInput = new TextInputBuilder()
        .setCustomId('auction_currency')
        .setLabel('💎 Currency')
        .setPlaceholder('coins or gems (default: coins)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(10);
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(quantityInput),
        new ActionRowBuilder().addComponents(bidInput),
        new ActionRowBuilder().addComponents(durationInput),
        new ActionRowBuilder().addComponents(currencyInput)
      );
      
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing auction modal:', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
  
  if (interaction.isButton() && interaction.customId === 'auction_create_button') {
    if (!data) return;
    
    try {
      const { ITEM_CATEGORIES } = require('./marketSystem.js');
      
      const categoryOptions = Object.entries(ITEM_CATEGORIES).map(([key, data]) => ({
        label: data.display,
        value: key
      }));
      
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('auction_category_select')
        .setPlaceholder('📂 Select Category')
        .addOptions(categoryOptions);
      
      await interaction.reply({
        content: '🎯 **Auction Creation**\n**Step 1:** Select a category:',
        components: [new ActionRowBuilder().addComponents(categorySelect)],
        ephemeral: true
      });
    } catch (error) {
      console.error('Error showing auction category select:', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isButton() && interaction.customId.startsWith('open_createchar_modal_')) {
    if (!data) return;
    
    const userId = interaction.user.id;
    if (!isSuperAdmin(userId)) {
      await interaction.reply({ content: '❌ Only Super Admins can create characters!', ephemeral: true });
      return;
    }
    
    try {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      
      const modal = new ModalBuilder()
        .setCustomId(`createchar_form_${userId}`)
        .setTitle('🦁 Create New Character');
      
      const nameInput = new TextInputBuilder()
        .setCustomId('char_name')
        .setLabel('Character Name')
        .setPlaceholder('e.g., Luna')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);
      
      const emojiInput = new TextInputBuilder()
        .setCustomId('char_emoji')
        .setLabel('Emoji')
        .setPlaceholder('e.g., 🦋 or <:custom:123456>')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);
      
      const obtainableInput = new TextInputBuilder()
        .setCustomId('char_obtainable')
        .setLabel('How to Obtain')
        .setPlaceholder('crate, starter, drop, event, or exclusive')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);
      
      const abilityInput = new TextInputBuilder()
        .setCustomId('char_ability')
        .setLabel('Ability (Name|Emoji|Desc|Effect|Value)')
        .setPlaceholder('Lunar Glow|🌙|Heal 5% HP per turn|healPerTurn|0.05')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(200);
      
      const moveInput = new TextInputBuilder()
        .setCustomId('char_move')
        .setLabel('Special Move (Name|Damage)')
        .setPlaceholder('Moon Beam|90')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(50);
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(emojiInput),
        new ActionRowBuilder().addComponents(obtainableInput),
        new ActionRowBuilder().addComponents(abilityInput),
        new ActionRowBuilder().addComponents(moveInput)
      );
      
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing createchar modal:', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isButton() && interaction.customId.startsWith('createchar_dropdown_')) {
    if (!data) return;
    
    const userId = interaction.user.id;
    if (!isSuperAdmin(userId)) {
      await interaction.reply({ content: '❌ Only Super Admins can create characters!', ephemeral: true });
      return;
    }
    
    try {
      const ABILITY_EFFECTS_PAGE1 = [
        { label: 'Critical Damage Bonus', value: 'criticalDamageBonus', description: 'Critical hits deal X% more damage', emoji: '⚔️' },
        { label: 'Heal Per Turn', value: 'healPerTurn', description: 'Recover X% HP each turn', emoji: '💚' },
        { label: 'Damage Reduction', value: 'damageReduction', description: 'Take X% less damage', emoji: '🛡️' },
        { label: 'Dodge Chance', value: 'dodgeChance', description: 'X% chance to dodge attacks', emoji: '💨' },
        { label: 'Lifesteal', value: 'lifesteal', description: 'Heal for X% of damage dealt', emoji: '🧛' },
        { label: 'Freeze Chance', value: 'freezeChance', description: 'X% chance to freeze enemy', emoji: '❄️' },
        { label: 'Burn Chance', value: 'burnChance', description: 'X% chance to burn enemy', emoji: '🔥' },
        { label: 'Critical Hit Chance', value: 'criticalChanceBonus', description: '+X% crit chance', emoji: '🎯' },
        { label: 'Energy Regen Per Turn', value: 'energyRegenPerTurn', description: '+X energy each turn', emoji: '⚡' },
        { label: 'Starting Energy Bonus', value: 'startingEnergyBonus', description: 'Start with +X energy', emoji: '🔋' },
        { label: 'Flat Damage Bonus', value: 'flatDamageBonus', description: '+X damage to all attacks', emoji: '💥' },
        { label: 'Special Damage Bonus', value: 'specialDamageBonus', description: '+X% special move damage', emoji: '✨' },
        { label: 'Energy Steal', value: 'energySteal', description: 'Steal X energy on hit', emoji: '🌀' },
        { label: 'Starting Shield', value: 'startingShield', description: 'Start with X% HP shield', emoji: '🔰' },
        { label: 'First Attack Bonus', value: 'firstAttackBonus', description: 'First attack +X% damage', emoji: '🥊' },
        { label: 'Paralyze Chance', value: 'paralyzeChance', description: 'X% chance to stun enemy', emoji: '⚡' },
        { label: 'Double Attack Chance', value: 'doubleAttackChance', description: 'X% chance to attack twice', emoji: '👊' },
        { label: 'Healing Bonus', value: 'healingBonus', description: 'Heals are X% stronger', emoji: '💖' },
        { label: 'Defense Bonus', value: 'defenseBonus', description: 'X% damage reduction', emoji: '🏰' },
        { label: 'Extra Turn Chance', value: 'extraTurnChance', description: 'X% chance extra turn', emoji: '🔄' },
        { label: 'No Ability', value: 'none', description: 'Character has no ability', emoji: '❌' }
      ];
      
      const abilitySelect = new StringSelectMenuBuilder()
        .setCustomId(`createchar_ability_select_${userId}`)
        .setPlaceholder('⚔️ Select an Ability Effect')
        .addOptions(ABILITY_EFFECTS_PAGE1);
      
      await interaction.reply({
        content: '**Step 2:** Choose an ability effect for your character:\n\n*This determines what passive power the character has in battle.*',
        components: [new ActionRowBuilder().addComponents(abilitySelect)],
        ephemeral: true
      });
    } catch (error) {
      console.error('Error showing ability dropdown:', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('createchar_ability_select_')) {
    if (!data) return;
    
    const userId = interaction.user.id;
    if (!isSuperAdmin(userId)) {
      await interaction.reply({ content: '❌ Only Super Admins!', ephemeral: true });
      return;
    }
    
    const selectedEffect = interaction.values[0];
    
    if (!pendingCharacterCreations) {
      global.pendingCharacterCreations = new Map();
    }
    
    const pending = pendingCharacterCreations.get(userId);
    if (!pending) {
      await interaction.reply({ content: '❌ Session expired! Use !createchar2 again.', ephemeral: true });
      return;
    }
    
    pending.effectType = selectedEffect;
    pendingCharacterCreations.set(userId, pending);
    
    if (selectedEffect === 'none') {
      try {
        const result = await characterManager.createCharacter(userId, {
          name: pending.name,
          emoji: pending.emoji,
          obtainable: pending.obtainable,
          ability: null,
          specialMove: pending.specialMove || null
        });
        
        pendingCharacterCreations.delete(userId);
        
        if (result.success) {
          const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Character Created!')
            .setDescription(`**${pending.emoji} ${pending.name}** has been added to the game!`)
            .addFields(
              { name: 'Obtainable', value: pending.obtainable, inline: true },
              { name: 'Ability', value: 'None', inline: true },
              { name: 'Special Move', value: pending.specialMove ? `${pending.specialMove.name} (${pending.specialMove.damage} DMG)` : 'Default', inline: true }
            );
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply({ content: result.message, ephemeral: true });
        }
      } catch (error) {
        console.error('Error creating character:', error);
        await interaction.reply({ content: '❌ An error occurred!', ephemeral: true });
      }
      return;
    }
    
    try {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      
      const modal = new ModalBuilder()
        .setCustomId(`createchar_details_${userId}`)
        .setTitle('⚔️ Ability Details');
      
      const abilityNameInput = new TextInputBuilder()
        .setCustomId('ability_name')
        .setLabel('Ability Name')
        .setPlaceholder('e.g., Fierce Claws, Shadow Strike')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(30);
      
      const abilityEmojiInput = new TextInputBuilder()
        .setCustomId('ability_emoji')
        .setLabel('Ability Emoji')
        .setPlaceholder('e.g., 🐯 ⚔️ 🔥')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);
      
      const abilityDescInput = new TextInputBuilder()
        .setCustomId('ability_desc')
        .setLabel('Ability Description')
        .setPlaceholder('e.g., Critical hits deal 50% more damage')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);
      
      const abilityValueInput = new TextInputBuilder()
        .setCustomId('ability_value')
        .setLabel('Effect Value (decimal or number)')
        .setPlaceholder('e.g., 0.5 for 50%, 10 for flat bonus')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);
      
      const moveDamageInput = new TextInputBuilder()
        .setCustomId('move_damage')
        .setLabel('Special Move Damage (optional)')
        .setPlaceholder('e.g., 90 (leave empty for default)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(5);
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(abilityNameInput),
        new ActionRowBuilder().addComponents(abilityEmojiInput),
        new ActionRowBuilder().addComponents(abilityDescInput),
        new ActionRowBuilder().addComponents(abilityValueInput),
        new ActionRowBuilder().addComponents(moveDamageInput)
      );
      
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing ability details modal:', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isModalSubmit() && interaction.customId.startsWith('createchar_details_')) {
    if (!data) return;
    
    const userId = interaction.user.id;
    
    if (!pendingCharacterCreations) {
      global.pendingCharacterCreations = new Map();
    }
    
    const pending = pendingCharacterCreations.get(userId);
    if (!pending) {
      await interaction.reply({ content: '❌ Session expired! Use !createchar2 again.', ephemeral: true });
      return;
    }
    
    try {
      const abilityName = interaction.fields.getTextInputValue('ability_name');
      const abilityEmoji = interaction.fields.getTextInputValue('ability_emoji');
      const abilityDesc = interaction.fields.getTextInputValue('ability_desc');
      const abilityValue = parseFloat(interaction.fields.getTextInputValue('ability_value')) || 0.1;
      const moveDamage = interaction.fields.getTextInputValue('move_damage');
      
      const ability = {
        name: abilityName,
        emoji: abilityEmoji,
        description: abilityDesc,
        effectType: pending.effectType,
        effectValue: abilityValue
      };
      
      let specialMove = pending.specialMove;
      if (moveDamage && parseInt(moveDamage) > 0) {
        specialMove = {
          name: `${pending.name}'s Strike`,
          damage: parseInt(moveDamage)
        };
      }
      
      const result = await characterManager.createCharacter(userId, {
        name: pending.name,
        emoji: pending.emoji,
        obtainable: pending.obtainable,
        ability: ability,
        specialMove: specialMove
      });
      
      pendingCharacterCreations.delete(userId);
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Character Created!')
          .setDescription(`**${pending.emoji} ${pending.name}** has been added to the game!`)
          .addFields(
            { name: 'Obtainable', value: pending.obtainable, inline: true },
            { name: 'Ability', value: `${abilityEmoji} ${abilityName}`, inline: true },
            { name: 'Effect', value: `${pending.effectType}: ${abilityValue}`, inline: true },
            { name: 'Special Move', value: specialMove ? `${specialMove.name} (${specialMove.damage} DMG)` : 'Default', inline: true }
          )
          .setFooter({ text: 'Character is now available in drops, crates, and battles!' });
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({ content: result.message, ephemeral: true });
      }
    } catch (error) {
      console.error('Error completing character creation:', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (interaction.isButton() && interaction.customId.startsWith('createchar_skip_')) {
    if (!data) return;
    
    const userId = interaction.user.id;
    if (!isSuperAdmin(userId)) {
      await interaction.reply({ content: '❌ Only Super Admins!', ephemeral: true });
      return;
    }
    
    if (!global.pendingCharacterCreations) {
      global.pendingCharacterCreations = new Map();
    }
    
    const pending = pendingCharacterCreations.get(userId);
    if (!pending) {
      await interaction.reply({ content: '❌ Session expired! Use !createchar2 again.', ephemeral: true });
      return;
    }
    
    try {
      const result = await characterManager.createCharacter(userId, {
        name: pending.name,
        emoji: pending.emoji,
        obtainable: pending.obtainable,
        ability: null,
        specialMove: null
      });
      
      pendingCharacterCreations.delete(userId);
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Character Created!')
          .setDescription(`**${pending.emoji} ${pending.name}** has been added to the game!`)
          .addFields(
            { name: 'Obtainable', value: pending.obtainable, inline: true },
            { name: 'Ability', value: 'None (can add later with !setability)', inline: true },
            { name: 'Special Move', value: 'Default (can set with !setmove)', inline: true }
          )
          .setFooter({ text: 'Character is now available in drops, crates, and battles!' });
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({ content: result.message, ephemeral: true });
      }
    } catch (error) {
      console.error('Error creating character (skip):', error);
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
    return;
  }
  
  if (!interaction.isButton()) return;
  if (!data) return;
  
  try {
    if (isHubInteraction(interaction.customId)) {
      const handled = await handleHubInteraction(interaction, data, saveData);
      if (handled) return;
    }
    
    if (interaction.customId === 'setup_help_guide') {
      const guideEmbed = new EmbedBuilder()
        .setColor('#00D9FF')
        .setTitle('📖 ZooBot Setup Guide')
        .setDescription('Follow these steps to set up ZooBot for your server:')
        .addFields(
          {
            name: '1️⃣ Open the Dashboard',
            value: 'Click the **"Open Dashboard"** button or visit our website and log in with Discord.',
            inline: false
          },
          {
            name: '2️⃣ Select Your Server',
            value: 'Choose the server you want to configure from the list of servers you own.',
            inline: false
          },
          {
            name: '3️⃣ Choose Characters',
            value: `Select at least **${MINIMUM_CHARACTERS_REQUIRED} characters** that will appear in drops and crates on your server.`,
            inline: false
          },
          {
            name: '4️⃣ Configure Channels',
            value: '**Drop Channel:** Where character drops appear\n**Events Channel:** Where announcements go\n**Updates Channel:** For bot update notifications',
            inline: false
          },
          {
            name: '5️⃣ Start Playing!',
            value: 'Once setup is complete, all gameplay commands will be unlocked for your server members.',
            inline: false
          }
        )
        .setFooter({ text: 'Need help? Join our support server for assistance!' });
      
      await interaction.reply({ embeds: [guideEmbed], ephemeral: true });
      return;
    }
    
    if (interaction.customId === 'join_giveaway') {
      const { handleButtonJoin } = require('./giveawaySystem.js');
      await handleButtonJoin(interaction);
    } else if (interaction.customId.startsWith('diceclash_')) {
      await handleDiceClashButton(interaction, data);
    } else if (interaction.customId.startsWith('door_')) {
      await handleDoorButton(interaction, data);
    } else if (interaction.customId.startsWith('globalboard_')) {
      await handleGlobalLeaderboardButton(interaction, data);
    } else if (interaction.customId.startsWith('challenge_')) {
      await handleChallengeButton(interaction, data);
    } else if (interaction.customId.startsWith('auction_')) {
      if (!interaction.guild.auctionMenus) {
        interaction.guild.auctionMenus = new Map();
      }
      
      const menuState = interaction.guild.auctionMenus.get(interaction.message.id);
      if (!menuState || Date.now() > menuState.expiresAt) {
        await interaction.reply({ content: '⏰ This menu has expired!', ephemeral: true });
        if (menuState) interaction.guild.auctionMenus.delete(interaction.message.id);
        return;
      }
      
      const activeAuctions = await getActiveAuctions(data);
      const totalPages = Math.ceil(activeAuctions.length / 5) || 1;
      let newPage = menuState.page;
      
      if (interaction.customId === 'auction_first') newPage = 0;
      else if (interaction.customId === 'auction_prev') newPage = Math.max(0, menuState.page - 1);
      else if (interaction.customId === 'auction_next') newPage = Math.min(totalPages - 1, menuState.page + 1);
      else if (interaction.customId === 'auction_last') newPage = totalPages - 1;
      else if (interaction.customId === 'auction_refresh') newPage = Math.min(menuState.page, totalPages - 1);
      
      menuState.page = newPage;
      const embed = createAuctionEmbed(activeAuctions, newPage, 5);
      const buttons = createAuctionButtons(newPage, totalPages);
      
      await interaction.update({ embeds: [embed], components: [buttons] });
    } else if (interaction.customId.startsWith('market_')) {
      if (!interaction.guild.marketMenus) {
        interaction.guild.marketMenus = new Map();
      }
      
      const menuState = interaction.guild.marketMenus.get(interaction.message.id);
      if (!menuState || Date.now() > menuState.expiresAt) {
        await interaction.reply({ content: '⏰ This menu has expired!', ephemeral: true });
        if (menuState) interaction.guild.marketMenus.delete(interaction.message.id);
        return;
      }
      
      let newPage = menuState.page;
      let newFilter = menuState.filter;
      
      if (interaction.customId === 'market_filter_all') {
        newFilter = null;
        newPage = 0;
      } else if (interaction.customId === 'market_filter_ore') {
        newFilter = 'ore';
        newPage = 0;
      } else if (interaction.customId === 'market_filter_wood') {
        newFilter = 'wood';
        newPage = 0;
      } else if (interaction.customId === 'market_filter_crate') {
        newFilter = 'crate';
        newPage = 0;
      } else if (interaction.customId === 'market_filter_key') {
        newFilter = 'key';
        newPage = 0;
      } else {
        if (interaction.customId === 'market_first') newPage = 0;
        else if (interaction.customId === 'market_prev') newPage = Math.max(0, menuState.page - 1);
        else if (interaction.customId === 'market_next') newPage = menuState.page + 1;
        else if (interaction.customId === 'market_last') newPage = 999999;
        else if (interaction.customId === 'market_refresh') newPage = menuState.page;
      }
      
      const allListings = await getMarketListings(data);
      const filteredListings = newFilter ? allListings.filter(l => l.category === newFilter) : allListings;
      const totalPages = Math.ceil(filteredListings.length / 5) || 1;
      
      newPage = Math.min(newPage, totalPages - 1);
      newPage = Math.max(0, newPage);
      
      menuState.page = newPage;
      menuState.filter = newFilter;
      
      const embed = createMarketEmbed(filteredListings, newPage, 5, newFilter);
      const navButtons = createMarketButtons(newPage, totalPages);
      const filterButtons = createMarketFilterButtons(newFilter);
      
      await interaction.update({ embeds: [embed], components: [navButtons, filterButtons] });
    } else if (interaction.customId.startsWith('charkeys_')) {
      await handleCharacterKeysButton(interaction, data);
    } else if (interaction.customId.startsWith('colitems_') || interaction.customId.startsWith('mycolitem_')) {
      await handleCollectibleItemsButton(interaction);
    }
  } catch (error) {
    console.error('Error handling button interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (!data) return;
  
  try {
    if (interaction.customId === 'charkeys_unlock_select') {
      await handleCharacterKeysSelect(interaction, data);
    }
  } catch (error) {
    console.error('Error handling select menu interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  // Check if data is loaded yet
  if (!data) return;
  
  const userId = message.author.id;
  
  if (!data.users[userId]) {
    data.users[userId] = {
      username: message.author.username,
      coins: 0,
      gems: 0,
      characters: [],
      selectedCharacter: null,
      pendingTokens: 0,
      started: false,
      trophies: 200,
      messageCount: 0,
      lastDailyClaim: null,
      inventory: {},
      tutorialStage: 'intro',
      tutorialCompleted: false
    };
    await saveDataImmediate(data);
  }
  

  if (!data.users[userId].username) {
    data.users[userId].username = message.author.username;
  }
  
  if (data.users[userId].started && !message.content.startsWith(PREFIX)) {
    data.users[userId].messageCount = (data.users[userId].messageCount || 0) + 1;
    data.users[userId].lastActivity = Date.now();
    
    // Add server aura for messages
    const serverId = message.guild?.id;
    if (serverId) {
      const { addAura } = require('./serverAuraSystem.js');
      addAura(serverId, 1, 'message').catch(err => console.error('Error adding message aura:', err));
    }
    
    // Track season daily task progress for messages
    updateTaskProgress(data.users[userId], 'messagesSent', 1);
    
    const ptData = initializePersonalizedTaskData(data.users[userId]);
    if (ptData.taskProgress.messagesSent !== undefined) {
      const completedTask = checkTaskProgress(data.users[userId], 'messagesSent', 1);
      if (completedTask) {
        await completePersonalizedTask(client, userId, data, completedTask);
      }
    }
    
    if (data.users[userId].messageCount % 25 === 0) {
      const roll = Math.random() * 100;
      let rewardMessage = '';
      
      // 60% chance for bronze crate
      if (roll < 60) {
        data.users[userId].bronzeCrates = (data.users[userId].bronzeCrates || 0) + 1;
        rewardMessage = `🎉 **Message Reward!** You got a <:emoji_5:1439554263461134356> **Bronze Crate**! Use \`!opencrate bronze\` to open it!`;
      }
      // 25% chance for silver crate
      else if (roll < 85) {
        data.users[userId].silverCrates = (data.users[userId].silverCrates || 0) + 1;
        rewardMessage = `🎉 **Message Reward!** You got a <:emoji_7:1439554348890853386> **Silver Crate**! Use \`!opencrate silver\` to open it!`;
      }
      // 10% chance for emerald crate
      else if (roll < 95) {
        data.users[userId].emeraldCrates = (data.users[userId].emeraldCrates || 0) + 1;
        rewardMessage = `🎉 **Message Reward!** You got a <:emoji_4:1439554205709766747> **Emerald Crate**! Use \`!opencrate emerald\` to open it!`;
      }
      // 5% chance for gold crate
      else {
        data.users[userId].goldCrates = (data.users[userId].goldCrates || 0) + 1;
        rewardMessage = `🎉 **Message Reward!** You got a <:emoji_2:1439429824862093445> **Gold Crate**! Use \`!opencrate gold\` to open it!`;
      }
      
      // CRITICAL: Use immediate save for crate rewards to ensure MongoDB persistence
      await saveDataImmediate(data);
      
      try {
        await message.reply(rewardMessage);
      } catch (error) {
        console.error('Error sending reward message:', error);
      }
    } else {
      saveData(data);
    }
  }
  
  if (hasActiveCollectibleSubmissionSession(userId)) {
    const handled = await handleCollectibleSubmissionStep(message);
    if (handled) return;
  }
  
  let commandContent = message.content;
  let usedMention = false;
  
  if (message.content.startsWith(`<@${client.user.id}>`) || message.content.startsWith(`<@!${client.user.id}>`)) {
    commandContent = message.content.replace(/<@!?\d+>\s*/, '');
    usedMention = true;
  } else if (!message.content.startsWith(PREFIX)) {
    return;
  } else {
    commandContent = message.content.slice(PREFIX.length);
  }
  
  const args = commandContent.trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  
  if (!command) return;
  
  const serverId = message.guild?.id;
  const isAdmin = isSuperAdmin(userId) || isBotAdmin(userId, serverId);
  
  antiCheatSystem.trackCommand(userId, command, true, { serverId });
  
  const rateCheck = antiCheatSystem.checkRateLimit(userId, command);
  if (!rateCheck.allowed) {
    antiCheatSystem.trackCommand(userId, command, false, { serverId, reason: 'rate_limited' });
    await message.reply(`⏱️ ${rateCheck.message}`);
    return;
  }
  
  if (serverId && moderationSystem.isUserBanned(serverId, userId)) {
    const banInfo = moderationSystem.getBanInfo(serverId, userId);
    await message.reply(`🔨 You are banned from using bot commands in this server.\n**Reason:** ${banInfo?.reason || 'No reason provided'}`);
    return;
  }
  
  if (serverId && moderationSystem.isUserMuted(serverId, userId)) {
    const muteInfo = moderationSystem.getMuteInfo(serverId, userId);
    const remainingMin = Math.ceil(muteInfo.remainingMs / 60000);
    await message.reply(`🔇 You are muted for ${remainingMin} more minute(s).\n**Reason:** ${muteInfo?.reason || 'No reason provided'}`);
    return;
  }
  
  const GAMEPLAY_COMMANDS = [
    'start', 'catch', 'battle', 'trade', 'drop', 'crate', 'opencrate', 
    'daily', 'work', 'balance', 'bal', 'profile', 'collection', 'shop',
    'buy', 'sell', 'gift', 'market', 'auction', 'quest', 'trivia',
    'leaderboard', 'lb', 'globalboard', 'clan', 'joinclan', 'leaveclan',
    'donate', 'charkeys', 'ck', 'keyunlock', 'convertkeys', 'lottery',
    'giveaway', 'items', 'inventory', 'cosmetics', 'skins', 'minigame'
  ];
  
  const SETUP_EXEMPT_COMMANDS = [
    'setup', 'setdropchannel', 'seteventschannel', 'setupdateschannel',
    'setgame', 'help', 'info', 'about', 'invite', 'support', 'ping',
    'setupstatus', 'hub', 'setemoji', 'setchestgif', 'creategame'
  ];
  
  if (serverId && !isMainServer(serverId) && GAMEPLAY_COMMANDS.includes(command)) {
    const characterCount = await characterManager.getServerCharacterCount(serverId);
    const setupStatusCheck = getSetupStatus(serverId);
    const channelsSet = setupStatusCheck.hasDropChannel && setupStatusCheck.hasEventsChannel && setupStatusCheck.hasUpdatesChannel;
    const hasEnoughChars = characterCount >= MINIMUM_CHARACTERS_REQUIRED;
    
    if (!hasEnoughChars || !channelsSet) {
      let missingItems = [];
      if (!hasEnoughChars) missingItems.push(`Add ${MINIMUM_CHARACTERS_REQUIRED - characterCount} more character(s) using \`!chars add <name>\` or \`!sc create\``);
      if (!setupStatusCheck.hasDropChannel) missingItems.push('Set drop channel using `!setdropchannel #channel`');
      if (!setupStatusCheck.hasEventsChannel) missingItems.push('Set events channel using `!seteventschannel #channel`');
      if (!setupStatusCheck.hasUpdatesChannel) missingItems.push('Set updates channel using `!ss updates #channel`');
      
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⚠️ Server Setup Required')
          .setDescription(`This server needs to complete setup before gameplay commands work.\n\n**Current Status:**\n🎭 Characters: **${characterCount}/${MINIMUM_CHARACTERS_REQUIRED}** ${hasEnoughChars ? '✅' : '❌'}\n📣 Channels: ${channelsSet ? '✅ All set' : '❌ Missing'}\n\n**To complete setup:**\n${missingItems.map(item => `• ${item}`).join('\n')}\n\nUse \`!setup\` to see full status.`)
          .setFooter({ text: 'Need help? Use !help or join our support server' })]
      });
      return;
    }
  }
  
  try {
    switch(command) {
      case 'setup':
        if (!serverId || isMainServer(serverId)) {
          await message.reply('❌ This command is only for non-main servers!');
          return;
        }
        
        if (!isSuperAdmin(userId) && !isZooAdmin(message.member)) {
          await message.reply('❌ Only users with the **ZooAdmin** role can run server setup!\n\nPlease create a role called "ZooAdmin" and assign it to server admins who should manage the bot.');
          return;
        }
        
        const setupStatusInfo = getSetupStatus(serverId);
        const characterCount = await characterManager.getServerCharacterCount(serverId);
        const channelsConfigured = setupStatusInfo.hasDropChannel && setupStatusInfo.hasEventsChannel && setupStatusInfo.hasUpdatesChannel;
        const hasEnoughChars = characterCount >= MINIMUM_CHARACTERS_REQUIRED;
        const setupIsComplete = channelsConfigured && hasEnoughChars;
        
        const setupEmbed = new EmbedBuilder()
          .setColor(setupIsComplete ? '#10B981' : '#F59E0B')
          .setTitle(setupIsComplete ? '✅ Server Setup Complete!' : '🛠️ Server Setup')
          .setDescription(setupIsComplete 
            ? `Your server is fully set up and ready to go!`
            : `Welcome! Let's set up ZooBot for your server.`)
          .addFields(
            { name: 'Characters', value: `${characterCount}/${MINIMUM_CHARACTERS_REQUIRED} ${hasEnoughChars ? '✅' : '❌'}`, inline: true },
            { name: 'Drop Channel', value: setupStatusInfo.hasDropChannel ? '✅ Set' : '❌ Not set', inline: true },
            { name: 'Events Channel', value: setupStatusInfo.hasEventsChannel ? '✅ Set' : '❌ Not set', inline: true },
            { name: 'Updates Channel', value: setupStatusInfo.hasUpdatesChannel ? '✅ Set' : '❌ Not set', inline: true }
          )
          .setThumbnail(message.guild?.iconURL({ dynamic: true }) || null);
        
        if (!setupIsComplete) {
          let todoList = '';
          if (!hasEnoughChars) {
            todoList += `\n• Add **${MINIMUM_CHARACTERS_REQUIRED - characterCount}** more character(s):\n  \`!chars\` - Browse & add from global directory\n  \`!sc create\` - Create a custom character`;
          }
          if (!setupStatusInfo.hasDropChannel) {
            todoList += `\n• \`!setdropchannel #channel\` - Set drop channel`;
          }
          if (!setupStatusInfo.hasEventsChannel) {
            todoList += `\n• \`!seteventschannel #channel\` - Set events channel`;
          }
          // Updates channel removed - only drop and events channels required
          setupEmbed.addFields({ name: 'To Complete Setup:', value: todoList, inline: false });
        }
        
        setupEmbed.setFooter({ text: setupIsComplete ? 'Your server is ready for gameplay!' : 'Complete the steps above to unlock gameplay' });
        
        await message.reply({ embeds: [setupEmbed] });
        break;
        
      case 'setdropchannel':
        if (!serverId || isMainServer(serverId)) {
          await message.reply('❌ This command is only for non-main servers!');
          return;
        }
        
        const dropChannel = message.mentions.channels.first() || message.channel;
        const dropResult = await setDropChannel(serverId, dropChannel.id, userId, message.member);
        
        await message.reply(dropResult.message);
        
        if (dropResult.success && dropResult.setupComplete) {
          startDropsForServer(serverId);
        }
        break;
        
      case 'seteventschannel':
        if (!serverId || isMainServer(serverId)) {
          await message.reply('❌ This command is only for non-main servers!');
          return;
        }
        
        const eventsChannel = message.mentions.channels.first() || message.channel;
        const eventsResult = await setEventsChannel(serverId, eventsChannel.id, userId, message.member);
        
        await message.reply(eventsResult.message);
        
        if (eventsResult.success && eventsResult.setupComplete) {
          startDropsForServer(serverId);
        }
        break;
        
      case 'addadmin':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const userToAdd = message.mentions.users.first();
        if (!userToAdd) {
          await message.reply('❌ Please mention a user! Usage: `!addadmin @user`');
          return;
        }
        
        const addResult = await addBotAdmin(serverId, userToAdd.id, userId);
        await message.reply(addResult.message);
        break;
        
      case 'removeadmin':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const userToRemove = message.mentions.users.first();
        if (!userToRemove) {
          await message.reply('❌ Please mention a user! Usage: `!removeadmin @user`');
          return;
        }
        
        const removeResult = await removeBotAdmin(serverId, userToRemove.id, userId);
        await message.reply(removeResult.message);
        break;
      
      case 'admins':
      case 'botadmins':
      case 'viewadmins':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const adminsInfo = getAllAdminsInfo(serverId);
        const superAdminsList = adminsInfo.superAdmins.map(id => `<@${id}>`).join('\n') || 'None';
        const globalBotAdminsList = adminsInfo.globalBotAdmins.map(id => `<@${id}>`).join('\n') || 'None';
        const serverAdminsList = adminsInfo.serverAdmins.map(id => `<@${id}>`).join('\n') || 'None';
        
        const adminsEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('👑 Bot Administration')
          .setDescription('Here are all the users who can manage ZooBot:')
          .addFields(
            { name: '👑 Super Admins', value: superAdminsList, inline: true },
            { name: '⚡ Global Bot Admins', value: globalBotAdminsList, inline: true },
            { name: '🛡️ Server Admins', value: serverAdminsList, inline: true }
          )
          .setFooter({ text: 'Use !hierarchy to see what each role can do' })
          .setTimestamp();
        
        await message.reply({ embeds: [adminsEmbed] });
        break;
      
      case 'hierarchy':
      case 'roles':
      case 'roleinfo':
        const hierarchyInfo = getHierarchyInfo();
        
        const hierarchyEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('📊 ZooBot Role Hierarchy')
          .setDescription('Understanding who can do what in ZooBot:')
          .setTimestamp();
        
        for (const role of hierarchyInfo) {
          hierarchyEmbed.addFields({
            name: `${role.emoji} ${role.name} (Level ${role.level})`,
            value: role.description,
            inline: false
          });
        }
        
        hierarchyEmbed.setFooter({ text: 'Use !myrole to see your current role' });
        
        await message.reply({ embeds: [hierarchyEmbed] });
        break;
      
      case 'myrole':
      case 'myrank':
        const myRole = getUserRole(userId, serverId, message.member);
        
        const myRoleEmbed = new EmbedBuilder()
          .setColor(myRole.color)
          .setTitle(`${myRole.emoji} Your Role: ${myRole.name}`)
          .setDescription(`You are a **Level ${myRole.level} ${myRole.name}** in ZooBot.`)
          .addFields({
            name: 'What you can do:',
            value: getHierarchyInfo().find(r => r.level === myRole.level)?.description || 'Play and enjoy ZooBot!',
            inline: false
          })
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        
        await message.reply({ embeds: [myRoleEmbed] });
        break;
      
      case 'addbotadmin':
      case 'addglobaladmin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only **Super Admins** can add global Bot Admins!');
          return;
        }
        
        const userToAddGlobal = message.mentions.users.first();
        if (!userToAddGlobal) {
          await message.reply('❌ Please mention a user! Usage: `!addbotadmin @user`');
          return;
        }
        
        const addGlobalResult = await addGlobalBotAdmin(userToAddGlobal.id, userId);
        await message.reply(addGlobalResult.message);
        break;
      
      case 'removebotadmin':
      case 'removeglobaladmin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only **Super Admins** can remove global Bot Admins!');
          return;
        }
        
        const userToRemoveGlobal = message.mentions.users.first();
        if (!userToRemoveGlobal) {
          await message.reply('❌ Please mention a user! Usage: `!removebotadmin @user`');
          return;
        }
        
        const removeGlobalResult = await removeGlobalBotAdmin(userToRemoveGlobal.id, userId);
        await message.reply(removeGlobalResult.message);
        break;
      
      case 'addserveradmin':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const userToAddServer = message.mentions.users.first();
        if (!userToAddServer) {
          await message.reply('❌ Please mention a user! Usage: `!addserveradmin @user`');
          return;
        }
        
        const addServerResult = await addServerAdmin(serverId, userToAddServer.id, userId, message.member);
        await message.reply(addServerResult.message);
        break;
      
      case 'removeserveradmin':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const userToRemoveServer = message.mentions.users.first();
        if (!userToRemoveServer) {
          await message.reply('❌ Please mention a user! Usage: `!removeserveradmin @user`');
          return;
        }
        
        const removeServerResult = await removeServerAdmin(serverId, userToRemoveServer.id, userId, message.member);
        await message.reply(removeServerResult.message);
        break;
      
      case 'settings':
      case 'serversettings':
      case 'botsettings':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const featureSettings = getFeatureSettings(serverId);
        
        const settingsEmbed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('⚙️ Server Settings')
          .setDescription('Current feature settings for this server:')
          .addFields(
            { 
              name: '🔔 Ping Settings', 
              value: `Drops: ${featureSettings.pingOnDrops ? '✅' : '❌'}\nEvents: ${featureSettings.pingOnEvents ? '✅' : '❌'}\nGiveaways: ${featureSettings.pingOnGiveaways ? '✅' : '❌'}\nLottery: ${featureSettings.pingOnLottery ? '✅' : '❌'}\nUpdates: ${featureSettings.pingOnUpdates ? '✅' : '❌'}`,
              inline: true 
            },
            { 
              name: '🎮 Game Features', 
              value: `Drops: ${featureSettings.dropsEnabled ? '✅' : '❌'}\nEvents: ${featureSettings.eventsEnabled ? '✅' : '❌'}\nBattles: ${featureSettings.battlesEnabled ? '✅' : '❌'}\nMinigames: ${featureSettings.minigamesEnabled ? '✅' : '❌'}\nTrivia: ${featureSettings.triviaEnabled ? '✅' : '❌'}`,
              inline: true 
            },
            { 
              name: '💰 Economy Features', 
              value: `Trading: ${featureSettings.tradingEnabled ? '✅' : '❌'}\nMarket: ${featureSettings.marketEnabled ? '✅' : '❌'}\nGiveaways: ${featureSettings.giveawaysEnabled ? '✅' : '❌'}\nLottery: ${featureSettings.lotteryEnabled ? '✅' : '❌'}\nWork: ${featureSettings.workSystemEnabled ? '✅' : '❌'}`,
              inline: true 
            },
            {
              name: '🛡️ Moderation',
              value: `Profanity Filter: ${featureSettings.profanityFilter ? '✅' : '❌'}\nAuto-Mod: ${featureSettings.autoModEnabled ? '✅' : '❌'}\nMax Warnings: ${featureSettings.maxWarningsBeforeBan}`,
              inline: true
            },
            {
              name: '🎓 New Player',
              value: `Welcome Messages: ${featureSettings.welcomeNewPlayers ? '✅' : '❌'}\nTutorial Hints: ${featureSettings.showTutorialHints ? '✅' : '❌'}`,
              inline: true
            }
          )
          .setFooter({ text: 'Use !toggle <feature> to change settings | Server Owner/Admins only' })
          .setTimestamp();
        
        await message.reply({ embeds: [settingsEmbed] });
        break;
      
      case 'toggle':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!canToggleFeatures(userId, serverId, message.member)) {
          await message.reply('❌ Only **Server Owners** or **Server Admins** can toggle features!');
          return;
        }
        
        const featureToToggle = args[0]?.toLowerCase();
        if (!featureToToggle) {
          const toggleHelpEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('⚙️ Feature Toggle Help')
            .setDescription('Toggle features on or off for your server.')
            .addFields(
              { 
                name: '🔔 Ping Settings', 
                value: '`!toggle pingdrops` - Ping on drops\n`!toggle pingevents` - Ping on events\n`!toggle pinggiveaways` - Ping on giveaways\n`!toggle pinglottery` - Ping on lottery\n`!toggle pingupdates` - Ping on updates',
                inline: false 
              },
              { 
                name: '🎮 Game Features', 
                value: '`!toggle drops` - Character drops\n`!toggle events` - Events system\n`!toggle battles` - Battle system\n`!toggle minigames` - Minigames\n`!toggle trivia` - Trivia',
                inline: false 
              },
              { 
                name: '💰 Economy Features', 
                value: '`!toggle trading` - Player trading\n`!toggle market` - Marketplace\n`!toggle giveaways` - Giveaways\n`!toggle lottery` - Lottery\n`!toggle work` - Work system',
                inline: false 
              },
              {
                name: '🛡️ Moderation',
                value: '`!toggle profanity` - Profanity filter\n`!toggle automod` - Auto moderation\n`!toggle welcome` - Welcome messages\n`!toggle hints` - Tutorial hints',
                inline: false
              }
            )
            .setFooter({ text: 'Example: !toggle drops to toggle the drops feature' });
          
          await message.reply({ embeds: [toggleHelpEmbed] });
          return;
        }
        
        const featureMap = {
          'pingdrops': 'pingOnDrops',
          'pingevents': 'pingOnEvents',
          'pinggiveaways': 'pingOnGiveaways',
          'pinglottery': 'pingOnLottery',
          'pingupdates': 'pingOnUpdates',
          'drops': 'dropsEnabled',
          'events': 'eventsEnabled',
          'giveaways': 'giveawaysEnabled',
          'lottery': 'lotteryEnabled',
          'trading': 'tradingEnabled',
          'market': 'marketEnabled',
          'battles': 'battlesEnabled',
          'minigames': 'minigamesEnabled',
          'trivia': 'triviaEnabled',
          'clans': 'clanSystemEnabled',
          'leaderboards': 'leaderboardsEnabled',
          'work': 'workSystemEnabled',
          'quests': 'questsEnabled',
          'daily': 'dailyRewardsEnabled',
          'profanity': 'profanityFilter',
          'automod': 'autoModEnabled',
          'welcome': 'welcomeNewPlayers',
          'hints': 'showTutorialHints'
        };
        
        const actualFeatureName = featureMap[featureToToggle];
        if (!actualFeatureName) {
          await message.reply(`❌ Unknown feature: \`${featureToToggle}\`. Use \`!toggle\` to see available features.`);
          return;
        }
        
        const currentSettings = getFeatureSettings(serverId);
        const newValue = !currentSettings[actualFeatureName];
        
        const toggleResult = await updateFeatureSetting(serverId, actualFeatureName, newValue, userId, message.member);
        
        if (toggleResult.success) {
          await message.reply(`${newValue ? '✅' : '❌'} **${featureToToggle}** has been ${newValue ? 'enabled' : 'disabled'}!`);
        } else {
          await message.reply(toggleResult.message);
        }
        break;
      
      case 'setpingrole':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!canToggleFeatures(userId, serverId, message.member)) {
          await message.reply('❌ Only **Server Owners** or **Server Admins** can set ping roles!');
          return;
        }
        
        const pingType = args[0]?.toLowerCase();
        const mentionedRole = message.mentions.roles.first();
        const roleArg = args[1]?.toLowerCase();
        
        if (!pingType) {
          const pingRoleHelp = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🔔 Set Ping Role')
            .setDescription('Set which role gets pinged for different events.')
            .addFields(
              { 
                name: 'Usage', 
                value: '`!setpingrole <type> @role` - Set role to ping\n`!setpingrole <type> everyone` - Ping everyone\n`!setpingrole <type> here` - Ping here\n`!setpingrole <type> none` - Disable pings',
                inline: false 
              },
              { 
                name: 'Types', 
                value: '`drops` - Character drops\n`events` - Events\n`giveaways` - Giveaways\n`lottery` - Lottery\n`updates` - Bot updates',
                inline: false 
              }
            )
            .setFooter({ text: 'Example: !setpingrole giveaways @Members' });
          
          await message.reply({ embeds: [pingRoleHelp] });
          return;
        }
        
        const pingRoleMap = {
          'drops': ['dropPingRole', 'pingOnDrops'],
          'events': ['eventPingRole', 'pingOnEvents'],
          'giveaways': ['giveawayPingRole', 'pingOnGiveaways'],
          'lottery': ['lotteryPingRole', 'pingOnLottery'],
          'updates': ['updatePingRole', 'pingOnUpdates']
        };
        
        if (!pingRoleMap[pingType]) {
          await message.reply('❌ Invalid ping type! Use: drops, events, giveaways, lottery, or updates');
          return;
        }
        
        const [roleSettingName, enableSettingName] = pingRoleMap[pingType];
        let roleValue = null;
        let enablePing = true;
        
        if (mentionedRole) {
          roleValue = mentionedRole.id;
        } else if (roleArg === 'everyone') {
          roleValue = 'everyone';
        } else if (roleArg === 'here') {
          roleValue = 'here';
        } else if (roleArg === 'none' || roleArg === 'disable' || roleArg === 'off') {
          roleValue = null;
          enablePing = false;
        } else {
          await message.reply('❌ Please mention a role, or use `everyone`, `here`, or `none`');
          return;
        }
        
        const features = {};
        features[roleSettingName] = roleValue;
        features[enableSettingName] = enablePing;
        
        const pingRoleResult = await updateMultipleFeatures(serverId, features, userId, message.member);
        
        if (pingRoleResult.success) {
          if (enablePing) {
            const roleDisplay = mentionedRole ? `<@&${mentionedRole.id}>` : (roleValue === 'everyone' ? '@everyone' : '@here');
            await message.reply(`✅ **${pingType}** pings will now mention ${roleDisplay}!`);
          } else {
            await message.reply(`✅ **${pingType}** pings have been disabled.`);
          }
        } else {
          await message.reply(pingRoleResult.message);
        }
        break;
      
      case 'setzoorole':
      case 'setzooadminrole':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!canSetupServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **Server Owners** or **Server Admins** can set the ZooAdmin role!');
          return;
        }
        
        const zooRoleName = args.join(' ');
        if (!zooRoleName) {
          await message.reply('❌ Please provide a role name! Usage: `!setzoorole <role name>`\nExample: `!setzoorole Bot Managers`');
          return;
        }
        
        const zooRoleResult = await setZooAdminRole(serverId, zooRoleName, userId, message.member);
        await message.reply(zooRoleResult.message);
        break;
        
      case 'setupdateschannel':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const updatesChannel = message.mentions.channels.first() || message.channel;
        const updatesResult = await setUpdatesChannel(serverId, updatesChannel.id, userId, message.member);
        
        await message.reply(updatesResult.message);
        break;
        
      case 'postupdate':
      case 'botupdate':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const updateMessage = args.join(' ');
        if (!updateMessage) {
          await message.reply('Usage: `!postupdate <message>`\n\nThis will post the update to all configured server update channels.');
          return;
        }
        
        const updateEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle('🔔 Bot Update')
          .setDescription(updateMessage)
          .setTimestamp()
          .setFooter({ text: 'ZooBot Official Update' });
        
        let successCount = 0;
        let failCount = 0;
        
        for (const guild of client.guilds.cache.values()) {
          try {
            const channelId = getUpdatesChannel(guild.id);
            if (channelId) {
              const channel = await guild.channels.fetch(channelId).catch(() => null);
              if (channel) {
                await channel.send({ embeds: [updateEmbed] });
                successCount++;
              } else {
                failCount++;
              }
            }
          } catch (error) {
            failCount++;
            console.error(`Failed to post update to ${guild.name}:`, error.message);
          }
        }
        
        await message.reply(`✅ Update posted!\n📤 Sent to ${successCount} servers\n❌ Failed: ${failCount}`);
        break;
      
      case 'setemoji':
        if (serverId && !isZooAdmin(message.member) && !isSuperAdmin(userId)) {
          await message.reply('❌ Only users with the **ZooAdmin** role can set custom character emojis!');
          return;
        }
        
        if (!serverId && !isSuperAdmin(userId)) {
          await message.reply('❌ This command can only be used by super admins in DMs!');
          return;
        }
        
        const emojiCharName = args[0];
        const emojiInput = args[1];
        
        if (!emojiCharName || !emojiInput) {
          await message.reply('Usage: `!setemoji <character name> <emoji ID or unicode>`\n\nExample: `!setemoji Nix 1234567890` (for custom Discord emoji)\nExample: `!setemoji Nix 🦊` (for unicode emoji)');
          return;
        }
        
        const setEmojiResult = await setCharacterEmoji(emojiCharName, emojiInput);
        
        if (setEmojiResult.success) {
          await refreshAllCharacterEmojis(data.users);
          await saveDataImmediate(data);
        }
        
        await message.reply(setEmojiResult.message);
        break;
      
      case 'setchestgif':
      case 'setcrategif':
        if (serverId && !isZooAdmin(message.member) && !isSuperAdmin(userId)) {
          await message.reply('❌ Only users with the **ZooAdmin** role can customize chest GIFs!');
          return;
        }
        
        if (!serverId && !isSuperAdmin(userId)) {
          await message.reply('❌ This command can only be used by super admins in DMs!');
          return;
        }
        
        const chestType = args[0]?.toLowerCase();
        const gifUrl = args[1];
        
        if (!chestType || !gifUrl) {
          await message.reply('Usage: `!setchestgif <chest type> <gif URL>`\n\nAvailable types: bronze, silver, gold, emerald, legendary, tyrant\n\nExample: `!setchestgif gold https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.gif`');
          return;
        }
        
        const setGifResult = await setChestGif(chestType, gifUrl, userId);
        await message.reply(setGifResult.message);
        break;
        
      case 'delete':
      case 'deleteuser':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const userToDelete = message.mentions.users.first();
        if (!userToDelete) {
          await message.reply('❌ Please mention a user to delete! Usage: `!delete @user`');
          return;
        }
        
        const userIdToDelete = userToDelete.id;
        
        if (!data.users[userIdToDelete]) {
          await message.reply('❌ This user has no account in the bot!');
          return;
        }
        
        const deletedUsername = data.users[userIdToDelete].username || userToDelete.username;
        
        delete data.users[userIdToDelete];
        
        await deleteUser(userIdToDelete);
        
        await saveDataImmediate(data);
        
        const deleteEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🗑️ User Account Deleted')
          .setDescription(`Successfully deleted **${deletedUsername}**'s account from the database.\n\nAll their data (characters, coins, gems, shards, crates, etc.) has been permanently removed.`)
          .setFooter({ text: `Deleted by ${message.author.username}` });
        
        await message.reply({ embeds: [deleteEmbed] });
        console.log(`🗑️ Admin ${message.author.username} deleted user account: ${deletedUsername} (${userIdToDelete})`);
        break;
        
      case 'joinclan':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const joinResult = joinClan(data, userId, serverId);
        await message.reply(joinResult.message);
        
        if (joinResult.success) {
          await saveDataImmediate(data);
        }
        break;
        
      case 'leaveclan':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const leaveResult = leaveClan(data, userId);
        await message.reply(leaveResult.message);
        
        if (leaveResult.success) {
          await saveDataImmediate(data);
        }
        break;
        
      case 'donate':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const donationType = args[0]?.toLowerCase();
        const donationAmount = parseInt(args[1]);
        
        if (!donationType || !donationAmount) {
          await message.reply('❌ Usage: `!donate <coins/gems/trophies> <amount>`\nExample: `!donate coins 100`');
          return;
        }
        
        if (isNaN(donationAmount) || donationAmount <= 0) {
          await message.reply('❌ Amount must be a positive number!');
          return;
        }
        
        const donateResult = donateToClan(data, userId, serverId, donationType, donationAmount);
        await message.reply(donateResult.message);
        
        if (donateResult.success) {
          await saveDataImmediate(data);
        }
        break;
        
      case 'clan':
      case 'clanprofile':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const clan = getClan(data, serverId);
        const clanProfileEmbed = await formatClanProfile(clan, message.guild.name, data, serverId);
        await message.reply({ embeds: [clanProfileEmbed] });
        break;
        
      case 'clans':
      case 'clanleaderboard':
        const leaderboard = getClanLeaderboard(data);
        const leaderboardEmbed = await formatClanLeaderboard(leaderboard, client, data);
        await message.reply({ embeds: [leaderboardEmbed] });
        break;
        
      case 'start':
        if (data.users[userId].selectedCharacter === null) {
          const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎮 Choose Your Starter Character!')
            .setDescription('Welcome! Select one of these starter characters:\n\n🦊 **Nix** - The cunning fox\n🦍 **Bruce** - The mighty gorilla\n🐂 **Buck** - The strong bull\n\nUse: `!select nix`, `!select bruce`, or `!select buck`');
          await message.reply({ embeds: [embed] });
        } else {
          await message.reply(`You already have **${data.users[userId].selectedCharacter}** as your character!`);
        }
        break;
        
      case 'select':
        if (data.users[userId].selectedCharacter !== null) {
          await message.reply('You already selected a starter character!');
          return;
        }
        
        const starterChoice = args[0]?.toLowerCase();
        const validStarters = ['nix', 'bruce', 'buck'];
        
        if (!validStarters.includes(starterChoice)) {
          await message.reply('Please choose: `nix`, `bruce`, or `buck`');
          return;
        }
        
        const starterChar = characterManager.getCharacterByName(starterChoice);
        const starterST = generateST();
        
        const pendingTokens = data.users[userId].pendingTokens || 0;
        
        const starterMoves = assignMovesToCharacter(starterChar.name, starterST);
        const starterHP = calculateBaseHP(starterST);
        
        data.users[userId].selectedCharacter = starterChar.name;
        data.users[userId].started = true;
        data.users[userId].characters.push({
          name: starterChar.name,
          emoji: starterChar.emoji,
          level: 1,
          tokens: pendingTokens,
          st: starterST,
          moves: starterMoves,
          baseHp: starterHP,
          currentSkin: 'default',
          ownedSkins: ['default']
        });
        data.users[userId].coins = 100;
        data.users[userId].gems = 10;
        data.users[userId].pendingTokens = 0;
        
        // Track invite completion for personalized tasks
        const ptData = initializePersonalizedTaskData(data.users[userId]);
        if (ptData.invitedBy) {
          const inviterCompleted = trackInviteCompletion(ptData.invitedBy, userId, data);
          if (inviterCompleted) {
            // Check if inviter has active invite task
            const inviterPTData = initializePersonalizedTaskData(data.users[ptData.invitedBy]);
            if (inviterPTData.taskProgress.invitesCompleted !== undefined) {
              const completedTask = checkTaskProgress(data.users[ptData.invitedBy], 'invitesCompleted', 1);
              if (completedTask) {
                await completePersonalizedTask(client, ptData.invitedBy, data, completedTask);
              }
            }
          }
        }
        await saveDataImmediate(data);
        
        let embedDesc = `You chose **${starterChar.name} ${starterChar.emoji}**!\n\n**ST:** ${starterST}%\n\nStarting rewards:\n💰 100 Coins\n💎 10 Gems`;
        
        if (pendingTokens > 0) {
          embedDesc += `\n🎫 ${pendingTokens} Pending Tokens received!`;
        }
        
        embedDesc += `\n\nUse \`!profile\` to view your stats!`;
        
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 Character Selected!')
          .setDescription(embedDesc);
        await message.reply({ embeds: [embed] });
        
        // Send welcome guide DM to new player
        try {
          const dmChannel = await message.author.createDM();
          const welcomeGuide = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('📖 Welcome to the Zoo!')
            .setDescription('**Your adventure starts now! Here\'s what to do:**\n\n' +
              '**💰 Earn Money:**\n' +
              '`!work` - Work every 15 min for coins, gems, and resources. Start with caretaker!\n' +
              '`!drop` - Hunt for random drops in chat (tokens, coins, gems every 20 sec)\n' +
              '`!msg` - Earn coins by chatting with friends\n\n' +
              '**🎫 Collect Characters:**\n' +
              '`!c <name>` - See any character\'s stats & moves\n' +
              '`!crate` - Open crates to unlock new characters (use coins or gems)\n' +
              '`!inventory` - Check what you own\n\n' +
              '**⚔️ Battle & Compete:**\n' +
              '`!b @user` - Challenge someone to turn-based combat\n' +
              '`!b ai` - Fight the AI (try easy/normal/hard mode)\n' +
              '`!event` - Join daily events for extra rewards\n\n' +
              '**💳 Trade & Shop:**\n' +
              '`!market` - Buy/sell items from other players\n' +
              '`!ustshop` - Spend UST earned from clan wars on skins\n' +
              '`!setskin <char> <name>` - Customize your character\n\n' +
              '**Pro Tips:** Grind work → collect strong characters → dominate battles → flex cosmetics! 🔥\n\n' +
              'Questions? Use `!help` for full command list!')
            .setFooter({ text: 'Check your DMs anytime for this guide!' });
          
          await dmChannel.send({ embeds: [welcomeGuide] });
        } catch (err) {
          console.log('Could not send DM to new player:', err.message);
        }
        break;
        
      case 'profile':
        const targetUser = message.mentions.users.first() || message.author;
        const targetId = targetUser.id;
        
        if (!data.users[targetId]) {
          await message.reply('This user hasn\'t started yet!');
          return;
        }
        
        // Track profile view for season daily task (only for own profile)
        if (targetId === userId && data.users[userId].started) {
          updateTaskProgress(data.users[userId], 'profileViewed', 1);
        }
        
        const user = data.users[targetId];
        let page = parseInt(args[0]) || 1;
        const charsPerPage = 5;
        const totalPages = Math.ceil(user.characters.length / charsPerPage);
        
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        
        const startIdx = (page - 1) * charsPerPage;
        const endIdx = startIdx + charsPerPage;
        const pageChars = user.characters.slice(startIdx, endIdx);
        
        const profileEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`${targetUser.username}'s Profile`)
          .addFields(
            { name: '<a:emoji_11:1441041389281611846> Coins', value: `${user.coins}`, inline: true },
            { name: '💎 Gems', value: `${user.gems}`, inline: true },
            { name: '🏆 Trophies', value: `${user.trophies || 200}`, inline: true },
            { name: '🎮 Characters', value: `${user.characters.length}/51`, inline: true },
            { name: '💬 Messages', value: `${user.messageCount || 0}`, inline: true },
            { name: '🔥 Daily Streak', value: formatStreakDisplay(user), inline: true },
            { name: '🏅 Badges', value: formatAchievementBadges(user), inline: true }
          );
        
        if (user.selectedCharacter) {
          profileEmbed.addFields({ name: '⭐ Selected', value: user.selectedCharacter, inline: true });
        }
        
        const userClanData = getUserClan(data, targetId);
        if (userClanData) {
          const clanGuild = client.guilds.cache.get(userClanData.serverId);
          const clanName = clanGuild ? clanGuild.name : 'Unknown Clan';
          profileEmbed.addFields({ name: '🏰 Clan', value: clanName, inline: true });
        }
        
        const equippedPfp = getEquippedPfp(targetId, data);
        
        if (equippedPfp) {
          profileEmbed.setThumbnail(equippedPfp.url);
          profileEmbed.addFields({ name: '📸 Profile Image', value: equippedPfp.name, inline: true });
        } else {
          let displayCharName = user.profileDisplayCharacter || user.selectedCharacter;
          if (displayCharName) {
            let displayChar = user.characters.find(c => c.name === displayCharName);
            
            if (!displayChar && user.profileDisplayCharacter) {
              user.profileDisplayCharacter = null;
              await saveDataImmediate(data);
              displayCharName = user.selectedCharacter;
              displayChar = user.characters.find(c => c.name === displayCharName);
            }
            
            if (displayChar) {
              const displaySkinUrl = await getSkinUrl(displayChar.name, displayChar.currentSkin || 'default');
              profileEmbed.setThumbnail(displaySkinUrl);
              if (user.profileDisplayCharacter && user.profileDisplayCharacter !== user.selectedCharacter) {
                profileEmbed.addFields({ name: '🖼️ Profile Picture', value: displayCharName, inline: true });
              }
            }
          }
        }
        
        if (user.pendingTokens > 0) {
          profileEmbed.addFields({ name: '🎫 Pending Tokens', value: `${user.pendingTokens}`, inline: true });
        }
        
        if (user.characters.length > 0) {
          pageChars.forEach(char => {
            const req = getLevelRequirements(char.level);
            const progress = createLevelProgressBar(char.tokens, req.tokens);
            profileEmbed.addFields({
              name: `${char.emoji} ${char.name} - Lvl ${char.level} | ST: ${char.st}%`,
              value: `Tokens: ${char.tokens}/${req.tokens} | Coins: ${req.coins}\n${progress}`,
              inline: false
            });
          });
          
          if (totalPages > 1) {
            profileEmbed.setFooter({ text: `Page ${page}/${totalPages} | Use !profile [page]` });
          }
        } else {
          profileEmbed.setDescription('No characters yet! Use `!start` to begin.');
        }
        
        await message.reply({ embeds: [profileEmbed] });
        break;
        
      case 'addpfp':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const pfpName = args.join(' ');
        if (!pfpName) {
          await message.reply('❌ Please provide a name for your profile image!\nUsage: `!addpfp <name>` (attach an image)');
          return;
        }
        
        const uploadResult = await uploadPfpFromAttachment(message, pfpName, userId, data);
        await message.reply(uploadResult.message);
        break;
        
      case 'pfps':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const pfpsList = listAllPfps(userId, data);
        
        if (pfpsList.count === 0) {
          await message.reply('📸 You don\'t have any profile images yet!\n\nUpload one using: `!addpfp <name>` (attach an image)');
          return;
        }
        
        const pfpsEmbed = new EmbedBuilder()
          .setColor('#FF69B4')
          .setTitle('📸 Your Profile Images')
          .setDescription(`You have **${pfpsList.count}** profile image(s)`);
        
        pfpsList.pfps.forEach((pfp, index) => {
          const isEquipped = pfp.id === pfpsList.equipped ? ' ✅ (Equipped)' : '';
          pfpsEmbed.addFields({
            name: `${index + 1}. ${pfp.name}${isEquipped}`,
            value: `Use: \`!equippfp ${pfp.name}\``,
            inline: false
          });
        });
        
        pfpsEmbed.setFooter({ text: 'Use !equippfp <name> to equip | !unequippfp to remove' });
        
        await message.reply({ embeds: [pfpsEmbed] });
        break;
        
      case 'equippfp':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const pfpToEquip = args.join(' ');
        if (!pfpToEquip) {
          await message.reply('❌ Please provide a PFP name to equip!\nUsage: `!equippfp <name>`\n\nUse `!pfps` to see your profile images.');
          return;
        }
        
        let equipResult = await equipPfpByName(userId, pfpToEquip, data);
        if (!equipResult.success && pfpToEquip.startsWith('pfp_')) {
          equipResult = await equipPfp(userId, pfpToEquip, data);
        }
        await message.reply(equipResult.message);
        break;
        
      case 'unequippfp':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const unequipResult = await equipPfp(userId, null, data);
        await message.reply(unequipResult.message);
        break;
        
      case 'myprofile':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const myPfpsList = listAllPfps(userId, data);
        
        if (myPfpsList.count === 0) {
          await message.reply('📸 You don\'t have any profile images yet!\n\nAsk a bot admin to grant you one!');
          return;
        }
        
        const myPfpsEmbed = new EmbedBuilder()
          .setColor('#FF69B4')
          .setTitle('📸 Your Profile Images')
          .setDescription(`You have **${myPfpsList.count}** profile image(s)`);
        
        myPfpsList.pfps.forEach((pfp, index) => {
          const isEquipped = pfp.id === myPfpsList.equipped ? ' ✅ (Equipped)' : '';
          myPfpsEmbed.addFields({
            name: `${pfp.name}${isEquipped}`,
            value: `Use: \`!setpfp ${pfp.name}\` to equip`,
            inline: false
          });
        });
        
        myPfpsEmbed.setFooter({ text: 'Use !setpfp <name> to equip a profile image' });
        
        await message.reply({ embeds: [myPfpsEmbed] });
        break;
        
      case 'uploadpfp':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const pfpNameArgs = args.slice(0, -1).join(' ');
        const pfpRarity = args[args.length - 1]?.toLowerCase();
        const pfpCustomCost = args[args.length - 2] && !isNaN(parseInt(args[args.length - 2])) ? parseInt(args[args.length - 2]) : null;
        
        const actualPfpName = pfpCustomCost !== null ? args.slice(0, -2).join(' ') : pfpNameArgs;
        const actualRarity = pfpCustomCost !== null ? args[args.length - 2] : pfpRarity;
        
        if (!actualPfpName || !actualRarity) {
          await message.reply('**Upload Profile Picture to UST Shop**\n\nUsage: `!uploadpfp <name> <rarity> [custom_cost]` with an attached image\n\n**Rarities:** common, rare, ultra rare, epic, legendary\n**Default Costs:** common (10), rare (25), ultra rare (50), epic (100), legendary (200)\n\n**Examples:**\n`!uploadpfp Cool Sunglasses rare` (uses default 25 UST)\n`!uploadpfp Cool Sunglasses rare 30` (custom 30 UST)\n`!uploadpfp Diamond Crown legendary 250` (custom 250 UST)\n\nAttach the profile picture image to your message!');
          return;
        }
        
        const validPfpRarities = ['common', 'rare', 'ultra rare', 'epic', 'legendary'];
        if (!validPfpRarities.includes(actualRarity.toLowerCase())) {
          await message.reply('❌ Invalid rarity! Use: common, rare, ultra rare, epic, or legendary');
          return;
        }
        
        if (message.attachments.size === 0) {
          await message.reply('❌ Please attach an image to your message!');
          return;
        }
        
        const pfpAttachment = message.attachments.first();
        
        if (!pfpAttachment.contentType || !pfpAttachment.contentType.startsWith('image/')) {
          await message.reply('❌ Please attach a valid image file (PNG, JPG, GIF, etc.)!');
          return;
        }
        
        const pfpImageUrl = pfpAttachment.url;
        
        const { addPfpToCatalog, RARITY_EMOJIS: PFP_RARITY_EMOJIS } = require('./cosmeticsShopSystem.js');
        const addPfpResult = await addPfpToCatalog(actualPfpName, actualRarity, pfpImageUrl, pfpCustomCost);
        
        if (addPfpResult.success) {
          const uploadPfpEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`✅ Profile Picture Added to UST Shop!`)
            .setDescription(`${addPfpResult.message}\n\nThis profile picture is now available in the UST shop for all players!`)
            .addFields(
              { name: 'PFP Name', value: actualPfpName, inline: true },
              { name: 'Rarity', value: `${PFP_RARITY_EMOJIS[actualRarity.toLowerCase()]} ${actualRarity}`, inline: true }
            )
            .setThumbnail(pfpImageUrl)
            .setFooter({ text: 'Players can purchase this in !ustshop' });
          
          await message.reply({ embeds: [uploadPfpEmbed] });
        } else {
          await message.reply(addPfpResult.message);
        }
        break;
        
      case 'grantpfp':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can grant PFPs!');
          return;
        }
        
        const targetUserForPfpGrant = message.mentions.users.first();
        if (!targetUserForPfpGrant) {
          await message.reply('❌ Please mention a user!\nUsage: `!grantpfp <pfp name> @user`\nExample: `!grantpfp Winner Badge @user`');
          return;
        }
        
        const pfpNameToGrant = args.filter(arg => !arg.startsWith('<@')).join(' ');
        if (!pfpNameToGrant) {
          await message.reply('❌ Please provide the PFP name!\nUsage: `!grantpfp <pfp name> @user`');
          return;
        }
        
        if (!data.users[targetUserForPfpGrant.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const grantResult = await grantPfpToUser(pfpNameToGrant, targetUserForPfpGrant.id, data);
        await message.reply(grantResult.message);
        break;
        
      case 'grantpfptoclan':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can grant PFPs to clans!');
          return;
        }
        
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const clanPfpName = args.join(' ');
        if (!clanPfpName) {
          await message.reply('❌ Please provide the PFP name!\nUsage: `!grantpfptoclan <pfp name>`\nExample: `!grantpfptoclan Clan Winner`');
          return;
        }
        
        const grantClanResult = await grantPfpToClan(clanPfpName, serverId, data);
        await message.reply(grantClanResult.message);
        break;
        
      case 'listpfps':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can view the PFP registry!');
          return;
        }
        
        const registryList = listRegistryPfps(data);
        
        if (registryList.length === 0) {
          await message.reply('📝 No PFPs in registry yet! Use `!uploadpfp <name>` (with image) to add some.');
          return;
        }
        
        const registryEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('📚 PFP Registry')
          .setDescription(`Total: **${registryList.length}** PFP(s)`);
        
        registryList.forEach((pfp, index) => {
          registryEmbed.addFields({
            name: `${index + 1}. ${pfp.name}`,
            value: `Use: \`!grantpfp ${pfp.name} @user\``,
            inline: false
          });
        });
        
        registryEmbed.setFooter({ text: 'Use !grantpfp <name> @user to grant a PFP' });
        
        await message.reply({ embeds: [registryEmbed] });
        break;
        
      case 'trivia':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        clearExpiredSessions(data);
        
        const triviaStartResult = startTriviaSession(userId, data);
        
        if (!triviaStartResult.success) {
          await message.reply(triviaStartResult.message);
          return;
        }
        
        await saveDataImmediate(data);
        
        const triviaEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎯 Character Trivia!')
          .setDescription(`**Guess the character from this image!**\n\n⏰ You have **${triviaStartResult.timeLimit} seconds** to answer!\n🎲 You get **${triviaStartResult.guessesLeft} guesses**\n💰 Correct answer = **100 coins**\n\nAnswer using: \`!a <character name>\`\nExample: \`!a water jade\``)
          .setImage(triviaStartResult.imageUrl)
          .setFooter({ text: 'Case insensitive | Good luck!' })
          .setTimestamp();
        
        await message.reply({ embeds: [triviaEmbed] });
        break;
        
      case 'a':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const triviaAnswer = args.join(' ');
        
        if (!triviaAnswer) {
          await message.reply('❌ Please provide an answer!\nUsage: `!a <your answer>`');
          return;
        }
        
        clearExpiredSessions(data);
        
        const answerResult = answerTrivia(userId, triviaAnswer, data);
        
        if (answerResult.correct) {
          await saveDataImmediate(data);
          const correctEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Correct Answer!')
            .setDescription(answerResult.message)
            .setTimestamp();
          
          await message.reply({ embeds: [correctEmbed] });
        } else {
          await saveDataImmediate(data);
          await message.reply(answerResult.message);
        }
        break;
        
      case 'q':
        const qKeyword = args[0]?.toLowerCase();
        let targetMessage = message;
        
        // Check if this is a reply to another message
        if (message.reference) {
          try {
            targetMessage = await message.channel.messages.fetch(message.reference.messageId);
          } catch (error) {
            console.error('Error fetching referenced message:', error);
            // Fall back to original message if fetch fails
            targetMessage = message;
          }
        }
        
        if (!qKeyword) {
          const allQA = await getAllQA(data);
          if (allQA.length === 0) {
            await targetMessage.reply('❓ No Q&A entries available!\n\nBot admins can add entries with `!qadd keyword | message`');
            return;
          }
          const qaEmbed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📚 Available Q&A Topics')
            .setDescription(allQA.map((qa, i) => `${i + 1}. \`${qa.keyword}\``).join('\n'))
            .setFooter({ text: `Use !q <keyword> to get answer | Total: ${allQA.length}` });
          await targetMessage.reply({ embeds: [qaEmbed] });
          return;
        }
        const entry = await getQAEntry(data, qKeyword);
        if (!entry) {
          await targetMessage.reply(`❌ Q&A entry for **${qKeyword}** not found!\n\nUse \`!q\` to see all topics.`);
          return;
        }
        await targetMessage.reply({ embeds: [formatQAEmbed(entry)] });
        break;
        
      case 'qadd':
        if (!isAdmin) {
          await message.reply('❌ Only bot admins can add Q&A entries!');
          return;
        }
        const addContent = message.content.slice(PREFIX.length + 4).trim();
        const [addKeyword, ...addMsgParts] = addContent.split('|');
        const addMsg = addMsgParts.join('|').trim();
        const result1 = await addQAEntry(data, addKeyword?.trim(), addMsg);
        await message.reply(result1.message);
        break;
        
      case 'qedit':
        if (!isAdmin) {
          await message.reply('❌ Only bot admins can edit Q&A entries!');
          return;
        }
        const editContent = message.content.slice(PREFIX.length + 5).trim();
        const [editKeyword, ...editMsgParts] = editContent.split('|');
        const editMsg = editMsgParts.join('|').trim();
        const result2 = await editQAEntry(data, editKeyword?.trim(), editMsg);
        await message.reply(result2.message);
        break;
        
      case 'qdel':
        if (!isAdmin) {
          await message.reply('❌ Only bot admins can delete Q&A entries!');
          return;
        }
        const delKeyword = args[0]?.toLowerCase();
        if (!delKeyword) {
          await message.reply('Usage: `!qdel <keyword>`');
          return;
        }
        const result3 = await deleteQAEntry(data, delKeyword);
        await message.reply(result3.message);
        break;
        
      case 'submitqa':
        const subContent = message.content.slice(PREFIX.length + 8).trim();
        const parts = subContent.split('|');
        
        if (parts.length < 3) {
          await message.reply('**Submit Q&A for Approval**\n\nUsage: `!submitqa keyword | question | answer`\n\n**Example:**\n```\n!submitqa how-to-battle | How do I battle another player? | Use !b @user to challenge them\n```\n\n💡 **Tip:** If your Q&A gets approved, you get **10 gems**!');
          return;
        }
        
        const subKeyword = parts[0].trim();
        const subQuestion = parts[1].trim();
        const subAnswer = parts[2].trim();
        
        const subResult = await submitQA(data, userId, subKeyword, subQuestion, subAnswer);
        const subEmbed = new EmbedBuilder()
          .setColor(subResult.success ? '#00FF00' : '#FF0000')
          .setTitle(subResult.success ? '✅ Q&A Submitted!' : '❌ Submission Failed')
          .setDescription(subResult.message);
        
        await message.reply({ embeds: [subEmbed] });
        break;
        
      case 'pendingqa':
        if (!isAdmin) {
          await message.reply('❌ Only bot admins can review pending Q&A entries!');
          return;
        }
        
        const pending = await getPendingSubmissions(data);
        if (pending.length === 0) {
          await message.reply('✅ No pending Q&A submissions!');
          return;
        }
        
        const pendingEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`📋 Pending Q&A Submissions (${pending.length})`)
          .setDescription('Use `!approveqa <ID>` or `!rejectqa <ID> <reason>` to review\n\n' + 
            pending.map((sub, i) => 
              `**${i + 1}. ID:** \`${sub.id}\` | **Keyword:** \`${sub.keyword}\` | **By:** <@${sub.userId}>`
            ).join('\n')
          );
        
        await message.reply({ embeds: [pendingEmbed] });
        
        // Send detailed embeds for each submission
        for (let i = 0; i < pending.length; i++) {
          await message.reply({ embeds: [formatSubmissionEmbed(pending[i], i + 1)] });
        }
        break;
        
      case 'approveqa':
        if (!isAdmin) {
          await message.reply('❌ Only bot admins can approve Q&A entries!');
          return;
        }
        
        const approveId = args[0]?.toUpperCase();
        if (!approveId) {
          await message.reply('Usage: `!approveqa <submission_id>`\n\nExample: `!approveqa SUBABC123`');
          return;
        }
        
        const approveResult = await approveQASubmission(data, approveId, userId, client);
        await message.reply(approveResult.message);
        break;
        
      case 'rejectqa':
        if (!isAdmin) {
          await message.reply('❌ Only bot admins can reject Q&A entries!');
          return;
        }
        
        const rejectId = args[0]?.toUpperCase();
        const rejectReason = args.slice(1).join(' ');
        
        if (!rejectId) {
          await message.reply('Usage: `!rejectqa <submission_id> [reason]`\n\nExample: `!rejectqa SUBABC123 Answer too short`');
          return;
        }
        
        const rejectResult = await rejectQASubmission(data, rejectId, rejectReason, userId, client);
        await message.reply(rejectResult.message);
        break;
        
      case 'crate':
        const crateType = args[0]?.toLowerCase();
        const validCrates = ['gold', 'emerald', 'legendary', 'tyrant'];
        
        if (!validCrates.includes(crateType)) {
          const user = data.users[userId];
          const crateEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('<a:emoji_3:1439513584416591954> Available Crates')
            .setDescription('**Free Crates** (from message rewards):\n<:emoji_5:1439554263461134356> Bronze Crate - Use `!opencrate bronze`\n<:emoji_7:1439554348890853386> Silver Crate - Use `!opencrate silver`\n\n**Premium Crates** (purchase with gems):')
            .addFields(
              { name: '<:emoji_2:1439429824862093445> Gold Crate', value: '💎 100 gems\n1.5% character chance\n🎫 50 random character tokens\n💰 500 coins', inline: true },
              { name: '<:emoji_4:1439554205709766747> Emerald Crate', value: '💎 250 gems\n5% character chance\n🎫 130 random character tokens\n💰 1800 coins', inline: true },
              { name: '<:emoji_6:1439554298693550102> Legendary Crate', value: '💎 500 gems\n10% character chance\n🎫 200 random character tokens\n💰 2500 coins', inline: true },
              { name: '<:emoji_8:1439554384555151370> Tyrant Crate', value: '💎 750 gems\n15% character chance\n🎫 300 random character tokens\n💰 3500 coins', inline: true }
            )
            .addFields({ 
              name: '<a:emoji_3:1439513584416591954> Your Crates', 
              value: `<:emoji_5:1439554263461134356> Bronze: ${user.bronzeCrates || 0}\n<:emoji_7:1439554348890853386> Silver: ${user.silverCrates || 0}\n<:emoji_2:1439429824862093445> Gold: ${user.goldCrates || 0}\n<:emoji_4:1439554205709766747> Emerald: ${user.emeraldCrates || 0}\n<:emoji_6:1439554298693550102> Legendary: ${user.legendaryCrates || 0}\n<:emoji_8:1439554384555151370> Tyrant: ${user.tyrantCrates || 0}`, 
              inline: false 
            })
            .setFooter({ text: 'Use: !crate <type> to buy | !opencrate <type> to open owned crates' });
          await message.reply({ embeds: [crateEmbed] });
          return;
        }
        
        const result = await buyCrate(data, userId, crateType);
        
        if (!result.success) {
          await message.reply(`❌ ${result.message}`);
          return;
        }
        
        await saveDataImmediate(data);
        
        const resultEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`💎 ${crateType.toUpperCase()} CRATE PURCHASED!`)
          .setDescription(`<@${userId}>\n\n${result.message}`)
          .setTimestamp();
        
        await message.reply({ embeds: [resultEmbed] });
        break;
      
      case 'pickcrate':
      case 'pickchest':
        const pickType = args[0]?.toLowerCase();
        const allCrateTypes = ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'];
        
        if (!allCrateTypes.includes(pickType)) {
          await message.reply('Usage: `!pickcrate <type>`\nAvailable: bronze, silver, gold, emerald, legendary, tyrant\n\nUse `!crate` to see your inventory!');
          return;
        }
        
        const crateKey = `${pickType}Crates`;
        const userCrateCount = data.users[userId][crateKey] || 0;
        
        if (userCrateCount < 1) {
          await message.reply(`❌ You don't have any ${pickType} crates!`);
          return;
        }
        
        const sessionResult = startPickSession(userId, pickType);
        if (!sessionResult.success) {
          await message.reply(sessionResult.message);
          return;
        }
        
        const chestVisual = await getChestVisual(pickType);
        
        const readyEmbed = new EmbedBuilder()
          .setColor(chestVisual.embedColor)
          .setTitle(`${chestVisual.displayName} Chest is Ready! ✨`)
          .setDescription(`<@${userId}> picked a **${chestVisual.displayName}** chest!\n\n🎁 Your chest is ready to open!\n⏰ You have **2 minutes** to open it.\n\nType \`!opencrate\` to open your chest!`)
          .setImage(chestVisual.readyGifUrl)
          .setTimestamp();
        
        await message.reply({ embeds: [readyEmbed] });
        break;
      
      case 'opencrate':
      case 'openchest':
        const activeSession = getActiveSession(userId);
        
        if (!activeSession) {
          await message.reply('❌ You don\'t have an active chest session!\n\nUse `!pickcrate <type>` to start opening a chest.\nExample: `!pickcrate gold`');
          return;
        }
        
        const timeLeft = Math.ceil((activeSession.expiresAt - Date.now()) / 1000);
        
        if (timeLeft <= 0) {
          clearSession(userId);
          await message.reply('❌ Your chest session expired! Use `!pickcrate <type>` to pick a new chest.');
          return;
        }
        
        const openResult = await openCrate(data, userId, activeSession.crateType, client);
        
        if (!openResult.success) {
          clearSession(userId);
          await message.reply(`❌ ${openResult.message}`);
          return;
        }
        
        clearSession(userId);
        await saveDataImmediate(data);
        
        const openResultEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🎁 ${activeSession.crateType.toUpperCase()} CHEST OPENED!`)
          .setDescription(`<@${userId}> opened their chest!\n\n${openResult.message}`)
          .setTimestamp();
        
        await message.reply({ embeds: [openResultEmbed] });
        break;
        
      case 'bulkopen':
      case 'openall':
      case 'bulkopencrate':
        const bulkCrateType = args[0]?.toLowerCase();
        const bulkQuantity = parseInt(args[1]) || 10;
        
        if (!bulkCrateType || !['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'].includes(bulkCrateType)) {
          await message.reply('Usage: `!bulkopen <type> [quantity]`\n\nExample: `!bulkopen gold 5`\nAvailable types: bronze, silver, gold, emerald, legendary, tyrant\nQuantity: 1-50 (default: 10)');
          return;
        }
        
        const bulkResult = await openCratesInBulk(data, userId, bulkCrateType, bulkQuantity, client);
        
        if (!bulkResult.success) {
          await message.reply(`❌ ${bulkResult.message}`);
          return;
        }
        
        await saveDataImmediate(data);
        
        const bulkEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🎁 Bulk Crate Opening!`)
          .setDescription(bulkResult.message)
          .setFooter({ text: `Opened by ${message.author.username}` })
          .setTimestamp();
        
        await message.reply({ embeds: [bulkEmbed] });
        break;
        
      case 'levelup':
        const charToLevelName = args.join(' ').toLowerCase();
        
        if (!charToLevelName) {
          await message.reply('Usage: `!levelup <character name>`');
          return;
        }
        
        const charToLevel = data.users[userId].characters.find(c => 
          c.name.toLowerCase() === charToLevelName
        );
        
        if (!charToLevel) {
          await message.reply('❌ You don\'t own this character!');
          return;
        }
        
        const currentCharLevel = charToLevel.level;
        const requirements = getLevelRequirements(currentCharLevel);
        
        if (charToLevel.tokens >= requirements.tokens && data.users[userId].coins >= requirements.coins) {
          charToLevel.tokens -= requirements.tokens;
          data.users[userId].coins -= requirements.coins;
          charToLevel.level += 1;
          data.users[userId].lastActivity = Date.now();
          
          // Track season daily task progress for levels gained
          updateTaskProgress(data.users[userId], 'levelsGained', 1);
          
          const ptData = initializePersonalizedTaskData(data.users[userId]);
          if (ptData.taskProgress.levelsGained !== undefined) {
            const completedTask = checkTaskProgress(data.users[userId], 'levelsGained', 1);
            if (completedTask) {
              await completePersonalizedTask(client, userId, data, completedTask);
            }
          }
          
          await saveDataImmediate(data);
          
          const lvlEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('⬆️ LEVEL UP!')
            .setDescription(`<@${userId}> leveled up **${charToLevel.name} ${charToLevel.emoji}**!\n\n**Level ${currentCharLevel} → ${currentCharLevel + 1}**\n\n**Cost:**\n🎫 ${requirements.tokens} tokens\n💰 ${requirements.coins} coins`);
          await message.reply({ embeds: [lvlEmbed] });
        } else {
          const missingTokens = Math.max(0, requirements.tokens - charToLevel.tokens);
          const missingCoins = Math.max(0, requirements.coins - data.users[userId].coins);
          let errorMsg = '❌ Not enough resources!\n\n**Required:**\n';
          errorMsg += `🎫 ${requirements.tokens} tokens (you have ${charToLevel.tokens})\n`;
          errorMsg += `💰 ${requirements.coins} coins (you have ${data.users[userId].coins})`;
          
          if (missingTokens > 0 || missingCoins > 0) {
            errorMsg += '\n\n**Missing:**\n';
            if (missingTokens > 0) errorMsg += `🎫 ${missingTokens} tokens\n`;
            if (missingCoins > 0) errorMsg += `💰 ${missingCoins} coins`;
          }
          
          await message.reply(errorMsg);
        }
        break;
        
      case 'char':
      case 'character':
        const charName = args.join(' ').toLowerCase();
        
        if (!charName) {
          await message.reply('Usage: `!char <character name>`');
          return;
        }
        
        const userChar = data.users[userId].characters.find(c => 
          c.name.toLowerCase() === charName
        );
        
        if (!userChar) {
          await message.reply('You don\'t own this character!');
          return;
        }
        
        // Track season daily task progress for viewing characters
        if (data.users[userId].started) {
          updateTaskProgress(data.users[userId], 'charsViewed', 1);
        }
        
        const charReq = getLevelRequirements(userChar.level);
        const charProgress = createLevelProgressBar(userChar.tokens, charReq.tokens);
        const charSkinUrl = await getSkinUrl(userChar.name, userChar.currentSkin || 'default');
        const availableSkins = userChar.ownedSkins || ['default'];
        const boostCount = getCharacterBoostCount(userChar);
        const remainingBoosts = MAX_BOOSTS_PER_CHARACTER - boostCount;
        
        const charEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`${userChar.emoji} ${userChar.name}`)
          .setImage(charSkinUrl)
          .addFields(
            { name: 'Level', value: `${userChar.level}`, inline: true },
            { name: 'ST', value: `${userChar.st}%`, inline: true },
            { name: 'Tokens', value: `${userChar.tokens}/${charReq.tokens}`, inline: true },
            { name: 'ST Boosts', value: `${boostCount}/${MAX_BOOSTS_PER_CHARACTER} used\n${remainingBoosts > 0 ? `⚡ ${remainingBoosts} left` : '❌ Max reached'}`, inline: true },
            { name: 'Next Level Cost', value: `🎫 ${charReq.tokens} tokens\n💰 ${charReq.coins} coins`, inline: true },
            { name: 'Progress to Next Level', value: charProgress, inline: false },
            { name: '🎨 Current Skin', value: userChar.currentSkin || 'default', inline: true },
            { name: '🖼️ Owned Skins', value: availableSkins.join(', '), inline: true }
          );
        
        await message.reply({ embeds: [charEmbed] });
        break;
        
      case 'release':
      case 'leave':
        const charToReleaseName = args.join(' ').toLowerCase();
        
        if (!charToReleaseName) {
          await message.reply('Usage: `!release <character name>`');
          return;
        }
        
        const charIndex = data.users[userId].characters.findIndex(c => 
          c.name.toLowerCase() === charToReleaseName
        );
        
        if (charIndex === -1) {
          await message.reply('❌ You don\'t own this character!');
          return;
        }
        
        const charToRelease = data.users[userId].characters[charIndex];
        
        if (charToRelease.level < 10) {
          await message.reply(`❌ **${charToRelease.name}** must be at least level 10 to release! (Currently level ${charToRelease.level})`);
          return;
        }
        
        data.users[userId].characters.splice(charIndex, 1);
        
        if (data.users[userId].selectedCharacter === charToRelease.name) {
          data.users[userId].selectedCharacter = data.users[userId].characters.length > 0 
            ? data.users[userId].characters[0].name 
            : null;
        }
        
        if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
        data.users[userId].questProgress.charsReleased = (data.users[userId].questProgress.charsReleased || 0) + 1;
        
        saveData(data);
        
        const releaseEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('👋 Character Released')
          .setDescription(`<@${userId}> released **${charToRelease.name} ${charToRelease.emoji}**!\n\nLevel: ${charToRelease.level}\nST: ${charToRelease.st}%\nTokens: ${charToRelease.tokens}\n\nGoodbye, ${charToRelease.name}!`);
        
        await message.reply({ embeds: [releaseEmbed] });
        break;
        
      case 'forcerelease':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const forceReleaseTarget = message.mentions.users.first();
        const forceCharName = forceReleaseTarget 
          ? args.filter(arg => !arg.startsWith('<@')).join(' ').toLowerCase()
          : args.join(' ').toLowerCase();
        
        const targetUserId = forceReleaseTarget ? forceReleaseTarget.id : userId;
        
        if (!forceCharName) {
          await message.reply('Usage: `!forcerelease <character name>` or `!forcerelease @user <character name>`');
          return;
        }
        
        if (!data.users[targetUserId]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const forceCharIndex = data.users[targetUserId].characters.findIndex(c => 
          c.name.toLowerCase() === forceCharName
        );
        
        if (forceCharIndex === -1) {
          await message.reply(`❌ ${forceReleaseTarget ? 'That user doesn\'t' : 'You don\'t'} own this character!`);
          return;
        }
        
        const forceCharToRelease = data.users[targetUserId].characters[forceCharIndex];
        
        data.users[targetUserId].characters.splice(forceCharIndex, 1);
        
        if (data.users[targetUserId].selectedCharacter === forceCharToRelease.name) {
          data.users[targetUserId].selectedCharacter = data.users[targetUserId].characters.length > 0 
            ? data.users[targetUserId].characters[0].name 
            : null;
        }
        
        saveData(data);
        
        const forceReleaseEmbed = new EmbedBuilder()
          .setColor('#FF4444')
          .setTitle('🔓 Character Force Released')
          .setDescription(`${forceReleaseTarget ? `<@${targetUserId}>'s` : 'Your'} **${forceCharToRelease.name} ${forceCharToRelease.emoji}** was force released by <@${userId}>!\n\nLevel: ${forceCharToRelease.level}\nST: ${forceCharToRelease.st}%\nTokens: ${forceCharToRelease.tokens}`);
        
        await message.reply({ embeds: [forceReleaseEmbed] });
        break;
        
      case 'setdrop':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        data.dropChannel = message.channel.id;
        saveData(data);
        await message.reply(`✅ Drop channel set to ${message.channel}!`);
        break;
        
      case 'startdrops':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        if (!data.dropChannel) {
          await message.reply('❌ Please set a drop channel first with `!setdrop`!');
          return;
        }
        
        startDropSystem(client, data);
        await message.reply('✅ Drop system started! Drops will appear every 20 seconds.');
        break;
        
      case 'stopdrops':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        stopDropSystem();
        await message.reply('✅ Drop system stopped!');
        break;
        
      case 'paydrops':
      case 'activatedrops':
        if (!serverId || isMainServer(serverId)) {
          await message.reply('❌ This command is only for non-main servers!');
          return;
        }
        
        if (!isSuperAdmin(userId) && !isZooAdmin(message.member)) {
          await message.reply('❌ Only users with the **ZooAdmin** role can activate drops for this server!\n\nAsk a server administrator to give you the "ZooAdmin" role to manage the bot.');
          return;
        }
        
         
        const payResult = await payForDrops(serverId, userId, data);
        
        if (payResult.success) {
          const currentConfig = getServerConfig(serverId);
          if (currentConfig) {
            currentConfig.lastActivityTimestamp = Date.now();
            await saveServerConfig(serverId, currentConfig);
          }
          const payEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💎 Drops Activated!')
            .setDescription(payResult.message);
          
          await message.reply({ embeds: [payEmbed] });
        } else {
          await message.reply(payResult.message);
        }
        break;
        
      case 'dropstatus':
        const isActive = areDropsActive(serverId);
        const dropsTimeLeft = getDropsTimeRemaining(serverId);
        
        const statusEmbed = new EmbedBuilder()
          .setColor(isActive ? '#00FF00' : '#FF0000')
          .setTitle('🎁 Drop System Status')
          .setDescription(isActive 
            ? `✅ **Drops are ACTIVE**\n⏰ Time remaining: ${dropsTimeLeft}\n\n💡 Drops will expire after ${dropsTimeLeft}${isMainServer(serverId) ? ' (unlimited in main server)' : ''}` 
            : `❌ **Drops are INACTIVE**\n\n💎 Use \`!paydrops\` to activate drops for 3 hours (100 gems)${isMainServer(serverId) ? '\n\n✨ Main server has unlimited drops!' : ''}`);
        
        await message.reply({ embeds: [statusEmbed] });
        break;
        
      case 'revive':
      case 'revivedrops':
       if (!serverId) {
       await message.reply('❌ This command can only be used in a server!');
       return;
       }

  // ⬇⬇ ADD THIS HERE — starts inactivity timestamp
      
  // ⬆⬆ END OF ADDED PART

  const reviveResult = await reviveDrops(serverId);

  if (reviveResult.success) {
    const currentReviveConfig = getServerConfig(serverId);
    if (currentReviveConfig) {
      currentReviveConfig.dropTimestamp = Date.now();
      await saveServerConfig(serverId, currentReviveConfig);
    }
    const reviveEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Drops Revived!')
      .setDescription(reviveResult.message);

    await message.reply({ embeds: [reviveEmbed] });
  } else {
    await message.reply(reviveResult.message);
  }
  break;
        
      case 'c':
        const code = args[0]?.toLowerCase();
        
        if (!code) return;
        
        if (!serverId) return;
        
        recordCatchAttempt(serverId);
        
        if (!data.serverDrops) data.serverDrops = {};
        
        if (data.serverDrops[serverId] && data.serverDrops[serverId].code === code) {
          const drop = data.serverDrops[serverId];
          
          // Handle Christmas Gift drops
          if (drop.type === 'christmasGift') {
            const { addChristmasGift, isEventActive } = require('./christmasEventSystem.js');
            
            if (!isEventActive()) {
              delete data.serverDrops[serverId];
              saveData(data);
              await message.reply('❌ The Christmas event has ended! Drop cleared.');
              break;
            }
            
            try {
              const giftResult = await addChristmasGift(userId, serverId, 'drop', drop.amount);
              
              if (giftResult.success) {
                delete data.serverDrops[serverId];
                
                if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
                data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
                data.users[userId].lastActivity = Date.now();
                
                trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
                checkAchievements(data.users[userId]);
                updateTaskProgress(data.users[userId], 'dropsCaught', 1);
                
                if (message.guild) {
                  recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
                  const { addAura } = require('./serverAuraSystem.js');
                  addAura(message.guild.id, 8, 'christmas_gift').catch(e => console.error('Error adding Christmas aura:', e));
                }
                
                saveData(data);
                
                const giftText = drop.amount === 1 ? '1 Christmas Gift' : `${drop.amount} Christmas Gifts`;
                const christmasEmbed = new EmbedBuilder()
                  .setColor('#FF0000')
                  .setTitle('🎄 CHRISTMAS GIFT CAUGHT! 🎄')
                  .setDescription(`<@${userId}> caught the festive drop!\n\n**Reward:** 🎁 **${giftText}**\n\n✨ Your gifts: ${giftResult.userGifts} | 🌍 Global: ${giftResult.totalGifts}`)
                  .setFooter({ text: 'Use !christmas to view event progress!' });
                
                await message.reply({ embeds: [christmasEmbed] });
              } else {
                console.error('[Catch] Failed to add Christmas gift:', giftResult.message);
                delete data.serverDrops[serverId];
                saveData(data);
                await message.reply('❌ Failed to award Christmas gift. Drop cleared.');
              }
            } catch (error) {
              console.error('[Catch] Error awarding Christmas gift:', error);
              delete data.serverDrops[serverId];
              saveData(data);
              await message.reply('❌ Error awarding Christmas gift. Drop cleared.');
            }
            break;
          }
          
          if (drop.type === 'characterKey') {
            const keyResult = await catchKeyDrop(userId, serverId, data);
            
            if (keyResult && keyResult.success) {
              if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
              data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
              data.users[userId].lastActivity = Date.now();
              
              trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
              checkAchievements(data.users[userId]);
              updateTaskProgress(data.users[userId], 'dropsCaught', 1);
              if (message.guild) {
                recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
                const { addAura } = require('./serverAuraSystem.js');
                addAura(message.guild.id, 5, 'drop_catch').catch(e => console.error('Error adding drop aura:', e));
              }
              
              const keyEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🔑 CHARACTER KEY CAUGHT!')
                .setDescription(`<@${userId}> caught the key!\n\n**Reward:** ${keyResult.amount} ${keyResult.characterEmoji} ${keyResult.characterName} Key${keyResult.amount > 1 ? 's' : ''}${keyResult.bonusMessage}`)
                .setFooter({ text: 'Use !charkeys to view your collection!' });
              
              await message.reply({ embeds: [keyEmbed] });
            }
          } else if (drop.type === 'tokens') {
            const charToReward = data.users[userId].characters.find(c => 
              c.name.toLowerCase() === drop.characterName.toLowerCase()
            );
            
            if (charToReward) {
              delete data.serverDrops[serverId];
              charToReward.tokens += drop.amount;
              
              if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
              data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
              data.users[userId].lastActivity = Date.now();
              
              trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
              checkAchievements(data.users[userId]);
              updateTaskProgress(data.users[userId], 'dropsCaught', 1);
              if (message.guild) {
                recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
                const { addAura } = require('./serverAuraSystem.js');
                addAura(message.guild.id, 5, 'drop_catch').catch(e => console.error('Error adding drop aura:', e));
              }
              
              const ptData = initializePersonalizedTaskData(data.users[userId]);
              if (ptData.taskProgress.dropsCaught !== undefined) {
                const completedTask = checkTaskProgress(data.users[userId], 'dropsCaught', 1);
                if (completedTask) {
                  await completePersonalizedTask(client, userId, data, completedTask);
                }
              }
              
              await eventSystem.recordProgress(userId, data.users[userId].username, 1, 'drop_catcher');
              
              saveData(data);
              
              const dropEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎉 DROP CAUGHT!')
                .setDescription(`<@${userId}> caught the drop!\n\n**Reward:** ${drop.amount} ${drop.characterName} tokens 🎫`);
              
              await message.reply({ embeds: [dropEmbed] });
            } else {
              await message.reply(`❌ You don't own **${drop.characterName}**, so you can't collect these tokens! Drop remains active.`);
            }
          } else if (drop.type === 'collectibleItem') {
            // Handle collectible item drops
            let awardResult;
            try {
              if (drop.isServerSpecific) {
                console.log(`[Catch] Awarding server collectible: itemId=${drop.itemId}, serverId=${serverId}, userId=${userId}`);
                awardResult = await awardServerCollectible(userId, serverId, drop.itemId);
              } else {
                console.log(`[Catch] Awarding global collectible: itemId=${drop.itemId}, userId=${userId}`);
                awardResult = await awardCollectibleItem(userId, drop.itemId);
              }
            } catch (awardError) {
              console.error('[Catch] Error awarding collectible:', awardError);
              awardResult = { success: false, message: awardError.message };
            }
            
            if (awardResult && awardResult.success) {
              delete data.serverDrops[serverId];
              
              if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
              data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
              data.users[userId].lastActivity = Date.now();
              
              if (message.guild) {
                const { addAura } = require('./serverAuraSystem.js');
                addAura(message.guild.id, 6, 'collectible_drop').catch(e => console.error('Error adding collectible aura:', e));
              }
              
              trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
              checkAchievements(data.users[userId]);
              updateTaskProgress(data.users[userId], 'dropsCaught', 1);
              if (message.guild) {
                recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
              }
              
              await eventSystem.recordProgress(userId, data.users[userId].username, 1, 'drop_catcher');
              
              saveData(data);
              
              const collectibleEmbed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('🎁 COLLECTIBLE CAUGHT!')
                .setDescription(`<@${userId}> caught the drop!\n\n**Reward:** ${drop.emoji} **${drop.itemName}** (${drop.rarity?.name || 'common'})\n💰 Value: ${drop.itemValue} coins`)
                .setThumbnail(drop.itemImage || null)
                .setFooter({ text: 'Use !myitems to view your collection!' });
              
              await message.reply({ embeds: [collectibleEmbed] });
            } else if (awardResult && awardResult.alreadyOwned) {
              await message.reply(`❌ You already own **${drop.itemName}** and it's not stackable! Drop remains active.`);
            } else {
              console.error(`[Catch] Failed to award collectible: ${awardResult?.message || 'Unknown error'}`, { itemId: drop.itemId, serverId, userId, isServerSpecific: drop.isServerSpecific });
              delete data.serverDrops[serverId];
              saveData(data);
              await message.reply(`❌ Failed to award collectible (item may no longer exist). Drop cleared.`);
            }
          } else {
            delete data.serverDrops[serverId];
            
            if (drop.type === 'coins') {
              data.users[userId].coins += drop.amount;
              // Track coins earned for season daily tasks
              updateTaskProgress(data.users[userId], 'coinsEarned', drop.amount);
            } else if (drop.type === 'gems') {
              data.users[userId].gems += drop.amount;
            } else if (drop.type === 'shards') {
              data.users[userId].shards = (data.users[userId].shards || 0) + drop.amount;
            }
            
            if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
            data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
            data.users[userId].lastActivity = Date.now();
            
            trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
            checkAchievements(data.users[userId]);
            updateTaskProgress(data.users[userId], 'dropsCaught', 1);
            if (message.guild) {
              recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
            }
            
            const ptData2 = initializePersonalizedTaskData(data.users[userId]);
            if (ptData2.taskProgress.dropsCaught !== undefined) {
              const completedTask2 = checkTaskProgress(data.users[userId], 'dropsCaught', 1);
              if (completedTask2) {
                await completePersonalizedTask(client, userId, data, completedTask2);
              }
            }
            
            await eventSystem.recordProgress(userId, data.users[userId].username, 1, 'drop_catcher');
            
            let christmasGiftText = '';
            try {
              const { shouldDropChristmasGift, addChristmasGift, createCommunityMilestoneAnnouncement, distributeMilestoneRewards } = require('./christmasEventSystem.js');
              if (shouldDropChristmasGift('drop')) {
                const giftResult = await addChristmasGift(userId, serverId, 'drop');
                if (giftResult.success) {
                  christmasGiftText = `\n\n🎁🎄 **CHRISTMAS GIFT!** You also found a festive gift!\n✨ Your gifts: ${giftResult.userGifts} | Global: ${giftResult.totalGifts}`;
                  
                  for (const notification of giftResult.notifications || []) {
                    if (notification.type === 'community') {
                      await createCommunityMilestoneAnnouncement(client, data, notification.milestone);
                    } else if (notification.type === 'personal') {
                      await distributeMilestoneRewards(client, data, notification.milestone, 'personal', userId);
                      christmasGiftText += `\n🎄 **PERSONAL MILESTONE!** ${notification.milestone.name} reached!`;
                    } else if (notification.type === 'server' && serverId) {
                      const serverUsers = Object.keys(data.users).filter(uid => data.users[uid]);
                      await distributeMilestoneRewards(client, data, notification.milestone, 'server', null, serverUsers.slice(0, 100));
                      christmasGiftText += `\n🎄 **SERVER MILESTONE!** ${notification.milestone.name} reached!`;
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error checking Christmas gift:', error);
            }
            
            saveData(data);
            
            let rewardText = '';
            if (drop.type === 'coins') {
              rewardText = `${drop.amount} coins 💰`;
            } else if (drop.type === 'gems') {
              rewardText = `${drop.amount} gems 💎`;
            } else if (drop.type === 'shards') {
              rewardText = `${drop.amount} shards 🔷`;
            }
            
            const dropEmbed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('🎉 DROP CAUGHT!')
              .setDescription(`<@${userId}> caught the drop!\n\n**Reward:** ${rewardText}${christmasGiftText}`);
            
            await message.reply({ embeds: [dropEmbed] });
          }
        }
        break;
        
      case 't':
      case 'trade':
        const receiver = message.mentions.users.first();
        
        if (!receiver) {
          await message.reply('Usage: `!t @user`');
          return;
        }
        
        if (receiver.id === userId) {
          await message.reply('❌ You can\'t trade with yourself!');
          return;
        }
        
        if (!data.users[receiver.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        await initiateTrade(message, data, userId, receiver.id);
        break;
        
      case 'grant':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const grantUser = message.mentions.users.first();
        const grantType = args[1]?.toLowerCase();
        const grantTarget = args.slice(2).join(' ');
        const grantAmount = parseInt(grantTarget);
        
        if (!grantUser || !grantType) {
          await message.reply('Usage: `!grant @user <coins/gems> <amount>` or `!grant @user tokens <character> <amount>`');
          return;
        }
        
        if (!data.users[grantUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        if (grantType === 'tokens') {
          const charNameForTokens = args.slice(2, -1).join(' ').toLowerCase();
          const tokenAmount = parseInt(args[args.length - 1]);
          
          if (!charNameForTokens || !tokenAmount) {
            await message.reply('Usage: `!grant @user tokens <character name> <amount>`');
            return;
          }
          
          const targetChar = data.users[grantUser.id].characters.find(c => 
            c.name.toLowerCase() === charNameForTokens
          );
          
          if (!targetChar) {
            await message.reply('❌ That user doesn\'t own this character!');
            return;
          }
          
          targetChar.tokens += tokenAmount;
          await saveDataImmediate(data);
          
          await message.reply(`✅ Granted ${tokenAmount} ${targetChar.name} tokens to <@${grantUser.id}>!`);
        } else if (['coins', 'gems'].includes(grantType)) {
          if (!grantAmount) {
            await message.reply('Please specify an amount!');
            return;
          }
          
          data.users[grantUser.id][grantType] += grantAmount;
          await saveDataImmediate(data);
          
          await message.reply(`✅ Granted ${grantAmount} ${grantType} to <@${grantUser.id}>!`);
        } else {
          await message.reply('Invalid type! Use: coins, gems, or tokens');
        }
        break;
      
      case 'grantust':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const ustUser = message.mentions.users.first();
        const ustAmount = parseInt(args[1]);
        
        if (!ustUser || isNaN(ustAmount)) {
          await message.reply('Usage: `!grantust @user <amount>`\nExample: `!grantust @user 100`');
          return;
        }
        
        const ustGrantResult = await grantUST(data, ustUser.id, ustAmount, `Granted by ${message.author.username}`);
        await message.reply(ustGrantResult.message);
        break;
      
      case 'removeust':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const removeUstUser = message.mentions.users.first();
        const removeUstAmount = parseInt(args[1]);
        
        if (!removeUstUser || isNaN(removeUstAmount)) {
          await message.reply('Usage: `!removeust @user <amount>`\nExample: `!removeust @user 50`');
          return;
        }
        
        const ustRemoveResult = await removeUST(data, removeUstUser.id, removeUstAmount, `Removed by ${message.author.username}`);
        await message.reply(ustRemoveResult.message);
        break;
      
      case 'ust':
      case 'ustbalance':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        
        const ustEmbed = formatUSTBalance(data.users[userId], message.author.username);
        await message.reply({ embeds: [ustEmbed] });
        break;
      
      case 'setustrate':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const rateType = args[0]?.toLowerCase();
        const rateAmount = parseInt(args[1]);
        
        if (!rateType || isNaN(rateAmount)) {
          await message.reply('Usage: `!setustrate <firstPlace/secondPlace/thirdPlace/minimumPool> <amount>`\nExample: `!setustrate firstPlace 150`');
          return;
        }
        
        const rateResult = setUSTRate(rateType, rateAmount);
        await message.reply(rateResult.message);
        break;
      
      case 'ustrates':
      case 'viewustrates':
        const rates = getUSTRates();
        const ratesEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🌟 UST Clan Wars Reward Rates')
          .setDescription('Current UST reward distribution for weekly clan wars')
          .addFields(
            { name: '🥇 First Place', value: `${rates.firstPlace} UST`, inline: true },
            { name: '🥈 Second Place', value: `${rates.secondPlace} UST`, inline: true },
            { name: '🥉 Third Place', value: `${rates.thirdPlace} UST`, inline: true },
            { name: '💰 Minimum Pool', value: `${rates.minimumPool} points (for coins/gems)`, inline: false }
          )
          .setFooter({ text: 'UST is distributed based on your contribution to your clan' });
        
        await message.reply({ embeds: [ratesEmbed] });
        break;
        
      case 'grantchar':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const charUser = message.mentions.users.first();
        if (!charUser) {
          await message.reply('Usage: `!grantchar @user <character name> [ST]`\nExample: `!grantchar @user Nix 75`');
          return;
        }
        
        const restArgs = args.slice(1);
        let customST = null;
        let charToGrant = '';
        
        const lastArg = restArgs[restArgs.length - 1];
        const stValue = parseFloat(lastArg);
        
        if (!isNaN(stValue) && stValue > 0 && stValue <= 100) {
          customST = stValue;
          charToGrant = restArgs.slice(0, -1).join(' ');
        } else {
          charToGrant = restArgs.join(' ');
        }
        
        if (!charToGrant) {
          await message.reply('Usage: `!grantchar @user <character name> [ST]`\nExample: `!grantchar @user Nix 75`');
          return;
        }
        
        const foundChar = characterManager.getCharacterByName(charToGrant);
        
        if (!foundChar) {
          await message.reply('❌ Character not found!');
          return;
        }
        
        if (!data.users[charUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const alreadyHas = data.users[charUser.id].characters.find(c => c.name === foundChar.name);
        
        if (alreadyHas) {
          await message.reply('❌ User already has this character!');
          return;
        }
        
        const grantedST = customST || generateST();
        const wasFirstChar = data.users[charUser.id].characters.length === 0;
        const pendingToGrant = wasFirstChar ? (data.users[charUser.id].pendingTokens || 0) : 0;
        
        const grantedMoves = assignMovesToCharacter(foundChar.name, grantedST);
        const grantedHP = calculateBaseHP(grantedST);
        
        data.users[charUser.id].characters.push({
          name: foundChar.name,
          emoji: foundChar.emoji,
          level: 1,
          tokens: pendingToGrant,
          st: grantedST,
          moves: grantedMoves,
          baseHp: grantedHP,
          currentSkin: 'default',
          ownedSkins: ['default']
        });
        
        if (wasFirstChar && pendingToGrant > 0) {
          data.users[charUser.id].pendingTokens = 0;
        }
        
        await saveDataImmediate(data);
        
        let grantMessage = `✅ Granted **${foundChar.name} ${foundChar.emoji}** (ST: ${grantedST}%) to <@${charUser.id}>!`;
        if (pendingToGrant > 0) {
          grantMessage += `\n🎁 They also received ${pendingToGrant} pending tokens!`;
        }
        
        await message.reply(grantMessage);
        break;
      
      case 'grantkeys':
      case 'grantkey':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const keyUser = message.mentions.users.first();
        if (!keyUser) {
          await message.reply('**Grant Character Keys**\n\nUsage: `!grantkeys @user <character name> <amount>`\n\nExamples:\n`!grantkeys @user Nix 100` - Grant 100 Nix keys\n`!grantkeys @user Bruce 50` - Grant 50 Bruce keys\n`!grantkeys @user Donna the Diva 100` - Works with multi-word names');
          return;
        }
        
        if (!data.users[keyUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        // Filter out mention tokens to handle character names with spaces correctly
        const keyArgsFiltered = args.filter(arg => !arg.match(/^<@!?\d+>$/));
        const keyAmount = parseInt(keyArgsFiltered[keyArgsFiltered.length - 1]);
        
        if (isNaN(keyAmount) || keyAmount < 1) {
          await message.reply('❌ Please specify a valid amount!\n\nUsage: `!grantkeys @user <character name> <amount>`');
          return;
        }
        
        // Character name is everything except the last element (which is the amount)
        const keyCharName = keyArgsFiltered.slice(0, -1).join(' ');
        if (!keyCharName) {
          await message.reply('❌ Please specify a character name!\n\nUsage: `!grantkeys @user <character name> <amount>`');
          return;
        }
        
        const foundKeyChar = characterManager.getCharacterByName(keyCharName);
        if (!foundKeyChar) {
          await message.reply(`❌ Character **${keyCharName}** not found!`);
          return;
        }
        
        const { addCharacterKeys, initializeCharacterKeys, getCharacterKeyCount } = require('./characterKeySystem.js');
        initializeCharacterKeys(data.users[keyUser.id]);
        addCharacterKeys(data.users[keyUser.id], foundKeyChar.name, keyAmount);
        await saveDataImmediate(data);
        
        const newKeyCount = getCharacterKeyCount(data.users[keyUser.id], foundKeyChar.name);
        
        const grantKeyEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🔑 Keys Granted!')
          .setDescription(`**Granted:** ${keyAmount} ${foundKeyChar.emoji} **${foundKeyChar.name}** keys\n**To:** <@${keyUser.id}>\n\n**Their Total:** ${newKeyCount} ${foundKeyChar.name} keys`)
          .setFooter({ text: `Granted by ${message.author.username}` })
          .setTimestamp();
        
        await message.reply({ embeds: [grantKeyEmbed] });
        break;
        
      case 'addskin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const skinCharName = args[0];
        const skinName = args[1];
        const skinUrl = args[2];
        
        if (!skinCharName || !skinName || !skinUrl) {
          await message.reply('Usage: `!addskin <character> <skin_name> <image_url>`\nExample: `!addskin Nix galaxy https://example.com/image.png`');
          return;
        }
        
        const foundSkinChar = characterManager.getCharacterByName(skinCharName);
        if (!foundSkinChar) {
          await message.reply('❌ Character not found!');
          return;
        }
        
        const { addSkinToCharacter } = require('./skinSystem.js');
        addSkinToCharacter(foundSkinChar.name, skinName, skinUrl);
        
        await message.reply(`✅ Added skin **${skinName}** to **${foundSkinChar.name} ${foundSkinChar.emoji}**!\nImage: ${skinUrl}\n\nNow you can grant this skin to players using: \`!grantskin @user ${foundSkinChar.name} ${skinName}\``);
        break;
        
      case 'updateskin':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ This command is restricted to Super Admins and Bot Admins only!');
          return;
        }
        
        const updateCharName = args[0];
        const updateSkinName = args[1];
        let updateSkinUrl = args[2];
        
        if (!updateCharName || !updateSkinName) {
          await message.reply('**Update Existing Skin**\n\nUsage: `!updateskin <character> <skin_name> [new_url]` or attach an image\n\n**Examples:**\n`!updateskin Nix default https://example.com/image.png` (with URL)\n`!updateskin Nix default` (then attach an image)\n\nIf using image attachment, don\'t include a URL!');
          return;
        }
        
        // Check for image attachment
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();
          const isImage = attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(attachment.name);
          if (!isImage) {
            await message.reply('❌ The attachment must be an image file (PNG, JPG, GIF, or WEBP)!');
            return;
          }
          updateSkinUrl = attachment.url;
        } else if (!updateSkinUrl) {
          await message.reply('❌ Please provide either an image URL or attach an image file!');
          return;
        }
        
        const foundUpdateChar = characterManager.getCharacterByName(updateCharName);
        if (!foundUpdateChar) {
          await message.reply('❌ Character not found!');
          return;
        }
        
        const { updateSkinImageUrl } = require('./skinSystem.js');
        const { updateUSTSkinUrl } = require('./cosmeticsShopSystem.js');
        
        const regularSkinResult = await updateSkinImageUrl(foundUpdateChar.name, updateSkinName, updateSkinUrl);
        const ustSkinResult = await updateUSTSkinUrl(foundUpdateChar.name, updateSkinName, updateSkinUrl);
        
        if (regularSkinResult || ustSkinResult) {
          await message.reply(`✅ Updated **${updateSkinName}** skin for **${foundUpdateChar.name} ${foundUpdateChar.emoji}**!\nNew Image: ${updateSkinUrl}`);
        } else {
          await message.reply(`❌ Skin **${updateSkinName}** not found for **${foundUpdateChar.name}**!`);
        }
        break;
        
      case 'grantskin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const skinTargetUser = message.mentions.users.first();
        const grantSkinCharName = args[1];
        const grantSkinName = args[2];
        
        if (!skinTargetUser || !grantSkinCharName || !grantSkinName) {
          await message.reply('Usage: `!grantskin @user <character> <skin_name>`');
          return;
        }
        
        if (!data.users[skinTargetUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const targetUserChar = data.users[skinTargetUser.id].characters.find(c => 
          c.name.toLowerCase() === grantSkinCharName.toLowerCase()
        );
        
        if (!targetUserChar) {
          await message.reply('❌ That user doesn\'t own this character!');
          return;
        }
        
        // Check both old skins system and cosmetics catalog
        const oldSkinExists = await skinExists(targetUserChar.name, grantSkinName);
        const { getUSTSkinUrl } = require('./cosmeticsShopSystem.js');
        const ustSkinExists = await getUSTSkinUrl(targetUserChar.name, grantSkinName) !== null;
        
        if (!oldSkinExists && !ustSkinExists) {
          await message.reply(`❌ Skin **${grantSkinName}** doesn't exist for **${targetUserChar.name}**!\nUse \`!addskin ${targetUserChar.name} ${grantSkinName} <image_url>\` or \`!uploadskin ${targetUserChar.name} ${grantSkinName} <rarity>\` to create it first.`);
          return;
        }
        
        if (!targetUserChar.ownedSkins) {
          targetUserChar.ownedSkins = ['default'];
        }
        
        if (targetUserChar.ownedSkins.includes(grantSkinName)) {
          await message.reply(`❌ <@${skinTargetUser.id}> already owns the **${grantSkinName}** skin for **${targetUserChar.name}**!`);
          return;
        }
        
        targetUserChar.ownedSkins.push(grantSkinName);
        saveData(data);
        
        await message.reply(`✅ Granted **${grantSkinName}** skin for **${targetUserChar.name} ${targetUserChar.emoji}** to <@${skinTargetUser.id}>!\nThey can equip it using: \`!equipskin ${targetUserChar.name} ${grantSkinName}\``);
        break;
        
      case 'revokeskin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const revokeSkinUser = message.mentions.users.first();
        const revokeSkinCharName = args[1];
        const revokeSkinName = args[2];
        
        if (!revokeSkinUser || !revokeSkinCharName || !revokeSkinName) {
          await message.reply('Usage: `!revokeskin @user <character> <skin_name>`');
          return;
        }
        
        if (revokeSkinName === 'default') {
          await message.reply('❌ You cannot revoke the default skin!');
          return;
        }
        
        if (!data.users[revokeSkinUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const revokeUserChar = data.users[revokeSkinUser.id].characters.find(c => 
          c.name.toLowerCase() === revokeSkinCharName.toLowerCase()
        );
        
        if (!revokeUserChar) {
          await message.reply('❌ That user doesn\'t own this character!');
          return;
        }
        
        if (!revokeUserChar.ownedSkins || !revokeUserChar.ownedSkins.includes(revokeSkinName)) {
          await message.reply(`❌ <@${revokeSkinUser.id}> doesn't own the **${revokeSkinName}** skin!`);
          return;
        }
        
        revokeUserChar.ownedSkins = revokeUserChar.ownedSkins.filter(s => s !== revokeSkinName);
        
        if (revokeUserChar.currentSkin === revokeSkinName) {
          revokeUserChar.currentSkin = 'default';
        }
        
        saveData(data);
        
        await message.reply(`✅ Revoked **${revokeSkinName}** skin for **${revokeUserChar.name} ${revokeUserChar.emoji}** from <@${revokeSkinUser.id}>!`);
        break;
        
      case 'deleteskin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const deleteCharName = args[0];
        const deleteSkinName = args[1];
        
        if (!deleteCharName || !deleteSkinName) {
          await message.reply('Usage: `!deleteskin <character> <skin_name>`\nExample: `!deleteskin Nix galaxy`');
          return;
        }
        
        if (deleteSkinName === 'default') {
          await message.reply('❌ You cannot delete the default skin!');
          return;
        }
        
        const foundDeleteChar = characterManager.getCharacterByName(deleteCharName);
        if (!foundDeleteChar) {
          await message.reply('❌ Character not found!');
          return;
        }
        
        const { removeSkinFromCharacter } = require('./skinSystem.js');
        const { deleteUSTSkin } = require('./cosmeticsShopSystem.js');
        
        const deletedOld = await removeSkinFromCharacter(foundDeleteChar.name, deleteSkinName);
        const deletedUST = await deleteUSTSkin(foundDeleteChar.name, deleteSkinName);
        
        if (deletedOld || deletedUST) {
          await message.reply(`✅ Deleted skin **${deleteSkinName}** from **${foundDeleteChar.name} ${foundDeleteChar.emoji}**!\n\n⚠️ Note: Users who own this skin will still have it in their inventory until manually revoked.`);
        } else {
          await message.reply(`❌ Skin **${deleteSkinName}** not found for **${foundDeleteChar.name}**!`);
        }
        break;
        
      case 'uploadskin':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const uploadCharName = args[0];
        const uploadSkinName = args[1];
        const uploadRarity = args[2]?.toLowerCase();
        const uploadCustomCost = args[3] ? parseInt(args[3]) : null;
        
        if (!uploadCharName || !uploadSkinName || !uploadRarity) {
          await message.reply('**Upload Skin to UST Shop**\n\nUsage: `!uploadskin <character> <skin_name> <rarity> [custom_cost] [link/exclusive]`\n\nYou can either **attach an image** OR provide an **image link**\n\n**Rarities:** common, rare, ultra rare, epic, legendary\n**Default Costs:** common (10), rare (25), ultra rare (50), epic (100), legendary (200)\n**Exclusive:** Add "exclusive" at the end to make it non-purchasable\n\n**Examples:**\n`!uploadskin Nix Galaxy legendary` (with attachment)\n`!uploadskin Nix Galaxy legendary https://example.com/image.png` (with link)\n`!uploadskin Nix Galaxy legendary exclusive` (with attachment, exclusive)\n`!uploadskin Nix Galaxy legendary 150 https://example.com/image.png` (link + custom cost)');
          return;
        }
        
        const validRarities = ['common', 'rare', 'ultra rare', 'epic', 'legendary'];
        if (!validRarities.includes(uploadRarity)) {
          await message.reply('❌ Invalid rarity! Use: common, rare, ultra rare, epic, or legendary');
          return;
        }
        
        // Find exclusive flag and link in remaining args
        let isExclusive = false;
        let imageLink = null;
        
        for (let i = 3; i < args.length; i++) {
          if (args[i]?.toLowerCase() === 'exclusive') {
            isExclusive = true;
          } else if (args[i]?.startsWith('http://') || args[i]?.startsWith('https://')) {
            imageLink = args[i];
          }
        }
        
        // Get image URL - either from attachment or link
        let discordCdnUrl;
        
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();
          const isImage = attachment.contentType?.startsWith('image/') || 
                         /\.(png|jpe?g|gif|webp)$/i.test(attachment.name);
          
          if (!isImage) {
            await message.reply('❌ The attachment must be an image file (PNG, JPG, GIF, or WEBP)!');
            return;
          }
          
          discordCdnUrl = attachment.url;
        } else if (imageLink) {
          // Validate link is an image
          if (!/(png|jpe?g|gif|webp)$/i.test(imageLink)) {
            await message.reply('❌ The link must point to an image file (PNG, JPG, GIF, or WEBP)!');
            return;
          }
          discordCdnUrl = imageLink;
        } else {
          await message.reply('❌ Please either **attach an image** or provide an **image link**!\n\n**Examples:**\n`!uploadskin Nix Galaxy legendary` (with attachment)\n`!uploadskin Nix Galaxy legendary https://example.com/image.png` (with link)');
          return;
        }
        
        const foundUploadChar = characterManager.getCharacterByName(uploadCharName);
        if (!foundUploadChar) {
          await message.reply('❌ Character not found!');
          return;
        }
        
        const { addSkinToCatalog, RARITY_EMOJIS } = require('./cosmeticsShopSystem.js');
        const skinAddResult = await addSkinToCatalog(foundUploadChar.name, uploadSkinName, uploadRarity, discordCdnUrl, uploadCustomCost, isExclusive);
        
        if (skinAddResult.success) {
          const uploadEmbed = new EmbedBuilder()
            .setColor('#9C27B0')
            .setTitle(`✅ Skin Added to UST Shop!`)
            .setDescription(`${skinAddResult.message}\n\nThis skin is now available in the UST shop for all players who own ${foundUploadChar.name}!`)
            .addFields(
              { name: 'Character', value: `${foundUploadChar.name} ${foundUploadChar.emoji}`, inline: true },
              { name: 'Skin Name', value: uploadSkinName, inline: true },
              { name: 'Rarity', value: `${RARITY_EMOJIS[uploadRarity]} ${uploadRarity}`, inline: true }
            )
            .setImage(discordCdnUrl)
            .setFooter({ text: 'Players can purchase this in !ustshop' });
          
          await message.reply({ embeds: [uploadEmbed] });
        } else {
          await message.reply(skinAddResult.message);
        }
        break;
        
      case 'setworkimage':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const workJob = args[0]?.toLowerCase();
        const workImageUrl = args[1];
        
        if (!workJob || !workImageUrl) {
          await message.reply(
            '**Set Work Image**\n\n' +
            'Usage: `!setworkimage <job> <image_url>`\n\n' +
            '**Available jobs:** drill, room, axe, whistle, binoculars\n' +
            '**Examples:**\n' +
            '`!setworkimage drill https://example.com/drill.png`\n' +
            '`!setworkimage room https://example.com/caretaker.png`'
          );
          return;
        }
        
        const validJobs = ['drill', 'room', 'axe', 'whistle', 'binoculars'];
        if (!validJobs.includes(workJob)) {
          await message.reply(`❌ Invalid job! Available: ${validJobs.join(', ')}`);
          return;
        }
        
        if (!data.workImages) {
          data.workImages = {};
        }
        
        data.workImages[workJob] = workImageUrl;
        await saveDataImmediate(data);
        
        const workImageEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle(`✅ Work Image Set!`)
          .setDescription(`Set image for **${workJob}** work type!`)
          .setImage(workImageUrl)
          .setFooter({ text: `Users can view with !showwork ${workJob}` });
        
        await message.reply({ embeds: [workImageEmbed] });
        break;
        
      case 'showwork':
        const showJob = args[0]?.toLowerCase();
        
        if (!showJob) {
          await message.reply(
            '**Show Work Images**\n\n' +
            'Usage: `!showwork <job>`\n\n' +
            '**Available jobs:**\n' +
            '• drill - Mining drill\n' +
            '• room - Caretaker room\n' +
            '• axe - Farming axe\n' +
            '• whistle - Zookeeper whistle\n' +
            '• binoculars - Ranger binoculars\n\n' +
            '**Example:** `!showwork drill`'
          );
          return;
        }
        
        const jobMapping = {
          'drill': 'Miner - Drill ⛏️',
          'room': 'Caretaker - Room 🏠',
          'axe': 'Farmer - Axe 🌾',
          'whistle': 'Zookeeper - Whistle 🦁',
          'binoculars': 'Ranger - Binoculars 🔭'
        };
        
        if (!jobMapping[showJob]) {
          await message.reply(`❌ Invalid job! Available: ${Object.keys(jobMapping).join(', ')}`);
          return;
        }
        
        if (!data.workImages || !data.workImages[showJob]) {
          await message.reply(`❌ No image set for **${showJob}**!\n\n✨ Admins can set one with: \`!setworkimage ${showJob} <image_url>\``);
          return;
        }
        
        const showWorkEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle(jobMapping[showJob])
          .setImage(data.workImages[showJob])
          .setFooter({ text: 'Work images set by admins' });
        
        await message.reply({ embeds: [showWorkEmbed] });
        break;
        
      case 'assignwork':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const assignUser = message.mentions.users.first();
        const assignJob = args[1]?.toLowerCase();
        
        if (!assignUser || !assignJob) {
          await message.reply(
            '**Assign Work**\n\n' +
            'Usage: `!assignwork @user <job>`\n\n' +
            '**Available jobs:** miner, caretaker, farmer, zookeeper, ranger\n' +
            '**Example:** `!assignwork @user miner`'
          );
          return;
        }
        
        if (!data.users[assignUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        if (!JOBS[assignJob]) {
          await message.reply(`❌ Invalid job! Available: ${JOB_LIST.join(', ')}`);
          return;
        }
        
        initializeWorkData(data.users[assignUser.id]);
        
        const assignWorkCheck = canWork(data.users[assignUser.id]);
        if (!assignWorkCheck.canWork) {
          await message.reply(`⏰ <@${assignUser.id}> is tired! They must rest for ${assignWorkCheck.timeLeft}`);
          return;
        }
        
        data.users[assignUser.id].work.currentJob = assignJob;
        data.users[assignUser.id].work.jobStartTime = Date.now();
        
        await saveDataImmediate(data);
        
        const assignedJob = JOBS[assignJob];
        await message.reply(`✅ Assigned **${assignedJob.emoji} ${assignedJob.name}** job to <@${assignUser.id}>!\n\nThey can complete it with \`!work\``);
        break;
        
      case 'equipskin':
        const equipCharName = args[0];
        const equipSkinName = args[1];
        
        if (!equipCharName || !equipSkinName) {
          await message.reply('Usage: `!equipskin <character> <skin_name>`\nExample: `!equipskin Nix galaxy`');
          return;
        }
        
        const userCharToEquip = data.users[userId].characters.find(c => 
          c.name.toLowerCase() === equipCharName.toLowerCase()
        );
        
        if (!userCharToEquip) {
          await message.reply('❌ You don\'t own this character!');
          return;
        }
        
        if (!userCharToEquip.ownedSkins) {
          userCharToEquip.ownedSkins = ['default'];
        }
        
        if (!userCharToEquip.ownedSkins.includes(equipSkinName)) {
          await message.reply(`❌ You don't own the **${equipSkinName}** skin for **${userCharToEquip.name}**!\nYour owned skins: ${userCharToEquip.ownedSkins.join(', ')}`);
          return;
        }
        
        userCharToEquip.currentSkin = equipSkinName;
        saveData(data);
        
        const equipSkinUrl = await getSkinUrl(userCharToEquip.name, equipSkinName);
        const equipEmbed = new EmbedBuilder()
          .setColor('#E91E63')
          .setTitle(`🎨 Skin Equipped!`)
          .setDescription(`**${userCharToEquip.emoji} ${userCharToEquip.name}** is now wearing the **${equipSkinName}** skin!`)
          .setImage(equipSkinUrl);
        
        await message.reply({ embeds: [equipEmbed] });
        break;
        
      case 'setprofilepic':
      case 'setpfp':
        const firstArg = args[0];
        
        if (!firstArg) {
          await message.reply('**Usage:**\n`!setpfp <character>` - Set a character as your profile picture\n`!setpfp <pfp name>` - Set a custom PFP from your collection\n\nExamples:\n`!setpfp Nix`\n`!setpfp Winner Badge`');
          return;
        }
        
        const pfpNameToSet = args.join(' ');
        
        const ownedChar = data.users[userId].characters.find(c => 
          c.name.toLowerCase() === pfpNameToSet.toLowerCase()
        );
        
        if (ownedChar) {
          const { initializePfpData } = require('./pfpSystem.js');
          const pfpData = initializePfpData(data.users[userId]);
          pfpData.equippedPfp = null;
          
          data.users[userId].profileDisplayCharacter = ownedChar.name;
          await saveDataImmediate(data);
          
          const profilePicUrl = await getSkinUrl(ownedChar.name, ownedChar.currentSkin || 'default');
          const pfpEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🖼️ Profile Picture Updated!')
            .setDescription(`Your profile will now display **${ownedChar.emoji} ${ownedChar.name}** with the **${ownedChar.currentSkin || 'default'}** skin!\n\nUse \`!profile\` to see your updated profile.`)
            .setThumbnail(profilePicUrl);
          
          await message.reply({ embeds: [pfpEmbed] });
        } else {
          const result = await equipPfpByName(userId, pfpNameToSet, data);
          
          if (!result.success) {
            await message.reply(result.message);
            return;
          }
          
          const pfpData = getUserPfps(userId, data);
          const equippedPfp = pfpData.ownedPfps.find(p => p.name.toLowerCase() === pfpNameToSet.toLowerCase());
          
          if (equippedPfp) {
            const pfpSetEmbed = new EmbedBuilder()
              .setColor('#FF69B4')
              .setTitle('🖼️ Profile Picture Updated!')
              .setDescription(`${result.message}\n\nYour profile will now display **${equippedPfp.name}**!\n\nUse \`!profile\` to see your updated profile.`)
              .setThumbnail(equippedPfp.url);
            
            await message.reply({ embeds: [pfpSetEmbed] });
          } else {
            await message.reply(result.message);
          }
        }
        break;
        
      case 'b':
      case 'battle':
        const battleArg = args[0]?.toLowerCase();
        
        if (battleArg === 'ai' || battleArg === 'easy' || battleArg === 'normal' || battleArg === 'hard') {
          if (serverId && !isMainServer(serverId)) {
            const mainServerEmbed = new EmbedBuilder()
              .setColor('#FF6B35')
              .setTitle('⚔️ AI Battles - Main Server Only!')
              .setDescription(`AI battles are exclusive to our main server!\n\n**Main Server Features:**\n⚡ Faster drops (20s vs 30s)\n🤖 AI battle system\n🦁 Zoo raids every hour\n🎯 More events and rewards\n\n[Join our main server to unlock these features!](https://discord.gg/yourinvitelink)`)
              .setFooter({ text: 'You can still battle other players with !battle @user' });
            
            await message.reply({ embeds: [mainServerEmbed] });
            return;
          }
          
          const difficulty = (battleArg === 'easy' || battleArg === 'normal' || battleArg === 'hard') ? battleArg : 'normal';
          const { startAIBattle } = require('./aiBattleSystem.js');
          await startAIBattle(message, data, userId, client.user.id, difficulty);
          return;
        }
        
        const battleOpponent = message.mentions.users.first();
        
        if (!battleOpponent) {
          await message.reply('Usage: `!b @user` to challenge someone\n`!b ai` for AI battle (normal difficulty)\n`!b easy/normal/hard` for AI with difficulty');
          return;
        }
        
        if (battleOpponent.id === userId) {
          await message.reply('❌ You can\'t battle yourself! Use `!b ai` for an AI battle.');
          return;
        }
        
        if (battleOpponent.bot) {
          await message.reply('❌ You can\'t battle a bot!');
          return;
        }
        
        await initiateBattle(message, data, userId, battleOpponent.id);
        break;
        
      case 'ustshop':
      case 'skinshop':
        if (!data.users[userId].started) {
          await message.reply('❌ You must start first! Use `!start` to begin.');
          return;
        }
        const { openUSTShop } = require('./cosmeticsShopSystem.js');
        await openUSTShop(message, data);
        break;
      
      case 'addcosmetic':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const cosmType = args[0]?.toLowerCase();
        const cosmChar = args[1];
        const cosmName = args[2];
        const cosmTier = args[3]?.toLowerCase();
        const cosmPrice = parseInt(args[4]);
        const cosmUrl = args[5];
        
        if (!cosmType || !['skin', 'pfp'].includes(cosmType)) {
          await message.reply('Usage: `!addcosmetic <type> <character> <name> <tier> <price> <imageURL>`\nType: skin or pfp\nTiers: common, rare, ultra_rare, epic, legendary, exclusive\nExample: `!addcosmetic skin Nix "Cosmic" legendary 200 https://i.imgur.com/example.png`');
          return;
        }
        
        if (!cosmChar || !cosmName || !cosmTier || !cosmPrice || !cosmUrl) {
          await message.reply('Usage: `!addcosmetic <type> <character> <name> <tier> <price> <imageURL>`\nTiers: common, rare, ultra_rare, epic, legendary, exclusive\nExample: `!addcosmetic skin Nix "Cosmic" legendary 200 https://i.imgur.com/example.png`');
          return;
        }
        
        const cosmAddResult = await addCosmeticItem(cosmType, cosmChar, cosmName, cosmUrl, cosmTier, cosmPrice, data);
        await message.reply(cosmAddResult.message);
        break;
      
      case 'removecosmetic':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const remType = args[0]?.toLowerCase();
        const remChar = args[1];
        const remName = args[2];
        
        if (!remType || !['skin', 'pfp'].includes(remType) || !remChar || !remName) {
          await message.reply('Usage: `!removecosmetic <type> <character> <name>`\nExample: `!removecosmetic skin Nix "Cosmic"`');
          return;
        }
        
        const cosmRemResult = await removeCosmeticItem(remType, remChar, remName);
        await message.reply(cosmRemResult.message);
        break;
      
      case 'updatecosmeticprice':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const upType = args[0]?.toLowerCase();
        const upChar = args[1];
        const upName = args[2];
        const upPrice = parseInt(args[3]);
        
        if (!upType || !['skin', 'pfp'].includes(upType) || !upChar || !upName || !upPrice) {
          await message.reply('Usage: `!updatecosmeticprice <type> <character> <name> <newPrice>`\nExample: `!updatecosmeticprice skin Nix "Cosmic" 250`');
          return;
        }
        
        const cosmUpResult = await updateCosmeticPrice(upType, upChar, upName, upPrice);
        await message.reply(cosmUpResult.message);
        break;
        
      case 'i':
      case 'info':
        const infoCharName = args.join(' ').toLowerCase();
        
        if (!infoCharName) {
          await message.reply('Usage: `!info <character name>` - View any character (even if you don\'t own it!)');
          return;
        }
        
        const userInfoChar = data.users[userId].characters.find(c => 
          c.name.toLowerCase() === infoCharName
        );
        
        // If user owns it, show full battle details
        if (userInfoChar) {
          if (!userInfoChar.moves || !userInfoChar.baseHp) {
            await message.reply('❌ This character doesn\'t have battle data yet! It will be added automatically.');
            return;
          }
          
          const moves = userInfoChar.moves;
          const movesList = [
            `**Special:** ${getMoveDisplay(moves.special, userInfoChar.level, userInfoChar.st, true)}`,
            `**Move 1:** ${getMoveDisplay(moves.tierMoves[0], userInfoChar.level, userInfoChar.st, false)}`,
            `**Move 2:** ${getMoveDisplay(moves.tierMoves[1], userInfoChar.level, userInfoChar.st, false)}`
          ].join('\n');
          
          const infoSkinUrl = await getSkinUrl(userInfoChar.name, userInfoChar.currentSkin || 'default');
          const abilityDesc = getAbilityDescription(userInfoChar.name);
          
          const infoEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle(`${userInfoChar.emoji} ${userInfoChar.name}`)
            .setImage(infoSkinUrl)
            .setDescription(`**Level:** ${userInfoChar.level}\n**ST:** ${userInfoChar.st}%\n**HP:** ${userInfoChar.baseHp}\n**Tokens:** ${userInfoChar.tokens}\n**Skin:** ${userInfoChar.currentSkin || 'default'}`)
            .addFields(
              { name: '✨ Ability', value: abilityDesc, inline: false },
              { name: '⚔️ Moves', value: movesList, inline: false },
              { name: '📊 Battle Info', value: `Energy system: Moves cost ⚡\nCritical hits: 15% base chance\nSpecial moves cost more energy but deal more damage`, inline: false }
            );
          
          await message.reply({ embeds: [infoEmbed] });
          return;
        }
        
        // Otherwise show general character info (even if not owned)
        const genCharData = characterManager.getCharacterByName(infoCharName);
        if (!genCharData) {
          await message.reply(`❌ Character **${infoCharName}** not found!`);
          return;
        }
        
        const genAbility = getCharacterAbility(genCharData.name);
        const genSkinUrl = await getSkinUrl(genCharData.name, 'default');
        
        const genInfoEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle(`${genCharData.emoji} ${genCharData.name}`)
          .setImage(genSkinUrl)
          .addFields(
            { name: '📍 Availability', value: genCharData.obtainable === 'starter' ? '⭐ **Starter Character**' : '📦 **Crate Only**', inline: true }
          );
        
        if (genAbility) {
          genInfoEmbed.addFields({
            name: `${genAbility.emoji} Special Ability: ${genAbility.name}`,
            value: genAbility.description,
            inline: false
          });
        }
        
        genInfoEmbed.setDescription(`You don't own this character yet.\n\n💡 Tip: Use \`!crate\` to try unlocking it!`)
          .setFooter({ text: 'Interested? Get this character from crates!' });
        
        await message.reply({ embeds: [genInfoEmbed] });
        break;
        
      case 'quests': {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
  
  const user = data.users[userId];
  const availableQuests = getAvailableQuests(user);
  const questsPerPage = 5;
  const totalQuestPages = Math.ceil(availableQuests.length / questsPerPage);
  let currentPage = 1;

  // --- Embed builder ---
  const buildQuestEmbed = (page) => {
    const startIdx = (page - 1) * questsPerPage;
    const endIdx = startIdx + questsPerPage;
    const questsToShow = availableQuests.slice(startIdx, endIdx);
    const completedCount = user.completedQuests?.length || 0;
    const questsList = questsToShow.map(q => formatQuestDisplay(user, q)).join('\n\n') || 'No quests available!';

    return new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('📜 Quest Log')
      .setDescription(`**Completed:** ${completedCount}/${QUESTS.length}\n\n${questsList}`)
      .setFooter({ text: `Page ${page}/${totalQuestPages} | Use !quest <id> for details` });
  };

  // --- Button row ---
  const buildButtons = (page) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId('close')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('next')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalQuestPages)
    );
  };

  // --- Send initial embed with buttons ---
  const messageWithButtons = await message.reply({
    embeds: [buildQuestEmbed(currentPage)],
    components: [buildButtons(currentPage)]
  });

  // --- Collector to handle clicks ---
  const collector = messageWithButtons.createMessageComponentCollector({
    time: 120000 // 2 mins
  });

  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== userId) {
      await interaction.reply({ content: "❌ This isn't your quest log!", flags: 64 });
      return;
    }

    if (interaction.customId === 'prev' && currentPage > 1) currentPage--;
    else if (interaction.customId === 'next' && currentPage < totalQuestPages) currentPage++;
    else if (interaction.customId === 'close') {
      await interaction.message.delete().catch(() => {});
      collector.stop('closed');
      return;
    }

    await interaction.update({
      embeds: [buildQuestEmbed(currentPage)],
      components: [buildButtons(currentPage)]
    });
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'closed') return;
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('close').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(true),
      new ButtonBuilder().setCustomId('next').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );

    await messageWithButtons.edit({ components: [disabledRow] }).catch(() => {});
  });

  break;
      }
        
      case 'quest':
        const questId = parseInt(args[0]);
        
        if (!questId) {
          await message.reply('Usage: `!quest <id>`');
          return;
        }
        
        const quest = QUESTS.find(q => q.id === questId);
        
        if (!quest) {
          await message.reply('❌ Quest not found!');
          return;
        }
        
        const questDisplay = formatQuestDisplay(data.users[userId], quest);
        const canClaim = canClaimQuest(data.users[userId], quest);
        
        const questDetailEmbed = new EmbedBuilder()
          .setColor(canClaim ? '#2ECC71' : '#95A5A6')
          .setTitle(`📜 Quest #${quest.id}`)
          .setDescription(questDisplay)
          .setFooter({ text: canClaim ? 'Use !claim ' + quest.id + ' to claim rewards!' : 'Complete the quest to claim rewards' });
        
        await message.reply({ embeds: [questDetailEmbed] });
        break;
        
      case 'claim':
        const claimQuestId = parseInt(args[0]);
        
        if (!claimQuestId) {
          await message.reply('Usage: `!claim <quest id>`');
          return;
        }
        
        const questToClaim = QUESTS.find(q => q.id === claimQuestId);
        
        if (!questToClaim) {
          await message.reply('❌ Quest not found!');
          return;
        }
        
        const claimResult = claimQuest(data.users[userId], questToClaim);
        
        if (claimResult.success) {
          // Track season daily task progress for quests completed
          updateTaskProgress(data.users[userId], 'questsCompleted', 1);
          
          await saveDataImmediate(data);
          const claimEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🎉 Quest Completed!')
            .setDescription(`**${questToClaim.name}**\n\n${claimResult.message}`);
          
          await message.reply({ embeds: [claimEmbed] });
        } else {
          await message.reply(`❌ ${claimResult.message}`);
        }
        break;
        
      case 'claimall':
        const claimAllResult = claimAllQuests(data.users[userId]);
        
        if (!claimAllResult.success) {
          await message.reply(claimAllResult.message);
          return;
        }
        
        // Track season daily task progress for quests completed
        if (claimAllResult.claimedCount > 0) {
          updateTaskProgress(data.users[userId], 'questsCompleted', claimAllResult.claimedCount);
        }
        
        await saveDataImmediate(data);
        
        const claimAllEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🎉 Multiple Quests Completed!')
          .setDescription(`Successfully claimed **${claimAllResult.claimedCount}** quest${claimAllResult.claimedCount > 1 ? 's' : ''}!\n\n**Total Rewards:**\n${claimAllResult.rewardsText}`)
          .addFields({ name: 'Claimed Quests:', value: claimAllResult.questNames.map((name, i) => `${i + 1}. ${name}`).join('\n').slice(0, 1024) || 'None', inline: false })
          .setFooter({ text: 'Great job completing multiple quests!' });
        
        await message.reply({ embeds: [claimAllEmbed] });
        break;
        
      case 'shards':
        const shardInfo = getBoosterInfo(data.users[userId]);
        
        const shardEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('🔷 ST Booster System')
          .setDescription(`**Shards:** ${shardInfo.shards}\n**ST Boosters:** ${shardInfo.boosters}\n**Total Boosts Used:** ${shardInfo.boostsUsed}`)
          .addFields(
            { name: '📦 Crafting', value: `Cost: 100 shards per booster\n${shardInfo.canCraft ? '✅ Ready to craft!' : `❌ Need ${shardInfo.shardsNeeded} more shards`}`, inline: false },
            { name: '⚠️ How It Works', value: '**ST Boosters completely re-roll your character\'s ST!**\n• Limit: 3 boosts per character\n• **Risk:** Higher chance to DECREASE ST\n• Low ST (0-50): 60% improve, 40% decrease\n• Medium ST (50-75): 45% improve, 55% decrease\n• High ST (75-90): 25% improve, 75% decrease\n• **Very High ST (90+): 10% improve, 90% decrease!**', inline: false },
            { name: '💡 Commands', value: '`!craft` - Craft a booster (100 shards)\n`!boost <character>` - Use a booster (risky!)', inline: false }
          );
        
        await message.reply({ embeds: [shardEmbed] });
        break;
        
      case 'craft':
        const craftResult = craftBooster(data.users[userId]);
        
        if (craftResult.success) {
          await saveDataImmediate(data);
          await message.reply(craftResult.message);
        } else {
          await message.reply(craftResult.message);
        }
        break;
        
      case 'boost':
        const boostCharName = args.join(' ').toLowerCase();
        
        if (!boostCharName) {
          await message.reply('Usage: `!boost <character name>`\n\n⚠️ **Warning:** ST Boosters RE-ROLL your ST completely! Higher ST = higher chance to DECREASE!');
          return;
        }
        
        const boostResult = useBooster(data.users[userId], boostCharName);
        
        if (boostResult.success) {
          await saveDataImmediate(data);
          
          const changeSymbol = boostResult.increased ? '+' : '';
          const changeDisplay = `${changeSymbol}${boostResult.change}%`;
          
          const boostEmbed = new EmbedBuilder()
            .setColor(boostResult.resultColor)
            .setTitle(`${boostResult.resultEmoji} ST RE-ROLLED!`)
            .setDescription(`**${boostResult.resultText}**\n\n${boostResult.emoji} **${boostResult.character}**\n${boostResult.oldST}% → **${boostResult.newST}%** (${changeDisplay})\n\n💪 HP recalculated!\n🔢 Boosts used: ${boostResult.boostCount}/3\n⚡ Remaining boosts: ${boostResult.remainingBoosts}`);
          
          await message.reply({ embeds: [boostEmbed] });
        } else {
          await message.reply(boostResult.message);
        }
        break;
        
      case 'mail':
      case 'mailbox':
        const mailPage = parseInt(args[0]) || 1;
        const mailbox = data.users[userId].mailbox || [];
        const mailsPerPage = 5;
        const totalMailPages = Math.ceil(mailbox.length / mailsPerPage);
        const startMailIdx = (mailPage - 1) * mailsPerPage;
        const endMailIdx = startMailIdx + mailsPerPage;
        const mailsToShow = mailbox.slice(startMailIdx, endMailIdx);
        
        const unclaimedCount = getUnclaimedMailCount(data.users[userId]);
        
        const mailList = mailsToShow.map((m, i) => formatMailDisplay(m, startMailIdx + i)).join('\n\n');
        
        const mailEmbed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('📬 Mailbox')
          .setDescription(`**Unclaimed:** ${unclaimedCount}\n**Total Messages:** ${mailbox.length}\n\n${mailList || 'No mail yet!'}`)
          .setFooter({ text: `Page ${mailPage}/${totalMailPages || 1} | Use !claimmail <#> to claim rewards` });
        
        await message.reply({ embeds: [mailEmbed] });
        break;
        
      case 'claimmail':
        const mailIdx = parseInt(args[0]) - 1;
        
        if (isNaN(mailIdx)) {
          await message.reply('Usage: `!claimmail <mail number>`');
          return;
        }
        
        const claimMailResult = claimMail(data.users[userId], mailIdx);
        
        if (claimMailResult.success) {
          saveData(data);
          
          const claimMailEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('📬 Mail Claimed!')
            .setDescription(`${claimMailResult.message}\n\n${claimMailResult.rewards.join('\n')}`);
          
          await message.reply({ embeds: [claimMailEmbed] });
        } else {
          await message.reply(claimMailResult.message);
        }
        break;
        
      case 'clearmail':
        const clearMailResult = clearClaimedMail(data.users[userId]);
        
        if (clearMailResult.success) {
          await saveDataImmediate(data);
          await message.reply(clearMailResult.message);
        } else {
          await message.reply(clearMailResult.message);
        }
        break;
        
      case 'sendmail':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const fullMailText = args.join(' ');
        if (!fullMailText.includes(' | ')) {
          await message.reply('📨 **Send Mail to All Players**\n\nFormat: `!sendmail <message> | coins:<amount> gems:<amount> shards:<amount> character:<name> goldcrates:<amount> ...`\n\nExample: `!sendmail Happy holidays! | coins:500 gems:50 shards:5`');
          return;
        }
        
        const [mailMsg, rewardsText] = fullMailText.split(' | ');
        const rewards = {};
        
        const rewardParts = rewardsText.split(' ');
        for (const part of rewardParts) {
          if (part.includes(':')) {
            const [key, value] = part.split(':');
            if (['coins', 'gems', 'shards', 'goldCrates', 'emeraldCrates', 'legendaryCrates', 'tyrantCrates', 'bronzeCrates', 'silverCrates'].includes(key)) {
              rewards[key] = parseInt(value);
            } else if (key === 'character') {
              rewards.character = value;
            }
          }
        }
        
        const mail = sendMailToAll(mailMsg, rewards, message.author.username);
        let mailCount = 0;
        let dmCount = 0;
        
        for (const uid in data.users) {
          if (data.users[uid].started) {
            addMailToUser(data.users[uid], mail);
            mailCount++;
            
            try {
              const targetUser = await client.users.fetch(uid);
              const dmEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('📬 You have new mail!')
                .setDescription(`From: **${mail.from}**\n\n${mail.message}`)
                .setFooter({ text: 'Use !mail to view and claim your rewards!' });
              
              await targetUser.send({ embeds: [dmEmbed] });
              dmCount++;
            } catch (error) {
              console.log(`Could not send DM to user ${uid}`);
            }
          }
        }
        
        saveData(data);
        await message.reply(`✅ Sent mail to ${mailCount} players! (${dmCount} DM notifications sent)`);
        break;
        
      case 'news':
        const newsCount = parseInt(args[0]) || 5;
        const latestNews = getLatestNews(Math.min(newsCount, 10));
        
        if (latestNews.length === 0) {
          await message.reply('📰 No news yet!');
          return;
        }
        
        const newsList = latestNews.map(n => formatNewsDisplay(n)).join('\n\n─────────────\n\n');
        
        const newsEmbed = new EmbedBuilder()
          .setColor('#1ABC9C')
          .setTitle('📰 Latest News')
          .setDescription(newsList)
          .setFooter({ text: 'Stay updated with the latest announcements!' });
        
        await message.reply({ embeds: [newsEmbed] });
        break;
        
      case 'postnews':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const fullNewsText = args.join(' ');
        if (!fullNewsText.includes(' | ')) {
          await message.reply('📰 **Post News**\n\nFormat: `!postnews <title> | <content>`\n\nExample: `!postnews New Features! | Quests and ST Boosters are now available!`');
          return;
        }
        
        const [newsTitle, newsContent] = fullNewsText.split(' | ');
        
        if (!newsTitle || !newsContent) {
          await message.reply('❌ Both title and content are required!');
          return;
        }
        
        postNews(newsTitle, newsContent);
        
        let newsDmCount = 0;
        for (const uid in data.users) {
          if (data.users[uid].started) {
            try {
              const targetUser = await client.users.fetch(uid);
              const newsEmbed = new EmbedBuilder()
                .setColor('#1ABC9C')
                .setTitle(`📰 ${newsTitle}`)
                .setDescription(newsContent)
                .setFooter({ text: 'Use !news to view all announcements!' });
              
              await targetUser.send({ embeds: [newsEmbed] });
              newsDmCount++;
            } catch (error) {
              console.log(`Could not send DM to user ${uid}`);
            }
          }
        }
        
        await message.reply(`✅ News posted: **${newsTitle}** (${newsDmCount} DM notifications sent)`);
        break;
        
      case 'leaderboard':
      case 'lb':
        const lbType = args[0]?.toLowerCase() || 'coins';
        
        let lbData;
        let lbTitle;
        let lbType2;
        
        if (lbType === 'coins' || lbType === 'coin') {
          lbData = getTopCoins(data.users, 10);
          lbTitle = '💰 Top 10 - Coins';
          lbType2 = 'coins';
        } else if (lbType === 'gems' || lbType === 'gem') {
          lbData = getTopGems(data.users, 10);
          lbTitle = '💎 Top 10 - Gems';
          lbType2 = 'gems';
        } else if (lbType === 'battles' || lbType === 'battle' || lbType === 'wins') {
          lbData = getTopBattles(data.users, 10);
          lbTitle = '⚔️ Top 10 - Battle Wins';
          lbType2 = 'battles';
        } else if (lbType === 'collection' || lbType === 'chars' || lbType === 'characters') {
          lbData = getTopCollectors(data.users, 10);
          lbTitle = '🎭 Top 10 - Character Collection';
          lbType2 = 'collection';
        } else if (lbType === 'trophies' || lbType === 'trophy') {
          lbData = getTopTrophies(data.users, 10);
          lbTitle = '🏆 Top 10 - Trophies';
          lbType2 = 'trophies';
        } else {
          await message.reply('Usage: `!leaderboard <coins/gems/battles/collection/trophies>`');
          return;
        }
        
        const lbDisplay = formatLeaderboard(lbData, lbType2);
        
        const lbEmbed = new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle(lbTitle)
          .setDescription(lbDisplay || 'No data yet!')
          .setFooter({ text: 'Keep playing to climb the ranks!' });
        
        await message.reply({ embeds: [lbEmbed] });
        break;
        
      case 'daily':
        await claimDaily(message, data);
        if (data.users[userId]?.started) {
          updateTaskProgress(data.users[userId], 'dailyClaimed', 1);
          if (serverId) {
            const { addAura } = require('./serverAuraSystem.js');
            addAura(serverId, 10, 'daily_claim').catch(e => console.error('Error adding daily aura:', e));
          }
          await saveDataImmediate(data);
        }
        break;
      
      case 'season':
      case 'seasonpass':
      case 'sp':
        await showSeasonPass(message, data);
        break;
      
      case 'seasontasks':
      case 'stasks':
      case 'dailytasks':
      case 'dt':
        await showDailyTasks(message, data);
        break;
      
      case 'seasonrewards':
      case 'srewards':
        await showSeasonRewards(message, data);
        break;
      
      case 'taskclaimall':
      case 'tclaim':
        await claimAllTaskRewardsCommand(message, data);
        break;
      
      case 'seasonclaimall':
      case 'sclaim':
        await claimAllSeasonRewardsCommand(message, data);
        break;
        
      case 'globalboard':
      case 'gboard':
      case 'globalleaderboard':
      case 'glb':
        if (!data.users[userId] || !data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await displayGlobalLeaderboard(message, args, data);
        break;
        
      case 'challenges':
      case 'challenge':
      case 'weekly':
      case 'weeklychallenges':
        if (!data.users[userId] || !data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await displayChallenges(message, data);
        break;
        
      case 'claimchallenge':
      case 'claimchal':
        if (!data.users[userId] || !data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await claimChallenge(message, args, data);
        break;
        
      case 'achievements':
      case 'badges':
      case 'achieve':
        if (!data.users[userId] || !data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await displayAchievements(message, data);
        break;
        
      case 'serverstats':
      case 'stats':
      case 'analytics':
        if (!isZooAdmin(message.member) && !isBotAdmin(userId) && !isSuperAdmin(userId)) {
          await message.reply('❌ Only ZooAdmins can view server stats!');
          return;
        }
        await displayServerStats(message, data);
        break;
        
      case 'coinduel':
      case 'coinflip':
        if (!data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await coinDuel(message, args, data);
        break;
        
      case 'diceclash':
      case 'dice':
        if (!data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await diceClash(message, args, data);
        break;
        
      case 'dooroffate':
      case 'door':
        if (!data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await doorOfFate(message, args, data);
        break;
        
      case 'almostwin':
      case 'slot':
      case 'roll':
        if (!data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await almostWinMachine(message, args, data);
        break;
        
      case 'rps':
      case 'rockpaperscissors':
        if (!data.users[userId].started) {
          await message.reply('❌ Start your journey with `!start` first!');
          return;
        }
        await rockPaperScissors(message, args, data);
        break;
        
      case 'event':
        const eventInfo = await eventSystem.getEventInfo(userId);

      
        if (eventInfo.status === 'no_event') {
          await message.reply('❌ No event is currently active.');
          return;
        }
        
        if (eventInfo.status === 'active') {
          const eventEmbed = new EmbedBuilder()
            .setColor('#00D9FF')
            .setTitle(`${eventInfo.displayName} - Active! 🎉`)
            .setDescription(eventInfo.description)
            .addFields(
              { name: '⏰ Time Remaining', value: eventInfo.timeRemaining, inline: true },
              { name: '👥 Participants', value: `${eventInfo.totalParticipants}`, inline: true }
            )
            .addFields(
              { name: '📊 Your Stats', value: `**Points:** ${eventInfo.userScore}`, inline: false }
            )
            .addFields(
              { name: '🏆 Prizes', value: '🥇 1st: 500 💎 + 5,000 💰\n🥈 2nd: 250 💎 + 2,500 💰\n🥉 3rd: 150 💎 + 1,500 💰\n🎖️ Top 5%: 75 💎 + 750 💰', inline: false }
            )
            .setTimestamp();
          
          await message.reply({ embeds: [eventEmbed] });
        } else if (eventInfo.status === 'ended') {
          const resultEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${eventInfo.displayName} - Results 🏁`)
            .setDescription('The event has ended! Here are your results:')
            .addFields(
              { name: '📊 Your Performance', value: `**Final Score:** ${eventInfo.userScore}\n**Final Rank:** ${eventInfo.userRank}`, inline: false }
            );
          
          if (eventInfo.leaderboard && eventInfo.leaderboard.length > 0) {
            const top3Text = eventInfo.leaderboard.map((p, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return `${medals[i]} **${p.username}** - ${p.score} points`;
            }).join('\n');
            
            resultEmbed.addFields({ name: '🏆 Top 3', value: top3Text, inline: false });
          }
          
          resultEmbed.addFields({ name: '📅 Next Event', value: 'A new event is starting soon!', inline: false });
          
          await message.reply({ embeds: [resultEmbed] });
        }
        break;

         
      case 'setbattle':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        data.battleChannel = message.channel.id;
        saveData(data);
        await message.reply(`✅ Battle channel set to ${message.channel}! Players can now use battle commands here.`);
        break;
        
      case 'settrophies':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const trophyUser = message.mentions.users.first();
        const trophyAmount = parseInt(args[1]);
        
        if (!trophyUser || isNaN(trophyAmount)) {
          await message.reply('Usage: `!settrophies @user <amount>`');
          return;
        }
        
        if (!data.users[trophyUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        data.users[trophyUser.id].trophies = Math.max(0, trophyAmount);
        saveData(data);
        
        await message.reply(`✅ Set <@${trophyUser.id}>'s trophies to **${trophyAmount}** 🏆`);
        break;
        
      case 'adminaddpfp':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can use this command!');
          return;
        }
        
        const targetUserForPfp = message.mentions.users.first();
        const adminPfpName = args.slice(1).join(' ');
        
        if (!targetUserForPfp || !adminPfpName) {
          await message.reply('❌ Usage: `!adminaddpfp @user <pfp_name>` (attach an image)');
          return;
        }
        
        if (!data.users[targetUserForPfp.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        if (message.attachments.size === 0) {
          await message.reply('❌ Please attach an image to add as their profile picture!');
          return;
        }
        
        const adminAttachment = message.attachments.first();
        if (!adminAttachment.contentType || !adminAttachment.contentType.startsWith('image/')) {
          await message.reply('❌ Please attach a valid image file!');
          return;
        }
        
        const adminPfpResult = await adminAddPfpToUser(targetUserForPfp.id, adminAttachment.url, adminPfpName, data);
        await message.reply(adminPfpResult.message);
        break;
        
      case 'adminremovepfp':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can use this command!');
          return;
        }
        
        const targetUserForRemove = message.mentions.users.first();
        const pfpIdToRemove = args[1];
        
        if (!targetUserForRemove || !pfpIdToRemove) {
          await message.reply('❌ Usage: `!adminremovepfp @user <pfp_id>`');
          return;
        }
        
        if (!data.users[targetUserForRemove.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const adminRemoveResult = await adminRemovePfpFromUser(targetUserForRemove.id, pfpIdToRemove, data);
        await message.reply(adminRemoveResult.message);
        break;
        
      case 'addtrivia':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can add trivia questions!');
          return;
        }
        
        if (message.attachments.size === 0) {
          await message.reply('❌ Please attach a character image!\nUsage: `!addtrivia <character name>` (with image attached)\n\nExample: `!addtrivia water jade` (attach image)');
          return;
        }
        
        const characterAnswer = args.join(' ');
        
        if (!characterAnswer) {
          await message.reply('❌ Please provide the character name!\nUsage: `!addtrivia <character name>` (with image attached)');
          return;
        }
        
        const triviaAttachment = message.attachments.first();
        
        if (!triviaAttachment.contentType || !triviaAttachment.contentType.startsWith('image/')) {
          await message.reply('❌ Please attach a valid image file (PNG, JPG, GIF, etc.)!');
          return;
        }
        
        const triviaImageUrl = triviaAttachment.url;
        
        const triviaAddResult = addTriviaQuestion(triviaImageUrl, characterAnswer, data);
        await saveDataImmediate(data);
        await message.reply(triviaAddResult.message);
        break;
        
      case 'removetrivia':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can remove trivia questions!');
          return;
        }
        
        const triviaIdToRemove = args[0];
        
        if (!triviaIdToRemove) {
          await message.reply('❌ Please provide a trivia question ID!\nUsage: `!removetrivia <question_id>`\n\nUse `!listtrivia` to see all questions and their IDs.');
          return;
        }
        
        const triviaRemoveResult = removeTriviaQuestion(triviaIdToRemove, data);
        
        if (triviaRemoveResult.success) {
          await saveDataImmediate(data);
        }
        
        await message.reply(triviaRemoveResult.message);
        break;
        
      case 'listtrivia':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can view all trivia questions!');
          return;
        }
        
        const allQuestions = listAllQuestions(data);
        
        if (allQuestions.length === 0) {
          await message.reply('📝 No trivia questions yet! Use `!addtrivia <question> | <answer>` to add some.');
          return;
        }
        
        const triviaListEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('📚 All Trivia Questions')
          .setDescription(`Total: **${allQuestions.length}** questions`);
        
        allQuestions.forEach((q, index) => {
          triviaListEmbed.addFields({
            name: `${index + 1}. Character Trivia`,
            value: `**Answer:** ${q.answer}\n**ID:** \`${q.id}\`\n**Image:** [View](${q.imageUrl})`,
            inline: false
          });
        });
        
        triviaListEmbed.setFooter({ text: 'Use !removetrivia <id> to remove a question' });
        
        await message.reply({ embeds: [triviaListEmbed] });
        break;
        
      case 'setevent':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        data.eventChannelId = message.channel.id;
        saveData(data);
        await message.reply(`✅ Event announcement channel set to ${message.channel}! All event start/end announcements will be posted here.`);
        break;

      case 'startevent':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can start events manually!');
          return;
        }
        
        const eventTypeArg = args[0]?.toLowerCase();
        let mappedEventType = null;
        
        if (eventTypeArg) {
          const eventTypeMap = {
            'trophy': 'trophy_hunt',
            'drop': 'drop_catcher',
            'crate': 'crate_master'
          };
          mappedEventType = eventTypeMap[eventTypeArg];
          
          if (!mappedEventType) {
            await message.reply('❌ Invalid event type! Use one of: `trophy`, `drop`, or `crate`\n\nExample: `!startevent trophy` or just `!startevent` for next in rotation.');
            return;
          }
        }
        
        const startResult = await eventSystem.startEventManually(mappedEventType);
        await message.reply(startResult.message);
        break;

      case 'stopevent':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only bot admins can stop events manually!');
          return;
        }
        
        const stopResult = await eventSystem.stopEventManually();
        await message.reply(stopResult.message);
        break;

      case 'eventschedule':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          const publicSchedule = await eventSystem.getScheduleInfo();
          const scheduleEmbed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('⏰ Event Schedule')
            .setDescription('Automatic event scheduling information')
            .addFields(
              { name: '📅 Status', value: publicSchedule.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
              { name: '🕐 Start Time', value: `${publicSchedule.startTime} ${publicSchedule.timezone}`, inline: true },
              { name: '🌏 Current Time (IST)', value: publicSchedule.currentISTTime, inline: true }
            )
            .setTimestamp();
          
          await message.reply({ embeds: [scheduleEmbed] });
          return;
        }
        
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
          const scheduleInfo = await eventSystem.getScheduleInfo();
          const scheduleEmbed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('⏰ Event Schedule Configuration')
            .setDescription('Manage automatic event scheduling')
            .addFields(
              { name: '📅 Status', value: scheduleInfo.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
              { name: '🕐 Start Time', value: `${scheduleInfo.startTime} ${scheduleInfo.timezone}`, inline: true },
              { name: '🌏 Current Time (IST)', value: scheduleInfo.currentISTTime, inline: true },
              { name: '📊 Last Run', value: scheduleInfo.lastRun, inline: false }
            )
            .addFields({
              name: '🔧 Available Commands',
              value: '`!eventschedule enable` - Enable automatic scheduling\n`!eventschedule disable` - Disable automatic scheduling\n`!eventschedule settime HH:MM` - Set event start time (IST)',
              inline: false
            })
            .setTimestamp();
          
          await message.reply({ embeds: [scheduleEmbed] });
        } else if (subCommand === 'enable') {
          const result = await eventSystem.toggleSchedule(true);
          await message.reply(result.message);
        } else if (subCommand === 'disable') {
          const result = await eventSystem.toggleSchedule(false);
          await message.reply(result.message);
        } else if (subCommand === 'settime') {
          const newTime = args[1];
          if (!newTime) {
            await message.reply('❌ Please provide a time in HH:MM format (e.g., `!eventschedule settime 05:30`)');
            return;
          }
          const result = await eventSystem.updateScheduleTime(newTime);
          await message.reply(result.message);
        } else {
          await message.reply('❌ Invalid subcommand. Use `!eventschedule` to see available options.');
        }
        break;
        
      case 'servers':
      case 'serverlist':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const guilds = client.guilds.cache.map(g => ({
          name: g.name,
          id: g.id,
          members: g.memberCount,
          owner: g.ownerId
        }));
        
        const serverListEmbed = new EmbedBuilder()
          .setColor('#FF6B35')
          .setTitle(`🌐 Bot Server List (${guilds.length} servers)`)
          .setDescription(guilds.map((g, i) => 
            `**${i + 1}.** ${g.name}\n└ ID: \`${g.id}\` | Members: ${g.members}${isMainServer(g.id) ? ' ⭐ **MAIN**' : ''}`
          ).join('\n\n'))
          .setFooter({ text: 'Use !removeserver <server_id> to remove bot from a server' });
        
        await message.reply({ embeds: [serverListEmbed] });
        break;
        
      case 'removeserver':
      case 'leaveserver':
      case 'deleteserver':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        const targetServerId = args[0];
        if (!targetServerId) {
          await message.reply('Usage: `!removeserver <server_id>`\n\n💡 Use `!servers` to see all server IDs');
          return;
        }
        
        if (isMainServer(targetServerId)) {
          await message.reply('❌ Cannot remove bot from the main server!');
          return;
        }
        
        const targetGuild = client.guilds.cache.get(targetServerId);
        if (!targetGuild) {
          await message.reply('❌ Bot is not in a server with that ID!');
          return;
        }
        
        const guildName = targetGuild.name;
        
        try {
          // Delete all MongoDB data for this server
          if (USE_MONGODB) {
            const mongoCollections = [
              'serverConfigs',
              'serverCharacters',
              'serverAddedCharacters',
              'serverCollectibles',
              'serverAddedCollectibles',
              'drops',
              'giveaways',
              'lotteries',
              'userAchievements',
              'seasonData',
              'clanData',
              'auctions',
              'marketListings',
              'events',
              'moderationData'
            ];
            
            for (const collectionName of mongoCollections) {
              try {
                const collection = await mongoManager.getCollection(collectionName);
                const deleteResult = await collection.deleteMany({ serverId: targetServerId });
                if (deleteResult.deletedCount > 0) {
                  console.log(`[ServerDeletion] Deleted ${deleteResult.deletedCount} documents from ${collectionName}`);
                }
              } catch (e) {
                console.warn(`[ServerDeletion] Could not clean ${collectionName}:`, e.message);
              }
            }
          }
          
          await targetGuild.leave();
          await message.reply(`✅ **Server Deleted:** ${guildName}\n\n📊 **Data Cleanup:**\n• Server configuration removed\n• All characters removed\n• All collectibles removed\n• Events, auctions, and market listings cleared\n• User progress for that server archived`);
        } catch (error) {
          await message.reply(`❌ Failed to delete server: ${error.message}`);
        }
        break;
        
      case 'reset':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ This command is restricted to Super Admins only!');
          return;
        }
        
        await message.reply('⚠️ **WARNING:** This will reset ALL bot data (all users, characters, progress)!\n\nType `!confirmreset` within 30 seconds to confirm.');
        
        const resetFilter = m => m.author.id === userId && m.content === '!confirmreset';
        const resetCollector = message.channel.createMessageCollector({ filter: resetFilter, time: 30000, max: 1 });
        
        resetCollector.on('collect', async () => {
          data.users = {};
          data.dropChannel = null;
          data.battleChannel = null;
          data.activeDrops = [];
          data.news = [];
          saveData(data);
          await message.reply('✅ **Bot data has been completely reset!** All users can now start fresh with `!start`.');
        });
        
        resetCollector.on('end', (collected, reason) => {
          if (reason === 'time' && collected.size === 0) {
            message.channel.send('❌ Reset cancelled - timed out.');
          }
        });
        break;
        
      case 'botinfo':
        const botInfoEmbed = new EmbedBuilder()
          .setColor('#FF6B35')
          .setTitle('🎮 About This Bot')
          .setDescription('**A Zooba-inspired game**\n\nA comprehensive Discord bot featuring character collection, turn-based battles, leveling, crates, trading, and competitive rankings!')
          .addFields(
            { name: '👨‍💻 Created By', value: '**TigerMask** (AKA Jaguar)\nMade with passion for the community!', inline: false },
            { name: '🎯 Purpose', value: 'This is a **fan-made, non-profit game** created purely for **entertainment purposes**. Enjoy collecting characters, battling friends, and climbing the leaderboards!', inline: false },
            { name: '🌟 Features', value: '• 51 unique characters to collect\n• Turn-based battle system\n• Character leveling & ST stats\n• Trophy-based competitive ranking\n• Daily rewards & message rewards\n• Trading system\n• Quests & achievements', inline: false },
            { name: '📚 Get Started', value: 'Type `!help` to see all commands\nType `!start` to begin your journey!', inline: false }
          )
          .setFooter({ text: 'Made for fun, played with friends! 🎮' });
        
        await message.reply({ embeds: [botInfoEmbed] });
        break;
        
      case 'ptsend':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const ptUser = message.mentions.users.first();
        if (!ptUser) {
          await message.reply('Usage: `!ptsend @user` - Send a personalized task to a user');
          return;
        }
        
        if (!data.users[ptUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        await sendPersonalizedTask(client, ptUser.id, data);
        await message.reply(`✅ Sent personalized task to <@${ptUser.id}>!`);
        break;
        
      case 'pttoggle':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const ptToggleUser = message.mentions.users.first();
        const toggleState = args[1]?.toLowerCase();
        
        if (!ptToggleUser || !['on', 'off'].includes(toggleState)) {
          await message.reply('Usage: `!pttoggle @user <on/off>` - Enable/disable personalized tasks for a user');
          return;
        }
        
        if (!data.users[ptToggleUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const enabled = toggleState === 'on';
        togglePersonalizedTasks(ptToggleUser.id, data, enabled);
        await saveData(data);
        
        await message.reply(`✅ Personalized tasks ${enabled ? 'enabled' : 'disabled'} for <@${ptToggleUser.id}>!`);
        break;
        
      case 'ptstats':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const ptStatsUser = message.mentions.users.first();
        if (!ptStatsUser) {
          await message.reply('Usage: `!ptstats @user` - View personalized task stats for a user');
          return;
        }
        
        if (!data.users[ptStatsUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const stats = getTaskStats(data.users[ptStatsUser.id]);
        const timeRemaining = stats.timeRemaining > 0 ? formatTime(stats.timeRemaining) : 'None';
        
        const statsEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`📊 Personalized Task Stats - ${data.users[ptStatsUser.id].username}`)
          .addFields(
            { name: '✅ Completed', value: `${stats.totalCompleted}`, inline: true },
            { name: '❌ Missed', value: `${stats.totalMissed}`, inline: true },
            { name: '⚙️ Status', value: stats.isActive ? 'Active' : 'Disabled', inline: true },
            { name: '📝 Current Task', value: stats.currentTask, inline: true },
            { name: '⏰ Time Remaining', value: timeRemaining, inline: true }
          );
        
        await message.reply({ embeds: [statsEmbed] });
        break;
        
      case 'ptcustom':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const customTaskUser = message.mentions.users.first();
        if (!customTaskUser || args.length < 3) {
          await message.reply('Usage: `!ptcustom @user <type> <amount> <difficulty>`\nExample: `!ptcustom @user drops 10 hard`\n\nTypes: drops, battles, crates, leveling, messages, trading\nDifficulties: easy, medium, hard');
          return;
        }
        
        if (!data.users[customTaskUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const taskType = args[1].toLowerCase();
        const taskAmount = args[2];
        const taskDifficulty = args[3]?.toLowerCase() || 'medium';
        
        // Create custom task
        const taskResult = createCustomTask(taskType, taskAmount, taskDifficulty);
        
        if (taskResult.error) {
          await message.reply(`❌ ${taskResult.error}`);
          return;
        }
        
        // Send custom task to user
        const sendResult = await sendCustomTask(client, customTaskUser.id, data, taskResult.task);
        
        if (sendResult.error) {
          await message.reply(`❌ ${sendResult.error}`);
          return;
        }
        
        await message.reply(`✅ Custom task sent to **${sendResult.username}**: ${taskResult.task.description}\n**Difficulty:** ${taskDifficulty}\n**Rewards:** ${formatReward(taskResult.task.reward)}`);
        break;
        
      case 'history':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const historyUser = message.mentions.users.first();
        if (!historyUser) {
          await message.reply('Usage: `!history @user [page]` - View transaction history for a user\nExample: `!history @user 1`');
          return;
        }
        
        if (!data.users[historyUser.id]) {
          await message.reply('❌ That user hasn\'t started yet!');
          return;
        }
        
        const historyPage = parseInt(args[1]) || 1;
        const historyData = getHistory(data.users[historyUser.id], 100);
        const historySummary = getHistorySummary(data.users[historyUser.id]);
        const historyOutput = formatHistory(historyData, historySummary, historyPage);
        
        try {
          const dmUser = await client.users.fetch(message.author.id);
          await dmUser.send(`**Transaction History for ${data.users[historyUser.id].username}**\n\n${historyOutput}`);
          await message.reply('📊 History sent to your DMs!');
        } catch (error) {
          await message.reply(historyOutput.substring(0, 2000));
        }
        break;
        
      case 'pttasks':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const difficultyFilter = args[0]?.toLowerCase();
        let tasksToShow = PERSONALIZED_TASKS;
        
        if (difficultyFilter && ['easy', 'medium', 'hard'].includes(difficultyFilter)) {
          tasksToShow = PERSONALIZED_TASKS.filter(t => t.difficulty === difficultyFilter);
        }
        
        if (tasksToShow.length === 0) {
          await message.reply('❌ No tasks found!');
          return;
        }
        
        // Send task list as DM to avoid channel spam
        try {
          const dmUser = await client.users.fetch(message.author.id);
          
          const taskPages = [];
          const tasksPerPage = 15;
          
          for (let i = 0; i < tasksToShow.length; i += tasksPerPage) {
            const pageTasks = tasksToShow.slice(i, i + tasksPerPage);
            const taskList = pageTasks.map(task => {
              const diffEmoji = task.difficulty === 'easy' ? '🟢' : task.difficulty === 'medium' ? '🟡' : '🔴';
              return `${diffEmoji} **${task.id}** - ${task.name}\n└ ${task.description}\n└ Reward: ${formatReward(task.reward)}\n└ Duration: ${formatTime(task.duration)}`;
            }).join('\n\n');
            
            const embed = new EmbedBuilder()
              .setColor('#3498DB')
              .setTitle(`📋 Available Tasks${difficultyFilter ? ` (${difficultyFilter})` : ''} - Page ${Math.floor(i / tasksPerPage) + 1}/${Math.ceil(tasksToShow.length / tasksPerPage)}`)
              .setDescription(taskList)
              .setFooter({ text: `Total: ${tasksToShow.length} tasks | Use !ptsendtask @user <id> to assign` });
            
            taskPages.push(embed);
          }
          
          // Send all pages to DM
          await dmUser.send(`📋 **Task List** ${difficultyFilter ? `(${difficultyFilter} difficulty)` : ''}\nShowing all ${tasksToShow.length} tasks:`);
          
          for (const embed of taskPages) {
            await dmUser.send({ embeds: [embed] });
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          await message.reply(`✅ Sent the complete task list (${tasksToShow.length} tasks) to your DM!`);
          
        } catch (error) {
          console.error('Error sending task list:', error);
          await message.reply('❌ Failed to send task list. Make sure your DMs are open!');
        }
        break;
        
      case 'ptsendtask':
        if (!isAdmin) {
          await message.reply('❌ You need Administrator permission!');
          return;
        }
        
        const ptTargetUser = message.mentions.users.first();
        const taskId = args[1];
        
        if (!ptTargetUser || !taskId) {
          await message.reply('Usage: `!ptsendtask @user <taskId>` - Send a specific task by ID\nExample: `!ptsendtask @user pt1`\nUse `!pttasks` to see all available task IDs');
          return;
        }
        
        if (!data.users[ptTargetUser.id]) {
          await message.reply('❌ That user hasn\'t started yet! They need to use `!start` first.');
          return;
        }
        
        const taskToSend = PERSONALIZED_TASKS.find(t => t.id === taskId);
        if (!taskToSend) {
          await message.reply(`❌ Task ID "${taskId}" not found! Use \`!pttasks\` to see all available task IDs.`);
          return;
        }
        
        try {
          const targetUserData = data.users[ptTargetUser.id];
          const ptData = initializePersonalizedTaskData(targetUserData);
          
          // Check if user already has an active task
          if (ptData.currentTask && Date.now() < ptData.taskStartTime + ptData.currentTask.duration) {
            const confirmMsg = await message.reply(`⚠️ <@${ptTargetUser.id}> already has an active task: **${ptData.currentTask.name}**\n\nReply with **yes** to override and send the new task, or **no** to cancel.`);
            
            const filter = m => m.author.id === message.author.id && ['yes', 'no'].includes(m.content.toLowerCase());
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            
            if (collected.first().content.toLowerCase() !== 'yes') {
              await message.channel.send('❌ Cancelled. Task not sent.');
              return;
            }
          }
          
          // Initialize task progress
          ptData.taskProgress = {
            dropsCaught: 0,
            battlesWon: 0,
            cratesOpened: 0,
            levelsGained: 0,
            messagesSent: 0,
            tradesCompleted: 0,
            coinTradesCompleted: 0,
            gemTradesCompleted: 0,
            userBattles: 0,
            anyTrade: 0,
            invitesCompleted: 0
          };
          
          // Set the task
          ptData.currentTask = taskToSend;
          ptData.taskStartTime = Date.now();
          ptData.lastTaskSent = Date.now();
          ptData.isActive = true;
          
          await saveData(data);
          
          // Send DM to user
          const user = await client.users.fetch(ptTargetUser.id);
          const taskMessage = `🎯 **Admin Task Assignment**\n\nYou've been assigned a special task:\n\n**${taskToSend.name}**\n${taskToSend.description}\n\n⏰ Duration: ${formatTime(taskToSend.duration)}\n🎁 Reward: ${formatReward(taskToSend.reward)}\n\nGet started! Good luck! 💪`;
          
          await user.send(taskMessage);
          
          await message.reply(`✅ Successfully sent task **${taskToSend.name}** (${taskId}) to <@${ptTargetUser.id}>!\n\n📋 Task: ${taskToSend.description}\n⏰ Duration: ${formatTime(taskToSend.duration)}\n🎁 Reward: ${formatReward(taskToSend.reward)}`);
          
        } catch (error) {
          console.error('Error sending task:', error);
          await message.reply(`❌ Failed to send task: ${error.message}`);
        }
        break;
        
      case 'permissions':
      case 'perms':
      case 'roles':
        const permEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🔐 ZooBot Permission System')
          .setDescription('ZooBot uses a three-tier permission system for command access.\n\n**For full documentation, see PERMISSIONS_DOCUMENTATION.md**')
          .addFields(
            { 
              name: '👑 Super Admin (Bot Owners)', 
              value: 'Hardcoded bot owners with full access to all commands across all servers.\n\n**Commands:** User management, skin management, server management, bot updates, data resets, etc.'
            },
            { 
              name: '🛡️ ZooAdmin (Server Customization)', 
              value: '**Role Name:** `ZooAdmin` (case insensitive)\n\nCreate this role in your Discord server and assign it to trusted users who should manage the bot.\n\n**Commands:**\n• `!setup` - Server setup\n• `!setdropchannel` - Configure drop channel\n• `!seteventschannel` - Configure events channel\n• `!setupdateschannel` - Configure updates channel\n• `!paydrops` - Activate drops (100 gems/3h)\n• `!setemoji` - Custom character emojis\n• `!setchestgif` - Custom chest GIFs'
            },
            { 
              name: '🔧 Bot Admin (Legacy System)', 
              value: 'Database-stored admins (being phased out). Can manage events.\n\n**Commands:** `!addadmin`, `!removeadmin`, `!startevent`, `!stopevent`, `!eventschedule`'
            },
            { 
              name: '👥 Regular Users (Everyone)', 
              value: 'All standard gameplay commands: battles, trading, quests, crates, profile, shop, etc.\n\nUse `!help` to see all available commands.'
            },
            {
              name: '❓ How to Setup ZooAdmin',
              value: '1. Create a Discord role named "ZooAdmin"\n2. Assign it to users who should manage the bot\n3. They can now run all customization commands!'
            }
          )
          .setFooter({ text: 'Type !help for all commands | Read PERMISSIONS_DOCUMENTATION.md for details' });
        
        await message.reply({ embeds: [permEmbed] });
        break;
      
      case 'hub':
      case 'menu':
      case 'home':
        const hubUser = data.users[userId];
        initializeUserHubData(hubUser);
        initializeDiscovery(hubUser);
        trackFeatureUse(hubUser, 'hub');
        
        if (shouldShowOnboarding(hubUser) && (!hubUser.characters || hubUser.characters.length === 0)) {
          const { embed, components } = createFirstTimeWelcome(message.author);
          await message.reply({ embeds: [embed], components });
        } else {
          const embed = createMainHubEmbed(message.author, hubUser, hubUser.discovery);
          const buttons = createHubCategoryButtons();
          await message.reply({ embeds: [embed], components: buttons });
        }
        await saveData(data);
        break;
      
      case 'guide':
      case 'tutorial':
      case 'quickstart':
        const guideUser = data.users[userId];
        initializeUserHubData(guideUser);
        trackFeatureUse(guideUser, 'guide');
        await openQuickStart(message, data, guideUser, 0);
        await saveData(data);
        break;
        
      case 'discovery':
      case 'explore':
        const discUser = data.users[userId];
        initializeUserHubData(discUser);
        const { createDiscoveryEmbed } = require('./discoverySystem.js');
        const discEmbed = createDiscoveryEmbed(message.author, discUser);
        const discRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('hub_main')
            .setLabel('Open Game Hub')
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Primary)
        );
        await message.reply({ embeds: [discEmbed], components: [discRow] });
        break;
      
      case 'help':
        const helpEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('🎮 ZooBot - Complete Command Guide')
          .setDescription('**🏠 NEW: Use `!hub` for an interactive menu with all features!**\n\nUse `!overview` to see all game systems\n\n**📚 Command Categories:**')
          .addFields(
            { name: '🏠 Interactive Hub (NEW!)', value: '`!hub` - Open interactive game menu\n`!guide` - Quick start tutorial\n`!discovery` - See feature progress' },
            { name: '🎯 Getting Started', value: '`!start` - Begin your journey\n`!select <character>` - Choose starter character' },
            { name: '🎰 Minigames (NEW!)', value: '`!coinduel <h/t> <bet>` - Coin flip (×2, rare ×5)\n`!diceclash <bet>` - Progressive dice rolling\n`!dooroffate <bet>` - Pick 1 of 3 doors\n`!almostwin <bet>` - Roll 1-100 for prizes\n`!rps <r/p/s> <bet>` - Rock Paper Scissors\n💡 **1.5× rewards on main server!**' },
            { name: '👤 Profile & Characters', value: '`!profile [page]` - View your profile\n`!char <name>` - View character details\n`!info <name>` - View any character info (even if you don\'t own)\n`!I <name>` - View battle info\n`!setpfp <name>` - Set profile picture\n`!levelup <name>` - Level up character\n`!release <name>` - Release character (lvl 10+)' },
            { name: '⚔️ Battles & Items', value: '`!b @user` - Challenge to battle\n`!b ai` - Battle AI (easy/medium/hard)\n`!shop` - View battle items shop' },
            { name: '🎁 Drops & Rewards', value: '`!c <code>` - Catch drops\n`!paydrops` - Activate drops (100 gems/3h)\n`!dropstatus` - Check drop timer\n`!daily` - Daily rewards' },
            { name: '📦 Crates & Shop', value: '`!crate [type]` - Open crates\n`!pickcrate <type>` - Choose crate to open\n`!opencrate` - Open selected crate\n`!buycrate <type>` - Buy crates' },
            { name: '💱 Trading', value: '`!t @user` - Trade with users' },
            { name: '📜 Quests & Tasks', value: '`!quests [page]` - View quests\n`!quest <id>` - Quest details\n`!claim <id>` - Claim quest rewards\n`!ptoggle on/off` - Toggle personalized tasks' },
            { name: '🔥 Daily & Challenges', value: '`!daily` - Claim daily streak rewards\n`!challenges` - View weekly challenges\n`!claimchallenge <id>` - Claim challenge rewards' },
            { name: '🏅 Achievements & Stats', value: '`!achievements` - View your badges\n`!globalboard [type]` - Global rankings\n`!serverstats` - Server analytics (Admin)' },
            { name: '🔷 ST Boosters', value: '`!shards` - View shard info\n`!craft` - Craft booster (8 shards)\n`!boost <character>` - Reroll character ST' },
            { name: '📬 Mail & News', value: '`!mail [page]` - View mailbox\n`!claimmail <#>` - Claim mail rewards\n`!clearmail` - Clear claimed mail\n`!news` - Latest bot news' },
            { name: '🏆 Leaderboards & Rankings', value: '`!leaderboard <type>` - Top 10 rankings\nTypes: coins, gems, battles, collection, trophies' },
            { name: '🔑 Keys & Unlocks', value: '`!keys` - View your keys\n`!unlock <character>` - Unlock with 1000 keys\n`!cage` - Open random cage (250 cage keys)' },
            { name: '🎯 Events', value: '`!event` - View current event\n`!eventleaderboard` - Event rankings' },
            { name: '👥 Clans', value: '`!clan` - View your clan\n`!joinclan <name>` - Join clan\n`!leaveclan` - Leave clan\n`!clandonate` - Donate to clan\n`!clanleaderboard` - Clan rankings' },
            { name: '🎉 Giveaways **[AUTO-SCHEDULED]**', value: '`!giveaway` - View active giveaway\n`!autogiveaway enable/disable` - Auto daily giveaways (Bot Admin)\n`!startgiveaway <mins>` - Manual giveaway (Bot Admin)\n`!endgiveaway` - End giveaway (Bot Admin)\n\n💎 Prizes: 5000 gems, 10000 coins, 2x legendary crates' },
            { name: '🎰 Lottery **[AUTO-SCHEDULED]**', value: '`!lottery` - View lottery info (shows if you joined)\n`!lottery join <tickets>` - Buy lottery tickets\n`!autolottery enable/disable <fee> <coins/gems>` - Auto 12h lottery (Bot Admin)\n`!startlottery <3h/6h/24h> <fee> <coins/gems>` - Manual lottery (Bot Admin)\n`!stoplottery` - End lottery early (Bot Admin)' },
            { name: '🔧 Server Setup (Admins)', value: '`!setup` - Server setup guide\n`!setdropchannel #channel`\n`!seteventschannel #channel`\n`!setupdateschannel #channel`\n`!addadmin @user` - Add bot admin\n`!removeadmin @user` - Remove admin' },
            { name: '👑 Super Admin', value: '`!servers` - List all servers\n`!removeserver <id>` - Remove bot from server\n`!postupdate <msg>` - Post update to all servers\n`!grant` - Grant resources\n`!grantchar` - Grant characters\n`!sendmail` - Send mail to all\n`!postnews` - Post news\n`!reset` - Reset all data' },
            { name: '⚒️ Work & Economy **[NEW!]**', value: '`!work` - Complete jobs for rewards\n`!workguide` - Complete work system guide\n`!craft` - Craft tools\n`!market` - Buy/sell items\n`!auctions` - Bid on auctions\n💡 **All new workers get FREE starter tools!**' },
            { name: 'ℹ️ Information', value: '`!overview` - Game systems overview\n`!botinfo` - About ZooBot\n`!history @user` - Transaction history' }
          )
          .setFooter({ text: '💡 Tip: Most commands have shorter aliases! Try !b, !t, !c' });
        
        await message.reply({ embeds: [helpEmbed] });
        break;
        
      case 'overview':
      case 'systems':
        const overviewEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle('🎮 ZooBot Systems Overview')
          .setDescription('**Welcome to ZooBot!** Here\'s what this huge update includes:\n\n')
          .addFields(
            { name: '🎯 Character Collection (51 Characters)', value: 'Collect unique characters, each with special stats (ST), moves, and leveling. Unlock via keys or cages!' },
            { name: '🎰 Minigames **[NEW!]**', value: '5 fast-paced, addictive minigames to earn coins and gems! Coin Duel, Dice Clash, Door of Fate, Almost-Win Machine, and Rock Paper Scissors. **Main server gets 1.5× rewards!**' },
            { name: '⚔️ Battle System', value: 'Turn-based battles with energy management, 51 unique abilities, status effects (burn, poison, stun, etc.), and battle items!' },
            { name: '🎁 Drop System **[NEW PAID MODEL]**', value: '**Non-main servers:** Pay 100 gems for 3 hours of drops! Auto-pauses after 30 uncaught drops.\n**Main server:** Unlimited free drops!' },
            { name: '📦 Crate System', value: '6 crate tiers (Bronze, Silver, Gold, Emerald, Legendary, Tyrant) with interactive 2-step opening and custom GIF animations!' },
            { name: '🔷 ST Booster System', value: 'Collect shards to craft boosters and reroll your character\'s ST stat. Higher ST = higher risk!' },
            { name: '💱 Trading System', value: 'Secure player-to-player trading with dual confirmation for characters, coins, gems, and items!' },
            { name: '📜 Quest System', value: 'Complete quests to earn rewards like coins, gems, crates, and character tokens!' },
            { name: '📬 Personalized Tasks **[UPDATED]**', value: 'Receive personalized tasks every **4 hours** (was 2 hours) based on your activity. Earn exclusive rewards!' },
            { name: '🎯 Daily Events', value: 'Compete in rotating events (Trophy Hunt, Crate Master, Drop Catcher) with automatic reward distribution!' },
            { name: '🏆 Leaderboards', value: 'Compete for top rankings in coins, gems, battles won, character collection, and trophies!' },
            { name: '👥 Clan Wars', value: 'Join clans, donate resources, compete in weekly clan wars for exclusive prizes!' },
            { name: '🔑 Key & Cage System', value: 'Collect character keys (1000 to unlock specific character) or cage keys (250 for random unlock)!' },
            { name: '📬 Mail System **[UPDATED]**', value: 'Receive mail from admins with rewards. **New:** Use `!clearmail` to clean up claimed messages!' },
            { name: '📰 News & Updates **[NEW]**', value: 'Stay informed with bot updates posted to your server\'s updates channel!' },
            { name: '🎨 Custom Emojis & Visuals', value: 'Characters can have custom Discord emojis, and crates have customizable opening GIF animations!' },
            { name: '💎 Economy System', value: 'Earn and spend Coins, Gems, Shards, Trophies, and character-specific Tokens!' }
          )
          .setFooter({ text: 'Type !help to see all commands | This is a fan-made game for entertainment!' });
        
        await message.reply({ embeds: [overviewEmbed] });
        break;
        
      case 'workguide':
      case 'workhelp':
        const workGuideEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle('⚒️ Work & Economy System Guide')
          .setDescription(
            '**Welcome to the Work System!** Earn resources, coins, gems, and more by completing jobs!\n\n' +
            '🎁 **FREE STARTER PACK:** All new workers get:\n' +
            '• Level 1 Drill ⛏️\n' +
            '• Level 1 Axe 🪓\n' +
            '• Level 1 Whistle 📢\n' +
            '• Level 1 Binoculars 🔭\n' +
            '• Level 1 Caretaker House 🏠\n\n'
          )
          .addFields(
            {
              name: '💼 Available Jobs (15 min cooldown)',
              value:
                '**⛏️ Miner** - Use drill to mine ores (<:emoji_15:1440870514179571712> Aurelite, <:emoji_18:1440870637622132838> Kryonite, <:emoji_18:1440870612875870208> Zyronite, <:emoji_16:1440870557355872287> Rubinite, <:emoji_16:1440870583729655839> Voidinite)\n' +
                '**🏠 Caretaker** - Care for animals, earn coins, gems, and character tokens\n' +
                '**🌾 Farmer** - Use axe to chop wood ( <:emoji_19:1440870663509508146> Oak, <:emoji_20:1440870689065271420> Maple, <:emoji_21:1440870715787313162> Ebony, <:emoji_23:1440870753472872630> Celestial)\n' +
                '**🦁 Zookeeper** - Use whistle to wrangle animals for rewards\n' +
                '**🔭 Ranger** - Use binoculars to scout for rare items'
            },
            {
              name: '🛠️ Tools & Levels',
              value:
                '**⛏️ Drill** (Lvl 1-5) - Higher levels = more/better ores\n' +
                '**🪓 Axe** (Lvl 1-5) - Higher levels = more/better wood\n' +
                '**📢 Whistle** (Lvl 1-5) - Higher levels = better rewards\n' +
                '**🔭 Binoculars** (Lvl 1-5) - Higher levels = better rewards\n' +
                '**🏠 House** (Lvl 1-5) - Upgrades boost caretaker rewards\n\n' +
                '⚠️ Tools have durability and will break! Craft replacements using ores and wood.'
            },
            {
              name: '📦 Possible Rewards',
              value:
                '💰 **Coins** - Main currency\n' +
                '💎 **Gems** - Premium currency\n' +
                '⛰️ **Ores** - 5 types for crafting tools\n' +
                '🌲 **Wood** - 4 types for crafting tools\n' +
                '🎫 **Tokens** - Level up your characters\n' +
                '📦 **Crates** - Random rewards\n' +
                '🔑 **Keys** - Unlock characters\n' +
                '🔷 **Shards** - Craft ST boosters'
            },
            {
              name: '⚙️ Crafting & Upgrades',
              value:
                '`!craft` - Craft tools using ores and wood\n' +
                '`!tools` - View your tools and their durability\n' +
                '`!upgradehouse <level>` - Upgrade caretaker house'
            },
            {
              name: '🏪 Market & Trading',
              value:
                '`!market` - Browse items for sale\n' +
                '`!sell <item> <amount> <price>` - List items for sale\n' +
                '`!buy <listing_id>` - Purchase listed items\n' +
                '`!mylistings` - View your active listings\n' +
                '`!cancelmarket <listing_id>` - Cancel your listing'
            },
            {
              name: '🔨 Auction System',
              value:
                '`!auctions` - View active auctions\n' +
                '`!auction <item> <amount> <starting_bid> <duration>` - Create auction\n' +
                '`!bid <auction_id> <amount>` - Place bid on auction\n' +
                '`!myauctions` - View your active auctions'
            },
            {
              name: '🎮 Work Commands',
              value:
                '`!work` - Complete your assigned job\n' +
                '`!workstatus` - Check cooldown and current job\n' +
                '`!showwork <job>` - View job images (drill, room, axe, whistle, binoculars)\n' +
                '`!ores` - View your ore inventory\n' +
                '`!wood` - View your wood inventory'
            },
            {
              name: '💡 Tips & Strategy',
              value:
                '• Your **first work** is always caretaker to get you started!\n' +
                '• **Upgrade tools** for better rewards!\n' +
                '• **Upgrade house** to boost caretaker earnings!\n' +
                '• Jobs rotate randomly every 15 minutes\n' +
                '• Save rare ores/wood for high-level tool crafting\n' +
                '• Use the market to trade resources you don\'t need!'
            }
          )
          .setFooter({ text: 'Start with !work to begin your first job! | All starters get FREE tools!' });
        
        await message.reply({ embeds: [workGuideEmbed] });
        break;
        
      case 'keys':
        await viewKeys(message, data, userId);
        break;
        
      case 'unlock':
        const unlockCharName = args.join(' ');
        await unlockCharacter(message, data, userId, unlockCharName);
        break;
      
      case 'charkeys':
      case 'characterkeys':
      case 'ck':
        const ckPage = parseInt(args[0]) || 1;
        await displayCharacterKeysMenu(message, data, userId, ckPage);
        break;
      
      case 'keyunlock':
        const keyUnlockCharInput = args.join(' ');
        if (!keyUnlockCharInput) {
          await message.reply(`❌ Please specify a character! Usage: \`!keyunlock <character name>\`\n\nCollect ${KEYS_TO_UNLOCK} keys to unlock a character. Use \`!charkeys\` to view your collection.`);
          break;
        }
        
        // Look up character first to get the canonical name (case-insensitive lookup)
        const keyUnlockChar = characterManager.getCharacterByName(keyUnlockCharInput);
        if (!keyUnlockChar) {
          await message.reply(`❌ Character **${keyUnlockCharInput}** not found!`);
          break;
        }
        
        // Use the canonical character name from the database
        const keyUnlockResult = await unlockCharacterWithKeys(data.users[userId], keyUnlockChar.name, data, serverId);
        if (keyUnlockResult.success) {
          const unlockEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 CHARACTER UNLOCKED!')
            .setDescription(`You unlocked **${keyUnlockResult.character.emoji} ${keyUnlockResult.character.name}**!\n\n**ST:** ${keyUnlockResult.st}%\n**Level:** 1\n\nUsed ${KEYS_TO_UNLOCK} keys!`)
            .setFooter({ text: 'Use !profile to view your characters!' });
          await message.reply({ embeds: [unlockEmbed] });
        } else {
          await message.reply(keyUnlockResult.message);
        }
        break;
      
      case 'convertkeys':
        const convResult = convertAllExcessKeysToTokens(data.users[userId]);
        await saveDataImmediate(data);
        if (convResult.totalConverted > 0) {
          const convList = convResult.conversions.map(c => `${c.character}: +${c.amount} tokens`).join('\n');
          const convEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔄 Keys Converted!')
            .setDescription(`**Conversions:**\n${convList}\n\n**Total:** ${convResult.totalConverted} keys converted to tokens`)
            .setFooter({ text: 'Keys for owned characters are automatically converted!' });
          await message.reply({ embeds: [convEmbed] });
        } else {
          await message.reply('❌ No excess keys to convert! Keys for owned characters can be converted.');
        }
        break;
      
      case 'keyrush':
        if (!isSuperAdmin(userId) && !isGlobalBotAdmin(userId) && !isZooAdmin(message.member)) {
          await message.reply('❌ Only Super Admins, Bot Admins, or ZooAdmins can activate Key Rush!');
          break;
        }
        
        if (args[0]?.toLowerCase() === 'confirm') {
          const krConfirmResult = await activateKeyRushConfirmed(serverId, userId, data);
          const krConfirmEmbed = new EmbedBuilder()
            .setColor(krConfirmResult.success ? '#FFD700' : '#FF0000')
            .setDescription(krConfirmResult.message);
          await message.reply({ embeds: [krConfirmEmbed] });
        } else {
          const krResult = await activateKeyRush(serverId, userId, data);
          if (krResult.needsConfirmation) {
            const warnEmbed = new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('⚠️ Confirmation Required')
              .setDescription(krResult.message);
            await message.reply({ embeds: [warnEmbed] });
          } else {
            const krEmbed = new EmbedBuilder()
              .setColor(krResult.success ? '#FFD700' : '#FF0000')
              .setDescription(krResult.message);
            await message.reply({ embeds: [krEmbed] });
          }
        }
        break;
      
      case 'keyrushstatus':
        if (isKeyRushActive(serverId)) {
          const timeLeft = getKeyRushTimeRemaining(serverId);
          await message.reply(`🔑 **Key Rush is ACTIVE!**\n⏰ Time Remaining: ${timeLeft}\n\n🎁 All drops are character keys during Key Rush!`);
        } else {
          await message.reply('❌ Key Rush is not currently active. Use `!keyrush` to activate it (costs 250 gems).');
        }
        break;
      
      case 'grantkeyrush':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can grant Key Rush!');
          break;
        }
        const gkrServerId = args[0] || serverId;
        const gkrResult = await grantKeyRush(gkrServerId, userId);
        const gkrEmbed = new EmbedBuilder()
          .setColor(gkrResult.success ? '#FFD700' : '#FF0000')
          .setDescription(gkrResult.message);
        await message.reply({ embeds: [gkrEmbed] });
        break;
      
      case 'stoprush':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can stop Key Rush!');
          break;
        }
        const stopRushServerId = args[0] || serverId;
        const stopRushResult = await stopKeyRush(stopRushServerId, userId);
        const stopRushEmbed = new EmbedBuilder()
          .setColor(stopRushResult.success ? '#00FF00' : '#FF0000')
          .setDescription(stopRushResult.message);
        await message.reply({ embeds: [stopRushEmbed] });
        break;
      
      case 'collectibles':
      case 'collectibleitems':
      case 'colitems':
        const colItemsBundle = getServerConfig(serverId)?.gameBundle || 'default';
        const colItemsPage = parseInt(args[0]) || 1;
        await displayCollectibleItemsList(message, colItemsBundle, colItemsPage);
        break;
      
      case 'mycollectibles':
      case 'myitems':
      case 'mycolitems':
        const myColItemsPage = parseInt(args[0]) || 1;
        await displayUserCollectibleItems(message, userId, myColItemsPage);
        break;
      
      case 'setitem':
      case 'selectitem':
      case 'displayitem':
        if (!args[0]) {
          await message.reply('❌ Please specify an item name! Usage: `!setitem <item name>`');
          break;
        }
        const setItemName = args.join(' ');
        const setItemBundle = getServerConfig(serverId)?.gameBundle || 'default';
        const setItemFound = await getCollectibleItemByName(setItemName, setItemBundle);
        
        if (!setItemFound) {
          await message.reply(`❌ Item "${setItemName}" not found!`);
          break;
        }
        
        const setItemResult = await setProfileCollectibleItem(userId, setItemFound._id.toString());
        await message.reply(setItemResult.message);
        break;
      
      case 'clearitem':
      case 'removeitem':
        const clearItemResult = await clearProfileCollectibleItem(userId);
        await message.reply(clearItemResult.message);
        break;
      
      case 'sellitem':
        if (!args[0]) {
          await message.reply('❌ Please specify an item name! Usage: `!sellitem <item name> [quantity]`');
          break;
        }
        
        let sellItemQty = 1;
        let sellItemNameParts = [...args];
        
        const sellLastArg = args[args.length - 1];
        if (!isNaN(parseInt(sellLastArg)) && args.length > 1) {
          sellItemQty = Math.max(1, parseInt(sellLastArg));
          sellItemNameParts = args.slice(0, -1);
        }
        
        const sellItemName = sellItemNameParts.join(' ');
        const sellItemBundle = getServerConfig(serverId)?.gameBundle || 'default';
        const sellItemFound = await getCollectibleItemByName(sellItemName, sellItemBundle);
        
        if (!sellItemFound) {
          await message.reply(`❌ Item "${sellItemName}" not found!`);
          break;
        }
        
        const sellItemResult = await sellCollectibleItem(userId, sellItemFound._id.toString(), sellItemQty, data);
        if (sellItemResult.success) {
          await saveDataImmediate(data);
        }
        await message.reply(sellItemResult.message);
        break;
      
      case 'submititem':
        if (!USE_MONGODB) {
          await message.reply('❌ Item submissions require MongoDB to be connected!');
          break;
        }
        const submitItemBundle = getServerConfig(serverId)?.gameBundle || 'default';
        await startCollectibleItemSubmission(message, submitItemBundle);
        break;
      
      case 'itemsubmissions':
      case 'pendingitems':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view item submissions!');
          break;
        }
        const itemSubPage = parseInt(args[0]) || 1;
        await displayPendingCollectibleSubmissions(message, itemSubPage);
        break;
      
      case 'approveitem':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can approve items!');
          break;
        }
        if (!args[0]) {
          await message.reply('❌ Please provide the submission ID! Usage: `!approveitem <id>`');
          break;
        }
        const approveItemResult = await approveCollectibleSubmission(args[0], userId);
        await message.reply(approveItemResult.message);
        break;
      
      case 'rejectitem':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can reject items!');
          break;
        }
        if (!args[0]) {
          await message.reply('❌ Please provide the submission ID! Usage: `!rejectitem <id> [reason]`');
          break;
        }
        const itemRejectReason = args.slice(1).join(' ') || 'No reason provided';
        const rejectItemResult = await rejectCollectibleSubmission(args[0], userId, itemRejectReason);
        await message.reply(rejectItemResult.message);
        break;
      
      case 'additem':
      case 'createitem':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can create items!');
          break;
        }
        
        if (message.attachments.size === 0) {
          await message.reply('❌ Please attach an image for the item!\n\nUsage: `!additem <name> | <bundle> | <baseValue> | [traits: droppable,crate,sellable,stackable] | [global]`\nAttach an image with the message.');
          break;
        }
        
        const addItemAttachment = message.attachments.first();
        if (!addItemAttachment.contentType?.startsWith('image/')) {
          await message.reply('❌ Please attach a valid image file!');
          break;
        }
        
        const addItemParts = args.join(' ').split('|').map(p => p.trim());
        if (addItemParts.length < 2) {
          await message.reply('❌ Invalid format!\n\nUsage: `!additem <name> | <bundle> | <baseValue> | [traits] | [global]`');
          break;
        }
        
        const addItemData = {
          name: addItemParts[0],
          imageUrl: addItemAttachment.url,
          bundle: addItemParts[1] || 'default',
          baseValue: parseInt(addItemParts[2]) || 100,
          droppable: { enabled: false, probability: 0.05 },
          crateObtainable: { enabled: false, probability: 0.1 },
          sellable: true,
          stackable: true,
          isGlobal: false,
          createdBy: userId
        };
        
        if (addItemParts[3]) {
          const traits = addItemParts[3].toLowerCase();
          addItemData.droppable.enabled = traits.includes('droppable') || traits.includes('drop');
          addItemData.crateObtainable.enabled = traits.includes('crate');
          addItemData.sellable = !traits.includes('nosell');
          addItemData.stackable = !traits.includes('nostack') && !traits.includes('unique');
        }
        
        if (addItemParts[4]?.toLowerCase() === 'global') {
          addItemData.isGlobal = true;
        }
        
        const addItemResult = await createCollectibleItem(addItemData);
        const addItemEmbed = new EmbedBuilder()
          .setColor(addItemResult.success ? '#00D166' : '#FF0000')
          .setTitle('📦 Create Item')
          .setDescription(addItemResult.message)
          .setThumbnail(addItemAttachment.url);
        
        if (addItemResult.success) {
          let traitsStr = [];
          if (addItemData.droppable.enabled) traitsStr.push('🎯 Droppable');
          if (addItemData.crateObtainable.enabled) traitsStr.push('📦 Crate');
          if (addItemData.sellable) traitsStr.push('💰 Sellable');
          if (addItemData.stackable) traitsStr.push('📚 Stackable');
          if (addItemData.isGlobal) traitsStr.push('🌍 Global');
          
          addItemEmbed.addFields(
            { name: 'Name', value: addItemData.name, inline: true },
            { name: 'Bundle', value: addItemData.bundle, inline: true },
            { name: 'Base Value', value: `${addItemData.baseValue} coins`, inline: true },
            { name: 'Traits', value: traitsStr.join('\n') || 'None', inline: false }
          );
        }
        await message.reply({ embeds: [addItemEmbed] });
        break;
      
      case 'deleteitem':
      case 'delitem':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can delete items!');
          break;
        }
        if (!args[0]) {
          await message.reply('❌ Please specify the item name! Usage: `!deleteitem <item name>`');
          break;
        }
        const delItemName = args.join(' ');
        const delItemFound = await getCollectibleItemByName(delItemName);
        
        if (!delItemFound) {
          await message.reply(`❌ Item "${delItemName}" not found!`);
          break;
        }
        
        const delItemResult = await deleteCollectibleItem(delItemFound._id.toString());
        await message.reply(delItemResult.message);
        break;
      
      case 'toggleitemtrait':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can toggle item traits!');
          break;
        }
        
        const toggleParts = args.join(' ').split('|').map(p => p.trim());
        if (toggleParts.length < 2) {
          await message.reply('❌ Usage: `!toggleitemtrait <item name> | <trait> | [on/off]`\nTraits: droppable, crate, sellable, stackable');
          break;
        }
        
        const toggleItemFound = await getCollectibleItemByName(toggleParts[0]);
        if (!toggleItemFound) {
          await message.reply(`❌ Item "${toggleParts[0]}" not found!`);
          break;
        }
        
        const traitToToggle = toggleParts[1].toLowerCase();
        let traitValue = true;
        if (toggleParts[2]) {
          traitValue = toggleParts[2].toLowerCase() === 'on' || toggleParts[2].toLowerCase() === 'true';
        } else {
          if (traitToToggle === 'droppable') traitValue = !toggleItemFound.droppable?.enabled;
          else if (traitToToggle === 'crate') traitValue = !toggleItemFound.crateObtainable?.enabled;
          else if (traitToToggle === 'sellable') traitValue = !toggleItemFound.sellable;
          else if (traitToToggle === 'stackable') traitValue = !toggleItemFound.stackable;
        }
        
        const itemToggleResult = await toggleItemTrait(toggleItemFound._id.toString(), traitToToggle, traitValue);
        await message.reply(`${itemToggleResult.success ? '✅' : '❌'} ${toggleParts[0]}: ${traitToToggle} is now **${traitValue ? 'ON' : 'OFF'}**`);
        break;
      
      case 'setitemglobal':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can set global items!');
          break;
        }
        
        const globalParts = args.join(' ').split('|').map(p => p.trim());
        if (globalParts.length < 1) {
          await message.reply('❌ Usage: `!setitemglobal <item name> | [on/off]`');
          break;
        }
        
        const globalItemFound = await getCollectibleItemByName(globalParts[0]);
        if (!globalItemFound) {
          await message.reply(`❌ Item "${globalParts[0]}" not found!`);
          break;
        }
        
        let globalValue = !globalItemFound.isGlobal;
        if (globalParts[1]) {
          globalValue = globalParts[1].toLowerCase() === 'on' || globalParts[1].toLowerCase() === 'true';
        }
        
        const globalResult = await setItemGlobal(globalItemFound._id.toString(), globalValue);
        await message.reply(`${globalResult.success ? '✅' : '❌'} ${globalParts[0]} is now **${globalValue ? 'GLOBAL' : 'BUNDLE-SPECIFIC'}**`);
        break;
      
      case 'setitemprobability':
      case 'setitemprob':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can set item probabilities!');
          break;
        }
        
        const probParts = args.join(' ').split('|').map(p => p.trim());
        if (probParts.length < 3) {
          await message.reply('❌ Usage: `!setitemprobability <item name> | <drop/crate> | <probability 0-1>`');
          break;
        }
        
        const probItemFound = await getCollectibleItemByName(probParts[0]);
        if (!probItemFound) {
          await message.reply(`❌ Item "${probParts[0]}" not found!`);
          break;
        }
        
        const probType = probParts[1].toLowerCase();
        const probValue = Math.max(0, Math.min(1, parseFloat(probParts[2]) || 0));
        
        const probResult = await setItemProbability(probItemFound._id.toString(), probType, probValue);
        await message.reply(`${probResult.success ? '✅' : '❌'} ${probParts[0]}: ${probType} probability set to **${(probValue * 100).toFixed(1)}%**`);
        break;
      
      case 'setitemavailability':
      case 'setitemtime':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can set item availability!');
          break;
        }
        
        const availParts = args.join(' ').split('|').map(p => p.trim());
        if (availParts.length < 2) {
          await message.reply('❌ Usage: `!setitemavailability <item name> | <end date YYYY-MM-DD or permanent>`');
          break;
        }
        
        const availItemFound = await getCollectibleItemByName(availParts[0]);
        if (!availItemFound) {
          await message.reply(`❌ Item "${availParts[0]}" not found!`);
          break;
        }
        
        let availFrom = null;
        let availUntil = null;
        
        if (availParts[1].toLowerCase() !== 'permanent') {
          const dateMatch = availParts[1].match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            availUntil = availParts[1] + 'T23:59:59Z';
          }
        }
        
        const availResult = await setItemAvailability(availItemFound._id.toString(), availFrom, availUntil);
        await message.reply(`${availResult.success ? '✅' : '❌'} ${availParts[0]} availability set to **${availUntil ? `until ${availParts[1]}` : 'permanent'}**`);
        break;
      
      case 'giveitem':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can give items!');
          break;
        }
        
        const giveParts = args.join(' ').split('|').map(p => p.trim());
        if (giveParts.length < 2) {
          await message.reply('❌ Usage: `!giveitem <@user> | <item name> | [quantity]`');
          break;
        }
        
        const giveItemTarget = message.mentions.users.first();
        if (!giveItemTarget) {
          await message.reply('❌ Please mention a user!');
          break;
        }
        
        const giveItemName = giveParts[1];
        const giveItemQty = parseInt(giveParts[2]) || 1;
        const giveItemBundle = getServerConfig(serverId)?.gameBundle || 'default';
        
        const giveItemResult = await giveCollectibleItem(giveItemTarget.id, giveItemName, giveItemQty, giveItemBundle);
        await message.reply(`${giveItemResult.success ? '✅' : '❌'} ${giveItemResult.message.replace('Received', `<@${giveItemTarget.id}> received`)}`);
        break;
      
      case 'takeitem':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can take items!');
          break;
        }
        
        const takeParts = args.join(' ').split('|').map(p => p.trim());
        if (takeParts.length < 2) {
          await message.reply('❌ Usage: `!takeitem <@user> | <item name> | [quantity]`');
          break;
        }
        
        const takeItemTarget = message.mentions.users.first();
        if (!takeItemTarget) {
          await message.reply('❌ Please mention a user!');
          break;
        }
        
        const takeItemName = takeParts[1];
        const takeItemQty = parseInt(takeParts[2]) || 1;
        const takeItemBundle = getServerConfig(serverId)?.gameBundle || 'default';
        
        const takeItemResult = await takeCollectibleItem(takeItemTarget.id, takeItemName, takeItemQty, takeItemBundle);
        await message.reply(`${takeItemResult.success ? '✅' : '❌'} Removed ${takeItemQty}x ${takeItemName} from <@${takeItemTarget.id}>`);
        break;
      
      case 'recalcitems':
      case 'recalculateitems':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can recalculate item values!');
          break;
        }
        const recalcResult = await recalculateAllItemValues();
        await message.reply(recalcResult.message);
        break;
        
      case 'cage':
        await openRandomCage(message, data, userId);
        break;
        
      case 'giveaway':
      case 'giveawayinfo':
        const { getGiveawayStatus } = require('./giveawaySystem.js');
        const giveawayStatus = getGiveawayStatus();
        
        if (!giveawayStatus.active) {
          await message.reply('❌ No giveaway is currently active!');
          break;
        }
        
        const giveawayStatusEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 Active Giveaway')
          .setDescription(
            `**Participants:** ${giveawayStatus.participants}\n` +
            `**Ends:** <t:${Math.floor(giveawayStatus.endTime / 1000)}:R>\n\n` +
            `**Prizes:**\n` +
            `💎 5,000 Gems\n` +
            `💰 10,000 Coins\n` +
            `📦 2x Legendary Crates\n\n` +
            `Click the button in the giveaway message to join!`
          )
          .setTimestamp();
        
        await message.reply({ embeds: [giveawayStatusEmbed] });
        break;
        
      case 'startgiveaway':
        if (!isAdmin) {
          await message.reply('❌ Only Super Admins and Bot Admins can start giveaways!');
          return;
        }
        
        const durationArg = parseInt(args[0]);
        if (!durationArg || durationArg < 1 || durationArg > 1440) {
          await message.reply('Usage: `!startgiveaway <duration in minutes>`\n\nExample: `!startgiveaway 60` (1 hour)\n\nDuration must be between 1-1440 minutes (24 hours)');
          return;
        }
        
        const { startGiveaway } = require('./giveawaySystem.js');
        const giveawayStartResult = await startGiveaway(message.channel.id, durationArg);
        
        if (!giveawayStartResult.success) {
          await message.reply(giveawayStartResult.message);
        }
        break;
        
      case 'endgiveaway':
        if (!isAdmin) {
          await message.reply('❌ Only Super Admins and Bot Admins can end giveaways!');
          return;
        }
        
        const { endGiveaway } = require('./giveawaySystem.js');
        const endGiveawayResult = await endGiveaway();
        
        await message.reply(endGiveawayResult.message);
        break;
        
      case 'autogiveaway':
        if (!isAdmin) {
          await message.reply('❌ Only Super Admins and Bot Admins can manage auto-giveaway!');
          return;
        }
        
        const autoGiveawayAction = args[0]?.toLowerCase();
        
        if (autoGiveawayAction === 'enable') {
          const autoGiveawayResult = await enableAutoGiveaway(message.channel.id);
          await message.reply(autoGiveawayResult.message);
        } else if (autoGiveawayAction === 'disable') {
          const disableResult = await disableAutoGiveaway();
          await message.reply(disableResult.message);
        } else {
          await message.reply(
            '**Auto Giveaway**\n\n' +
            'Usage: `!autogiveaway <enable/disable>`\n\n' +
            '**Enable:** Automatically runs a 24-hour giveaway every day\n' +
            '**Disable:** Stops automatic giveaways\n\n' +
            '**Prizes:** 500 💎 gems, 5000 💰 coins, 1x 📦 legendary crate'
          );
        }
        break;
        
      case 'lottery':
      case 'lotteryinfo':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const lotterySubCmd = args[0]?.toLowerCase();
        
        if (lotterySubCmd === 'join' || lotterySubCmd === 'buy') {
          const { joinLottery } = require('./lotterySystem.js');
          const ticketCount = parseInt(args[1]) || 1;
          
          const joinLotteryResult = await joinLottery(userId, serverId, ticketCount, data.users[userId]);
          
          if (joinLotteryResult.success) {
            if (joinLotteryResult.currency === 'gems') {
              data.users[userId].gems = (data.users[userId].gems || 0) - joinLotteryResult.cost;
            } else {
              data.users[userId].coins = (data.users[userId].coins || 0) - joinLotteryResult.cost;
            }
            await saveDataImmediate(data);
          }
          
          await message.reply(joinLotteryResult.message);
        } else {
          const { getLotteryInfo } = require('./lotterySystem.js');
          const lotteryInfoResult = await getLotteryInfo(serverId, userId);
          
          if (lotteryInfoResult.success) {
            const lotteryInfoEmbed = new EmbedBuilder()
              .setColor('#9B59B6')
              .setTitle('🎰 Lottery Information')
              .setDescription(lotteryInfoResult.message);
            
            await message.reply({ embeds: [lotteryInfoEmbed] });
          } else {
            await message.reply(lotteryInfoResult.message);
          }
        }
        break;
        
      case 'startlottery':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!isAdmin) {
          await message.reply('❌ Only Super Admins and Bot Admins can start lotteries!');
          return;
        }
        
        const durationType = args[0]?.toLowerCase();
        const entryFee = parseInt(args[1]);
        const currencyType = args[2]?.toLowerCase();
        
        if (!durationType || !entryFee || !currencyType) {
          await message.reply(
            '**Start a Lottery**\n\n' +
            'Usage: `!startlottery <3h/6h/24h> <entry fee> <coins/gems>`\n\n' +
            '**Examples:**\n' +
            '`!startlottery 3h 100 gems` - 3 hour lottery, 100 gems per ticket\n' +
            '`!startlottery 6h 500 coins` - 6 hour lottery, 500 coins per ticket\n' +
            '`!startlottery 24h 1000 gems` - 24 hour lottery, 1000 gems per ticket\n\n' +
            '**Prize Distribution:** Top 3 winners split the pool (50%, 30%, 20%)'
          );
          return;
        }
        
        let durationHours;
        if (durationType === '3h') durationHours = 3;
        else if (durationType === '6h') durationHours = 6;
        else if (durationType === '24h') durationHours = 24;
        else {
          await message.reply('❌ Duration must be 3h, 6h, or 24h!');
          return;
        }
        
        if (entryFee < 1) {
          await message.reply('❌ Entry fee must be at least 1!');
          return;
        }
        
        if (currencyType !== 'coins' && currencyType !== 'gems') {
          await message.reply('❌ Currency must be either coins or gems!');
          return;
        }
        
        const { startLottery } = require('./lotterySystem.js');
        const startLotteryResult = await startLottery(serverId, durationHours, entryFee, currencyType, message.channel.id);
        
        if (startLotteryResult.success) {
          await message.reply({ content: '✅ Lottery started!', embeds: [startLotteryResult.embed] });
        } else {
          await message.reply(startLotteryResult.message);
        }
        break;
        
      case 'stoplottery':
      case 'endlottery':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!isAdmin) {
          await message.reply('❌ Only Super Admins and Bot Admins can stop lotteries!');
          return;
        }
        
        const { stopLottery } = require('./lotterySystem.js');
        const stopLotteryResult = await stopLottery(serverId);
        
        await message.reply(stopLotteryResult.message);
        break;
        
      case 'autolottery':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        if (!isAdmin) {
          await message.reply('❌ Only Super Admins and Bot Admins can manage auto-lottery!');
          return;
        }
        
        const autoLotteryAction = args[0]?.toLowerCase();
        
        if (autoLotteryAction === 'enable') {
          const lotteryFee = parseInt(args[1]);
          const lotteryCurrency = args[2]?.toLowerCase();
          
          if (!lotteryFee || !lotteryCurrency || (lotteryCurrency !== 'coins' && lotteryCurrency !== 'gems')) {
            await message.reply(
              '**Auto Lottery - Enable**\n\n' +
              'Usage: `!autolottery enable <entry fee> <coins/gems>`\n\n' +
              '**Examples:**\n' +
              '`!autolottery enable 100 gems` - Lottery every 12 hours with 100 gems per ticket\n' +
              '`!autolottery enable 500 coins` - Lottery every 12 hours with 500 coins per ticket'
            );
            return;
          }
          
          const autoLotteryResult = await enableAutoLottery(serverId, lotteryFee, lotteryCurrency, message.channel.id);
          await message.reply(autoLotteryResult.message);
        } else if (autoLotteryAction === 'disable') {
          const disableLotteryResult = await disableAutoLottery(serverId);
          await message.reply(disableLotteryResult.message);
        } else {
          await message.reply(
            '**Auto Lottery**\n\n' +
            'Usage: `!autolottery <enable/disable> [entry fee] [coins/gems]`\n\n' +
            '**Enable:** Automatically runs a 12-hour lottery every 12 hours\n' +
            '**Disable:** Stops automatic lotteries\n\n' +
            '**Examples:**\n' +
            '`!autolottery enable 100 gems` - Enable with 100 gems per ticket\n' +
            '`!autolottery disable` - Disable auto lottery'
          );
        }
        break;
        
      case 'work':
        initializeWorkData(data.users[userId]);
        
        const workCheck = canWork(data.users[userId]);
        if (!workCheck.canWork) {
          await message.reply(`⏰ You're tired! Rest for ${workCheck.timeLeft}`);
          return;
        }
        
        const jobAssignment = assignRandomJob(data.users[userId]);
        const job = JOBS[jobAssignment.job];
        
        let jobResult;
        switch (jobAssignment.job) {
          case 'miner':
            jobResult = handleMinerJob(data.users[userId]);
            break;
          case 'caretaker':
            jobResult = handleCaretakerJob(data.users[userId]);
            break;
          case 'farmer':
            jobResult = handleFarmerJob(data.users[userId]);
            break;
          case 'zookeeper':
            jobResult = handleZookeeperJob(data.users[userId]);
            break;
          case 'ranger':
            jobResult = handleRangerJob(data.users[userId]);
            break;
        }
        
        if (!jobResult.success) {
          await message.reply(jobResult.message);
          return;
        }
        
        let rewardText = `💰 ${jobResult.rewards.coins} coins\n💎 ${jobResult.rewards.gems} gems`;
        
        if (jobResult.rewards.ores && Object.keys(jobResult.rewards.ores).length > 0) {
          rewardText += '\n**Ores:** ';
          rewardText += Object.entries(jobResult.rewards.ores)
            .map(([ore, amount]) => `${ORES[ore].emoji} ${amount} ${ore}`)
            .join(', ');
        }
        
        if (jobResult.rewards.wood && Object.keys(jobResult.rewards.wood).length > 0) {
          rewardText += '\n**Wood:** ';
          rewardText += Object.entries(jobResult.rewards.wood)
            .map(([wood, amount]) => `${WOOD_TYPES[wood].emoji} ${amount} ${wood}`)
            .join(', ');
        }
        
        if (jobResult.rewards.tokens) {
          if (jobResult.rewards.grantedTo) {
            rewardText += `\n🎫 ${jobResult.rewards.tokens} tokens → ${jobResult.rewards.grantedTo}`;
          } else {
            rewardText += `\n🎫 ${jobResult.rewards.tokens} tokens (pending - will be granted to your first character)`;
          }
        }
        
        if (jobResult.rewards.crates && Object.keys(jobResult.rewards.crates).length > 0) {
          rewardText += '\n**Crates:** ';
          rewardText += Object.entries(jobResult.rewards.crates)
            .map(([type, amount]) => `${amount}x ${type}`)
            .join(', ');
        }
        
        if (jobResult.rewards.keys > 0) {
          rewardText += `\n🔑 ${jobResult.rewards.keys} keys`;
        }
        
        if (jobResult.rewards.shards > 0) {
          rewardText += `\n✨ ${jobResult.rewards.shards} shards`;
        }
        
        if (jobResult.durability !== undefined) {
          rewardText += `\n\n🔧 Tool durability: ${jobResult.durability}`;
        }
        
        completeWork(data.users[userId]);
        
        // Track season daily task progress for work completed
        updateTaskProgress(data.users[userId], 'workCompleted', 1);
        
        // Track coins earned for daily tasks
        if (jobResult.rewards.coins > 0) {
          updateTaskProgress(data.users[userId], 'coinsEarned', jobResult.rewards.coins);
        }
        
        // Add server aura for work completion
        if (serverId) {
          const { addAura } = require('./serverAuraSystem.js');
          addAura(serverId, 3, 'work_complete').catch(e => console.error('Error adding work aura:', e));
        }
        
        const workEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle(`${job.emoji} ${job.name} Job Complete!`)
          .setDescription(rewardText)
          .setFooter({ text: 'Next work in 15 minutes' });
        
        await message.reply({ embeds: [workEmbed] });
        await saveDataImmediate(data);
        break;
        
      case 'crafttool':
        const toolName = args[0]?.toLowerCase();
        const toolLevel = parseInt(args[1]) || 1;
        
        if (!toolName || !TOOL_TYPES[toolName]) {
          await message.reply(
            '**Craft Tools**\n\n' +
            'Usage: `!crafttool <drill/axe/whistle/binoculars> [level]`\n\n' +
            '**Examples:**\n' +
            '`!crafttool drill` - Craft level 1 drill\n' +
            '`!crafttool axe 3` - Craft level 3 axe\n\n' +
            '**Available Tools:**\n' +
            '⛏️ Drill (for mining)\n' +
            '🪓 Axe (for farming)\n' +
            '📢 Whistle (for zookeeping)\n' +
            '🔭 Binoculars (for rangering)'
          );
          return;
        }
        
        if (toolLevel < 1 || toolLevel > 5) {
          await message.reply('❌ Tool level must be between 1 and 5!');
          return;
        }
        
        const recipe = CRAFTING_RECIPES[toolName][toolLevel];
        if (!recipe) {
          await message.reply('❌ Invalid tool or level!');
          return;
        }
        
        initializeWorkData(data.users[userId]);
        
        const toolCraftResult = craftTool(data.users[userId], toolName, toolLevel);
        
        if (!toolCraftResult.success) {
          const recipeText = Object.entries(recipe)
            .map(([resource, amount]) => {
              const emoji = ORES[resource]?.emoji || WOOD_TYPES[resource]?.emoji || '•';
              return `${emoji} ${amount} ${resource}`;
            })
            .join(', ');
          
          await message.reply(
            `❌ Cannot craft ${TOOL_TYPES[toolName].emoji} ${toolName} level ${toolLevel}!\n\n` +
            `**Required:** ${recipeText}\n` +
            `You're missing ${toolCraftResult.missing}!`
          );
          return;
        }
        
        const craftEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🔨 Crafting Success!')
          .setDescription(
            `Created ${TOOL_TYPES[toolName].emoji} **${toolName.toUpperCase()} Level ${toolCraftResult.level}**\n\n` +
            `Durability: ${toolCraftResult.durability} uses`
          );
        
        await message.reply({ embeds: [craftEmbed] });
        await saveDataImmediate(data);
        break;
        
      case 'upgrade':
      case 'upgradehouse':
        initializeWorkData(data.users[userId]);
        
        const houseInfo = getHouseInfo(data.users[userId]);
        
        if (!args[0] || args[0] !== 'confirm') {
          if (houseInfo.level >= 5) {
            await message.reply('✅ Your Caretaking House is already max level!');
            return;
          }
          
          const nextCost = houseInfo.nextLevelCost;
          let costText = `💰 ${nextCost.coins} coins\n💎 ${nextCost.gems} gems`;
          
          if (nextCost.ores && Object.keys(nextCost.ores).length > 0) {
            costText += '\n**Resources:** ';
            costText += Object.entries(nextCost.ores)
              .map(([resource, amount]) => {
                const emoji = ORES[resource]?.emoji || WOOD_TYPES[resource]?.emoji;
                return `${emoji} ${amount} ${resource}`;
              })
              .join(', ');
          }
          
          const upgradeEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🏠 Upgrade Caretaking House')
            .setDescription(
              `**Current Level:** ${houseInfo.level} - ${houseInfo.description}\n` +
              `**Animals Cared For:** ${houseInfo.animalsCount}\n\n` +
              `**Upgrade to Level ${houseInfo.level + 1}:**\n${costText}\n\n` +
              `Use \`!upgrade confirm\` to upgrade!`
            );
          
          await message.reply({ embeds: [upgradeEmbed] });
          return;
        }
        
        const upgradeResult = upgradeHouse(data.users[userId]);
        
        if (!upgradeResult.success) {
          await message.reply(`❌ ${upgradeResult.reason}`);
          return;
        }
        
        const successEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ House Upgraded!')
          .setDescription(
            `Your Caretaking House is now **Level ${upgradeResult.newLevel}**\n` +
            `${upgradeResult.description}\n\n` +
            `Higher level = better rewards when working!`
          );
        
        await message.reply({ embeds: [successEmbed] });
        await saveDataImmediate(data);
        break;
        
      case 'inventory':
      case 'inv':
        initializeWorkData(data.users[userId]);
        
        const oreDisplay = formatOreInventory(data.users[userId].ores);
        const woodDisplay = formatWoodInventory(data.users[userId].wood);
        
        const tools = data.users[userId].tools || {};
        let toolDisplay = '';
        for (const [toolType, toolData] of Object.entries(tools)) {
          if (toolData.level > 0) {
            toolDisplay += `\n${TOOL_TYPES[toolType].emoji} ${toolType} Lv.${toolData.level} (${toolData.durability} uses)`;
          }
        }
        if (!toolDisplay) toolDisplay = '\nNo tools crafted yet';
        
        const invEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`📦 ${message.author.username}'s Inventory`)
          .addFields(
            { name: '⛏️ Ores', value: oreDisplay, inline: false },
            { name: '🌲 Wood', value: woodDisplay, inline: false },
            { name: '🔧 Tools', value: toolDisplay, inline: false }
          );
        
        await message.reply({ embeds: [invEmbed] });
        break;
        
      case 'market':
        const marketAction = args[0]?.toLowerCase();
        
        if (marketAction === 'list' || marketAction === 'sell') {
          const category = args[1]?.toLowerCase();
          const itemName = args[2]?.toLowerCase();
          const quantity = parseInt(args[3]);
          const price = parseInt(args[4]);
          const currency = args[5]?.toLowerCase() || 'coins';
          
          if (!category || !itemName || !quantity || !price) {
            await message.reply(
              '**List Item on Market**\n\n' +
              'Usage: `!market list <category> <name> <quantity> <price> [currency]`\n\n' +
              '**Categories:** ore, wood, crate, key, resource\n' +
              '**Currency:** coins (default) or gems\n\n' +
              '**Examples:**\n' +
              '`!market list ore aurelite 10 100`\n' +
              '`!market list crate gold 2 500 gems`\n' +
              '`!market list resource shards 50 300 coins`\n' +
              '`!market list key key 1 1000 gems`'
            );
            return;
          }
          
          if (currency !== 'coins' && currency !== 'gems') {
            await message.reply('❌ Currency must be either "coins" or "gems"!');
            return;
          }
          
          const listResult = await listItemOnMarket(data, userId, category, itemName, quantity, price, currency);
          
          if (!listResult.success) {
            await message.reply(listResult.message);
            return;
          }
          
          const itemInfo = getItemInfo(category, itemName);
          const currencyEmoji = currency === 'gems' ? '💎' : '💰';
          await message.reply(
            `✅ Listed ${itemInfo.emoji} ${quantity}x ${itemName} for ${price} ${currency} ${currencyEmoji}!\n` +
            `ID: \`${listResult.listingId.slice(0, 8)}\``
          );
        } else if (marketAction === 'buy') {
          const listingId = args[1];
          
          if (!listingId) {
            await message.reply('Usage: `!market buy <listing ID>`');
            return;
          }
          
          const buyResult = await buyFromMarket(data, userId, listingId);
          
          if (!buyResult.success) {
            await message.reply(buyResult.message);
            return;
          }
          
          const itemInfo = getItemInfo(buyResult.category, buyResult.itemName);
          const currencyEmoji = buyResult.currency === 'gems' ? '💎' : '💰';
          await message.reply(
            `✅ Bought ${itemInfo.emoji} ${buyResult.quantity}x ${buyResult.itemName} for ${buyResult.price} ${buyResult.currency} ${currencyEmoji}!`
          );
        } else if (marketAction === 'cancel') {
          const listingId = args[1];
          
          if (!listingId) {
            await message.reply('Usage: `!market cancel <listing ID>`');
            return;
          }
          
          const cancelResult = await cancelListing(data, userId, listingId);
          
          if (!cancelResult.success) {
            await message.reply(cancelResult.message);
            return;
          }
          
          await message.reply('✅ Listing cancelled!');
        } else {
          const listings = await getMarketListings(data);
          const totalPages = Math.ceil(listings.length / 5);
          
          const embed = createMarketEmbed(listings, 0, 5);
          const navButtons = createMarketButtons(0, totalPages);
          const filterButtons = createMarketFilterButtons(null);
          
          const reply = await message.reply({ 
            embeds: [embed], 
            components: listings.length > 0 ? [navButtons, filterButtons] : []
          });
          
          if (!message.guild.marketMenus) {
            message.guild.marketMenus = new Map();
          }
          message.guild.marketMenus.set(reply.id, { page: 0, filter: null, userId: message.author.id, expiresAt: Date.now() + 300000 });
          
          setTimeout(() => {
            if (message.guild.marketMenus) {
              message.guild.marketMenus.delete(reply.id);
            }
          }, 300000);
        }
        break;
        
      case 'auction':
        const auctionAction = args[0]?.toLowerCase();
        
        if (auctionAction === 'create' || auctionAction === 'start') {
          // Check if old text command style
          if (args.length >= 4 && !isNaN(parseInt(args[3]))) {
            const category = args[1]?.toLowerCase();
            const itemName = args[2]?.toLowerCase();
            const quantity = parseInt(args[3]);
            const startingBid = parseInt(args[4]);
            const durationHours = parseInt(args[5]) || 24;
            const currency = args[6]?.toLowerCase() || 'coins';
            
            if (!category || !itemName || !quantity || !startingBid) {
              await message.reply(
                '**Create Auction (Text Command)**\n\n' +
                'Usage: `!auction create <category> <name> <quantity> <bid> [hours] [currency]`\n\n' +
                '**Categories:** ore, wood, crate, key, resource\n' +
                '**Currency:** coins (default) or gems\n\n' +
                '**Examples:**\n' +
                '`!auction create ore voidinite 5 500`\n' +
                '`!auction create crate legendary 1 1000 12 gems`'
              );
              return;
            }
            
            if (currency !== 'coins' && currency !== 'gems') {
              await message.reply('❌ Currency must be either "coins" or "gems"!');
              return;
            }
            
            const duration = durationHours * 3600000;
            const createResult = await createAuction(data, userId, category, itemName, quantity, startingBid, duration, currency);
            
            if (!createResult.success) {
              await message.reply(createResult.message);
              return;
            }
            
            const itemInfo = getItemInfo(category, itemName);
            const currencyEmoji = currency === 'gems' ? '💎' : '💰';
            await message.reply(
              `✅ Auction created!\n` +
              `${itemInfo.emoji} ${quantity}x ${itemName}\n` +
              `Starting bid: ${startingBid} ${currency} ${currencyEmoji}\n` +
              `Duration: ${durationHours} hour(s)\n` +
              `ID: \`${createResult.auctionId.slice(0, 8)}\`\n` +
              `Ends: <t:${Math.floor(createResult.endsAt / 1000)}:R>`
            );
            return;
          }
          
          // New form button way
          const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
          
          const createButton = new ButtonBuilder()
            .setCustomId('auction_create_button')
            .setLabel('📋 Open Auction Form')
            .setStyle(ButtonStyle.Primary);
          
          const row = new ActionRowBuilder().addComponents(createButton);
          
          await message.reply({ 
            content: '🎯 **Create a new auction!**\n\n**Two ways to create:**\n\n1️⃣ **Form (Recommended):** Click the button below\n2️⃣ **Text Command:** `!auction create <category> <name> <qty> <bid> [hours] [currency]`',
            components: [row]
          });
        } else if (auctionAction === 'bid') {
          const auctionId = args[1];
          const bidAmount = parseInt(args[2]);
          
          if (!auctionId || !bidAmount) {
            await message.reply('Usage: `!auction bid <auction ID> <amount>`');
            return;
          }
          
          const bidResult = await placeBid(data, userId, auctionId, bidAmount);
          
          if (!bidResult.success) {
            await message.reply(bidResult.message);
            return;
          }
          
          const bidCurrencyEmoji = bidResult.currency === 'gems' ? '💎' : '💰';
          await message.reply(`✅ Bid placed! Current: ${bidResult.newBid} ${bidResult.currency} ${bidCurrencyEmoji}`);
        } else {
          const activeAuctions = await getActiveAuctions(data);
          const totalPages = Math.ceil(activeAuctions.length / 5);
          
          const embed = createAuctionEmbed(activeAuctions, 0, 5);
          const buttons = createAuctionButtons(0, totalPages);
          
          const reply = await message.reply({ 
            embeds: [embed], 
            components: totalPages > 1 || activeAuctions.length > 0 ? [buttons] : []
          });
          
          if (!message.guild.auctionMenus) {
            message.guild.auctionMenus = new Map();
          }
          message.guild.auctionMenus.set(reply.id, { page: 0, userId: message.author.id, expiresAt: Date.now() + 300000 });
          
          setTimeout(() => {
            if (message.guild.auctionMenus) {
              message.guild.auctionMenus.delete(reply.id);
            }
          }, 300000);
        }
        break;
        
      case 'clearmarket':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const clearMarketResult = await clearMarket(data);
        await message.reply(`✅ Cleared ${clearMarketResult.count} market listings! All items returned to sellers.`);
        break;
        
      case 'clearauctions':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const clearAuctionResult = await clearAllAuctions(data);
        await message.reply(`✅ Cleared ${clearAuctionResult.count} auctions! All items and bids returned.`);
        break;
        
      case 'endauction':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const forceAuctionId = args[0];
        if (!forceAuctionId) {
          await message.reply('Usage: `!endauction <auction ID>`');
          return;
        }
        
        const forceEndResult = await forceEndAuction(data, forceAuctionId);
        
        if (!forceEndResult.success) {
          await message.reply(forceEndResult.message);
          return;
        }
        
        await message.reply('✅ Auction force-ended!');
        break;
        
      case 'giveores':
      case 'giveore':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const oreTarget = message.mentions.users.first();
        const oreName = args[1]?.toLowerCase();
        const oreAmount = parseInt(args[2]) || 1;
        
        if (!oreTarget || !oreName) {
          await message.reply(
            'Usage: `!giveores @user <ore> [amount]`\n\n' +
            'Ores: aurelite, kryonite, zyronite, rubinite, voidinite'
          );
          return;
        }
        
        if (!ORES[oreName]) {
          await message.reply('❌ Invalid ore type!');
          return;
        }
        
        const targetData = data.users[oreTarget.id];
        if (!targetData) {
          await message.reply('❌ User not found!');
          return;
        }
        
        initializeWorkData(targetData);
        targetData.ores[oreName] += oreAmount;
        
        await saveDataImmediate(data);
        await message.reply(`✅ Gave ${ORES[oreName].emoji} ${oreAmount}x ${oreName} to ${oreTarget.username}!`);
        break;
        
      case 'givewood':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const woodTarget = message.mentions.users.first();
        const woodName = args[1]?.toLowerCase();
        const woodAmount = parseInt(args[2]) || 1;
        
        if (!woodTarget || !woodName) {
          await message.reply(
            'Usage: `!givewood @user <wood> [amount]`\n\n' +
            'Wood: oak, maple, ebony, celestial'
          );
          return;
        }
        
        if (!WOOD_TYPES[woodName]) {
          await message.reply('❌ Invalid wood type!');
          return;
        }
        
        const woodTargetData = data.users[woodTarget.id];
        if (!woodTargetData) {
          await message.reply('❌ User not found!');
          return;
        }
        
        initializeWorkData(woodTargetData);
        woodTargetData.wood[woodName] += woodAmount;
        
        await saveDataImmediate(data);
        await message.reply(`✅ Gave ${WOOD_TYPES[woodName].emoji} ${woodAmount}x ${woodName} to ${woodTarget.username}!`);
        break;
        
      case 'givetool':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const toolTarget = message.mentions.users.first();
        const giveToolName = args[1]?.toLowerCase();
        const giveToolLevel = parseInt(args[2]) || 1;
        
        if (!toolTarget || !giveToolName) {
          await message.reply(
            'Usage: `!givetool @user <drill/axe/whistle/binoculars> [level]`'
          );
          return;
        }
        
        if (!TOOL_TYPES[giveToolName]) {
          await message.reply('❌ Invalid tool!');
          return;
        }
        
        if (giveToolLevel < 1 || giveToolLevel > 5) {
          await message.reply('❌ Level must be 1-5!');
          return;
        }
        
        const toolTargetData = data.users[toolTarget.id];
        if (!toolTargetData) {
          await message.reply('❌ User not found!');
          return;
        }
        
        initializeWorkData(toolTargetData);
        
        if (!toolTargetData.tools) {
          toolTargetData.tools = {};
        }
        
        toolTargetData.tools[giveToolName] = {
          level: giveToolLevel,
          durability: TOOL_TYPES[giveToolName].durabilityPerLevel[giveToolLevel - 1]
        };
        
        await saveDataImmediate(data);
        await message.reply(`✅ Gave ${TOOL_TYPES[giveToolName].emoji} ${giveToolName} Lv.${giveToolLevel} to ${toolTarget.username}!`);
        break;
        
      case 'viewmarket':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const allListings = getMarketListings(data);
        
        if (allListings.length === 0) {
          await message.reply('📭 Market is empty!');
          return;
        }
        
        const adminListingText = allListings.slice(0, 20).map(listing => {
          const itemInfo = getItemInfo(listing.category, listing.itemName);
          return `\`${listing.id.slice(0, 8)}\` ${itemInfo.emoji} ${listing.quantity}x ${listing.itemName} - ${listing.price} coins\nSeller: ${listing.sellerName} (${listing.sellerId})`;
        }).join('\n\n');
        
        const adminMarketEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🛡️ Admin Market View')
          .setDescription(`Total: ${allListings.length} listings\n\n${adminListingText}`)
          .setFooter({ text: 'Admin view - showing first 20' });
        
        await message.reply({ embeds: [adminMarketEmbed] });
        break;
        
      case 'viewauctions':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Super Admin only!');
          return;
        }
        
        const allAuctions = await getActiveAuctions(data);
        
        if (allAuctions.length === 0) {
          await message.reply('📭 No active auctions!');
          return;
        }
        
        const adminAuctionText = allAuctions.slice(0, 15).map(auction => {
          const itemInfo = getItemInfo(auction.category, auction.itemName);
          const bidder = auction.currentBidderName || 'No bids';
          return `\`${auction.id.slice(0, 8)}\` ${itemInfo.emoji} ${auction.quantity}x ${auction.itemName}\n` +
                 `Seller: ${auction.sellerName} (${auction.sellerId})\n` +
                 `Bid: ${auction.currentBid} (${bidder})\n` +
                 `Ends: <t:${Math.floor(auction.endsAt / 1000)}:R>`;
        }).join('\n\n');
        
        const adminAuctionEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🛡️ Admin Auction View')
          .setDescription(`Total: ${allAuctions.length} auctions\n\n${adminAuctionText}`)
          .setFooter({ text: 'Admin view - showing first 15' });
        
        await message.reply({ embeds: [adminAuctionEmbed] });
        break;
        
      case 'createchar':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can create characters!');
          return;
        }
        
        try {
          const promptEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🦁 Create Character')
            .setDescription('Click the button below to open the character creation form!')
            .addFields(
              { name: '📝 Form Method', value: 'Click the button to fill out a form with all character details' },
              { name: '⚔️ Ability Format', value: '`Name|Emoji|Description|EffectType|Value`\nExample: `Lunar Glow|🌙|Heal 5% HP|healPerTurn|0.05`' },
              { name: '💥 Move Format', value: '`Name|Damage`\nExample: `Moon Beam|90`' },
              { name: '📋 Text Alternative', value: 'Use `!addchar` for text-based creation\nUse `!createchar2` for dropdown ability selection' }
            );
          
          const formButton = new ButtonBuilder()
            .setCustomId(`open_createchar_modal_${userId}`)
            .setLabel('Open Character Form')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🦁');
          
          const row = new ActionRowBuilder().addComponents(formButton);
          
          await message.reply({ embeds: [promptEmbed], components: [row] });
          
        } catch (error) {
          console.error('Error with createchar:', error);
          await message.reply('❌ An error occurred!');
        }
        break;
        
      case 'addchar':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can add characters!');
          return;
        }
        
        if (args.length < 3) {
          const addcharHelp = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📝 Add Character (Text Command)')
            .setDescription('Create characters using text commands!')
            .addFields(
              { name: 'Basic Usage', value: '`!addchar <name> <emoji> <obtainable>`\nExample: `!addchar Luna 🌙 crate`' },
              { name: 'With Ability', value: '`!addchar <name> <emoji> <obtainable> | <abilityName> <abilityEmoji> <desc> <effectType> <value>`\nExample: `!addchar Luna 🌙 crate | Moonlight 🌙 Heal 5% HP healPerTurn 0.05`' },
              { name: 'With Move', value: 'Add `| <moveName> <damage>` at the end\nExample: `!addchar Luna 🌙 crate | Moonlight 🌙 Heal 5% HP healPerTurn 0.05 | Moon Beam 90`' },
              { name: 'Obtainable Types', value: '`crate`, `starter`, `drop`, `event`, `exclusive`' },
              { name: 'Common Effect Types', value: '`healPerTurn`, `damageReduction`, `criticalDamageBonus`, `dodgeChance`, `lifesteal`, `freezeChance`, `burnChance`, `flatDamageBonus`' }
            )
            .setFooter({ text: 'Use !effecttypes to see all available effect types' });
          
          await message.reply({ embeds: [addcharHelp] });
          return;
        }
        
        try {
          const fullArgs = args.join(' ');
          const sections = fullArgs.split('|').map(s => s.trim());
          
          if (sections.length > 3) {
            await message.reply('❌ Too many sections! Format: `name emoji obtainable | ability | move`');
            return;
          }
          
          const basicParts = sections[0].split(' ');
          const charName = basicParts[0];
          const charEmoji = basicParts[1];
          const charObtainable = basicParts[2]?.toLowerCase();
          
          if (!charName || !charEmoji || !charObtainable) {
            await message.reply('❌ Missing required fields! Use `!addchar` for help.');
            return;
          }
          
          const validObtainableTypes = ['crate', 'starter', 'drop', 'event', 'exclusive'];
          if (!validObtainableTypes.includes(charObtainable)) {
            await message.reply(`❌ Invalid obtainable type! Must be: ${validObtainableTypes.join(', ')}`);
            return;
          }
          
          const existingChar = characterManager.getCharacterByName(charName);
          if (existingChar) {
            await message.reply(`❌ Character "${charName}" already exists!`);
            return;
          }
          
          let ability = null;
          if (sections[1] && sections[1].trim()) {
            const abilityParts = sections[1].split(' ');
            if (abilityParts.length < 5) {
              await message.reply('❌ Ability needs 5 parts: `Name Emoji Description EffectType Value`\nExample: `Moonlight 🌙 Heal 5% HP healPerTurn 0.05`');
              return;
            }
            
            const effectValue = parseFloat(abilityParts[abilityParts.length - 1]);
            const effectType = abilityParts[abilityParts.length - 2];
            const description = abilityParts.slice(2, -2).join(' ');
            
            if (isNaN(effectValue)) {
              await message.reply(`❌ Effect value must be a number! Got: "${abilityParts[abilityParts.length - 1]}"`);
              return;
            }
            
            ability = {
              name: abilityParts[0],
              emoji: abilityParts[1],
              description: description,
              effectType: effectType,
              effectValue: effectValue
            };
          }
          
          let specialMove = null;
          if (sections[2] && sections[2].trim()) {
            const moveParts = sections[2].split(' ');
            if (moveParts.length < 2) {
              await message.reply('❌ Move needs at least 2 parts: `Name Damage`\nExample: `Moon Beam 90`');
              return;
            }
            
            const moveDamage = parseInt(moveParts[moveParts.length - 1]);
            const moveName = moveParts.slice(0, -1).join(' ');
            
            if (isNaN(moveDamage) || moveDamage <= 0) {
              await message.reply(`❌ Move damage must be a positive number! Got: "${moveParts[moveParts.length - 1]}"`);
              return;
            }
            
            specialMove = { name: moveName, damage: moveDamage };
          }
          
          const result = await characterManager.createCharacter(userId, {
            name: charName,
            emoji: charEmoji,
            obtainable: charObtainable,
            ability: ability,
            specialMove: specialMove
          });
          
          if (result.success) {
            const embed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('✅ Character Created!')
              .setDescription(`**${charEmoji} ${charName}** has been added to the game!`)
              .addFields(
                { name: 'Obtainable', value: charObtainable, inline: true },
                { name: 'Ability', value: ability ? `${ability.emoji} ${ability.name}` : 'None', inline: true },
                { name: 'Special Move', value: specialMove ? `${specialMove.name} (${specialMove.damage} DMG)` : 'Default', inline: true }
              )
              .setFooter({ text: 'Character is now available in the game!' });
            await message.reply({ embeds: [embed] });
          } else {
            await message.reply(result.message);
          }
        } catch (error) {
          console.error('Error with addchar:', error);
          await message.reply('❌ An error occurred! Check your format.');
        }
        break;
        
      case 'createchar2':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can create characters!');
          return;
        }
        
        if (args.length < 3) {
          const createchar2Help = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🦁 Create Character (Dropdown Mode)')
            .setDescription('Create characters with easy dropdown ability selection!')
            .addFields(
              { name: 'Usage', value: '`!createchar2 <name> <emoji> <obtainable>`' },
              { name: 'Example', value: '`!createchar2 Luna 🌙 crate`' },
              { name: 'Obtainable Types', value: '`crate`, `starter`, `drop`, `event`, `exclusive`' },
              { name: 'Next Steps', value: 'After running this command, a dropdown will appear to select the ability effect type, then you can fill in the details.' }
            );
          
          await message.reply({ embeds: [createchar2Help] });
          return;
        }
        
        try {
          const char2Name = args[0];
          const char2Emoji = args[1];
          const char2Obtainable = args[2]?.toLowerCase();
          
          const validObtainable = ['crate', 'starter', 'drop', 'event', 'exclusive'];
          if (!validObtainable.includes(char2Obtainable)) {
            await message.reply(`❌ Invalid obtainable type! Must be: ${validObtainable.join(', ')}`);
            return;
          }
          
          const existingChar = characterManager.getCharacterByName(char2Name);
          if (existingChar) {
            await message.reply(`❌ Character "${char2Name}" already exists!`);
            return;
          }
          
          if (!global.pendingCharacterCreations) {
            global.pendingCharacterCreations = new Map();
          }
          
          global.pendingCharacterCreations.set(userId, {
            name: char2Name,
            emoji: char2Emoji,
            obtainable: char2Obtainable,
            effectType: null,
            specialMove: null
          });
          
          const dropdownButton = new ButtonBuilder()
            .setCustomId(`createchar_dropdown_${userId}`)
            .setLabel('Select Ability Effect')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️');
          
          const skipButton = new ButtonBuilder()
            .setCustomId(`createchar_skip_${userId}`)
            .setLabel('No Ability')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');
          
          const row = new ActionRowBuilder().addComponents(dropdownButton, skipButton);
          
          const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🦁 Creating Character')
            .setDescription(`**${char2Emoji} ${char2Name}** (${char2Obtainable})\n\nClick below to select an ability effect, or skip if no ability needed.`)
            .setFooter({ text: 'Session expires in 5 minutes' });
          
          await message.reply({ embeds: [embed], components: [row] });
          
          setTimeout(() => {
            if (global.pendingCharacterCreations?.has(userId)) {
              global.pendingCharacterCreations.delete(userId);
            }
          }, 300000);
          
        } catch (error) {
          console.error('Error with createchar2:', error);
          await message.reply('❌ An error occurred!');
        }
        break;
        
      case 'editchar':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can edit characters!');
          return;
        }
        
        const editCharName = args[0];
        const editField = args[1]?.toLowerCase();
        const editValue = args.slice(2).join(' ');
        
        if (!editCharName || !editField) {
          await message.reply('**Usage:** `!editchar <name> <field> <value>`\n\n**Fields:** name, emoji, obtainable\n\n**Example:** `!editchar Luna emoji 🌙`');
          return;
        }
        
        const editResult = await characterManager.editCharacter(userId, editCharName, { [editField]: editValue });
        await message.reply(editResult.message);
        break;
        
      case 'removechar':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can remove characters!');
          return;
        }
        
        const removeCharName = args.join(' ');
        
        if (!removeCharName) {
          await message.reply('**Usage:** `!removechar <character name>`');
          return;
        }
        
        const charRemoveResult = await characterManager.removeCharacter(userId, removeCharName);
        await message.reply(charRemoveResult.message);
        break;
        
      case 'listchars':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view the character database!');
          return;
        }
        
        const allChars = characterManager.listAllCharacters();
        const charListPage = parseInt(args[0]) || 1;
        const charDbPerPage = 10;
        const charTotalPages = Math.ceil(allChars.length / charDbPerPage);
        const charStartIdx = (charListPage - 1) * charDbPerPage;
        const charPageItems = allChars.slice(charStartIdx, charStartIdx + charDbPerPage);
        
        const charListText = charPageItems.map((c, i) => {
          const ability = c.ability ? `${c.ability.emoji} ${c.ability.name}` : 'No ability';
          const move = c.specialMove ? `${c.specialMove.name} (${c.specialMove.damage})` : 'No move';
          return `**${charStartIdx + i + 1}. ${c.emoji} ${c.name}**\nObtainable: ${c.obtainable} | Ability: ${ability} | Move: ${move}`;
        }).join('\n\n');
        
        const listEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🦁 Character Database (${allChars.length} total)`)
          .setDescription(charListText || 'No characters found!')
          .setFooter({ text: `Page ${charListPage}/${charTotalPages} | Use !listchars <page>` });
        
        await message.reply({ embeds: [listEmbed] });
        break;
        
      case 'setability':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can set abilities!');
          return;
        }
        
        const abilityCharName = args[0];
        const abilityArgs = args.slice(1).join(' ').split('|').map(p => p.trim());
        
        if (!abilityCharName || abilityArgs.length < 5) {
          await message.reply('**Usage:** `!setability <character> Name|Emoji|Description|EffectType|Value`\n\n**Example:** `!setability Luna Lunar Glow|🌙|Heal 5% HP per turn|healPerTurn|0.05`');
          return;
        }
        
        const setAbilityResult = await characterManager.editCharacterAbility(userId, abilityCharName, {
          name: abilityArgs[0],
          emoji: abilityArgs[1],
          description: abilityArgs[2],
          effectType: abilityArgs[3],
          effectValue: parseFloat(abilityArgs[4]) || 0.1
        });
        
        await message.reply(setAbilityResult.message);
        break;
        
      case 'setmove':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can set special moves!');
          return;
        }
        
        const moveCharName = args[0];
        const moveArgs = args.slice(1).join(' ').split('|').map(p => p.trim());
        
        if (!moveCharName || moveArgs.length < 2) {
          await message.reply('**Usage:** `!setmove <character> MoveName|Damage`\n\n**Example:** `!setmove Luna Moon Beam|90`');
          return;
        }
        
        const setMoveResult = await characterManager.editSpecialMove(userId, moveCharName, {
          name: moveArgs[0],
          damage: parseInt(moveArgs[1]) || 90
        });
        
        await message.reply(setMoveResult.message);
        break;
        
      case 'effecttypes':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view effect types!');
          return;
        }
        
        const effectTypes = characterManager.getEffectTypes();
        const effectList = effectTypes.map((e, i) => `${i + 1}. \`${e}\``).join('\n');
        
        const effectEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('⚡ Available Effect Types')
          .setDescription(effectList)
          .setFooter({ text: 'Use these in ability creation' });
        
        await message.reply({ embeds: [effectEmbed] });
        break;

      case 'games':
      case 'bundles':
        const gameListItems = gameSystem.formatGameList(characterManager, false);
        const gamesEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle('🎮 Available Games/Bundles')
          .setDescription(gameListItems.length > 0 ? gameListItems.join('\n') : 'No games available')
          .addFields(
            { name: '🟢 Status', value: 'Active', inline: true },
            { name: '✅/⚠️ Usable', value: 'Has characters / Empty', inline: true }
          )
          .setFooter({ text: 'Use !setgame <name> to select a game for your server' });
        
        await message.reply({ embeds: [gamesEmbed] });
        break;

      case 'creategame':
      case 'createbundle':
        if (!isSuperAdmin(userId) && !isZooAdmin(message.member)) {
          await message.reply('❌ Only Super Admins or ZooAdmins can create games/bundles!');
          return;
        }
        
        const newGameName = args[0];
        const newGameDesc = args.slice(1).join(' ') || null;
        
        if (!newGameName) {
          await message.reply('**Usage:** `!creategame <name> [description]`\n\n**Example:** `!creategame MyZoo A custom zoo game`');
          return;
        }
        
        const createGameResult = await gameSystem.createGame(userId, newGameName, newGameDesc, message.member);
        await message.reply(createGameResult.message);
        break;

      case 'deletegame':
      case 'deletebundle':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can delete games/bundles!');
          return;
        }
        
        const deleteGameName = args[0];
        if (!deleteGameName) {
          await message.reply('**Usage:** `!deletegame <name>`');
          return;
        }
        
        const deleteGameResult = await gameSystem.deleteGame(userId, deleteGameName);
        await message.reply(deleteGameResult.message);
        break;

      case 'setgame':
      case 'selectgame':
        if (!serverId || isMainServer(serverId)) {
          await message.reply('❌ This command is only for non-main servers!');
          return;
        }
        
        if (!isSuperAdmin(userId) && !isZooAdmin(message.member)) {
          await message.reply('❌ Only Super Admins or ZooAdmins can set the server game!');
          return;
        }
        
        const selectGameName = args[0];
        if (!selectGameName) {
          const availableGames = gameSystem.getUsableGames(characterManager);
          let gamesList = availableGames.map(g => `• **${g.name}** (${g.characterCount} chars)`).join('\n');
          if (!gamesList) gamesList = 'No usable games available yet.';
          
          await message.reply(`**Usage:** `+ '`!setgame <name>`' + `\n\n**Available Games:**\n${gamesList}\n\n⚠️ A game needs at least 1 character to be selectable.`);
          return;
        }
        
        const setGameResult = await gameSystem.setServerGame(serverId, selectGameName, userId, message.member, characterManager);
        await message.reply(setGameResult.message);
        break;

      case 'gameinfo':
      case 'bundleinfo':
        const infoGameName = args[0] || (serverId ? getServerGame(serverId) : null);
        
        if (!infoGameName) {
          await message.reply('**Usage:** `!gameinfo <name>`\n\nOr run in a server with a selected game to see its info.');
          return;
        }
        
        const gameInfo = gameSystem.getGame(infoGameName);
        if (!gameInfo) {
          await message.reply(`❌ Game/bundle "${infoGameName}" not found!`);
          return;
        }
        
        const gameChars = characterManager.getCharactersByGame(gameInfo.name);
        const charsByType = {};
        for (const c of gameChars) {
          charsByType[c.obtainable] = (charsByType[c.obtainable] || 0) + 1;
        }
        
        const gameInfoEmbed = new EmbedBuilder()
          .setColor(gameInfo.isActive ? '#00FF00' : '#FF0000')
          .setTitle(`🎮 ${gameInfo.name}`)
          .setDescription(gameInfo.description || 'No description')
          .addFields(
            { name: 'Status', value: gameInfo.isActive ? '🟢 Active' : '🔴 Inactive', inline: true },
            { name: 'Total Characters', value: gameChars.length.toString(), inline: true },
            { name: 'Default', value: gameInfo.isDefault ? 'Yes' : 'No', inline: true },
            { name: 'Characters by Type', value: Object.entries(charsByType).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None', inline: false },
            { name: 'Created By', value: gameInfo.createdBy || 'Unknown', inline: true }
          )
          .setFooter({ text: `Created: ${gameInfo.createdAt ? new Date(gameInfo.createdAt).toLocaleDateString() : 'Unknown'}` });
        
        await message.reply({ embeds: [gameInfoEmbed] });
        break;

      case 'bundlechars':
      case 'gamechars':
        const listGameName = args[0] || (serverId ? getServerGame(serverId) : null);
        
        if (!listGameName) {
          await message.reply('**Usage:** `!bundlechars <game>`');
          return;
        }
        
        const bundleChars = characterManager.listCharactersByGame(listGameName);
        if (bundleChars.length === 0) {
          await message.reply(`❌ No characters in game/bundle "${listGameName}"`);
          return;
        }
        
        const charListStr = bundleChars.slice(0, 50).map(c => `${c.emoji} ${c.name} (${c.obtainable})`).join('\n');
        const bundleCharsEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle(`📦 Characters in ${listGameName}`)
          .setDescription(charListStr + (bundleChars.length > 50 ? `\n... and ${bundleChars.length - 50} more` : ''))
          .setFooter({ text: `Total: ${bundleChars.length} characters` });
        
        await message.reply({ embeds: [bundleCharsEmbed] });
        break;

      case 'assigngame':
      case 'assignbundle':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can assign characters to games!');
          return;
        }
        
        const assignCharName = args[0];
        const assignGameName = args[1];
        
        if (!assignCharName || !assignGameName) {
          await message.reply('**Usage:** `!assigngame <character> <game>`\n\n**Example:** `!assigngame Luna MyZoo`');
          return;
        }
        
        const assignResult = await characterManager.setCharacterGame(userId, assignCharName, assignGameName);
        await message.reply(assignResult.message);
        break;

      case 'bulkassign':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can bulk assign characters!');
          return;
        }
        
        const bulkAssignGameName = args[0];
        const bulkAssignCharNames = args.slice(1);
        
        if (!bulkAssignGameName || bulkAssignCharNames.length === 0) {
          await message.reply('**Usage:** `!bulkassign <game> <char1> <char2> ...`\n\n**Example:** `!bulkassign MyZoo Luna Max Bella`');
          return;
        }
        
        const bulkAssignResult = await characterManager.bulkSetCharacterGame(userId, bulkAssignCharNames, bulkAssignGameName);
        await message.reply(bulkAssignResult.message);
        break;

      case 'importchars':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can import characters between games!');
          return;
        }
        
        const sourceGame = args[0];
        const targetGame = args[1];
        const importCharNames = args.slice(2);
        
        if (!sourceGame || !targetGame) {
          await message.reply('**Usage:** `!importchars <source_game> <target_game> [char1 char2 ...]`\n\nLeave character names empty to import all.');
          return;
        }
        
        const importResult = await characterManager.importCharactersToGame(userId, sourceGame, targetGame, importCharNames.length > 0 ? importCharNames : null);
        await message.reply(importResult.message);
        break;

      case 'backfillgames':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can run backfill!');
          return;
        }
        
        const backfillResult = await characterManager.backfillGameAndCreator();
        await message.reply(backfillResult.message);
        break;

      case 'effecttypes':
      case 'abilityeffects':
        const effectsEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('⚡ Ability Effect Types & Keywords')
          .setDescription('Use these effect types when submitting characters with `!submit`\n\n**Format:** `AbilityName,Emoji,Description,EffectType,EffectValue`')
          .addFields(
            {
              name: '🔥 **damageBoost**',
              value: '**Keyword:** `damageBoost`\n**Effect:** Increases damage output\n**Value:** Decimal (e.g., 0.1 = 10% boost)\n**Example:** `FirePower,🔥,Boosts damage by 10%,damageBoost,0.1`',
              inline: false
            },
            {
              name: '💚 **healPerTurn**',
              value: '**Keyword:** `healPerTurn`\n**Effect:** Heals a percentage of HP every turn\n**Value:** Decimal (e.g., 0.05 = 5% per turn)\n**Example:** `Moonlight,🌕,Heals 5% HP per turn,healPerTurn,0.05`',
              inline: false
            },
            {
              name: '🔥 **burnDamage**',
              value: '**Keyword:** `burnDamage`\n**Effect:** Deals damage over time to opponent\n**Value:** Decimal (e.g., 0.03 = 3% per turn)\n**Example:** `Inferno,🔥,Deals 3% damage per turn,burnDamage,0.03`',
              inline: false
            },
            {
              name: '🛡️ **reflectDamage**',
              value: '**Keyword:** `reflectDamage`\n**Effect:** Reflects damage back to attacker\n**Value:** Decimal (e.g., 0.2 = 20% reflection)\n**Example:** `Mirror,🪞,Reflects 20% damage,reflectDamage,0.2`',
              inline: false
            },
            {
              name: '⚡ **stun**',
              value: '**Keyword:** `stun`\n**Effect:** Chance to stun opponent (skip their turn)\n**Value:** Decimal (e.g., 0.25 = 25% stun chance)\n**Example:** `Thunder,⚡,25% chance to stun,stun,0.25`',
              inline: false
            },
            {
              name: '🛡️ **dodge**',
              value: '**Keyword:** `dodge`\n**Effect:** Chance to dodge incoming attacks\n**Value:** Decimal (e.g., 0.15 = 15% dodge chance)\n**Example:** `Shadow,👤,15% dodge chance,dodge,0.15`',
              inline: false
            },
            {
              name: '💰 **damageReduce**',
              value: '**Keyword:** `damageReduce`\n**Effect:** Reduces incoming damage\n**Value:** Decimal (e.g., 0.05 = 5% reduction)\n**Example:** `Frostbite,❄️,Reduces damage by 5%,damageReduce,0.05`',
              inline: false
            }
          )
          .addFields(
            {
              name: '\n📝 **Quick Reference**',
              value: '```\n!submit Luna|🌙|crate\n!submit Luna|🌙|crate|Moonlight,🌕,Heals 5% HP per turn,healPerTurn,0.05\n!submit Luna|🌙|crate|Moonlight,🌕,Heals 5% HP per turn,healPerTurn,0.05|Moon Beam,90\n```',
              inline: false
            }
          )
          .setFooter({ text: 'Use !effecttypes to view this list anytime' });
        
        await message.reply({ embeds: [effectsEmbed] });
        break;

      case 'submit':
      case 'submitchar':
        if (!data.users[userId].started) {
          await message.reply('❌ You need to start playing first! Use `!start`');
          return;
        }
        
        const submitParts = args.join(' ').split('|').map(p => p.trim());
        
        if (submitParts.length < 2) {
          await message.reply('**Usage:** `!submit Name|Emoji|Obtainable|AbilityName,AbilityEmoji,AbilityDesc,EffectType,EffectValue|MoveName,MoveDamage`\n\n**Simple Example:** `!submit Luna|🌙|crate`\n**Full Example:** `!submit Luna|🌙|crate|Moonlight,🌕,Heals 5% HP per turn,healPerTurn,0.05|Moon Beam,90`');
          return;
        }
        
        const submitData = {
          name: submitParts[0],
          emoji: submitParts[1],
          obtainable: submitParts[2] || 'crate'
        };
        
        if (submitParts[3]) {
          const abilityParts = submitParts[3].split(',').map(p => p.trim());
          if (abilityParts.length >= 4) {
            submitData.ability = {
              name: abilityParts[0],
              emoji: abilityParts[1],
              description: abilityParts[2],
              effectType: abilityParts[3],
              effectValue: parseFloat(abilityParts[4]) || 0.1
            };
          }
        }
        
        if (submitParts[4]) {
          const moveParts = submitParts[4].split(',').map(p => p.trim());
          if (moveParts.length >= 2) {
            submitData.specialMove = {
              name: moveParts[0],
              damage: parseInt(moveParts[1]) || 90
            };
          }
        }
        
        const submitResult = await charSubmissionSystem.submitCharacter(userId, message.author.username, serverId, submitData);
        await message.reply(submitResult.message);
        break;

      case 'mysubmissions':
        const userSubs = charSubmissionSystem.getUserSubmissions(userId);
        
        if (userSubs.length === 0) {
          await message.reply('📋 You have no character submissions.');
          return;
        }
        
        const userSubsList = userSubs.slice(0, 10).map(s => {
          const statusEmoji = s.status === 'pending' ? '⏳' : s.status === 'approved' ? '✅' : '❌';
          return `${statusEmoji} \`${s.id}\` ${s.emoji} **${s.name}** → ${s.targetGame}`;
        }).join('\n');
        
        const mySubsEmbed = new EmbedBuilder()
          .setColor('#00D9FF')
          .setTitle('📋 Your Submissions')
          .setDescription(userSubsList)
          .setFooter({ text: `Total: ${userSubs.length} submissions` });
        
        await message.reply({ embeds: [mySubsEmbed] });
        break;

      case 'submissions':
      case 'pendingsubs':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only Bot Admins can view pending submissions!');
          return;
        }
        
        const pendingList = charSubmissionSystem.formatPendingList();
        await message.reply(pendingList);
        break;

      case 'reviewsub':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only Bot Admins can review submissions!');
          return;
        }
        
        const reviewSubId = args[0];
        if (!reviewSubId) {
          await message.reply('**Usage:** `!reviewsub <submission_id>`');
          return;
        }
        
        const subToReview = charSubmissionSystem.getSubmission(reviewSubId.toUpperCase());
        if (!subToReview) {
          await message.reply(`❌ Submission "${reviewSubId}" not found!`);
          return;
        }
        
        const reviewEmbed = charSubmissionSystem.formatSubmissionEmbed(subToReview);
        await message.reply({ embeds: [reviewEmbed] });
        break;

      case 'approve':
      case 'approvechar':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only Bot Admins can approve submissions!');
          return;
        }
        
        const charApproveSubId = args[0];
        if (!charApproveSubId) {
          await message.reply('**Usage:** `!approve <submission_id>`');
          return;
        }
        
        const charApproveResult = await charSubmissionSystem.approveSubmission(charApproveSubId.toUpperCase(), userId, characterManager, client);
        await message.reply(charApproveResult.message);
        break;

      case 'reject':
      case 'rejectchar':
        if (!isSuperAdmin(userId) && !isBotAdmin(userId, serverId)) {
          await message.reply('❌ Only Bot Admins can reject submissions!');
          return;
        }
        
        const charRejectSubId = args[0];
        const charRejectReason = args.slice(1).join(' ') || null;
        
        if (!charRejectSubId) {
          await message.reply('**Usage:** `!reject <submission_id> [reason]`');
          return;
        }
        
        const charRejectResult = await charSubmissionSystem.rejectSubmission(charRejectSubId.toUpperCase(), userId, charRejectReason, client);
        await message.reply(charRejectResult.message);
        break;

      case 'cancelsub':
        const cancelSubId = args[0];
        if (!cancelSubId) {
          await message.reply('**Usage:** `!cancelsub <submission_id>`');
          return;
        }
        
        const cancelResult = await charSubmissionSystem.cancelSubmission(cancelSubId.toUpperCase(), userId);
        await message.reply(cancelResult.message);
        break;

      case 'serverstatus':
      case 'setupstatus':
        const serverStatusId = serverId;
        if (!serverStatusId) {
          await message.reply('❌ This command must be used in a server!');
          return;
        }
        
        const currentSetupStatus = getSetupStatus(serverStatusId);
        const currentServerGame = getServerGame(serverStatusId);
        
        const serverStatusEmbed = new EmbedBuilder()
          .setColor(currentSetupStatus.isComplete ? '#00FF00' : '#FFA500')
          .setTitle('📊 Server Setup Status')
          .addFields(
            { name: '🎮 Selected Game', value: currentServerGame || '❌ Not set', inline: true },
            { name: '📣 Drop Channel', value: currentSetupStatus.hasDropChannel ? '✅ Set' : '❌ Not set', inline: true },
            { name: '🎉 Events Channel', value: currentSetupStatus.hasEventsChannel ? '✅ Set' : '❌ Not set', inline: true },
            { name: '📢 Updates Channel', value: currentSetupStatus.hasUpdatesChannel ? '✅ Set' : '❌ Not set', inline: true },
            { name: 'Overall Status', value: currentSetupStatus.isComplete ? '✅ Fully Setup' : `⚠️ Missing: ${currentSetupStatus.missing.join(', ')}`, inline: false }
          )
          .setFooter({ text: 'Use !setup to see setup instructions' });
        
        await message.reply({ embeds: [serverStatusEmbed] });
        break;

      case 'togglegame':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can toggle game status!');
          return;
        }
        
        const toggleGameName = args[0];
        if (!toggleGameName) {
          await message.reply('**Usage:** `!togglegame <name>`');
          return;
        }
        
        const gameToggleResult = await gameSystem.toggleGameStatus(userId, toggleGameName);
        await message.reply(gameToggleResult.message);
        break;

      case 'gamestats':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view game stats!');
          return;
        }
        
        const gameStats = characterManager.getGameStats();
        let statsStr = '';
        
        for (const [gameName, stats] of Object.entries(gameStats)) {
          statsStr += `**${gameName}**: ${stats.total} chars\n`;
          const obtTypes = Object.entries(stats.byObtainable).map(([k, v]) => `${k}: ${v}`).join(', ');
          if (obtTypes) statsStr += `  └ ${obtTypes}\n`;
        }
        
        const gameStatsEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('📊 Game Statistics')
          .setDescription(statsStr || 'No statistics available')
          .setFooter({ text: `Total games: ${Object.keys(gameStats).length}` });
        
        await message.reply({ embeds: [gameStatsEmbed] });
        break;

      case 'warn':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canMuteInServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **ZooAdmins** and above can warn users!');
          return;
        }
        
        const warnTarget = message.mentions.users.first();
        if (!warnTarget) {
          await message.reply('**Usage:** `!warn @user [reason]`');
          return;
        }
        
        if (warnTarget.id === userId) {
          await message.reply('❌ You cannot warn yourself!');
          return;
        }
        
        const warnTargetRole = getUserRole(warnTarget.id, serverId, message.guild.members.cache.get(warnTarget.id));
        const warnerRole = getUserRole(userId, serverId, message.member);
        if (warnTargetRole.level >= warnerRole.level) {
          await message.reply('❌ You cannot warn someone with an equal or higher role!');
          return;
        }
        
        const warnReason = args.slice(1).join(' ') || 'No reason provided';
        const warnResult = await moderationSystem.warnUser(serverId, warnTarget.id, userId, warnReason);
        
        const warnEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('⚠️ User Warned')
          .setDescription(`<@${warnTarget.id}> has been warned.`)
          .addFields(
            { name: 'Reason', value: warnReason, inline: false },
            { name: 'Total Warnings', value: warnResult.totalWarnings.toString(), inline: true },
            { name: 'Warned By', value: `<@${userId}>`, inline: true }
          )
          .setTimestamp();
        
        if (warnResult.autoAction === 'ban_recommended') {
          warnEmbed.addFields({ name: '⚠️ Action Recommended', value: 'User has 5+ warnings. Consider using `!botban` to ban them from bot commands.' });
        }
        
        await message.reply({ embeds: [warnEmbed] });
        break;

      case 'warnings':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        
        const warningsTarget = message.mentions.users.first() || message.author;
        const userWarnings = moderationSystem.getWarnings(serverId, warningsTarget.id);
        const warningsEmbed = moderationSystem.createWarningsEmbed(warningsTarget.id, userWarnings, message.guild.name);
        
        await message.reply({ embeds: [warningsEmbed] });
        break;

      case 'clearwarnings':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canBanInServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **Server Admins** and above can clear warnings!');
          return;
        }
        
        const clearWarnTarget = message.mentions.users.first();
        if (!clearWarnTarget) {
          await message.reply('**Usage:** `!clearwarnings @user`');
          return;
        }
        
        const clearResult = await moderationSystem.clearWarnings(serverId, clearWarnTarget.id, userId);
        await message.reply(`✅ Cleared **${clearResult.cleared}** warning(s) from <@${clearWarnTarget.id}>.`);
        break;

      case 'botban':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canBanInServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **Server Admins** and above can ban users from bot commands!');
          return;
        }
        
        const banTarget = message.mentions.users.first();
        if (!banTarget) {
          await message.reply('**Usage:** `!botban @user [reason]`\n\nThis bans the user from using bot commands in this server.');
          return;
        }
        
        if (banTarget.id === userId) {
          await message.reply('❌ You cannot ban yourself!');
          return;
        }
        
        const banTargetRole = getUserRole(banTarget.id, serverId, message.guild.members.cache.get(banTarget.id));
        const bannerRole = getUserRole(userId, serverId, message.member);
        if (banTargetRole.level >= bannerRole.level) {
          await message.reply('❌ You cannot ban someone with an equal or higher role!');
          return;
        }
        
        const banReason = args.slice(1).join(' ') || 'No reason provided';
        await moderationSystem.banUserFromBot(serverId, banTarget.id, userId, banReason, data);
        
        const banEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('🔨 User Banned from Bot')
          .setDescription(`<@${banTarget.id}> has been banned from using bot commands in this server.`)
          .addFields(
            { name: 'Reason', value: banReason },
            { name: 'Banned By', value: `<@${userId}>` }
          )
          .setTimestamp();
        
        await message.reply({ embeds: [banEmbed] });
        break;

      case 'unbotban':
      case 'botunban':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canBanInServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **Server Admins** and above can unban users!');
          return;
        }
        
        const unbanTarget = message.mentions.users.first();
        if (!unbanTarget) {
          await message.reply('**Usage:** `!unbotban @user`');
          return;
        }
        
        const unbanResult = await moderationSystem.unbanUserFromBot(serverId, unbanTarget.id, userId);
        if (unbanResult.success) {
          await message.reply(`✅ <@${unbanTarget.id}> has been unbanned from bot commands.`);
        } else {
          await message.reply(`❌ ${unbanResult.error}`);
        }
        break;

      case 'mute':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canMuteInServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **ZooAdmins** and above can mute users!');
          return;
        }
        
        const muteTarget = message.mentions.users.first();
        if (!muteTarget) {
          await message.reply('**Usage:** `!mute @user [duration] [reason]`\n\nDuration examples: 30s, 10m, 1h, 1d (default: 1h)');
          return;
        }
        
        if (muteTarget.id === userId) {
          await message.reply('❌ You cannot mute yourself!');
          return;
        }
        
        const muteTargetRole = getUserRole(muteTarget.id, serverId, message.guild.members.cache.get(muteTarget.id));
        const muterRole = getUserRole(userId, serverId, message.member);
        if (muteTargetRole.level >= muterRole.level) {
          await message.reply('❌ You cannot mute someone with an equal or higher role!');
          return;
        }
        
        let muteDuration = 3600000;
        let muteReason = 'No reason provided';
        
        if (args[1]) {
          const parsedDuration = moderationSystem.formatDuration(args[1]);
          if (parsedDuration) {
            muteDuration = parsedDuration;
            muteReason = args.slice(2).join(' ') || 'No reason provided';
          } else {
            muteReason = args.slice(1).join(' ');
          }
        }
        
        await moderationSystem.muteUser(serverId, muteTarget.id, userId, muteDuration, muteReason);
        
        const muteMinutes = Math.ceil(muteDuration / 60000);
        const muteEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('🔇 User Muted')
          .setDescription(`<@${muteTarget.id}> has been muted from bot commands.`)
          .addFields(
            { name: 'Duration', value: `${muteMinutes} minute(s)`, inline: true },
            { name: 'Reason', value: muteReason, inline: false },
            { name: 'Muted By', value: `<@${userId}>`, inline: true }
          )
          .setTimestamp();
        
        await message.reply({ embeds: [muteEmbed] });
        break;

      case 'unmute':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canMuteInServer(userId, serverId, message.member)) {
          await message.reply('❌ Only **ZooAdmins** and above can unmute users!');
          return;
        }
        
        const unmuteTarget = message.mentions.users.first();
        if (!unmuteTarget) {
          await message.reply('**Usage:** `!unmute @user`');
          return;
        }
        
        const unmuteResult = await moderationSystem.unmuteUser(serverId, unmuteTarget.id, userId);
        if (unmuteResult.success) {
          await message.reply(`✅ <@${unmuteTarget.id}> has been unmuted.`);
        } else {
          await message.reply(`❌ ${unmuteResult.error}`);
        }
        break;

      case 'clear':
      case 'purge':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!canModerate(userId, serverId, message.member)) {
          await message.reply('❌ Only **ZooAdmins** and above can clear messages!');
          return;
        }
        
        if (!message.channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
          await message.reply('❌ I need the **Manage Messages** permission to clear messages!');
          return;
        }
        
        const clearCount = parseInt(args[0]) || 10;
        if (clearCount < 1 || clearCount > 100) {
          await message.reply('❌ Please specify a number between 1 and 100.');
          return;
        }
        
        const filterUser = message.mentions.users.first();
        const clearResult2 = await moderationSystem.clearMessages(message.channel, clearCount, filterUser?.id);
        
        if (clearResult2.success) {
          const clearMsg = await message.channel.send(`✅ Cleared **${clearResult2.deleted}** message(s)${filterUser ? ` from <@${filterUser.id}>` : ''}.`);
          setTimeout(() => clearMsg.delete().catch(() => {}), 5000);
        } else {
          await message.reply(`❌ Failed to clear messages: ${clearResult2.error}`);
        }
        break;

      case 'announce':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!isSuperAdmin(userId) && !isBotAdmin(userId)) {
          await message.reply('❌ Only Bot Admins can make announcements!');
          return;
        }
        
        const announceContent = args.join(' ');
        if (!announceContent) {
          await message.reply('**Usage:** `!announce <message>`\n\nSends a formatted announcement to the current channel.');
          return;
        }
        
        await moderationSystem.announceToChannel(message.channel, announceContent, {
          title: '📢 Announcement',
          color: 0x5865F2,
          footer: `Announced by ${message.author.username}`
        });
        
        try {
          await message.delete();
        } catch (e) {}
        break;

      case 'modlogs':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!isSuperAdmin(userId) && !isBotAdmin(userId)) {
          await message.reply('❌ Only Bot Admins can view moderation logs!');
          return;
        }
        
        const modLogs = await moderationSystem.getFullModLogs(serverId, { limit: 20 });
        const modLogsEmbed = moderationSystem.createModLogEmbed(modLogs, message.guild.name);
        
        await message.reply({ embeds: [modLogsEmbed] });
        break;

      case 'modstats':
        if (!serverId) {
          await message.reply('❌ This command can only be used in a server!');
          return;
        }
        if (!isSuperAdmin(userId) && !isBotAdmin(userId)) {
          await message.reply('❌ Only Bot Admins can view moderation stats!');
          return;
        }
        
        const modStats = moderationSystem.getModerationStats(serverId);
        const modStatsEmbed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('📊 Moderation Statistics')
          .setDescription(`Moderation stats for **${message.guild.name}**`)
          .addFields(
            { name: 'Users Warned', value: modStats.usersWarned.toString(), inline: true },
            { name: 'Total Warnings', value: modStats.totalWarnings.toString(), inline: true },
            { name: 'Active Bans', value: modStats.activeBans.toString(), inline: true },
            { name: 'Active Mutes', value: modStats.activeMutes.toString(), inline: true },
            { name: 'Recent Actions', value: modStats.recentActions.toString(), inline: true }
          )
          .setTimestamp();
        
        await message.reply({ embeds: [modStatsEmbed] });
        break;

      case 'flags':
      case 'userflags':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view user flags!');
          return;
        }
        
        const flagsTarget = message.mentions.users.first();
        if (!flagsTarget) {
          await message.reply('**Usage:** `!flags @user`\n\nView anti-cheat flags for a user.');
          return;
        }
        
        const userFlags = antiCheatSystem.getUserFlags(flagsTarget.id);
        const flagsEmbed = antiCheatSystem.createFlagsEmbed(flagsTarget.id, userFlags);
        
        await message.reply({ embeds: [flagsEmbed] });
        break;

      case 'clearflags':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can clear user flags!');
          return;
        }
        
        const clearFlagsTarget = message.mentions.users.first();
        if (!clearFlagsTarget) {
          await message.reply('**Usage:** `!clearflags @user`');
          return;
        }
        
        antiCheatSystem.clearUserFlags(clearFlagsTarget.id);
        await message.reply(`✅ Cleared all flags for <@${clearFlagsTarget.id}>.`);
        break;

      case 'suspicious':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view suspicious users!');
          return;
        }
        
        const threshold = parseInt(args[0]) || 3;
        const suspiciousUsers = antiCheatSystem.getSuspiciousUsers(threshold);
        
        const suspiciousEmbed = new EmbedBuilder()
          .setColor(0xFF6B6B)
          .setTitle('⚠️ Suspicious Users Report')
          .setDescription(`Users with ${threshold}+ flags in the last hour`)
          .setTimestamp();
        
        if (suspiciousUsers.length === 0) {
          suspiciousEmbed.addFields({ name: 'No Suspicious Users', value: 'No users currently meet the threshold.' });
        } else {
          const userList = suspiciousUsers.slice(0, 10).map((u, i) => 
            `${i + 1}. <@${u.userId}> - **${u.flagCount}** flags`
          ).join('\n');
          suspiciousEmbed.addFields({ name: `Found ${suspiciousUsers.length} User(s)`, value: userList });
        }
        
        await message.reply({ embeds: [suspiciousEmbed] });
        break;

      case 'transactions':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view transaction history!');
          return;
        }
        
        const txTarget = message.mentions.users.first();
        if (!txTarget) {
          await message.reply('**Usage:** `!transactions @user`\n\nView recent transactions for a user.');
          return;
        }
        
        const transactions = await antiCheatSystem.getFullTransactionHistory(txTarget.id, { limit: 20 });
        const txEmbed = antiCheatSystem.createTransactionLogEmbed(transactions, txTarget.id);
        
        await message.reply({ embeds: [txEmbed] });
        break;

      case 'anticheatstats':
      case 'acstats':
        if (!isSuperAdmin(userId)) {
          await message.reply('❌ Only Super Admins can view anti-cheat stats!');
          return;
        }
        
        const acStats = antiCheatSystem.getAntiCheatStats();
        const acStatsEmbed = new EmbedBuilder()
          .setColor(0x00D9FF)
          .setTitle('🛡️ Anti-Cheat Statistics')
          .setDescription('Current anti-cheat system status')
          .addFields(
            { name: 'Active Rate Limits', value: acStats.activeRateLimits.toString(), inline: true },
            { name: 'Tracked Users', value: acStats.trackedUsers.toString(), inline: true },
            { name: 'Users with Flags', value: acStats.usersWithFlags.toString(), inline: true },
            { name: 'Total Flags (1h)', value: acStats.totalFlags.toString(), inline: true },
            { name: 'Transaction Log Size', value: acStats.transactionLogSize.toString(), inline: true }
          )
          .setTimestamp();
        
        await message.reply({ embeds: [acStatsEmbed] });
        break;

      case 'modhelp':
        const modHelpEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🛡️ Moderation Commands')
          .setDescription('Commands for managing users and keeping your server safe.')
          .addFields(
            { name: '⚠️ Warnings', value: '`!warn @user [reason]` - Warn a user\n`!warnings [@user]` - View warnings\n`!clearwarnings @user` - Clear all warnings' },
            { name: '🔨 Bans (Bot Commands)', value: '`!botban @user [reason]` - Ban from bot commands\n`!unbotban @user` - Remove bot ban' },
            { name: '🔇 Mutes', value: '`!mute @user [duration] [reason]` - Mute user\n`!unmute @user` - Unmute user\n\n*Durations: 30s, 10m, 1h, 1d*' },
            { name: '🧹 Message Management', value: '`!clear <count> [@user]` - Delete messages\n`!announce <message>` - Send announcement' },
            { name: '📋 Logs & Stats', value: '`!modlogs` - View moderation logs\n`!modstats` - View moderation statistics' },
            { name: '🛡️ Anti-Cheat (Super Admin)', value: '`!flags @user` - View user flags\n`!clearflags @user` - Clear flags\n`!suspicious [threshold]` - View flagged users\n`!transactions @user` - View transaction history\n`!anticheatstats` - View system stats' }
          )
          .setFooter({ text: 'ZooAdmin role required for most commands' });
        
        await message.reply({ embeds: [modHelpEmbed] });
        break;
        
      default:
        // Try to execute command from command handler (commands in /commands directory)
        const cmdResult = await executeCommand(command, { message, args, data, client });
        if (!cmdResult.executed) {
          // Command not found in handler either, silently ignore
          if (cmdResult.reason === 'no_permission' && cmdResult.message) {
            await message.reply(cmdResult.message);
          }
          return;
        }
        break;
    }
    
    if (data.users[userId] && data.users[userId].started) {
      try {
        await addCommandXP(data.users[userId], command, client, userId);
        saveData(data);
      } catch (xpError) {
        console.error('Error adding XP:', xpError);
      }
    }
    
    // Add server aura for command execution
    if (message.guild) {
      try {
        const { addAura } = require('./serverAuraSystem.js');
        addAura(message.guild.id, 1, 'command').catch(e => console.error('Error adding command aura:', e));
      } catch (auraError) {
        // Silently fail aura tracking
      }
    }
    
  } catch (error) {
    console.error('Command error:', error);
    await message.reply('❌ An error occurred while processing your command!');
  }
});

// Auto-backfill main server with ZooBot original characters and default collectibles
async function backfillMainServerData() {
  const { getCollection, isMongoConnected } = require('./mongoManager.js');
  const { BOT_CONFIG } = require('./config.js');
  const HARDCODED_CHARACTERS = require('./characters.js');
  const crypto = require('crypto');
  
  if (!isMongoConnected()) {
    console.log('⚠️ MongoDB not connected, skipping main server backfill');
    return;
  }
  
  const mainServerId = BOT_CONFIG.MAIN_SERVER_ID;
  
  // Backfill characters
  const charCollection = await getCollection('serverCharacters');
  let charsAdded = 0;
  
  const hardcodedAbilities = require('./characterAbilities.js').CHARACTER_ABILITIES;
  const hardcodedMoves = require('./moves.js').SPECIAL_MOVES;
  
  for (const char of HARDCODED_CHARACTERS) {
    const existing = await charCollection.findOne({
      serverId: mainServerId,
      name: { $regex: new RegExp(`^${char.name}$`, 'i') }
    });
    
    if (!existing) {
      const uniqueId = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      const ability = hardcodedAbilities[char.name] || { 
        name: `${char.name}'s Power`, 
        emoji: '⭐', 
        description: 'Gains a small damage bonus.', 
        type: 'passive', 
        effect: { flatDamageBonus: 5 } 
      };
      
      const specialMove = hardcodedMoves[char.name] || { 
        name: `${char.name}'s Strike`, 
        damage: 90 
      };
      
      await charCollection.insertOne({
        serverId: mainServerId,
        uniqueId,
        name: char.name,
        emoji: char.emoji,
        customEmojiId: char.customEmojiId || null,
        description: `${char.name} - A ZooBot original character`,
        rarity: 'common',
        obtainable: char.obtainable || 'crate',
        game: 'ZooBot',
        ability: ability,
        specialMove: specialMove,
        stats: { hp: 100, attack: 50, defense: 50, speed: 50, critChance: 0.1, dodgeChance: 0.05 },
        dropSettings: { enabled: true, probability: 10 },
        crateSettings: { enabled: true, probability: 10, crates: ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'] },
        status: 'active',
        createdBy: 'ZooBot',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      charsAdded++;
    }
  }
  
  // Backfill default collectibles
  const collectCollection = await getCollection('serverCollectibles');
  const DEFAULT_COLLECTIBLES = [
    { name: 'Golden Trophy', emoji: '🏆', rarity: 'legendary', baseValue: 500 },
    { name: 'Diamond Ring', emoji: '💍', rarity: 'epic', baseValue: 300 },
    { name: 'Ancient Coin', emoji: '🪙', rarity: 'rare', baseValue: 150 },
    { name: 'Magic Crystal', emoji: '🔮', rarity: 'ultra rare', baseValue: 200 },
    { name: 'Lucky Clover', emoji: '🍀', rarity: 'uncommon', baseValue: 75 },
    { name: 'Seashell', emoji: '🐚', rarity: 'common', baseValue: 30 },
    { name: 'Star Fragment', emoji: '⭐', rarity: 'rare', baseValue: 120 },
    { name: 'Rainbow Feather', emoji: '🪶', rarity: 'epic', baseValue: 250 },
    { name: 'Crown Jewel', emoji: '👑', rarity: 'legendary', baseValue: 750 },
    { name: 'Mystic Orb', emoji: '🌐', rarity: 'ultra rare', baseValue: 180 }
  ];
  
  let collectiblesAdded = 0;
  for (const item of DEFAULT_COLLECTIBLES) {
    const existing = await collectCollection.findOne({
      serverId: mainServerId,
      name: { $regex: new RegExp(`^${item.name}$`, 'i') }
    });
    
    if (!existing) {
      const uniqueId = crypto.randomBytes(4).toString('hex').toUpperCase();
      await collectCollection.insertOne({
        serverId: mainServerId,
        uniqueId,
        name: item.name,
        emoji: item.emoji,
        rarity: item.rarity,
        baseValue: item.baseValue,
        dropSettings: { enabled: true, probability: 10 },
        crateSettings: { enabled: true, probability: 10, crates: ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'] },
        crateObtainable: { enabled: true, probability: 10, crates: ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'] },
        status: 'active',
        createdBy: 'ZooBot',
        createdAt: new Date()
      });
      collectiblesAdded++;
    }
  }
  
  if (charsAdded > 0 || collectiblesAdded > 0) {
    console.log(`📦 Backfilled main server: ${charsAdded} characters, ${collectiblesAdded} collectibles`);
  }
}

async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    stopDropSystem();
    console.log('✅ Stopped drop system');
    
    await saveDataImmediate(data);
    console.log('✅ Flushed all pending data saves');
    
    if (process.env.USE_MONGODB === 'true') {
      const mongoManager = require('./mongoManager.js');
      await mongoManager.disconnect();
    }
    
    await client.destroy();
    console.log('✅ Discord client disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  saveDataImmediate(data).then(() => {
    process.exit(1);
  }).catch(() => {
    process.exit(1);
  });
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ ERROR: DISCORD_BOT_TOKEN not found in environment variables!');
  console.log('Please add your Discord bot token to the Secrets.');
  process.exit(1);
}

client.login(token);
