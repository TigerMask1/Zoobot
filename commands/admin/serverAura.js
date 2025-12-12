const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { 
  getServerAura, 
  addAura, 
  purchaseSlot, 
  setServerProfileImage, 
  setServerBadge, 
  grantBadgeToUser, 
  revokeBadgeFromUser,
  formatServerAuraEmbed,
  getServerSlotLimits,
  calculateSlotCost,
  getServerLevelConfig,
  getServerAuraLeaderboard
} = require('../../serverAuraSystem.js');
const { isSuperAdmin, isServerAdmin, isServerOwner } = require('../../serverConfigManager.js');

module.exports = {
  name: 'serveraura',
  aliases: ['saura', 'serverlevel', 'slevel', 'serverprofile'],
  category: 'admin',
  description: 'View and manage server aura, level, and profile',
  usage: '!serveraura | !serveraura buy <character/collectible> | !serveraura setimage | !serveraura setbadge | !serveraura grantbadge @user | !serveraura leaderboard',
  
  async execute({ message, args, data, client }) {
    const serverId = message.guild?.id;
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const subcommand = args[0]?.toLowerCase();
    
    if (!subcommand || subcommand === 'view' || subcommand === 'info') {
      return handleViewServerAura(message, serverId, client);
    }
    
    if (subcommand === 'buy' || subcommand === 'buyslot') {
      return handleBuySlot(message, serverId, args.slice(1), client);
    }
    
    if (subcommand === 'setimage' || subcommand === 'setprofile' || subcommand === 'setpfp') {
      return handleSetServerImage(message, serverId, args.slice(1));
    }
    
    if (subcommand === 'setbadge') {
      return handleSetServerBadge(message, serverId, args.slice(1));
    }
    
    if (subcommand === 'grantbadge' || subcommand === 'grant') {
      return handleGrantBadge(message, serverId, args.slice(1));
    }
    
    if (subcommand === 'revokebadge' || subcommand === 'revoke') {
      return handleRevokeBadge(message, serverId, args.slice(1));
    }
    
    if (subcommand === 'leaderboard' || subcommand === 'lb' || subcommand === 'top') {
      return handleServerLeaderboard(message, client);
    }
    
    if (subcommand === 'slots') {
      return handleViewSlots(message, serverId);
    }
    
    return handleViewServerAura(message, serverId, client);
  }
};

async function handleViewServerAura(message, serverId, client) {
  try {
    const serverAura = await getServerAura(serverId);
    const guild = message.guild;
    
    const embed = formatServerAuraEmbed(
      serverAura, 
      guild.name, 
      guild.iconURL({ dynamic: true, size: 256 })
    );
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`saura_slots_${serverId}`)
        .setLabel('View Slots')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎭'),
      new ButtonBuilder()
        .setCustomId(`saura_buy_${serverId}`)
        .setLabel('Buy Slot')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId(`saura_lb_${serverId}`)
        .setLabel('Leaderboard')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏆')
    );
    
    return message.reply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Error viewing server aura:', error);
    return message.reply('An error occurred while fetching server aura data.');
  }
}

async function handleBuySlot(message, serverId, args, client) {
  const userId = message.author.id;
  const member = message.member;
  
  if (!isServerOwner(member) && !isServerAdmin(userId, serverId, member) && !isSuperAdmin(userId)) {
    return message.reply('❌ Only server owners and admins can purchase slots!');
  }
  
  const slotType = args[0]?.toLowerCase();
  
  if (!slotType || !['character', 'char', 'collectible', 'collect', 'col'].includes(slotType)) {
    const slotLimits = await getServerSlotLimits(serverId);
    const serverAura = await getServerAura(serverId);
    
    const charCost = calculateSlotCost(slotLimits.purchasedCharSlots, 'character');
    const collectCost = calculateSlotCost(slotLimits.purchasedCollectSlots, 'collectible');
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('🛒 Buy Slots')
      .setDescription(`Use server aura to purchase more character or collectible slots!`)
      .addFields(
        { name: '✨ Your Aura', value: `${serverAura.totalAura.toLocaleString()}`, inline: true },
        { name: '📊 Server Level', value: `${serverAura.level}`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { 
          name: '🎭 Character Slot', 
          value: `Current: ${slotLimits.purchasedCharSlots}/${slotLimits.maxCharSlots}\nCost: **${charCost}** aura\n\`!serveraura buy character\``, 
          inline: true 
        },
        { 
          name: '🎁 Collectible Slot', 
          value: `Current: ${slotLimits.purchasedCollectSlots}/${slotLimits.maxCollectSlots}\nCost: **${collectCost}** aura\n\`!serveraura buy collectible\``, 
          inline: true 
        }
      )
      .setFooter({ text: 'Slot costs increase with each purchase!' });
    
    return message.reply({ embeds: [embed] });
  }
  
  const normalizedType = ['character', 'char'].includes(slotType) ? 'character' : 'collectible';
  const result = await purchaseSlot(serverId, normalizedType, userId);
  
  const embed = new EmbedBuilder()
    .setColor(result.success ? 0x00FF00 : 0xFF0000)
    .setTitle(result.success ? '✅ Slot Purchased!' : '❌ Purchase Failed')
    .setDescription(result.message);
  
  return message.reply({ embeds: [embed] });
}

async function handleSetServerImage(message, serverId, args) {
  const userId = message.author.id;
  const member = message.member;
  
  if (!isServerOwner(member) && !isSuperAdmin(userId)) {
    return message.reply('❌ Only the server owner can set the server profile image!');
  }
  
  let imageUrl = args[0];
  
  if (!imageUrl && message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.contentType?.startsWith('image/')) {
      imageUrl = attachment.url;
    }
  }
  
  if (!imageUrl) {
    return message.reply('❌ Please attach an image or provide an image URL!\nUsage: `!serveraura setimage <url>` or attach an image to the message.');
  }
  
  const result = await setServerProfileImage(serverId, imageUrl, userId, isServerOwner(member));
  
  const embed = new EmbedBuilder()
    .setColor(result.success ? 0x00FF00 : 0xFF0000)
    .setTitle(result.success ? '✅ Profile Image Set!' : '❌ Failed')
    .setDescription(result.message);
  
  if (result.success && imageUrl) {
    embed.setThumbnail(imageUrl);
  }
  
  return message.reply({ embeds: [embed] });
}

