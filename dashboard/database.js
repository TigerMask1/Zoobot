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
  } catch (error) {
    console.error('[Dashboard] Error creating indexes:', error);
  }
}

async function getAllGlobalCharacters(filters = {}) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    const charDoc = await db.collection('characters').findOne({ _id: 'character_data' });
    
    if (!charDoc || !charDoc.characters) {
      console.log('[Dashboard] No characters found in MongoDB characters collection');
      return [];
    }
    
    let characters = charDoc.characters.map((char, index) => ({
      _id: char.name,
      id: char.name,
      name: char.name,
      emoji: char.emoji,
      customEmojiId: char.customEmojiId || null,
      obtainable: char.obtainable,
      game: char.game || 'ZooBot',
      createdBy: char.createdBy || 'ZooBot',
      createdAt: char.createdAt ? new Date(char.createdAt) : new Date(),
      rarity: char.rarity || 'common',
      status: 'active',
      ability: charDoc.abilities ? charDoc.abilities[char.name] : null,
      specialMove: charDoc.specialMoves ? charDoc.specialMoves[char.name] : null
    }));
    
    if (filters.rarity) {
      characters = characters.filter(c => c.rarity === filters.rarity);
    }
    if (filters.obtainable) {
      characters = characters.filter(c => c.obtainable === filters.obtainable);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      characters = characters.filter(c => c.name.toLowerCase().includes(searchLower));
    }
    if (filters.game) {
      characters = characters.filter(c => c.game === filters.game);
    }
    
    return characters.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[Dashboard] Error getting characters from bot collection:', error);
    return [];
  }
}

function isValidObjectId(id) {
  if (!id) return false;
  if (typeof id !== 'string') return false;
  return true;
}

async function getGlobalCharacterById(characterId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    const charDoc = await db.collection('characters').findOne({ _id: 'character_data' });
    
    if (!charDoc || !charDoc.characters) {
      return null;
    }
    
    const char = charDoc.characters.find(c => c.name === characterId || c.name.toLowerCase() === characterId.toLowerCase());
    
    if (!char) return null;
    
    return {
      _id: char.name,
      id: char.name,
      name: char.name,
      emoji: char.emoji,
      customEmojiId: char.customEmojiId || null,
      obtainable: char.obtainable,
      game: char.game || 'ZooBot',
      createdBy: char.createdBy || 'ZooBot',
      createdAt: char.createdAt ? new Date(char.createdAt) : new Date(),
      rarity: char.rarity || 'common',
      status: 'active',
      ability: charDoc.abilities ? charDoc.abilities[char.name] : null,
      specialMove: charDoc.specialMoves ? charDoc.specialMoves[char.name] : null
    };
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
  
  try {
    const charDoc = await db.collection('characters').findOne({ _id: 'character_data' });
    
    if (!charDoc) {
      return { success: false, message: 'Characters collection not initialized' };
    }
    
    const existingChar = charDoc.characters.find(c => c.name.toLowerCase() === characterData.name.toLowerCase());
    if (existingChar) {
      return { success: false, message: 'Character with this name already exists' };
    }
    
    const newChar = {
      name: characterData.name,
      emoji: characterData.emoji,
      customEmojiId: characterData.customEmojiId || null,
      obtainable: characterData.obtainable || 'crate',
      game: characterData.game || 'ZooBot',
      createdBy: characterData.createdBy || 'Dashboard',
      createdAt: new Date().toISOString(),
      rarity: characterData.rarity || 'common'
    };
    
    charDoc.characters.push(newChar);
    
    if (characterData.ability) {
      charDoc.abilities = charDoc.abilities || {};
      charDoc.abilities[characterData.name] = characterData.ability;
    } else {
      charDoc.abilities = charDoc.abilities || {};
      charDoc.abilities[characterData.name] = {
        name: `${characterData.name}'s Power`,
        emoji: '⭐',
        description: `${characterData.name} gains a small damage bonus on all attacks.`,
        type: 'passive',
        effect: { flatDamageBonus: 5 }
      };
    }
    
    if (characterData.specialMove) {
      charDoc.specialMoves = charDoc.specialMoves || {};
      charDoc.specialMoves[characterData.name] = characterData.specialMove;
    } else {
      charDoc.specialMoves = charDoc.specialMoves || {};
      charDoc.specialMoves[characterData.name] = {
        name: `${characterData.name}'s Strike`,
        damage: 90
      };
    }
    
    await db.collection('characters').updateOne(
      { _id: 'character_data' },
      { 
        $set: { 
          characters: charDoc.characters,
          abilities: charDoc.abilities,
          specialMoves: charDoc.specialMoves,
          updatedAt: new Date()
        }
      }
    );
    
    return { success: true, characterId: characterData.name };
  } catch (error) {
    console.error('[Dashboard] Error creating character:', error);
    return { success: false, message: 'Failed to create character' };
  }
}

