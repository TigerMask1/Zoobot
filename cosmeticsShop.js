const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { getUSTBalance } = require('./ustSystem.js');
const { 
  TIER_INFO, 
  getAvailableCosmetics, 
  getAllCosmeticsForCharacters,
  purchaseCosmetic,
  userOwnsCosmetic
} = require('./cosmeticsSystem.js');
const characterManager = require('./characterManager.js');

const activeShops = new Map();

async function openCosmeticsShop(message, data) {
  const userId = message.author.id;
  
  if (!data.users[userId]) {
    await message.reply('❌ You need to use `!start` first!');
    return;
  }
  
  if (activeShops.has(userId)) {
    await message.reply('❌ You already have a shop menu open!');
    return;
  }
  
  const shopMessage = await message.reply({ content: 'Loading cosmetics shop...' });
  await showMainCosmeticsShop(shopMessage, data, userId);
  
  activeShops.set(userId, {
    message: shopMessage,
    timeout: setTimeout(() => {
      closeCosmeticsShop(userId);
    }, 300000)
  });
  
  const filter = (interaction) => {
    return interaction.user.id === userId && 
           (interaction.customId.startsWith('cshop_') || interaction.customId.startsWith('cbuy_'));
  };
  
  const collector = shopMessage.createMessageComponentCollector({ filter, time: 300000 });
  
  collector.on('collect', async (interaction) => {
    try {
      if (interaction.customId === `cshop_close_${userId}`) {
        await interaction.update({ 
          embeds: [new EmbedBuilder()
            .setColor('#808080')
            .setTitle('🛍️ Cosmetics Shop Closed')
            .setDescription('Thanks for browsing!')],
          components: []
        });
        closeCosmeticsShop(userId);
        collector.stop();
      } else if (interaction.customId === `cshop_type_${userId}`) {
        await showCosmeticType(interaction, data, interaction.values[0]);
      } else if (interaction.customId === `cshop_character_${userId}`) {
        const [type, character] = interaction.values[0].split('|');
        await showCharacterCosmetics(interaction, data, type, character);
      } else if (interaction.customId.startsWith('cbuy_cosmetic_')) {
        const [type, character, itemName] = interaction.values[0].split('|');
        await handleCosmeticPurchase(interaction, data, type, character, itemName);
      } else if (interaction.customId === `cshop_back_${userId}`) {
        await showMainCosmeticsShopInteraction(interaction, data);
      } else if (interaction.customId === `cshop_back_type_${userId}`) {
        const type = interaction.message.embeds[0]?.description?.includes('SKINS') ? 'skin' : 'pfp';
        await showCosmeticType(interaction, data, type);
      }
    } catch (error) {
      console.error('Cosmetics shop interaction error:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred. Please try again.', flags: 64 }).catch(() => {});
      }
    }
  });
  
  collector.on('end', () => {
    closeCosmeticsShop(userId);
  });
}

async function showMainCosmeticsShop(message, data, userId) {
  const user = data.users[userId];
  const ustBalance = getUSTBalance(data, userId) || 0;
  
  const shopEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🛍️ COSMETICS SHOP')
    .setDescription(`Welcome to the Cosmetics Shop!\n\n**Your Balance:**\n🌟 ${ustBalance} UST (Universal Skin Tokens)\n\nBrowse and purchase exclusive skins and profile pictures!`)
    .addFields(
      { name: '🎨 Skins', value: 'Customize your characters with unique skins', inline: true },
      { name: '🖼️ Profile Pictures', value: 'Stand out with special profile images', inline: true }
    )
    .setFooter({ text: 'Shop will close after 5 minutes of inactivity • Earn UST from Clan Wars!' });
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`cshop_type_${userId}`)
    .setPlaceholder('Choose what to browse')
    .addOptions([
      {
        label: 'Character Skins',
        value: 'skin',
        description: 'Browse skins for your characters',
        emoji: '🎨'
      },
      {
        label: 'Profile Pictures',
        value: 'pfp',
        description: 'Browse special profile pictures',
        emoji: '🖼️'
      }
    ]);
  
  const closeButton = new ButtonBuilder()
    .setCustomId(`cshop_close_${userId}`)
    .setLabel('Close Shop')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  
  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(closeButton);
  
  await message.edit({ embeds: [shopEmbed], components: [row1, row2] });
}

