const { EmbedBuilder } = require('discord.js');
const { initializeUserData, formatNumber } = require('../../utils/shared.js');

module.exports = {
  name: 'crate',
  aliases: ['crates', 'chest', 'chests'],
  category: 'economy',
  description: 'View your crate inventory',
  usage: '!crate',
  
  async execute({ message, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    if (!userData.crates) {
      userData.crates = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    }
    
    const crates = userData.crates;
    const totalCrates = Object.values(crates).reduce((a, b) => a + b, 0);
    
    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('📦 Your Crates')
      .setDescription(totalCrates === 0 
        ? 'You don\'t have any crates! Use `!shop` to buy some or earn them from `!daily` and `!work`.'
        : 'Use `!opencrate <type>` to open a crate!')
      .addFields(
        { name: '⬜ Common', value: formatNumber(crates.common || 0), inline: true },
        { name: '🟩 Uncommon', value: formatNumber(crates.uncommon || 0), inline: true },
        { name: '🟦 Rare', value: formatNumber(crates.rare || 0), inline: true },
        { name: '🟪 Epic', value: formatNumber(crates.epic || 0), inline: true },
        { name: '🟨 Legendary', value: formatNumber(crates.legendary || 0), inline: true },
        { name: '📊 Total', value: formatNumber(totalCrates), inline: true }
      )
      .setFooter({ text: 'Higher rarity crates have better rewards!' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};
