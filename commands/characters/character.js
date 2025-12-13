const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');

module.exports = {
  name: 'character',
  aliases: ['char', 'charinfo'],
  category: 'characters',
  description: 'View detailed information about a character in your collection',
  usage: '!character <name or number>',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    if (!args.length) {
      return message.reply('❌ Usage: `!character <name or number>`\n\nExample: `!character Bruce` or `!character 1`');
    }
    
    const characters = userData.characters || [];
    
    if (characters.length === 0) {
      return message.reply('❌ You don\'t have any characters yet! Use `!start` to begin your journey.');
    }
    
    let character;
    const searchTerm = args.join(' ');
    
    // Try to find by number first
    const num = parseInt(searchTerm);
    if (!isNaN(num) && num > 0 && num <= characters.length) {
      character = characters[num - 1];
    } else {
      // Search by name
      character = characters.find(c => 
        c.name.toLowerCase() === searchTerm.toLowerCase() ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (!character) {
      return message.reply(`❌ Could not find a character matching "${searchTerm}" in your collection!`);
    }
    
    const rarityColors = {
      common: 0x808080,
      uncommon: 0x00FF00,
      rare: 0x0000FF,
      epic: 0x800080,
      legendary: 0xFFD700,
      'ultra rare': 0xFF69B4
    };
    
    const rarityEmojis = {
      common: '⬜',
      uncommon: '🟩',
      rare: '🟦',
      epic: '🟪',
      legendary: '🟨',
      'ultra rare': '💎'
    };
    
    const rarity = (character.rarity || 'common').toLowerCase();
    const color = rarityColors[rarity] || 0x808080;
    const rarityEmoji = rarityEmojis[rarity] || '⬜';
    
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${character.emoji || '🦁'} ${character.name}`)
      .setDescription(character.description || 'A collectible character.')
      .addFields(
        { name: 'Rarity', value: `${rarityEmoji} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}`, inline: true },
        { name: 'Level', value: `${character.level || 1}`, inline: true },
        { name: 'XP', value: `${character.xp || 0}`, inline: true }
      );
    
    // Stats
    if (character.stats) {
      embed.addFields({
        name: '📊 Battle Stats',
        value: 
          `❤️ HP: ${character.stats.hp || 100}\n` +
          `⚔️ Attack: ${character.stats.attack || 50}\n` +
          `🛡️ Defense: ${character.stats.defense || 50}\n` +
          `⚡ Speed: ${character.stats.speed || 50}`,
        inline: true
      });
    }
    
    // Ability
    if (character.ability) {
      embed.addFields({
        name: `✨ Ability: ${character.ability.name || 'Unknown'}`,
        value: character.ability.description || 'No description',
        inline: false
      });
    }
    
    // Special Move
    if (character.specialMove) {
      embed.addFields({
        name: `💥 Special Move: ${character.specialMove.name || 'Unknown'}`,
        value: `Damage: ${character.specialMove.damage || 100}`,
        inline: true
      });
    }
    
    // Skin if equipped
    if (character.equippedSkin) {
      embed.addFields({
        name: '🎨 Skin',
        value: character.equippedSkin,
        inline: true
      });
    }
    
    embed.setFooter({ text: `Owned by ${message.author.username}` })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};
