const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveData } = require('../../dataManager.js');
const { initializeUserData, generateST } = require('../../utils/shared.js');
const characterManager = require('../../characterManager.js');

module.exports = {
  name: 'start',
  aliases: ['begin', 'newgame'],
  category: 'characters',
  description: 'Start your adventure and receive a starter character',
  usage: '!start',
  
  async execute({ message, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    
    if (userData.characters && userData.characters.length > 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('⚠️ Already Started')
        .setDescription(`You already have ${userData.characters.length} character(s)!\n\nUse \`!collection\` to view your characters or \`!help\` to see available commands.`)
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
    
    const starterCharacters = characterManager.getStarterCharacters();
    
    if (!starterCharacters || starterCharacters.length === 0) {
      return message.reply('❌ No starter characters available! Please contact an admin.');
    }
    
    const randomStarter = starterCharacters[Math.floor(Math.random() * starterCharacters.length)];
    
    const newCharacter = {
      id: generateST(),
      name: randomStarter.name,
      emoji: randomStarter.emoji || '🦁',
      level: 1,
      xp: 0,
      tokens: 0,
      ability: randomStarter.ability || null,
      specialMove: randomStarter.specialMove || null,
      obtainedAt: Date.now(),
      obtainedFrom: 'starter'
    };
    
    if (!userData.characters) {
      userData.characters = [];
    }
    userData.characters.push(newCharacter);
    
    userData.coins = (userData.coins || 0) + 500;
    userData.gems = (userData.gems || 0) + 50;
    
    if (!userData.crates) {
      userData.crates = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    }
    userData.crates.common = (userData.crates.common || 0) + 3;
    
    await saveData(data);
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 Welcome to the Zoo!')
      .setDescription(`Congratulations, **${message.author.username}**! Your adventure begins now!\n\n**Tip:** Use \`!hub\` to access our interactive menu - no commands to memorize!`)
      .addFields(
        { 
          name: '🦁 Your Starter Character', 
          value: `${newCharacter.emoji} **${newCharacter.name}**\n${randomStarter.ability ? `Ability: ${randomStarter.ability.name}` : 'No special ability'}`,
          inline: false 
        },
        {
          name: '🎁 Starter Bonus',
          value: '💰 500 Coins\n💎 50 Gems\n📦 3 Common Crates',
          inline: true
        },
        {
          name: '🚀 What\'s Next?',
          value: 'Click **Open Hub** below for an easy way to explore all features!',
          inline: true
        }
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Use !hub for the interactive menu or !help for all commands' })
      .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hub_main')
        .setLabel('Open Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('hub_guide')
        .setLabel('Quick Tutorial')
        .setEmoji('📚')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('feature_crates')
        .setLabel('Open Crates')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary)
    );
    
    return message.reply({ embeds: [embed], components: [row] });
  }
};
