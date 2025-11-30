const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { getUSTBalance, removeUST } = require('./ustSystem.js');
const characterManager = require('./characterManager.js');
const fs = require('fs');
const path = require('path');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
const COSMETICS_FILE = path.join(__dirname, 'ust_cosmetics_catalog.json');
let mongoManager = null;

if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const RARITY_COSTS = {
  common: 10,
  rare: 25,
  'ultra rare': 50,
  epic: 100,
  legendary: 200
};

const RARITY_COLORS = {
  common: '#95A5A6',
  rare: '#3498DB',
  'ultra rare': '#9B59B6',
  epic: '#E74C3C',
  legendary: '#F39C12'
};

const RARITY_EMOJIS = {
  common: '⚪',
  rare: '🔵',
  'ultra rare': '🟣',
  epic: '🔴',
  legendary: '🟡'
};

let SKIN_CATALOG = {};
let PFP_CATALOG = {};
let catalogCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000;

function isCacheValid() {
  return catalogCache !== null && cacheTimestamp !== null && (Date.now() - cacheTimestamp < CACHE_TTL);
}

function invalidateCache() {
  catalogCache = null;
  cacheTimestamp = null;
}

function getEmptyCatalog() {
  return {
    skins: {
      common: [],
      rare: [],
      'ultra rare': [],
      epic: [],
      legendary: []
    },
    pfps: {
      common: [],
      rare: [],
      'ultra rare': [],
      epic: [],
      legendary: []
    }
  };
}

async function loadCosmeticsCatalog() {
  if (isCacheValid()) {
    SKIN_CATALOG = catalogCache.skins;
    PFP_CATALOG = catalogCache.pfps;
    return;
  }

  let catalog = getEmptyCatalog();
  
  if (USE_MONGODB && mongoManager) {
    try {
      const collection = await mongoManager.getCollection('cosmetics');
      const cosmeticsDoc = await collection.findOne({ _id: 'ust_catalog' });
      if (cosmeticsDoc) {
        catalog.skins = cosmeticsDoc.skins || getEmptyCatalog().skins;
        catalog.pfps = cosmeticsDoc.pfps || getEmptyCatalog().pfps;
      }
      console.log('✅ Loaded UST cosmetics catalog from MongoDB');
    } catch (error) {
      console.error('Error loading cosmetics catalog from MongoDB:', error);
    }
  } else {
    try {
      if (fs.existsSync(COSMETICS_FILE)) {
        const rawData = fs.readFileSync(COSMETICS_FILE, 'utf8');
        const savedCatalog = JSON.parse(rawData);
        catalog.skins = savedCatalog.skins || getEmptyCatalog().skins;
        catalog.pfps = savedCatalog.pfps || getEmptyCatalog().pfps;
        console.log('✅ Loaded UST cosmetics catalog from file');
      } else {
        console.log('✅ Created new empty UST cosmetics catalog');
      }
    } catch (error) {
      console.error('Error loading cosmetics catalog from file:', error);
    }
  }

  SKIN_CATALOG = catalog.skins;
  PFP_CATALOG = catalog.pfps;
  catalogCache = catalog;
  cacheTimestamp = Date.now();
}

async function saveCosmeticsCatalog() {
  invalidateCache();
  
  if (USE_MONGODB && mongoManager) {
    try {
      const collection = await mongoManager.getCollection('cosmetics');
      await collection.updateOne(
        { _id: 'ust_catalog' },
        { 
          $set: { 
            skins: SKIN_CATALOG, 
            pfps: PFP_CATALOG,
            updatedAt: new Date() 
          } 
        },
        { upsert: true }
      );
      console.log('✅ Saved UST cosmetics catalog to MongoDB');
    } catch (error) {
      console.error('Error saving cosmetics catalog to MongoDB:', error);
    }
  } else {
    try {
      const catalog = {
        skins: SKIN_CATALOG,
        pfps: PFP_CATALOG
      };
      fs.writeFileSync(COSMETICS_FILE, JSON.stringify(catalog, null, 2));
      console.log('✅ Saved UST cosmetics catalog to file');
    } catch (error) {
      console.error('Error saving cosmetics catalog to file:', error);
    }
  }
}

function initializeSkinCatalog() {
  if (!SKIN_CATALOG || Object.keys(SKIN_CATALOG).length === 0) {
    SKIN_CATALOG = {
      common: [],
      rare: [],
      'ultra rare': [],
      epic: [],
      legendary: []
    };
  }
}

