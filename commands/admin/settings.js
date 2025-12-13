const { EmbedBuilder } = require('discord.js');
const { 
  getServerConfig, 
  getFeatureSettings, 
  getSetupStatus, 
  isMainServer,
  canSetupServer 
} = require('../../serverConfigManager.js');
const characterManager = require('../../characterManager.js');

module.exports = {
  name: 'settings',
  aliases: ['serversettings', 'botsettings', 'ss'],
  category: 'admin',
  description: 'View or modify server settings',
  usage: '!settings [section]',
  adminOnly: true,
  
  async execute({ message, args, data }) {
    const serverId = message.guild?.id;
    
    if (!serverId) {
      return message.reply('❌ This command can only be used in a server!');
    }
    
    const config = getServerConfig(serverId) || {};
    const setupStatus = getSetupStatus(serverId);
    const features = getFeatureSettings(serverId);
    const characterCount = await characterManager.getServerCharacterCount(serverId);
    
    // Handle subcommands
    if (args[0]) {
      const section = args[0].toLowerCase();
      
      switch (section) {
        case 'channels':
          const channelsEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📣 Channel Settings')
            .addFields(
              { name: 'Drop Channel', value: config.dropChannelId ? `<#${config.dropChannelId}>` : 'Not set', inline: true },
              { name: 'Events Channel', value: config.eventsChannelId ? `<#${config.eventsChannelId}>` : 'Not set', inline: true },
              { name: 'Updates Channel', value: config.updatesChannelId ? `<#${config.updatesChannelId}>` : 'Not set', inline: true }
            )
            .addFields({
              name: 'How to Configure',
              value: 
                '`!setdropchannel #channel` - Set drop channel\n' +
                '`!seteventschannel #channel` - Set events channel\n' +
                '`!ss updates #channel` - Set updates channel'
            });
          return message.reply({ embeds: [channelsEmbed] });
          
        case 'updates':
          if (args[1]) {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
            if (!channel) {
              return message.reply('❌ Please mention a valid channel!');
            }
            const { setUpdatesChannel } = require('../../serverConfigManager.js');
            const result = await setUpdatesChannel(serverId, channel.id, message.author.id, message.member);
            return message.reply(result.message);
          }
          return message.reply(`📢 Updates channel: ${config.updatesChannelId ? `<#${config.updatesChannelId}>` : 'Not set'}\n\nUsage: \`!ss updates #channel\``);
          
        case 'features':
          const featuresEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('⚙️ Feature Settings')
            .setDescription('Use `!toggle <feature>` to change these settings.');
          
          const enabledFeatures = [];
          const disabledFeatures = [];
          
          for (const [key, value] of Object.entries(features)) {
            const name = key.replace('Enabled', '').replace(/([A-Z])/g, ' $1').trim();
            if (value !== false) {
              enabledFeatures.push(`✅ ${name}`);
            } else {
              disabledFeatures.push(`❌ ${name}`);
            }
          }
          
          featuresEmbed.addFields(
            { name: 'Enabled', value: enabledFeatures.join('\n') || 'None', inline: true },
            { name: 'Disabled', value: disabledFeatures.join('\n') || 'None', inline: true }
          );
          
          return message.reply({ embeds: [featuresEmbed] });
          
        case 'permissions':
          const { getAllAdminsInfo } = require('../../serverConfigManager.js');
          const admins = getAllAdminsInfo(serverId);
          
          const permsEmbed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🛡️ Permission Settings')
            .addFields(
              { name: 'Super Admins', value: admins.superAdmins.map(id => `<@${id}>`).join('\n') || 'None', inline: true },
              { name: 'Bot Admins', value: admins.globalBotAdmins.map(id => `<@${id}>`).join('\n') || 'None', inline: true },
              { name: 'Server Admins', value: admins.serverAdmins.map(id => `<@${id}>`).join('\n') || 'None', inline: true }
            )
            .addFields({
              name: 'Management Commands',
              value: 
                '`!addadmin @user` - Add server admin\n' +
                '`!removeadmin @user` - Remove server admin\n' +
                '`!hierarchy` - View permission levels'
            });
          return message.reply({ embeds: [permsEmbed] });
      }
    }
    
    // Main settings overview
    const embed = new EmbedBuilder()
      .setColor(setupStatus.isComplete ? 0x00FF00 : 0xF39C12)
      .setTitle(`⚙️ ${message.guild.name} Settings`)
      .setThumbnail(message.guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '📊 Setup Status', value: setupStatus.isComplete ? '✅ Complete' : '⚠️ Incomplete', inline: true },
        { name: '🎭 Characters', value: `${characterCount}`, inline: true },
        { name: '🎮 Selected Game', value: config.selectedGame || 'Not set', inline: true }
      );
    
    // Channels
    embed.addFields({
      name: '📣 Channels',
      value: 
        `Drop: ${config.dropChannelId ? `<#${config.dropChannelId}>` : '❌'}\n` +
        `Events: ${config.eventsChannelId ? `<#${config.eventsChannelId}>` : '❌'}\n` +
        `Updates: ${config.updatesChannelId ? `<#${config.updatesChannelId}>` : '❌'}`,
      inline: true
    });
    
    // Quick stats
    const enabledCount = Object.values(features).filter(v => v !== false).length;
    const totalFeatures = Object.keys(features).length;
    
    embed.addFields({
      name: '✨ Features',
      value: `${enabledCount}/${totalFeatures} enabled`,
      inline: true
    });
    
    embed.addFields({
      name: '📋 View Sections',
      value: 
        '`!ss channels` - Channel settings\n' +
        '`!ss features` - Feature toggles\n' +
        '`!ss permissions` - Admin permissions',
      inline: false
    });
    
    embed.setFooter({ text: 'Use !setup to run the setup wizard' });
    
    return message.reply({ embeds: [embed] });
  }
};
