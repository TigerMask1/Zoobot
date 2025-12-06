const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { 
  listCollectibleItems,
  getUserCollectibleItems,
  getAllUserCollectibleItems,
  getCollectibleItem,
  getCollectibleItemByName,
  setProfileCollectibleItem,
  clearProfileCollectibleItem,
  sellCollectibleItem,
  RARITY_CONFIG
} = require('../../collectibleItemsSystem.js');
const { isMongoConnected } = require('../../mongoManager.js');
const { createSuccessEmbed, createErrorEmbed } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');
const path = require('path');
const fs = require('fs');

function checkMongoConnection(message) {
  if (!isMongoConnected()) {
    message.reply({ embeds: [createErrorEmbed('Database Unavailable', 'The collectible items system requires a database connection. Please try again later.')] });
    return false;
  }
  return true;
}

function getRarityTier(ownerCount) {
  if (ownerCount === 0) return { name: 'Legendary', color: '#FFD700', emoji: '🌟' };
  if (ownerCount <= 5) return { name: 'Epic', color: '#9B59B6', emoji: '💜' };
  if (ownerCount <= 20) return { name: 'Rare', color: '#3498DB', emoji: '💙' };
  if (ownerCount <= 50) return { name: 'Uncommon', color: '#2ECC71', emoji: '💚' };
  return { name: 'Common', color: '#95A5A6', emoji: '⚪' };
}

const itemsCommand = {
  name: 'items',
  aliases: ['collectibles', 'itemlist'],
  category: 'economy',
  description: 'View available collectible items',
  usage: '!items [page]',
  
  async execute({ message, args }) {
    if (!checkMongoConnection(message)) return;
    
    const page = parseInt(args[0]) || 1;
    const serverId = message.guild?.id;
    
    const { items, total, pages } = await listCollectibleItems(serverId, page, true);
    
    if (items.length === 0) {
      return message.reply({ embeds: [createErrorEmbed('No Items', 'No collectible items are available yet!')] });
    }
    
    const embed = new EmbedBuilder()
      .setColor('#00D166')
      .setTitle('📦 Collectible Items')
      .setDescription(`Page ${page}/${pages} • ${total} items total\nSorted by rarity (rarest first)`)
      .setFooter({ text: 'Use !iteminfo <name> for details • !myitems to see your collection' });
    
    for (const item of items) {
      const rarity = getRarityTier(item.ownerCount);
      const rarityConf = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
      
      let traits = [];
      if (item.droppable?.enabled) traits.push('🎯 Droppable');
      if (item.crateObtainable?.enabled) traits.push('📦 Crate');
      if (item.tradable) traits.push('🔄 Tradable');
      
      embed.addFields({
        name: `${item.emoji || rarityConf.emoji} ${item.name}`,
        value: `**Value:** ${item.computedValue} coins • **Owners:** ${item.ownerCount}\n${traits.join(' • ') || 'Standard item'}`,
        inline: false
      });
    }
    
    if (pages > 1) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`items_prev_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`items_next_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= pages)
      );
      return message.reply({ embeds: [embed], components: [row] });
    }
    
    return message.reply({ embeds: [embed] });
  }
};

const myItemsCommand = {
  name: 'myitems',
  aliases: ['mycollection', 'inventory', 'inv'],
  category: 'economy',
  description: 'View your collectible items',
  usage: '!myitems [page]',
  
  async execute({ message, args }) {
    if (!checkMongoConnection(message)) return;
    
    const userId = message.author.id;
    const page = parseInt(args[0]) || 1;
    
    const { items, total, pages } = await getUserCollectibleItems(userId, page);
    
    if (items.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('📦 Your Collection')
        .setDescription('You don\'t have any collectible items yet!\n\nOpen crates or participate in events to earn items!')
        .setFooter({ text: 'Use !items to see available items' });
      return message.reply({ embeds: [embed] });
    }
    
    let totalValue = 0;
    const embed = new EmbedBuilder()
      .setColor('#00D166')
      .setTitle(`📦 ${message.author.username}'s Collection`)
      .setDescription(`Page ${page}/${pages} • ${total} items owned`);
    
    for (const item of items) {
      const rarityConf = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
      const itemValue = (item.computedValue || 0) * (item.quantity || 1);
      totalValue += itemValue;
      
      let status = [];
      if (item.selectedForProfile) status.push('🌟 Featured');
      if (item.quantity > 1) status.push(`x${item.quantity}`);
      
      embed.addFields({
        name: `${item.emoji || rarityConf.emoji} ${item.name} ${status.join(' ')}`,
        value: `**Value:** ${item.computedValue} coins${item.quantity > 1 ? ` (${itemValue} total)` : ''}\n**Rarity:** ${item.rarity}`,
        inline: true
      });
    }
    
    embed.setFooter({ text: `Total collection value: ${totalValue} coins • Use !equipitem <name> to feature an item` });
    
    if (pages > 1) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`myitems_prev_${page}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`myitems_next_${page}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= pages)
      );
      return message.reply({ embeds: [embed], components: [row] });
    }
    
    return message.reply({ embeds: [embed] });
  }
};

