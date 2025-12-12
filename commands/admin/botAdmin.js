const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isSuperAdmin, isGlobalBotAdmin, canApproveContent } = require('../../serverConfigManager.js');
const { getCollection } = require('../../mongoManager.js');
const characterManager = require('../../characterManager.js');

module.exports = {
  name: 'botadmin',
  aliases: ['ba'],
  category: 'admin',
  description: 'Bot admin commands for managing pending approvals',
  usage: '!ba <subcommand>',
  adminOnly: true,
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    
    if (!canApproveContent(userId)) {
      return message.reply('This command is only available to Super Admins and Bot Admins!');
    }
    
    const subcommand = args[0]?.toLowerCase() || 'help';
    
    switch (subcommand) {
      case 'pending':
        return handlePending(message, args.slice(1));
      case 'view':
        return handleView(message, args.slice(1));
      case 'approve':
        return handleApprove(message, args.slice(1), userId, client);
      case 'reject':
        return handleReject(message, args.slice(1), userId, client);
      case 'requestpublic':
      case 'rp':
        return handleRequestPublic(message, args.slice(1), userId);
      default:
        return showHelp(message);
    }
  }
};

function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('Bot Admin Commands')
    .setDescription('Commands for managing pending character and collectible approvals.')
    .addFields(
      { name: 'View Pending', value: 
        '`!ba pending` - View all pending characters and collectibles\n' +
        '`!ba pending chars` - View only pending characters\n' +
        '`!ba pending cols` - View only pending collectibles'
      },
      { name: 'View Details', value: 
        '`!ba view <id>` - View full details of a character or collectible'
      },
      { name: 'Approval Actions', value: 
        '`!ba approve <id>` - Approve a pending item to become public\n' +
        '`!ba reject <id> [reason]` - Reject with optional reason'
      },
      { name: 'Request Public', value: 
        '`!ba requestpublic <id>` - Submit an existing private character/collectible for public approval\n' +
        '`!ba rp <id>` - Short alias'
      }
    )
    .setFooter({ text: 'Bot Admins and Super Admins only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handlePending(message, args) {
  const filter = args[0]?.toLowerCase();
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    let pendingChars = [];
    let pendingCols = [];
    
    if (!filter || filter === 'chars' || filter === 'characters') {
      pendingChars = await serverCharsCol.find({ 
        pendingApproval: true,
        status: 'active'
      }).sort({ submittedAt: -1 }).limit(25).toArray();
    }
    
    if (!filter || filter === 'cols' || filter === 'collectibles') {
      pendingCols = await serverColsCol.find({ 
        pendingApproval: true,
        status: 'active'
      }).sort({ submittedAt: -1 }).limit(25).toArray();
    }
    
    if (pendingChars.length === 0 && pendingCols.length === 0) {
      return message.reply('No pending approvals at this time.');
    }
    
    const embeds = [];
    
    if (pendingChars.length > 0) {
      let charDescription = '';
      for (const char of pendingChars) {
        const submittedTime = char.submittedAt ? `<t:${Math.floor(new Date(char.submittedAt).getTime() / 1000)}:R>` : 'Unknown';
        charDescription += `**${char.emoji || '?'} ${char.name}**\n`;
        charDescription += `  ID: \`${char.uniqueId || 'N/A'}\` | Rarity: ${char.rarity || 'common'}\n`;
        charDescription += `  By: <@${char.createdBy}> | ${submittedTime}\n\n`;
      }
      
      const charEmbed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle(`Pending Characters (${pendingChars.length})`)
        .setDescription(charDescription || 'No pending characters')
        .setTimestamp();
      
      embeds.push(charEmbed);
    }
    
    if (pendingCols.length > 0) {
      let colDescription = '';
      for (const col of pendingCols) {
        const submittedTime = col.submittedAt ? `<t:${Math.floor(new Date(col.submittedAt).getTime() / 1000)}:R>` : 'Unknown';
        colDescription += `**${col.emoji || '?'} ${col.name}**\n`;
        colDescription += `  ID: \`${col.uniqueId || 'N/A'}\` | Rarity: ${col.rarity || 'common'}\n`;
        colDescription += `  By: <@${col.createdBy}> | ${submittedTime}\n\n`;
      }
      
      const colEmbed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle(`Pending Collectibles (${pendingCols.length})`)
        .setDescription(colDescription || 'No pending collectibles')
        .setTimestamp();
      
      embeds.push(colEmbed);
    }
    
    const actionEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setDescription('**Actions:**\n`!ba view <id>` - View details\n`!ba approve <id>` - Approve\n`!ba reject <id> [reason]` - Reject');
    
    embeds.push(actionEmbed);
    
    return message.reply({ embeds });
    
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return message.reply('An error occurred while fetching pending approvals.');
  }
}

