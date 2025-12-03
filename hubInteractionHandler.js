const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  HUB_CATEGORIES,
  ADMIN_CATEGORIES,
  SUPER_ADMIN_COMMANDS,
  ALL_COMMANDS,
  createMainHubEmbed,
  createHubCategoryButtons,
  createCategoryEmbed,
  createCategoryButtons,
  createKnowMoreEmbed,
  createKnowMoreButtons,
  createAdminHubEmbed,
  createAdminCategoryButtons,
  createAdminCategoryEmbed,
  createAdminCategoryBackButtons,
  createSuperAdminEmbed,
  createSuperAdminCategoryButtons,
  createSuperAdminCategoryEmbed,
  createSuperAdminBackButtons,
  createQuickStartEmbed,
  createQuickStartButtons,
  createMinigamesEmbed,
  createMinigameButtons,
  createAllCommandsEmbed,
  createAllCommandsButtons,
  createSingleCategoryEmbed,
  createSingleCategoryButtons,
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
const { formatNumber } = require('./utils/shared.js');

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
  const guildId = interaction.guildId;
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
  
  const serverConfig = data.servers?.[guildId] || {};
  
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
    else if (customId.startsWith('knowmore_')) {
      const categoryId = customId.replace('knowmore_', '');
      trackFeatureUse(userData, `knowmore_${categoryId}`);
      const embed = createKnowMoreEmbed(categoryId);
      const buttons = createKnowMoreButtons(categoryId);
      if (embed) {
        await interaction.update({ embeds: [embed], components: buttons });
      } else {
        await interaction.reply({ content: '❌ Category not found!', ephemeral: true });
      }
    }
    else if (customId === 'hub_admin') {
      trackFeatureUse(userData, 'admin');
      const embed = createAdminHubEmbed(interaction.user, serverConfig);
      const buttons = createAdminCategoryButtons();
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('admin_') && customId !== 'admin_superadmin') {
      const categoryId = customId.replace('admin_', '');
      if (ADMIN_CATEGORIES[categoryId]) {
        trackFeatureUse(userData, `admin_${categoryId}`);
        const embed = createAdminCategoryEmbed(categoryId);
        const buttons = createAdminCategoryBackButtons(categoryId);
        await interaction.update({ embeds: [embed], components: buttons });
      } else {
        await interaction.reply({ content: '❌ Category not found!', ephemeral: true });
      }
    }
    else if (customId === 'admin_superadmin') {
      trackFeatureUse(userData, 'superadmin');
      const embed = createSuperAdminEmbed();
      const buttons = createSuperAdminCategoryButtons();
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('superadmin_')) {
      const categoryId = customId.replace('superadmin_', '');
      if (SUPER_ADMIN_COMMANDS[categoryId]) {
        trackFeatureUse(userData, `superadmin_${categoryId}`);
        const embed = createSuperAdminCategoryEmbed(categoryId);
        const buttons = createSuperAdminBackButtons();
        await interaction.update({ embeds: [embed], components: buttons });
      } else {
        await interaction.reply({ content: '❌ Category not found!', ephemeral: true });
      }
    }
    else if (customId === 'hub_guide') {
      trackFeatureUse(userData, 'guide');
      const { embed, isLast } = createQuickStartEmbed(interaction.user, userData, 0);
      const buttons = createQuickStartButtons(0, isLast);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId === 'hub_help') {
      trackFeatureUse(userData, 'help');
      const { embed, currentPage, totalPages } = createAllCommandsEmbed('all', 0);
      const buttons = createAllCommandsButtons('all', currentPage, totalPages);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('cmdfilter_')) {
      const filter = customId.replace('cmdfilter_', '');
      trackFeatureUse(userData, `cmdfilter_${filter}`);
      const { embed, currentPage, totalPages } = createAllCommandsEmbed(filter, 0);
      const buttons = createAllCommandsButtons(filter, currentPage, totalPages);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('cmdpage_')) {
      const parts = customId.split('_');
      const filter = parts[1];
      const page = parseInt(parts[2]) || 0;
      const { embed, currentPage, totalPages } = createAllCommandsEmbed(filter, page);
      const buttons = createAllCommandsButtons(filter, currentPage, totalPages);
      await interaction.update({ embeds: [embed], components: buttons });
    }
    else if (customId.startsWith('viewcat_')) {
      const categoryId = customId.replace('viewcat_', '');
      trackFeatureUse(userData, `viewcat_${categoryId}`);
      const embed = createSingleCategoryEmbed(categoryId);
      const buttons = createSingleCategoryButtons(categoryId);
      if (embed) {
        await interaction.update({ embeds: [embed], components: buttons });
      } else {
        await interaction.reply({ content: '❌ Category not found!', ephemeral: true });
      }
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
    battle: { cmd: '!battle @user', desc: 'Challenge another player to battle!\n\n**Also try:**\n• `!b easy/normal/hard` - Battle AI opponents' },
    work: { cmd: '!work', desc: 'Work to earn coins and resources!\n\n**Also try:**\n• `!workguide` - Full work system guide\n• `!crafttool` - Craft tools for better rewards' },
    minigames: { special: 'minigames' },
    daily: { cmd: '!daily', desc: 'Claim your daily reward!\n\n**Bonus:** Build streaks for extra rewards!' },
    crates: { cmd: '!crate', desc: 'View your crate inventory!\n\n**Also try:**\n• `!opencrate <type>` - Open a crate\n• `!bulkopen <type> [qty]` - Open multiple' },
    quests: { cmd: '!quests', desc: 'View your quests and tasks!\n\n**Also try:**\n• `!claimall` - Claim all completed quests\n• `!challenges` - Weekly challenges' },
    mail: { cmd: '!mail', desc: 'Check your mailbox!\n\n**Also try:**\n• `!claimmail <#>` - Claim mail rewards\n• `!clearmail` - Clear claimed mail' },
    collection: { cmd: '!collection', desc: 'View your character collection!\n\n**Also try:**\n• `!char <name>` - Detailed character info\n• `!levelup <name>` - Level up a character' },
    skins: { cmd: '!skins', desc: 'View and equip character skins!\n\n**Also try:**\n• `!equipskin <char> <skin>` - Equip a skin\n• `!ustshop` - Browse skin shop' },
    charinfo: { cmd: '!char <name>', desc: 'View detailed character info!\n\n**Also try:**\n• `!info <name>` - View any character (no ownership needed)\n• `!I <name>` - Battle stats for owned character' },
    balance: { cmd: '!balance', desc: 'Check your currency balance!\n\nShows: 💰 Coins, 💎 Gems, 🏆 Trophies' },
    shop: { cmd: '!shop', desc: 'Open the shop!\n\n**Also try:**\n• `!ustshop` - UST cosmetics shop\n• `!market` - Player marketplace' },
    trade: { cmd: '!trade @user', desc: 'Trade with another player!\n\nSecure trading system for characters and items.' },
    market: { cmd: '!market', desc: 'Browse the player marketplace!\n\n**Also try:**\n• `!market sell` - List items for sale\n• `!auctions` - View auctions' },
    inventory: { cmd: '!inventory', desc: 'View your inventory!\n\nShows: Ores, Wood, Tools, Items, Crates' },
    profile: { cmd: '!profile', desc: 'View your profile!\n\n**Also try:**\n• `!setpfp <name>` - Set profile picture\n• `!pfps` - View your PFPs' },
    achievements: { cmd: '!achievements', desc: 'View your achievement badges!\n\nEarn badges by completing various milestones!' },
    leaderboard: { cmd: '!leaderboard', desc: 'View the server leaderboard!\n\n**Types:** coins, gems, battles, collection, trophies\n**Also try:** `!globalboard` for all servers' },
    challenges: { cmd: '!challenges', desc: 'View weekly challenges!\n\n**Also try:**\n• `!claimchallenge <id>` - Claim rewards\n• `!seasonpass` - Season progress' },
    clan: { cmd: '!clan', desc: 'View clan info!\n\n**Also try:**\n• `!joinclan <name>` - Join a clan\n• `!donate <type> <amount>` - Donate to clan' },
    clanleaderboard: { cmd: '!clans', desc: 'View top clans!\n\nSee the most powerful clans in ZooBot.' },
    trivia: { cmd: '!trivia', desc: 'Start a trivia game!\n\n**Also try:**\n• `!a <answer>` - Answer a question\n• `!q <keyword>` - Search Q&A database' }
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
    .addFields({ name: '📝 Main Command', value: `\`${feature.cmd}\``, inline: false })
    .setFooter({ text: 'Type the command in chat to use this feature!' });
  
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
    .setTitle('📚 Quick Command Reference')
    .setDescription('Here are the most common commands. For **complete lists**, use the category buttons in the Hub and click **Know More**!')
    .addFields(
      {
        name: '🚀 Getting Started',
        value: '`!start` - Begin your adventure\n`!hub` - Open this menu\n`!guide` - Quick start tutorial',
        inline: false
      },
      {
        name: '🦁 Collection',
        value: '`!collection` - View characters\n`!char <name>` - Character info\n`!info <name>` - Any character info\n`!levelup <name>` - Level up',
        inline: true
      },
      {
        name: '💰 Economy',
        value: '`!balance` - Check money\n`!shop` - Buy items\n`!daily` - Daily reward\n`!work` - Earn coins\n`!market` - Marketplace',
        inline: true
      },
      {
        name: '⚔️ Battle',
        value: '`!battle @user` - PvP battle\n`!b easy/normal/hard` - AI battle\n`!leaderboard` - Rankings',
        inline: true
      },
      {
        name: '📦 Crates & Items',
        value: '`!crate` - View crates\n`!opencrate <type>` - Open crate\n`!bulkopen <type>` - Open many\n`!inventory` - Your items',
        inline: true
      },
      {
        name: '📋 Quests & Progress',
        value: '`!quests` - Daily tasks\n`!challenges` - Weekly goals\n`!achievements` - Badges\n`!seasonpass` - Season Pass',
        inline: true
      },
      {
        name: '🏰 Social',
        value: '`!clan` - Clan info\n`!joinclan <name>` - Join clan\n`!trade @user` - Trade\n`!trivia` - Play trivia',
        inline: true
      }
    )
    .setFooter({ text: 'Use category buttons in !hub and click "Know More" for ALL commands!' });
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
  const hubPrefixes = ['hub_', 'guide_', 'feature_', 'onboard_', 'minigame_', 'knowmore_', 'admin_', 'superadmin_', 'cmdfilter_', 'cmdpage_', 'viewcat_'];
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
