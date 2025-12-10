const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { canSetupServer, isServerOwner, getServerConfig, saveServerConfig } = require('../../serverConfigManager.js');

const pendingSetups = new Map();

module.exports = {
  name: 'setup',
  aliases: ['configure', 'config'],
  category: 'admin',
  description: 'Interactive setup wizard to configure ZooBot for your server',
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
      updatesChannelId: config.updatesChannelId || null,
      notifyRoleId: config.notifyRoleId || null
    };
    
    pendingSetups.set(setupId, setupData);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('ZooBot Setup Wizard - Step 1/4')
      .setDescription(
        'Welcome! Let\'s set up ZooBot for your server.\n\n' +
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
    const collector = message.channel.createMessageCollector({ filter, time: 300000, max: 20 });
    
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
          data.step = 3;
          await sendStep3(m, data);
          break;
        }
        
        case 3: {
          const channel = m.mentions.channels.first();
          if (content !== 'skip') {
            if (!channel) {
              await m.reply('Please mention a valid channel (e.g., #bot-updates) or type "skip".');
              return;
            }
            if (channel.type !== ChannelType.GuildText) {
              await m.reply('Please select a text channel.');
              return;
            }
            data.updatesChannelId = channel.id;
          }
          data.step = 4;
          await sendStep4(m, data);
          break;
        }
        
        case 4: {
          const role = m.mentions.roles.first();
          if (content === 'none' || content === 'disable') {
            data.notifyRoleId = null;
            data.notifyDisabled = true;
          } else if (content !== 'skip') {
            if (!role) {
              await m.reply('Please mention a role (e.g., @Gamers), type "none" to disable pings, or type "skip".');
              return;
            }
            data.notifyRoleId = role.id;
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

async function sendStep2(m, data) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('ZooBot Setup Wizard - Step 2/4')
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

async function sendStep3(m, data) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('ZooBot Setup Wizard - Step 3/4')
    .setDescription(
      '**Step 3: Updates Channel**\n' +
      'Where should bot updates and patch notes be posted?\n\n' +
      'Please **mention a channel** (e.g., #bot-updates) or type **skip**.'
    )
    .addFields({
      name: 'Current Setting',
      value: data.updatesChannelId ? `<#${data.updatesChannelId}>` : 'Not set',
      inline: true
    })
    .setFooter({ text: 'Mention a channel or type "skip"' });
  await m.reply({ embeds: [embed] });
}

async function sendStep4(m, data) {
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('ZooBot Setup Wizard - Step 4/4')
    .setDescription(
      '**Step 4: Notification Role (Optional)**\n' +
      'Which role should be pinged for drops and events?\n\n' +
      '**Options:**\n' +
      '• Mention a role (e.g., @Gamers)\n' +
      '• Type **none** to disable all pings\n' +
      '• Type **skip** to keep current setting'
    )
    .addFields({
      name: 'Current Setting',
      value: data.notifyRoleId ? `<@&${data.notifyRoleId}>` : 'Not set (no pings)',
      inline: true
    })
    .setFooter({ text: 'Mention a role, type "none", or "skip"' });
  await m.reply({ embeds: [embed] });
}

async function finalizeSetup(m, data, setupId, member) {
  try {
    const config = getServerConfig(data.serverId) || { serverId: data.serverId };
    
    if (data.dropChannelId) {
      config.dropChannelId = data.dropChannelId;
    }
    if (data.eventsChannelId) {
      config.eventsChannelId = data.eventsChannelId;
    }
    if (data.updatesChannelId) {
      config.updatesChannelId = data.updatesChannelId;
    }
    if (data.notifyRoleId !== undefined) {
      config.notifyRoleId = data.notifyRoleId;
      config.notifyRoleEnabled = !data.notifyDisabled;
    }
    
    const allChannelsSet = config.dropChannelId && config.eventsChannelId && config.updatesChannelId;
    if (allChannelsSet) {
      config.setupComplete = true;
      config.setupDate = new Date().toISOString();
    }
    
    config.serverId = data.serverId;
    await saveServerConfig(data.serverId, config);
    
    pendingSetups.delete(setupId);
    
    const statusEmoji = allChannelsSet ? '✅' : '⚠️';
    const statusText = allChannelsSet 
      ? 'Setup Complete!' 
      : 'Partial Setup - Some channels not configured';
    
    const embed = new EmbedBuilder()
      .setColor(allChannelsSet ? 0x00FF00 : 0xFFAA00)
      .setTitle(`${statusEmoji} ${statusText}`)
      .setDescription('ZooBot has been configured for your server!')
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
        },
        { 
          name: 'Updates Channel', 
          value: config.updatesChannelId ? `<#${config.updatesChannelId}>` : '❌ Not set', 
          inline: true 
        },
        { 
          name: 'Notification Role', 
          value: config.notifyRoleId ? `<@&${config.notifyRoleId}>` : 'Disabled', 
          inline: true 
        }
      )
      .addFields({
        name: 'What\'s Next?',
        value: 
          '• `!chars` - Browse the global character directory\n' +
          '• `!sc create` - Create custom characters for your server\n' +
          '• `!scol create` - Create custom collectibles\n' +
          '• `!help` - See all available commands'
      })
      .setFooter({ text: 'Run !setup again anytime to change settings' })
      .setTimestamp();
    
    await m.reply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error finalizing setup:', error);
    await m.reply('An error occurred while saving settings. Please try again.');
    pendingSetups.delete(setupId);
  }
}