async function handleSetServerBadge(message, serverId, args) {
  const userId = message.author.id;
  const member = message.member;
  
  if (!isServerOwner(member) && !isSuperAdmin(userId)) {
    return message.reply('❌ Only the server owner can set the server badge!');
  }
  
  let imageUrl = args[0];
  
  if (!imageUrl && message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.contentType?.startsWith('image/')) {
      imageUrl = attachment.url;
    }
  }
  
  if (!imageUrl) {
    return message.reply('❌ Please attach an image or provide an image URL!\nUsage: `!serveraura setbadge <url>` or attach an image to the message.');
  }
  
  const result = await setServerBadge(serverId, imageUrl, userId);
  
  const embed = new EmbedBuilder()
    .setColor(result.success ? 0x00FF00 : 0xFF0000)
    .setTitle(result.success ? '✅ Server Badge Set!' : '❌ Failed')
    .setDescription(result.message + (result.success ? '\nUse `!serveraura grantbadge @user` to grant this badge to members!' : ''));
  
  if (result.success && imageUrl) {
    embed.setThumbnail(imageUrl);
  }
  
  return message.reply({ embeds: [embed] });
}

async function handleGrantBadge(message, serverId, args) {
  const userId = message.author.id;
  const member = message.member;
  
  if (!isServerOwner(member) && !isSuperAdmin(userId)) {
    return message.reply('❌ Only the server owner can grant badges!');
  }
  
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to grant the badge to!\nUsage: `!serveraura grantbadge @user`');
  }
  
  const result = await grantBadgeToUser(serverId, targetUser.id, userId);
  
  const embed = new EmbedBuilder()
    .setColor(result.success ? 0x00FF00 : 0xFF0000)
    .setTitle(result.success ? '✅ Badge Granted!' : '❌ Failed')
    .setDescription(result.message);
  
  return message.reply({ embeds: [embed] });
}

async function handleRevokeBadge(message, serverId, args) {
  const userId = message.author.id;
  const member = message.member;
  
  if (!isServerOwner(member) && !isSuperAdmin(userId)) {
    return message.reply('❌ Only the server owner can revoke badges!');
  }
  
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to revoke the badge from!\nUsage: `!serveraura revokebadge @user`');
  }
  
  const result = await revokeBadgeFromUser(serverId, targetUser.id);
  
  const embed = new EmbedBuilder()
    .setColor(result.success ? 0x00FF00 : 0xFF0000)
    .setTitle(result.success ? '✅ Badge Revoked!' : '❌ Failed')
    .setDescription(result.message);
  
  return message.reply({ embeds: [embed] });
}

async function handleViewSlots(message, serverId) {
  const slotLimits = await getServerSlotLimits(serverId);
  const serverAura = await getServerAura(serverId);
  const levelConfig = getServerLevelConfig(serverAura.level);
  
  const charCost = calculateSlotCost(slotLimits.purchasedCharSlots, 'character');
  const collectCost = calculateSlotCost(slotLimits.purchasedCollectSlots, 'collectible');
  
  const charProgress = Math.min(100, (slotLimits.purchasedCharSlots / levelConfig.maxCharSlots) * 100);
  const collectProgress = Math.min(100, (slotLimits.purchasedCollectSlots / levelConfig.maxCollectSlots) * 100);
  
  const charBar = createBar(charProgress, 10);
  const collectBar = createBar(collectProgress, 10);
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`📊 ${message.guild.name} - Slot Information`)
    .addFields(
      { 
        name: '🎭 Character Slots', 
        value: `${charBar} ${slotLimits.purchasedCharSlots}/${levelConfig.maxCharSlots}\nNext slot: **${charCost}** aura`, 
        inline: false 
      },
      { 
        name: '🎁 Collectible Slots', 
        value: `${collectBar} ${slotLimits.purchasedCollectSlots}/${levelConfig.maxCollectSlots}\nNext slot: **${collectCost}** aura`, 
        inline: false 
      },
      { name: '✨ Available Aura', value: `${serverAura.totalAura.toLocaleString()}`, inline: true },
      { name: '📊 Server Level', value: `${serverAura.level}`, inline: true }
    )
    .setFooter({ text: 'Use !serveraura buy <character/collectible> to purchase slots' });
  
  return message.reply({ embeds: [embed] });
}

async function handleServerLeaderboard(message, client) {
  const servers = await getServerAuraLeaderboard(10);
  
  if (servers.length === 0) {
    return message.reply('No servers have earned aura yet!');
  }
  
  const leaderboardText = await Promise.all(servers.map(async (server, index) => {
    const guild = client.guilds.cache.get(server.serverId);
    const guildName = guild ? guild.name : 'Unknown Server';
    
    let medal = '';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';
    else medal = `**${index + 1}.**`;
    
    return `${medal} **${guildName}** - ✨ ${server.totalAura.toLocaleString()} aura (Lv.${server.level})`;
  }));
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🏆 Server Aura Leaderboard')
    .setDescription(leaderboardText.join('\n'))
    .setFooter({ text: 'Servers ranked by total aura earned' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

function createBar(percent, length = 10) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
