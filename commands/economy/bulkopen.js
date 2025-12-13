const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { openCratesInBulk } = require('../../crateSystem.js');
const { saveDataImmediate } = require('../../dataManager.js');

module.exports = {
  name: 'bulkopen',
  aliases: ['openall', 'bulkopencrate'],
  category: 'economy',
  description: 'Open multiple crates at once',
  usage: '!bulkopen <type> [quantity]',
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    initializeUserData(userId, data);
    
    const bulkCrateType = args[0]?.toLowerCase();
    const bulkQuantity = parseInt(args[1]) || 10;
    
    if (!bulkCrateType || !['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'].includes(bulkCrateType)) {
      return message.reply('Usage: `!bulkopen <type> [quantity]`\n\nExample: `!bulkopen gold 5`\nAvailable types: bronze, silver, gold, emerald, legendary, tyrant\nQuantity: 1-50 (default: 10)');
    }
    
    const bulkResult = await openCratesInBulk(data, userId, bulkCrateType, bulkQuantity, client);
    
    if (!bulkResult.success) {
      return message.reply(`❌ ${bulkResult.message}`);
    }
    
    await saveDataImmediate(data);
    
    const bulkEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🎁 Bulk Crate Opening!`)
      .setDescription(bulkResult.message)
      .setFooter({ text: `Opened by ${message.author.username}` })
      .setTimestamp();
    
    return message.reply({ embeds: [bulkEmbed] });
  }
};
