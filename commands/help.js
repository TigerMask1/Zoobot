const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { CATEGORIES, getCommandsByCategory, getAllCommands } = require('./commandHandler.js');

module.exports = {
  name: 'help',
  aliases: ['h', 'commands', 'cmds'],
  category: 'general',
  description: 'View all commands or get help for a specific command',
  usage: '!help [command]',
  
  async execute({ message, args }) {
    if (args[0]) {
      return showCommandHelp(message, args[0]);
    }
    
    return showMainHelp(message);
  }
};

async function showMainHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🦁 Zoo Bot Commands')
    .setDescription('Use the menu below to explore commands by category, or type `!help <command>` for details on a specific command.')
    .setThumbnail(message.client.user.displayAvatarURL())
    .addFields(
      { 
        name: '📊 Quick Stats', 
        value: `Total Commands: ${getAllCommands().length}\nCategories: ${Object.keys(CATEGORIES).length}`,
        inline: true 
      },
      {
        name: '🎮 Getting Started',
        value: '`!start` - Begin your journey\n`!daily` - Claim daily rewards\n`!work` - Earn coins & gems',
        inline: true
      }
    )
    .setFooter({ text: 'Select a category from the menu below' })
    .setTimestamp();
  
  for (const [key, category] of Object.entries(CATEGORIES)) {
    const commands = getCommandsByCategory(key);
    if (commands.length > 0) {
      embed.addFields({
        name: `${category.emoji} ${category.name}`,
        value: commands.slice(0, 5).map(c => `\`${c.name}\``).join(', ') + 
               (commands.length > 5 ? ` +${commands.length - 5} more` : ''),
        inline: true
      });
    }
  }
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_category')
    .setPlaceholder('📂 Select a category')
    .addOptions(
      Object.entries(CATEGORIES).map(([key, cat]) => ({
        label: cat.name,
        description: cat.description,
        value: key,
        emoji: cat.emoji
      }))
    );
  
  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  return message.reply({ embeds: [embed], components: [row] });
}

async function showCommandHelp(message, commandName) {
  const { getCommand } = require('./commandHandler.js');
  const command = getCommand(commandName);
  
  if (!command) {
    return message.reply(`❌ Command \`${commandName}\` not found! Use \`!help\` to see all commands.`);
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`📖 Command: ${command.name}`)
    .setDescription(command.description || 'No description available.')
    .addFields(
      { name: 'Usage', value: `\`${command.usage || `!${command.name}`}\``, inline: true },
      { name: 'Category', value: CATEGORIES[command.category]?.name || 'General', inline: true }
    );
  
  if (command.aliases && command.aliases.length > 0) {
    embed.addFields({ 
      name: 'Aliases', 
      value: command.aliases.map(a => `\`${a}\``).join(', '), 
      inline: true 
    });
  }
  
  if (command.cooldown) {
    const seconds = command.cooldown / 1000;
    embed.addFields({ name: 'Cooldown', value: `${seconds}s`, inline: true });
  }
  
  if (command.adminOnly) {
    embed.addFields({ name: '🔒 Permissions', value: 'Admin only', inline: true });
  }
  
  if (command.examples) {
    embed.addFields({ 
      name: 'Examples', 
      value: command.examples.map(e => `\`${e}\``).join('\n'), 
      inline: false 
    });
  }
  
  embed.setFooter({ text: 'Use !help to see all commands' });
  embed.setTimestamp();
  
  return message.reply({ embeds: [embed] });
}
