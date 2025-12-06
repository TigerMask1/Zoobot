const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { saveData } = require('../../dataManager.js');
const { parseUserMention, createSuccessEmbed, createErrorEmbed, initializeUserData } = require('../../utils/shared.js');
const { 
  createCollectibleItem, 
  getCollectibleItemByName, 
  updateCollectibleItem, 
  awardCollectibleItem,
  getPendingCollectibleSubmissions,
  approveCollectibleSubmission,
  rejectCollectibleSubmission,
  RARITY_CONFIG,
  VALID_CRATE_TYPES
} = require('../../collectibleItemsSystem.js');
const { isSuperAdmin } = require('../../serverConfigManager.js');
const { isMongoConnected } = require('../../mongoManager.js');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function checkMongoConnection(message) {
  if (!isMongoConnected()) {
    message.reply({ embeds: [createErrorEmbed('Database Unavailable', 'The collectible items system requires a database connection. Please try again later.')] });
    return false;
  }
  return true;
}

const ITEMS_IMAGE_DIR = './data/collectible_images';

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(ITEMS_IMAGE_DIR, filename);
    const file = fs.createWriteStream(filepath);
    
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, filename)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

const createItemCommand = {
  name: 'createitem',
  aliases: ['newitem', 'additem'],
  category: 'admin',
  description: 'Create a new collectible item (attach an image)',
  usage: '!createitem <name> <rarity> [description]',
  superAdminOnly: true,
  
  async execute({ message, args, data }) {
    if (!isSuperAdmin(message.author.id)) {
      return message.reply({ embeds: [createErrorEmbed('No Permission', 'Only Super Admins can create items!')] });
    }
    
    if (args.length < 2) {
      const rarities = Object.keys(RARITY_CONFIG).join(', ');
      return message.reply({ embeds: [createErrorEmbed('Usage', `\`!createitem <name> <rarity> [description]\`\n\n**Rarities:** ${rarities}\n\n**Note:** Attach an image to set the item picture!`)] });
    }
    
    const name = args[0];
    const rarity = args[1].toLowerCase();
    const description = args.slice(2).join(' ') || '';
    
    if (!RARITY_CONFIG[rarity]) {
      const rarities = Object.keys(RARITY_CONFIG).join(', ');
      return message.reply({ embeds: [createErrorEmbed('Invalid Rarity', `Valid rarities: ${rarities}`)] });
    }
    
    const existing = await getCollectibleItemByName(name);
    if (existing) {
      return message.reply({ embeds: [createErrorEmbed('Item Exists', `An item named "${name}" already exists!`)] });
    }
    
    let imageUrl = null;
    const attachment = message.attachments.first();
    
    if (attachment) {
      try {
        const ext = path.extname(attachment.name) || '.png';
        const filename = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}${ext}`;
        const filepath = await downloadImage(attachment.url, filename);
        imageUrl = filepath;
      } catch (error) {
        console.error('Error downloading image:', error);
        return message.reply({ embeds: [createErrorEmbed('Image Error', 'Failed to download the attached image!')] });
      }
    }
    
    const serverGame = message.guild?.id || 'global';
    
    const result = await createCollectibleItem({
      name,
      description,
      imageUrl,
      rarity,
      bundle: serverGame,
      isGlobal: true,
      droppable: { enabled: false },
      crateObtainable: { enabled: false, crates: [] },
      createdBy: message.author.id
    });
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Creation Failed', result.message)] });
    }
    
    const rarityConf = RARITY_CONFIG[rarity];
    const embed = new EmbedBuilder()
      .setColor(rarityConf.color)
      .setTitle(`${rarityConf.emoji} New Collectible Item Created!`)
      .setDescription(`**${name}**\n${description || 'No description'}`)
      .addFields(
        { name: 'Rarity', value: `${rarityConf.emoji} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`, inline: true },
        { name: 'Base Value', value: `${rarityConf.baseValue} coins`, inline: true },
        { name: 'Item ID', value: result.itemId.toString(), inline: true }
      )
      .setFooter({ text: `Created by ${message.author.username}` })
      .setTimestamp();
    
    if (imageUrl) {
      embed.setThumbnail(`attachment://${path.basename(imageUrl)}`);
      const file = new AttachmentBuilder(imageUrl);
      return message.reply({ embeds: [embed], files: [file] });
    }
    
    return message.reply({ embeds: [embed] });
  }
};

