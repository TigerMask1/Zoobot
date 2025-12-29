const fs = require('fs');
const path = require('path');
const { assignMovesToCharacter, calculateBaseHP } = require('./battleUtils.js');

const DATA_FILE = path.join(__dirname, 'data.json');
const USE_MONGODB = process.env.USE_MONGODB === 'true';

let mongoManager = null;
let emojiManager = null;
if (USE_MONGODB) {
  mongoManager = require('./mongoManager.js');
  emojiManager = require('./emojiAssetManager.js');
}

let saveQueue = [];
let saveTimeout = null;
const SAVE_BATCH_DELAY = 2000;

function generateST() {
  return parseFloat((Math.random() * 100).toFixed(2));
}

function backfillUserData(data) {
  let needsSave = false;
  
  Object.keys(data.users).forEach(userId => {
    const user = data.users[userId];
    
    if (user.pendingTokens === undefined) {
      user.pendingTokens = 0;
      needsSave = true;
    }
    
    if (user.shards === undefined) {
      user.shards = 0;
      needsSave = true;
    }
    
    if (user.stBoosters === undefined) {
      user.stBoosters = 0;
      needsSave = true;
    }
    
    if (user.trophies === undefined) {
      user.trophies = 200;
      needsSave = true;
    }
    
    if (user.ust === undefined) {
      user.ust = 0;
      needsSave = true;
    }
    
    if (user.messageCount === undefined) {
      user.messageCount = 0;
      needsSave = true;
    }
    
    if (user.lastDailyClaim === undefined) {
      user.lastDailyClaim = null;
      needsSave = true;
    }
    
    if (user.dailyStreak === undefined) {
      user.dailyStreak = 0;
      needsSave = true;
    }
    
    if (user.highestDailyStreak === undefined) {
      user.highestDailyStreak = 0;
      needsSave = true;
    }
    
    if (user.totalDailyClaims === undefined) {
      user.totalDailyClaims = 0;
      needsSave = true;
    }
    
    if (user.questProgress === undefined) {
      user.questProgress = {
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
      };
      needsSave = true;
    }
    
    if (user.newYearEvent === undefined) {
      user.newYearEvent = {
        points: 0,
        piecesUnlocked: [],
        battlesCompleted: 0,
        dropsCaught: 0,
        completed: false
      };
      needsSave = true;
    }
    
    if (user.completedQuests === undefined) {
      user.completedQuests = [];
      needsSave = true;
    }
    
    if (user.mailbox === undefined) {
      user.mailbox = [];
      needsSave = true;
    }
    
    if (user.bronzeCrates === undefined) {
      user.bronzeCrates = 0;
      needsSave = true;
    }
    
    if (user.silverCrates === undefined) {
      user.silverCrates = 0;
      needsSave = true;
    }
    
    if (user.goldCrates === undefined) {
      user.goldCrates = 0;
      needsSave = true;
    }
    
    if (user.emeraldCrates === undefined) {
      user.emeraldCrates = 0;
      needsSave = true;
    }
    
    if (user.legendaryCrates === undefined) {
      user.legendaryCrates = 0;
      needsSave = true;
    }
    
    if (user.tyrantCrates === undefined) {
      user.tyrantCrates = 0;
      needsSave = true;
    }
    
    if (user.tutorialStage === undefined) {
      user.tutorialStage = 'intro';
      needsSave = true;
    }
    
    if (user.tutorialCompleted === undefined) {
      user.tutorialCompleted = false;
      needsSave = true;
    }
    
    if (user.profileDisplayCharacter === undefined) {
      user.profileDisplayCharacter = null;
      needsSave = true;
    }
    
    if (user.seasonPass === undefined) {
      user.seasonPass = {};
      needsSave = true;
    }
    
    if (user.characters && Array.isArray(user.characters)) {
      user.characters.forEach(char => {
        if (char.st === undefined) {
          char.st = generateST();
          needsSave = true;
        }
        
        if (!char.moves) {
          char.moves = assignMovesToCharacter(char.name, char.st);
          needsSave = true;
        }
        
        if (!char.baseHp) {
          char.baseHp = calculateBaseHP(char.st);
          needsSave = true;
        }
        
        if (!char.currentSkin) {
          char.currentSkin = 'default';
          needsSave = true;
        }
        
        if (!char.ownedSkins) {
          char.ownedSkins = ['default'];
          needsSave = true;
        }
        
        if (emojiManager) {
          emojiManager.applyCharacterEmoji(char);
        }
      });
    }
  });
  
  if (!data.battleChannelId) {
    data.battleChannelId = data.battleChannel || null;
    delete data.battleChannel;
    needsSave = true;
  }
  
  if (!data.dropChannelId) {
    data.dropChannelId = data.dropChannel || null;
    delete data.dropChannel;
    needsSave = true;
  }
  
  if (!data.eventChannelId) {
    data.eventChannelId = null;
    needsSave = true;
  }
  
  delete data.currentDrop;
  
  return { data, needsSave };
}

