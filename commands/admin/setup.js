const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { canSetupServer, isServerOwner, getServerConfig, saveServerConfig } = require('../../serverConfigManager.js');
const characterManager = require('../../characterManager.js');

const REQUIRED_CHARACTER_COUNT = 5;

const pendingSetups = new Map();

module.exports = {
  name: 'setup',
  aliases: ['configure', 'config'],
  category: 'admin',
  description: 'Simple setup to configure ZooBot channels for your server',
  usage: '!setup',
  adminOnly: false,
  
  async execute({ message, args, data, client }) {
    const member = message.member;
    const userId = message.author.id;
    const serverId = message.guild?.id;
    
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const hasPermission = canSetupServer(userId, serverId, member) || isServerOwner(member);
    
    if (!hasPermission) {
      return message.reply('You need to be the server owner or a server admin to set up ZooBot!');
    }
    
    const config = getServerConfig(serverId) || {};
    
    const setupId = `${serverId}-${userId}-${Date.now()}`;
    const setupData = {
      step: 1,
      serverId,
      userId,
      dropChannelId: config.dropChannelId || null,
      eventsChannelId: config.eventsChannelId || null,
      updatesChannelId: config.updatesChannelId || null
    };
    
    pendingSetups.set(setupId, setupData);
    
    const currentCharCount = await characterManager.getServerCharacterCount(serverId);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('ZooBot Setup - Step 1/2')
      .setDescription(
        'Welcome! Let\'s set up ZooBot for your server.\n\n' +
        `**Requirements:**\n` +
        `• 2 Channels (drop, events)\n\n` +
        '**Step 1: Drop Channel**\n' +
        'Where should characters appear for players to catch?\n\n' +
        'Please **mention a channel** (e.g., #game-drops) or type **skip** to keep the current setting.'
      )
      .addFields({
        name: 'Current Setting',
        value: config.dropChannelId ? `<#${config.dropChannelId}>` : 'Not set',
        inline: true
      })
      .setFooter({ text: 'Mention a channel or type "skip" | Type "cancel" to stop' })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    
    const filter = m => m.author.id === userId;
    const collector = message.channel.createMessageCollector({ filter, time: 300000, max: 15 });
    
    collector.on('collect', async (m) => {
      const data = pendingSetups.get(setupId);
      if (!data) {
        collector.stop('cancelled');
        return;
      }
      
      const content = m.content.trim().toLowerCase();
      
      if (content === 'cancel') {
        pendingSetups.delete(setupId);
        collector.stop('cancelled');
        await m.reply('Setup cancelled.');
        return;
      }
      
      switch (data.step) {
        case 1: {
          const channel = m.mentions.channels.first();
          if (content !== 'skip') {
            if (!channel) {
              await m.reply('Please mention a valid channel (e.g., #game-drops) or type "skip".');
              return;
            }
            if (channel.type !== ChannelType.GuildText) {
              await m.reply('Please select a text channel.');
              return;
            }
            data.dropChannelId = channel.id;
          }
          data.step = 2;
          await sendStep2(m, data);
          break;
        }
        
        case 2: {
          const channel = m.mentions.channels.first();
          if (content !== 'skip') {
            if (!channel) {
              await m.reply('Please mention a valid channel (e.g., #events) or type "skip".');
              return;
            }
            if (channel.type !== ChannelType.GuildText) {
              await m.reply('Please select a text channel.');
              return;
            }
            data.eventsChannelId = channel.id;
          }
          await finalizeSetup(m, data, setupId, member);
          collector.stop('completed');
          break;
        }
      }
      
      pendingSetups.set(setupId, data);
    });
    
    collector.on('end', (collected, reason) => {
      if (reason !== 'completed' && reason !== 'cancelled') {
        pendingSetups.delete(setupId);
        message.channel.send('Setup timed out. Please run `!setup` again to continue.');
      }
    });
  }
};

async function finalizeSetup(m, data, setupId, member) {
  try {
    const config = getServerConfig(data.serverId) || { serverId: data.serverId };
    
    if (data.dropChannelId) {
      config.dropChannelId = data.dropChannelId;
    }
    if (data.eventsChannelId) {
      config.eventsChannelId = data.eventsChannelId;
    }
    
    const allChannelsSet = config.dropChannelId && config.eventsChannelId;
    
    config.setupComplete = allChannelsSet;
    if (allChannelsSet) {
      config.setupDate = new Date().toISOString();
    }
    
    config.serverId = data.serverId;
    await saveServerConfig(data.serverId, config);
    
    pendingSetups.delete(setupId);
    
    const statusEmoji = allChannelsSet ? '✅' : '⚠️';
    const statusText = allChannelsSet ? 'Setup Complete!' : 'Partial Setup';
    const embedColor = allChannelsSet ? 0x00FF00 : 0xFFAA00;
    
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${statusEmoji} ${statusText}`)
      .setDescription(allChannelsSet 
        ? 'ZooBot has been fully configured for your server! Default characters have been loaded.'
        : 'Channel settings saved! Set both channels to complete setup.')
      .addFields(
        { 
          name: 'Drop Channel', 
          value: config.dropChannelId ? `<#${config.dropChannelId}>` : '❌ Not set', 
          inline: true 
        },
        { 
          name: 'Events Channel', 
          value: config.eventsChannelId ? `<#${config.eventsChannelId}>` : '❌ Not set', 
          inline: true 
        }
      );
    
    if (allChannelsSet) {
      embed.addFields({
        name: 'What\'s Next?',
        value: 
          '• `!chars` - Browse available characters\n' +
          '• `!sc create` - Create custom characters\n' +
          '• `!help` - See all available commands'
      });
    }
    
    embed.setFooter({ text: 'Run !setup again anytime to check status or change settings' })
      .setTimestamp();
    
    await m.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error finalizing setup:', error);
    await m.reply('An error occurred while saving settings. Please try again.');
    pendingSetups.delete(setupId);
  }
}

async function sendStep2(m, data) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('ZooBot Setup - Step 2/2')
    .setDescription(
      '**Step 2: Events Channel**\n' +
      'Where should special events, tournaments, and announcements be posted?\n\n' +
      'Please **mention a channel** (e.g., #events) or type **skip**.'
    )
    .addFields({
      name: 'Current Setting',
      value: data.eventsChannelId ? `<#${data.eventsChannelId}>` : 'Not set',
      inline: true
    })
    .setFooter({ text: 'Mention a channel or type "skip"' });
  await m.reply({ embeds: [embed] });
}
