const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getMongoDatabase, isMongoConnected } = require('./mongoManager.js');
const { isSuperAdmin, getServerConfig, isMainServer } = require('./serverConfigManager.js');
const fs = require('fs');
const path = require('path');

const COLLECTIBLE_ITEMS_COLLECTION = 'collectibleItems';
const USER_COLLECTIBLE_ITEMS_COLLECTION = 'userCollectibleItems';
const COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION = 'collectibleItemSubmissions';
const ITEMS_PER_PAGE = 10;
const ITEMS_IMAGE_DIR = './data/collectible_images';

if (!fs.existsSync(ITEMS_IMAGE_DIR)) {
  fs.mkdirSync(ITEMS_IMAGE_DIR, { recursive: true });
}

const RARITY_MULTIPLIERS = {
  legendary: 5.0,
  epic: 3.0,
  'ultra rare': 2.5,
  rare: 2.0,
  uncommon: 1.5,
  common: 1.0
};

const RARITY_CONFIG = {
  legendary: { emoji: '🌟', color: '#FFD700', dropChance: 0.5, baseValue: 500 },
  epic: { emoji: '💜', color: '#9B59B6', dropChance: 2, baseValue: 250 },
  'ultra rare': { emoji: '💎', color: '#00CED1', dropChance: 5, baseValue: 150 },
  rare: { emoji: '💙', color: '#3498DB', dropChance: 10, baseValue: 100 },
  uncommon: { emoji: '💚', color: '#2ECC71', dropChance: 20, baseValue: 50 },
  common: { emoji: '⚪', color: '#95A5A6', dropChance: 40, baseValue: 25 }
};

const VALID_CRATE_TYPES = ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'];

async function initCollectibleItemsIndexes() {
  if (!isMongoConnected()) return;
  
  const db = getMongoDatabase();
  try {
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ bundle: 1 });
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ isGlobal: 1 });
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ 'droppable.enabled': 1 });
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ 'crateObtainable.enabled': 1 });
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ status: 1 });
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ availableFrom: 1, availableUntil: 1 });
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).createIndex({ computedValue: -1 });
    
    await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).createIndex({ oderId: 1 });
    await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).createIndex({ itemId: 1 });
    await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).createIndex({ oderId: 1, selectedForProfile: 1 });
    
    await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).createIndex({ status: 1 });
    await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).createIndex({ submittedBy: 1 });
    
    console.log('[CollectibleItemsSystem] MongoDB indexes created');
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error creating indexes:', error);
  }
}

const DEFAULT_COLLECTIBLES = [
  {
    name: 'Golden Trophy',
    description: 'A shiny golden trophy awarded to champions',
    emoji: '🏆',
    rarity: 'legendary',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 1, crates: ['legendary', 'tyrant'] },
    baseValue: 500,
    createdBy: 'system'
  },
  {
    name: 'Diamond Ring',
    description: 'A sparkling diamond ring of great value',
    emoji: '💍',
    rarity: 'epic',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 3, crates: ['gold', 'emerald', 'legendary'] },
    baseValue: 300,
    createdBy: 'system'
  },
  {
    name: 'Ancient Coin',
    description: 'A mysterious coin from ancient times',
    emoji: '🪙',
    rarity: 'rare',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 8, crates: ['silver', 'gold', 'emerald'] },
    baseValue: 150,
    createdBy: 'system'
  },
  {
    name: 'Magic Crystal',
    description: 'A crystal that glows with magical energy',
    emoji: '🔮',
    rarity: 'ultra rare',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 5, crates: ['gold', 'emerald', 'legendary'] },
    baseValue: 200,
    createdBy: 'system'
  },
  {
    name: 'Lucky Clover',
    description: 'A four-leaf clover that brings good luck',
    emoji: '🍀',
    rarity: 'uncommon',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 15, crates: ['bronze', 'silver', 'gold'] },
    baseValue: 75,
    createdBy: 'system'
  },
  {
    name: 'Seashell',
    description: 'A beautiful seashell from the ocean',
    emoji: '🐚',
    rarity: 'common',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 25, crates: ['bronze', 'silver'] },
    baseValue: 30,
    createdBy: 'system'
  },
  {
    name: 'Star Fragment',
    description: 'A piece of a fallen star',
    emoji: '⭐',
    rarity: 'rare',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 10, crates: ['silver', 'gold', 'emerald'] },
    baseValue: 120,
    createdBy: 'system'
  },
  {
    name: 'Rainbow Feather',
    description: 'A feather that shimmers with all colors',
    emoji: '🪶',
    rarity: 'epic',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 4, crates: ['emerald', 'legendary'] },
    baseValue: 250,
    createdBy: 'system'
  },
  {
    name: 'Crown Jewel',
    description: 'A precious gem fit for royalty',
    emoji: '👑',
    rarity: 'legendary',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 0.5, crates: ['tyrant'] },
    baseValue: 750,
    createdBy: 'system'
  },
  {
    name: 'Mystic Orb',
    description: 'An orb filled with swirling energy',
    emoji: '🌐',
    rarity: 'ultra rare',
    isGlobal: true,
    crateObtainable: { enabled: true, probability: 6, crates: ['gold', 'emerald', 'legendary'] },
    baseValue: 180,
    createdBy: 'system'
  }
];

