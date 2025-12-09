const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { canSetupServer, isServerOwner, getServerConfig } = require('../../serverConfigManager.js');

module.exports = {
  name: 'setup',
  aliases: ['configure', 'config'],
  category: 'admin',
  description: 'Configure ZooBot for your server - create characters, collectibles, and manage settings',
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
    
    const config = getServerConfig(serverId);
    const hasNotifyRole = config && config.notifyRoleId;
    const hasDropChannel = config && config.dropChannelId;
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('ZooBot Server Setup')
      .setDescription(
        'Welcome to ZooBot! Here\'s how to set up and customize the bot for your server.\n\n' +
        '**Quick Setup Commands:**'
      )
      .addFields(
        { 
          name: '1. Set Notification Role', 
          value: '`!ss role @YourRole` - Set a role to ping instead of @everyone\n`!ss role none` - Disable all pings', 
          inline: false 
        },
        { 
          name: '2. Set Drop Channel', 
          value: '`!ss drop #channel` - Characters will appear here', 
          inline: false 
        },
        { 
          name: '3. Create Custom Characters', 
          value: '`!sc create` - Interactive 11-step wizard to create unique characters for your server', 
          inline: false 
        },
        { 
          name: '4. Create Custom Collectibles', 
          value: '`!scol create` - Interactive wizard to create collectibles (cannot be currency-related)', 
          inline: false 
        },
        { 
          name: '5. Manage Your Content', 
          value: '`!sc list` / `!scol list` - View all your characters/collectibles\n`!sc toggle <name>` - Enable/disable characters\n`!ss status` - View current configuration', 
          inline: false 
        }
      )
      .addFields(
        {
          name: 'Current Status',
          value: 
            `${hasNotifyRole ? '✅' : '❌'} Notification Role: ${hasNotifyRole ? `<@&${config.notifyRoleId}>` : 'Not set'}\n` +
            `${hasDropChannel ? '✅' : '❌'} Drop Channel: ${hasDropChannel ? `<#${config.dropChannelId}>` : 'Not set'}`,
          inline: false
        }
      )
      .addFields(
        {
          name: 'Important Notes',
          value:
            '• Server characters/collectibles only drop in YOUR server\n' +
            '• You CANNOT create coins, gems, or currency items (economy protection)\n' +
            '• ZooBot original characters are available for all servers\n' +
            '• No approval needed - your creations are active immediately!',
          inline: false
        }
      )
      .setFooter({ text: 'Server owners and admins only | Use !help for all commands' })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};