async function loadData() {
  if (USE_MONGODB) {
    try {
      const data = await mongoManager.loadData();
      const { data: backfilledData, needsSave } = backfillUserData(data);
      
      if (!backfilledData.giveawayData) {
        backfilledData.giveawayData = {
          active: false,
          channelId: null,
          drawTime: '20:00',
          participants: [],
          lastDrawDate: null,
          prizeConfig: { coins: 5000, gems: 100, crateType: 'gold', crateCount: 3 },
          winnersHistory: []
        };
      }
      
      if (!backfilledData.lotteryData) {
        backfilledData.lotteryData = {
          active: false,
          channelId: null,
          drawTime: '21:00',
          entryFee: 100,
          maxTicketsPerPerson: 5,
          prizePool: 0,
          participants: [],
          lastDrawDate: null,
          winnersHistory: []
        };
      }
      
      if (!backfilledData.globalQA) {
        backfilledData.globalQA = [];
      }
      
      if (!backfilledData.globalQASubmissions) {
        backfilledData.globalQASubmissions = [];
      }
      
      if (needsSave || !data.giveawayData || !data.lotteryData || !data.globalQA || !data.globalQASubmissions) {
        await mongoManager.saveData(backfilledData);
        console.log('✅ Backfilled missing data in MongoDB: ST, moves, HP, pending tokens, shards, trophies, message tracking, daily rewards, quests, mailbox, crates, skins, giveaway, lottery, Q&A, and Q&A submissions');
      }
      
      return backfilledData;
    } catch (error) {
      console.error('Error loading from MongoDB:', error);
      return {
        users: {},
        dropChannelId: null,
        battleChannelId: null,
        eventChannelId: null
      };
    }
  } else {
    let data;
    
    try {
      if (fs.existsSync(DATA_FILE)) {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        data = JSON.parse(rawData);
      } else {
        data = {
          users: {},
          dropChannelId: null,
          battleChannelId: null,
          eventChannelId: null
        };
      }
    } catch (error) {
      console.error('Error loading JSON data:', error);
      data = {
        users: {},
        dropChannelId: null,
        battleChannelId: null,
        eventChannelId: null
      };
    }
    
    const { data: backfilledData, needsSave } = backfillUserData(data);
    
    if (!backfilledData.giveawayData) {
      backfilledData.giveawayData = {
        active: false,
        channelId: null,
        drawTime: '20:00',
        participants: [],
        lastDrawDate: null,
        prizeConfig: { coins: 5000, gems: 100, crateType: 'gold', crateCount: 3 },
        winnersHistory: []
      };
    }
    
    if (!backfilledData.lotteryData) {
      backfilledData.lotteryData = {
        active: false,
        channelId: null,
        drawTime: '21:00',
        entryFee: 100,
        maxTicketsPerPerson: 5,
        prizePool: 0,
        participants: [],
        lastDrawDate: null,
        winnersHistory: []
      };
    }
    
    if (!backfilledData.globalQA) {
      backfilledData.globalQA = [];
    }
    
    if (!backfilledData.globalQASubmissions) {
      backfilledData.globalQASubmissions = [];
    }
    
    if (needsSave || !data.giveawayData || !data.lotteryData || !data.globalQA || !data.globalQASubmissions) {
      saveData(backfilledData);
      console.log('✅ Backfilled missing data: ST, moves, HP, pending tokens, shards, trophies, message tracking, daily rewards, quests, mailbox, crates, skins, giveaway, lottery, Q&A, and Q&A submissions');
    }
    
    return backfilledData;
  }
}

function saveData(data) {
  if (USE_MONGODB) {
    saveQueue.push(data);
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      if (saveQueue.length > 0) {
        const dataToSave = saveQueue[saveQueue.length - 1];
        saveQueue = [];
        
        mongoManager.saveData(dataToSave).catch(error => {
          console.error('Error saving to MongoDB:', error);
        });
      }
    }, SAVE_BATCH_DELAY);
  } else {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving JSON data:', error);
    }
  }
}

function saveDataImmediate(data) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveQueue = [];
  
  if (USE_MONGODB) {
    return mongoManager.saveData(data);
  } else {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      return Promise.resolve(true);
    } catch (error) {
      console.error('Error saving JSON data:', error);
      return Promise.resolve(false);
    }
  }
}

async function deleteUser(userId) {
  if (USE_MONGODB) {
    return await mongoManager.deleteUser(userId);
  }
  return true;
}

module.exports = { loadData, saveData, saveDataImmediate, deleteUser };
