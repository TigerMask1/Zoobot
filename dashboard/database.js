const { getMongoDatabase, isMongoConnected, getCollection } = require('../mongoManager.js');
const { ObjectId } = require('mongodb');
const { 
  COLLECTIONS, 
  DEFAULT_FEATURES, 
  DEFAULT_PING_SETTINGS,
  MINIMUM_CHARACTERS_REQUIRED 
} = require('./schemas.js');
const { loadData, saveDataImmediate } = require('../dataManager.js');
const { sendMailToAll, addMailToUser } = require('../mailSystem.js');
const CHARACTERS = require('../characters.js');

async function backfillGlobalCharacters() {
  if (!isMongoConnected()) {
    console.log('[Dashboard] MongoDB not connected, skipping character backfill');
    return { added: 0, updated: 0 };
  }
  
  const db = getMongoDatabase();
  let addedCount = 0;
  let updatedCount = 0;
  
  try {
    console.log(`[Dashboard] Syncing ${CHARACTERS.length} characters from characters.js...`);
    
    for (const char of CHARACTERS) {
      const existingChar = await db.collection(COLLECTIONS.GLOBAL_CHARACTERS)
        .findOne({ name: char.name });
      
      if (!existingChar) {
        await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).insertOne({
          name: char.name,
          emoji: char.emoji,
          customEmojiId: char.customEmojiId || null,
          obtainable: char.obtainable,
          rarity: 'common',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        addedCount++;
      } else {
        await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).updateOne(
          { name: char.name },
          { 
            $set: { 
              emoji: char.emoji,
              customEmojiId: char.customEmojiId || existingChar.customEmojiId,
              obtainable: char.obtainable,
              updatedAt: new Date()
            }
          }
        );
        updatedCount++;
      }
    }
    
    console.log(`[Dashboard] Character sync complete: ${addedCount} added, ${updatedCount} updated`);
    return { added: addedCount, updated: updatedCount };
  } catch (error) {
    console.error('[Dashboard] Error syncing characters:', error);
    return { added: addedCount, updated: updatedCount, error: error.message };
  }
}

async function backfillGlobalCollectibles() {
  if (!isMongoConnected()) {
    console.log('[Dashboard] MongoDB not connected, skipping collectible backfill');
    return { added: 0, updated: 0 };
  }
  
  const db = getMongoDatabase();
  let addedCount = 0;
  let updatedCount = 0;
  
  try {
    const collectibleItemsCollection = db.collection('collectibleItems');
    const existingCollectibles = await collectibleItemsCollection.find({ status: 'active' }).toArray();
    
    console.log(`[Dashboard] Syncing ${existingCollectibles.length} collectibles from collectibleItems...`);
    
    for (const item of existingCollectibles) {
      const existingInGlobal = await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES)
        .findOne({ name: item.name });
      
      if (!existingInGlobal) {
        await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).insertOne({
          name: item.name,
          description: item.description || '',
          emoji: item.emoji || '🎁',
          imageUrl: item.imageUrl || null,
          rarity: item.rarity || 'common',
          bundle: item.bundle || 'default',
          isGlobal: item.isGlobal || true,
          droppable: item.droppable || { enabled: false },
          crateObtainable: item.crateObtainable || { enabled: false },
          tradable: item.tradable !== false,
          giftable: item.giftable !== false,
          sellable: item.sellable !== false,
          baseValue: item.baseValue || 100,
          stackable: item.stackable !== false,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        addedCount++;
      } else {
        await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).updateOne(
          { name: item.name },
          {
            $set: {
              description: item.description || existingInGlobal.description,
              emoji: item.emoji || existingInGlobal.emoji,
              imageUrl: item.imageUrl || existingInGlobal.imageUrl,
              rarity: item.rarity || existingInGlobal.rarity,
              bundle: item.bundle || existingInGlobal.bundle,
              updatedAt: new Date()
            }
          }
        );
        updatedCount++;
      }
    }
    
    console.log(`[Dashboard] Collectible sync complete: ${addedCount} added, ${updatedCount} updated`);
    return { added: addedCount, updated: updatedCount };
  } catch (error) {
    console.error('[Dashboard] Error syncing collectibles:', error);
    return { added: addedCount, updated: updatedCount, error: error.message };
  }
}