async function addSkinToCatalog(characterName, skinName, rarity, url, customCost = null) {
  await loadCosmeticsCatalog();
  initializeSkinCatalog();
  
  const validRarities = ['common', 'rare', 'ultra rare', 'epic', 'legendary'];
  if (!validRarities.includes(rarity.toLowerCase())) {
    return {
      success: false,
      message: '❌ Invalid rarity! Use: common, rare, ultra rare, epic, or legendary'
    };
  }
  
  const rarityKey = rarity.toLowerCase();
  
  if (!SKIN_CATALOG[rarityKey]) {
    SKIN_CATALOG[rarityKey] = [];
  }
  
  const cost = customCost !== null ? customCost : RARITY_COSTS[rarityKey];
  
  SKIN_CATALOG[rarityKey].push({
    id: `skin_${characterName.toLowerCase()}_${skinName.toLowerCase()}_${Date.now()}`,
    name: skinName,
    character: characterName,
    url: url,
    cost: cost,
    exclusive: false
  });
  
  await saveCosmeticsCatalog();
  
  return {
    success: true,
    message: `✅ Added **${skinName}** skin for ${characterName} to the UST shop!\n${RARITY_EMOJIS[rarityKey]} Rarity: ${rarity}\n💰 Cost: ${cost} UST`,
    skinId: SKIN_CATALOG[rarityKey][SKIN_CATALOG[rarityKey].length - 1].id
  };
}

async function addPfpToCatalog(pfpName, rarity, url, customCost = null) {
  await loadCosmeticsCatalog();
  
  const validRarities = ['common', 'rare', 'ultra rare', 'epic', 'legendary'];
  if (!validRarities.includes(rarity.toLowerCase())) {
    return {
      success: false,
      message: '❌ Invalid rarity! Use: common, rare, ultra rare, epic, or legendary'
    };
  }
  
  const rarityKey = rarity.toLowerCase();
  
  if (!PFP_CATALOG[rarityKey]) {
    PFP_CATALOG[rarityKey] = [];
  }
  
  const cost = customCost !== null ? customCost : RARITY_COSTS[rarityKey];
  
  PFP_CATALOG[rarityKey].push({
    id: `pfp_${pfpName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    name: pfpName,
    url: url,
    cost: cost,
    exclusive: false
  });
  
  await saveCosmeticsCatalog();
  
  return {
    success: true,
    message: `✅ Added **${pfpName}** profile picture to the UST shop!\n${RARITY_EMOJIS[rarityKey]} Rarity: ${rarity}\n💰 Cost: ${cost} UST`,
    pfpId: PFP_CATALOG[rarityKey][PFP_CATALOG[rarityKey].length - 1].id
  };
}

async function getAvailableSkinsForUser(userData) {
  await loadCosmeticsCatalog();
  initializeSkinCatalog();
  
  const ownedCharacterNames = userData.characters.map(c => c.name);
  const allAvailableSkins = [];
  
  for (const rarity in SKIN_CATALOG) {
    const skinsInRarity = SKIN_CATALOG[rarity].filter(skin => 
      ownedCharacterNames.includes(skin.character) && !skin.exclusive
    );
    
    for (const skin of skinsInRarity) {
      const character = userData.characters.find(c => c.name === skin.character);
      if (!character.ownedSkins || !character.ownedSkins.includes(skin.name)) {
        allAvailableSkins.push({
          ...skin,
          rarity: rarity
        });
      }
    }
  }
  
  return allAvailableSkins;
}

async function getAvailablePfpsForUser(userData) {
  await loadCosmeticsCatalog();
  
  const ownedPfps = userData.pfp?.ownedPfps || [];
  const allAvailablePfps = [];
  
  for (const rarity in PFP_CATALOG) {
    const pfpsInRarity = PFP_CATALOG[rarity].filter(pfp => 
      !ownedPfps.includes(pfp.id) && !pfp.exclusive
    );
    
    for (const pfp of pfpsInRarity) {
      allAvailablePfps.push({
        ...pfp,
        rarity: rarity
      });
    }
  }
  
  return allAvailablePfps;
}

async function purchaseSkin(data, userId, skinId) {
  await loadCosmeticsCatalog();
  
  const userData = data.users[userId];
  if (!userData) {
    return {
      success: false,
      message: '❌ User not found!'
    };
  }
  
  let foundSkin = null;
  let skinRarity = null;
  
  initializeSkinCatalog();
  
  for (const rarity in SKIN_CATALOG) {
    const skin = SKIN_CATALOG[rarity].find(s => s.id === skinId);
    if (skin) {
      foundSkin = skin;
      skinRarity = rarity;
      break;
    }
  }
  
  if (!foundSkin) {
    return {
      success: false,
      message: '❌ Skin not found in catalog!'
    };
  }
  
  if (foundSkin.exclusive) {
    return {
      success: false,
      message: '❌ This skin is exclusive and cannot be purchased!'
    };
  }
  
  const userCharacter = userData.characters.find(c => c.name === foundSkin.character);
  if (!userCharacter) {
    return {
      success: false,
      message: `❌ You don't own ${foundSkin.character}!`
    };
  }
  
  if (userCharacter.ownedSkins.includes(foundSkin.name)) {
    return {
      success: false,
      message: '❌ You already own this skin!'
    };
  }
  
  const cost = foundSkin.cost;
  const userUST = getUSTBalance(data, userId);
  
  if (userUST < cost) {
    return {
      success: false,
      message: `❌ Not enough UST! You have ${userUST} UST but need ${cost} UST.`
    };
  }
  
  const removeResult = await removeUST(data, userId, cost, `Purchased ${foundSkin.name} skin`);
  if (!removeResult.success) {
    return removeResult;
  }
  
  userCharacter.ownedSkins.push(foundSkin.name);
  await saveDataImmediate(data);
  
  return {
    success: true,
    message: `✅ Successfully purchased **${foundSkin.name}** skin for ${foundSkin.character}!\n${RARITY_EMOJIS[skinRarity]} Rarity: ${skinRarity}\nCost: ${cost} UST\nRemaining UST: ${removeResult.newBalance}`,
    skin: foundSkin,
    character: userCharacter
  };
}