const reviewItemCommand = {
  name: 'reviewitem',
  aliases: ['pendingitems', 'itemqueue'],
  category: 'admin',
  description: 'View pending item submissions',
  usage: '!reviewitem [page]',
  superAdminOnly: true,
  
  async execute({ message, args }) {
    if (!isSuperAdmin(message.author.id)) {
      return message.reply({ embeds: [createErrorEmbed('No Permission', 'Only Super Admins can review items!')] });
    }
    
    const page = parseInt(args[0]) || 1;
    const { submissions, total, pages } = await getPendingCollectibleSubmissions(page);
    
    if (submissions.length === 0) {
      return message.reply({ embeds: [createSuccessEmbed('No Pending Items', 'There are no items waiting for review!')] });
    }
    
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('📋 Pending Item Submissions')
      .setDescription(`Page ${page}/${pages} • ${total} total submissions`)
      .setFooter({ text: 'Use !approveitem <id> or !rejectitem <id> <reason>' });
    
    for (const sub of submissions) {
      const rarityConf = RARITY_CONFIG[sub.rarity] || RARITY_CONFIG.common;
      embed.addFields({
        name: `${rarityConf.emoji} ${sub.name}`,
        value: `**ID:** \`${sub._id}\`\n**Rarity:** ${sub.rarity}\n**Submitted by:** <@${sub.submittedBy}>\n${sub.description || 'No description'}`,
        inline: false
      });
    }
    
    return message.reply({ embeds: [embed] });
  }
};

const approveItemCommand = {
  name: 'approveitem',
  aliases: ['acceptitem'],
  category: 'admin',
  description: 'Approve a pending item submission',
  usage: '!approveitem <submission_id>',
  superAdminOnly: true,
  
  async execute({ message, args }) {
    if (!isSuperAdmin(message.author.id)) {
      return message.reply({ embeds: [createErrorEmbed('No Permission', 'Only Super Admins can approve items!')] });
    }
    
    if (!args[0]) {
      return message.reply({ embeds: [createErrorEmbed('Usage', '`!approveitem <submission_id>`')] });
    }
    
    const result = await approveCollectibleSubmission(args[0], message.author.id);
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Approval Failed', result.message)] });
    }
    
    return message.reply({ embeds: [createSuccessEmbed('Item Approved!', result.message)] });
  }
};

const rejectItemCommand = {
  name: 'rejectitem',
  aliases: ['denyitem'],
  category: 'admin',
  description: 'Reject a pending item submission',
  usage: '!rejectitem <submission_id> [reason]',
  superAdminOnly: true,
  
  async execute({ message, args }) {
    if (!isSuperAdmin(message.author.id)) {
      return message.reply({ embeds: [createErrorEmbed('No Permission', 'Only Super Admins can reject items!')] });
    }
    
    if (!args[0]) {
      return message.reply({ embeds: [createErrorEmbed('Usage', '`!rejectitem <submission_id> [reason]`')] });
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    const result = await rejectCollectibleSubmission(args[0], message.author.id, reason);
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Rejection Failed', result.message)] });
    }
    
    return message.reply({ embeds: [createSuccessEmbed('Item Rejected', result.message)] });
  }
};

