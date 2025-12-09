const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType } = require('discord.js');
const { canSetupServer, isServerOwner, getServerConfig, saveServerConfig } = require('../../serverConfigManager.js');

module.exports = {
  name: 'serversetup',
  aliases: ['ss', 'botsetup', 'configure'],
  category: 'admin',
  description: 'Configure bot settings for your server including notification role',
  usage: '!serversetup',
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
      return message.reply('You need to be the server owner or a server admin to configure the bot!');
    }
    
    const subcommand = args[0]?.toLowerCase() || 'help';
    
    switch (subcommand) {
      case 'role':
      case 'pingrole':
      case 'notifyrole':
        return handleSetNotifyRole(message, serverId, userId, args.slice(1));
      case 'drop':
      case 'dropchannel':
        return handleSetDropChannel(message, serverId, userId, args.slice(1));
      case 'events':
      case 'eventchannel':
        return handleSetEventChannel(message, serverId, userId, args.slice(1));
      case 'updates':
      case 'updatechannel':
        return handleSetUpdateChannel(message, serverId, userId, args.slice(1));
      case 'ping':
      case 'pings':
        return handlePingSettings(message, serverId, userId, args.slice(1));
      case 'status':
      case 'info':
        return handleStatus(message, serverId);
      default:
        return showHelp(message, serverId);
    }
  }
};

