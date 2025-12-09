const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { canSetupServer, isServerOwner } = require('../../serverConfigManager.js');
const { getCollection } = require('../../mongoManager.js');
const crypto = require('crypto');

function generateUniqueId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'ultra rare', 'epic', 'legendary'];
const RARITY_BASE_VALUES = {
  common: 25,
  uncommon: 50,
  rare: 100,
  'ultra rare': 150,
  epic: 250,
  legendary: 500
};

const pendingCreations = new Map();

module.exports = {
  name: 'servercollectible',
  aliases: ['scol', 'createcol', 'addcol', 'mycol'],
  category: 'admin',
  description: 'Create and manage server-specific collectibles',
  usage: '!servercollectible <create|list|view|edit|delete|toggle>',
  adminOnly: true,
  
  async execute({ message, args, data, client }) {
    const member = message.member;
    const userId = message.author.id;
    const serverId = message.guild?.id;
    
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const hasPermission = canSetupServer(userId, serverId, member) || isServerOwner(member);
    
    if (!hasPermission) {
      return message.reply('You need to be the server owner or a server admin to manage server collectibles!');
    }
    
    const subcommand = args[0]?.toLowerCase() || 'help';
    
    switch (subcommand) {
      case 'create':
      case 'add':
      case 'new':
        return handleCreate(message, serverId, userId, client);
      case 'list':
      case 'ls':
        return handleList(message, serverId);
      case 'view':
      case 'show':
        return handleView(message, serverId, args.slice(1).join(' '));
      case 'edit':
      case 'modify':
        return handleEdit(message, serverId, args.slice(1).join(' '), userId, client);
      case 'delete':
      case 'remove':
        return handleDelete(message, serverId, args.slice(1).join(' '), userId, client);
      case 'toggle':
        return handleToggle(message, serverId, args.slice(1).join(' '), userId);
      default:
        return showHelp(message);
    }
  }
};

