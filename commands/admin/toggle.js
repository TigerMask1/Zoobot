const { EmbedBuilder } = require('discord.js');
const { canToggleFeatures, updateFeatureSetting, getFeatureSettings, DEFAULT_FEATURE_SETTINGS } = require('../../serverConfigManager.js');

const FEATURE_LIST = {
  dropsEnabled: { name: 'Drops', emoji: '🎁', description: 'Character drops in drop channel' },
  eventsEnabled: { name: 'Events', emoji: '🎉', description: 'Special events' },
  giveawaysEnabled: { name: 'Giveaways', emoji: '🎊', description: 'Giveaway system' },
  lotteryEnabled: { name: 'Lottery', emoji: '🎰', description: 'Lottery system' },
  tradingEnabled: { name: 'Trading', emoji: '🔄', description: 'Player trading' },
  marketEnabled: { name: 'Market', emoji: '🏪', description: 'Market listings' },
  battlesEnabled: { name: 'Battles', emoji: '⚔️', description: 'PvP battles' },
  minigamesEnabled: { name: 'Minigames', emoji: '🎮', description: 'Minigames' },
  triviaEnabled: { name: 'Trivia', emoji: '❓', description: 'Trivia questions' },
  clanSystemEnabled: { name: 'Clans', emoji: '🏰', description: 'Clan system' },
  leaderboardsEnabled: { name: 'Leaderboards', emoji: '🏆', description: 'Leaderboards' },
  workSystemEnabled: { name: 'Work', emoji: '⛏️', description: 'Work commands' },
  questsEnabled: { name: 'Quests', emoji: '📜', description: 'Quest system' },
  dailyRewardsEnabled: { name: 'Daily Rewards', emoji: '📅', description: 'Daily reward claims' }
};

module.exports = {
  name: 'toggle',
  aliases: ['feature', 'togglefeature'],
  category: 'admin',
  description: 'Toggle bot features on/off for this server',
  usage: '!toggle <feature> [on/off]',
  adminOnly: true,
  
  async execute({ message, args, data }) {
    const serverId = message.guild?.id;
    const userId = message.author.id;
    
    if (!serverId) {
      return message.reply('❌ This command can only be used in a server!');
    }
    
    // Show feature list if no args
    if (!args.length) {
      const settings = getFeatureSettings(serverId);
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Server Feature Settings')
        .setDescription('Use `!toggle <feature> on/off` to change settings.\n\n**Available Features:**');
      
      let featureText = '';
      for (const [key, info] of Object.entries(FEATURE_LIST)) {
        const status = settings[key] !== false ? '✅' : '❌';
        featureText += `${status} ${info.emoji} **${info.name}** - ${info.description}\n`;
      }
      
      embed.addFields({ name: 'Features', value: featureText || 'None' });
      embed.setFooter({ text: 'Example: !toggle drops off' });
      
      return message.reply({ embeds: [embed] });
    }
    
    // Find the feature
    const featureName = args[0].toLowerCase();
    let featureKey = null;
    
    for (const [key, info] of Object.entries(FEATURE_LIST)) {
      if (key.toLowerCase().includes(featureName) || 
          info.name.toLowerCase() === featureName) {
        featureKey = key;
        break;
      }
    }
    
    if (!featureKey) {
      return message.reply(`❌ Unknown feature: "${args[0]}"\n\nUse \`!toggle\` to see available features.`);
    }
    
    // Determine new value
    let newValue;
    const currentSettings = getFeatureSettings(serverId);
    const currentValue = currentSettings[featureKey] !== false;
    
    if (args[1]) {
      const arg = args[1].toLowerCase();
      if (['on', 'enable', 'true', '1', 'yes'].includes(arg)) {
        newValue = true;
      } else if (['off', 'disable', 'false', '0', 'no'].includes(arg)) {
        newValue = false;
      } else {
        return message.reply('❌ Please use `on` or `off` to set the feature state.');
      }
    } else {
      // Toggle
      newValue = !currentValue;
    }
    
    const result = await updateFeatureSetting(serverId, featureKey, newValue, userId, message.member);
    
    if (!result.success) {
      return message.reply(result.message);
    }
    
    const featureInfo = FEATURE_LIST[featureKey];
    const statusEmoji = newValue ? '✅' : '❌';
    const statusText = newValue ? 'enabled' : 'disabled';
    
    const embed = new EmbedBuilder()
      .setColor(newValue ? 0x00FF00 : 0xFF6B6B)
      .setTitle(`${featureInfo.emoji} Feature ${newValue ? 'Enabled' : 'Disabled'}`)
      .setDescription(`**${featureInfo.name}** has been ${statusText} for this server.`)
      .setFooter({ text: `Changed by ${message.author.username}` })
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
};