async function purchasePfp(data, userId, pfpId) {
  await loadCosmeticsCatalog();
  
  const userData = data.users[userId];
  if (!userData) {
    return {
      success: false,
      message: '❌ User not found!'
    };
  }
  
  if (!userData.pfp) {
    userData.pfp = {
      ownedPfps: [],
      equippedPfp: null
    };
  }
  
  let foundPfp = null;
  let pfpRarity = null;
  
  for (const rarity in PFP_CATALOG) {
    const pfp = PFP_CATALOG[rarity].find(p => p.id === pfpId);
    if (pfp) {
      foundPfp = pfp;
      pfpRarity = rarity;
      break;
    }
  }
  
  if (!foundPfp) {
    return {
      success: false,
      message: '❌ Profile picture not found in catalog!'
    };
  }
  
  if (userData.pfp.ownedPfps.some(p => p.id === foundPfp.id)) {
    return {
      success: false,
      message: '❌ You already own this profile picture!'
    };
  }
  
  const cost = foundPfp.cost;
  const userUST = getUSTBalance(data, userId);
  
  if (userUST < cost) {
    return {
      success: false,
      message: `❌ Not enough UST! You have ${userUST} UST but need ${cost} UST.`
    };
  }
  
  const removeResult = await removeUST(data, userId, cost, `Purchased ${foundPfp.name} profile picture`);
  if (!removeResult.success) {
    return removeResult;
  }
  
  const newPfp = {
    id: foundPfp.id,
    name: foundPfp.name,
    url: foundPfp.url,
    cost: foundPfp.cost,
    rarity: pfpRarity,
    addedAt: Date.now()
  };
  userData.pfp.ownedPfps.push(newPfp);
  await saveDataImmediate(data);
  
  return {
    success: true,
    message: `✅ Successfully purchased **${foundPfp.name}** profile picture!\n${RARITY_EMOJIS[pfpRarity]} Rarity: ${pfpRarity}\nCost: ${cost} UST\nRemaining UST: ${removeResult.newBalance}`,
    pfp: foundPfp
  };
}

