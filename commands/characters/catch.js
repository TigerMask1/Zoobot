const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');

module.exports = {
  name: 'catch',
  aliases: ['c', 'grab'],
  category: 'characters',
  description: 'Catch a dropped character (use the code shown in drop)',
  usage: '!c <code>',
  
  async execute({ message, args, data }) {
    // Note: The actual catch logic is handled by the drop system in index.js
    // This command is here for documentation purposes
    // Real catch handling happens when a drop is active and user types the code
    
    if (!args[0]) {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🦁 Catching Characters')
        .setDescription(
          'To catch a character, wait for a **drop** to appear in the drop channel!\n\n' +
          '**How it works:**\n' +
          '1. A character will randomly drop in the drop channel\n' +
          '2. Type the code shown (e.g., `!c tyrant`)\n' +
          '3. First person to type the correct code catches it!\n\n' +
          '**Tips:**\n' +
          '• Keep notifications on for the drop channel\n' +
          '• Be quick - other players are competing too!\n' +
          '• Some characters are rarer than others'
        )
        .setFooter({ text: 'Wait for a drop to appear!' });
      
      return message.reply({ embeds: [embed] });
    }
    
    // If they try to catch without an active drop
    return message.reply('❌ No active drop right now! Wait for a character to appear in the drop channel.');
  }
};
