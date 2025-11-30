const CHARACTERS = require('./characters.js');

const USE_MONGODB = process.env.USE_MONGODB === 'true';
let mongoManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
}

const emojiCache = new Map();

async function initializeEmojiAssets() {
  if (!USE_MONGODB) {
    // In JSON mode, just initialize cache from characters.js
    for (const char of CHARACTERS) {
      const slug = char.name.toLowerCase();
      emojiCache.set(slug, {
        characterSlug: slug,
        characterName: char.name,
        emojiId: null,
        unicodeEmoji: char.emoji,
        sourceType: 'unicode'
      });
    }
    console.log(`✅ Initialized emoji assets for ${CHARACTERS.length} characters (JSON mode)`);
    return;
  }

  try {
    const collection = await mongoManager.getCollection('emoji_assets');
    
    const existing = await collection.find({}).toArray();
    const existingMap = new Map(existing.map(e => [e.characterSlug, e]));
    
    for (const char of CHARACTERS) {
      const slug = char.name.toLowerCase();
      if (!existingMap.has(slug)) {
        const isCustom = char.emoji.startsWith('<:');
        let emojiId = null;
        
        if (isCustom) {
          const match = char.emoji.match(/<:.*?:(\d+)>/);
          if (match) emojiId = match[1];
        }
        
        await collection.insertOne({
          characterSlug: slug,
          characterName: char.name,
          emojiId: emojiId,
          unicodeEmoji: isCustom ? null : char.emoji,
          sourceType: isCustom ? 'discord' : 'unicode',
          uploadedAt: new Date()
        });
      }
    }
    
    const allEmojis = await collection.find({}).toArray();
    allEmojis.forEach(emoji => {
      emojiCache.set(emoji.characterSlug, emoji);
    });
    
    console.log(`✅ Initialized emoji assets for ${allEmojis.length} characters`);
  } catch (error) {
    console.error('❌ Error initializing emoji assets:', error);
  }
}

function getEmojiForCharacter(characterName) {
  const slug = characterName.toLowerCase();
  const cached = emojiCache.get(slug);
  
  if (!cached) {
    const char = CHARACTERS.find(c => c.name.toLowerCase() === slug);
    return char ? char.emoji : '❓';
  }
  
  if (cached.emojiId) {
    return `<:${cached.characterSlug}:${cached.emojiId}>`;
  }
  
  return cached.unicodeEmoji || '❓';
}

async function setCharacterEmoji(characterName, emojiIdOrUnicode) {
  if (!USE_MONGODB) {
    return { success: false, message: '❌ Custom emojis require MongoDB mode!' };
  }

  try {
    const slug = characterName.toLowerCase();
    const char = CHARACTERS.find(c => c.name.toLowerCase() === slug);
    
    if (!char) {
      return { success: false, message: `Character "${characterName}" not found!` };
    }
    
    const collection = await mongoManager.getCollection('emoji_assets');
    
    const isCustom = emojiIdOrUnicode.match(/^(\d+)$/) || emojiIdOrUnicode.startsWith('<:');
    let emojiId = null;
    let unicodeEmoji = null;
    
    if (isCustom) {
      const match = emojiIdOrUnicode.match(/(?:<:.*?:)?(\d+)>?/);
      emojiId = match ? match[1] : emojiIdOrUnicode;
    } else {
      unicodeEmoji = emojiIdOrUnicode;
    }
    
    await collection.updateOne(
      { characterSlug: slug },
      {
        $set: {
          emojiId: emojiId,
          unicodeEmoji: unicodeEmoji,
          sourceType: isCustom ? 'discord' : 'unicode',
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    emojiCache.set(slug, {
      characterSlug: slug,
      characterName: char.name,
      emojiId: emojiId,
      unicodeEmoji: unicodeEmoji,
      sourceType: isCustom ? 'discord' : 'unicode'
    });
    
    const displayEmoji = emojiId ? `<:${slug}:${emojiId}>` : unicodeEmoji;
    
    return {
      success: true,
      message: `✅ Updated emoji for ${char.name} to ${displayEmoji}`,
      emoji: displayEmoji
    };
  } catch (error) {
    console.error('Error setting character emoji:', error);
    return { success: false, message: '❌ Database error occurred!' };
  }
}

function applyCharacterEmoji(character) {
  if (character && character.name) {
    character.emoji = getEmojiForCharacter(character.name);
  }
  return character;
}

async function refreshAllCharacterEmojis(userData) {
  for (const userId in userData) {
    const user = userData[userId];
    if (user.characters && Array.isArray(user.characters)) {
      user.characters.forEach(char => applyCharacterEmoji(char));
    }
  }
}

async function getAllCharacterEmojis() {
  const emojis = {};
  CHARACTERS.forEach(char => {
    emojis[char.name] = getEmojiForCharacter(char.name);
  });
  return emojis;
}

module.exports = {
  initializeEmojiAssets,
  getEmojiForCharacter,
  setCharacterEmoji,
  getAllCharacterEmojis,
  applyCharacterEmoji,
  refreshAllCharacterEmojis
};