async function formatShopCatalog(userData, userId, type = 'skins') {
  const userUST = getUSTBalance({ users: { [userId]: userData } }, userId) || 0;
  
  if (type === 'skins') {
    const availableSkins = await getAvailableSkinsForUser(userData);
    
    if (availableSkins.length === 0) {
      return {
        embed: new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🎨 Skins Shop')
          .setDescription('**No skins available!**\n\nYou either:\n• Own all available skins for your characters\n• Have no skins in the catalog for your characters yet\n\nCheck back later for new additions!')
          .addFields({ name: '💼 Your UST', value: `${userUST} UST`, inline: false }),
        items: []
      };
    }
    
    const groupedByRarity = {};
    for (const skin of availableSkins) {
      if (!groupedByRarity[skin.rarity]) {
        groupedByRarity[skin.rarity] = [];
      }
      groupedByRarity[skin.rarity].push(skin);
    }
    
    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🎨 Skins Shop')
      .setDescription(`Purchase exclusive character skins with UST!\n\n**Your UST:** ${userUST} UST`)
      .setFooter({ text: 'Skins are filtered to show only your owned characters' });
    
    const rarityOrder = ['legendary', 'epic', 'ultra rare', 'rare', 'common'];
    for (const rarity of rarityOrder) {
      if (groupedByRarity[rarity]) {
        const skinsList = groupedByRarity[rarity]
          .map(s => `• **${s.name}** (${s.character}) - ${s.cost} UST`)
          .join('\n');
        embed.addFields({ 
          name: `${RARITY_EMOJIS[rarity]} ${rarity.toUpperCase()}`, 
          value: skinsList, 
          inline: false 
        });
      }
    }
    
    return { embed, items: availableSkins };
  } else {
    const availablePfps = await getAvailablePfpsForUser(userData);
    
    if (availablePfps.length === 0) {
      return {
        embed: new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🖼️ Profile Pictures Shop')
          .setDescription('**No profile pictures available!**\n\nYou own all available profile pictures!\n\nCheck back later for new additions!')
          .addFields({ name: '💼 Your UST', value: `${userUST} UST`, inline: false }),
        items: []
      };
    }
    
    const groupedByRarity = {};
    for (const pfp of availablePfps) {
      if (!groupedByRarity[pfp.rarity]) {
        groupedByRarity[pfp.rarity] = [];
      }
      groupedByRarity[pfp.rarity].push(pfp);
    }
    
    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🖼️ Profile Pictures Shop')
      .setDescription(`Purchase exclusive profile pictures with UST!\n\n**Your UST:** ${userUST} UST`)
      .setFooter({ text: 'Customize your profile with unique pictures!' });
    
    const rarityOrder = ['legendary', 'epic', 'ultra rare', 'rare', 'common'];
    for (const rarity of rarityOrder) {
      if (groupedByRarity[rarity]) {
        const pfpsList = groupedByRarity[rarity]
          .map(p => `• **${p.name}** - ${p.cost} UST`)
          .join('\n');
        embed.addFields({ 
          name: `${RARITY_EMOJIS[rarity]} ${rarity.toUpperCase()}`, 
          value: pfpsList, 
          inline: false 
        });
      }
    }
    
    return { embed, items: availablePfps };
  }
}