async function sendSubmissionNotification(userId, type, itemName, status, reason = null) {
  try {
    const data = await loadData();
    if (!data || !data.users) {
      console.error('[Dashboard Mail] Failed to load user data');
      return;
    }
    
    if (!data.users[userId]) {
      data.users[userId] = {
        coins: 0,
        gems: 0,
        shards: 0,
        trophies: 200,
        ust: 0,
        messageCount: 0,
        pendingTokens: 0,
        stBoosters: 0,
        lastDailyClaim: null,
        dailyStreak: 0,
        highestDailyStreak: 0,
        totalDailyClaims: 0,
        mailbox: [],
        characters: [],
        questProgress: {
          dropsCaught: 0,
          battlesWon: 0,
          cratesOpened: 0,
          tradesCompleted: 0,
          boostsUsed: 0,
          currentWinStreak: 0,
          maxWinStreak: 0,
          charsReleased: 0,
          tyrantCratesOpened: 0,
          totalBattles: 0,
          charsFromCrates: 0,
          highLevelWin: 0
        },
        completedQuests: [],
        bronzeCrates: 0,
        silverCrates: 0,
        goldCrates: 0,
        emeraldCrates: 0,
        legendaryCrates: 0,
        tyrantCrates: 0,
        tutorialStage: 'intro',
        tutorialCompleted: false,
        profileDisplayCharacter: null,
        seasonPass: {}
      };
    }
    
    if (!data.users[userId].mailbox) {
      data.users[userId].mailbox = [];
    }
    
    let message, rewards = {};
    
    if (status === 'approved') {
      message = `Your ${type} submission "${itemName}" has been approved and is now available in the game! Thank you for your contribution.`;
      rewards = { gems: 10 };
    } else {
      message = `Your ${type} submission "${itemName}" was not approved.${reason ? ` Reason: ${reason}` : ''} Feel free to submit again with improvements!`;
    }
    
    const mail = sendMailToAll(message, rewards, 'ZooBot Team');
    addMailToUser(data.users[userId], mail);
    
    await saveDataImmediate(data);
    console.log(`[Dashboard Mail] Sent ${status} notification to user ${userId} for ${type}: ${itemName}`);
  } catch (error) {
    console.error('[Dashboard Mail] Error sending notification:', error);
  }
}

async function initDashboardIndexes() {
  if (!isMongoConnected()) return;
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).createIndex({ name: 1 }, { unique: true });
    await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).createIndex({ status: 1 });
    await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).createIndex({ rarity: 1 });
    await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).createIndex({ obtainable: 1 });
    
    await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).createIndex({ name: 1 });
    await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).createIndex({ status: 1 });
    await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).createIndex({ rarity: 1 });
    
    await db.collection(COLLECTIONS.SERVER_CONFIGS).createIndex({ serverId: 1 }, { unique: true });
    await db.collection(COLLECTIONS.SERVER_CONFIGS).createIndex({ ownerId: 1 });
    await db.collection(COLLECTIONS.SERVER_CONFIGS).createIndex({ setupComplete: 1 });
    
    await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).createIndex({ status: 1 });
    await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).createIndex({ submittedBy: 1 });
    await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).createIndex({ createdAt: -1 });
    
    await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).createIndex({ status: 1 });
    await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).createIndex({ submittedBy: 1 });
    await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).createIndex({ createdAt: -1 });
    
    console.log('[Dashboard] MongoDB indexes created successfully');
    
    await backfillGlobalCharacters();
    await backfillGlobalCollectibles();
  } catch (error) {
    console.error('[Dashboard] Error creating indexes:', error);
  }
}

