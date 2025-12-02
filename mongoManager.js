const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let connected = false;

async function connect() {
  if (connected && client) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: true,
      retryReads: true,
      compressors: ['zlib']
    });
    await client.connect();
    db = client.db('discord_bot');
    connected = true;
    console.log('✅ Connected to MongoDB with connection pooling (pool size: 5-50)');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    connected = false;
    client = null;
    throw error;
  }
}

async function disconnect() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    connected = false;
    console.log('🔌 Disconnected from MongoDB');
  }
}

async function getCollection(collectionName) {
  if (!connected) {
    await connect();
  }
  return db.collection(collectionName);
}

function getDb() {
  if (!connected || !db) {
    return null;
  }
  return db;
}

async function ensureConnected() {
  if (!connected) {
    await connect();
  }
  return db;
}

async function loadData() {
  try {
    const usersCollection = await getCollection('users');
    const configCollection = await getCollection('config');
    const clansCollection = await getCollection('clans');
    
    const users = await usersCollection.find({}).toArray();
    const config = await configCollection.findOne({ _id: 'bot_config' });
    const clans = await clansCollection.find({}).toArray();
    
    const userData = {};
    users.forEach(user => {
      const userId = user.userId;
      delete user._id;
      delete user.userId;
      userData[userId] = user;
    });
    
    const clansData = {};
    clans.forEach(clan => {
      const serverId = clan.serverId;
      delete clan._id;
      clansData[serverId] = clan;
    });
    
    const clanWarsConfig = await configCollection.findOne({ _id: 'clan_wars' });
    const marketConfig = await configCollection.findOne({ _id: 'market_data' });
    const auctionConfig = await configCollection.findOne({ _id: 'auction_data' });
    const workImagesConfig = await configCollection.findOne({ _id: 'work_images' });
    const qaConfig = await configCollection.findOne({ _id: 'qa_data' });
    
    return {
      users: userData,
      clans: clansData,
      clanWars: clanWarsConfig || {
        currentWeekStart: Date.now(),
        lastReset: Date.now(),
        weekNumber: 1
      },
      globalMarket: marketConfig?.globalMarket || [],
      globalAuctions: auctionConfig?.globalAuctions || [],
      marketIdCounter: marketConfig?.marketIdCounter || 0,
      auctionIdCounter: auctionConfig?.auctionIdCounter || 0,
      workImages: workImagesConfig?.images || {},
      globalQA: qaConfig?.globalQA || [],
      globalQASubmissions: qaConfig?.globalQASubmissions || [],
      dropChannelId: config?.dropChannelId || null,
      battleChannelId: config?.battleChannelId || null,
      eventChannelId: config?.eventChannelId || null
    };
  } catch (error) {
    console.error('Error loading data from MongoDB:', error);
    return {
      users: {},
      clans: {},
      clanWars: {
        currentWeekStart: Date.now(),
        lastReset: Date.now(),
        weekNumber: 1
      },
      globalMarket: [],
      globalAuctions: [],
      marketIdCounter: 0,
      auctionIdCounter: 0,
      workImages: {},
      globalQA: [],
      globalQASubmissions: [],
      dropChannelId: null,
      battleChannelId: null,
      eventChannelId: null
    };
  }
}

function stripUnnecessaryFields(userData) {
  const cleaned = { ...userData };
  
  if (Array.isArray(cleaned.mailbox) && cleaned.mailbox.length === 0) delete cleaned.mailbox;
  if (Array.isArray(cleaned.completedQuests) && cleaned.completedQuests.length === 0) delete cleaned.completedQuests;
  if (cleaned.inventory && Object.keys(cleaned.inventory).length === 0) delete cleaned.inventory;
  
  return cleaned;
}