async function seedDefaultCollectibles() {
  if (!isMongoConnected()) {
    console.log('[CollectibleItemsSystem] MongoDB not connected, skipping default collectibles seed');
    return { success: false, message: 'MongoDB not connected' };
  }
  
  const db = getMongoDatabase();
  let created = 0;
  let skipped = 0;
  
  try {
    for (const collectibleData of DEFAULT_COLLECTIBLES) {
      const existing = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).findOne({
        name: collectibleData.name,
        createdBy: 'system'
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      const result = await createCollectibleItem(collectibleData);
      if (result.success) {
        created++;
      }
    }
    
    if (created > 0) {
      console.log(`[CollectibleItemsSystem] Seeded ${created} default collectibles (${skipped} already existed)`);
    }
    
    return { success: true, created, skipped };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error seeding default collectibles:', error);
    return { success: false, message: error.message };
  }
}

async function createCollectibleItem(itemData) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  
  const rarity = itemData.rarity?.toLowerCase() || 'common';
  const rarityConfig = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  
  const item = {
    name: itemData.name,
    description: itemData.description || '',
    imageUrl: itemData.imageUrl,
    emoji: itemData.emoji || rarityConfig.emoji,
    rarity: rarity,
    bundle: itemData.bundle,
    isGlobal: itemData.isGlobal || false,
    droppable: {
      enabled: itemData.droppable?.enabled || false,
      probability: itemData.droppable?.probability || rarityConfig.dropChance
    },
    crateObtainable: {
      enabled: itemData.crateObtainable?.enabled || false,
      probability: itemData.crateObtainable?.probability || rarityConfig.dropChance,
      crates: itemData.crateObtainable?.crates || []
    },
    tradable: itemData.tradable !== false,
    giftable: itemData.giftable !== false,
    sellable: itemData.sellable !== false,
    baseValue: itemData.baseValue || rarityConfig.baseValue,
    computedValue: itemData.baseValue || rarityConfig.baseValue,
    stackable: itemData.stackable !== false,
    availableFrom: itemData.availableFrom || null,
    availableUntil: itemData.availableUntil || null,
    serverSpecific: itemData.serverSpecific || null,
    eventName: itemData.eventName || null,
    ownerCount: 0,
    totalQuantity: 0,
    status: 'active',
    createdBy: itemData.createdBy,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).insertOne(item);
    return { 
      success: true, 
      message: `✅ Collectible item "${item.name}" created successfully!`,
      itemId: result.insertedId 
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error creating item:', error);
    return { success: false, message: '❌ Failed to create item!' };
  }
}

async function getCollectibleItem(itemId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    return await db.collection(COLLECTIBLE_ITEMS_COLLECTION).findOne({ 
      _id: new ObjectId(itemId) 
    });
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting item:', error);
    return null;
  }
}

async function getCollectibleItemByName(name, bundle = null) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    const query = { 
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: 'active'
    };
    
    if (bundle) {
      query.$or = [{ bundle }, { isGlobal: true }];
    }
    
    return await db.collection(COLLECTIBLE_ITEMS_COLLECTION).findOne(query);
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting item by name:', error);
    return null;
  }
}

async function updateCollectibleItem(itemId, updates) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    updates.updatedAt = new Date();
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
      { _id: new ObjectId(itemId) },
      { $set: updates }
    );
    return { success: true, message: '✅ Item updated successfully!' };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error updating item:', error);
    return { success: false, message: '❌ Failed to update item!' };
  }
}

async function deleteCollectibleItem(itemId) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
      { _id: new ObjectId(itemId) },
      { $set: { status: 'deleted', updatedAt: new Date() } }
    );
    return { success: true, message: '✅ Item deleted successfully!' };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error deleting item:', error);
    return { success: false, message: '❌ Failed to delete item!' };
  }
}

async function listCollectibleItems(bundle = null, page = 1, includeGlobal = true) {
  if (!isMongoConnected()) return { items: [], total: 0 };
  
  const db = getMongoDatabase();
  
  try {
    const now = new Date();
    const query = { 
      status: 'active',
      $and: [
        {
          $or: [
            { availableFrom: null },
            { availableFrom: { $lte: now } }
          ]
        },
        {
          $or: [
            { availableUntil: null },
            { availableUntil: { $gte: now } }
          ]
        }
      ]
    };
    
    if (bundle) {
      if (includeGlobal) {
        query.$or = [{ bundle }, { isGlobal: true }];
      } else {
        query.bundle = bundle;
      }
    }
    
    const total = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).countDocuments(query);
    const items = await db.collection(COLLECTIBLE_ITEMS_COLLECTION)
      .find(query)
      .sort({ computedValue: -1 })
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .toArray();
    
    return { items, total, pages: Math.ceil(total / ITEMS_PER_PAGE) };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error listing items:', error);
    return { items: [], total: 0, pages: 0 };
  }
}

async function listAllCollectibleItems(bundle = null) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    const query = { status: 'active' };
    
    if (bundle) {
      query.$or = [{ bundle }, { isGlobal: true }];
    }
    
    return await db.collection(COLLECTIBLE_ITEMS_COLLECTION)
      .find(query)
      .sort({ computedValue: -1 })
      .toArray();
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error listing all items:', error);
    return [];
  }
}

async function recalculateItemValue(itemId) {
  if (!isMongoConnected()) return;
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const item = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).findOne({ _id: new ObjectId(itemId) });
    if (!item) return;
    
    const ownerCount = item.ownerCount || 0;
    const baseValue = item.baseValue || 100;
    
    let rarityMultiplier = 1.0;
    if (ownerCount === 0) {
      rarityMultiplier = RARITY_MULTIPLIERS.legendary;
    } else if (ownerCount <= 5) {
      rarityMultiplier = RARITY_MULTIPLIERS.epic;
    } else if (ownerCount <= 20) {
      rarityMultiplier = RARITY_MULTIPLIERS.rare;
    } else if (ownerCount <= 50) {
      rarityMultiplier = RARITY_MULTIPLIERS.uncommon;
    } else {
      rarityMultiplier = RARITY_MULTIPLIERS.common;
    }
    
    const computedValue = Math.floor(baseValue * rarityMultiplier);
    
    await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
      { _id: new ObjectId(itemId) },
      { $set: { computedValue, updatedAt: new Date() } }
    );
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error recalculating item value:', error);
  }
}

async function recalculateAllItemValues() {
  if (!isMongoConnected()) return { success: false, message: '❌ MongoDB is not connected!' };
  
  const db = getMongoDatabase();
  
  try {
    const items = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).find({ status: 'active' }).toArray();
    
    for (const item of items) {
      await recalculateItemValue(item._id.toString());
    }
    
    return { success: true, message: `✅ Recalculated values for ${items.length} items!` };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error recalculating all item values:', error);
    return { success: false, message: '❌ Failed to recalculate item values!' };
  }
}