const itemInfoCommand = {
  name: 'iteminfo',
  aliases: ['viewitem', 'checkitem'],
  category: 'economy',
  description: 'View detailed information about an item',
  usage: '!iteminfo <item_name>',
  
  async execute({ message, args }) {
    if (!checkMongoConnection(message)) return;
    
    if (args.length === 0) {
      return message.reply({ embeds: [createErrorEmbed('Usage', '`!iteminfo <item_name>`')] });
    }
    
    const itemName = args.join(' ').replace(/"/g, '');
    const item = await getCollectibleItemByName(itemName);
    
    if (!item) {
      return message.reply({ embeds: [createErrorEmbed('Not Found', `No item named "${itemName}" found!`)] });
    }
    
    const rarityConf = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
    const rarity = getRarityTier(item.ownerCount);
    
    const embed = new EmbedBuilder()
      .setColor(rarityConf.color)
      .setTitle(`${item.emoji || rarityConf.emoji} ${item.name}`)
      .setDescription(item.description || 'No description available');
    
    embed.addFields(
      { name: 'Rarity', value: `${rarityConf.emoji} ${item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}`, inline: true },
      { name: 'Current Value', value: `${item.computedValue} coins`, inline: true },
      { name: 'Owners', value: `${item.ownerCount}`, inline: true }
    );
    
    let obtainMethods = [];
    if (item.droppable?.enabled) obtainMethods.push('🎯 Random drops');
    if (item.crateObtainable?.enabled) {
      const crates = item.crateObtainable.crates?.length > 0 
        ? item.crateObtainable.crates.join(', ') 
        : 'all crates';
      obtainMethods.push(`📦 Crates (${crates})`);
    }
    if (obtainMethods.length === 0) obtainMethods.push('Admin grant only');
    
    embed.addFields({ name: 'How to Obtain', value: obtainMethods.join('\n'), inline: false });
    
    let traits = [];
    if (item.tradable) traits.push('🔄 Tradable');
    if (item.giftable) traits.push('🎁 Giftable');
    if (item.sellable) traits.push('💰 Sellable');
    if (item.stackable) traits.push('📚 Stackable');
    
    if (traits.length > 0) {
      embed.addFields({ name: 'Properties', value: traits.join(' • '), inline: false });
    }
    
    if (item.eventName) {
      embed.addFields({ name: 'Event', value: `🎪 ${item.eventName}`, inline: true });
    }
    
    if (item.availableUntil) {
      const until = new Date(item.availableUntil);
      const now = new Date();
      if (until > now) {
        const daysLeft = Math.ceil((until - now) / (1000 * 60 * 60 * 24));
        embed.addFields({ name: 'Limited Time', value: `⏰ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`, inline: true });
      }
    }
    
    if (item.imageUrl && fs.existsSync(item.imageUrl)) {
      const file = new AttachmentBuilder(item.imageUrl);
      embed.setThumbnail(`attachment://${path.basename(item.imageUrl)}`);
      return message.reply({ embeds: [embed], files: [file] });
    }
    
    return message.reply({ embeds: [embed] });
  }
};

const equipItemCommand = {
  name: 'equipitem',
  aliases: ['setitem', 'featureitem', 'displayitem'],
  category: 'economy',
  description: 'Feature a collectible item on your profile',
  usage: '!equipitem <item_name> or !equipitem none',
  
  async execute({ message, args }) {
    if (!checkMongoConnection(message)) return;
    
    if (args.length === 0) {
      return message.reply({ embeds: [createErrorEmbed('Usage', '`!equipitem <item_name>` or `!equipitem none` to clear')] });
    }
    
    const userId = message.author.id;
    
    if (args[0].toLowerCase() === 'none' || args[0].toLowerCase() === 'clear') {
      const result = await clearProfileCollectibleItem(userId);
      if (result.success) {
        return message.reply({ embeds: [createSuccessEmbed('Item Cleared', 'Your profile item has been removed!')] });
      }
      return message.reply({ embeds: [createErrorEmbed('Error', result.message)] });
    }
    
    const itemName = args.join(' ').replace(/"/g, '');
    const item = await getCollectibleItemByName(itemName);
    
    if (!item) {
      return message.reply({ embeds: [createErrorEmbed('Not Found', `No item named "${itemName}" found!`)] });
    }
    
    const result = await setProfileCollectibleItem(userId, item._id.toString());
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Error', result.message)] });
    }
    
    const rarityConf = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
    const embed = new EmbedBuilder()
      .setColor(rarityConf.color)
      .setTitle(`${item.emoji || rarityConf.emoji} Item Featured!`)
      .setDescription(`**${item.name}** is now displayed on your profile!`);
    
    return message.reply({ embeds: [embed] });
  }
};

const sellItemCommand = {
  name: 'sellitem',
  aliases: ['sellcollectible'],
  category: 'economy',
  description: 'Sell a collectible item for coins',
  usage: '!sellitem <item_name> [quantity]',
  
  async execute({ message, args, data }) {
    if (!checkMongoConnection(message)) return;
    
    if (args.length === 0) {
      return message.reply({ embeds: [createErrorEmbed('Usage', '`!sellitem <item_name> [quantity]`')] });
    }
    
    const userId = message.author.id;
    
    const lastArg = args[args.length - 1];
    const quantity = /^\d+$/.test(lastArg) && args.length > 1 ? parseInt(lastArg) : 1;
    const itemNameParts = /^\d+$/.test(lastArg) && args.length > 1 ? args.slice(0, -1) : args;
    const itemName = itemNameParts.join(' ').replace(/"/g, '');
    
    const item = await getCollectibleItemByName(itemName);
    
    if (!item) {
      return message.reply({ embeds: [createErrorEmbed('Not Found', `No item named "${itemName}" found!`)] });
    }
    
    const result = await sellCollectibleItem(userId, item._id.toString(), quantity, data);
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Sale Failed', result.message)] });
    }
    
    await saveData(data);
    
    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('💰 Item Sold!')
      .setDescription(result.message)
      .setFooter({ text: `New balance: ${data.users[userId].coins.toLocaleString()} coins` });
    
    return message.reply({ embeds: [embed] });
  }
};

module.exports = [
  itemsCommand,
  myItemsCommand,
  itemInfoCommand,
  equipItemCommand,
  sellItemCommand
];
