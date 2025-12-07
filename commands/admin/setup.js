const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { canSetupServer, isServerOwner } = require('../../serverConfigManager.js');

module.exports = {
  name: 'setup',
  aliases: ['configure', 'config'],
  category: 'admin',
  description: 'Configure ZooBot for your server via the web dashboard',
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
    
    const baseUrl = process.env.WEBSITE_URL || process.env.RENDER_EXTERNAL_URL || 'https://zoobot-zoki.onrender.com';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const dashboardUrl = `${cleanBase}/admin`;
    
    const embed = new EmbedBuilder()
      .setColor(0x00D9FF)
      .setTitle('ZooBot Dashboard Setup')
      .setDescription(
        'To configure ZooBot for your server, please use our **web dashboard**.\n\n' +
        'The dashboard allows you to:\n' +
        '- Select which characters appear in drops\n' +
        '- Choose collectibles for your server\n' +
        '- Configure bot features and settings\n' +
        '- Manage server-specific options\n\n' +
        'Click the button below to open the dashboard and log in with Discord.'
      )
      .setFooter({ text: 'You must be a server owner or admin to configure the bot' })
      .setTimestamp();
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Open Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(dashboardUrl)
          .setEmoji('🌐')
      );
    
    return message.reply({ embeds: [embed], components: [row] });
  }
};