async function awardCollectibleItem(userId, itemId, quantity = 1) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const item = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).findOne({ 
      _id: new ObjectId(itemId),
      status: 'active'
    });
    
    if (!item) {
      return { success: false, message: '❌ Item not found!' };
    }
    
    const existingUserItem = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).findOne({
      userId: userId,
      itemId: new ObjectId(itemId)
    });
    
    if (existingUserItem) {
      if (!item.stackable) {
        return { success: false, message: '❌ Already owned - item is not stackable!', alreadyOwned: true };
      }
      
      await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: existingUserItem._id },
        { 
          $inc: { quantity },
          $set: { updatedAt: new Date() }
        }
      );
      
      await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: new ObjectId(itemId) },
        { $inc: { totalQuantity: quantity } }
      );
    } else {
      await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).insertOne({
        userId: userId,
        itemId: new ObjectId(itemId),
        quantity,
        selectedForProfile: false,
        obtainedAt: new Date(),
        updatedAt: new Date()
      });
      
      await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: new ObjectId(itemId) },
        { $inc: { ownerCount: 1, totalQuantity: quantity } }
      );
    }
    
    await recalculateItemValue(itemId);
    
    return { 
      success: true, 
      message: `✅ Received ${quantity}x **${item.name}**!`,
      item 
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error awarding item:', error);
    return { success: false, message: '❌ Failed to award item!' };
  }
}

async function removeCollectibleItem(userId, itemId, quantity = 1) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const userItem = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).findOne({
      userId: userId,
      itemId: new ObjectId(itemId)
    });
    
    if (!userItem || userItem.quantity < quantity) {
      return { success: false, message: '❌ You don\'t have enough of this item!' };
    }
    
    if (userItem.quantity === quantity) {
      await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).deleteOne({ _id: userItem._id });
      
      await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: new ObjectId(itemId) },
        { $inc: { ownerCount: -1, totalQuantity: -quantity } }
      );
    } else {
      await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: userItem._id },
        { 
          $inc: { quantity: -quantity },
          $set: { updatedAt: new Date() }
        }
      );
      
      await db.collection(COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: new ObjectId(itemId) },
        { $inc: { totalQuantity: -quantity } }
      );
    }
    
    await recalculateItemValue(itemId);
    
    return { success: true, message: '✅ Item removed successfully!' };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error removing item:', error);
    return { success: false, message: '❌ Failed to remove item!' };
  }
}

async function getUserCollectibleItems(userId, page = 1) {
  if (!isMongoConnected()) return { items: [], total: 0 };
  
  const db = getMongoDatabase();
  
  try {
    const pipeline = [
      { $match: { userId: userId } },
      { 
        $lookup: {
          from: COLLECTIBLE_ITEMS_COLLECTION,
          localField: 'itemId',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      { $match: { 'itemDetails.status': 'active' } },
      { $sort: { 'itemDetails.computedValue': -1 } },
      { $skip: (page - 1) * ITEMS_PER_PAGE },
      { $limit: ITEMS_PER_PAGE }
    ];
    
    const items = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).aggregate(pipeline).toArray();
    
    const total = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).countDocuments({ userId: userId });
    
    return { 
      items: items.map(ui => ({
        ...ui.itemDetails,
        quantity: ui.quantity,
        selectedForProfile: ui.selectedForProfile,
        obtainedAt: ui.obtainedAt
      })),
      total,
      pages: Math.ceil(total / ITEMS_PER_PAGE)
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting user items:', error);
    return { items: [], total: 0, pages: 0 };
  }
}

async function getAllUserCollectibleItems(userId) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    const pipeline = [
      { $match: { userId: userId } },
      { 
        $lookup: {
          from: COLLECTIBLE_ITEMS_COLLECTION,
          localField: 'itemId',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      { $match: { 'itemDetails.status': 'active' } },
      { $sort: { 'itemDetails.computedValue': -1 } }
    ];
    
    const items = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).aggregate(pipeline).toArray();
    
    return items.map(ui => ({
      ...ui.itemDetails,
      quantity: ui.quantity,
      selectedForProfile: ui.selectedForProfile,
      obtainedAt: ui.obtainedAt
    }));
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting all user items:', error);
    return [];
  }
}

async function getUserCollectibleItemByItemId(userId, itemId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    return await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).findOne({
      userId: userId,
      itemId: new ObjectId(itemId)
    });
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting user item:', error);
    return null;
  }
}

async function setProfileCollectibleItem(userId, itemId) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const userItem = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).findOne({
      userId: userId,
      itemId: new ObjectId(itemId)
    });
    
    if (!userItem) {
      return { success: false, message: '❌ You don\'t own this item!' };
    }
    
    await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).updateMany(
      { userId: userId },
      { $set: { selectedForProfile: false } }
    );
    
    await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).updateOne(
      { _id: userItem._id },
      { $set: { selectedForProfile: true, updatedAt: new Date() } }
    );
    
    const item = await getCollectibleItem(itemId);
    
    return { 
      success: true, 
      message: `✅ **${item?.name || 'Item'}** is now displayed on your profile!` 
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error setting profile item:', error);
    return { success: false, message: '❌ Failed to set profile item!' };
  }
}

async function clearProfileCollectibleItem(userId) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  
  try {
    await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).updateMany(
      { userId: userId },
      { $set: { selectedForProfile: false } }
    );
    
    return { success: true, message: '✅ Profile item cleared!' };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error clearing profile item:', error);
    return { success: false, message: '❌ Failed to clear profile item!' };
  }
}

