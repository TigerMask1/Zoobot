const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isSuperAdmin, isGlobalBotAdmin } = require('../../serverConfigManager.js');
const { getCollection } = require('../../mongoManager.js');
const characterManager = require('../../characterManager.js');
const crypto = require('crypto');

function generateUniqueId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = {
  name: 'superadmin',
  aliases: ['sa', 'globaladmin', 'botowner'],
  category: 'admin',
  description: 'Super admin commands for global character/collectible management',
  usage: '!superadmin <subcommand>',
  adminOnly: true,
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    
    if (!isSuperAdmin(userId) && !isGlobalBotAdmin(userId)) {
      return message.reply('This command is only available to Super Admins and Bot Admins!');
    }
    
    const subcommand = args[0]?.toLowerCase() || 'help';
    
    switch (subcommand) {
      case 'createchar':
      case 'addglobalchar':
        return handleCreateGlobalCharacter(message, args.slice(1), userId);
      case 'createcol':
      case 'addglobalcol':
        return handleCreateGlobalCollectible(message, args.slice(1), userId);
      case 'approve':
        return handleApproveCharacter(message, args.slice(1), userId);
      case 'reject':
        return handleRejectCharacter(message, args.slice(1), userId);
      case 'setpublic':
        return handleSetPublic(message, args.slice(1), userId, true);
      case 'setprivate':
        return handleSetPublic(message, args.slice(1), userId, false);
      case 'deletechar':
        return handleDeleteGlobalCharacter(message, args.slice(1), userId);
      case 'deletecol':
        return handleDeleteGlobalCollectible(message, args.slice(1), userId);
      case 'stats':
        return handleStats(message);
      case 'pending':
        return handlePendingApprovals(message);
      default:
        return showHelp(message);
    }
  }
};

function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('Super Admin Commands')
    .setDescription('Commands for managing global characters and collectibles.')
    .addFields(
      { name: 'Character Management', value: 
        '`!sa createchar` - Create a global character (interactive)\n' +
        '`!sa deletechar <id>` - Delete a global character\n' +
        '`!sa setpublic <id>` - Make a character public\n' +
        '`!sa setprivate <id>` - Make a character private'
      },
      { name: 'Collectible Management', value: 
        '`!sa createcol` - Create a global collectible (interactive)\n' +
        '`!sa deletecol <id>` - Delete a global collectible'
      },
      { name: 'Approval System', value: 
        '`!sa pending` - View pending character approvals\n' +
        '`!sa approve <id>` - Approve a character to be public\n' +
        '`!sa reject <id> [reason]` - Reject with optional reason'
      },
      { name: 'Statistics', value: 
        '`!sa stats` - View global statistics'
      }
    )
    .setFooter({ text: 'Super Admins and Bot Admins only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleCreateGlobalCharacter(message, args, userId) {
  const uniqueId = generateUniqueId();
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('Create Global Character')
    .setDescription(
      'Creating a new global character. Please provide the details in order:\n\n' +
      '**Format:** Name | Emoji | Description | Rarity | ImageURL\n\n' +
      '*Example:*\n' +
      '`Shadow Wolf | 🐺 | A mysterious wolf from the dark forest | legendary | https://example.com/wolf.png`\n\n' +
      'Or type "cancel" to stop.'
    )
    .setFooter({ text: `Unique ID will be: ${uniqueId}` })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 300000, max: 1 });
  
  collector.on('collect', async (m) => {
    if (m.content.toLowerCase() === 'cancel') {
      return m.reply('Character creation cancelled.');
    }
    
    const parts = m.content.split('|').map(p => p.trim());
    if (parts.length < 4) {
      return m.reply('Invalid format. Please provide: Name | Emoji | Description | Rarity | ImageURL (optional)');
    }
    
    const [name, emoji, description, rarity, imageUrl] = parts;
    const validRarities = ['common', 'uncommon', 'rare', 'ultra rare', 'epic', 'legendary'];
    
    if (!validRarities.includes(rarity.toLowerCase())) {
      return m.reply(`Invalid rarity. Choose from: ${validRarities.join(', ')}`);
    }
    
    try {
      const collection = await getCollection('globalCharacters');
      
      const characterDoc = {
        uniqueId,
        name,
        emoji,
        description,
        rarity: rarity.toLowerCase(),
        imageUrl: imageUrl || null,
        isPublic: true,
        status: 'active',
        obtainable: 'drop',
        ability: {
          name: 'Default Ability',
          emoji: '⚡',
          description: 'A standard ability',
          effectType: 'flatDamageBonus',
          effectValue: 5
        },
        specialMove: {
          name: 'Special Attack',
          damage: 30
        },
        stats: {
          hp: 100,
          attack: 15,
          defense: 10,
          speed: 10
        },
        dropSettings: { enabled: true, probability: 5 },
        crateSettings: { enabled: true, probability: 10, crates: ['bronze', 'silver', 'gold'] },
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await collection.insertOne(characterDoc);
      
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Global Character Created!')
        .setDescription(`${emoji} **${name}** has been created!`)
        .addFields(
          { name: 'Unique ID', value: `\`${uniqueId}\``, inline: true },
          { name: 'Rarity', value: rarity.toUpperCase(), inline: true },
          { name: 'Status', value: '✅ Active & Public', inline: true }
        )
        .setFooter({ text: 'This character is now available for all servers to add!' })
        .setTimestamp();
      
      if (imageUrl) {
        successEmbed.setThumbnail(imageUrl);
      }
      
      await m.reply({ embeds: [successEmbed] });
      
    } catch (error) {
      console.error('Error creating global character:', error);
      await m.reply('An error occurred while creating the character.');
    }
  });
}