async function showHelp(message, serverId) {
  const config = getServerConfig(serverId) || {};
  const notifyRole = config.notifyRoleId ? `<@&${config.notifyRoleId}>` : 'Not set (no pings)';
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('Server Setup')
    .setDescription('Configure your bot settings for this server.')
    .addFields(
      { name: '`!ss role @role`', value: 'Set notification role (replaces @everyone)', inline: true },
      { name: '`!ss role none`', value: 'Disable all notification pings', inline: true },
      { name: '`!ss drop #channel`', value: 'Set the drop channel', inline: true },
      { name: '`!ss events #channel`', value: 'Set the events channel', inline: true },
      { name: '`!ss updates #channel`', value: 'Set the updates channel', inline: true },
      { name: '`!ss ping <type> on/off`', value: 'Toggle pings (drops/events/giveaways)', inline: true },
      { name: '`!ss status`', value: 'View current configuration', inline: true }
    )
    .addFields(
      { name: 'Current Notification Role', value: notifyRole, inline: false },
      { name: 'Important', value: 
        'Setting a notification role means that role will be pinged instead of @everyone.\n' +
        'If set to "none", no one will be pinged for any notifications.'
      }
    )
    .setFooter({ text: 'Server owners and admins only' })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleSetNotifyRole(message, serverId, userId, args) {
  const config = getServerConfig(serverId) || { serverId };
  
  if (args.length === 0) {
    const currentRole = config.notifyRoleId ? `<@&${config.notifyRoleId}>` : 'Not set (no pings)';
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('Notification Role')
      .setDescription(`Current notification role: ${currentRole}\n\nUse \`!ss role @role\` to set a role\nUse \`!ss role none\` to disable pings`)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
  
  const roleArg = args[0].toLowerCase();
  
  if (roleArg === 'none' || roleArg === 'disable' || roleArg === 'off') {
    config.notifyRoleId = null;
    config.notifyRoleEnabled = false;
    await saveServerConfig(serverId, config);
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Notification Role Disabled')
      .setDescription('All notification pings have been disabled. No one will be pinged for drops, events, or other notifications.')
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
  
  const roleMention = message.mentions.roles.first();
  if (!roleMention) {
    const roleId = args[0].replace(/[<@&>]/g, '');
    const role = message.guild.roles.cache.get(roleId);
    if (!role) {
      return message.reply('Please mention a valid role or use "none" to disable pings.\nExample: `!ss role @Collectors`');
    }
    config.notifyRoleId = role.id;
    config.notifyRoleEnabled = true;
  } else {
    config.notifyRoleId = roleMention.id;
    config.notifyRoleEnabled = true;
  }
  
  await saveServerConfig(serverId, config);
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('Notification Role Set')
    .setDescription(`Notification role has been set to <@&${config.notifyRoleId}>.\n\nThis role will be pinged instead of @everyone for:\n- Drops\n- Events\n- Giveaways\n- Updates`)
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleSetDropChannel(message, serverId, userId, args) {
  const config = getServerConfig(serverId) || { serverId };
  
  if (args.length === 0) {
    const currentChannel = config.dropChannelId ? `<#${config.dropChannelId}>` : 'Not set';
    return message.reply(`Current drop channel: ${currentChannel}\n\nUse \`!ss drop #channel\` to set a channel.`);
  }
  
  const channelMention = message.mentions.channels.first();
  if (!channelMention) {
    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply('Please mention a valid text channel.\nExample: `!ss drop #drops`');
    }
    config.dropChannelId = channel.id;
  } else {
    config.dropChannelId = channelMention.id;
  }
  
  await saveServerConfig(serverId, config);
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('Drop Channel Set')
    .setDescription(`Drop channel has been set to <#${config.dropChannelId}>.\n\nCharacters and collectibles will now appear in this channel.`)
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleSetEventChannel(message, serverId, userId, args) {
  const config = getServerConfig(serverId) || { serverId };
  
  if (args.length === 0) {
    const currentChannel = config.eventsChannelId ? `<#${config.eventsChannelId}>` : 'Not set';
    return message.reply(`Current events channel: ${currentChannel}\n\nUse \`!ss events #channel\` to set a channel.`);
  }
  
  const channelMention = message.mentions.channels.first();
  if (!channelMention) {
    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply('Please mention a valid text channel.\nExample: `!ss events #events`');
    }
    config.eventsChannelId = channel.id;
  } else {
    config.eventsChannelId = channelMention.id;
  }
  
  await saveServerConfig(serverId, config);
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('Events Channel Set')
    .setDescription(`Events channel has been set to <#${config.eventsChannelId}>.`)
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleSetUpdateChannel(message, serverId, userId, args) {
  const config = getServerConfig(serverId) || { serverId };
  
  if (args.length === 0) {
    const currentChannel = config.updatesChannelId ? `<#${config.updatesChannelId}>` : 'Not set';
    return message.reply(`Current updates channel: ${currentChannel}\n\nUse \`!ss updates #channel\` to set a channel.`);
  }
  
  const channelMention = message.mentions.channels.first();
  if (!channelMention) {
    const channelId = args[0].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply('Please mention a valid text channel.\nExample: `!ss updates #bot-updates`');
    }
    config.updatesChannelId = channel.id;
  } else {
    config.updatesChannelId = channelMention.id;
  }
  
  await saveServerConfig(serverId, config);
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('Updates Channel Set')
    .setDescription(`Updates channel has been set to <#${config.updatesChannelId}>.`)
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handlePingSettings(message, serverId, userId, args) {
  const config = getServerConfig(serverId) || { serverId };
  
  if (!config.pingSettings) {
    config.pingSettings = {
      drops: true,
      events: true,
      giveaways: true,
      updates: true
    };
  }
  
  if (args.length < 2) {
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('Ping Settings')
      .setDescription('Configure which notifications trigger pings.')
      .addFields(
        { name: 'Drops', value: config.pingSettings.drops ? '✅ On' : '❌ Off', inline: true },
        { name: 'Events', value: config.pingSettings.events ? '✅ On' : '❌ Off', inline: true },
        { name: 'Giveaways', value: config.pingSettings.giveaways ? '✅ On' : '❌ Off', inline: true },
        { name: 'Updates', value: config.pingSettings.updates ? '✅ On' : '❌ Off', inline: true }
      )
      .addFields(
        { name: 'Usage', value: '`!ss ping drops on/off`\n`!ss ping events on/off`\n`!ss ping giveaways on/off`\n`!ss ping updates on/off`' }
      )
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
  
  const type = args[0].toLowerCase();
  const value = args[1].toLowerCase();
  const enabled = value === 'on' || value === 'true' || value === 'yes' || value === 'enable';
  
  if (!['drops', 'events', 'giveaways', 'updates'].includes(type)) {
    return message.reply('Invalid type. Use: drops, events, giveaways, or updates');
  }
  
  config.pingSettings[type] = enabled;
  await saveServerConfig(serverId, config);
  
  const embed = new EmbedBuilder()
    .setColor(enabled ? 0x00FF00 : 0xFF6B6B)
    .setTitle('Ping Setting Updated')
    .setDescription(`Pings for **${type}** are now ${enabled ? '✅ **enabled**' : '❌ **disabled**'}`)
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}

async function handleStatus(message, serverId) {
  const config = getServerConfig(serverId) || {};
  
  const notifyRole = config.notifyRoleId ? `<@&${config.notifyRoleId}>` : 'None (no pings)';
  const dropChannel = config.dropChannelId ? `<#${config.dropChannelId}>` : 'Not set';
  const eventsChannel = config.eventsChannelId ? `<#${config.eventsChannelId}>` : 'Not set';
  const updatesChannel = config.updatesChannelId ? `<#${config.updatesChannelId}>` : 'Not set';
  
  const pingSettings = config.pingSettings || { drops: true, events: true, giveaways: true, updates: true };
  
  const embed = new EmbedBuilder()
    .setColor(0x00D9FF)
    .setTitle('Server Configuration Status')
    .addFields(
      { name: 'Notification Role', value: notifyRole, inline: false },
      { name: 'Drop Channel', value: dropChannel, inline: true },
      { name: 'Events Channel', value: eventsChannel, inline: true },
      { name: 'Updates Channel', value: updatesChannel, inline: true },
      { name: 'Ping Settings', value: 
        `Drops: ${pingSettings.drops ? '✅' : '❌'} | Events: ${pingSettings.events ? '✅' : '❌'}\n` +
        `Giveaways: ${pingSettings.giveaways ? '✅' : '❌'} | Updates: ${pingSettings.updates ? '✅' : '❌'}`, 
        inline: false 
      }
    )
    .setFooter({ text: `Server ID: ${serverId}` })
    .setTimestamp();
  
  return message.reply({ embeds: [embed] });
}
