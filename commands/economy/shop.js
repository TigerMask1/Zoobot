const { openShop } = require('../../shopSystem.js');
const { initializeUserData } = require('../../utils/shared.js');

module.exports = {
  name: 'shop',
  aliases: ['store', 's'],
  category: 'economy',
  description: 'Open the shop to buy items',
  usage: '!shop',
  
  async execute({ message, data }) {
    const userId = message.author.id;
    initializeUserData(userId, data);
    
    try {
      await openShop(message, data);
    } catch (error) {
      console.error('Shop error:', error);
      return message.reply('❌ An error occurred while opening the shop. Please try again.');
    }
  }
};
