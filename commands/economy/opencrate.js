const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { openCrate } = require('../../crateSystem.js');
const { getActiveSession, clearSession } = require('../../chestInteractionManager.js');
const { saveDataImmediate } = require('../../dataManager.js');

module.exports = {
  name: 'opencrate',
  aliases: ['openchest', 'open'],
  category: 'economy',
  description: 'Open a picked crate/chest',
  usage: '!opencrate',
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    initializeUserData(userId, data);
    
    const activeSession = getActiveSession(userId);
    
    if (!activeSession) {
      return message.reply('❌ You don\'t have an active chest session!\n\nUse `!pickcrate <type>` to start opening a chest.\nExample: `!pickcrate gold`');
    }
    
    const timeLeft = Math.ceil((activeSession.expiresAt - Date.now()) / 1000);
    
    if (timeLeft <= 0) {
      clearSession(userId);
      return message.reply('❌ Your chest session expired! Use `!pickcrate <type>` to pick a new chest.');
    }
    
    const openResult = await openCrate(data, userId, activeSession.crateType, client);
    
    if (!openResult.success) {
      clearSession(userId);
      return message.reply(`❌ ${openResult.message}`);
    }
    
    clearSession(userId);
    await saveDataImmediate(data);
    
    const openResultEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🎁 ${activeSession.crateType.toUpperCase()} CHEST OPENED!`)
      .setDescription(`<@${userId}> opened their chest!\n\n${openResult.message}`)
      .setTimestamp();
    
    return message.reply({ embeds: [openResultEmbed] });
  }
};
