const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { saveData } = require('../../dataManager.js');

module.exports = {
  name: 'release',
  aliases: ['leave', 'remove'],
  category: 'characters',
  description: 'Release a character from your collection',
  usage: '!release <character name>',
  
  async execute({ message, args, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    if (!args.length) {
      return message.reply('❌ Usage: `!release <character name>`\n\nExample: `!release Bruce`');
    }
    
    const charName = args.join(' ').toLowerCase();
    const characters = userData.characters || [];
    
    const charIndex = characters.findIndex(c => c.name.toLowerCase() === charName);
    
    if (charIndex === -1) {
      return message.reply(`❌ You don't have a character named "${args.join(' ')}"!`);
    }
    
    const character = characters[charIndex];
    
    // Create confirmation
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('⚠️ Confirm Release')
      .setDescription(
        `Are you sure you want to release **${character.emoji || '🦁'} ${character.name}**?\n\n` +
        `**This action cannot be undone!**\n\n` +
        `You will receive a small refund of coins based on the character's rarity.`
      )
      .setFooter({ text: 'Click Confirm within 30 seconds' });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`release_confirm_${charIndex}`)
          .setLabel('Confirm Release')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('release_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const reply = await message.reply({ embeds: [confirmEmbed], components: [row] });
    
    const collector = reply.createMessageComponentCollector({ time: 30000 });
    
    collector.on('collect', async i => {
      if (i.user.id !== userId) {
        return i.reply({ content: '❌ This is not your confirmation!', ephemeral: true });
      }
      
      if (i.customId === 'release_cancel') {
        await i.update({
          embeds: [new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('❌ Release Cancelled')
            .setDescription(`${character.name} remains in your collection.`)],
          components: []
        });
        collector.stop();
        return;
      }
      
      if (i.customId.startsWith('release_confirm_')) {
        // Calculate refund based on rarity
        const rarityRefunds = {
          common: 10,
          uncommon: 25,
          rare: 50,
          epic: 100,
          legendary: 250,
          'ultra rare': 150
        };
        const refund = rarityRefunds[character.rarity?.toLowerCase()] || 10;
        
        // Remove character
        userData.characters.splice(charIndex, 1);
        userData.coins = (userData.coins || 0) + refund;
        
        await saveData(data);
        
        await i.update({
          embeds: [new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Character Released')
            .setDescription(
              `You released **${character.emoji || '🦁'} ${character.name}**.\n\n` +
              `💰 You received **${refund}** coins as compensation.`
            )],
          components: []
        });
        collector.stop();
      }
    });
    
    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        reply.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('⏰ Release Timed Out')
            .setDescription('No action taken. Your character is safe.')],
          components: []
        }).catch(() => {});
      }
    });
  }
};