async function getAllGlobalCharacters(filters = {}) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  const query = { status: { $ne: 'deleted' } };
  
  if (filters.rarity) query.rarity = filters.rarity;
  if (filters.obtainable) query.obtainable = filters.obtainable;
  if (filters.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }
  
  try {
    return await db.collection(COLLECTIONS.GLOBAL_CHARACTERS)
      .find(query)
      .sort({ name: 1 })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting global characters:', error);
    return [];
  }
}

function isValidObjectId(id) {
  if (!id) return false;
  if (typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
}

async function getGlobalCharacterById(characterId) {
  if (!isMongoConnected()) return null;
  
  if (!isValidObjectId(characterId)) {
    console.log('[Dashboard] Invalid ObjectId format:', characterId);
    return null;
  }
  
  const db = getMongoDatabase();
  
  try {
    return await db.collection(COLLECTIONS.GLOBAL_CHARACTERS)
      .findOne({ _id: new ObjectId(characterId) });
  } catch (error) {
    console.error('[Dashboard] Error getting character:', error);
    return null;
  }
}

async function createGlobalCharacter(characterData) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  const character = {
    ...characterData,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).insertOne(character);
    return { success: true, characterId: result.insertedId };
  } catch (error) {
    if (error.code === 11000) {
      return { success: false, message: 'Character with this name already exists' };
    }
    console.error('[Dashboard] Error creating character:', error);
    return { success: false, message: 'Failed to create character' };
  }
}

async function updateGlobalCharacter(characterId, updates) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(characterId)) {
    return { success: false, message: 'Invalid character ID format' };
  }
  
  const db = getMongoDatabase();
  updates.updatedAt = new Date();
  
  try {
    await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).updateOne(
      { _id: new ObjectId(characterId) },
      { $set: updates }
    );
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error updating character:', error);
    return { success: false, message: 'Failed to update character' };
  }
}

async function deleteGlobalCharacter(characterId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(characterId)) {
    return { success: false, message: 'Invalid character ID format' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.GLOBAL_CHARACTERS).updateOne(
      { _id: new ObjectId(characterId) },
      { $set: { status: 'deleted', updatedAt: new Date() } }
    );
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error deleting character:', error);
    return { success: false, message: 'Failed to delete character' };
  }
}

async function getAllGlobalCollectibles(filters = {}) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  const query = { status: { $ne: 'deleted' } };
  
  if (filters.rarity) query.rarity = filters.rarity;
  if (filters.search) {
    query.name = { $regex: filters.search, $options: 'i' };
  }
  
  try {
    return await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES)
      .find(query)
      .sort({ name: 1 })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting global collectibles:', error);
    return [];
  }
}

async function getGlobalCollectibleById(collectibleId) {
  if (!isMongoConnected()) return null;
  
  if (!isValidObjectId(collectibleId)) {
    console.log('[Dashboard] Invalid ObjectId format for collectible:', collectibleId);
    return null;
  }
  
  const db = getMongoDatabase();
  
  try {
    return await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES)
      .findOne({ _id: new ObjectId(collectibleId) });
  } catch (error) {
    console.error('[Dashboard] Error getting collectible:', error);
    return null;
  }
}

async function createGlobalCollectible(collectibleData) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  const collectible = {
    ...collectibleData,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).insertOne(collectible);
    return { success: true, collectibleId: result.insertedId };
  } catch (error) {
    console.error('[Dashboard] Error creating collectible:', error);
    return { success: false, message: 'Failed to create collectible' };
  }
}

async function updateGlobalCollectible(collectibleId, updates) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(collectibleId)) {
    return { success: false, message: 'Invalid collectible ID format' };
  }
  
  const db = getMongoDatabase();
  updates.updatedAt = new Date();
  
  try {
    await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).updateOne(
      { _id: new ObjectId(collectibleId) },
      { $set: updates }
    );
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error updating collectible:', error);
    return { success: false, message: 'Failed to update collectible' };
  }
}