async function handleCreateGlobalCollectible(message, args, userId) {
  const uniqueId = generateUniqueId();
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('Create Global Collectible')
    .setDescription(
      'Creating a new global collectible. Please provide the details:\n\n' +
      '**Format:** Name | Emoji | Description | Rarity | Value | ImageURL\n\n' +
      '*Example:*\n' +
      '`Golden Crown | 👑 | A magnificent golden crown | legendary | 500 | https://example.com/crown.png`\n\n' +
      'Or type "cancel" to stop.'
    )
    .setFooter({ text: `Unique ID will be: ${uniqueId}` })
    .setTimestamp();
  
  await message.reply({ embeds: [embed] });
  
  const filter = m => m.author.id === userId;
  const collector = message.channel.createMessageCollector({ filter, time: 300000, max: 1 });
  
  collector.on('collect', async (m) => {
    if (m.content.toLowerCase() === 'cancel') {
      return m.reply('Collectible creation cancelled.');
    }
    
    const parts = m.content.split('|').map(p => p.trim());
    if (parts.length < 5) {
      return m.reply('Invalid format. Please provide: Name | Emoji | Description | Rarity | Value | ImageURL (optional)');
    }
    
    const [name, emoji, description, rarity, valueStr, imageUrl] = parts;
    const value = parseInt(valueStr) || 100;
    const validRarities = ['common', 'uncommon', 'rare', 'ultra rare', 'epic', 'legendary'];
    
    if (!validRarities.includes(rarity.toLowerCase())) {
      return m.reply(`Invalid rarity. Choose from: ${validRarities.join(', ')}`);
    }
    
    try {
      const collection = await getCollection('globalCollectibles');
      
      const collectibleDoc = {
        uniqueId,
        name,
        emoji,
        description,
        rarity: rarity.toLowerCase(),
        baseValue: value,
        imageUrl: imageUrl || null,
        isPublic: true,
        status: 'active',
        tradable: true,
        giftable: true,
        sellable: true,
        stackable: true,
        dropSettings: { enabled: true, probability: 5 },
        crateSettings: { enabled: true, probability: 10, crates: ['bronze', 'silver', 'gold'] },
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerCount: 0,
        totalQuantity: 0
      };
      
      await collection.insertOne(collectibleDoc);
      
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Global Collectible Created!')
        .setDescription(`${emoji} **${name}** has been created!`)
        .addFields(
          { name: 'Unique ID', value: `\`${uniqueId}\``, inline: true },
          { name: 'Rarity', value: rarity.toUpperCase(), inline: true },
          { name: 'Value', value: `${value} coins`, inline: true }
        )
        .setFooter({ text: 'This collectible is now available for all servers to add!' })
        .setTimestamp();
      
      if (imageUrl) {
        successEmbed.setThumbnail(imageUrl);
      }
      
      await m.reply({ embeds: [successEmbed] });
      
    } catch (error) {
      console.error('Error creating global collectible:', error);
      await m.reply('An error occurred while creating the collectible.');
    }
  });
}

