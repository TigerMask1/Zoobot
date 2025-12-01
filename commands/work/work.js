const { EmbedBuilder } = require('discord.js');
const { saveData } = require('../../dataManager.js');
const { initializeUserData, createErrorEmbed } = require('../../utils/shared.js');
const { 
  initializeWorkData, 
  canWork, 
  assignRandomJob, 
  handleMinerJob, 
  handleCaretakerJob, 
  handleFarmerJob, 
  handleZookeeperJob, 
  handleRangerJob, 
  completeWork,
  JOBS 
} = require('../../workSystem.js');
const { updateTaskProgress } = require('../../seasonSystem.js');
const { trackEconomyChange } = require('../../antiCheatSystem.js');

module.exports = {
  name: 'work',
  aliases: ['w'],
  category: 'work',
  description: 'Work to earn coins, gems, and resources',
  usage: '!work',
  cooldown: 1000,
  
  async execute({ message, data }) {
    const userId = message.author.id;
    const userData = initializeUserData(userId, data);
    initializeWorkData(userData);
    
    const workCheck = canWork(userData);
    if (!workCheck.canWork) {
      const embed = createErrorEmbed(
        'Work Cooldown',
        `⏰ You need to rest before working again!\n\nTime remaining: **${workCheck.timeLeft}**`
      );
      return message.reply({ embeds: [embed] });
    }
    
    const jobAssignment = assignRandomJob(userData);
    const job = jobAssignment.job;
    const jobData = jobAssignment.jobData;
    
    let jobResult;
    switch (job) {
      case 'miner':
        jobResult = handleMinerJob(userData);
        break;
      case 'caretaker':
        jobResult = handleCaretakerJob(userData);
        break;
      case 'farmer':
        jobResult = handleFarmerJob(userData);
        break;
      case 'zookeeper':
        jobResult = handleZookeeperJob(userData);
        break;
      case 'ranger':
        jobResult = handleRangerJob(userData);
        break;
      default:
        jobResult = handleCaretakerJob(userData);
    }
    
    if (!jobResult.success) {
      const embed = createErrorEmbed('Work Failed', jobResult.message);
      return message.reply({ embeds: [embed] });
    }
    
    completeWork(userData);
    
    if (jobResult.rewards.coins) {
      trackEconomyChange(userId, 'coins', jobResult.rewards.coins, 'work');
    }
    if (jobResult.rewards.gems) {
      trackEconomyChange(userId, 'gems', jobResult.rewards.gems, 'work');
    }
    
    updateTaskProgress(data, userId, 'work', 1);
    
    await saveData(data);
    
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`${jobData.emoji} Work Complete: ${jobData.name}`)
      .setDescription(getJobDescription(job, jobResult))
      .addFields(
        { name: '💰 Coins', value: `+${jobResult.rewards.coins || 0}`, inline: true },
        { name: '💎 Gems', value: `+${jobResult.rewards.gems || 0}`, inline: true }
      );
    
    if (jobResult.rewards.tokens) {
      embed.addFields({ 
        name: '🎫 Tokens', 
        value: `+${jobResult.rewards.tokens}${jobResult.rewards.grantedTo ? ` (${jobResult.rewards.grantedTo})` : ''}`, 
        inline: true 
      });
    }
    
    if (jobResult.rewards.ores && Object.keys(jobResult.rewards.ores).length > 0) {
      const oreList = Object.entries(jobResult.rewards.ores)
        .map(([ore, amount]) => `+${amount} ${ore}`)
        .join('\n');
      embed.addFields({ name: '⛏️ Ores', value: oreList, inline: true });
    }
    
    if (jobResult.rewards.wood && Object.keys(jobResult.rewards.wood).length > 0) {
      const woodList = Object.entries(jobResult.rewards.wood)
        .map(([wood, amount]) => `+${amount} ${wood}`)
        .join('\n');
      embed.addFields({ name: '🪵 Wood', value: woodList, inline: true });
    }
    
    if (jobResult.durability !== undefined) {
      embed.setFooter({ text: `Tool durability: ${jobResult.durability}` });
    }
    
    embed.setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};

function getJobDescription(job, result) {
  switch (job) {
    case 'miner':
      return '⛏️ You ventured deep into the mines and extracted valuable ores!';
    case 'caretaker':
      return '🏠 You took care of the animals in your house and earned their gratitude!';
    case 'farmer':
      return '🌾 You harvested crops and gathered wood from the forest!';
    case 'zookeeper':
      return '🦁 You helped take care of the zoo animals and earned special rewards!';
    case 'ranger':
      return '🔭 You patrolled the wilderness and discovered hidden treasures!';
    default:
      return 'You completed your work and earned rewards!';
  }
}