async function getProfileCollectibleItem(userId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    const pipeline = [
      { $match: { userId: userId, selectedForProfile: true } },
      { 
        $lookup: {
          from: COLLECTIBLE_ITEMS_COLLECTION,
          localField: 'itemId',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      { $limit: 1 }
    ];
    
    const results = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).aggregate(pipeline).toArray();
    
    if (results.length === 0) return null;
    
    return {
      ...results[0].itemDetails,
      quantity: results[0].quantity
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting profile item:', error);
    return null;
  }
}

async function sellCollectibleItem(userId, itemId, quantity, data) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const item = await getCollectibleItem(itemId);
    
    if (!item) {
      return { success: false, message: '❌ Item not found!' };
    }
    
    if (!item.sellable) {
      return { success: false, message: '❌ This item cannot be sold!' };
    }
    
    const userItem = await getUserCollectibleItemByItemId(userId, itemId);
    
    if (!userItem || userItem.quantity < quantity) {
      return { success: false, message: '❌ You don\'t have enough of this item!' };
    }
    
    const totalValue = item.computedValue * quantity;
    
    const removeResult = await removeCollectibleItem(userId, itemId, quantity);
    if (!removeResult.success) {
      return removeResult;
    }
    
    if (!data.users[userId]) {
      data.users[userId] = { userId: userId };
    }
    data.users[userId].coins = (data.users[userId].coins || 0) + totalValue;
    
    return { 
      success: true, 
      message: `✅ Sold ${quantity}x **${item.name}** for **${totalValue}** coins!`,
      coinsEarned: totalValue
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error selling item:', error);
    return { success: false, message: '❌ Failed to sell item!' };
  }
}

async function submitCollectibleItem(submissionData) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  
  const rarity = submissionData.rarity?.toLowerCase() || 'common';
  const rarityConfig = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  
  const submission = {
    name: submissionData.name,
    description: submissionData.description || '',
    imageUrl: submissionData.imageUrl,
    emoji: submissionData.emoji || rarityConfig.emoji,
    rarity: rarity,
    bundle: submissionData.bundle,
    isGlobal: false,
    droppable: {
      enabled: submissionData.droppable || false,
      probability: submissionData.dropProbability || rarityConfig.dropChance
    },
    crateObtainable: {
      enabled: submissionData.crateObtainable || false,
      probability: submissionData.crateProbability || rarityConfig.dropChance,
      crates: submissionData.crates || []
    },
    tradable: submissionData.tradable !== false,
    giftable: submissionData.giftable !== false,
    sellable: submissionData.sellable !== false,
    baseValue: submissionData.baseValue || rarityConfig.baseValue,
    stackable: submissionData.stackable !== false,
    availableFrom: submissionData.availableFrom || null,
    availableUntil: submissionData.availableUntil || null,
    serverSpecific: submissionData.serverSpecific || null,
    eventName: submissionData.eventName || null,
    submittedBy: submissionData.submittedBy,
    submittedByUsername: submissionData.submittedByUsername,
    status: 'pending',
    submittedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).insertOne(submission);
    return { 
      success: true, 
      message: `✅ Item "${submission.name}" submitted for review!\nSubmission ID: \`${result.insertedId}\``,
      submissionId: result.insertedId 
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error submitting item:', error);
    return { success: false, message: '❌ Failed to submit item!' };
  }
}

async function getPendingCollectibleSubmissions(page = 1) {
  if (!isMongoConnected()) return { submissions: [], total: 0 };
  
  const db = getMongoDatabase();
  
  try {
    const total = await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).countDocuments({ status: 'pending' });
    const submissions = await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION)
      .find({ status: 'pending' })
      .sort({ submittedAt: 1 })
      .skip((page - 1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
      .toArray();
    
    return { submissions, total, pages: Math.ceil(total / ITEMS_PER_PAGE) };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting pending submissions:', error);
    return { submissions: [], total: 0, pages: 0 };
  }
}

async function getCollectibleSubmission(submissionId) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    return await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).findOne({ 
      _id: new ObjectId(submissionId) 
    });
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting submission:', error);
    return null;
  }
}

async function approveCollectibleSubmission(submissionId, approverId) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const submission = await getCollectibleSubmission(submissionId);
    
    if (!submission) {
      return { success: false, message: '❌ Submission not found!' };
    }
    
    if (submission.status !== 'pending') {
      return { success: false, message: '❌ This submission has already been processed!' };
    }
    
    const createResult = await createCollectibleItem({
      name: submission.name,
      description: submission.description,
      imageUrl: submission.imageUrl,
      bundle: submission.bundle,
      isGlobal: submission.isGlobal,
      droppable: submission.droppable,
      crateObtainable: submission.crateObtainable,
      sellable: submission.sellable,
      baseValue: submission.baseValue,
      stackable: submission.stackable,
      availableFrom: submission.availableFrom,
      availableUntil: submission.availableUntil,
      createdBy: submission.submittedBy
    });
    
    if (!createResult.success) {
      return createResult;
    }
    
    await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).updateOne(
      { _id: new ObjectId(submissionId) },
      { 
        $set: { 
          status: 'approved',
          approvedBy: approverId,
          approvedAt: new Date(),
          itemId: createResult.itemId
        }
      }
    );
    
    return { 
      success: true, 
      message: `✅ Item "${submission.name}" approved and created!`,
      itemId: createResult.itemId
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error approving submission:', error);
    return { success: false, message: '❌ Failed to approve submission!' };
  }
}

async function rejectCollectibleSubmission(submissionId, rejectorId, reason = '') {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const submission = await getCollectibleSubmission(submissionId);
    
    if (!submission) {
      return { success: false, message: '❌ Submission not found!' };
    }
    
    if (submission.status !== 'pending') {
      return { success: false, message: '❌ This submission has already been processed!' };
    }
    
    await db.collection(COLLECTIBLE_ITEM_SUBMISSIONS_COLLECTION).updateOne(
      { _id: new ObjectId(submissionId) },
      { 
        $set: { 
          status: 'rejected',
          rejectedBy: rejectorId,
          rejectedAt: new Date(),
          rejectionReason: reason
        }
      }
    );
    
    return { 
      success: true, 
      message: `✅ Submission for "${submission.name}" rejected.` 
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error rejecting submission:', error);
    return { success: false, message: '❌ Failed to reject submission!' };
  }
}

async function getDroppableCollectibleItems(bundle) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  const now = new Date();
  
  try {
    const query = {
      status: 'active',
      'droppable.enabled': true,
      $or: [{ bundle }, { isGlobal: true }],
      $and: [
        {
          $or: [
            { availableFrom: null },
            { availableFrom: { $lte: now } }
          ]
        },
        {
          $or: [
            { availableUntil: null },
            { availableUntil: { $gte: now } }
          ]
        }
      ]
    };
    
    return await db.collection(COLLECTIBLE_ITEMS_COLLECTION).find(query).toArray();
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting droppable items:', error);
    return [];
  }
}