async function handleSetPublic(message, args, userId, isPublic) {
  const identifier = args.join(' ');
  if (!identifier) {
    return message.reply(`Please specify a character/collectible ID: \`!sa set${isPublic ? 'public' : 'private'} <id>\``);
  }
  
  try {
    const globalCharsCol = await getCollection('globalCharacters');
    const serverCharsCol = await getCollection('serverCharacters');
    const globalColsCol = await getCollection('globalCollectibles');
    const serverColsCol = await getCollection('serverCollectibles');
    
    let updated = false;
    let itemName = '';
    
    let result = await globalCharsCol.updateOne(
      { uniqueId: identifier.toUpperCase() },
      { $set: { isPublic, updatedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      const char = await globalCharsCol.findOne({ uniqueId: identifier.toUpperCase() });
      itemName = char?.name || identifier;
      updated = true;
    }
    
    if (!updated) {
      result = await serverCharsCol.updateOne(
        { uniqueId: identifier.toUpperCase() },
        { $set: { isPublic, updatedAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        const char = await serverCharsCol.findOne({ uniqueId: identifier.toUpperCase() });
        itemName = char?.name || identifier;
        updated = true;
      }
    }
    
    if (!updated) {
      result = await globalColsCol.updateOne(
        { uniqueId: identifier.toUpperCase() },
        { $set: { isPublic, updatedAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        const col = await globalColsCol.findOne({ uniqueId: identifier.toUpperCase() });
        itemName = col?.name || identifier;
        updated = true;
      }
    }
    
    if (!updated) {
      result = await serverColsCol.updateOne(
        { uniqueId: identifier.toUpperCase() },
        { $set: { isPublic, updatedAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        const col = await serverColsCol.findOne({ uniqueId: identifier.toUpperCase() });
        itemName = col?.name || identifier;
        updated = true;
      }
    }
    
    if (updated) {
      const embed = new EmbedBuilder()
        .setColor(isPublic ? 0x00FF00 : 0xFF6B6B)
        .setTitle(`Visibility Updated`)
        .setDescription(`**${itemName}** is now ${isPublic ? '🌐 **Public**' : '🔒 **Private**'}`)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }
    
    return message.reply(`No character or collectible found with ID "${identifier}".`);
    
  } catch (error) {
    console.error('Error updating visibility:', error);
    return message.reply('An error occurred while updating visibility.');
  }
}

async function handleDeleteGlobalCharacter(message, args, userId) {
  const identifier = args.join(' ');
  if (!identifier) {
    return message.reply('Please specify a character ID: `!sa deletechar <id>`');
  }
  
  try {
    const collection = await getCollection('globalCharacters');
    const character = await collection.findOne({ uniqueId: identifier.toUpperCase() });
    
    if (!character) {
      return message.reply(`No global character found with ID "${identifier}".`);
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('Confirm Deletion')
      .setDescription(`Are you sure you want to delete **${character.name}**?\n\n⚠️ This will remove it from ALL servers!`)
      .setTimestamp();
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`sa_delete_confirm_${character.uniqueId}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`sa_delete_cancel_${character.uniqueId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const reply = await message.reply({ embeds: [embed], components: [row] });
    
    const filter = i => i.user.id === userId;
    
    try {
      const interaction = await reply.awaitMessageComponent({ filter, time: 30000 });
      
      if (interaction.customId.startsWith('sa_delete_confirm')) {
        await collection.deleteOne({ uniqueId: character.uniqueId });
        
        const serverAddedCol = await getCollection('serverAddedCharacters');
        await serverAddedCol.deleteMany({ characterId: character.uniqueId });
        
        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Character Deleted')
            .setDescription(`**${character.name}** has been deleted globally.`)
            .setTimestamp()
          ],
          components: []
        });
      } else {
        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(0x95A5A6)
            .setTitle('Deletion Cancelled')
            .setTimestamp()
          ],
          components: []
        });
      }
    } catch (error) {
      await reply.edit({ components: [] });
    }
    
  } catch (error) {
    console.error('Error deleting character:', error);
    return message.reply('An error occurred while deleting the character.');
  }
}

async function handleDeleteGlobalCollectible(message, args, userId) {
  const identifier = args.join(' ');
  if (!identifier) {
    return message.reply('Please specify a collectible ID: `!sa deletecol <id>`');
  }
  
  try {
    const collection = await getCollection('globalCollectibles');
    const collectible = await collection.findOne({ uniqueId: identifier.toUpperCase() });
    
    if (!collectible) {
      return message.reply(`No global collectible found with ID "${identifier}".`);
    }
    
    await collection.deleteOne({ uniqueId: collectible.uniqueId });
    
    const serverAddedCol = await getCollection('serverAddedCollectibles');
    await serverAddedCol.deleteMany({ collectibleId: collectible.uniqueId });
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Collectible Deleted')
      .setDescription(`**${collectible.name}** has been deleted globally.`)
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error deleting collectible:', error);
    return message.reply('An error occurred while deleting the collectible.');
  }
}

async function handleStats(message) {
  try {
    const globalCharsCol = await getCollection('globalCharacters');
    const serverCharsCol = await getCollection('serverCharacters');
    const globalColsCol = await getCollection('globalCollectibles');
    const serverColsCol = await getCollection('serverCollectibles');
    const serverAddedCharsCol = await getCollection('serverAddedCharacters');
    const serverAddedColsCol = await getCollection('serverAddedCollectibles');
    
    const [
      globalCharsCount,
      serverCharsCount,
      publicServerCharsCount,
      globalColsCount,
      serverColsCount,
      publicServerColsCount,
      totalServerAddsChars,
      totalServerAddsCols
    ] = await Promise.all([
      globalCharsCol.countDocuments({}),
      serverCharsCol.countDocuments({}),
      serverCharsCol.countDocuments({ isPublic: true }),
      globalColsCol.countDocuments({}),
      serverColsCol.countDocuments({}),
      serverColsCol.countDocuments({ isPublic: true }),
      serverAddedCharsCol.countDocuments({}),
      serverAddedColsCol.countDocuments({})
    ]);
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('Global Statistics')
      .addFields(
        { name: 'Characters', value: 
          `👑 Global: ${globalCharsCount}\n` +
          `🏠 Server-created: ${serverCharsCount}\n` +
          `🌐 Public server chars: ${publicServerCharsCount}\n` +
          `📊 Server adds: ${totalServerAddsChars}`,
          inline: true
        },
        { name: 'Collectibles', value: 
          `👑 Global: ${globalColsCount}\n` +
          `🏠 Server-created: ${serverColsCount}\n` +
          `🌐 Public server cols: ${publicServerColsCount}\n` +
          `📊 Server adds: ${totalServerAddsCols}`,
          inline: true
        }
      )
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error getting stats:', error);
    return message.reply('An error occurred while fetching statistics.');
  }
}

async function handlePendingApprovals(message) {
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    const pendingChars = await serverCharsCol.find({ 
      pendingApproval: true,
      status: 'active'
    }).limit(10).toArray();
    
    const pendingCols = await serverColsCol.find({ 
      pendingApproval: true,
      status: 'active'
    }).limit(10).toArray();
    
    if (pendingChars.length === 0 && pendingCols.length === 0) {
      return message.reply('No pending approvals at this time.');
    }
    
    let description = '';
    
    if (pendingChars.length > 0) {
      description += '**Characters:**\n';
      pendingChars.forEach(c => {
        description += `• ${c.emoji} **${c.name}** \`${c.uniqueId || 'N/A'}\` - ${c.rarity}\n`;
      });
      description += '\n';
    }
    
    if (pendingCols.length > 0) {
      description += '**Collectibles:**\n';
      pendingCols.forEach(c => {
        description += `• ${c.emoji} **${c.name}** \`${c.uniqueId || 'N/A'}\` - ${c.rarity}\n`;
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('Pending Approvals')
      .setDescription(description)
      .addFields(
        { name: 'Actions', value: '`!sa approve <id>` - Approve\n`!sa reject <id>` - Reject' }
      )
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return message.reply('An error occurred while fetching pending approvals.');
  }
}

async function handleApproveCharacter(message, args, userId) {
  const identifier = args.join(' ');
  if (!identifier) {
    return message.reply('Please specify an ID: `!sa approve <id>`');
  }
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    const pendingChar = await serverCharsCol.findOne({ uniqueId: identifier.toUpperCase(), pendingApproval: true });
    
    if (pendingChar) {
      await serverCharsCol.updateOne(
        { uniqueId: identifier.toUpperCase(), pendingApproval: true },
        { $set: { isPublic: true, pendingApproval: false, approvedBy: userId, approvedAt: new Date() } }
      );
      
      await characterManager.updateCharacterVisibility(pendingChar.name, true, false);
      
      try {
        const creator = await message.client.users.fetch(pendingChar.createdBy).catch(() => null);
        if (creator) {
          const approvalEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Character Approved!')
            .setDescription(`Your character **${pendingChar.emoji} ${pendingChar.name}** has been approved and is now public!`)
            .addFields(
              { name: 'ID', value: `\`${pendingChar.uniqueId}\``, inline: true }
            )
            .setFooter({ text: 'Other servers can now add your character!' })
            .setTimestamp();
          await creator.send({ embeds: [approvalEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      return message.reply(`✅ Character **${pendingChar.emoji} ${pendingChar.name}** approved and made public!`);
    }
    
    const pendingCol = await serverColsCol.findOne({ uniqueId: identifier.toUpperCase(), pendingApproval: true });
    
    if (pendingCol) {
      await serverColsCol.updateOne(
        { uniqueId: identifier.toUpperCase(), pendingApproval: true },
        { $set: { isPublic: true, pendingApproval: false, approvedBy: userId, approvedAt: new Date() } }
      );
      
      try {
        const creator = await message.client.users.fetch(pendingCol.createdBy).catch(() => null);
        if (creator) {
          const approvalEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Collectible Approved!')
            .setDescription(`Your collectible **${pendingCol.emoji} ${pendingCol.name}** has been approved and is now public!`)
            .setFooter({ text: 'Other servers can now add your collectible!' })
            .setTimestamp();
          await creator.send({ embeds: [approvalEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      return message.reply(`✅ Collectible **${pendingCol.emoji} ${pendingCol.name}** approved and made public!`);
    }
    
    return message.reply(`No pending item found with ID "${identifier}".`);
    
  } catch (error) {
    console.error('Error approving:', error);
    return message.reply('An error occurred.');
  }
}

async function handleRejectCharacter(message, args, userId) {
  const identifier = args[0];
  const reason = args.slice(1).join(' ') || 'No reason provided';
  
  if (!identifier) {
    return message.reply('Please specify an ID: `!sa reject <id> [reason]`');
  }
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    const pendingChar = await serverCharsCol.findOne({ uniqueId: identifier.toUpperCase(), pendingApproval: true });
    
    if (pendingChar) {
      await serverCharsCol.updateOne(
        { uniqueId: identifier.toUpperCase(), pendingApproval: true },
        { $set: { pendingApproval: false, rejectedBy: userId, rejectedAt: new Date(), rejectionReason: reason } }
      );
      
      await characterManager.updateCharacterVisibility(pendingChar.name, false, false);
      
      try {
        const creator = await message.client.users.fetch(pendingChar.createdBy).catch(() => null);
        if (creator) {
          const rejectionEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Character Rejected')
            .setDescription(`Your character **${pendingChar.emoji} ${pendingChar.name}** was not approved for public visibility.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false }
            )
            .setFooter({ text: 'Your character still works on your server!' })
            .setTimestamp();
          await creator.send({ embeds: [rejectionEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      return message.reply(`❌ Character **${pendingChar.emoji} ${pendingChar.name}** rejected.`);
    }
    
    const pendingCol = await serverColsCol.findOne({ uniqueId: identifier.toUpperCase(), pendingApproval: true });
    
    if (pendingCol) {
      await serverColsCol.updateOne(
        { uniqueId: identifier.toUpperCase(), pendingApproval: true },
        { $set: { pendingApproval: false, rejectedBy: userId, rejectedAt: new Date(), rejectionReason: reason } }
      );
      
      try {
        const creator = await message.client.users.fetch(pendingCol.createdBy).catch(() => null);
        if (creator) {
          const rejectionEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Collectible Rejected')
            .setDescription(`Your collectible **${pendingCol.emoji} ${pendingCol.name}** was not approved for public visibility.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false }
            )
            .setFooter({ text: 'Your collectible still works on your server!' })
            .setTimestamp();
          await creator.send({ embeds: [rejectionEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      return message.reply(`❌ Collectible **${pendingCol.emoji} ${pendingCol.name}** rejected.`);
    }
    
    return message.reply(`No pending item found with ID "${identifier}".`);
    
  } catch (error) {
    console.error('Error rejecting:', error);
    return message.reply('An error occurred.');
  }
}
