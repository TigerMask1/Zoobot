const { EmbedBuilder } = require('discord.js');
const { isSuperAdmin } = require('../../serverConfigManager.js');
const characterManager = require('../../characterManager.js');
const { getCollection } = require('../../mongoManager.js');

module.exports = {
  name: 'admincleanup',
  aliases: ['cleanup', 'fixdata'],
  category: 'admin',
  description: 'Admin cleanup commands - remove duplicates and fix data issues',
  usage: '!admincleanup <chars|cols|all>',
  adminOnly: true,
  superAdminOnly: true,
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    
    if (!isSuperAdmin(userId)) {
      return message.reply('This command is only available to Super Admins!');
    }
    
    const subcommand = args[0]?.toLowerCase() || 'help';
    
    switch (subcommand) {
      case 'chars':
      case 'characters':
        return cleanupCharacters(message);
      case 'cols':
      case 'collectibles':
        return cleanupCollectibles(message);
      case 'all':
        return cleanupAll(message);
      case 'setupservers':
        return setupAllServers(message, client);
      default:
        return showHelp(message);
    }
  }
};

function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('Admin Cleanup Commands')
    .setDescription('Clean up and fix data issues in the database.')
    .addFields(
      { name: '`!cleanup chars`', value: 'Remove duplicate characters', inline: true },
      { name: '`!cleanup cols`', value: 'Remove duplicate collectibles', inline: true },
      { name: '`!cleanup all`', value: 'Run all cleanup operations', inline: true },
      { name: '`!cleanup setupservers`', value: 'Setup all servers with default content', inline: true }
    )
    .setFooter({ text: 'Super Admin only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function cleanupCharacters(message) {
  try {
    await message.reply('Cleaning up duplicate characters...');
    
    const result = await characterManager.cleanupDuplicateCharacters();
    
    const embed = new EmbedBuilder()
      .setColor(result.removed > 0 ? 0x00FF00 : 0x00D9FF)
      .setTitle('Character Cleanup Complete')
      .setDescription(result.message)
      .setTimestamp();
    
    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error cleaning up characters:', error);
    return message.reply('An error occurred during character cleanup.');
  }
}

async function cleanupCollectibles(message) {
  try {
    await message.reply('Cleaning up duplicate collectibles...');
    
    const serverColsCol = await getCollection('serverCollectibles');
    const globalColsCol = await getCollection('globalCollectibles');
    
    const serverCols = await serverColsCol.find({}).toArray();
    const seenServer = new Map();
    let serverDuplicates = 0;
    
    for (const col of serverCols) {
      const key = `${col.serverId}-${col.name.toLowerCase()}`;
      if (seenServer.has(key)) {
        await serverColsCol.deleteOne({ _id: col._id });
        serverDuplicates++;
      } else {
        seenServer.set(key, col._id);
      }
    }
    
    const globalCols = await globalColsCol.find({}).toArray();
    const seenGlobal = new Map();
    let globalDuplicates = 0;
    
    for (const col of globalCols) {
      const key = col.name.toLowerCase();
      if (seenGlobal.has(key)) {
        await globalColsCol.deleteOne({ _id: col._id });
        globalDuplicates++;
      } else {
        seenGlobal.set(key, col._id);
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Collectible Cleanup Complete')
      .setDescription(
        `Removed ${serverDuplicates} duplicate server collectibles\n` +
        `Removed ${globalDuplicates} duplicate global collectibles`
      )
      .setTimestamp();
    
    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error cleaning up collectibles:', error);
    return message.reply('An error occurred during collectible cleanup.');
  }
}

async function cleanupAll(message) {
  try {
    await message.reply('Running full cleanup...');
    
    const charResult = await characterManager.cleanupDuplicateCharacters();
    
    const serverColsCol = await getCollection('serverCollectibles');
    const globalColsCol = await getCollection('globalCollectibles');
    
    const serverCols = await serverColsCol.find({}).toArray();
    const seenServer = new Map();
    let serverDuplicates = 0;
    
    for (const col of serverCols) {
      const key = `${col.serverId}-${col.name.toLowerCase()}`;
      if (seenServer.has(key)) {
        await serverColsCol.deleteOne({ _id: col._id });
        serverDuplicates++;
      } else {
        seenServer.set(key, col._id);
      }
    }
    
    const globalCols = await globalColsCol.find({}).toArray();
    const seenGlobal = new Map();
    let globalDuplicates = 0;
    
    for (const col of globalCols) {
      const key = col.name.toLowerCase();
      if (seenGlobal.has(key)) {
        await globalColsCol.deleteOne({ _id: col._id });
        globalDuplicates++;
      } else {
        seenGlobal.set(key, col._id);
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Full Cleanup Complete')
      .addFields(
        { name: 'Characters', value: charResult.message, inline: false },
        { name: 'Server Collectibles', value: `Removed ${serverDuplicates} duplicates`, inline: true },
        { name: 'Global Collectibles', value: `Removed ${globalDuplicates} duplicates`, inline: true }
      )
      .setTimestamp();
    
    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error during full cleanup:', error);
    return message.reply('An error occurred during cleanup.');
  }
}

async function setupAllServers(message, client) {
  try {
    await message.reply('Setting up all servers with default content...');
    
    const serverConfigCol = await getCollection('serverConfigs');
    const configs = await serverConfigCol.find({}).toArray();
    
    let updated = 0;
    
    for (const config of configs) {
      if (!config.serverId || config.serverId === 'global_bot_admins') continue;
      
      if (!config.setupComplete) {
        config.setupComplete = true;
        config.setupDate = config.setupDate || new Date().toISOString();
        await serverConfigCol.updateOne(
          { serverId: config.serverId },
          { $set: { setupComplete: true, setupDate: config.setupDate } }
        );
        updated++;
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Server Setup Complete')
      .setDescription(`Updated ${updated} server configurations to complete status.`)
      .addFields(
        { name: 'Total Configs', value: `${configs.length}`, inline: true },
        { name: 'Updated', value: `${updated}`, inline: true }
      )
      .setTimestamp();
    
    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error setting up servers:', error);
    return message.reply('An error occurred during server setup.');
  }
}
