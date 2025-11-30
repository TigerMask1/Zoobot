const { openCrate, CRATE_TYPES } = require('./crateSystem.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const activeSessions = new Map();

const DEFAULT_CHEST_GIFS = {
  bronze: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
  silver: 'https://media.giphy.com/media/l0HlMURXNRraOL4nC/giphy.gif',
  gold: 'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.gif',
  emerald: 'https://media.giphy.com/media/26BRzozg4TCBXv6QU/giphy.gif',
  legendary: 'https://media.giphy.com/media/3ohzdKZWu9beKRemJi/giphy.gif',
  tyrant: 'https://media.giphy.com/media/3o6fJ1BM7R2EBRDnxK/giphy.gif'
};

const DEFAULT_CHEST_COLORS = {
  bronze: 0x8B4513,
  silver: 0xC0C0C0,
  gold: 0xFFD700,
  emerald: 0x50C878,
  legendary: 0x9B59B6,
  tyrant: 0xFF0000
};

// In-memory cache for JSON mode
const chestVisualsCache = {};

async function initializeChestVisuals() {
  if (!USE_MONGODB) {
    // In JSON mode, just use defaults
    for (const [crateType, data] of Object.entries(CRATE_TYPES)) {
      chestVisualsCache[crateType] = {
        crateType: crateType,
        displayName: crateType.charAt(0).toUpperCase() + crateType.slice(1),
        readyGifUrl: DEFAULT_CHEST_GIFS[crateType] || DEFAULT_CHEST_GIFS.bronze,
        embedColor: DEFAULT_CHEST_COLORS[crateType] || DEFAULT_CHEST_COLORS.bronze
      };
    }
    console.log('✅ Initialized chest visuals for all crate types (JSON mode)');
    return;
  }

  try {
    const collection = await mongoManager.getCollection('crate_visuals');
    
    const existing = await collection.find({}).toArray();
    const existingTypes = new Set(existing.map(e => e.crateType));
    
    for (const [crateType, data] of Object.entries(CRATE_TYPES)) {
      if (!existingTypes.has(crateType)) {
        await collection.insertOne({
          crateType: crateType,
          displayName: crateType.charAt(0).toUpperCase() + crateType.slice(1),
          readyGifUrl: DEFAULT_CHEST_GIFS[crateType] || DEFAULT_CHEST_GIFS.bronze,
          embedColor: DEFAULT_CHEST_COLORS[crateType] || DEFAULT_CHEST_COLORS.bronze,
          createdAt: new Date()
        });
      }
    }
    
    console.log('✅ Initialized chest visuals for all crate types');
  } catch (error) {
    console.error('❌ Error initializing chest visuals:', error);
  }
}

async function getChestVisual(crateType) {
  if (!USE_MONGODB) {
    // Return from cache or defaults in JSON mode
    return chestVisualsCache[crateType] || {
      crateType,
      displayName: crateType.charAt(0).toUpperCase() + crateType.slice(1),
      readyGifUrl: DEFAULT_CHEST_GIFS[crateType] || DEFAULT_CHEST_GIFS.bronze,
      embedColor: DEFAULT_CHEST_COLORS[crateType] || DEFAULT_CHEST_COLORS.bronze
    };
  }

  try {
    const collection = await mongoManager.getCollection('crate_visuals');
    const visual = await collection.findOne({ crateType });
    
    if (!visual) {
      return {
        crateType,
        displayName: crateType.charAt(0).toUpperCase() + crateType.slice(1),
        readyGifUrl: DEFAULT_CHEST_GIFS[crateType] || DEFAULT_CHEST_GIFS.bronze,
        embedColor: DEFAULT_CHEST_COLORS[crateType] || DEFAULT_CHEST_COLORS.bronze
      };
    }
    
    return visual;
  } catch (error) {
    console.error('Error getting chest visual:', error);
    return {
      crateType,
      displayName: crateType,
      readyGifUrl: DEFAULT_CHEST_GIFS.bronze,
      embedColor: DEFAULT_CHEST_COLORS.bronze
    };
  }
}

async function setChestGif(crateType, gifUrl, adminUserId) {
  if (!USE_MONGODB) {
    return { success: false, message: '❌ Custom chest GIFs require MongoDB mode!' };
  }

  try {
    if (!CRATE_TYPES[crateType]) {
      return { success: false, message: `Invalid crate type! Available: ${Object.keys(CRATE_TYPES).join(', ')}` };
    }
    
    const urlPattern = /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i;
    if (!urlPattern.test(gifUrl)) {
      return { success: false, message: 'Invalid image URL! Must be a direct link to an image file (gif, png, jpg, webp)' };
    }
    
    const collection = await mongoManager.getCollection('crate_visuals');
    
    await collection.updateOne(
      { crateType },
      {
        $set: {
          readyGifUrl: gifUrl,
          updatedAt: new Date(),
          updatedBy: adminUserId
        }
      },
      { upsert: true }
    );
    
    return {
      success: true,
      message: `✅ Updated ${crateType} chest opening GIF!`,
      gifUrl
    };
  } catch (error) {
    console.error('Error setting chest GIF:', error);
    return { success: false, message: '❌ Database error occurred!' };
  }
}

function startPickSession(userId, crateType) {
  const existingSession = activeSessions.get(userId);
  if (existingSession) {
    return {
      success: false,
      message: `You already have an active chest session! Use \`!opencrate\` within ${Math.ceil((existingSession.expiresAt - Date.now()) / 1000)} seconds or it will expire.`
    };
  }
  
  const now = Date.now();
  const expiresAt = now + (2 * 60 * 1000);
  
  activeSessions.set(userId, {
    crateType,
    expiresAt,
    createdAt: now
  });
  
  setTimeout(() => {
    const session = activeSessions.get(userId);
    if (session && session.createdAt === now) {
      activeSessions.delete(userId);
    }
  }, 2 * 60 * 1000);
  
  return { success: true };
}

function getActiveSession(userId) {
  const session = activeSessions.get(userId);
  
  if (!session) {
    return null;
  }
  
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(userId);
    return null;
  }
  
  return session;
}

function clearSession(userId) {
  activeSessions.delete(userId);
}

function getActiveSessionsCount() {
  return activeSessions.size;
}

module.exports = {
  initializeChestVisuals,
  getChestVisual,
  setChestGif,
  startPickSession,
  getActiveSession,
  clearSession,
  getActiveSessionsCount,
  DEFAULT_CHEST_GIFS
};