async function deleteGlobalCollectible(collectibleId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(collectibleId)) {
    return { success: false, message: 'Invalid collectible ID format' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).updateOne(
      { _id: new ObjectId(collectibleId) },
      { $set: { status: 'deleted', updatedAt: new Date() } }
    );
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error deleting collectible:', error);
    return { success: false, message: 'Failed to delete collectible' };
  }
}

async function getServerConfig(serverId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    return await db.collection(COLLECTIONS.SERVER_CONFIGS).findOne({ serverId });
  } catch (error) {
    console.error('[Dashboard] Error getting server config:', error);
    return null;
  }
}

async function getServersByOwner(ownerId) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    return await db.collection(COLLECTIONS.SERVER_CONFIGS)
      .find({ ownerId })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting servers by owner:', error);
    return [];
  }
}

async function createOrUpdateServerConfig(serverId, configData) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const existing = await db.collection(COLLECTIONS.SERVER_CONFIGS).findOne({ serverId });
    
    if (existing) {
      configData.updatedAt = new Date();
      await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
        { serverId },
        { $set: configData }
      );
    } else {
      const newConfig = {
        serverId,
        selectedCharacterIds: [],
        selectedCollectibleIds: [],
        channels: {},
        features: { ...DEFAULT_FEATURES },
        pingSettings: { ...DEFAULT_PING_SETTINGS },
        moderationSettings: {
          maxWarningsBeforeBan: 5,
          autoModEnabled: false,
          profanityFilter: false
        },
        commandSettings: {
          prefix: '!',
          disabledCommands: [],
          commandCooldowns: {}
        },
        serverAdmins: [],
        zooAdminRoleName: 'zooadmin',
        setupComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...configData
      };
      
      await db.collection(COLLECTIONS.SERVER_CONFIGS).insertOne(newConfig);
    }
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error saving server config:', error);
    return { success: false, message: 'Failed to save server config' };
  }
}

async function addCharacterToServer(serverId, characterId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const result = await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $addToSet: { selectedCharacterIds: characterId },
        $set: { updatedAt: new Date() }
      }
    );
    
    await checkAndUpdateSetupStatus(serverId);
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error adding character to server:', error);
    return { success: false, message: 'Failed to add character' };
  }
}

async function removeCharacterFromServer(serverId, characterId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $pull: { selectedCharacterIds: characterId },
        $set: { updatedAt: new Date() }
      }
    );
    
    await checkAndUpdateSetupStatus(serverId);
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error removing character from server:', error);
    return { success: false, message: 'Failed to remove character' };
  }
}

async function addCollectibleToServer(serverId, collectibleId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $addToSet: { selectedCollectibleIds: collectibleId },
        $set: { updatedAt: new Date() }
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error adding collectible to server:', error);
    return { success: false, message: 'Failed to add collectible' };
  }
}

async function removeCollectibleFromServer(serverId, collectibleId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $pull: { selectedCollectibleIds: collectibleId },
        $set: { updatedAt: new Date() }
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error removing collectible from server:', error);
    return { success: false, message: 'Failed to remove collectible' };
  }
}

async function checkAndUpdateSetupStatus(serverId) {
  if (!isMongoConnected()) return;
  
  const db = getMongoDatabase();
  
  try {
    const config = await db.collection(COLLECTIONS.SERVER_CONFIGS).findOne({ serverId });
    if (!config) return;
    
    const characterCount = config.selectedCharacterIds?.length || 0;
    const wasSetup = config.setupComplete;
    const isNowSetup = characterCount >= MINIMUM_CHARACTERS_REQUIRED;
    
    if (wasSetup !== isNowSetup) {
      await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
        { serverId },
        { 
          $set: { 
            setupComplete: isNowSetup,
            setupCompletedAt: isNowSetup ? new Date() : null,
            updatedAt: new Date()
          }
        }
      );
    }
  } catch (error) {
    console.error('[Dashboard] Error checking setup status:', error);
  }
}

async function isServerSetupComplete(serverId) {
  const config = await getServerConfig(serverId);
  if (!config) return false;
  
  const characterCount = config.selectedCharacterIds?.length || 0;
  return characterCount >= MINIMUM_CHARACTERS_REQUIRED;
}

