const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { startPickSession, getChestVisual } = require('../../chestInteractionManager.js');

module.exports = {
  name: 'pickcrate',
  aliases: ['pickchest'],
  category: 'economy',
  description: 'Pick a crate to open with an interactive animation',
  usage: '!pickcrate <type>',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    const pickType = args[0]?.toLowerCase();
    const allCrateTypes = ['bronze', 'silver', 'gold', 'emerald', 'legendary', 'tyrant'];
    
    if (!allCrateTypes.includes(pickType)) {
      return message.reply('Usage: `!pickcrate <type>`\nAvailable: bronze, silver, gold, emerald, legendary, tyrant\n\nUse `!crate` to see your inventory!');
    }
    
    const crateKey = `${pickType}Crates`;
    const userCrateCount = userData[crateKey] || 0;
    
    if (userCrateCount < 1) {
      return message.reply(`❌ You don't have any ${pickType} crates!`);
    }
    
    const sessionResult = startPickSession(userId, pickType);
    if (!sessionResult.success) {
      return message.reply(sessionResult.message);
    }
    
    const chestVisual = await getChestVisual(pickType);
    
    const readyEmbed = new EmbedBuilder()
      .setColor(chestVisual.embedColor)
      .setTitle(`${chestVisual.displayName} Chest is Ready! ✨`)
      .setDescription(`<@${userId}> picked a **${chestVisual.displayName}** chest!\n\n🎁 Your chest is ready to open!\n⏰ You have **2 minutes** to open it.\n\nType \`!opencrate\` to open your chest!`)
      .setImage(chestVisual.readyGifUrl)
      .setTimestamp();
    
    return message.reply({ embeds: [readyEmbed] });
  }
};
