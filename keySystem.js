const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const characterManager = require('./characterManager.js');

function initializeKeys(userData) {
  if (!userData.characterKeys) {
    userData.characterKeys = {};
  }
  if (userData.cageKeys === undefined) {
    userData.cageKeys = 0;
  }
}

function addCharacterKey(userData, characterName, amount = 1) {
  initializeKeys(userData);
  
  if (!userData.characterKeys[characterName]) {
    userData.characterKeys[characterName] = 0;
  }
  
  userData.characterKeys[characterName] += amount;
  return userData.characterKeys[characterName];
}

function addCageKeys(userData, amount) {
  initializeKeys(userData);
  userData.cageKeys += amount;
  return userData.cageKeys;
}

function hasCharacter(userData, characterName) {
  return userData.characters.some(c => c.name === characterName);
}

function convertKeysToGems(userData, characterName) {
  initializeKeys(userData);
  
  const keys = userData.characterKeys[characterName] || 0;
  if (keys > 0) {
    userData.characterKeys[characterName] = 0;
    return keys;
  }
  return 0;
}

async function viewKeys(message, data, userId) {
  const userData = data.users[userId];
  
  if (!userData || !userData.started) {
    await message.reply('❌ You need to use `!start` first!');
    return;
  }
  
  initializeKeys(userData);
  
  const characterKeysList = [];
  for (const [charName, keyCount] of Object.entries(userData.characterKeys)) {
    if (keyCount > 0) {
      const char = characterManager.getCharacters().find(c => c.name === charName);
      const emoji = char ? char.emoji : '❓';
      const owned = hasCharacter(userData, charName);
      const status = owned ? '✅ Owned' : `${keyCount}/1000`;
      characterKeysList.push(`${emoji} **${charName}**: ${keyCount} keys ${owned ? '(Auto-converting to gems)' : `- ${status}`}`);
    }
  }
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🔑 Your Keys Collection')
    .setDescription(`**🎫 Cage Keys:** ${userData.cageKeys}\n*Collect 250 cage keys to open a random cage and get a random character!*\n\n**Character Keys:**\n${characterKeysList.length > 0 ? characterKeysList.join('\n') : '*No character keys yet!*'}\n\n*Collect 1000 keys of any character to unlock them!*\n*Keys for owned characters auto-convert to gems (1 key = 1 gem)*`)
    .addFields(
      { name: 'How to Get Keys', value: '🦁 **Raids**: 1 character key per raid (if you don\'t own the boss)\n🏆 **Events**: Top 3 get cage keys (5/3/1)' }
    )
    .setFooter({ text: 'Use !unlock <character> to unlock a character with 1000 keys | Use !cage to open random cage with 250 cage keys' });
  
  await message.reply({ embeds: [embed] });
}

async function unlockCharacter(message, data, userId, characterName) {
  const userData = data.users[userId];
  
  if (!userData || !userData.started) {
    await message.reply('❌ You need to use `!start` first!');
    return;
  }
  
  if (!characterName) {
    await message.reply('❌ Please specify a character! Usage: `!unlock <character name>`');
    return;
  }
  
  const char = characterManager.getCharacters().find(c => c.name.toLowerCase() === characterName.toLowerCase());
  if (!char) {
    await message.reply('❌ Character not found!');
    return;
  }
  
  initializeKeys(userData);
  
  if (hasCharacter(userData, char.name)) {
    await message.reply(`❌ You already own **${char.emoji} ${char.name}**!`);
    return;
  }
  
  const keys = userData.characterKeys[char.name] || 0;
  if (keys < 1000) {
    await message.reply(`❌ You need 1000 keys to unlock **${char.emoji} ${char.name}**! You currently have ${keys} keys.`);
    return;
  }
  
  userData.characterKeys[char.name] -= 1000;
  
  const { assignMovesToCharacter, calculateBaseHP } = require('./battleUtils.js');
  const st = parseFloat((Math.random() * 100).toFixed(2));
  const moves = assignMovesToCharacter(char.name, st);
  const baseHp = calculateBaseHP(st);
  
  userData.characters.push({
    name: char.name,
    emoji: char.emoji,
    level: 1,
    tokens: 0,
    st: st,
    moves: moves,
    baseHp: baseHp,
    currentSkin: 'default',
    ownedSkins: ['default']
  });
  
  await saveDataImmediate(data);
  
  const unlockEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎉 CHARACTER UNLOCKED!')
    .setDescription(`You unlocked **${char.emoji} ${char.name}**!\n\n**ST:** ${st}%\n**Level:** 1\n**HP:** ${baseHp}\n\nYou used 1000 ${char.name} keys!`)
    .setFooter({ text: 'Use !profile to view your characters!' });
  
  await message.reply({ embeds: [unlockEmbed] });
}

async function openRandomCage(message, data, userId) {
  const userData = data.users[userId];
  
  if (!userData || !userData.started) {
    await message.reply('❌ You need to use `!start` first!');
    return;
  }
  
  initializeKeys(userData);
  
  if (userData.cageKeys < 250) {
    await message.reply(`❌ You need 250 cage keys to open a random cage! You currently have ${userData.cageKeys} cage keys.\n\nEarn cage keys by placing in the top 3 of daily events!`);
    return;
  }
  
  userData.cageKeys -= 250;
  
  const availableChars = characterManager.getCharacters().filter(c => !hasCharacter(userData, c.name));
  
  if (availableChars.length === 0) {
    userData.gems = (userData.gems || 0) + 500;
    await saveDataImmediate(data);
    
    await message.reply(`🎉 You already own all characters! The random cage gave you **500 gems** instead!`);
    return;
  }
  
  const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];
  
  const { assignMovesToCharacter, calculateBaseHP } = require('./battleUtils.js');
  const st = parseFloat((Math.random() * 100).toFixed(2));
  const moves = assignMovesToCharacter(randomChar.name, st);
  const baseHp = calculateBaseHP(st);
  
  userData.characters.push({
    name: randomChar.name,
    emoji: randomChar.emoji,
    level: 1,
    tokens: 0,
    st: st,
    moves: moves,
    baseHp: baseHp,
    currentSkin: 'default',
    ownedSkins: ['default']
  });
  
  await saveDataImmediate(data);
  
  const cageEmbed = new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('🎁 RANDOM CAGE OPENED!')
    .setDescription(`You opened a random cage and got...\n\n**${randomChar.emoji} ${randomChar.name}**!\n\n**ST:** ${st}%\n**Level:** 1\n**HP:** ${baseHp}\n\nYou used 250 cage keys!`)
    .setFooter({ text: 'Use !profile to view your characters!' });
  
  await message.reply({ embeds: [cageEmbed] });
}

function getCharacterKeyCount(userData, characterName) {
  initializeKeys(userData);
  return userData.characterKeys[characterName] || 0;
}

function getCageKeyCount(userData) {
  initializeKeys(userData);
  return userData.cageKeys;
}

module.exports = {
  initializeKeys,
  addCharacterKey,
  addCageKeys,
  hasCharacter,
  convertKeysToGems,
  viewKeys,
  unlockCharacter,
  openRandomCage,
  getCharacterKeyCount,
  getCageKeyCount
};
