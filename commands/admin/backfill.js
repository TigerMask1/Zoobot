const { EmbedBuilder } = require('discord.js');
const { getCollection, getMongoDatabase, isMongoConnected } = require('../../mongoManager.js');
const { isSuperAdmin, isMainServer } = require('../../serverConfigManager.js');
const { BOT_CONFIG } = require('../../config.js');

const HARDCODED_CHARACTERS = require('../../characters.js');

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

const RARITY_CONFIG = {
  legendary: { emoji: '🌟', color: '#FFD700', dropChance: 0.5, baseValue: 500 },
  epic: { emoji: '💜', color: '#9B59B6', dropChance: 2, baseValue: 250 },
  'ultra rare': { emoji: '💎', color: '#00CED1', dropChance: 5, baseValue: 150 },
  rare: { emoji: '💙', color: '#3498DB', dropChance: 10, baseValue: 100 },
  uncommon: { emoji: '💚', color: '#2ECC71', dropChance: 20, baseValue: 50 },
  common: { emoji: '⚪', color: '#95A5A6', dropChance: 40, baseValue: 25 }
};

module.exports = {
  name: 'backfill',
  aliases: ['backfillmain', 'seedmain'],
  category: 'admin',
  description: 'Backfill main server with ZooBot original characters and default collectibles',
  usage: '!backfill [characters|collectibles|all]',
  superAdminOnly: true,
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    
    if (!isSuperAdmin(userId)) {
      return message.reply('❌ This command is for Super Admins only!');
    }
    
    if (!isMongoConnected()) {
      return message.reply('❌ MongoDB is not connected!');
    }
    
    const mainServerId = BOT_CONFIG.MAIN_SERVER_ID;
    const subcommand = args[0]?.toLowerCase() || 'all';
    
    const statusMsg = await message.reply('⏳ Starting backfill process...');
    
    try {
      let results = { characters: null, collectibles: null };
      
      if (subcommand === 'characters' || subcommand === 'all') {
        results.characters = await backfillCharacters(mainServerId);
      }
      
      if (subcommand === 'collectibles' || subcommand === 'all') {
        results.collectibles = await backfillCollectibles(mainServerId);
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Backfill Complete')
        .setDescription(`Backfill completed for main server (${mainServerId})`)
        .setTimestamp();
      
      if (results.characters) {
        embed.addFields({
          name: '🦁 Characters',
          value: `Added: ${results.characters.added}\nSkipped: ${results.characters.skipped}\nErrors: ${results.characters.errors}`,
          inline: true
        });
      }
      
      if (results.collectibles) {
        embed.addFields({
          name: '🎁 Collectibles',
          value: `Added: ${results.collectibles.added}\nSkipped: ${results.collectibles.skipped}\nErrors: ${results.collectibles.errors}`,
          inline: true
        });
      }
      
      await statusMsg.edit({ content: null, embeds: [embed] });
      
    } catch (error) {
      console.error('Backfill error:', error);
      await statusMsg.edit(`❌ Error during backfill: ${error.message}`);
    }
  }
};

async function backfillCharacters(serverId) {
  const collection = await getCollection('serverCharacters');
  const serverAddedCollection = await getCollection('serverAddedCharacters');
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const char of HARDCODED_CHARACTERS) {
    try {
      const existing = await collection.findOne({
        serverId,
        name: { $regex: new RegExp(`^${char.name}$`, 'i') }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      const existingAdded = await serverAddedCollection.findOne({
        serverId,
        characterName: { $regex: new RegExp(`^${char.name}$`, 'i') }
      });
      
      if (existingAdded) {
        skipped++;
        continue;
      }
      
      const crypto = require('crypto');
      const uniqueId = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      const newChar = {
        serverId,
        uniqueId,
        name: char.name,
        emoji: char.emoji,
        customEmojiId: char.customEmojiId || null,
        description: `${char.name} - A ZooBot original character`,
        imageUrl: null,
        rarity: 'common',
        obtainable: char.obtainable || 'crate',
        game: 'ZooBot',
        ability: {
          name: `${char.name}'s Power`,
          emoji: '⭐',
          description: `${char.name} gains a small damage bonus on all attacks.`,
          type: 'passive',
          effect: { flatDamageBonus: 5 }
        },
        specialMove: {
          name: `${char.name}'s Strike`,
          damage: 90
        },
        stats: {
          hp: 100,
          attack: 50,
          defense: 50,
          speed: 50,
          critChance: 0.1,
          dodgeChance: 0.05
        },
        dropSettings: {
          enabled: true,
          probability: 10
        },
        crateSettings: {
          enabled: true,
          probability: 10,
          crates: ['bronze', 'silver', 'gold']
        },
        status: 'active',
        createdBy: 'ZooBot',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await collection.insertOne(newChar);
      added++;
      
    } catch (error) {
      console.error(`Error adding character ${char.name}:`, error);
      errors++;
    }
  }
  
  return { added, skipped, errors };
}

async function backfillCollectibles(serverId) {
  const collection = await getCollection('serverCollectibles');
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const collectible of DEFAULT_COLLECTIBLES) {
    try {
      const existing = await collection.findOne({
        serverId,
        name: { $regex: new RegExp(`^${collectible.name}$`, 'i') }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      const crypto = require('crypto');
      const uniqueId = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      const rarity = collectible.rarity?.toLowerCase() || 'common';
      const rarityConfig = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
      
      const newCollectible = {
        serverId,
        uniqueId,
        name: collectible.name,
        description: collectible.description || '',
        imageUrl: null,
        emoji: collectible.emoji || rarityConfig.emoji,
        rarity: rarity,
        isGlobal: false,
        droppable: {
          enabled: true,
          probability: rarityConfig.dropChance
        },
        crateObtainable: collectible.crateObtainable || {
          enabled: true,
          probability: rarityConfig.dropChance,
          crates: ['bronze', 'silver', 'gold']
        },
        baseValue: collectible.baseValue || rarityConfig.baseValue,
        computedValue: collectible.baseValue || rarityConfig.baseValue,
        status: 'active',
        createdBy: 'ZooBot',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await collection.insertOne(newCollectible);
      added++;
      
    } catch (error) {
      console.error(`Error adding collectible ${collectible.name}:`, error);
      errors++;
    }
  }
  
  return { added, skipped, errors };
}
