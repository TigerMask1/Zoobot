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

async function handleChristmasCommand({ message, args = [], data, client }) {
  const subcommand = args[0]?.toLowerCase();
  
  // Help subcommand
  if (subcommand === 'help' || subcommand === 'info' || subcommand === 'guide') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#C41E3A')
      .setTitle('🎄 Christmas Gift Hunt 2025 - Help Guide 🎁')
      .setDescription(`**Welcome to the Christmas Gift Hunt Event!**\n\nFrom December 15th to December 25th, collect special Christmas Gifts from drops and crates to unlock amazing rewards!\n\n` +
        `**🎁 How to Get Gifts:**\n` +
        `• **Drops** - Catch regular drops with \`!c <code>\` - Christmas gifts have a high chance to appear!\n` +
        `• **Crates** - Open any crate for bonus gifts!\n` +
        `• You can get 1-3 gifts per drop, and even more from higher tier crates!\n\n` +
        `**🏆 Milestones & Rewards:**\n` +
        `• **Personal Milestones** - Track YOUR gift collection (5 tiers)\n` +
        `• **Server Milestones** - Your server's combined gifts (5 tiers)\n` +
        `• **Community Milestones** - GLOBAL community progress (7 tiers)\n\n` +
        `**📊 Commands:**\n` +
        `• \`!xmas\` or \`!christmas\` - View event progress\n` +
        `• \`!xmas milestones community\` - View community rewards\n` +
        `• \`!xmas milestones server\` - View server rewards\n` +
        `• \`!xmas milestones personal\` - View your rewards\n` +
        `• \`!xmas leaderboard\` - Top gift collectors\n\n` +
        `**🎅 Tips:**\n` +
        `• Catch drops quickly - gifts are awarded on every catch!\n` +
        `• Open higher tier crates for more gifts per crate\n` +
        `• Work together as a community to unlock global rewards for EVERYONE!`)
      .setFooter({ text: 'Happy Holidays! Event runs Dec 15-25, 2025' })
      .setTimestamp();
    
    return message.reply({ embeds: [helpEmbed] });
  }
  
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
      const giftCount = entry.gifts || 0;
      
      if (type === 'users') {
        try {
          const user = await client.users.fetch(entry.userId).catch(() => null);
          const displayName = user ? user.username : 'Unknown User';
          description += `${medal} ${displayName} - 🎁 ${giftCount.toLocaleString()} gifts\n`;
        } catch {
          description += `${medal} Unknown User - 🎁 ${giftCount.toLocaleString()} gifts\n`;
        }
      } else {
        const guild = client.guilds.cache.get(entry.serverId);
        const displayName = guild ? guild.name : 'Unknown Server';
        description += `${medal} ${displayName} - 🎁 ${giftCount.toLocaleString()} gifts\n`;
      }
    }
    
    embed.setDescription(description || 'No data available yet.');
    embed.setFooter({ text: 'Collect more gifts to climb the leaderboard!' });
    
    return message.reply({ embeds: [embed] });
  }
  
  const embed = await createEventEmbed(message.author.id, message.guild?.id, client);
  return message.reply({ embeds: [embed] });
}

module.exports = {
  name: 'christmas',
  aliases: ['xmas', 'gifthunt', 'gifts'],
  description: 'View Christmas Gift Hunt 2025 event progress and help',
  usage: '!christmas [help|milestones|leaderboard|setimage]',
  execute: handleChristmasCommand
};
