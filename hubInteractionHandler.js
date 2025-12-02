const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  HUB_CATEGORIES,
  createMainHubEmbed,
  createHubCategoryButtons,
  createCategoryEmbed,
  createCategoryButtons,
  createQuickStartEmbed,
  createQuickStartButtons,
  createMinigamesEmbed,
  createMinigameButtons,
  getPlayerJourneyStage
} = require('./hubSystem.js');
const {
  initializeOnboarding,
  startOnboarding,
  skipOnboarding,
  advanceOnboarding,
  createOnboardingEmbed,
  createOnboardingButtons,
  createFirstTimeWelcome,
  ONBOARDING_STEPS
} = require('./onboardingSystem.js');
const {
  initializeDiscovery,
  trackFeatureUse,
  createDiscoveryEmbed
} = require('./discoverySystem.js');
const { formatNumber } = require('./utils/formatters.js');

function initializeUserHubData(userData) {
  if (!userData.discovery) {
    userData.discovery = {
      featuresUsed: [],
      firstUsed: {},
      suggestions: [],
      lastSuggestion: null,
      totalInteractions: 0
    };
  }
  if (!userData.onboarding) {
    userData.onboarding = {
      started: false,
      completed: false,
      currentStep: 'welcome',
      stepsCompleted: [],
      startedAt: null,
      completedAt: null
    };
  }
  return userData;
}

async function handleHubInteraction(interaction, data, saveData) {
  const userId = interaction.user.id;
  let userData = data.users[userId];
  
  if (!userData) {
    userData = {
      coins: 0,
      gems: 0,
      characters: [],
      discovery: { featuresUsed: [], firstUsed: {}, totalInteractions: 0 },
      onboarding: { started: false, completed: false, currentStep: 'welcome', stepsCompleted: [] }
    };
    data.users[userId] = userData;
  }
  
  initializeUserHubData(userData);
  const customId = interaction.customId;
  
  try {
    if (customId === 'hub_main' || customId === 'hub_back') {
      trackFeatureUse(userData, 'hub');
      const embed = createMainHubEmbed(interaction.user, userData, userData.discovery);
      const buttons = createHubCategoryButtons();
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('hub_') && HUB_CATEGORIES[customId.replace('hub_', '')]) {
      const categoryId = customId.replace('hub_', '');
      trackFeatureUse(userData, categoryId);
      const embed = createCategoryEmbed(categoryId, interaction.user, userData);
      const buttons = createCategoryButtons(categoryId);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId === 'hub_guide') {
      trackFeatureUse(userData, 'guide');
      const { embed, isLast } = createQuickStartEmbed(interaction.user, userData, 0);
      const buttons = createQuickStartButtons(0, isLast);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId === 'hub_help') {
      trackFeatureUse(userData, 'help');
      const helpEmbed = createHelpEmbed(interaction.user);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hub_back')
          .setLabel('Back to Hub')
          .setEmoji('🏠')
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.update({ embeds: [helpEmbed], components: [row] });
    }
    else if (customId.startsWith('guide_step_')) {
      const step = parseInt(customId.replace('guide_step_', ''));
      const { embed, isLast } = createQuickStartEmbed(interaction.user, userData, step);
      const buttons = createQuickStartButtons(step, isLast);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId === 'guide_finish' || customId === 'guide_skip') {
      trackFeatureUse(userData, 'hub');
      const embed = createMainHubEmbed(interaction.user, userData, userData.discovery);
      const buttons = createHubCategoryButtons();
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('feature_')) {
      const featureId = customId.replace('feature_', '');
      await handleFeatureButton(interaction, featureId, userData, data, saveData);
    }
    else if (customId === 'onboard_start') {
      startOnboarding(userData);
      const embed = createOnboardingEmbed(interaction.user, 'starter', userData);
      const buttons = createOnboardingButtons('starter', userData);
      await interaction.update({ embeds: [embed], components: buttons });
      await saveData(data);
    }
    else if (customId === 'onboard_skip') {
      skipOnboarding(userData);
      trackFeatureUse(userData, 'hub');
      const embed = createMainHubEmbed(interaction.user, userData, userData.discovery);
      const buttons = createHubCategoryButtons();
      await interaction.update({ embeds: [embed], components: buttons });
      await saveData(data);
    }
    else if (customId === 'onboard_finish') {
      userData.onboarding.completed = true;
      trackFeatureUse(userData, 'hub');
      const embed = createMainHubEmbed(interaction.user, userData, userData.discovery);
      const buttons = createHubCategoryButtons();
      await interaction.update({ embeds: [embed], components: buttons });
      await saveData(data);
    }
    else if (customId.startsWith('onboard_next_')) {
      const nextStep = customId.replace('onboard_next_', '');
      advanceOnboarding(userData, nextStep);
      const embed = createOnboardingEmbed(interaction.user, nextStep, userData);
      const buttons = createOnboardingButtons(nextStep, userData);
      await interaction.update({ embeds: [embed], components: buttons });
      await saveData(data);
    }
    else if (customId.startsWith('onboard_action_')) {
      const action = customId.replace('onboard_action_', '');
      const helpEmbed = createActionHelpEmbed(action);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hub_back')
          .setLabel('Back to Hub')
          .setEmoji('🏠')
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ embeds: [helpEmbed], components: [row], ephemeral: true });
    }
    else if (customId === 'hub_discovery') {
      const embed = createDiscoveryEmbed(interaction.user, userData);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hub_back')
          .setLabel('Back to Hub')
          .setEmoji('🏠')
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.update({ embeds: [embed], components: [row] });
    }
    else {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Hub interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong! Try using `!hub` again.', ephemeral: true }).catch(() => {});
    }
    return false;
  }
}