async function openUSTShop(message, data) {
  const userId = message.author.id;
  const userData = data.users[userId];
  
  if (!userData) {
    await message.reply('❌ You need to use `!start` first!');
    return;
  }
  
  await loadCosmeticsCatalog();
  
  const mainEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🌟 Universal Skin Token (UST) Shop')
    .setDescription(`Welcome to the UST Shop! Purchase exclusive skins and profile pictures.\n\n**Your UST Balance:** ${getUSTBalance(data, userId) || 0} UST\n\nSelect a category below to browse items!`)
    .addFields(
      { name: '🎨 Skins', value: 'Exclusive character skins for your collection', inline: true },
      { name: '🖼️ Profile Pictures', value: 'Custom profile pictures', inline: true }
    )
    .setFooter({ text: 'Earn UST by placing top 3 in Clan Wars!' });
  
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId(`ust_category_${userId}`)
    .setPlaceholder('Select a category')
    .addOptions([
      {
        label: '🎨 Skins Shop',
        description: 'Browse character skins',
        value: 'skins'
      },
      {
        label: '🖼️ Profile Pictures Shop',
        description: 'Browse profile pictures',
        value: 'pfps'
      }
    ]);
  
  const closeButton = new ButtonBuilder()
    .setCustomId(`ust_close_${userId}`)
    .setLabel('Close')
    .setStyle(ButtonStyle.Danger);
  
  const row1 = new ActionRowBuilder().addComponents(categorySelect);
  const row2 = new ActionRowBuilder().addComponents(closeButton);
  
  const shopMsg = await message.reply({ 
    embeds: [mainEmbed], 
    components: [row1, row2] 
  });
  
  const filter = (interaction) => interaction.user.id === userId;
  const collector = shopMsg.createMessageComponentCollector({ filter, time: 300000 });
  
  collector.on('collect', async (interaction) => {
    try {
      if (interaction.customId === `ust_close_${userId}`) {
        await interaction.update({ 
          embeds: [new EmbedBuilder()
            .setColor('#808080')
            .setTitle('🌟 UST Shop Closed')
            .setDescription('Thanks for visiting! Come back anytime!')],
          components: []
        });
        collector.stop();
        return;
      }
      
      if (interaction.customId === `ust_category_${userId}`) {
        const category = interaction.values[0];
        const catalogData = await formatShopCatalog(userData, userId, category);
        
        if (catalogData.items.length === 0) {
          await interaction.update({ embeds: [catalogData.embed], components: [row2] });
          return;
        }
        
        const itemSelect = new StringSelectMenuBuilder()
          .setCustomId(`ust_select_${category}_${userId}`)
          .setPlaceholder(`Select ${category === 'skins' ? 'a skin' : 'a profile picture'} to preview`)
          .addOptions(catalogData.items.slice(0, 25).map(item => ({
            label: category === 'skins' ? `${item.name} (${item.character})` : item.name,
            description: `${RARITY_EMOJIS[item.rarity]} ${item.rarity} - ${item.cost} UST`,
            value: item.id
          })));
        
        const backButton = new ButtonBuilder()
          .setCustomId(`ust_back_${userId}`)
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary);
        
        const newRow1 = new ActionRowBuilder().addComponents(itemSelect);
        const newRow2 = new ActionRowBuilder().addComponents(backButton, closeButton);
        
        await interaction.update({ embeds: [catalogData.embed], components: [newRow1, newRow2] });
        return;
      }
      
      if (interaction.customId.startsWith(`ust_select_`)) {
        await loadCosmeticsCatalog();
        
        const itemId = interaction.values[0];
        const category = interaction.customId.includes('skins') ? 'skins' : 'pfps';
        
        let foundItem = null;
        let itemRarity = null;
        
        if (category === 'skins') {
          for (const rarity in SKIN_CATALOG) {
            const item = SKIN_CATALOG[rarity].find(s => s.id === itemId);
            if (item) {
              foundItem = item;
              itemRarity = rarity;
              break;
            }
          }
        } else {
          for (const rarity in PFP_CATALOG) {
            const item = PFP_CATALOG[rarity].find(p => p.id === itemId);
            if (item) {
              foundItem = item;
              itemRarity = rarity;
              break;
            }
          }
        }
        
        if (!foundItem) {
          await interaction.reply({ content: '❌ Item not found!', flags: [MessageFlags.Ephemeral] });
          return;
        }
        
        const userUST = getUSTBalance(data, userId);
        const canAfford = userUST >= foundItem.cost;
        
        const previewEmbed = new EmbedBuilder()
          .setColor(RARITY_COLORS[itemRarity] || '#9B59B6')
          .setTitle(`${category === 'skins' ? '🎨' : '🖼️'} ${foundItem.name}`)
          .setDescription(
            `${category === 'skins' ? `**Character:** ${foundItem.character}\n` : ''}` +
            `**Rarity:** ${RARITY_EMOJIS[itemRarity]} ${itemRarity}\n` +
            `**Cost:** ${foundItem.cost} UST\n` +
            `**Your UST:** ${userUST} UST\n\n` +
            `${canAfford ? '✅ You can afford this!' : '❌ Not enough UST!'}`
          )
          .setImage(foundItem.url)
          .setFooter({ text: category === 'skins' ? 'Click "Purchase" to buy this skin' : 'Click "Purchase" to buy this profile picture' });
        
        const purchaseButton = new ButtonBuilder()
          .setCustomId(`ust_confirm::${category}::${itemId}::${userId}`)
          .setLabel(`Purchase for ${foundItem.cost} UST`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!canAfford);
        
        const backButton = new ButtonBuilder()
          .setCustomId(`ust_backto::${category}::${userId}`)
          .setLabel('Back to Shop')
          .setStyle(ButtonStyle.Secondary);
        
        const previewRow = new ActionRowBuilder().addComponents(purchaseButton, backButton, closeButton);
        
        await interaction.update({ embeds: [previewEmbed], components: [previewRow] });
        return;
      }
      
      if (interaction.customId.startsWith(`ust_confirm::`)) {
        await interaction.deferUpdate();
        
        const parts = interaction.customId.split('::');
        const category = parts[1];
        const itemId = parts[2];
        
        let purchaseResult;
        if (category === 'skins') {
          purchaseResult = await purchaseSkin(data, userId, itemId);
        } else {
          purchaseResult = await purchasePfp(data, userId, itemId);
        }
        
        if (purchaseResult.success) {
          const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Purchase Successful!')
            .setDescription(purchaseResult.message)
            .setFooter({ text: 'Use !skins or !mypfps to see your new items!' });
          
          await interaction.editReply({ embeds: [successEmbed], components: [row2] });
        } else {
          const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Purchase Failed')
            .setDescription(purchaseResult.message);
          
          await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] });
        }
        return;
      }
      
      if (interaction.customId.startsWith(`ust_backto::`)) {
        const category = interaction.customId.split('::')[1];
        const catalogData = await formatShopCatalog(userData, userId, category);
        
        const itemSelect = new StringSelectMenuBuilder()
          .setCustomId(`ust_select_${category}_${userId}`)
          .setPlaceholder(`Select ${category === 'skins' ? 'a skin' : 'a profile picture'} to preview`)
          .addOptions(catalogData.items.slice(0, 25).map(item => ({
            label: category === 'skins' ? `${item.name} (${item.character})` : item.name,
            description: `${RARITY_EMOJIS[item.rarity]} ${item.rarity} - ${item.cost} UST`,
            value: item.id
          })));
        
        const backButton = new ButtonBuilder()
          .setCustomId(`ust_back_${userId}`)
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary);
        
        const newRow1 = new ActionRowBuilder().addComponents(itemSelect);
        const newRow2 = new ActionRowBuilder().addComponents(backButton, closeButton);
        
        await interaction.update({ embeds: [catalogData.embed], components: [newRow1, newRow2] });
        return;
      }
      
      if (interaction.customId === `ust_back_${userId}`) {
        await interaction.update({ embeds: [mainEmbed], components: [row1, row2] });
        return;
      }
    } catch (error) {
      console.error('UST Shop interaction error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred. Please try again.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
      }
    }
  });
  
  collector.on('end', () => {
    shopMsg.edit({ components: [] }).catch(() => {});
  });
}