function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('Server Collectible Management')
    .setDescription('Create and manage collectibles exclusive to your server!')
    .addFields(
      { name: '`!scol create`', value: 'Start creating a new collectible (interactive)', inline: true },
      { name: '`!scol list`', value: 'View all your server collectibles', inline: true },
      { name: '`!scol view <name>`', value: 'View details of a collectible', inline: true },
      { name: '`!scol edit <name>`', value: 'Edit an existing collectible', inline: true },
      { name: '`!scol delete <name>`', value: 'Delete a collectible', inline: true },
      { name: '`!scol toggle <name>`', value: 'Enable/disable a collectible', inline: true }
    )
    .addFields(
      { name: 'Important Notes', value: 
        '- Collectibles you create are **exclusive** to your server\n' +
        '- They will only appear in drops on **your server**\n' +
        '- Players can only collect them in **your server**\n' +
        '- You **cannot** create coins, gems, or currency items\n' +
        '- Collectibles can be traded between players on your server'
      }
    )
    .setFooter({ text: 'Server owners and admins only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleCreate(message, serverId, userId, client) {
  const creationId = `${serverId}-${userId}-${Date.now()}`;
  
  const uniqueId = generateUniqueId();
  
  const newCollectible = {
    serverId,
    uniqueId,
    createdBy: userId,
    createdAt: new Date(),
    status: 'active',
    step: 1,
    name: null,
    emoji: null,
    description: null,
    imageUrl: null,
    rarity: 'common',
    baseValue: 25,
    tradable: true,
    giftable: true,
    sellable: true,
    stackable: true,
    isPublic: false,
    dropSettings: {
      enabled: true,
      probability: 5
    },
    crateSettings: {
      enabled: true,
      probability: 10,
      crates: ['bronze', 'silver', 'gold']
    }
  };
  
  pendingCreations.set(creationId, newCollectible);
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('Create New Server Collectible - Step 1/8')
    .setDescription(
      'Let\'s create a new collectible for your server!\n\n' +
      '**Step 1: Collectible Name**\n' +
      'Please reply with the name of your collectible.\n\n' +
      '*Example: Golden Trophy, Magic Crystal, Server Badge*\n\n' +
      '⚠️ **Note:** You cannot name collectibles after currencies (coin, gem, currency, money, etc.)'
    )
    .setFooter({ text: `Type your answer below or "cancel" to stop | ID: ${uniqueId}` })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 300000, max: 15 });
  
  collector.on('collect', async (m) => {
    const colData = pendingCreations.get(creationId);
    if (!colData) {
      collector.stop('cancelled');
      return;
    }
    
    const content = m.content.trim();
    
    if (content.toLowerCase() === 'cancel') {
      pendingCreations.delete(creationId);
      collector.stop('cancelled');
      await m.reply('Collectible creation cancelled.');
      return;
    }
    
    switch (colData.step) {
      case 1:
        if (content.length < 2 || content.length > 30) {
          await m.reply('Name must be between 2 and 30 characters. Please try again.');
          return;
        }
        const blockedNames = ['coin', 'coins', 'gem', 'gems', 'currency', 'money', 'gold', 'silver', 'cash', 'credit', 'credits', 'shard', 'shards', 'token', 'tokens'];
        if (blockedNames.some(blocked => content.toLowerCase().includes(blocked))) {
          await m.reply('You cannot create collectibles with currency-related names (coin, gem, money, etc.) to keep the economy stable. Please choose a different name.');
          return;
        }
        const existingCol = await getServerCollectibleByName(serverId, content);
        if (existingCol) {
          await m.reply('A collectible with this name already exists in your server. Please choose a different name.');
          return;
        }
        colData.name = content;
        colData.step = 2;
        await sendStep2(m, colData);
        break;
        
      case 2:
        colData.emoji = content.substring(0, 50);
        colData.step = 3;
        await sendStep3(m, colData);
        break;
        
      case 3:
        if (content.length < 10 || content.length > 200) {
          await m.reply('Description must be between 10 and 200 characters. Please try again.');
          return;
        }
        colData.description = content;
        colData.step = 4;
        await sendStep4(m, colData);
        break;
        
      case 4:
        if (content.toLowerCase() === 'skip') {
          colData.imageUrl = null;
        } else if (!content.startsWith('http')) {
          await m.reply('Please enter a valid image URL starting with http:// or https://, or type "skip".');
          return;
        } else {
          colData.imageUrl = content;
        }
        colData.step = 5;
        await sendStep5(m, colData);
        break;
        
      case 5:
        const rarityLower = content.toLowerCase();
        if (!RARITY_OPTIONS.includes(rarityLower)) {
          await m.reply(`Invalid rarity. Please choose from: ${RARITY_OPTIONS.join(', ')}`);
          return;
        }
        colData.rarity = rarityLower;
        colData.baseValue = RARITY_BASE_VALUES[rarityLower];
        colData.step = 6;
        await sendStep6(m, colData);
        break;
        
      case 6:
        const opts = content.toLowerCase().split(/[\s,]+/);
        colData.tradable = opts.includes('trade') || opts.includes('tradable') || opts.includes('all');
        colData.giftable = opts.includes('gift') || opts.includes('giftable') || opts.includes('all');
        colData.sellable = opts.includes('sell') || opts.includes('sellable') || opts.includes('all');
        colData.stackable = !opts.includes('nostack');
        if (opts.includes('none')) {
          colData.tradable = false;
          colData.giftable = false;
          colData.sellable = false;
        }
        colData.step = 7;
        await sendStep7(m, colData);
        break;
        
      case 7:
        const dropOpts = content.toLowerCase().split(/[\s,]+/);
        const dropEnabled = dropOpts[0] === 'yes' || dropOpts[0] === 'on' || dropOpts[0] === 'true';
        const dropProb = parseInt(dropOpts[1]) || 5;
        colData.dropSettings = { 
          enabled: dropEnabled, 
          probability: Math.min(100, Math.max(1, dropProb)) 
        };
        colData.step = 8;
        await sendStep8(m, colData);
        break;
        
      case 8:
        const publicChoice = content.toLowerCase();
        if (publicChoice === 'yes' || publicChoice === 'public' || publicChoice === 'y') {
          colData.isPublic = true;
          colData.pendingApproval = true;
        } else {
          colData.isPublic = false;
          colData.pendingApproval = false;
        }
        await finalizeCollectible(m, serverId, colData, creationId);
        collector.stop('completed');
        break;
    }
    
    pendingCreations.set(creationId, colData);
  });
  
  collector.on('end', (collected, reason) => {
    if (reason !== 'completed' && reason !== 'cancelled') {
      pendingCreations.delete(creationId);
      message.channel.send('Collectible creation timed out. Please start again with `!scol create`.');
    }
  });
}