async function getServerCharacters(serverId) {
  if (!isMongoConnected()) return [];
  
  const config = await getServerConfig(serverId);
  if (!config || !config.selectedCharacterIds?.length) return [];
  
  const db = getMongoDatabase();
  
  try {
    const characterIds = config.selectedCharacterIds.map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return id;
      }
    });
    
    return await db.collection(COLLECTIONS.GLOBAL_CHARACTERS)
      .find({ 
        _id: { $in: characterIds },
        status: 'active'
      })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting server characters:', error);
    return [];
  }
}

async function getServerCollectibles(serverId) {
  if (!isMongoConnected()) return [];
  
  const config = await getServerConfig(serverId);
  if (!config || !config.selectedCollectibleIds?.length) return [];
  
  const db = getMongoDatabase();
  
  try {
    const collectibleIds = config.selectedCollectibleIds.map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return id;
      }
    });
    
    return await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES)
      .find({ 
        _id: { $in: collectibleIds },
        status: 'active'
      })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting server collectibles:', error);
    return [];
  }
}

async function createCharacterSubmission(submissionData) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  const submission = {
    ...submissionData,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).insertOne(submission);
    return { success: true, submissionId: result.insertedId };
  } catch (error) {
    console.error('[Dashboard] Error creating character submission:', error);
    return { success: false, message: 'Failed to create submission' };
  }
}

async function getCharacterSubmissions(filters = {}) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  const query = {};
  
  if (filters.status) query.status = filters.status;
  if (filters.submittedBy) query.submittedBy = filters.submittedBy;
  
  try {
    return await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting character submissions:', error);
    return [];
  }
}

async function approveCharacterSubmission(submissionId, approvedBy) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(submissionId)) {
    return { success: false, message: 'Invalid submission ID format' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const submission = await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS)
      .findOne({ _id: new ObjectId(submissionId) });
    
    if (!submission) {
      return { success: false, message: 'Submission not found' };
    }
    
    const characterResult = await createGlobalCharacter({
      name: submission.name,
      emoji: submission.emoji,
      customEmojiId: submission.customEmojiId,
      description: submission.description,
      imageUrl: submission.imageUrl,
      rarity: submission.rarity || 'common',
      obtainable: 'submission',
      ability: submission.ability,
      specialMove: submission.specialMove,
      createdBy: submission.submittedBy,
      approvedBy: approvedBy,
      approvedAt: new Date()
    });
    
    if (!characterResult.success) {
      return characterResult;
    }
    
    await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).updateOne(
      { _id: new ObjectId(submissionId) },
      { 
        $set: { 
          status: 'approved',
          approvedBy,
          approvedAt: new Date(),
          characterId: characterResult.characterId,
          updatedAt: new Date()
        }
      }
    );
    
    await sendSubmissionNotification(submission.submittedBy, 'character', submission.name, 'approved');
    
    return { success: true, characterId: characterResult.characterId };
  } catch (error) {
    console.error('[Dashboard] Error approving submission:', error);
    return { success: false, message: 'Failed to approve submission' };
  }
}

async function rejectCharacterSubmission(submissionId, rejectedBy, reason) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(submissionId)) {
    return { success: false, message: 'Invalid submission ID format' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const submission = await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS)
      .findOne({ _id: new ObjectId(submissionId) });
    
    if (!submission) {
      return { success: false, message: 'Submission not found' };
    }
    
    await db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).updateOne(
      { _id: new ObjectId(submissionId) },
      { 
        $set: { 
          status: 'rejected',
          rejectedBy,
          rejectedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date()
        }
      }
    );
    
    await sendSubmissionNotification(submission.submittedBy, 'character', submission.name, 'rejected', reason);
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error rejecting submission:', error);
    return { success: false, message: 'Failed to reject submission' };
  }
}

