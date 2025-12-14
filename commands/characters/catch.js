const { EmbedBuilder } = require('discord.js');
const { initializeUserData } = require('../../utils/shared.js');
const { saveData, saveDataImmediate } = require('../../dataManager.js');
const { recordCatchAttempt } = require('../../dropSystem.js');
const { catchKeyDrop } = require('../../characterKeySystem.js');
const { trackChallengeProgress } = require('../../weeklyChallengeSystem.js');
const { checkAchievements } = require('../../achievementSystem.js');
const { updateTaskProgress, initializePersonalizedTaskData, checkTaskProgress, completePersonalizedTask } = require('../../seasonPassSystem.js');
const { awardCollectibleItem, awardServerCollectible } = require('../../collectibleItemsSystem.js');
const { recordEvent } = require('../../analyticsSystem.js');
const eventSystem = require('../../eventSystem.js');

module.exports = {
  name: 'catch',
  aliases: ['c', 'grab'],
  category: 'characters',
  description: 'Catch a dropped character (use the code shown in drop)',
  usage: '!c <code>',
  
  async execute({ message, args, data, client }) {
    const userId = message.author.id;
    const serverId = message.guild?.id;
    
    if (!args[0]) {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🦁 Catching Characters')
        .setDescription(
          'To catch a character, wait for a **drop** to appear in the drop channel!\n\n' +
          '**How it works:**\n' +
          '1. A character will randomly drop in the drop channel\n' +
          '2. Type the code shown (e.g., `!c tyrant`)\n' +
          '3. First person to type the correct code catches it!\n\n' +
          '**Tips:**\n' +
          '• Keep notifications on for the drop channel\n' +
          '• Be quick - other players are competing too!\n' +
          '• Some characters are rarer than others'
        )
        .setFooter({ text: 'Wait for a drop to appear!' });
      
      return message.reply({ embeds: [embed] });
    }
    
    const code = args[0].toLowerCase();
    
    if (!serverId) return;
    
    recordCatchAttempt(serverId);
    
    if (!data.serverDrops) data.serverDrops = {};
    
    if (!data.serverDrops[serverId] || data.serverDrops[serverId].code !== code) {
      return;
    }
    
    const drop = data.serverDrops[serverId];
    
    if (drop.type === 'characterKey') {
      const keyResult = await catchKeyDrop(userId, serverId, data);
      
      if (keyResult && keyResult.success) {
        if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
        data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
        data.users[userId].lastActivity = Date.now();
        
        trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
        checkAchievements(data.users[userId]);
        updateTaskProgress(data.users[userId], 'dropsCaught', 1);
        
        if (message.guild) {
          recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
          const { addAura } = require('../../serverAuraSystem.js');
          addAura(message.guild.id, 5, 'drop_catch').catch(e => console.error('Error adding drop aura:', e));
        }
        
        const keyEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🔑 CHARACTER KEY CAUGHT!')
          .setDescription(`<@${userId}> caught the key!\n\n**Reward:** ${keyResult.amount} ${keyResult.characterEmoji} ${keyResult.characterName} Key${keyResult.amount > 1 ? 's' : ''}${keyResult.bonusMessage}`)
          .setFooter({ text: 'Use !charkeys to view your collection!' });
        
        await message.reply({ embeds: [keyEmbed] });
      }
      
    } else if (drop.type === 'tokens') {
      const charToReward = data.users[userId].characters.find(c => 
        c.name.toLowerCase() === drop.characterName.toLowerCase()
      );
      
      if (charToReward) {
        delete data.serverDrops[serverId];
        charToReward.tokens += drop.amount;
        
        if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
        data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
        data.users[userId].lastActivity = Date.now();
        
        trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
        checkAchievements(data.users[userId]);
        updateTaskProgress(data.users[userId], 'dropsCaught', 1);
        
        if (message.guild) {
          recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
          const { addAura } = require('../../serverAuraSystem.js');
          addAura(message.guild.id, 5, 'drop_catch').catch(e => console.error('Error adding drop aura:', e));
        }
        
        const ptData = initializePersonalizedTaskData(data.users[userId]);
        if (ptData.taskProgress.dropsCaught !== undefined) {
          const completedTask = checkTaskProgress(data.users[userId], 'dropsCaught', 1);
          if (completedTask) {
            await completePersonalizedTask(client, userId, data, completedTask);
          }
        }
        
        await eventSystem.recordProgress(userId, data.users[userId].username, 1, 'drop_catcher');
        
        saveData(data);
        
        const dropEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🎉 DROP CAUGHT!')
          .setDescription(`<@${userId}> caught the drop!\n\n**Reward:** ${drop.amount} ${drop.characterName} tokens 🎫`);
        
        await message.reply({ embeds: [dropEmbed] });
      } else {
        await message.reply(`❌ You don't own **${drop.characterName}**, so you can't collect these tokens! Drop remains active.`);
      }
      
    } else if (drop.type === 'collectibleItem') {
      let awardResult;
      if (drop.isServerSpecific) {
        awardResult = await awardServerCollectible(userId, serverId, drop.itemId);
      } else {
        awardResult = await awardCollectibleItem(userId, drop.itemId);
      }
      
      if (awardResult && awardResult.success) {
        delete data.serverDrops[serverId];
        
        if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
        data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
        data.users[userId].lastActivity = Date.now();
        
        if (message.guild) {
          const { addAura } = require('../../serverAuraSystem.js');
          addAura(message.guild.id, 6, 'collectible_drop').catch(e => console.error('Error adding collectible aura:', e));
        }
        
        trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
        checkAchievements(data.users[userId]);
        updateTaskProgress(data.users[userId], 'dropsCaught', 1);
        
        if (message.guild) {
          recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
        }
        
        await eventSystem.recordProgress(userId, data.users[userId].username, 1, 'drop_catcher');
        
        saveData(data);
        
        const collectibleEmbed = new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🎁 COLLECTIBLE CAUGHT!')
          .setDescription(`<@${userId}> caught the drop!\n\n**Reward:** ${drop.emoji} **${drop.itemName}** (${drop.rarity?.name || 'common'})\n💰 Value: ${drop.itemValue} coins`)
          .setThumbnail(drop.itemImage || null)
          .setFooter({ text: 'Use !myitems to view your collection!' });
        
        await message.reply({ embeds: [collectibleEmbed] });
      } else if (awardResult && awardResult.alreadyOwned) {
        await message.reply(`❌ You already own **${drop.itemName}** and it's not stackable! Drop remains active.`);
      } else {
        await message.reply(`❌ Failed to award collectible. Drop remains active.`);
      }
      
    } else {
      delete data.serverDrops[serverId];
      
      if (drop.type === 'coins') {
        data.users[userId].coins += drop.amount;
        updateTaskProgress(data.users[userId], 'coinsEarned', drop.amount);
      } else if (drop.type === 'gems') {
        data.users[userId].gems += drop.amount;
      } else if (drop.type === 'shards') {
        data.users[userId].shards = (data.users[userId].shards || 0) + drop.amount;
      }
      
      if (!data.users[userId].questProgress) data.users[userId].questProgress = {};
      data.users[userId].questProgress.dropsCaught = (data.users[userId].questProgress.dropsCaught || 0) + 1;
      data.users[userId].lastActivity = Date.now();
      
      trackChallengeProgress(data.users[userId], 'dropsCaught', 1);
      checkAchievements(data.users[userId]);
      updateTaskProgress(data.users[userId], 'dropsCaught', 1);
      
      if (message.guild) {
        recordEvent(data, message.guild.id, 'dropsClaimed', 1, userId);
      }
      
      const ptData2 = initializePersonalizedTaskData(data.users[userId]);
      if (ptData2.taskProgress.dropsCaught !== undefined) {
        const completedTask2 = checkTaskProgress(data.users[userId], 'dropsCaught', 1);
        if (completedTask2) {
          await completePersonalizedTask(client, userId, data, completedTask2);
        }
      }
      
      await eventSystem.recordProgress(userId, data.users[userId].username, 1, 'drop_catcher');
      
      let christmasGiftText = '';
      try {
        const { shouldDropChristmasGift, addChristmasGift, createCommunityMilestoneAnnouncement, distributeMilestoneRewards } = require('../../christmasEventSystem.js');
        if (shouldDropChristmasGift('drop')) {
          const giftResult = await addChristmasGift(userId, serverId, 'drop');
          if (giftResult.success) {
            christmasGiftText = `\n\n🎁🎄 **CHRISTMAS GIFT!** You also found a festive gift!\n✨ Your gifts: ${giftResult.userGifts} | Global: ${giftResult.totalGifts}`;
            
            for (const notification of giftResult.notifications || []) {
              if (notification.type === 'community') {
                await createCommunityMilestoneAnnouncement(client, data, notification.milestone);
              } else if (notification.type === 'personal') {
                await distributeMilestoneRewards(client, data, notification.milestone, 'personal', userId);
                christmasGiftText += `\n🎄 **PERSONAL MILESTONE!** ${notification.milestone.name} reached!`;
              } else if (notification.type === 'server' && serverId) {
                const serverUsers = Object.keys(data.users).filter(uid => data.users[uid]);
                await distributeMilestoneRewards(client, data, notification.milestone, 'server', null, serverUsers.slice(0, 100));
                christmasGiftText += `\n🎄 **SERVER MILESTONE!** ${notification.milestone.name} reached!`;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking Christmas gift:', error);
      }
      
      saveData(data);
      
      let rewardText = '';
      if (drop.type === 'coins') {
        rewardText = `${drop.amount} coins 💰`;
      } else if (drop.type === 'gems') {
        rewardText = `${drop.amount} gems 💎`;
      } else if (drop.type === 'shards') {
        rewardText = `${drop.amount} shards 🔷`;
      }
      
      const dropEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 DROP CAUGHT!')
        .setDescription(`<@${userId}> caught the drop!\n\n**Reward:** ${rewardText}${christmasGiftText}`);
      
      await message.reply({ embeds: [dropEmbed] });
    }
  }
};