async function sendStep2(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 2/8`)
    .setDescription(
      '**Step 2: Collectible Emoji**\n' +
      'Enter an emoji or custom emoji for your collectible.\n\n' +
      '*Example: 🏆, 💎, <:myemoji:123456789>*'
    )
    .setFooter({ text: 'Type your answer or "cancel" to stop' });
  await m.reply({ embeds: [embed] });
}

async function sendStep3(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 3/8`)
    .setDescription(
      '**Step 3: Collectible Description**\n' +
      'Enter a description for your collectible (10-200 characters).\n\n' +
      '*Example: A shiny trophy awarded to the most dedicated members.*'
    )
    .setFooter({ text: 'Type your answer or "cancel" to stop' });
  await m.reply({ embeds: [embed] });
}

async function sendStep4(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 4/8`)
    .setDescription(
      '**Step 4: Collectible Image (Optional)**\n' +
      'Enter an image URL for your collectible, or type "skip".\n\n' +
      '*The image will be shown when viewing the collectible.*'
    )
    .setFooter({ text: 'Enter a URL or type "skip"' });
  await m.reply({ embeds: [embed] });
}

async function sendStep5(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 5/8`)
    .setDescription(
      '**Step 5: Collectible Rarity**\n' +
      'Choose how rare this collectible will be:\n\n' +
      '• `common` - Easy to find (Value: 25)\n' +
      '• `uncommon` - Somewhat rare (Value: 50)\n' +
      '• `rare` - Hard to find (Value: 100)\n' +
      '• `ultra rare` - Very hard to find (Value: 150)\n' +
      '• `epic` - Extremely rare (Value: 250)\n' +
      '• `legendary` - Almost impossible (Value: 500)'
    )
    .setFooter({ text: 'Type a rarity level' });
  await m.reply({ embeds: [embed] });
}

async function sendStep6(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 6/8`)
    .setDescription(
      '**Step 6: Trading Options**\n' +
      'What can players do with this collectible?\n\n' +
      'Type the options you want to enable (separated by spaces):\n' +
      '• `trade` - Can be traded with other players\n' +
      '• `gift` - Can be gifted to other players\n' +
      '• `sell` - Can be sold for coins\n' +
      '• `all` - Enable all of the above\n' +
      '• `none` - Disable all (soulbound)\n' +
      '• `nostack` - Cannot stack multiples\n\n' +
      '*Example: trade gift sell*\n' +
      '*Example: all*\n' +
      '*Example: none*'
    )
    .setFooter({ text: 'Type your options' });
  await m.reply({ embeds: [embed] });
}

async function sendStep7(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 7/8`)
    .setDescription(
      '**Step 7: Drop Settings**\n' +
      'Should this collectible appear in drops?\n\n' +
      'Format: `yes/no probability`\n\n' +
      '*Example: yes 5* (enabled, 5% chance)\n' +
      '*Example: no* (disabled)'
    )
    .setFooter({ text: 'Enter drop settings' });
  await m.reply({ embeds: [embed] });
}