async function handleFeatureButton(interaction, featureId, userData, data, saveData) {
  trackFeatureUse(userData, featureId);
  
  const featureCommands = {
    battle: { cmd: '!battle @user', desc: 'Challenge another player to battle!' },
    work: { cmd: '!work', desc: 'Work to earn coins and resources!' },
    minigames: { special: 'minigames' },
    daily: { cmd: '!daily', desc: 'Claim your daily reward!' },
    crates: { cmd: '!crate', desc: 'View your crate inventory!' },
    quests: { cmd: '!quests', desc: 'View your quests and tasks!' },
    mail: { cmd: '!mail', desc: 'Check your mailbox!' },
    collection: { cmd: '!collection', desc: 'View your character collection!' },
    skins: { cmd: '!skins', desc: 'View and equip character skins!' },
    charinfo: { cmd: '!char <name>', desc: 'View detailed character info!' },
    balance: { cmd: '!balance', desc: 'Check your currency balance!' },
    shop: { cmd: '!shop', desc: 'Open the shop!' },
    trade: { cmd: '!trade @user', desc: 'Trade with another player!' },
    market: { cmd: '!market', desc: 'Browse the player marketplace!' },
    inventory: { cmd: '!inventory', desc: 'View your inventory!' },
    profile: { cmd: '!profile', desc: 'View your profile!' },
    achievements: { cmd: '!achievements', desc: 'View your achievements!' },
    leaderboard: { cmd: '!leaderboard', desc: 'View the server leaderboard!' },
    challenges: { cmd: '!challenges', desc: 'View weekly challenges!' },
    clan: { cmd: '!clan', desc: 'View clan info!' },
    clanleaderboard: { cmd: '!clanleaderboard', desc: 'View top clans!' },
    trivia: { cmd: '!trivia', desc: 'Start a trivia game!' }
  };
  
  const feature = featureCommands[featureId];
  
  if (!feature) {
    await interaction.reply({ content: `Use the command for this feature!`, ephemeral: true });
    return;
  }
  
  if (feature.special === 'minigames') {
    const embed = createMinigamesEmbed();
    const buttons = createMinigameButtons();
    await interaction.update({ embeds: [embed], components: buttons });
    return;
  }
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`💡 ${featureId.charAt(0).toUpperCase() + featureId.slice(1)}`)
    .setDescription(feature.desc)
    .addFields({ name: '📝 Command', value: `\`${feature.cmd}\``, inline: false })
    .setFooter({ text: 'Type this command in the chat to use this feature!' });
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hub_back')
      .setLabel('Back to Hub')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary)
  );
  
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