async function handleView(message, args) {
  const identifier = args.join(' ')?.toUpperCase();
  
  if (!identifier) {
    return message.reply('Please specify an ID: `!ba view <id>`');
  }
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    const globalCharsCol = await getCollection('globalCharacters');
    const globalColsCol = await getCollection('globalCollectibles');
    
    let item = await serverCharsCol.findOne({ uniqueId: identifier });
    let itemType = 'Server Character';
    
    if (!item) {
      item = await globalCharsCol.findOne({ uniqueId: identifier });
      itemType = 'Global Character';
    }
    
    if (!item) {
      item = await serverColsCol.findOne({ uniqueId: identifier });
      itemType = 'Server Collectible';
    }
    
    if (!item) {
      item = await globalColsCol.findOne({ uniqueId: identifier });
      itemType = 'Global Collectible';
    }
    
    if (!item) {
      return message.reply(`No character or collectible found with ID "${identifier}".`);
    }
    
    const embed = new EmbedBuilder()
      .setColor(item.pendingApproval ? 0xFFAA00 : (item.isPublic ? 0x00FF00 : 0xFF6B6B))
      .setTitle(`${item.emoji || '?'} ${item.name}`)
      .setDescription(item.description || 'No description provided')
      .addFields(
        { name: 'Type', value: itemType, inline: true },
        { name: 'ID', value: `\`${item.uniqueId || 'N/A'}\``, inline: true },
        { name: 'Rarity', value: (item.rarity || 'common').toUpperCase(), inline: true },
        { name: 'Status', value: item.pendingApproval ? 'Pending Approval' : (item.isPublic ? 'Public' : 'Private'), inline: true },
        { name: 'Created By', value: `<@${item.createdBy}>`, inline: true },
        { name: 'Created', value: item.createdAt ? `<t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:R>` : 'Unknown', inline: true }
      );
    
    if (item.ability) {
      embed.addFields({
        name: 'Ability',
        value: `${item.ability.emoji || ''} **${item.ability.name}**: ${item.ability.description || 'No description'}`,
        inline: false
      });
    }
    
    if (item.specialMove) {
      embed.addFields({
        name: 'Special Move',
        value: `**${item.specialMove.name}** (${item.specialMove.damage || 0} DMG)`,
        inline: false
      });
    }
    
    if (item.stats) {
      embed.addFields({
        name: 'Stats',
        value: `HP: ${item.stats.hp || 100} | ATK: ${item.stats.attack || 10} | DEF: ${item.stats.defense || 10} | SPD: ${item.stats.speed || 10}`,
        inline: false
      });
    }
    
    if (item.baseValue) {
      embed.addFields({ name: 'Base Value', value: `${item.baseValue} coins`, inline: true });
    }
    
    if (item.imageUrl) {
      embed.setThumbnail(item.imageUrl);
    }
    
    if (item.pendingApproval) {
      embed.setFooter({ text: 'Use !ba approve <id> or !ba reject <id> [reason]' });
    } else if (!item.isPublic) {
      embed.setFooter({ text: 'Use !ba requestpublic <id> to submit for public approval' });
    }
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error viewing item:', error);
    return message.reply('An error occurred while fetching item details.');
  }
}

