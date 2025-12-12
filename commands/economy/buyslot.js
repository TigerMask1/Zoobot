const { EmbedBuilder } = require('discord.js');
const { purchaseSlot, getServerSlotLimits, getServerAura, calculateSlotCost } = require('../../serverAuraSystem.js');
const { isServerAdmin, isServerOwner, isSuperAdmin } = require('../../serverConfigManager.js');

module.exports = {
  name: 'buyslot',
  aliases: ['purchaseslot', 'bs'],
  category: 'economy',
  description: 'Purchase character or collectible slots with server aura',
  usage: '!buyslot <character/collectible>',
  
  async execute({ message, args, data, client }) {
    const serverId = message.guild?.id;
    if (!serverId) {
      return message.reply('This command can only be used in a server!');
    }
    
    const userId = message.author.id;
    const member = message.member;
    
    if (!isServerOwner(member) && !isServerAdmin(userId, serverId, member) && !isSuperAdmin(userId)) {
      return message.reply('❌ Only server owners and admins can purchase slots!');
    }
    
    const slotType = args[0]?.toLowerCase();
    
    if (!slotType || !['character', 'char', 'c', 'collectible', 'collect', 'col'].includes(slotType)) {
      const slotLimits = await getServerSlotLimits(serverId);
      const serverAura = await getServerAura(serverId);
      
      const charCost = calculateSlotCost(slotLimits.purchasedCharSlots, 'character');
      const collectCost = calculateSlotCost(slotLimits.purchasedCollectSlots, 'collectible');
      
      const embed = new EmbedBuilder()
        .setColor(0x00D9FF)
        .setTitle('🛒 Buy Slots')
        .setDescription(`Purchase slots using server aura!\n\n**Your Server's Aura:** ✨ ${serverAura.totalAura.toLocaleString()}`)
        .addFields(
          { 
            name: '🎭 Character Slot', 
            value: `Current: **${slotLimits.purchasedCharSlots}** / ${slotLimits.maxCharSlots}\nCost: **${charCost}** aura\n\n\`!buyslot character\``, 
            inline: true 
          },
          { 
            name: '🎁 Collectible Slot', 
            value: `Current: **${slotLimits.purchasedCollectSlots}** / ${slotLimits.maxCollectSlots}\nCost: **${collectCost}** aura\n\n\`!buyslot collectible\``, 
            inline: true 
          }
        )
        .setFooter({ text: 'Costs increase with each purchase. Level up to unlock more max slots!' });
      
      return message.reply({ embeds: [embed] });
    }
    
    const normalizedType = ['character', 'char', 'c'].includes(slotType) ? 'character' : 'collectible';
    const result = await purchaseSlot(serverId, normalizedType, userId);
    
    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x00FF00 : 0xFF0000)
      .setTitle(result.success ? '✅ Slot Purchased!' : '❌ Purchase Failed')
      .setDescription(result.message);
    
    if (result.success) {
      embed.addFields(
        { name: '✨ Remaining Aura', value: result.remainingAura.toLocaleString(), inline: true },
        { name: `📊 Total ${normalizedType} Slots`, value: result.newSlotCount.toString(), inline: true }
      );
    }
    
    return message.reply({ embeds: [embed] });
  }
};