async function saveData(data) {
  try {
    const usersCollection = await getCollection('users');
    const configCollection = await getCollection('config');
    const clansCollection = await getCollection('clans');
    
    const bulkOps = [];
    for (const [userId, userData] of Object.entries(data.users)) {
      const cleanedData = stripUnnecessaryFields(userData);
      bulkOps.push({
        updateOne: {
          filter: { userId },
          update: { $set: { userId, ...cleanedData } },
          upsert: true
        }
      });
    }
    
    if (bulkOps.length > 0) {
      await usersCollection.bulkWrite(bulkOps);
    }
    
    if (data.clans) {
      const clanBulkOps = [];
      for (const [serverId, clanData] of Object.entries(data.clans)) {
        clanBulkOps.push({
          updateOne: {
            filter: { serverId },
            update: { $set: { ...clanData } },
            upsert: true
          }
        });
      }
      
      if (clanBulkOps.length > 0) {
        await clansCollection.bulkWrite(clanBulkOps);
      }
    }
    
    await configCollection.updateOne(
      { _id: 'bot_config' },
      { 
        $set: { 
          dropChannelId: data.dropChannelId,
          battleChannelId: data.battleChannelId,
          eventChannelId: data.eventChannelId
        } 
      },
      { upsert: true }
    );
    
    if (data.clanWars) {
      await configCollection.updateOne(
        { _id: 'clan_wars' },
        { $set: data.clanWars },
        { upsert: true }
      );
    }
    
    if (data.globalMarket !== undefined) {
      await configCollection.updateOne(
        { _id: 'market_data' },
        { 
          $set: { 
            globalMarket: data.globalMarket,
            marketIdCounter: data.marketIdCounter || 0
          } 
        },
        { upsert: true }
      );
    }
    
    if (data.globalAuctions !== undefined) {
      await configCollection.updateOne(
        { _id: 'auction_data' },
        { 
          $set: { 
            globalAuctions: data.globalAuctions,
            auctionIdCounter: data.auctionIdCounter || 0
          } 
        },
        { upsert: true }
      );
    }
    
    if (data.workImages !== undefined) {
      await configCollection.updateOne(
        { _id: 'work_images' },
        { $set: { images: data.workImages } },
        { upsert: true }
      );
    }
    
    if (data.globalQA !== undefined || data.globalQASubmissions !== undefined) {
      await configCollection.updateOne(
        { _id: 'qa_data' },
        { $set: { 
          globalQA: data.globalQA || [],
          globalQASubmissions: data.globalQASubmissions || []
        } },
        { upsert: true }
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error saving data to MongoDB:', error);
    return false;
  }
}

async function deleteUser(userId) {
  try {
    const usersCollection = await getCollection('users');
    const result = await usersCollection.deleteOne({ userId });
    
    if (result.deletedCount > 0) {
      console.log(`🗑️ Deleted user ${userId} from MongoDB`);
      return true;
    } else {
      console.log(`⚠️ User ${userId} not found in MongoDB`);
      return false;
    }
  } catch (error) {
    console.error('Error deleting user from MongoDB:', error);
    return false;
  }
}

async function getUserData(userId) {
  try {
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ userId });
    
    if (!user) {
      return null;
    }
    
    delete user._id;
    delete user.userId;
    return user;
  } catch (error) {
    console.error('Error getting user data from MongoDB:', error);
    return null;
  }
}

async function clearAllData() {
  try {
    const usersCollection = await getCollection('users');
    const configCollection = await getCollection('config');
    
    await usersCollection.deleteMany({});
    await configCollection.deleteMany({});
    
    console.log('🗑️ All MongoDB data cleared');
    return true;
  } catch (error) {
    console.error('Error clearing MongoDB data:', error);
    return false;
  }
}

async function getCurrentEvent() {
  try {
    const eventsCollection = await getCollection('events');
    const event = await eventsCollection.findOne(
      { status: 'active' },
      { sort: { startAt: -1 } }
    );
    return event;
  } catch (error) {
    console.error('Error getting current event:', error);
    return null;
  }
}

async function createEvent(eventData) {
  try {
    const eventsCollection = await getCollection('events');
    await eventsCollection.createIndex({ status: 1, startAt: -1 });
    const result = await eventsCollection.insertOne(eventData);
    return result.insertedId;
  } catch (error) {
    console.error('Error creating event:', error);
    return null;
  }
}

async function updateEvent(eventId, updateData) {
  try {
    const eventsCollection = await getCollection('events');
    await eventsCollection.updateOne(
      { _id: eventId },
      { $set: updateData }
    );
    return true;
  } catch (error) {
    console.error('Error updating event:', error);
    return false;
  }
}