async function getUSTSkinUrl(characterName, skinName) {
  await loadCosmeticsCatalog();
  
  for (const rarity in SKIN_CATALOG) {
    const foundSkin = SKIN_CATALOG[rarity].find(s => 
      s.character.toLowerCase() === characterName.toLowerCase() && 
      s.name.toLowerCase() === skinName.toLowerCase()
    );
    if (foundSkin && foundSkin.url) {
      return foundSkin.url;
    }
  }
  return null;
}

async function deleteUSTSkin(characterName, skinName) {
  await loadCosmeticsCatalog();
  
  for (const rarity in SKIN_CATALOG) {
    const index = SKIN_CATALOG[rarity].findIndex(s => 
      s.character.toLowerCase() === characterName.toLowerCase() && 
      s.name.toLowerCase() === skinName.toLowerCase()
    );
    if (index !== -1) {
      SKIN_CATALOG[rarity].splice(index, 1);
      await saveCosmeticsCatalog();
      return true;
    }
  }
  return false;
}

async function updateUSTSkinUrl(characterName, skinName, newUrl) {
  await loadCosmeticsCatalog();
  
  for (const rarity in SKIN_CATALOG) {
    const skin = SKIN_CATALOG[rarity].find(s => 
      s.character.toLowerCase() === characterName.toLowerCase() && 
      s.name.toLowerCase() === skinName.toLowerCase()
    );
    if (skin) {
      skin.url = newUrl;
      await saveCosmeticsCatalog();
      return true;
    }
  }
  return false;
}

module.exports = {
  RARITY_COSTS,
  RARITY_COLORS,
  RARITY_EMOJIS,
  loadCosmeticsCatalog,
  saveCosmeticsCatalog,
  addSkinToCatalog,
  addPfpToCatalog,
  getAvailableSkinsForUser,
  getAvailablePfpsForUser,
  purchaseSkin,
  purchasePfp,
  formatShopCatalog,
  openUSTShop,
  getUSTSkinUrl,
  deleteUSTSkin,
  updateUSTSkinUrl
};
