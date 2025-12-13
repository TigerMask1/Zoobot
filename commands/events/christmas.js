const { EmbedBuilder } = require('discord.js');
const { 
  isEventActive, 
  createEventEmbed, 
  createMilestonesEmbed,
  getEventLeaderboard,
  setMilestoneImage,
  setAnnouncementImage,
  COMMUNITY_MILESTONES,
  getEventTimeRemaining
} = require('../../christmasEventSystem.js');
const { isSuperAdmin } = require('../../serverConfigManager.js');

async function handleChristmasCommand(message, args, data, client) {
  const subcommand = args[0]?.toLowerCase();
  
  if (subcommand === 'setimage' || subcommand === 'setbanner') {
    if (!isSuperAdmin(message.author.id)) {
      return message.reply('❌ Only super admins can set event images!');
    }
    
    if (subcommand === 'setbanner') {
      const attachment = message.attachments.first();
      if (!attachment) {
        return message.reply('❌ Please attach an image to set as the event banner!\nUsage: `!christmas setbanner` with an attached image');
      }
      
      if (!attachment.contentType?.startsWith('image/')) {
        return message.reply('❌ The attached file must be an image!');
      }
      
      const result = await setAnnouncementImage(attachment.url);
      if (result.success) {
        return message.reply(`✅ Event banner image has been set!`);
      } else {
        return message.reply(`❌ Failed to set banner: ${result.error}`);
      }
    }
    
    const milestoneId = parseInt(args[1]);
    if (!milestoneId || milestoneId < 1 || milestoneId > 7) {
      return message.reply('❌ Please provide a valid milestone ID (1-7)!\nUsage: `!christmas setimage <1-7>` with an attached image');
    }
    
    const attachment = message.attachments.first();
    if (!attachment) {
      return message.reply('❌ Please attach an image to set as the milestone image!');
    }
    
    if (!attachment.contentType?.startsWith('image/')) {
      return message.reply('❌ The attached file must be an image!');
    }
    
    const result = await setMilestoneImage(milestoneId, attachment.url);
    if (result.success) {
      const milestone = COMMUNITY_MILESTONES.find(m => m.id === milestoneId);
      return message.reply(`✅ Image set for milestone ${milestoneId}: **${milestone?.name || 'Unknown'}**`);
    } else {
      return message.reply(`❌ Failed to set image: ${result.error}`);
    }
  }
  
  if (!isEventActive()) {
    const timeInfo = getEventTimeRemaining();
    if (!timeInfo.started) {
      const days = Math.floor(timeInfo.timeRemaining / (24 * 60 * 60 * 1000));
      const hours = Math.floor((timeInfo.timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      return message.reply(`🎄 The Christmas Gift Hunt event hasn't started yet!\n🕐 Starts in: **${days}d ${hours}h**\n📅 December 15-25, 2025`);
    } else {
      return message.reply(`🏁 The Christmas Gift Hunt event has ended!\n🎁 Thank you for participating!\n📅 See you next year!`);
    }
  }
  
  if (subcommand === 'milestones' || subcommand === 'rewards') {
    const type = args[1]?.toLowerCase() || 'community';
    if (!['community', 'server', 'personal'].includes(type)) {
      return message.reply('❌ Invalid type! Use: `community`, `server`, or `personal`');
    }
    
    const embed = await createMilestonesEmbed(type);
    return message.reply({ embeds: [embed] });
  }
  
  if (subcommand === 'leaderboard' || subcommand === 'lb') {
    const type = args[1]?.toLowerCase() || 'users';
    const leaderboard = await getEventLeaderboard(type, 10);
    
    if (leaderboard.length === 0) {
      return message.reply('❌ No data yet! Start collecting Christmas gifts!');
    }
    
    const embed = new EmbedBuilder()
      .setColor('#C41E3A')
      .setTitle(`🎄 Christmas Gift Leaderboard - ${type === 'users' ? 'Top Collectors' : 'Top Servers'}`)
      .setTimestamp();
    
    let description = '';
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      
      if (type === 'users') {
        try {
          const user = await client.users.fetch(entry.userId).catch(() => null);
          const displayName = user ? user.username : 'Unknown User';
          description += `${medal} ${displayName} - 🎁 ${entry.gifts.toLocaleString()} gifts\n`;
        } catch {
          description += `${medal} Unknown User - 🎁 ${entry.gifts.toLocaleString()} gifts\n`;
        }
      } else {
        const guild = client.guilds.cache.get(entry.serverId);
        const displayName = guild ? guild.name : 'Unknown Server';
        description += `${medal} ${displayName} - 🎁 ${entry.gifts.toLocaleString()} gifts\n`;
      }
    }
    
    embed.setDescription(description);
    embed.setFooter({ text: 'Collect more gifts to climb the leaderboard!' });
    
    return message.reply({ embeds: [embed] });
  }
  
  const embed = await createEventEmbed(message.author.id, message.guild?.id, client);
  return message.reply({ embeds: [embed] });
}

module.exports = {
  name: 'christmas',
  aliases: ['xmas', 'gifthunt', 'gifts'],
  description: 'View Christmas Gift Hunt 2024 event progress',
  usage: '!christmas [milestones|leaderboard|setimage]',
  execute: handleChristmasCommand
};