async function showMainCosmeticsShopInteraction(interaction, data) {
  const userId = interaction.user.id;
  const user = data.users[userId];
  const ustBalance = getUSTBalance(data, userId) || 0;
  
  const shopEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🛍️ COSMETICS SHOP')
    .setDescription(`Welcome to the Cosmetics Shop!\n\n**Your Balance:**\n🌟 ${ustBalance} UST (Universal Skin Tokens)\n\nBrowse and purchase exclusive skins and profile pictures!`)
    .addFields(
      { name: '🎨 Skins', value: 'Customize your characters with unique skins', inline: true },
      { name: '🖼️ Profile Pictures', value: 'Stand out with special profile images', inline: true }
    )
    .setFooter({ text: 'Shop will close after 5 minutes of inactivity • Earn UST from Clan Wars!' });
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`cshop_type_${userId}`)
    .setPlaceholder('Choose what to browse')
    .addOptions([
      {
        label: 'Character Skins',
        value: 'skin',
        description: 'Browse skins for your characters',
        emoji: '🎨'
      },
      {
        label: 'Profile Pictures',
        value: 'pfp',
        description: 'Browse special profile pictures',
        emoji: '🖼️'
      }
    ]);
  
  const closeButton = new ButtonBuilder()
    .setCustomId(`cshop_close_${userId}`)
    .setLabel('Close Shop')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  
  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(closeButton);
  
  await interaction.update({ embeds: [shopEmbed], components: [row1, row2] });
}

async function showCosmeticType(interaction, data, type) {
  const userId = interaction.user.id;
  const user = data.users[userId];
  const ustBalance = getUSTBalance(data, userId) || 0;
  
  const ownedCharacters = user.characters ? Object.keys(user.characters) : [];
  
  if (type === 'skin' && ownedCharacters.length === 0) {
    await interaction.reply({ 
      content: '❌ You don\'t own any characters yet! Catch some characters first using `!catch`!', 
      flags: 64 
    });
    return;
  }
  
  const typeDisplay = type === 'skin' ? 'SKINS' : 'PROFILE PICTURES';
  const typeEmoji = type === 'skin' ? '🎨' : '🖼️';
  
  const embed = new EmbedBuilder()
    .setColor('#00D9FF')
    .setTitle(`${typeEmoji} ${typeDisplay} SHOP`)
    .setDescription(`**Your Balance:** 🌟 ${ustBalance} UST\n\nSelect a character to view available ${type}s!`)
    .setFooter({ text: 'Only showing characters you own' });
  
  let options;
  
  if (type === 'skin') {
    options = ownedCharacters.map(charName => {
      const char = characterManager.getCharacterByName(charName);
      return {
        label: charName,
        value: `skin|${charName}`,
        description: `View skins for ${charName}`,
        emoji: char?.emoji || '🦁'
      };
    }).slice(0, 25);
  } else {
    const allCosmetics = await getAvailableCosmetics('pfp');
    
    if (allCosmetics.length === 0) {
      await interaction.reply({ 
        content: '❌ No profile pictures available at the moment! Check back later!', 
        flags: 64 
      });
      return;
    }
    
    const characterSet = new Set(allCosmetics.map(c => c.characterName));
    options = Array.from(characterSet).map(charName => {
      const displayName = charName.charAt(0).toUpperCase() + charName.slice(1);
      const char = characterManager.getCharacterByName(displayName);
      return {
        label: displayName,
        value: `pfp|${displayName}`,
        description: `View ${displayName} profile pictures`,
        emoji: char?.emoji || '🖼️'
      };
    }).slice(0, 25);
  }
  
  if (options.length === 0) {
    await interaction.reply({ 
      content: `❌ No ${type}s available at the moment!`, 
      flags: 64 
    });
    return;
  }
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`cshop_character_${userId}`)
    .setPlaceholder('Choose a character')
    .addOptions(options);
  
  const backButton = new ButtonBuilder()
    .setCustomId(`cshop_back_${userId}`)
    .setLabel('Back to Main')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⬅️');
  
  const closeButton = new ButtonBuilder()
    .setCustomId(`cshop_close_${userId}`)
    .setLabel('Close')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  
  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(backButton, closeButton);
  
  await interaction.update({ embeds: [embed], components: [row1, row2] });
}