async function createCollectibleSubmission(submissionData) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  const submission = {
    ...submissionData,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).insertOne(submission);
    return { success: true, submissionId: result.insertedId };
  } catch (error) {
    console.error('[Dashboard] Error creating collectible submission:', error);
    return { success: false, message: 'Failed to create submission' };
  }
}

async function getCollectibleSubmissions(filters = {}) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  const query = {};
  
  if (filters.status) query.status = filters.status;
  if (filters.submittedBy) query.submittedBy = filters.submittedBy;
  
  try {
    return await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting collectible submissions:', error);
    return [];
  }
}

async function approveCollectibleSubmission(submissionId, approvedBy) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(submissionId)) {
    return { success: false, message: 'Invalid submission ID format' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const submission = await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS)
      .findOne({ _id: new ObjectId(submissionId) });
    
    if (!submission) {
      return { success: false, message: 'Submission not found' };
    }
    
    const collectibleResult = await createGlobalCollectible({
      name: submission.name,
      description: submission.description,
      emoji: submission.emoji,
      imageUrl: submission.imageUrl,
      rarity: submission.rarity || 'common',
      isGlobal: true,
      droppable: submission.droppable || { enabled: false },
      crateObtainable: submission.crateObtainable || { enabled: false },
      tradable: submission.tradable !== false,
      giftable: submission.giftable !== false,
      sellable: submission.sellable !== false,
      baseValue: submission.baseValue || 100,
      stackable: submission.stackable !== false,
      createdBy: submission.submittedBy,
      approvedBy: approvedBy,
      approvedAt: new Date()
    });
    
    if (!collectibleResult.success) {
      return collectibleResult;
    }
    
    await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).updateOne(
      { _id: new ObjectId(submissionId) },
      { 
        $set: { 
          status: 'approved',
          approvedBy,
          approvedAt: new Date(),
          collectibleId: collectibleResult.collectibleId,
          updatedAt: new Date()
        }
      }
    );
    
    await sendSubmissionNotification(submission.submittedBy, 'collectible', submission.name, 'approved');
    
    return { success: true, collectibleId: collectibleResult.collectibleId };
  } catch (error) {
    console.error('[Dashboard] Error approving collectible submission:', error);
    return { success: false, message: 'Failed to approve submission' };
  }
}

async function rejectCollectibleSubmission(submissionId, rejectedBy, reason) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  if (!isValidObjectId(submissionId)) {
    return { success: false, message: 'Invalid submission ID format' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const submission = await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS)
      .findOne({ _id: new ObjectId(submissionId) });
    
    if (!submission) {
      return { success: false, message: 'Submission not found' };
    }
    
    await db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).updateOne(
      { _id: new ObjectId(submissionId) },
      { 
        $set: { 
          status: 'rejected',
          rejectedBy,
          rejectedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date()
        }
      }
    );
    
    await sendSubmissionNotification(submission.submittedBy, 'collectible', submission.name, 'rejected', reason);
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error rejecting collectible submission:', error);
    return { success: false, message: 'Failed to reject submission' };
  }
}

async function updateServerFeatures(serverId, features) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          features,
          updatedAt: new Date()
        }
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error updating server features:', error);
    return { success: false, message: 'Failed to update features' };
  }
}

async function updateServerChannels(serverId, channels) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          channels,
          updatedAt: new Date()
        }
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error updating server channels:', error);
    return { success: false, message: 'Failed to update channels' };
  }
}

async function updateServerPingSettings(serverId, pingSettings) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          pingSettings,
          updatedAt: new Date()
        }
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error updating ping settings:', error);
    return { success: false, message: 'Failed to update ping settings' };
  }
}

