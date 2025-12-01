const { parseUserMention, createErrorEmbed, initializeUserData } = require('../../utils/shared.js');
const { initiateBattle } = require('../../battleSystem.js');
const { updateTaskProgress } = require('../../seasonSystem.js');
const { trackChallengeProgress } = require('../../weeklyChallengeSystem.js');
const { recordEvent } = require('../../analyticsSystem.js');

module.exports = {
  name: 'battle',
  aliases: ['b', 'fight'],
  category: 'battle',
  description: 'Challenge another player to a battle',
  usage: '!battle @user [character_name]',
  cooldown: 5000,
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    
    if (args.length < 1) {
      return message.reply('❌ Usage: `!battle @user [character_name]`\n\nExample: `!battle @player Rex`');
    }
    
    const targetId = parseUserMention(args[0]);
    if (!targetId) {
      return message.reply('❌ Please mention a valid user to battle!');
    }
    
    if (targetId === userId) {
      return message.reply('❌ You cannot battle yourself!');
    }
    
    const userData = initializeUserData(userId, data);
    const targetData = initializeUserData(targetId, data);
    
    if (!userData.characters || userData.characters.length === 0) {
      return message.reply('❌ You need at least one character to battle! Use `!start` to begin.');
    }
    
    if (!targetData.characters || targetData.characters.length === 0) {
      return message.reply('❌ Your opponent doesn\'t have any characters!');
    }
    
    const characterName = args.slice(1).join(' ') || null;
    
    let challenger;
    try {
      challenger = await client.users.fetch(userId);
    } catch {
      challenger = { username: 'Unknown', id: userId };
    }
    
    let opponent;
    try {
      opponent = await client.users.fetch(targetId);
    } catch {
      opponent = { username: 'Unknown', id: targetId };
    }
    
    recordEvent(message.guild?.id, 'battle_initiated', { 
      challenger: userId, 
      opponent: targetId 
    });
    
    try {
      await initiateBattle(message, data, challenger, opponent, characterName);
      
      updateTaskProgress(data, userId, 'battle', 1);
      trackChallengeProgress(data, userId, 'battles', 1);
      
    } catch (error) {
      console.error('Battle error:', error);
      return message.reply({ embeds: [createErrorEmbed('Battle Error', 'An error occurred while starting the battle. Please try again.')] });
    }
  }
};
