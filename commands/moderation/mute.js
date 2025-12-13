const { EmbedBuilder } = require('discord.js');
const { parseUserMention, initializeUserData } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');
const { canMuteInServer } = require('../../serverConfigManager.js');
const moderationSystem = require('../../moderationSystem.js');

function parseDuration(str) {
  if (!str) return null;
  
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  const multipliers = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  return value * multipliers[unit];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} second(s)`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute(s)`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour(s)`;
  
  const days = Math.floor(hours / 24);
  return `${days} day(s)`;
}

module.exports = [
  {
    name: 'mute',
    aliases: ['silence', 'timeout'],
    category: 'moderation',
    description: 'Mute a user from using bot commands temporarily',
    usage: '!mute @user [duration] [reason]',
    adminOnly: true,
    
    async execute({ message, args, data }) {
      const userId = message.author.id;
      const serverId = message.guild?.id;
      
      if (!canMuteInServer(userId, serverId, message.member)) {
        return message.reply('❌ You do not have permission to mute users!');
      }
      
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        return message.reply('❌ Please mention a user! Usage: `!mute @user [duration] [reason]`\n\nDurations: `30s`, `10m`, `1h`, `1d`');
      }
      
      let duration = parseDuration(args[1]);
      let reason;
      
      if (duration) {
        reason = args.slice(2).join(' ') || 'No reason provided';
      } else {
        duration = 60 * 60 * 1000; // Default 1 hour
        reason = args.slice(1).join(' ') || 'No reason provided';
      }
      
      const targetData = initializeUserData(targetId, data);
      targetData.muted = true;
      targetData.mutedUntil = Date.now() + duration;
      targetData.muteReason = reason;
      targetData.mutedBy = userId;
      
      await saveData(data);
      
      // Log moderation action
      if (moderationSystem && moderationSystem.logAction) {
        await moderationSystem.logAction(serverId, 'mute', targetId, userId, reason);
      }
      
      let targetUser;
      try {
        targetUser = await message.client.users.fetch(targetId);
      } catch {
        targetUser = { username: 'Unknown User' };
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('🔇 User Muted')
        .setDescription(`**${targetUser.username}** has been muted from using bot commands.`)
        .addFields(
          { name: 'User', value: `<@${targetId}>`, inline: true },
          { name: 'Duration', value: formatDuration(duration), inline: true },
          { name: 'Muted By', value: `<@${userId}>`, inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Expires', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
  },
  {
    name: 'unmute',
    aliases: ['unsilence'],
    category: 'moderation',
    description: 'Unmute a user',
    usage: '!unmute @user',
    adminOnly: true,
    
    async execute({ message, args, data }) {
      const userId = message.author.id;
      const serverId = message.guild?.id;
      
      if (!canMuteInServer(userId, serverId, message.member)) {
        return message.reply('❌ You do not have permission to unmute users!');
      }
      
      const targetId = parseUserMention(args[0]);
      if (!targetId) {
        return message.reply('❌ Please mention a user! Usage: `!unmute @user`');
      }
      
      const targetData = data.users?.[targetId];
      if (!targetData || !targetData.muted) {
        return message.reply('❌ This user is not muted!');
      }
      
      targetData.muted = false;
      delete targetData.mutedUntil;
      delete targetData.muteReason;
      delete targetData.mutedBy;
      
      await saveData(data);
      
      // Log moderation action
      if (moderationSystem && moderationSystem.logAction) {
        await moderationSystem.logAction(serverId, 'unmute', targetId, userId, 'Mute removed');
      }
      
      let targetUser;
      try {
        targetUser = await message.client.users.fetch(targetId);
      } catch {
        targetUser = { username: 'Unknown User' };
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🔊 User Unmuted')
        .setDescription(`**${targetUser.username}** has been unmuted.`)
        .addFields(
          { name: 'User', value: `<@${targetId}>`, inline: true },
          { name: 'Unmuted By', value: `<@${userId}>`, inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
  }
];
