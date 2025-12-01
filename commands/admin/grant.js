const { saveData } = require('../../dataManager.js');
const { createSuccessEmbed, createErrorEmbed, parseUserMention, validatePositiveInteger, initializeUserData } = require('../../utils/shared.js');

module.exports = {
  name: 'grant',
  aliases: ['give'],
  category: 'admin',
  description: 'Grant coins or gems to a user',
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
    if (!['coins', 'gems'].includes(currency)) {
      return message.reply('❌ Currency must be `coins` or `gems`!');
    }
    
    const amountCheck = validatePositiveInteger(args[2], 'Amount');
    if (!amountCheck.valid) {
      return message.reply(`❌ ${amountCheck.error}`);
    }
    
    const amount = amountCheck.value;
    const userData = initializeUserData(targetId, data);
    
    userData[currency] = (userData[currency] || 0) + amount;
    await saveData(data);
    
    const { trackEconomyChange } = require('../../antiCheatSystem.js');
    trackEconomyChange(targetId, currency, amount, 'admin_grant', message.author.id);
    
    let targetUser;
    try {
      targetUser = await message.client.users.fetch(targetId);
    } catch {
      targetUser = { username: 'Unknown User' };
    }
    
    const emoji = currency === 'coins' ? '💰' : '💎';
    const embed = createSuccessEmbed(
      'Currency Granted',
      `${emoji} Granted **${amount.toLocaleString()}** ${currency} to **${targetUser.username}**!\n\n` +
      `New balance: **${userData[currency].toLocaleString()}** ${currency}`
    );
    embed.setFooter({ text: `Granted by ${message.author.username}` });
    
    return message.reply({ embeds: [embed] });
  }
};