function createHelpEmbed(user) {
  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📚 All Commands')
    .setDescription('Here are all the commands organized by category. You can also use `!help` for the full list!')
    .addFields(
      {
        name: '🚀 Getting Started',
        value: '`!start` - Begin your adventure\n`!hub` - Open this menu\n`!guide` - Quick start tutorial',
        inline: false
      },
      {
        name: '🦁 Collection',
        value: '`!collection` - View characters\n`!char <name>` - Character info\n`!skins` - View skins',
        inline: true
      },
      {
        name: '💰 Economy',
        value: '`!balance` - Check money\n`!shop` - Buy items\n`!daily` - Daily reward\n`!work` - Earn coins',
        inline: true
      },
      {
        name: '⚔️ Battle',
        value: '`!battle @user` - PvP\n`!b easy` - AI battle\n`!leaderboard` - Rankings',
        inline: true
      },
      {
        name: '📦 Crates & Items',
        value: '`!crate` - View crates\n`!opencrate <type>` - Open\n`!inventory` - Items',
        inline: true
      },
      {
        name: '📋 Quests & Progress',
        value: '`!quests` - Tasks\n`!challenges` - Weekly\n`!achievements` - Badges\n`!profile` - Stats',
        inline: true
      },
      {
        name: '🏰 Social',
        value: '`!clan` - Clan info\n`!joinclan <name>` - Join\n`!trade @user` - Trade',
        inline: true
      }
    )
    .setFooter({ text: 'Tip: Use !hub anytime for the interactive menu!' });
}

function createActionHelpEmbed(action) {
  const actions = {
    start: {
      title: '🚀 Getting Started',
      desc: 'Use `!start` to begin your adventure and receive your first character plus starter bonus!',
      tips: ['You get a free starter character', 'Bonus 500 coins and 50 gems', '3 free crates to open']
    },
    collection: {
      title: '🦁 Your Collection',
      desc: 'Use `!collection` to view all your characters!',
      tips: ['Shows character levels and tokens', 'Use page buttons to navigate', 'Click a character for more info']
    },
    daily: {
      title: '📅 Daily Rewards',
      desc: 'Use `!daily` to claim your free daily reward!',
      tips: ['Claim once every 24 hours', 'Build a streak for bonuses', 'Get coins, gems, and crates']
    },
    hub: {
      title: '🏠 Game Hub',
      desc: 'Use `!hub` to open this interactive menu anytime!',
      tips: ['Access all features from one place', 'No commands to remember', 'Perfect for new players']
    }
  };
  
  const info = actions[action] || { title: 'Feature Help', desc: `Try using the related command!`, tips: [] };
  
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(info.title)
    .setDescription(info.desc);
  
  if (info.tips.length > 0) {
    embed.addFields({ name: '💡 Tips', value: info.tips.map(t => `• ${t}`).join('\n'), inline: false });
  }
  
  return embed;
}

function isHubInteraction(customId) {
  const hubPrefixes = ['hub_', 'guide_', 'feature_', 'onboard_', 'minigame_'];
  return hubPrefixes.some(prefix => customId.startsWith(prefix));
}

module.exports = {
  handleHubInteraction,
  handleFeatureButton,
  initializeUserHubData,
  createHelpEmbed,
  createActionHelpEmbed,
  isHubInteraction
};