async function getCrateCollectibleItems(bundle, crateType = null, serverId = null) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  const now = new Date();
  
  try {
    const query = {
      status: 'active',
      'crateObtainable.enabled': true,
      $and: [
        {
          $or: [
            { availableFrom: null },
            { availableFrom: { $lte: now } }
          ]
        },
        {
          $or: [
            { availableUntil: null },
            { availableUntil: { $gte: now } }
          ]
        }
      ]
    };
    
    if (bundle) {
      query.$or = [{ bundle }, { isGlobal: true }];
    }
    
    if (serverId) {
      query.$or = query.$or || [];
      query.$or.push({ serverSpecific: serverId });
    }
    
    let items = await db.collection(COLLECTIBLE_ITEMS_COLLECTION).find(query).toArray();
    
    if (crateType) {
      items = items.filter(item => {
        const crates = item.crateObtainable?.crates || [];
        return crates.length === 0 || crates.includes(crateType);
      });
    }
    
    return items;
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error getting crate items:', error);
    return [];
  }
}

async function tryDropCollectibleFromCrate(userId, bundle, crateType, serverId = null) {
  const items = await getCrateCollectibleItems(bundle, crateType, serverId);
  
  if (items.length === 0) return null;
  
  for (const item of items) {
    const roll = Math.random() * 100;
    const dropChance = item.crateObtainable?.probability || RARITY_CONFIG[item.rarity]?.dropChance || 5;
    
    if (roll < dropChance) {
      const awardResult = await awardCollectibleItem(userId, item._id.toString(), 1);
      if (awardResult.success) {
        return {
          item,
          message: `🎁 **Collectible Item!** ${item.emoji} **${item.name}**\n${item.description || ''}`
        };
      } else if (awardResult.alreadyOwned && !item.stackable) {
        continue;
      }
    }
  }
  
  return null;
}

function getRarityTier(ownerCount) {
  if (ownerCount === 0) return { name: 'Legendary', color: '#FFD700', emoji: '🌟' };
  if (ownerCount <= 5) return { name: 'Epic', color: '#9B59B6', emoji: '💜' };
  if (ownerCount <= 20) return { name: 'Rare', color: '#3498DB', emoji: '💙' };
  if (ownerCount <= 50) return { name: 'Uncommon', color: '#2ECC71', emoji: '💚' };
  return { name: 'Common', color: '#95A5A6', emoji: '⚪' };
}

function isCollectibleItemAvailable(item) {
  const now = new Date();
  
  if (item.availableFrom && new Date(item.availableFrom) > now) {
    return false;
  }
  
  if (item.availableUntil && new Date(item.availableUntil) < now) {
    return false;
  }
  
  return true;
}

function formatCollectibleItemAvailability(item) {
  if (!item.availableFrom && !item.availableUntil) {
    return 'Always available';
  }
  
  const now = new Date();
  
  if (item.availableUntil) {
    const until = new Date(item.availableUntil);
    if (until < now) {
      return '❌ No longer available';
    }
    const daysLeft = Math.ceil((until - now) / (1000 * 60 * 60 * 24));
    return `⏰ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
  }
  
  if (item.availableFrom) {
    const from = new Date(item.availableFrom);
    if (from > now) {
      return `🔒 Available from ${from.toLocaleDateString()}`;
    }
  }
  
  return 'Available';
}

async function displayCollectibleItemsList(message, bundle, page = 1) {
  const { items, total, pages } = await listCollectibleItems(bundle, page);
  
  if (items.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('📦 Collectible Items')
      .setDescription('No collectible items available yet!');
    return message.reply({ embeds: [embed] });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#00D166')
    .setTitle('📦 Collectible Items')
    .setDescription(`Sorted by rarity (rarest first)\nPage ${page}/${pages} • ${total} items total`)
    .setFooter({ text: 'Use !setitem <name> to display an item on your profile' });
  
  for (const item of items) {
    const rarity = getRarityTier(item.ownerCount);
    const availability = formatCollectibleItemAvailability(item);
    
    let traits = [];
    if (item.droppable?.enabled) traits.push('🎯 Droppable');
    if (item.crateObtainable?.enabled) traits.push('📦 Crate');
    if (item.sellable) traits.push('💰 Sellable');
    if (item.stackable) traits.push('📚 Stackable');
    
    embed.addFields({
      name: `${rarity.emoji} ${item.name}`,
      value: `Value: **${item.computedValue}** coins • Owners: **${item.ownerCount}**\n${traits.join(' • ') || 'No special traits'}\n${availability}`,
      inline: false
    });
  }
  
  const components = [];
  if (pages > 1) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`colitems_prev_${page}_${bundle || 'all'}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`colitems_next_${page}_${bundle || 'all'}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages)
    );
    components.push(row);
  }
  
  return message.reply({ embeds: [embed], components });
}

async function displayUserCollectibleItems(message, userId, page = 1) {
  const { items, total, pages } = await getUserCollectibleItems(userId, page);
  
  if (items.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('🎒 Your Collectible Items')
      .setDescription('You don\'t have any collectible items yet!\nCollect them from drops and crates.');
    return message.reply({ embeds: [embed] });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#00D166')
    .setTitle('🎒 Your Collectible Items')
    .setDescription(`Page ${page}/${pages} • ${total} items owned`)
    .setFooter({ text: 'Use !setitem <name> to display on profile • !sellitem <name> [qty] to sell' });
  
  for (const item of items) {
    const rarity = getRarityTier(item.ownerCount);
    const profileIndicator = item.selectedForProfile ? '⭐ ' : '';
    
    embed.addFields({
      name: `${profileIndicator}${rarity.emoji} ${item.name}`,
      value: `Quantity: **${item.quantity}** • Value: **${item.computedValue}** coins${item.selectedForProfile ? '\n*Currently displayed on profile*' : ''}`,
      inline: false
    });
  }
  
  const components = [];
  if (pages > 1) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mycolitem_prev_${page}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`mycolitem_next_${page}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages)
    );
    components.push(row);
  }
  
  return message.reply({ embeds: [embed], components });
}