async function showCharacterCosmetics(interaction, data, type, characterName) {
  const userId = interaction.user.id;
  const ustBalance = getUSTBalance(data, userId) || 0;
  
  const cosmetics = await getAvailableCosmetics(type, characterName);
  
  if (cosmetics.length === 0) {
    await interaction.reply({ 
      content: `❌ No ${type}s available for ${characterName} at the moment!`, 
      flags: 64 
    });
    return;
  }
  
  cosmetics.sort((a, b) => {
    const tierOrder = ['common', 'rare', 'ultra_rare', 'epic', 'legendary', 'exclusive'];
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
  });
  
  const cosmeticsByTier = {};
  cosmetics.forEach(cosmetic => {
    if (!cosmeticsByTier[cosmetic.tier]) {
      cosmeticsByTier[cosmetic.tier] = [];
    }
    cosmeticsByTier[cosmetic.tier].push(cosmetic);
  });
  
  const typeDisplay = type === 'skin' ? 'Skins' : 'Profile Pictures';
  const typeEmoji = type === 'skin' ? '🎨' : '🖼️';
  
  const embed = new EmbedBuilder()
    .setColor(TIER_INFO[cosmetics[0].tier]?.color || '#9B59B6')
    .setTitle(`${typeEmoji} ${characterName} ${typeDisplay}`)
    .setDescription(`**Your Balance:** 🌟 ${ustBalance} UST\n\nAvailable ${type}s for ${characterName}:`)
    .setFooter({ text: 'Select a cosmetic to purchase' });
  
  for (const [tier, items] of Object.entries(cosmeticsByTier)) {
    const tierEmoji = TIER_INFO[tier].emoji;
    const tierName = tier.replace('_', ' ').toUpperCase();
    const itemsList = items.map(item => {
      const owned = userOwnsCosmetic(userId, type, characterName, item.itemName, data);
      const ownedText = owned ? ' ✅ Owned' : '';
      return `**${item.displayName}** - ${item.price} UST${ownedText}`;
    }).join('\n');
    
    embed.addFields({
      name: `${tierEmoji} ${tierName}`,
      value: itemsList,
      inline: false
    });
  }
  
  const options = cosmetics.slice(0, 25).map(cosmetic => {
    const tierEmoji = TIER_INFO[cosmetic.tier].emoji;
    const owned = userOwnsCosmetic(userId, type, characterName, cosmetic.itemName, data);
    return {
      label: `${cosmetic.displayName} ${owned ? '✅' : ''}`,
      value: `${type}|${characterName}|${cosmetic.itemName}`,
      description: `${cosmetic.tier.toUpperCase()} - ${cosmetic.price} UST ${owned ? '(Owned)' : ''}`,
      emoji: tierEmoji
    };
  });
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`cbuy_cosmetic_${userId}`)
    .setPlaceholder('Select to purchase or preview')
    .addOptions(options);
  
  const backButton = new ButtonBuilder()
    .setCustomId(`cshop_back_type_${userId}`)
    .setLabel('Back to Characters')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⬅️');
  
  const closeButton = new ButtonBuilder()
    .setCustomId(`cshop_close_${userId}`)
    .setLabel('Close')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');
  
  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(backButton, closeButton);
  
  await interaction.update({ embeds: [embed], components: [row1, row2] });
}

async function handleCosmeticPurchase(interaction, data, type, characterName, itemName) {
  const userId = interaction.user.id;
  
  const result = await purchaseCosmetic(userId, type, characterName, itemName, data);
  
  if (result.success) {
    const cosmetic = result.cosmetic;
    const tierEmoji = TIER_INFO[cosmetic.tier].emoji;
    const tierColor = TIER_INFO[cosmetic.tier].color;
    
    const embed = new EmbedBuilder()
      .setColor(tierColor)
      .setTitle('✅ Purchase Successful!')
      .setDescription(`You purchased ${tierEmoji} **${cosmetic.tier.toUpperCase()}** ${type}:\n**${cosmetic.displayName}** for ${characterName}`)
      .setThumbnail(cosmetic.imageUrl)
      .addFields(
        { name: '💰 Price', value: `${cosmetic.price} UST`, inline: true },
        { name: '🌟 Remaining UST', value: `${result.newBalance} UST`, inline: true }
      )
      .setFooter({ text: `Use !equipskin ${characterName} ${itemName} to equip it!` });
    
    if (type === 'pfp') {
      embed.setFooter({ text: `Use !equippfp to set it as your profile picture!` });
    }
    
    await interaction.reply({ embeds: [embed], flags: 64 });
    
    const shop = activeShops.get(userId);
    if (shop && shop.message) {
      await showCharacterCosmetics(interaction, data, type, characterName);
    }
  } else {
    await interaction.reply({ content: result.message, flags: 64 });
  }
}

function closeCosmeticsShop(userId) {
  const shop = activeShops.get(userId);
  if (shop) {
    clearTimeout(shop.timeout);
    activeShops.delete(userId);
  }
}

module.exports = {
  openCosmeticsShop
};