const setItemDropCommand = {
  name: 'setitemdrop',
  aliases: ['itemdrop', 'configitem'],
  category: 'admin',
  description: 'Configure item drop settings (droppable or crate-obtainable)',
  usage: '!setitemdrop <item_name> <crate/drop> <on/off> [crate_types]',
  superAdminOnly: true,
  
  async execute({ message, args }) {
    if (!isSuperAdmin(message.author.id)) {
      return message.reply({ embeds: [createErrorEmbed('No Permission', 'Only Super Admins can configure item drops!')] });
    }
    
    if (args.length < 3) {
      return message.reply({ embeds: [createErrorEmbed('Usage', 
        `\`!setitemdrop <item_name> <crate/drop> <on/off> [crate_types]\`\n\n` +
        `**Examples:**\n` +
        `• \`!setitemdrop "Golden Trophy" crate on gold,legendary\`\n` +
        `• \`!setitemdrop "Lucky Coin" drop on\`\n` +
        `• \`!setitemdrop "Rare Gem" crate off\`\n\n` +
        `**Valid crates:** ${VALID_CRATE_TYPES.join(', ')}`
      )] });
    }
    
    const itemName = args[0].replace(/"/g, '');
    const dropType = args[1].toLowerCase();
    const enabled = args[2].toLowerCase() === 'on';
    const crateTypes = args[3] ? args[3].split(',').map(c => c.trim().toLowerCase()) : [];
    
    if (!['crate', 'drop'].includes(dropType)) {
      return message.reply({ embeds: [createErrorEmbed('Invalid Type', 'Use `crate` or `drop`!')] });
    }
    
    const item = await getCollectibleItemByName(itemName);
    if (!item) {
      return message.reply({ embeds: [createErrorEmbed('Not Found', `No item named "${itemName}" found!`)] });
    }
    
    const updates = {};
    
    if (dropType === 'crate') {
      const invalidCrates = crateTypes.filter(c => !VALID_CRATE_TYPES.includes(c));
      if (invalidCrates.length > 0) {
        return message.reply({ embeds: [createErrorEmbed('Invalid Crates', `Invalid crate types: ${invalidCrates.join(', ')}\n\nValid: ${VALID_CRATE_TYPES.join(', ')}`)] });
      }
      
      updates.crateObtainable = {
        enabled,
        probability: item.crateObtainable?.probability || RARITY_CONFIG[item.rarity]?.dropChance || 5,
        crates: crateTypes
      };
    } else {
      updates.droppable = {
        enabled,
        probability: item.droppable?.probability || RARITY_CONFIG[item.rarity]?.dropChance || 5
      };
    }
    
    const result = await updateCollectibleItem(item._id.toString(), updates);
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Update Failed', result.message)] });
    }
    
    const statusText = enabled ? 'enabled' : 'disabled';
    const crateText = crateTypes.length > 0 ? ` (${crateTypes.join(', ')})` : '';
    
    return message.reply({ embeds: [createSuccessEmbed('Item Updated', 
      `**${item.name}** - ${dropType} drops ${statusText}${crateText}`
    )] });
  }
};

const grantItemCommand = {
  name: 'grantitem',
  aliases: ['giveitem', 'awarditem'],
  category: 'admin',
  description: 'Grant a collectible item to a user',
  usage: '!grantitem @user <item_name> [quantity]',
  adminOnly: true,
  
  async execute({ message, args, data }) {
    if (args.length < 2) {
      return message.reply({ embeds: [createErrorEmbed('Usage', '`!grantitem @user <item_name> [quantity]`')] });
    }
    
    const targetId = parseUserMention(args[0]);
    if (!targetId) {
      return message.reply({ embeds: [createErrorEmbed('Invalid User', 'Please mention a valid user!')] });
    }
    
    const lastArg = args[args.length - 1];
    const quantity = /^\d+$/.test(lastArg) ? parseInt(lastArg) : 1;
    const itemNameParts = /^\d+$/.test(lastArg) ? args.slice(1, -1) : args.slice(1);
    const itemName = itemNameParts.join(' ').replace(/"/g, '');
    
    if (!itemName) {
      return message.reply({ embeds: [createErrorEmbed('Missing Item', 'Please specify an item name!')] });
    }
    
    const item = await getCollectibleItemByName(itemName);
    if (!item) {
      return message.reply({ embeds: [createErrorEmbed('Not Found', `No item named "${itemName}" found!`)] });
    }
    
    initializeUserData(targetId, data);
    
    const result = await awardCollectibleItem(targetId, item._id.toString(), quantity);
    
    if (!result.success) {
      return message.reply({ embeds: [createErrorEmbed('Grant Failed', result.message)] });
    }
    
    let targetUser;
    try {
      targetUser = await message.client.users.fetch(targetId);
    } catch {
      targetUser = { username: 'Unknown User' };
    }
    
    const rarityConf = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
    const embed = new EmbedBuilder()
      .setColor(rarityConf.color)
      .setTitle(`${rarityConf.emoji} Item Granted!`)
      .setDescription(`Granted **${quantity}x ${item.name}** to **${targetUser.username}**!`)
      .setFooter({ text: `Granted by ${message.author.username}` })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};

module.exports = [
  createItemCommand,
  reviewItemCommand,
  approveItemCommand,
  rejectItemCommand,
  setItemDropCommand,
  grantItemCommand
];
