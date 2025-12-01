const { saveData } = require('../../dataManager.js');
const { parseUserMention, createSuccessEmbed, createErrorEmbed } = require('../../utils/shared.js');
const { warnUser, createWarnEmbed } = require('../../moderationSystem.js');

module.exports = {
  name: 'warn',
  category: 'moderation',
  description: 'Warn a user for rule violations',
  usage: '!warn @user <reason>',
  adminOnly: true,
  
  async execute({ message, args, data }) {
    if (args.length < 2) {
      return message.reply('❌ Usage: `!warn @user <reason>`');
    }
    
    const targetId = parseUserMention(args[0]);
    if (!targetId) {
      return message.reply('❌ Please mention a valid user!');
    }
    
    if (targetId === message.author.id) {
      return message.reply('❌ You cannot warn yourself!');
    }
    
    const reason = args.slice(1).join(' ');
    if (reason.length < 3) {
      return message.reply('❌ Please provide a valid reason for the warning!');
    }
    
    let targetUser;
    try {
      targetUser = await message.client.users.fetch(targetId);
    } catch {
      return message.reply('❌ Could not find that user!');
    }
    
    const result = warnUser(
      data, 
      targetId, 
      message.author.id, 
      reason, 
      message.guild?.id
    );
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Warning Failed', result.message)] });
    }
    
    await saveData(data);
    
    const embed = createWarnEmbed(targetUser, message.author, reason, result.warningCount);
    
    try {
      await targetUser.send({
        embeds: [createErrorEmbed(
          'You Have Been Warned',
          `**Server:** ${message.guild?.name || 'Unknown'}\n` +
          `**Reason:** ${reason}\n` +
          `**Warned by:** ${message.author.username}\n\n` +
          `⚠️ You now have **${result.warningCount}** warning(s).`
        )]
      });
    } catch {
    }
    
    return message.reply({ embeds: [embed] });
  }
};