async function handleCollectibleItemsButton(interaction) {
  const customId = interaction.customId;
  const parts = customId.split('_');
  
  if (parts[0] === 'colitems') {
    const direction = parts[1];
    const currentPage = parseInt(parts[2]);
    const bundle = parts[3] === 'all' ? null : parts[3];
    
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    
    const { items, total, pages } = await listCollectibleItems(bundle, newPage);
    
    const embed = new EmbedBuilder()
      .setColor('#00D166')
      .setTitle('📦 Collectible Items')
      .setDescription(`Sorted by rarity (rarest first)\nPage ${newPage}/${pages} • ${total} items total`)
      .setFooter({ text: 'Use !setitem <name> to display an item on your profile' });
    
    for (const item of items) {
      const rarity = getRarityTier(item.ownerCount);
      const availability = formatCollectibleItemAvailability(item);
      
      let traits = [];
      if (item.droppable?.enabled) traits.push('🎯 Droppable');
      if (item.crateObtainable?.enabled) traits.push('📦 Crate');
      if (item.sellable) traits.push('💰 Sellable');
      if (item.stackable) traits.push('📚 Stackable');
      
      embed.addFields({
        name: `${rarity.emoji} ${item.name}`,
        value: `Value: **${item.computedValue}** coins • Owners: **${item.ownerCount}**\n${traits.join(' • ') || 'No special traits'}\n${availability}`,
        inline: false
      });
    }
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`colitems_prev_${newPage}_${bundle || 'all'}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage <= 1),
      new ButtonBuilder()
        .setCustomId(`colitems_next_${newPage}_${bundle || 'all'}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= pages)
    );
    
    await interaction.update({ embeds: [embed], components: [row] });
  } else if (parts[0] === 'mycolitem') {
    const direction = parts[1];
    const currentPage = parseInt(parts[2]);
    const userId = interaction.user.id;
    
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    
    const { items, total, pages } = await getUserCollectibleItems(userId, newPage);
    
    const embed = new EmbedBuilder()
      .setColor('#00D166')
      .setTitle('🎒 Your Collectible Items')
      .setDescription(`Page ${newPage}/${pages} • ${total} items owned`)
      .setFooter({ text: 'Use !setitem <name> to display on profile • !sellitem <name> [qty] to sell' });
    
    for (const item of items) {
      const rarity = getRarityTier(item.ownerCount);
      const profileIndicator = item.selectedForProfile ? '⭐ ' : '';
      
      embed.addFields({
        name: `${profileIndicator}${rarity.emoji} ${item.name}`,
        value: `Quantity: **${item.quantity}** • Value: **${item.computedValue}** coins${item.selectedForProfile ? '\n*Currently displayed on profile*' : ''}`,
        inline: false
      });
    }
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mycolitem_prev_${newPage}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage <= 1),
      new ButtonBuilder()
        .setCustomId(`mycolitem_next_${newPage}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= pages)
    );
    
    await interaction.update({ embeds: [embed], components: [row] });
  }
}

const collectibleItemSubmissionSessions = new Map();

async function startCollectibleItemSubmission(message, bundle) {
  const userId = message.author.id;
  
  collectibleItemSubmissionSessions.set(userId, {
    step: 'name',
    bundle,
    data: {},
    channelId: message.channel.id,
    startedAt: Date.now()
  });
  
  const embed = new EmbedBuilder()
    .setColor('#00D166')
    .setTitle('📦 Collectible Item Submission')
    .setDescription(`You're submitting an item for the **${bundle}** bundle.\n\n**Step 1/6:** What is the name of this item?`)
    .setFooter({ text: 'Type "cancel" to cancel the submission' });
  
  await message.reply({ embeds: [embed] });
}

