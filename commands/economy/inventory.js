const { EmbedBuilder } = require('discord.js');
const { initializeUserData, formatNumber } = require('../../utils/shared.js');

module.exports = {
  name: 'inventory',
  aliases: ['inv', 'bag'],
  category: 'economy',
  description: 'View your inventory of resources and items',
  usage: '!inventory',
  
  async execute({ message, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    const embed = new EmbedBuilder()
      .setColor(0x8B4513)
      .setTitle(`🎒 ${message.author.username}'s Inventory`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
    
    // Resources
    const ores = userData.ores || {};
    const wood = userData.wood || {};
    const tools = userData.tools || [];
    
    let oreList = '';
    if (Object.keys(ores).length > 0) {
      oreList = Object.entries(ores)
        .filter(([_, qty]) => qty > 0)
        .map(([ore, qty]) => `${ore}: ${qty}`)
        .join('\n') || 'None';
    } else {
      oreList = 'None';
    }
    
    let woodList = '';
    if (Object.keys(wood).length > 0) {
      woodList = Object.entries(wood)
        .filter(([_, qty]) => qty > 0)
        .map(([type, qty]) => `${type}: ${qty}`)
        .join('\n') || 'None';
    } else {
      woodList = 'None';
    }
    
    let toolList = '';
    if (tools.length > 0) {
      toolList = tools.map(t => `${t.name} (Lv${t.level || 1})`).join('\n');
    } else {
      toolList = 'None';
    }
    
    embed.addFields(
      { name: '⛏️ Ores', value: oreList, inline: true },
      { name: '🪵 Wood', value: woodList, inline: true },
      { name: '🔧 Tools', value: toolList, inline: true }
    );
    
    // Crates
    const crates = {
      bronze: userData.bronzeCrates || 0,
      silver: userData.silverCrates || 0,
      gold: userData.goldCrates || 0,
      diamond: userData.diamondCrates || 0,
      legendary: userData.legendaryCrates || 0
    };
    
    const crateList = Object.entries(crates)
      .filter(([_, qty]) => qty > 0)
      .map(([type, qty]) => `${type.charAt(0).toUpperCase() + type.slice(1)}: ${qty}`)
      .join('\n') || 'None';
    
    embed.addFields({ name: '📦 Crates', value: crateList, inline: true });
    
    // Keys
    const keys = userData.characterKeys || {};
    const totalKeys = Object.values(keys).reduce((sum, k) => sum + k, 0);
    embed.addFields({ name: '🔑 Character Keys', value: `Total: ${totalKeys}`, inline: true });
    
    embed.setFooter({ text: 'Use !work to gather resources' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};