async function getDashboardStats() {
  if (!isMongoConnected()) {
    return {
      totalCharacters: 0,
      totalCollectibles: 0,
      totalServers: 0,
      setupCompleteServers: 0,
      pendingCharacterSubmissions: 0,
      pendingCollectibleSubmissions: 0
    };
  }
  
  const db = getMongoDatabase();
  
  try {
    const [
      totalCharacters,
      totalCollectibles,
      totalServers,
      setupCompleteServers,
      pendingCharacterSubmissions,
      pendingCollectibleSubmissions
    ] = await Promise.all([
      db.collection(COLLECTIONS.GLOBAL_CHARACTERS).countDocuments({ status: 'active' }),
      db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES).countDocuments({ status: 'active' }),
      db.collection(COLLECTIONS.SERVER_CONFIGS).countDocuments(),
      db.collection(COLLECTIONS.SERVER_CONFIGS).countDocuments({ setupComplete: true }),
      db.collection(COLLECTIONS.CHARACTER_SUBMISSIONS).countDocuments({ status: 'pending' }),
      db.collection(COLLECTIONS.COLLECTIBLE_SUBMISSIONS).countDocuments({ status: 'pending' })
    ]);
    
    return {
      totalCharacters,
      totalCollectibles,
      totalServers,
      setupCompleteServers,
      pendingCharacterSubmissions,
      pendingCollectibleSubmissions
    };
  } catch (error) {
    console.error('[Dashboard] Error getting stats:', error);
    return {
      totalCharacters: 0,
      totalCollectibles: 0,
      totalServers: 0,
      setupCompleteServers: 0,
      pendingCharacterSubmissions: 0,
      pendingCollectibleSubmissions: 0
    };
  }
}

async function backfillServersFromBot(discordClient) {
  if (!isMongoConnected()) {
    console.log('[Dashboard] MongoDB not connected, skipping server backfill');
    return { success: false, message: 'MongoDB not connected' };
  }
  
  if (!discordClient) {
    console.log('[Dashboard] Discord client not available, skipping server backfill');
    return { success: false, message: 'Discord client not available' };
  }
  
  const db = getMongoDatabase();
  let backfilledCount = 0;
  let updatedCount = 0;
  let charactersAssigned = 0;
  
  try {
    const allCharacters = await db.collection(COLLECTIONS.GLOBAL_CHARACTERS)
      .find({ status: 'active' })
      .toArray();
    const allCharacterIds = allCharacters.map(c => c._id.toString());
    
    const allCollectibles = await db.collection(COLLECTIONS.GLOBAL_COLLECTIBLES)
      .find({ status: 'active' })
      .toArray();
    const allCollectibleIds = allCollectibles.map(c => c._id.toString());
    
    const guilds = discordClient.guilds.cache;
    console.log(`[Dashboard] Backfilling ${guilds.size} servers with ${allCharacterIds.length} characters and ${allCollectibleIds.length} collectibles...`);
    
    for (const [guildId, guild] of guilds) {
      const existingConfig = await db.collection(COLLECTIONS.SERVER_CONFIGS).findOne({ serverId: guildId });
      
      if (!existingConfig) {
        const newConfig = {
          serverId: guildId,
          serverName: guild.name,
          serverIcon: guild.iconURL(),
          ownerId: guild.ownerId,
          selectedCharacterIds: allCharacterIds,
          selectedCollectibleIds: allCollectibleIds,
          channels: {},
          features: { ...DEFAULT_FEATURES },
          pingSettings: { ...DEFAULT_PING_SETTINGS },
          moderationSettings: {
            maxWarningsBeforeBan: 5,
            autoModEnabled: false,
            profanityFilter: false
          },
          commandSettings: {
            prefix: '!',
            disabledCommands: [],
            commandCooldowns: {}
          },
          serverAdmins: [],
          zooAdminRoleName: 'zooadmin',
          setupComplete: allCharacterIds.length >= MINIMUM_CHARACTERS_REQUIRED,
          botInstalledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection(COLLECTIONS.SERVER_CONFIGS).insertOne(newConfig);
        backfilledCount++;
        charactersAssigned += allCharacterIds.length;
      } else {
        const updateData = {
          serverName: guild.name,
          serverIcon: guild.iconURL(),
          ownerId: guild.ownerId,
          updatedAt: new Date()
        };
        
        if (!existingConfig.selectedCharacterIds || existingConfig.selectedCharacterIds.length === 0) {
          updateData.selectedCharacterIds = allCharacterIds;
          updateData.setupComplete = allCharacterIds.length >= MINIMUM_CHARACTERS_REQUIRED;
          charactersAssigned += allCharacterIds.length;
        }
        
        if (!existingConfig.selectedCollectibleIds || existingConfig.selectedCollectibleIds.length === 0) {
          updateData.selectedCollectibleIds = allCollectibleIds;
        }
        
        await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
          { serverId: guildId },
          { $set: updateData }
        );
        updatedCount++;
      }
    }
    
    console.log(`[Dashboard] Server backfill complete: ${backfilledCount} new, ${updatedCount} updated, ${charactersAssigned} characters assigned`);
    return { 
      success: true, 
      backfilled: backfilledCount, 
      updated: updatedCount,
      charactersAssigned,
      message: `Synced ${backfilledCount + updatedCount} servers with ZooBot characters`
    };
  } catch (error) {
    console.error('[Dashboard] Error backfilling servers:', error);
    return { success: false, message: 'Failed to backfill servers' };
  }
}

