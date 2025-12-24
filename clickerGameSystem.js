const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { isMainServer } = require('./serverConfigManager.js');

const activeClickers = new Map();
const CLICKER_COOLDOWN = 30000; // 30 seconds
const GAME_DURATION = 15000; // 15 seconds to click items

// Rarity for items that drop
const ITEM_RARITY = {
  coin: { weight: 60, reward: { coins: 50 }, emoji: '💰' },
  gem: { weight: 30, reward: { gems: 5 }, emoji: '💎' },
  crate: { weight: 10, reward: { crates: 1 }, emoji: '📦' }
};

function checkClickerCooldown(userId) {
  const key = `clicker_${userId}`;
  const now = Date.now();
  
  if (activeClickers.has(key)) {
    const lastGame = activeClickers.get(key);
    const timeLeft = CLICKER_COOLDOWN - (now - lastGame);
    
    if (timeLeft > 0) {
      return { onCooldown: true, timeLeft: Math.ceil(timeLeft / 1000) };
    }
  }
  
  activeClickers.set(key, now);
  return { onCooldown: false };
}

function generateFallingItems() {
  const items = [];
  const itemTypes = Object.keys(ITEM_RARITY);
  
  // Generate 5 items with weighted random selection
  for (let i = 0; i < 5; i++) {
    const rand = Math.random() * 100;
    let cumulativeWeight = 0;
    let selectedType = 'coin';
    
    for (const type of itemTypes) {
      cumulativeWeight += ITEM_RARITY[type].weight;
      if (rand <= cumulativeWeight) {
        selectedType = type;
        break;
      }
    }
    
    items.push({
      id: `item_${i}`,
      type: selectedType,
      emoji: ITEM_RARITY[selectedType].emoji,
      reward: ITEM_RARITY[selectedType].reward,
      clicked: false
    });
  }
  
  return items;
}

async function startClickerGame(message, data) {
  const userId = message.author.id;
  const serverId = message.guild?.id;
  const userData = data.users[userId];
  
  const cooldown = checkClickerCooldown(userId);
  if (cooldown.onCooldown) {
    return message.reply(`⏰ **Clicker Game** cooling down! Wait **${cooldown.timeLeft}s** before playing again.`);
  }
  
  if (!userData) {
    return message.reply('❌ You must start the game first with `!start`!');
  }
  
  // Generate falling items
  const items = generateFallingItems();
  
  // Create buttons for each item
  const rows = [];
  for (let i = 0; i < items.length; i += 5) {
    const rowItems = items.slice(i, i + 5);
    const row = new ActionRowBuilder();
    
    rowItems.forEach(item => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(item.id)
          .setLabel(item.emoji)
          .setStyle(ButtonStyle.Primary)
      );
    });
    
    rows.push(row);
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎮 **CLICKER GAME**')
    .setDescription('⏱️ **15 seconds!**\nClick the falling items to collect rewards!\n\n💰 **Coins** (most common)\n💎 **Gems** (rare)\n📦 **Crates** (ultra rare)')
    .setFooter({ text: 'Click as many as you can before time runs out!' });
  
  const gameMessage = await message.reply({ embeds: [embed], components: rows });
  
  // Disable buttons after game duration
  const disableTimeout = setTimeout(async () => {
    const disabledRows = rows.map(row => {
      const disabledRow = new ActionRowBuilder();
      row.components.forEach(button => {
        disabledRow.addComponents(
          ButtonBuilder.from(button).setDisabled(true)
        );
      });
      return disabledRow;
    });
    
    try {
      await gameMessage.edit({ components: disabledRows });
    } catch (error) {
      console.error('Error disabling buttons:', error);
    }
  }, GAME_DURATION);
  
  // Handle button clicks
  const collector = gameMessage.createMessageComponentCollector({
    time: GAME_DURATION
  });
  
  let totalReward = { coins: 0, gems: 0, crates: 0 };
  let itemsCollected = 0;
  
  collector.on('collect', async (interaction) => {
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ This is not your game!', ephemeral: true });
    }
    
    // Find the clicked item
    const clickedItem = items.find(item => item.id === interaction.customId);
    if (!clickedItem || clickedItem.clicked) {
      return interaction.reply({ content: '❌ Already collected or invalid!', ephemeral: true });
    }
    
    clickedItem.clicked = true;
    itemsCollected++;
    
    // Apply reward
    Object.keys(clickedItem.reward).forEach(key => {
      totalReward[key] = (totalReward[key] || 0) + clickedItem.reward[key];
    });
    
    // Update user data
    userData.coins = (userData.coins || 0) + (clickedItem.reward.coins || 0);
    userData.gems = (userData.gems || 0) + (clickedItem.reward.gems || 0);
    userData.crates = (userData.crates || 0) + (clickedItem.reward.crates || 0);
    
    // Apply main server bonus (30% more coins)
    if (isMainServer(serverId)) {
      const coinBonus = Math.floor((clickedItem.reward.coins || 0) * 0.3);
      userData.coins += coinBonus;
      totalReward.coins += coinBonus;
    }
    
    await saveDataImmediate(data);
    
    const rewardText = [];
    if (clickedItem.reward.coins) rewardText.push(`+${clickedItem.reward.coins} 💰`);
    if (clickedItem.reward.gems) rewardText.push(`+${clickedItem.reward.gems} 💎`);
    if (clickedItem.reward.crates) rewardText.push(`+${clickedItem.reward.crates} 📦`);
    
    await interaction.reply({
      content: `✅ Collected ${clickedItem.emoji}\n${rewardText.join(' | ')}${isMainServer(serverId) ? '\n⭐ Main Server Bonus +30% coins!' : ''}`,
      ephemeral: true
    });
  });
  
  collector.on('end', async () => {
    clearTimeout(disableTimeout);
    
    const resultEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎮 **GAME OVER!**')
      .setDescription(`⏱️ Time's up!`)
      .addFields(
        { name: '📊 Items Collected', value: `${itemsCollected}/5`, inline: true },
        { name: '💰 Coins Earned', value: totalReward.coins.toString(), inline: true },
        { name: '💎 Gems Earned', value: totalReward.gems.toString(), inline: true }
      );
    
    if (totalReward.crates > 0) {
      resultEmbed.addFields({ name: '📦 Crates Earned', value: `${totalReward.crates} ✨`, inline: false });
    }
    
    resultEmbed.setFooter({ text: `Play again in 30 seconds!${isMainServer(serverId) ? ' ⭐ Main Server - 30% coin bonus!' : ''}` });
    
    try {
      await message.reply({ embeds: [resultEmbed] });
    } catch (error) {
      console.error('Error sending game over message:', error);
    }
  });
}

module.exports = {
  startClickerGame,
  checkClickerCooldown
};
