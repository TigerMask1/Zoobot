const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { saveDataImmediate } = require('../../dataManager.js');
const { updateTaskProgress } = require('../../seasonSystem.js');
const { initializePersonalizedTaskData, checkTaskProgress, completePersonalizedTask } = require('../../personalizedTaskSystem.js');

module.exports = {
  name: 'levelup',
  aliases: ['lvl', 'lvlup'],
  category: 'characters',
  description: 'Level up a character using tokens and coins',
  usage: '!levelup <character name>',
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    const charToLevelName = args.join(' ').toLowerCase();
    
    if (!charToLevelName) {
      return message.reply('Usage: `!levelup <character name>`');
    }
    
    const characters = userData.characters || [];
    const charToLevel = characters.find(c => 
      c.name.toLowerCase() === charToLevelName
    );
    
    if (!charToLevel) {
      return message.reply('❌ You don\'t own this character!');
    }
    
    // Get level requirements
    const { getLevelRequirements } = require('../../battleSystem.js');
    const currentCharLevel = charToLevel.level || 1;
    const requirements = getLevelRequirements(currentCharLevel);
    
    const charTokens = charToLevel.tokens || 0;
    const userCoins = userData.coins || 0;
    
    if (charTokens >= requirements.tokens && userCoins >= requirements.coins) {
      // Deduct resources
      charToLevel.tokens -= requirements.tokens;
      userData.coins -= requirements.coins;
      charToLevel.level = (charToLevel.level || 1) + 1;
      userData.lastActivity = Date.now();
      
      // Track season daily task progress for levels gained
      updateTaskProgress(userData, 'levelsGained', 1);
      
      // Check personalized tasks
      try {
        const ptData = initializePersonalizedTaskData(userData);
        if (ptData && ptData.taskProgress && ptData.taskProgress.levelsGained !== undefined) {
          const completedTask = checkTaskProgress(userData, 'levelsGained', 1);
          if (completedTask) {
            await completePersonalizedTask(client, userId, data, completedTask);
          }
        }
      } catch (err) {
        console.error('Error with personalized tasks:', err);
      }
      
      await saveDataImmediate(data);
      
      const lvlEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('⬆️ LEVEL UP!')
        .setDescription(
          `<@${userId}> leveled up **${charToLevel.name} ${charToLevel.emoji || '🦁'}**!\n\n` +
          `**Level ${currentCharLevel} → ${currentCharLevel + 1}**\n\n` +
          `**Cost:**\n` +
          `🎫 ${requirements.tokens} tokens\n` +
          `💰 ${requirements.coins} coins`
        );
      
      return message.reply({ embeds: [lvlEmbed] });
    } else {
      const missingTokens = Math.max(0, requirements.tokens - charTokens);
      const missingCoins = Math.max(0, requirements.coins - userCoins);
      
      let errorMsg = '❌ Not enough resources!\n\n**Required:**\n';
      errorMsg += `🎫 ${requirements.tokens} tokens (you have ${charTokens})\n`;
      errorMsg += `💰 ${requirements.coins} coins (you have ${userCoins})`;
      
      if (missingTokens > 0 || missingCoins > 0) {
        errorMsg += '\n\n**Missing:**\n';
        if (missingTokens > 0) errorMsg += `🎫 ${missingTokens} tokens\n`;
        if (missingCoins > 0) errorMsg += `💰 ${missingCoins} coins`;
      }
      
      return message.reply(errorMsg);
    }
  }
};
