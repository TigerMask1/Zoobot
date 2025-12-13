const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { buyCrate } = require('../../crateSystem.js');
const { saveDataImmediate } = require('../../dataManager.js');

module.exports = {
  name: 'crate',
  aliases: ['crates', 'chest', 'chests', 'buycrate'],
  category: 'economy',
  description: 'View crate inventory or buy a crate',
  usage: '!crate [type]',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    const crateType = args[0]?.toLowerCase();
    const validCrates = ['gold', 'emerald', 'legendary', 'tyrant'];
    
    if (!validCrates.includes(crateType)) {
      const crateEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('<a:emoji_3:1439513584416591954> Available Crates')
        .setDescription('**Free Crates** (from message rewards):\n<:emoji_5:1439554263461134356> Bronze Crate - Use `!opencrate bronze`\n<:emoji_7:1439554348890853386> Silver Crate - Use `!opencrate silver`\n\n**Premium Crates** (purchase with gems):')
        .addFields(
          { name: '<:emoji_2:1439429824862093445> Gold Crate', value: '💎 100 gems\n1.5% character chance\n🎫 50 random character tokens\n💰 500 coins', inline: true },
          { name: '<:emoji_4:1439554205709766747> Emerald Crate', value: '💎 250 gems\n5% character chance\n🎫 130 random character tokens\n💰 1800 coins', inline: true },
          { name: '<:emoji_6:1439554298693550102> Legendary Crate', value: '💎 500 gems\n10% character chance\n🎫 200 random character tokens\n💰 2500 coins', inline: true },
          { name: '<:emoji_8:1439554384555151370> Tyrant Crate', value: '💎 750 gems\n15% character chance\n🎫 300 random character tokens\n💰 3500 coins', inline: true }
        )
        .addFields({ 
          name: '<a:emoji_3:1439513584416591954> Your Crates', 
          value: `<:emoji_5:1439554263461134356> Bronze: ${userData.bronzeCrates || 0}\n<:emoji_7:1439554348890853386> Silver: ${userData.silverCrates || 0}\n<:emoji_2:1439429824862093445> Gold: ${userData.goldCrates || 0}\n<:emoji_4:1439554205709766747> Emerald: ${userData.emeraldCrates || 0}\n<:emoji_6:1439554298693550102> Legendary: ${userData.legendaryCrates || 0}\n<:emoji_8:1439554384555151370> Tyrant: ${userData.tyrantCrates || 0}`, 
          inline: false 
        })
        .setFooter({ text: 'Use: !crate <type> to buy | !opencrate <type> to open owned crates' });
      
      return message.reply({ embeds: [crateEmbed] });
    }
    
    const result = await buyCrate(data, userId, crateType);
    
    if (!result.success) {
      return message.reply(`❌ ${result.message}`);
    }
    
    await saveDataImmediate(data);
    
    const resultEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💎 ${crateType.toUpperCase()} CRATE PURCHASED!`)
      .setDescription(`<@${userId}>\n\n${result.message}`)
      .setTimestamp();
    
    return message.reply({ embeds: [resultEmbed] });
  }
};
