const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { initializeUserData, formatNumber, parseUserMention } = require('../../utils/shared.js');
const { calculateLevel, getLevelRequirements } = require('../../levelSystem.js');
const { getAccountLevelDisplay } = require('../../accountLevelSystem.js');
const { getUserClan } = require('../../clanSystem.js');
const { formatAchievementBadges } = require('../../achievementSystem.js');

module.exports = {
  name: 'profile',
  aliases: ['p', 'me'],
  category: 'social',
  description: 'View your or another user\'s profile',
  usage: '!profile [@user]',
  
  async execute({ message, args, data }) {
    let targetId = message.author.id;
    let targetUser = message.author;
    
    if (args[0]) {
      const mentioned = parseUserMention(args[0]);
      if (mentioned) {
        targetId = mentioned;
        try {
          targetUser = await message.client.users.fetch(targetId);
        } catch {
          return message.reply('❌ Could not find that user!');
        }
      }
    }
    
    const userData = initializeUserData(targetId, data);
    const battleStats = userData.battleStats || { wins: 0, losses: 0 };
    const characters = userData.characters || [];
    
    const totalBattles = battleStats.wins + battleStats.losses;
    const winRate = totalBattles > 0 
      ? Math.round((battleStats.wins / totalBattles) * 100) 
      : 0;
    
    const accountLevel = getAccountLevelDisplay(userData);
    const clan = getUserClan(targetId, data);
    const badges = formatAchievementBadges(userData);
    
    const favoriteChar = characters.length > 0 
      ? characters.reduce((a, b) => ((a.tokens || 0) > (b.tokens || 0) ? a : b))
      : null;
    
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`👤 ${targetUser.username}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { 
          name: '💰 Economy', 
          value: `Coins: ${formatNumber(userData.coins || 0)}\nGems: ${formatNumber(userData.gems || 0)}\nTrophies: ${formatNumber(userData.trophies || 0)}`,
          inline: true 
        },
        { 
          name: '⚔️ Battle Stats', 
          value: `Wins: ${battleStats.wins}\nLosses: ${battleStats.losses}\nWin Rate: ${winRate}%`,
          inline: true 
        },
        { 
          name: '🦁 Collection', 
          value: `Characters: ${characters.length}\n${favoriteChar ? `Favorite: ${favoriteChar.emoji || '🦁'} ${favoriteChar.name}` : 'No characters yet'}`,
          inline: true 
        }
      );
    
    if (accountLevel) {
      embed.addFields({ name: '📊 Account Level', value: accountLevel, inline: true });
    }
    
    if (clan) {
      embed.addFields({ name: '🏰 Clan', value: `${clan.emoji || '🏰'} ${clan.name}`, inline: true });
    }
    
    if (badges && badges.length > 0) {
      embed.addFields({ name: '🏅 Badges', value: badges, inline: false });
    }
    
    if (userData.ust && userData.ust > 0) {
      embed.addFields({ name: '🌟 UST Balance', value: formatNumber(userData.ust), inline: true });
    }
    
    const createdDate = userData.createdAt 
      ? new Date(userData.createdAt).toLocaleDateString()
      : 'Unknown';
    embed.setFooter({ text: `Playing since ${createdDate} | Use !hub for game menu` });
    embed.setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hub_main')
        .setLabel('Game Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('feature_collection')
        .setLabel('Collection')
        .setEmoji('🦁')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('feature_achievements')
        .setLabel('Achievements')
        .setEmoji('🏅')
        .setStyle(ButtonStyle.Primary)
    );
    
    return message.reply({ embeds: [embed], components: [row] });
  }
};
