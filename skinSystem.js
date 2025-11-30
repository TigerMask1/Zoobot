const fs = require('fs');
const path = require('path');

const SKINS_FILE = path.join(__dirname, 'skins.json');
const USE_MONGODB = process.env.USE_MONGODB === 'true';

let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

let skinsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000;

function isCacheValid() {
  return skinsCache !== null && cacheTimestamp !== null && (Date.now() - cacheTimestamp < CACHE_TTL);
}

function invalidateCache() {
  skinsCache = null;
  cacheTimestamp = null;
}

async function loadSkins() {
  if (isCacheValid()) {
    return skinsCache;
  }

  let skins = {};
  
  if (USE_MONGODB && mongoManager) {
    try {
      const collection = await mongoManager.getCollection('skins');
      const skinDoc = await collection.findOne({ _id: 'character_skins' });
      skins = skinDoc?.skins || {};
    } catch (error) {
      console.error('Error loading skins from MongoDB:', error);
      skins = {};
    }
  } else {
    try {
      if (fs.existsSync(SKINS_FILE)) {
        const rawData = fs.readFileSync(SKINS_FILE, 'utf8');
        skins = JSON.parse(rawData);
      }
    } catch (error) {
      console.error('Error loading skins from JSON:', error);
    }
  }

  skinsCache = skins;
  cacheTimestamp = Date.now();
  return skins;
}

async function saveSkins(skins) {
  invalidateCache();
  
  if (USE_MONGODB && mongoManager) {
    try {
      const collection = await mongoManager.getCollection('skins');
      await collection.updateOne(
        { _id: 'character_skins' },
        { $set: { skins, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving skins to MongoDB:', error);
    }
  } else {
    try {
      fs.writeFileSync(SKINS_FILE, JSON.stringify(skins, null, 2));
    } catch (error) {
      console.error('Error saving skins to JSON:', error);
    }
  }
}

async function getSkinUrl(characterName, skinName = 'default') {
  const skins = await loadSkins();
  if (skins[characterName] && skins[characterName][skinName]) {
    return skins[characterName][skinName];
  }
  
  try {
    const { getCustomCharacterSkin, isCustomCharacter } = require('./customCharacterManager.js');
    const isCustom = await isCustomCharacter(characterName);
    if (isCustom) {
      const customSkinUrl = await getCustomCharacterSkin(characterName, skinName);
      if (customSkinUrl) {
        return customSkinUrl;
      }
    }
  } catch (error) {
    console.error('Error checking custom character skin:', error);
  }
  
  if (skinName !== 'default') {
    try {
      const { getUSTSkinUrl } = require('./cosmeticsShopSystem.js');
      const ustSkinUrl = await getUSTSkinUrl(characterName, skinName);
      if (ustSkinUrl) {
        return ustSkinUrl;
      }
    } catch (error) {
      console.error('Error checking cosmetics catalog for skin:', error);
    }
  }
  
  return skins[characterName]?.default || null;
}

async function getAvailableSkins(characterName) {
  const skins = await loadSkins();
  if (skins[characterName]) {
    return Object.keys(skins[characterName]);
  }
  
  try {
    const { getCustomCharacterAvailableSkins, isCustomCharacter } = require('./customCharacterManager.js');
    const isCustom = await isCustomCharacter(characterName);
    if (isCustom) {
      return await getCustomCharacterAvailableSkins(characterName);
    }
  } catch (error) {
    console.error('Error getting custom character skins:', error);
  }
  
  return ['default'];
}

async function addSkinToCharacter(characterName, skinName, imageUrl) {
  const skins = await loadSkins();
  if (!skins[characterName]) {
    skins[characterName] = { default: 'https://picsum.photos/seed/' + characterName.toLowerCase() + '/400/400' };
  }
  skins[characterName][skinName] = imageUrl;
  await saveSkins(skins);
  return true;
}

async function removeSkinFromCharacter(characterName, skinName) {
  if (skinName === 'default') {
    return false;
  }
  const skins = await loadSkins();
  if (skins[characterName] && skins[characterName][skinName]) {
    delete skins[characterName][skinName];
    await saveSkins(skins);
    return true;
  }
  return false;
}

async function skinExists(characterName, skinName) {
  const skins = await loadSkins();
  return skins[characterName] && skins[characterName][skinName] !== undefined;
}

async function updateSkinImageUrl(characterName, skinName, newImageUrl) {
  const skins = await loadSkins();
  if (skins[characterName] && skins[characterName][skinName]) {
    skins[characterName][skinName] = newImageUrl;
    await saveSkins(skins);
    return true;
  }
  return false;
}

module.exports = {
  loadSkins,
  saveSkins,
  getSkinUrl,
  getAvailableSkins,
  addSkinToCharacter,
  removeSkinFromCharacter,
  skinExists,
  updateSkinImageUrl
};