async function handleCollectibleSubmissionStep(message) {
  const userId = message.author.id;
  const session = collectibleItemSubmissionSessions.get(userId);
  
  if (!session || session.channelId !== message.channel.id) return false;
  
  const content = message.content.trim();
  
  if (content.toLowerCase() === 'cancel') {
    collectibleItemSubmissionSessions.delete(userId);
    await message.reply('❌ Item submission cancelled.');
    return true;
  }
  
  switch (session.step) {
    case 'name':
      session.data.name = content;
      session.step = 'description';
      
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00D166')
          .setTitle('📦 Collectible Item Submission')
          .setDescription(`Name: **${content}**\n\n**Step 2/6:** Provide a short description for this item (or type "skip"):`)
        ]
      });
      break;
      
    case 'description':
      session.data.description = content.toLowerCase() === 'skip' ? '' : content;
      session.step = 'image';
      
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00D166')
          .setTitle('📦 Collectible Item Submission')
          .setDescription('**Step 3/6:** Upload the item image (attach an image to your next message):')
          .setFooter({ text: 'Image is required!' })
        ]
      });
      break;
      
    case 'image':
      if (message.attachments.size === 0) {
        await message.reply('❌ Please attach an image! This is required.');
        return true;
      }
      
      const attachment = message.attachments.first();
      if (!attachment.contentType?.startsWith('image/')) {
        await message.reply('❌ Please attach a valid image file!');
        return true;
      }
      
      session.data.imageUrl = attachment.url;
      session.step = 'value';
      
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00D166')
          .setTitle('📦 Collectible Item Submission')
          .setDescription('**Step 4/6:** What is the base value of this item in coins? (default: 100)')
          .setImage(attachment.url)
        ]
      });
      break;
      
    case 'value':
      const value = parseInt(content) || 100;
      session.data.baseValue = Math.max(1, Math.min(100000, value));
      session.step = 'traits';
      
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00D166')
          .setTitle('📦 Collectible Item Submission')
          .setDescription(`Base value: **${session.data.baseValue}** coins\n\n**Step 5/6:** Select traits for this item.\nType the numbers separated by commas (e.g., "1,2,4") or "none":\n\n1️⃣ Droppable (can appear in drops)\n2️⃣ Crate-obtainable (can be found in crates)\n3️⃣ Sellable (can be sold for coins)\n4️⃣ Stackable (can own multiple)`)
        ]
      });
      break;
      
    case 'traits':
      session.data.droppable = content.includes('1');
      session.data.crateObtainable = content.includes('2');
      session.data.stackable = content.includes('4');
      
      if (content.toLowerCase() === 'none') {
        session.data.sellable = true;
      } else {
        session.data.sellable = content.includes('3');
      }
      
      if (!content.includes('3') && content.toLowerCase() !== 'none') {
        session.data.sellable = true;
      }
      
      session.step = 'availability';
      
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#00D166')
          .setTitle('📦 Collectible Item Submission')
          .setDescription('**Step 6/6:** Is this a limited-time item?\n\nType "permanent" for always available, or provide end date in format: `YYYY-MM-DD` (e.g., 2024-12-31)')
        ]
      });
      break;
      
    case 'availability':
      if (content.toLowerCase() !== 'permanent') {
        const dateMatch = content.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          session.data.availableUntil = new Date(content + 'T23:59:59Z');
        }
      }
      
      const result = await submitCollectibleItem({
        name: session.data.name,
        description: session.data.description,
        imageUrl: session.data.imageUrl,
        bundle: session.bundle,
        droppable: session.data.droppable,
        crateObtainable: session.data.crateObtainable,
        sellable: session.data.sellable,
        baseValue: session.data.baseValue,
        stackable: session.data.stackable,
        availableUntil: session.data.availableUntil,
        submittedBy: userId,
        submittedByUsername: message.author.username
      });
      
      collectibleItemSubmissionSessions.delete(userId);
      
      const finalEmbed = new EmbedBuilder()
        .setColor(result.success ? '#00D166' : '#FF0000')
        .setTitle('📦 Collectible Item Submission')
        .setDescription(result.message)
        .setThumbnail(session.data.imageUrl);
      
      if (result.success) {
        let traitsList = [];
        if (session.data.droppable) traitsList.push('🎯 Droppable');
        if (session.data.crateObtainable) traitsList.push('📦 Crate-obtainable');
        if (session.data.sellable) traitsList.push('💰 Sellable');
        if (session.data.stackable) traitsList.push('📚 Stackable');
        
        finalEmbed.addFields(
          { name: 'Name', value: session.data.name, inline: true },
          { name: 'Bundle', value: session.bundle, inline: true },
          { name: 'Base Value', value: `${session.data.baseValue} coins`, inline: true },
          { name: 'Traits', value: traitsList.join('\n') || 'None', inline: false },
          { name: 'Availability', value: session.data.availableUntil ? `Until ${session.data.availableUntil.toLocaleDateString()}` : 'Permanent', inline: true }
        );
      }
      
      await message.reply({ embeds: [finalEmbed] });
      break;
  }
  
  return true;
}

function hasActiveCollectibleSubmissionSession(userId) {
  const session = collectibleItemSubmissionSessions.get(userId);
  if (!session) return false;
  
  if (Date.now() - session.startedAt > 10 * 60 * 1000) {
    collectibleItemSubmissionSessions.delete(userId);
    return false;
  }
  
  return true;
}