async function sendStep8(m, colData) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Create "${colData.name}" - Step 8/8`)
    .setDescription(
      '**Step 8: Public Visibility**\n' +
      'Would you like to make this collectible public so other servers can add it?\n\n' +
      '• `yes` - Request public approval (Super Admins will review)\n' +
      '• `no` - Keep private to your server only\n\n' +
      '*Public collectibles can be added by any server once approved.*'
    )
    .setFooter({ text: 'Type "yes" or "no"' });
  await m.reply({ embeds: [embed] });
}

async function finalizeCollectible(m, serverId, colData, creationId) {
  try {
    const collection = await getCollection('serverCollectibles');
    
    const collectibleDoc = {
      serverId: colData.serverId,
      uniqueId: colData.uniqueId,
      name: colData.name,
      emoji: colData.emoji,
      description: colData.description,
      imageUrl: colData.imageUrl,
      rarity: colData.rarity,
      baseValue: colData.baseValue,
      tradable: colData.tradable,
      giftable: colData.giftable,
      sellable: colData.sellable,
      stackable: colData.stackable,
      isPublic: colData.isPublic,
      pendingApproval: colData.pendingApproval || false,
      dropSettings: colData.dropSettings,
      crateSettings: colData.crateSettings,
      status: 'active',
      createdBy: colData.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerCount: 0,
      totalQuantity: 0
    };
    
    await collection.insertOne(collectibleDoc);
    
    pendingCreations.delete(creationId);
    
    const rarityColors = {
      common: 0x95A5A6,
      uncommon: 0x2ECC71,
      rare: 0x3498DB,
      'ultra rare': 0x00CED1,
      epic: 0x9B59B6,
      legendary: 0xFFD700
    };
    
    const tradingInfo = [];
    if (colData.tradable) tradingInfo.push('Tradable');
    if (colData.giftable) tradingInfo.push('Giftable');
    if (colData.sellable) tradingInfo.push('Sellable');
    if (!colData.stackable) tradingInfo.push('Non-stackable');
    
    const visibilityStatus = colData.pendingApproval 
      ? '⏳ Pending Approval (will be public once approved)' 
      : (colData.isPublic ? '🌐 Public' : '🔒 Private');
    
    const embed = new EmbedBuilder()
      .setColor(rarityColors[colData.rarity] || 0x9B59B6)
      .setTitle('Collectible Created Successfully!')
      .setDescription(`${colData.emoji} **${colData.name}** has been added to your server!`)
      .addFields(
        { name: 'Unique ID', value: `\`${colData.uniqueId}\``, inline: true },
        { name: 'Visibility', value: visibilityStatus, inline: true },
        { name: 'Description', value: colData.description, inline: false },
        { name: 'Rarity', value: colData.rarity.toUpperCase(), inline: true },
        { name: 'Base Value', value: `${colData.baseValue} coins`, inline: true },
        { name: 'Trading', value: tradingInfo.length > 0 ? tradingInfo.join(', ') : 'Soulbound', inline: false },
        { name: 'Drop Settings', value: colData.dropSettings.enabled ? `Enabled (${colData.dropSettings.probability}% chance)` : 'Disabled', inline: true }
      )
      .setFooter({ text: colData.isPublic ? 'Other servers can add this collectible once approved!' : 'This collectible is exclusive to your server!' })
      .setTimestamp();
    
    if (colData.imageUrl) {
      embed.setThumbnail(colData.imageUrl);
    }
    
    await m.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error creating server collectible:', error);
    await m.reply('An error occurred while creating the collectible. Please try again.');
    pendingCreations.delete(creationId);
  }
}