async function getAllServerConfigs() {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    return await db.collection(COLLECTIONS.SERVER_CONFIGS)
      .find({})
      .sort({ serverName: 1 })
      .toArray();
  } catch (error) {
    console.error('[Dashboard] Error getting all server configs:', error);
    return [];
  }
}

async function setServerCharacters(serverId, characterIds) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          selectedCharacterIds: characterIds || [],
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    await checkAndUpdateSetupStatus(serverId);
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error setting server characters:', error);
    return { success: false, message: 'Failed to set characters' };
  }
}

async function setServerCollectibles(serverId, collectibleIds) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          selectedCollectibleIds: collectibleIds || [],
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error setting server collectibles:', error);
    return { success: false, message: 'Failed to set collectibles' };
  }
}

async function completeServerSetup(serverId) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const config = await db.collection(COLLECTIONS.SERVER_CONFIGS).findOne({ serverId });
    
    if (!config) {
      return { success: false, message: 'Server config not found' };
    }
    
    const characterCount = config.selectedCharacterIds?.length || 0;
    if (characterCount < MINIMUM_CHARACTERS_REQUIRED) {
      return { 
        success: false, 
        message: `Need at least ${MINIMUM_CHARACTERS_REQUIRED} characters to complete setup` 
      };
    }
    
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          setupComplete: true,
          setupCompletedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('[Dashboard] Error completing server setup:', error);
    return { success: false, message: 'Failed to complete setup' };
  }
}

module.exports = {
  initDashboardIndexes,
  backfillGlobalCharacters,
  backfillGlobalCollectibles,
  backfillServersFromBot,
  getAllServerConfigs,
  isValidObjectId,
  
  getAllGlobalCharacters,
  getGlobalCharacterById,
  createGlobalCharacter,
  updateGlobalCharacter,
  deleteGlobalCharacter,
  
  getAllGlobalCollectibles,
  getGlobalCollectibleById,
  createGlobalCollectible,
  updateGlobalCollectible,
  deleteGlobalCollectible,
  
  getServerConfig,
  getServersByOwner,
  createOrUpdateServerConfig,
  addCharacterToServer,
  removeCharacterFromServer,
  addCollectibleToServer,
  removeCollectibleFromServer,
  setServerCharacters,
  setServerCollectibles,
  completeServerSetup,
  isServerSetupComplete,
  getServerCharacters,
  getServerCollectibles,
  updateServerFeatures,
  updateServerChannels,
  updateServerPingSettings,
  
  createCharacterSubmission,
  getCharacterSubmissions,
  approveCharacterSubmission,
  rejectCharacterSubmission,
  
  createCollectibleSubmission,
  getCollectibleSubmissions,
  approveCollectibleSubmission,
  rejectCollectibleSubmission,
  
  getDashboardStats,
  checkAndUpdateSetupStatus,
  
  MINIMUM_CHARACTERS_REQUIRED
};
