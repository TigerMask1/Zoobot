const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');

module.exports = {
  name: 'release',
  aliases: ['leave'],
  category: 'characters',
  description: 'Release a character from your collection (must be level 10+)',
  usage: '!release <character name>',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    const charToReleaseName = args.join(' ').toLowerCase();
    
    if (!charToReleaseName) {
      return message.reply('Usage: `!release <character name>`');
    }
    
    const characters = userData.characters || [];
    const charIndex = characters.findIndex(c => 
      c.name.toLowerCase() === charToReleaseName
    );
    
    if (charIndex === -1) {
      return message.reply('❌ You don\'t own this character!');
    }
    
    const charToRelease = characters[charIndex];
    
    // Must be level 10+ to release
    if ((charToRelease.level || 1) < 10) {
      return message.reply(`❌ **${charToRelease.name}** must be at least level 10 to release! (Currently level ${charToRelease.level || 1})`);
    }
    
    // Remove the character
    userData.characters.splice(charIndex, 1);
    
    // Update selected character if needed
    if (userData.selectedCharacter === charToRelease.name) {
      userData.selectedCharacter = userData.characters.length > 0 
        ? userData.characters[0].name 
        : null;
    }
    
    // Track quest progress
    if (!userData.questProgress) userData.questProgress = {};
    userData.questProgress.charsReleased = (userData.questProgress.charsReleased || 0) + 1;
    
    await saveData(data);
    
    const releaseEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('👋 Character Released')
      .setDescription(
        `<@${userId}> released **${charToRelease.name} ${charToRelease.emoji || '🦁'}**!\n\n` +
        `Level: ${charToRelease.level || 1}\n` +
        `ST: ${charToRelease.st || 0}%\n` +
        `Tokens: ${charToRelease.tokens || 0}\n\n` +
        `Goodbye, ${charToRelease.name}!`
      );
    
    return message.reply({ embeds: [releaseEmbed] });
  }
};
