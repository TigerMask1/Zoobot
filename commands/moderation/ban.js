const { EmbedBuilder } = require('discord.js');
const { parseUserMention, initializeUserData } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');
const { isSuperAdmin, isGlobalBotAdmin, canBanInServer } = require('../../serverConfigManager.js');
const moderationSystem = require('../../moderationSystem.js');

module.exports = [
  {
    name: 'botban',
    aliases: ['banbot', 'botblock'],
    category: 'moderation',
    description: 'Ban a user from using bot commands',
    usage: '!botban @user [reason]',
    adminOnly: true,
    
    async execute({ message, args, data }) {
      const userId = message.author.id;
      const serverId = message.guild?.id;
      
      if (!canBanInServer(userId, serverId, message.member)) {
        return message.reply('❌ You do not have permission to ban users!');
      }
      
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        return message.reply('❌ Please mention a user! Usage: `!botban @user [reason]`');
      }
      
      // Cannot ban admins
      if (isSuperAdmin(targetId) || isGlobalBotAdmin(targetId)) {
        return message.reply('❌ Cannot ban bot administrators!');
      }
      
      const reason = args.slice(1).join(' ') || 'No reason provided';
      
      const targetData = initializeUserData(targetId, data);
      targetData.botBanned = true;
      targetData.botBanReason = reason;
      targetData.botBannedAt = new Date().toISOString();
      targetData.botBannedBy = userId;
      
      await saveData(data);
      
      // Log moderation action
      if (moderationSystem && moderationSystem.logAction) {
        await moderationSystem.logAction(serverId, 'bot_ban', targetId, userId, reason);
      }
      
      let targetUser;
      try {
        targetUser = await message.client.users.fetch(targetId);
      } catch {
        targetUser = { username: 'Unknown User', tag: 'Unknown#0000' };
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔨 User Bot Banned')
        .setDescription(`**${targetUser.username}** has been banned from using bot commands.`)
        .addFields(
          { name: 'User', value: `<@${targetId}>`, inline: true },
          { name: 'Banned By', value: `<@${userId}>`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
  },
  {
    name: 'unbotban',
    aliases: ['botunban', 'unbanbot'],
    category: 'moderation',
    description: 'Unban a user from using bot commands',
    usage: '!unbotban @user',
    adminOnly: true,
    
    async execute({ message, args, data }) {
      const userId = message.author.id;
      const serverId = message.guild?.id;
      
      if (!canBanInServer(userId, serverId, message.member)) {
        return message.reply('❌ You do not have permission to unban users!');
      }
      
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        return message.reply('❌ Please mention a user! Usage: `!unbotban @user`');
      }
      
      const targetData = data.users?.[targetId];
      if (!targetData || !targetData.botBanned) {
        return message.reply('❌ This user is not bot banned!');
      }
      
      targetData.botBanned = false;
      delete targetData.botBanReason;
      delete targetData.botBannedAt;
      delete targetData.botBannedBy;
      
      await saveData(data);
      
      // Log moderation action
      if (moderationSystem && moderationSystem.logAction) {
        await moderationSystem.logAction(serverId, 'bot_unban', targetId, userId, 'Ban removed');
      }
      
      let targetUser;
      try {
        targetUser = await message.client.users.fetch(targetId);
      } catch {
        targetUser = { username: 'Unknown User' };
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ User Unbanned')
        .setDescription(`**${targetUser.username}** can now use bot commands again.`)
        .addFields(
          { name: 'User', value: `<@${targetId}>`, inline: true },
          { name: 'Unbanned By', value: `<@${userId}>`, inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
  }
];
