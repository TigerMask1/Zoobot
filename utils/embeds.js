const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BOT_CONFIG, CURRENCY_CONFIG, RARITY_CONFIG } = require('../config.js');

function createEmbed(options = {}) {
  const embed = new EmbedBuilder();
  
  if (options.color) embed.setColor(options.color);
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.footer) embed.setFooter(typeof options.footer === 'string' ? { text: options.footer } : options.footer);
  if (options.author) embed.setAuthor(typeof options.author === 'string' ? { name: options.author } : options.author);
  if (options.timestamp !== false) embed.setTimestamp();
  if (options.fields) embed.addFields(options.fields);
  if (options.url) embed.setURL(options.url);
  
  return embed;
}

function createErrorEmbed(title, description, options = {}) {
  return createEmbed({
    color: BOT_CONFIG.COLORS.ERROR,
    title: `❌ ${title}`,
    description,
    ...options
  });
}

function createSuccessEmbed(title, description, options = {}) {
  return createEmbed({
    color: BOT_CONFIG.COLORS.SUCCESS,
    title: `✅ ${title}`,
    description,
    ...options
  });
}

function createWarningEmbed(title, description, options = {}) {
  return createEmbed({
    color: BOT_CONFIG.COLORS.WARNING,
    title: `⚠️ ${title}`,
    description,
    ...options
  });
}

function createInfoEmbed(title, description, options = {}) {
  return createEmbed({
    color: BOT_CONFIG.COLORS.INFO,
    title,
    description,
    ...options
  });
}

function createBalanceEmbed(user, userData) {
  return createEmbed({
    color: BOT_CONFIG.COLORS.GOLD,
    title: `💰 ${user.username}'s Balance`,
    thumbnail: user.displayAvatarURL({ dynamic: true }),
    fields: [
      { name: `${CURRENCY_CONFIG.coins.emoji} Coins`, value: (userData.coins || 0).toLocaleString(), inline: true },
      { name: `${CURRENCY_CONFIG.gems.emoji} Gems`, value: (userData.gems || 0).toLocaleString(), inline: true },
      { name: `${CURRENCY_CONFIG.trophies.emoji} Trophies`, value: (userData.trophies || 0).toLocaleString(), inline: true }
    ]
  });
}

function createProfileEmbed(user, userData, options = {}) {
  const battleStats = userData.battleStats || { wins: 0, losses: 0 };
  const totalBattles = battleStats.wins + battleStats.losses;
  const winRate = totalBattles > 0 ? Math.round((battleStats.wins / totalBattles) * 100) : 0;
  const characters = userData.characters || [];
  
  const embed = createEmbed({
    color: BOT_CONFIG.COLORS.PURPLE,
    title: `👤 ${user.username}'s Profile`,
    thumbnail: user.displayAvatarURL({ dynamic: true }),
    fields: [
      { 
        name: '💰 Economy', 
        value: `Coins: ${(userData.coins || 0).toLocaleString()}\nGems: ${(userData.gems || 0).toLocaleString()}\nTrophies: ${(userData.trophies || 0).toLocaleString()}`,
        inline: true 
      },
      { 
        name: '⚔️ Battle Stats', 
        value: `Wins: ${battleStats.wins}\nLosses: ${battleStats.losses}\nWin Rate: ${winRate}%`,
        inline: true 
      },
      { 
        name: '🦁 Collection', 
        value: `Characters: ${characters.length}`,
        inline: true 
      }
    ]
  });
  
  if (options.clan) {
    embed.addFields({ name: '🏰 Clan', value: `${options.clan.emoji || '🏰'} ${options.clan.name}`, inline: true });
  }
  
  if (options.badges) {
    embed.addFields({ name: '🏅 Badges', value: options.badges, inline: false });
  }
  
  return embed;
}

function createLeaderboardEmbed(title, entries, type = 'coins') {
  const emoji = CURRENCY_CONFIG[type]?.emoji || '🏆';
  const medals = ['🥇', '🥈', '🥉'];
  
  const description = entries.map((entry, index) => {
    const rank = index < 3 ? medals[index] : `\`${index + 1}.\``;
    return `${rank} **${entry.username}** - ${emoji} ${entry.value.toLocaleString()}`;
  }).join('\n');
  
  return createEmbed({
    color: BOT_CONFIG.COLORS.GOLD,
    title: `${emoji} ${title} Leaderboard`,
    description: description || 'No entries yet!'
  });
}

function createCharacterEmbed(character, options = {}) {
  const rarity = RARITY_CONFIG[character.rarity] || RARITY_CONFIG.common;
  
  const embed = createEmbed({
    color: rarity.color,
    title: `${character.emoji || '🦁'} ${character.name}`,
    description: character.description || 'A collectible character',
    thumbnail: options.imageUrl || null,
    fields: [
      { name: 'Level', value: `${character.level || 1}`, inline: true },
      { name: 'Tokens', value: `${character.tokens || 0}`, inline: true },
      { name: 'Rarity', value: `${rarity.emoji} ${character.rarity || 'Common'}`, inline: true }
    ]
  });
  
  if (character.ability) {
    embed.addFields({ 
      name: 'Ability', 
      value: `${character.ability.emoji || '⚡'} **${character.ability.name}**\n${character.ability.description || 'No description'}`, 
      inline: false 
    });
  }
  
  if (character.specialMove) {
    embed.addFields({ 
      name: 'Special Move', 
      value: `**${character.specialMove.name}** (${character.specialMove.damage} DMG)`, 
      inline: false 
    });
  }
  
  return embed;
}

function createPaginationButtons(currentPage, totalPages, customIdPrefix) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_first`)
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_prev`)
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_page`)
      .setLabel(`${currentPage}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_next`)
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages),
    new ButtonBuilder()
      .setCustomId(`${customIdPrefix}_last`)
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages)
  );
}

function createConfirmButtons(confirmId, cancelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel('Confirm')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel('Cancel')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  createEmbed,
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed,
  createInfoEmbed,
  createBalanceEmbed,
  createProfileEmbed,
  createLeaderboardEmbed,
  createCharacterEmbed,
  createPaginationButtons,
  createConfirmButtons
};
