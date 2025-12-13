const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { updateTaskProgress } = require('../../seasonSystem.js');

module.exports = {
  name: 'character',
  aliases: ['char', 'charinfo'],
  category: 'characters',
  description: 'View detailed information about a character in your collection',
  usage: '!character <name>',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    const charName = args.join(' ').toLowerCase();
    
    if (!charName) {
      return message.reply('Usage: `!char <character name>`');
    }
    
    const userChar = (userData.characters || []).find(c => 
      c.name.toLowerCase() === charName
    );
    
    if (!userChar) {
      return message.reply('You don\'t own this character!');
    }
    
    // Track season daily task progress for viewing characters
    if (userData.started) {
      updateTaskProgress(userData, 'charsViewed', 1);
    }
    
    // Get level requirements
    const { getLevelRequirements, createLevelProgressBar, MAX_BOOSTS_PER_CHARACTER, getCharacterBoostCount } = require('../../battleSystem.js');
    const { getSkinUrl } = require('../../skinSystem.js');
    
    const charReq = getLevelRequirements(userChar.level);
    const charProgress = createLevelProgressBar(userChar.tokens, charReq.tokens);
    
    let charSkinUrl;
    try {
      charSkinUrl = await getSkinUrl(userChar.name, userChar.currentSkin || 'default');
    } catch {
      charSkinUrl = null;
    }
    
    const availableSkins = userChar.ownedSkins || ['default'];
    
    let boostCount = 0;
    let remainingBoosts = 5;
    try {
      boostCount = getCharacterBoostCount(userChar);
      remainingBoosts = (MAX_BOOSTS_PER_CHARACTER || 5) - boostCount;
    } catch {
      // Functions may not exist
    }
    
    const charEmbed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${userChar.emoji || '🦁'} ${userChar.name}`)
      .addFields(
        { name: 'Level', value: `${userChar.level || 1}`, inline: true },
        { name: 'ST', value: `${userChar.st || 0}%`, inline: true },
        { name: 'Tokens', value: `${userChar.tokens || 0}/${charReq.tokens}`, inline: true },
        { name: 'ST Boosts', value: `${boostCount}/${MAX_BOOSTS_PER_CHARACTER || 5} used\n${remainingBoosts > 0 ? `⚡ ${remainingBoosts} left` : '❌ Max reached'}`, inline: true },
        { name: 'Next Level Cost', value: `🎫 ${charReq.tokens} tokens\n💰 ${charReq.coins} coins`, inline: true },
        { name: 'Progress to Next Level', value: charProgress || '▱▱▱▱▱▱▱▱▱▱ 0%', inline: false },
        { name: '🎨 Current Skin', value: userChar.currentSkin || 'default', inline: true },
        { name: '🖼️ Owned Skins', value: availableSkins.join(', '), inline: true }
      );
    
    if (charSkinUrl) {
      charEmbed.setImage(charSkinUrl);
    }
    
    return message.reply({ embeds: [charEmbed] });
  }
};
