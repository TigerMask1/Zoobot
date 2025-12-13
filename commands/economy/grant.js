const { EmbedBuilder } = require('discord.js');
const { initializeUserData, formatNumber, parseUserMention } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');

module.exports = {
  name: 'grant',
  aliases: ['give', 'addcoins', 'addgems'],
  category: 'economy',
  description: 'Grant coins or gems to a user (Admin only)',
  usage: '!grant @user <coins/gems> <amount>',
  adminOnly: true,
  
  async execute({ message, args, data }) {
    if (args.length < 3) {
      return message.reply('❌ Usage: `!grant @user <coins/gems> <amount>`');
    }
    
    const targetId = parseUserMention(args[0]);
    if (!targetId) {
      return message.reply('❌ Please mention a valid user!');
    }
    
    const currency = args[1].toLowerCase();
    if (!['coins', 'gems', 'trophies'].includes(currency)) {
      return message.reply('❌ Invalid currency! Use `coins`, `gems`, or `trophies`.');
    }
    
    const amount = parseInt(args[2]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('❌ Please enter a valid positive amount!');
    }
    
    const userData = initializeUserData(targetId, data);
    userData[currency] = (userData[currency] || 0) + amount;
    
    await saveData(data);
    
    let targetUser;
    try {
      targetUser = await message.client.users.fetch(targetId);
    } catch {
      targetUser = { username: 'Unknown User' };
    }
    
    const currencyEmoji = currency === 'coins' ? '💰' : currency === 'gems' ? '💎' : '🏆';
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Currency Granted')
      .setDescription(`Granted **${formatNumber(amount)}** ${currencyEmoji} ${currency} to ${targetUser.username}!`)
      .addFields(
        { name: 'New Balance', value: `${currencyEmoji} ${formatNumber(userData[currency])}`, inline: true }
      )
      .setFooter({ text: `Granted by ${message.author.username}` })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};