async function recordEventProgress(eventId, userId, username, delta) {
  try {
    const participantsCollection = await getCollection('event_participants');
    await participantsCollection.createIndex({ eventId: 1, userId: 1 }, { unique: true });
    await participantsCollection.createIndex({ eventId: 1, score: -1 });
    
    await participantsCollection.updateOne(
      { eventId, userId },
      { 
        $inc: { score: delta },
        $set: { username, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error recording event progress:', error);
    return false;
  }
}

async function getEventParticipants(eventId) {
  try {
    const participantsCollection = await getCollection('event_participants');
    const participants = await participantsCollection
      .find({ eventId })
      .sort({ score: -1 })
      .toArray();
    return participants;
  } catch (error) {
    console.error('Error getting event participants:', error);
    return [];
  }
}

async function getEventParticipant(eventId, userId) {
  try {
    const participantsCollection = await getCollection('event_participants');
    const participant = await participantsCollection.findOne({ eventId, userId });
    return participant;
  } catch (error) {
    console.error('Error getting event participant:', error);
    return null;
  }
}

async function incrementUserResources(userId, resources = {}, mailDoc = null) {
  try {
    const usersCollection = await getCollection('users');
    
    const incrementOps = {};
    const setOnInsertOps = {
      userId,
      coins: 0,
      gems: 0,
      characters: [],
      selectedCharacter: null,
      pendingTokens: 0,
      started: false,
      trophies: 200,
      messageCount: 0,
      lastDailyClaim: null,
      mailbox: [],
      cageKeys: {},
      bronzeCrates: 0,
      silverCrates: 0,
      goldCrates: 0,
      emeraldCrates: 0,
      legendaryCrates: 0,
      tyrantCrates: 0
    };
    
    if (resources.coins) incrementOps.coins = resources.coins;
    if (resources.gems) incrementOps.gems = resources.gems;
    if (resources.cageKeys) incrementOps['cageKeys.general'] = resources.cageKeys;
    
    if (resources.crates) {
      if (resources.crates.legendary) incrementOps.legendaryCrates = resources.crates.legendary;
      if (resources.crates.emerald) incrementOps.emeraldCrates = resources.crates.emerald;
      if (resources.crates.gold) incrementOps.goldCrates = resources.crates.gold;
      if (resources.crates.bronze) incrementOps.bronzeCrates = resources.crates.bronze;
      if (resources.crates.silver) incrementOps.silverCrates = resources.crates.silver;
      if (resources.crates.tyrant) incrementOps.tyrantCrates = resources.crates.tyrant;
    }
    
    const updateOps = { $setOnInsert: setOnInsertOps };
    if (Object.keys(incrementOps).length > 0) {
      updateOps.$inc = incrementOps;
    }
    if (mailDoc) {
      updateOps.$push = { mailbox: mailDoc };
    }
    
    await usersCollection.updateOne(
      { userId },
      updateOps,
      { upsert: true }
    );
    
    return true;
  } catch (error) {
    console.error(`Error incrementing resources for user ${userId}:`, error);
    return false;
  }
}

async function applyEventRewards(eventId, rewardOps = []) {
  try {
    const usersCollection = await getCollection('users');
    
    const bulkOps = rewardOps.map(reward => {
      const incrementOps = {};
      const setOnInsertOps = {
        userId: reward.userId,
        coins: 0,
        gems: 0,
        characters: [],
        selectedCharacter: null,
        pendingTokens: 0,
        started: false,
        trophies: 200,
        messageCount: 0,
        lastDailyClaim: null,
        mailbox: [],
        cageKeys: {},
        bronzeCrates: 0,
        silverCrates: 0,
        goldCrates: 0,
        emeraldCrates: 0,
        legendaryCrates: 0,
        tyrantCrates: 0
      };
      
      if (reward.coins) incrementOps.coins = reward.coins;
      if (reward.gems) incrementOps.gems = reward.gems;
      if (reward.cageKeys) incrementOps['cageKeys.general'] = reward.cageKeys;
      
      if (reward.crates) {
        if (reward.crates.legendary) incrementOps.legendaryCrates = reward.crates.legendary;
        if (reward.crates.emerald) incrementOps.emeraldCrates = reward.crates.emerald;
        if (reward.crates.gold) incrementOps.goldCrates = reward.crates.gold;
      }
      
      const updateDoc = { $setOnInsert: setOnInsertOps };
      if (Object.keys(incrementOps).length > 0) {
        updateDoc.$inc = incrementOps;
      }
      if (reward.mail) {
        updateDoc.$push = { mailbox: reward.mail };
      }
      
      return {
        updateOne: {
          filter: { userId: reward.userId },
          update: updateDoc,
          upsert: true
        }
      };
    });
    
    if (bulkOps.length > 0) {
      await usersCollection.bulkWrite(bulkOps);
    }
    
    await updateEvent(eventId, { rewardsDistributed: true });
    
    console.log(`✅ Applied ${rewardOps.length} event rewards via MongoDB bulk operation`);
    return true;
  } catch (error) {
    console.error('Error applying event rewards:', error);
    await updateEvent(eventId, { status: 'error', errorMessage: error.message });
    return false;
  }
}

async function upsertEventSchedule(config) {
  try {
    const configCollection = await getCollection('config');
    await configCollection.updateOne(
      { _id: 'event_schedule' },
      { 
        $set: {
          timezone: config.timezone || 'Asia/Kolkata',
          startTime: config.startTime || '05:30',
          enabled: config.enabled !== undefined ? config.enabled : true,
          lastRun: config.lastRun || null,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error upserting event schedule:', error);
    return false;
  }
}

async function getEventSchedule() {
  try {
    const configCollection = await getCollection('config');
    const schedule = await configCollection.findOne({ _id: 'event_schedule' });
    
    if (!schedule) {
      const defaultSchedule = {
        timezone: 'Asia/Kolkata',
        startTime: '05:30',
        enabled: true,
        lastRun: null
      };
      await upsertEventSchedule(defaultSchedule);
      return defaultSchedule;
    }
    
    return schedule;
  } catch (error) {
    console.error('Error getting event schedule:', error);
    return {
      timezone: 'Asia/Kolkata',
      startTime: '05:30',
      enabled: true,
      lastRun: null
    };
  }
}

async function setEventStatus(eventId, status, extra = {}) {
  try {
    const eventsCollection = await getCollection('events');
    await eventsCollection.updateOne(
      { _id: eventId },
      { $set: { status, ...extra, updatedAt: new Date() } }
    );
    return true;
  } catch (error) {
    console.error('Error setting event status:', error);
    return false;
  }
}

async function clearEventParticipants(eventId) {
  try {
    const participantsCollection = await getCollection('event_participants');
    const result = await participantsCollection.deleteMany({ eventId });
    console.log(`🗑️ Cleared ${result.deletedCount} participants for event ${eventId}`);
    return true;
  } catch (error) {
    console.error('Error clearing event participants:', error);
    return false;
  }
}

async function saveGiveawayData(giveawayData) {
  try {
    const configCollection = await getCollection('config');
    await configCollection.updateOne(
      { _id: 'giveaway_data' },
      { $set: { data: giveawayData, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error saving giveaway data to MongoDB:', error);
    return false;
  }
}

async function loadGiveawayData() {
  try {
    const configCollection = await getCollection('config');
    const result = await configCollection.findOne({ _id: 'giveaway_data' });
    return result ? result.data : null;
  } catch (error) {
    console.error('Error loading giveaway data from MongoDB:', error);
    return null;
  }
}

async function saveLotteryData(lotteryData) {
  try {
    const configCollection = await getCollection('config');
    await configCollection.updateOne(
      { _id: 'lottery_data' },
      { $set: { data: lotteryData, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('Error saving lottery data to MongoDB:', error);
    return false;
  }
}

async function loadLotteryData() {
  try {
    const configCollection = await getCollection('config');
    const result = await configCollection.findOne({ _id: 'lottery_data' });
    return result ? result.data : null;
  } catch (error) {
    console.error('Error loading lottery data from MongoDB:', error);
    return null;
  }
}

module.exports = {
  connect,
  disconnect,
  loadData,
  saveData,
  deleteUser,
  getUserData,
  clearAllData,
  getCollection,
  getDb,
  ensureConnected,
  getCurrentEvent,
  createEvent,
  updateEvent,
  recordEventProgress,
  getEventParticipants,
  getEventParticipant,
  incrementUserResources,
  applyEventRewards,
  upsertEventSchedule,
  getEventSchedule,
  setEventStatus,
  clearEventParticipants,
  saveGiveawayData,
  loadGiveawayData,
  saveLotteryData,
  loadLotteryData
};
