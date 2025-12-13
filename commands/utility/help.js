const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getAllCommands, getCommandsByCategory, getCategoryInfo, getCommand } = require('../commandHandler.js');

module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  category: 'utility',
  description: 'Get help with bot commands',
  usage: '!help [command]',
  
  async execute({ message, args }) {
    // If specific command requested
    if (args[0]) {
      const command = getCommand(args[0].toLowerCase());
      
      if (command) {
        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle(`📖 Command: ${command.name}`)
          .setDescription(command.description || 'No description available.')
          .addFields(
            { name: 'Usage', value: `\`${command.usage || `!${command.name}`}\``, inline: true },
            { name: 'Category', value: command.category || 'General', inline: true }
          );
        
        if (command.aliases && command.aliases.length > 0) {
          embed.addFields({
            name: 'Aliases',
            value: command.aliases.map(a => `\`${a}\``).join(', '),
            inline: true
          });
        }
        
        if (command.cooldown) {
          embed.addFields({
            name: 'Cooldown',
            value: `${command.cooldown / 1000} seconds`,
            inline: true
          });
        }
        
        if (command.adminOnly) {
          embed.addFields({
            name: '⚠️ Admin Only',
            value: 'This command requires admin permissions',
            inline: true
          });
        }
        
        return message.reply({ embeds: [embed] });
      }
      
      return message.reply(`❌ Command "${args[0]}" not found. Use \`!help\` to see all commands.`);
    }
    
    // Main help menu
    const categories = getCategoryInfo();
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🦁 ZooBot Help')
      .setDescription(
        'Welcome to ZooBot! A character collection and battle game.\n\n' +
        '**Getting Started:**\n' +
        '`!start` - Create your account and get your first character\n' +
        '`!daily` - Claim daily rewards\n' +
        '`!profile` - View your profile\n\n' +
        '**Quick Commands:**'
      )
      .addFields(
        { name: '🦁 Characters', value: '`!collection` `!char` `!release`', inline: true },
        { name: '💰 Economy', value: '`!balance` `!daily` `!work`', inline: true },
        { name: '⚔️ Battle', value: '`!battle @user` `!b`', inline: true },
        { name: '📦 Crates', value: '`!crate` `!opencrate`', inline: true },
        { name: '🤝 Social', value: '`!profile` `!leaderboard`', inline: true },
        { name: '🏰 Clans', value: '`!clan` `!clans` `!joinclan`', inline: true }
      )
      .addFields({
        name: '📚 More Help',
        value: 
          '`!help <command>` - Get details on a specific command\n' +
          '`!guide` - View the player guide\n' +
          '`!modhelp` - Moderation commands'
      })
      .setFooter({ text: 'Prefix: ! | Use !help <command> for details' })
      .setTimestamp();
    
    // Add category breakdown
    const allCommands = getAllCommands();
    const commandCount = allCommands.length;
    
    embed.setDescription(
      `Welcome to ZooBot! A character collection and battle game.\n\n` +
      `📊 **${commandCount}** commands available across multiple categories.\n\n` +
      '**Quick Start:**\n' +
      '`!start` - Create your account\n' +
      '`!daily` - Claim daily rewards\n' +
      '`!help <command>` - Get command details'
    );
    
    return message.reply({ embeds: [embed] });
  }
};