async function handleApprove(message, args, userId, client) {
  const identifier = args.join(' ')?.toUpperCase();
  
  if (!identifier) {
    return message.reply('Please specify an ID: `!ba approve <id>`');
  }
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    const pendingChar = await serverCharsCol.findOne({ uniqueId: identifier, pendingApproval: true });
    
    if (pendingChar) {
      await serverCharsCol.updateOne(
        { uniqueId: identifier, pendingApproval: true },
        { 
          $set: { 
            isPublic: true, 
            pendingApproval: false, 
            approvedBy: userId, 
            approvedAt: new Date() 
          } 
        }
      );
      
      try {
        await characterManager.updateCharacterVisibility(pendingChar.name, true, false);
      } catch (e) {
        console.log('Note: characterManager visibility update skipped');
      }
      
      try {
        const creator = await client.users.fetch(pendingChar.createdBy).catch(() => null);
        if (creator) {
          const approvalEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Character Approved!')
            .setDescription(`Your character **${pendingChar.emoji} ${pendingChar.name}** has been approved and is now public!`)
            .addFields(
              { name: 'ID', value: `\`${pendingChar.uniqueId}\``, inline: true },
              { name: 'Approved By', value: `<@${userId}>`, inline: true }
            )
            .setFooter({ text: 'Other servers can now add your character!' })
            .setTimestamp();
          await creator.send({ embeds: [approvalEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Character Approved!')
        .setDescription(`**${pendingChar.emoji} ${pendingChar.name}** has been approved and is now public!`)
        .addFields(
          { name: 'ID', value: `\`${pendingChar.uniqueId}\``, inline: true },
          { name: 'Creator Notified', value: 'Yes', inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [successEmbed] });
    }
    
    const pendingCol = await serverColsCol.findOne({ uniqueId: identifier, pendingApproval: true });
    
    if (pendingCol) {
      await serverColsCol.updateOne(
        { uniqueId: identifier, pendingApproval: true },
        { 
          $set: { 
            isPublic: true, 
            pendingApproval: false, 
            approvedBy: userId, 
            approvedAt: new Date() 
          } 
        }
      );
      
      try {
        const creator = await client.users.fetch(pendingCol.createdBy).catch(() => null);
        if (creator) {
          const approvalEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Collectible Approved!')
            .setDescription(`Your collectible **${pendingCol.emoji} ${pendingCol.name}** has been approved and is now public!`)
            .addFields(
              { name: 'ID', value: `\`${pendingCol.uniqueId}\``, inline: true },
              { name: 'Approved By', value: `<@${userId}>`, inline: true }
            )
            .setFooter({ text: 'Other servers can now add your collectible!' })
            .setTimestamp();
          await creator.send({ embeds: [approvalEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Collectible Approved!')
        .setDescription(`**${pendingCol.emoji} ${pendingCol.name}** has been approved and is now public!`)
        .addFields(
          { name: 'ID', value: `\`${pendingCol.uniqueId}\``, inline: true },
          { name: 'Creator Notified', value: 'Yes', inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [successEmbed] });
    }
    
    return message.reply(`No pending character or collectible found with ID "${identifier}".`);
    
  } catch (error) {
    console.error('Error approving item:', error);
    return message.reply('An error occurred while approving the item.');
  }
}

async function handleReject(message, args, userId, client) {
  if (args.length === 0) {
    return message.reply('Please specify an ID: `!ba reject <id> [reason]`');
  }
  
  const identifier = args[0]?.toUpperCase();
  const reason = args.slice(1).join(' ') || 'No reason provided';
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    const pendingChar = await serverCharsCol.findOne({ uniqueId: identifier, pendingApproval: true });
    
    if (pendingChar) {
      await serverCharsCol.updateOne(
        { uniqueId: identifier, pendingApproval: true },
        { 
          $set: { 
            pendingApproval: false, 
            rejectedBy: userId, 
            rejectedAt: new Date(),
            rejectionReason: reason
          } 
        }
      );
      
      try {
        const creator = await client.users.fetch(pendingChar.createdBy).catch(() => null);
        if (creator) {
          const rejectEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Character Request Rejected')
            .setDescription(`Your request to make **${pendingChar.emoji} ${pendingChar.name}** public was rejected.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false },
              { name: 'Rejected By', value: `<@${userId}>`, inline: true }
            )
            .setFooter({ text: 'You can request again after making improvements.' })
            .setTimestamp();
          await creator.send({ embeds: [rejectEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      const successEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Character Rejected')
        .setDescription(`**${pendingChar.emoji} ${pendingChar.name}** has been rejected.`)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Creator Notified', value: 'Yes', inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [successEmbed] });
    }
    
    const pendingCol = await serverColsCol.findOne({ uniqueId: identifier, pendingApproval: true });
    
    if (pendingCol) {
      await serverColsCol.updateOne(
        { uniqueId: identifier, pendingApproval: true },
        { 
          $set: { 
            pendingApproval: false, 
            rejectedBy: userId, 
            rejectedAt: new Date(),
            rejectionReason: reason
          } 
        }
      );
      
      try {
        const creator = await client.users.fetch(pendingCol.createdBy).catch(() => null);
        if (creator) {
          const rejectEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Collectible Request Rejected')
            .setDescription(`Your request to make **${pendingCol.emoji} ${pendingCol.name}** public was rejected.`)
            .addFields(
              { name: 'Reason', value: reason, inline: false },
              { name: 'Rejected By', value: `<@${userId}>`, inline: true }
            )
            .setFooter({ text: 'You can request again after making improvements.' })
            .setTimestamp();
          await creator.send({ embeds: [rejectEmbed] }).catch(() => {});
        }
      } catch (e) {}
      
      const successEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Collectible Rejected')
        .setDescription(`**${pendingCol.emoji} ${pendingCol.name}** has been rejected.`)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Creator Notified', value: 'Yes', inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [successEmbed] });
    }
    
    return message.reply(`No pending character or collectible found with ID "${identifier}".`);
    
  } catch (error) {
    console.error('Error rejecting item:', error);
    return message.reply('An error occurred while rejecting the item.');
  }
}

async function handleRequestPublic(message, args, userId) {
  const identifier = args.join(' ')?.toUpperCase();
  
  if (!identifier) {
    return message.reply('Please specify an ID: `!ba requestpublic <id>`');
  }
  
  try {
    const serverCharsCol = await getCollection('serverCharacters');
    const serverColsCol = await getCollection('serverCollectibles');
    
    let item = await serverCharsCol.findOne({ uniqueId: identifier });
    let isCharacter = true;
    
    if (!item) {
      item = await serverColsCol.findOne({ uniqueId: identifier });
      isCharacter = false;
    }
    
    if (!item) {
      return message.reply(`No server character or collectible found with ID "${identifier}".`);
    }
    
    if (item.isPublic) {
      return message.reply(`This ${isCharacter ? 'character' : 'collectible'} is already public!`);
    }
    
    if (item.pendingApproval) {
      return message.reply(`This ${isCharacter ? 'character' : 'collectible'} is already pending approval!`);
    }
    
    const collection = isCharacter ? serverCharsCol : serverColsCol;
    
    await collection.updateOne(
      { uniqueId: identifier },
      { 
        $set: { 
          pendingApproval: true,
          submittedAt: new Date(),
          submittedBy: userId
        } 
      }
    );
    
    const embed = new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle('Submitted for Public Approval')
      .setDescription(`**${item.emoji} ${item.name}** has been submitted for public approval!`)
      .addFields(
        { name: 'Type', value: isCharacter ? 'Character' : 'Collectible', inline: true },
        { name: 'ID', value: `\`${item.uniqueId}\``, inline: true },
        { name: 'Status', value: 'Pending Approval', inline: true }
      )
      .setFooter({ text: 'Bot Admins will review this submission.' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error submitting for approval:', error);
    return message.reply('An error occurred while submitting for approval.');
  }
}