async function displayPendingCollectibleSubmissions(message, page = 1) {
  const { submissions, total, pages } = await getPendingCollectibleSubmissions(page);
  
  if (submissions.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#00D166')
      .setTitle('📋 Pending Item Submissions')
      .setDescription('No pending submissions!');
    return message.reply({ embeds: [embed] });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('📋 Pending Item Submissions')
    .setDescription(`Page ${page}/${pages} • ${total} pending submissions\n\nUse \`!approveitem <id>\` or \`!rejectitem <id> [reason]\``)
    .setFooter({ text: 'Review submissions carefully before approving' });
  
  for (const sub of submissions) {
    let traitsList = [];
    if (sub.droppable?.enabled) traitsList.push('🎯 Drop');
    if (sub.crateObtainable?.enabled) traitsList.push('📦 Crate');
    if (sub.sellable) traitsList.push('💰 Sell');
    if (sub.stackable) traitsList.push('📚 Stack');
    
    embed.addFields({
      name: `${sub.name} (${sub.bundle})`,
      value: `ID: \`${sub._id}\`\nBy: <@${sub.submittedBy}>\nValue: ${sub.baseValue} coins\nTraits: ${traitsList.join(' ') || 'None'}\n${sub.availableUntil ? `Limited until ${new Date(sub.availableUntil).toLocaleDateString()}` : 'Permanent'}`,
      inline: false
    });
  }
  
  return message.reply({ embeds: [embed] });
}

async function giveCollectibleItem(userId, itemName, quantity = 1, bundle = null) {
  const item = await getCollectibleItemByName(itemName, bundle);
  
  if (!item) {
    return { success: false, message: `❌ Item "${itemName}" not found!` };
  }
  
  return await awardCollectibleItem(userId, item._id.toString(), quantity);
}

async function takeCollectibleItem(userId, itemName, quantity = 1, bundle = null) {
  const item = await getCollectibleItemByName(itemName, bundle);
  
  if (!item) {
    return { success: false, message: `❌ Item "${itemName}" not found!` };
  }
  
  return await removeCollectibleItem(userId, item._id.toString(), quantity);
}

async function setItemGlobal(itemId, isGlobal) {
  return await updateCollectibleItem(itemId, { isGlobal });
}

async function toggleItemTrait(itemId, trait, value) {
  const updates = {};
  
  switch (trait) {
    case 'droppable':
      updates['droppable.enabled'] = value;
      break;
    case 'crate':
      updates['crateObtainable.enabled'] = value;
      break;
    case 'sellable':
      updates.sellable = value;
      break;
    case 'stackable':
      updates.stackable = value;
      break;
    default:
      return { success: false, message: '❌ Invalid trait!' };
  }
  
  return await updateCollectibleItem(itemId, updates);
}

async function setItemProbability(itemId, type, probability) {
  const updates = {};
  
  if (type === 'drop') {
    updates['droppable.probability'] = probability;
  } else if (type === 'crate') {
    updates['crateObtainable.probability'] = probability;
  } else {
    return { success: false, message: '❌ Invalid type! Use "drop" or "crate".' };
  }
  
  return await updateCollectibleItem(itemId, updates);
}

async function setItemAvailability(itemId, availableFrom, availableUntil) {
  return await updateCollectibleItem(itemId, { 
    availableFrom: availableFrom ? new Date(availableFrom) : null,
    availableUntil: availableUntil ? new Date(availableUntil) : null
  });
}

async function getServerSpecificCollectiblesFromDB(serverId) {
  if (!isMongoConnected()) return [];
  
  const db = getMongoDatabase();
  
  try {
    const collectibles = await db.collection('serverCollectibles')
      .find({ serverId, status: 'active' })
      .toArray();
    
    return collectibles.map(c => ({
      ...c,
      id: c._id.toString(),
      isServerSpecific: true
    }));
  } catch (error) {
    console.error(`[CollectibleItemsSystem] Error loading server collectibles for ${serverId}:`, error);
    return [];
  }
}

async function getServerCollectibleByName(serverId, name) {
  if (!isMongoConnected()) return null;
  
  const db = getMongoDatabase();
  
  try {
    const collectible = await db.collection('serverCollectibles').findOne({ 
      serverId, 
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      status: 'active'
    });
    
    if (collectible) {
      return {
        ...collectible,
        id: collectible._id.toString(),
        isServerSpecific: true
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[CollectibleItemsSystem] Error getting server collectible "${name}" for ${serverId}:`, error);
    return null;
  }
}

async function getAllCollectiblesForServer(serverId) {
  const serverCollectibles = await getServerSpecificCollectiblesFromDB(serverId);
  return serverCollectibles;
}

async function getDroppableServerCollectibles(serverId) {
  const collectibles = await getServerSpecificCollectiblesFromDB(serverId);
  // Server collectibles use 'dropSettings' field (from !scol create command)
  return collectibles.filter(c => c.dropSettings?.enabled === true);
}

async function getCrateServerCollectibles(serverId, crateType = null) {
  const collectibles = await getServerSpecificCollectiblesFromDB(serverId);
  return collectibles.filter(c => {
    if (!c.crateObtainable?.enabled) return false;
    if (crateType && c.crateObtainable.crates && !c.crateObtainable.crates.includes(crateType)) {
      return false;
    }
    return true;
  });
}

async function awardServerCollectible(userId, serverId, collectibleId, quantity = 1) {
  if (!isMongoConnected()) {
    return { success: false, message: '❌ MongoDB is not connected!' };
  }
  
  const db = getMongoDatabase();
  const { ObjectId } = require('mongodb');
  
  try {
    const collectible = await db.collection('serverCollectibles').findOne({ 
      _id: new ObjectId(collectibleId),
      serverId: serverId,
      status: 'active'
    });
    
    if (!collectible) {
      return { success: false, message: '❌ Server collectible not found!' };
    }
    
    const existingUserItem = await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).findOne({
      userId: userId,
      itemId: new ObjectId(collectibleId),
      isServerItem: true,
      serverId: serverId
    });
    
    if (existingUserItem) {
      if (collectible.stackable === false) {
        return { success: false, message: '❌ Already owned - item is not stackable!', alreadyOwned: true };
      }
      
      await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).updateOne(
        { _id: existingUserItem._id },
        { 
          $inc: { quantity },
          $set: { updatedAt: new Date() }
        }
      );
      
      await db.collection('serverCollectibles').updateOne(
        { _id: new ObjectId(collectibleId) },
        { $inc: { totalQuantity: quantity } }
      );
    } else {
      await db.collection(USER_COLLECTIBLE_ITEMS_COLLECTION).insertOne({
        userId: userId,
        itemId: new ObjectId(collectibleId),
        serverId: serverId,
        isServerItem: true,
        quantity,
        selectedForProfile: false,
        obtainedAt: new Date(),
        updatedAt: new Date()
      });
      
      await db.collection('serverCollectibles').updateOne(
        { _id: new ObjectId(collectibleId) },
        { $inc: { ownerCount: 1, totalQuantity: quantity } }
      );
    }
    
    return { 
      success: true, 
      message: `✅ Received ${quantity}x **${collectible.name}**!`,
      item: { ...collectible, id: collectible._id.toString(), isServerSpecific: true }
    };
  } catch (error) {
    console.error('[CollectibleItemsSystem] Error awarding server collectible:', error);
    return { success: false, message: '❌ Failed to award server collectible!' };
  }
}

module.exports = {
  initCollectibleItemsIndexes,
  createCollectibleItem,
  getCollectibleItem,
  getCollectibleItemByName,
  updateCollectibleItem,
  deleteCollectibleItem,
  listCollectibleItems,
  listAllCollectibleItems,
  recalculateItemValue,
  recalculateAllItemValues,
  awardCollectibleItem,
  removeCollectibleItem,
  getUserCollectibleItems,
  getAllUserCollectibleItems,
  getUserCollectibleItemByItemId,
  setProfileCollectibleItem,
  clearProfileCollectibleItem,
  getProfileCollectibleItem,
  sellCollectibleItem,
  submitCollectibleItem,
  getPendingCollectibleSubmissions,
  getCollectibleSubmission,
  approveCollectibleSubmission,
  rejectCollectibleSubmission,
  getDroppableCollectibleItems,
  getCrateCollectibleItems,
  tryDropCollectibleFromCrate,
  getRarityTier,
  isCollectibleItemAvailable,
  formatCollectibleItemAvailability,
  displayCollectibleItemsList,
  displayUserCollectibleItems,
  handleCollectibleItemsButton,
  startCollectibleItemSubmission,
  handleCollectibleSubmissionStep,
  hasActiveCollectibleSubmissionSession,
  displayPendingCollectibleSubmissions,
  giveCollectibleItem,
  takeCollectibleItem,
  setItemGlobal,
  toggleItemTrait,
  setItemProbability,
  setItemAvailability,
  getServerSpecificCollectiblesFromDB,
  getServerCollectibleByName,
  getAllCollectiblesForServer,
  getDroppableServerCollectibles,
  getCrateServerCollectibles,
  awardServerCollectible,
  seedDefaultCollectibles,
  RARITY_CONFIG,
  VALID_CRATE_TYPES,
  ITEMS_PER_PAGE
};