async function getServerCollectibleByName(serverId, name) {
  try {
    const collection = await getCollection('serverCollectibles');
    return await collection.findOne({ 
      serverId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
  } catch (error) {
    console.error('Error getting server collectible:', error);
    return null;
  }
}

async function handleList(message, serverId) {
  try {
    const collection = await getCollection('serverCollectibles');
    const collectibles = await collection.find({ serverId }).sort({ createdAt: -1 }).toArray();
    
    if (collectibles.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('No Server Collectibles')
        .setDescription('Your server doesn\'t have any custom collectibles yet!\n\nUse `!scol create` to create your first collectible.')
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
    
    const rarityEmojis = {
      common: '⚪',
      uncommon: '🟢',
      rare: '🔵',
      'ultra rare': '💎',
      epic: '💜',
      legendary: '🌟'
    };
    
    const colList = collectibles.map((c, i) => {
      const statusIcon = c.status === 'active' ? '✅' : '❌';
      const rarityIcon = rarityEmojis[c.rarity] || '⚪';
      return `${i + 1}. ${statusIcon} ${c.emoji} **${c.name}** ${rarityIcon} ${c.rarity} (${c.baseValue} coins)`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`Server Collectibles (${collectibles.length})`)
      .setDescription(colList)
      .addFields(
        { name: 'Legend', value: '✅ Active | ❌ Disabled | ⚪ Common | 🟢 Uncommon | 🔵 Rare | 💎 Ultra Rare | 💜 Epic | 🌟 Legendary' }
      )
      .setFooter({ text: 'Use !scol view <name> to see details' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error listing server collectibles:', error);
    return message.reply('An error occurred while fetching collectibles.');
  }
}

async function handleView(message, serverId, name) {
  if (!name) {
    return message.reply('Please specify a collectible name: `!scol view <name>`');
  }
  
  const collectible = await getServerCollectibleByName(serverId, name);
  
  if (!collectible) {
    return message.reply(`No collectible found with name "${name}". Use \`!scol list\` to see all collectibles.`);
  }
  
  const rarityColors = {
    common: 0x95A5A6,
    uncommon: 0x2ECC71,
    rare: 0x3498DB,
    'ultra rare': 0x00CED1,
    epic: 0x9B59B6,
    legendary: 0xFFD700
  };
  
  const tradingInfo = [];
  if (collectible.tradable) tradingInfo.push('Tradable');
  if (collectible.giftable) tradingInfo.push('Giftable');
  if (collectible.sellable) tradingInfo.push('Sellable');
  if (!collectible.stackable) tradingInfo.push('Non-stackable');
  
  const embed = new EmbedBuilder()
    .setColor(rarityColors[collectible.rarity] || 0x9B59B6)
    .setTitle(`${collectible.emoji} ${collectible.name}`)
    .setDescription(collectible.description || 'No description')
    .addFields(
      { name: 'Rarity', value: collectible.rarity.toUpperCase(), inline: true },
      { name: 'Base Value', value: `${collectible.baseValue} coins`, inline: true },
      { name: 'Status', value: collectible.status === 'active' ? '✅ Active' : '❌ Disabled', inline: true },
      { name: 'Trading Options', value: tradingInfo.length > 0 ? tradingInfo.join(', ') : 'Soulbound (no trading)', inline: false },
      { name: 'Drop Settings', value: `Enabled: ${collectible.dropSettings?.enabled ? 'Yes' : 'No'}\nProbability: ${collectible.dropSettings?.probability || 5}%`, inline: true },
      { name: 'Stats', value: `Owners: ${collectible.ownerCount || 0}\nTotal in circulation: ${collectible.totalQuantity || 0}`, inline: true }
    )
    .setFooter({ text: `Created by ${collectible.createdBy} | ID: ${collectible._id}` })
    .setTimestamp(collectible.createdAt);
  
  if (collectible.imageUrl) {
    embed.setThumbnail(collectible.imageUrl);
  }
  
  return message.reply({ embeds: [embed] });
}

async function handleDelete(message, serverId, name, userId, client) {
  if (!name) {
    return message.reply('Please specify a collectible name: `!scol delete <name>`');
  }
  
  const collectible = await getServerCollectibleByName(serverId, name);
  
  if (!collectible) {
    return message.reply(`No collectible found with name "${name}".`);
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Confirm Deletion')
    .setDescription(`Are you sure you want to delete **${collectible.name}**?\n\n⚠️ This action cannot be undone!\n⚠️ Players who own this collectible will lose it!`)
    .setTimestamp();
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`delete_col_confirm_${collectible._id}`)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`delete_col_cancel_${collectible._id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const reply = await message.reply({ embeds: [embed], components: [row] });
  
  const filter = i => i.user.id === userId && i.customId.includes(collectible._id.toString());
  
  try {
    const interaction = await reply.awaitMessageComponent({ filter, time: 30000 });
    
    if (interaction.customId.startsWith('delete_col_confirm')) {
      const collection = await getCollection('serverCollectibles');
      await collection.deleteOne({ _id: collectible._id });
      
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Collectible Deleted')
          .setDescription(`**${collectible.name}** has been deleted.`)
          .setTimestamp()
        ],
        components: []
      });
    } else {
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x95A5A6)
          .setTitle('Deletion Cancelled')
          .setDescription('The collectible was not deleted.')
          .setTimestamp()
        ],
        components: []
      });
    }
  } catch (error) {
    await reply.edit({
      embeds: [new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('Timed Out')
        .setDescription('Deletion cancelled due to timeout.')
        .setTimestamp()
      ],
      components: []
    });
  }
}

async function handleToggle(message, serverId, name, userId) {
  if (!name) {
    return message.reply('Please specify a collectible name: `!scol toggle <name>`');
  }
  
  const collectible = await getServerCollectibleByName(serverId, name);
  
  if (!collectible) {
    return message.reply(`No collectible found with name "${name}".`);
  }
  
  try {
    const collection = await getCollection('serverCollectibles');
    const newStatus = collectible.status === 'active' ? 'disabled' : 'active';
    
    await collection.updateOne(
      { _id: collectible._id },
      { $set: { status: newStatus, updatedAt: new Date() } }
    );
    
    const embed = new EmbedBuilder()
      .setColor(newStatus === 'active' ? 0x00FF00 : 0xFF6B6B)
      .setTitle('Collectible Status Updated')
      .setDescription(`${collectible.emoji} **${collectible.name}** is now ${newStatus === 'active' ? '✅ **Active**' : '❌ **Disabled**'}`)
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error toggling collectible:', error);
    return message.reply('An error occurred while updating the collectible.');
  }
}

async function handleEdit(message, serverId, name, userId, client) {
  if (!name) {
    return message.reply('Please specify a collectible name: `!scol edit <name>`');
  }
  
  const collectible = await getServerCollectibleByName(serverId, name);
  
  if (!collectible) {
    return message.reply(`No collectible found with name "${name}".`);
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`Edit ${collectible.name}`)
    .setDescription('What would you like to edit? Reply with a number:\n\n' +
      '1. Name\n' +
      '2. Emoji\n' +
      '3. Description\n' +
      '4. Image URL\n' +
      '5. Rarity\n' +
      '6. Trading Options (trade/gift/sell)\n' +
      '7. Drop Settings\n\n' +
      'Or type "cancel" to exit.'
    )
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 120000, max: 10 });
  
  let editField = null;
  
  collector.on('collect', async (m) => {
    const content = m.content.trim().toLowerCase();
    
    if (content === 'cancel') {
      collector.stop('cancelled');
      await m.reply('Edit cancelled.');
      return;
    }
    
    if (!editField) {
      const choice = parseInt(content);
      if (isNaN(choice) || choice < 1 || choice > 7) {
        await m.reply('Please enter a number between 1 and 7.');
        return;
      }
      
      editField = choice;
      await sendEditPrompt(m, choice, collectible);
      return;
    }
    
    try {
      const collection = await getCollection('serverCollectibles');
      let updateData = {};
      
      switch (editField) {
        case 1:
          if (m.content.length < 2 || m.content.length > 30) {
            await m.reply('Name must be 2-30 characters.');
            return;
          }
          const blockedNames = ['coin', 'coins', 'gem', 'gems', 'currency', 'money', 'gold', 'silver', 'cash', 'credit', 'credits', 'shard', 'shards', 'token', 'tokens'];
          if (blockedNames.some(blocked => m.content.toLowerCase().includes(blocked))) {
            await m.reply('Cannot use currency-related names.');
            return;
          }
          updateData.name = m.content;
          break;
        case 2:
          updateData.emoji = m.content.substring(0, 50);
          break;
        case 3:
          if (m.content.length < 10 || m.content.length > 200) {
            await m.reply('Description must be 10-200 characters.');
            return;
          }
          updateData.description = m.content;
          break;
        case 4:
          if (m.content.toLowerCase() !== 'clear' && !m.content.startsWith('http')) {
            await m.reply('Enter a valid URL or "clear".');
            return;
          }
          updateData.imageUrl = m.content.toLowerCase() === 'clear' ? null : m.content;
          break;
        case 5:
          if (!RARITY_OPTIONS.includes(m.content.toLowerCase())) {
            await m.reply(`Invalid. Options: ${RARITY_OPTIONS.join(', ')}`);
            return;
          }
          updateData.rarity = m.content.toLowerCase();
          updateData.baseValue = RARITY_BASE_VALUES[m.content.toLowerCase()];
          break;
        case 6:
          const opts = m.content.toLowerCase().split(/[\s,]+/);
          updateData.tradable = opts.includes('trade') || opts.includes('tradable') || opts.includes('all');
          updateData.giftable = opts.includes('gift') || opts.includes('giftable') || opts.includes('all');
          updateData.sellable = opts.includes('sell') || opts.includes('sellable') || opts.includes('all');
          if (opts.includes('none')) {
            updateData.tradable = false;
            updateData.giftable = false;
            updateData.sellable = false;
          }
          break;
        case 7:
          const dropParts = m.content.toLowerCase().split(/[\s,]+/);
          const dropEnabled = dropParts[0] === 'on' || dropParts[0] === 'true' || dropParts[0] === 'yes';
          const dropProb = parseInt(dropParts[1]) || 5;
          updateData.dropSettings = { enabled: dropEnabled, probability: Math.min(100, Math.max(1, dropProb)) };
          break;
      }
      
      updateData.updatedAt = new Date();
      
      await collection.updateOne(
        { _id: collectible._id },
        { $set: updateData }
      );
      
      await m.reply(`✅ Collectible updated successfully!`);
      collector.stop('completed');
      
    } catch (error) {
      console.error('Error updating collectible:', error);
      await m.reply('Error updating collectible.');
    }
  });
  
  collector.on('end', (collected, reason) => {
    if (reason !== 'completed' && reason !== 'cancelled') {
      message.channel.send('Edit timed out.');
    }
  });
}

async function sendEditPrompt(m, choice, collectible) {
  const tradingInfo = [];
  if (collectible.tradable) tradingInfo.push('trade');
  if (collectible.giftable) tradingInfo.push('gift');
  if (collectible.sellable) tradingInfo.push('sell');
  
  const prompts = {
    1: `Current name: **${collectible.name}**\nEnter new name:`,
    2: `Current emoji: ${collectible.emoji}\nEnter new emoji:`,
    3: `Current description: ${collectible.description}\nEnter new description (10-200 chars):`,
    4: `Current image: ${collectible.imageUrl || 'None'}\nEnter new URL or "clear":`,
    5: `Current rarity: ${collectible.rarity}\nOptions: ${RARITY_OPTIONS.join(', ')}`,
    6: `Current: ${tradingInfo.length > 0 ? tradingInfo.join(', ') : 'none'}\nEnter: trade gift sell / all / none`,
    7: `Current: ${collectible.dropSettings?.enabled ? 'On' : 'Off'}, ${collectible.dropSettings?.probability}%\nEnter: yes/no probability (e.g., "yes 5")`
  };
  
  await m.reply(prompts[choice]);
}
