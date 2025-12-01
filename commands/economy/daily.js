const { claimDaily, formatStreakDisplay } = require('../../dailyRewardSystem.js');
const { saveData } = require('../../dataManager.js');
const { createSuccessEmbed, createErrorEmbed, initializeUserData } = require('../../utils/shared.js');

module.exports = {
  name: 'daily',
  aliases: ['d'],
  category: 'economy',
  description: 'Claim your daily reward',
  cooldown: 1000,
  
  async execute({ message, data }) {
    const userId = message.author.id;
    initializeUserData(userId, data);
    
    const result = claimDaily(data, userId);
    
    if (!result.success) {
      const embed = createErrorEmbed('Daily Reward', result.message);
      return message.reply({ embeds: [embed] });
    }
    
    await saveData(data);
    
    const streakDisplay = formatStreakDisplay(result.streak);
    const embed = createSuccessEmbed('Daily Reward Claimed!', 
      `${streakDisplay}\n\n` +
      `**Rewards:**\n` +
      `💰 ${result.coins} coins\n` +
      `💎 ${result.gems} gems\n` +
      (result.bonusCrate ? `📦 ${result.bonusCrate} crate!\n` : '')
    );
    
    return message.reply({ embeds: [embed] });
  }
};