async function updateGlobalCharacter(characterId, updates) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    const charDoc = await db.collection('characters').findOne({ _id: 'character_data' });
    
    if (!charDoc || !charDoc.characters) {
      return { success: false, message: 'Characters not found' };
    }
    
    const charIndex = charDoc.characters.findIndex(c => c.name === characterId || c.name.toLowerCase() === characterId.toLowerCase());
    
    if (charIndex === -1) {
      return { success: false, message: 'Character not found' };
    }
    
    const oldName = charDoc.characters[charIndex].name;
    
    if (updates.name) charDoc.characters[charIndex].name = updates.name;
    if (updates.emoji) charDoc.characters[charIndex].emoji = updates.emoji;
    if (updates.obtainable) charDoc.characters[charIndex].obtainable = updates.obtainable;
    if (updates.customEmojiId !== undefined) charDoc.characters[charIndex].customEmojiId = updates.customEmojiId;
    if (updates.game) charDoc.characters[charIndex].game = updates.game;
    if (updates.rarity) charDoc.characters[charIndex].rarity = updates.rarity;
    
    charDoc.characters[charIndex].updatedAt = new Date().toISOString();
    
    if (updates.name && updates.name !== oldName) {
      if (charDoc.abilities && charDoc.abilities[oldName]) {
        charDoc.abilities[updates.name] = charDoc.abilities[oldName];
        delete charDoc.abilities[oldName];
      }
      if (charDoc.specialMoves && charDoc.specialMoves[oldName]) {
        charDoc.specialMoves[updates.name] = charDoc.specialMoves[oldName];
        delete charDoc.specialMoves[oldName];
      }
    }
    
    if (updates.ability) {
      charDoc.abilities = charDoc.abilities || {};
      charDoc.abilities[charDoc.characters[charIndex].name] = updates.ability;
    }
    
    if (updates.specialMove) {
      charDoc.specialMoves = charDoc.specialMoves || {};
      charDoc.specialMoves[charDoc.characters[charIndex].name] = updates.specialMove;
    }
    
    await db.collection('characters').updateOne(
      { _id: 'character_data' },
      { 
        $set: { 
          characters: charDoc.characters,
          abilities: charDoc.abilities,
          specialMoves: charDoc.specialMoves,
          updatedAt: new Date()
        }
      }
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
  
  const db = getMongoDatabase();
  
  try {
    const charDoc = await db.collection('characters').findOne({ _id: 'character_data' });
    
    if (!charDoc || !charDoc.characters) {
      return { success: false, message: 'Characters not found' };
    }
    
    const charIndex = charDoc.characters.findIndex(c => c.name === characterId || c.name.toLowerCase() === characterId.toLowerCase());
    
    if (charIndex === -1) {
      return { success: false, message: 'Character not found' };
    }
    
    const charName = charDoc.characters[charIndex].name;
    charDoc.characters.splice(charIndex, 1);
    
    if (charDoc.abilities && charDoc.abilities[charName]) {
      delete charDoc.abilities[charName];
    }
    if (charDoc.specialMoves && charDoc.specialMoves[charName]) {
      delete charDoc.specialMoves[charName];
    }
    
    await db.collection('characters').updateOne(
      { _id: 'character_data' },
      { 
        $set: { 
          characters: charDoc.characters,
          abilities: charDoc.abilities,
          specialMoves: charDoc.specialMoves,
          updatedAt: new Date()
        }
      }
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
  
  try {
    const query = { status: 'active' };
    
    if (filters.rarity) query.rarity = filters.rarity;
    if (filters.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }
    
    const collectibles = await db.collection('collectibleItems')
      .find(query)
      .sort({ name: 1 })
      .toArray();
    
    return collectibles.map(c => ({
      ...c,
      id: c._id.toString()
    }));
  } catch (error) {
    console.error('[Dashboard] Error getting collectibles:', error);
    return [];
  }
}

async function getGlobalCollectibleById(collectibleId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    let collectible = null;
    
    if (/^[a-fA-F0-9]{24}$/.test(collectibleId)) {
      collectible = await db.collection('collectibleItems')
        .findOne({ _id: new ObjectId(collectibleId) });
    }
    
    if (!collectible) {
      collectible = await db.collection('collectibleItems')
        .findOne({ name: collectibleId });
    }
    
    if (!collectible) {
      collectible = await db.collection('collectibleItems')
        .findOne({ name: { $regex: new RegExp(`^${collectibleId}$`, 'i') } });
    }
    
    if (collectible) {
      return {
        ...collectible,
        id: collectible._id.toString()
      };
    }
    
    return null;
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
  
  try {
    const existing = await db.collection('collectibleItems')
      .findOne({ name: collectibleData.name });
    
    if (existing) {
      return { success: false, message: 'Collectible with this name already exists' };
    }
    
    const collectible = {
      name: collectibleData.name,
      description: collectibleData.description || '',
      emoji: collectibleData.emoji || '🎁',
      imageUrl: collectibleData.imageUrl || null,
      rarity: collectibleData.rarity || 'common',
      bundle: collectibleData.bundle || 'default',
      isGlobal: collectibleData.isGlobal !== false,
      droppable: collectibleData.droppable || { enabled: false },
      crateObtainable: collectibleData.crateObtainable || { enabled: false },
      tradable: collectibleData.tradable !== false,
      giftable: collectibleData.giftable !== false,
      sellable: collectibleData.sellable !== false,
      baseValue: collectibleData.baseValue || 100,
      stackable: collectibleData.stackable !== false,
      status: 'active',
      createdBy: collectibleData.createdBy || 'Dashboard',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('collectibleItems').insertOne(collectible);
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
  
  const db = getMongoDatabase();
  updates.updatedAt = new Date();
  
  try {
    let query;
    if (/^[a-fA-F0-9]{24}$/.test(collectibleId)) {
      query = { _id: new ObjectId(collectibleId) };
    } else {
      query = { name: collectibleId };
    }
    
    await db.collection('collectibleItems').updateOne(query, { $set: updates });
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
  
  const db = getMongoDatabase();
  
  try {
    let query;
    if (/^[a-fA-F0-9]{24}$/.test(collectibleId)) {
      query = { _id: new ObjectId(collectibleId) };
    } else {
      query = { name: collectibleId };
    }
    
    await db.collection('collectibleItems').updateOne(
      query,
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
        selectedCharacterNames: [],
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

async function addCharacterToServer(serverId, characterName) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $addToSet: { selectedCharacterNames: characterName },
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

async function removeCharacterFromServer(serverId, characterName) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $pull: { selectedCharacterNames: characterName },
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
    
    const characterCount = config.selectedCharacterNames?.length || 0;
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
  
  const characterCount = config.selectedCharacterNames?.length || 0;
  return characterCount >= MINIMUM_CHARACTERS_REQUIRED;
}

async function getServerCharacters(serverId) {
  if (!isMongoConnected()) return [];
  
  const config = await getServerConfig(serverId);
  if (!config || !config.selectedCharacterNames?.length) {
    return await getAllGlobalCharacters();
  }
  
  const allCharacters = await getAllGlobalCharacters();
  return allCharacters.filter(c => config.selectedCharacterNames.includes(c.name));
}

async function getServerCollectibles(serverId) {
  if (!isMongoConnected()) return [];
  
  const config = await getServerConfig(serverId);
  if (!config || !config.selectedCollectibleIds?.length) {
    return await getAllGlobalCollectibles();
  }
  
  const db = getMongoDatabase();
  
  try {
    const collectibleIds = config.selectedCollectibleIds.map(id => {
      try {
        return new ObjectId(id);
      } catch {
        return id;
      }
    });
    
    const collectibles = await db.collection('collectibleItems')
      .find({ 
        $or: [
          { _id: { $in: collectibleIds.filter(id => id instanceof ObjectId) } },
          { name: { $in: collectibleIds.filter(id => typeof id === 'string') } }
        ],
        status: 'active'
      })
      .toArray();
    
    return collectibles.map(c => ({
      ...c,
      id: c._id.toString()
    }));
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
  
  if (!submissionId || !/^[a-fA-F0-9]{24}$/.test(submissionId)) {
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
  
  if (!submissionId || !/^[a-fA-F0-9]{24}$/.test(submissionId)) {
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
  
  if (!submissionId || !/^[a-fA-F0-9]{24}$/.test(submissionId)) {
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
  
  if (!submissionId || !/^[a-fA-F0-9]{24}$/.test(submissionId)) {
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
    const charDoc = await db.collection('characters').findOne({ _id: 'character_data' });
    const totalCharacters = charDoc?.characters?.length || 0;
    
    const [
      totalCollectibles,
      totalServers,
      setupCompleteServers,
      pendingCharacterSubmissions,
      pendingCollectibleSubmissions
    ] = await Promise.all([
      db.collection('collectibleItems').countDocuments({ status: 'active' }),
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
    const allCharacters = await getAllGlobalCharacters();
    const allCharacterNames = allCharacters.map(c => c.name);
    
    const allCollectibles = await getAllGlobalCollectibles();
    const allCollectibleIds = allCollectibles.map(c => c._id.toString());
    
    const guilds = discordClient.guilds.cache;
    console.log(`[Dashboard] Backfilling ${guilds.size} servers with ${allCharacterNames.length} characters and ${allCollectibleIds.length} collectibles...`);
    
    for (const [guildId, guild] of guilds) {
      const existingConfig = await db.collection(COLLECTIONS.SERVER_CONFIGS).findOne({ serverId: guildId });
      
      if (!existingConfig) {
        const newConfig = {
          serverId: guildId,
          serverName: guild.name,
          serverIcon: guild.iconURL(),
          ownerId: guild.ownerId,
          selectedCharacterNames: allCharacterNames,
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
          setupComplete: allCharacterNames.length >= MINIMUM_CHARACTERS_REQUIRED,
          botInstalledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.collection(COLLECTIONS.SERVER_CONFIGS).insertOne(newConfig);
        backfilledCount++;
        charactersAssigned += allCharacterNames.length;
      } else {
        const updateData = {
          serverName: guild.name,
          serverIcon: guild.iconURL(),
          ownerId: guild.ownerId,
          updatedAt: new Date()
        };
        
        if (!existingConfig.selectedCharacterNames || existingConfig.selectedCharacterNames.length === 0) {
          updateData.selectedCharacterNames = allCharacterNames;
          updateData.setupComplete = allCharacterNames.length >= MINIMUM_CHARACTERS_REQUIRED;
          charactersAssigned += allCharacterNames.length;
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

async function setServerCharacters(serverId, characterNames) {
  if (!isMongoConnected()) {
    return { success: false, message: 'Database not connected' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(COLLECTIONS.SERVER_CONFIGS).updateOne(
      { serverId },
      { 
        $set: { 
          selectedCharacterNames: characterNames || [],
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
    
    const characterCount = config.selectedCharacterNames?.length || 0;
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
  checkAndUpdateSetupStatus,
  
  createCharacterSubmission,
  getCharacterSubmissions,
  approveCharacterSubmission,
  rejectCharacterSubmission,
  
  createCollectibleSubmission,
  getCollectibleSubmissions,
  approveCollectibleSubmission,
  rejectCollectibleSubmission,
  
  getDashboardStats
};
