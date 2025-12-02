const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { formatNumber } = require('./utils/formatters.js');

const HUB_CATEGORIES = {
  play: {
    emoji: '🎮',
    name: 'Play',
    description: 'Battle, work, and play minigames',
    color: 0xE74C3C,
    features: [
      { id: 'battle', emoji: '⚔️', name: 'Battle', desc: 'Challenge players or AI', command: '!battle' },
      { id: 'work', emoji: '💼', name: 'Work', desc: 'Earn coins and resources', command: '!work' },
      { id: 'minigames', emoji: '🎰', name: 'Minigames', desc: 'Coin flip, dice, RPS', command: null }
    ]
  },
  rewards: {
    emoji: '🎁',
    name: 'Rewards',
    description: 'Daily rewards, crates, and quests',
    color: 0xF39C12,
    features: [
      { id: 'daily', emoji: '📅', name: 'Daily', desc: 'Claim daily reward', command: '!daily' },
      { id: 'crates', emoji: '📦', name: 'Crates', desc: 'Open your crates', command: '!crate' },
      { id: 'quests', emoji: '📋', name: 'Quests', desc: 'Complete tasks for rewards', command: '!quests' },
      { id: 'mail', emoji: '📬', name: 'Mail', desc: 'Check your mailbox', command: '!mail' }
    ]
  },
  collection: {
    emoji: '🦁',
    name: 'Collection',
    description: 'Your characters and customization',
    color: 0x3498DB,
    features: [
      { id: 'collection', emoji: '🦁', name: 'Characters', desc: 'View your collection', command: '!collection' },
      { id: 'skins', emoji: '🎨', name: 'Skins', desc: 'Customize your characters', command: '!skins' },
      { id: 'charinfo', emoji: '📖', name: 'Character Info', desc: 'Learn about characters', command: '!char' }
    ]
  },
  economy: {
    emoji: '💰',
    name: 'Economy',
    description: 'Shop, trade, and manage currency',
    color: 0xFFD700,
    features: [
      { id: 'balance', emoji: '💰', name: 'Balance', desc: 'Check your money', command: '!balance' },
      { id: 'shop', emoji: '🛒', name: 'Shop', desc: 'Buy items and crates', command: '!shop' },
      { id: 'trade', emoji: '🔄', name: 'Trade', desc: 'Trade with players', command: '!trade' },
      { id: 'market', emoji: '🏪', name: 'Market', desc: 'Player marketplace', command: '!market' },
      { id: 'inventory', emoji: '🎒', name: 'Inventory', desc: 'View your items', command: '!inventory' }
    ]
  },
  progress: {
    emoji: '🏆',
    name: 'Progress',
    description: 'Profile, achievements, and rankings',
    color: 0x9B59B6,
    features: [
      { id: 'profile', emoji: '👤', name: 'Profile', desc: 'Your stats and info', command: '!profile' },
      { id: 'achievements', emoji: '🏅', name: 'Achievements', desc: 'Your badges', command: '!achievements' },
      { id: 'leaderboard', emoji: '📊', name: 'Leaderboard', desc: 'Server rankings', command: '!leaderboard' },
      { id: 'challenges', emoji: '🎯', name: 'Challenges', desc: 'Weekly challenges', command: '!challenges' }
    ]
  },
  social: {
    emoji: '🏰',
    name: 'Social',
    description: 'Clans and community features',
    color: 0x2ECC71,
    features: [
      { id: 'clan', emoji: '🏰', name: 'Clan', desc: 'Join or view clan', command: '!clan' },
      { id: 'clanleaderboard', emoji: '🏆', name: 'Clan Rankings', desc: 'Top clans', command: '!clanleaderboard' },
      { id: 'trivia', emoji: '🧠', name: 'Trivia', desc: 'Test your knowledge', command: '!trivia' }
    ]
  }
};

const PLAYER_JOURNEY = {
  beginner: {
    level: 1,
    maxChars: 5,
    tips: [
      '💡 Use `!work` every 30 minutes to earn coins!',
      '💡 Open your starter crates with `!crate` then `!opencrate common`',
      '💡 Try battling AI with `!b easy` to practice',
      '💡 Complete daily quests with `!quests` for bonus rewards'
    ],
    suggestedActions: ['daily', 'work', 'crates', 'battle']
  },
  intermediate: {
    level: 5,
    maxChars: 15,
    tips: [
      '💡 Join a clan with `!joinclan` for team benefits',
      '💡 Try the marketplace with `!market` to find rare items',
      '💡 Level up characters by using them in battles',
      '💡 Check weekly challenges with `!challenges` for extra rewards'
    ],
    suggestedActions: ['clan', 'market', 'challenges', 'achievements']
  },
  advanced: {
    level: 10,
    maxChars: 30,
    tips: [
      '💡 Trade rare characters with `!trade @user`',
      '💡 Compete in auctions with `!auctions`',
      '💡 Craft tools to improve work efficiency',
      '💡 Aim for the global leaderboard!'
    ],
    suggestedActions: ['trade', 'auctions', 'crafting', 'leaderboard']
  }
};

function getPlayerJourneyStage(userData) {
  const charCount = (userData.characters || []).length;
  const accountLevel = userData.accountLevel || 1;
  
  if (charCount >= 30 || accountLevel >= 10) return 'advanced';
  if (charCount >= 15 || accountLevel >= 5) return 'intermediate';
  return 'beginner';
}

function getRandomTip(userData) {
  const stage = getPlayerJourneyStage(userData);
  const tips = PLAYER_JOURNEY[stage].tips;
  return tips[Math.floor(Math.random() * tips.length)];
}

function createMainHubEmbed(user, userData, discoveryData) {
  const charCount = (userData.characters || []).length;
  const stage = getPlayerJourneyStage(userData);
  const tip = getRandomTip(userData);
  
  const completedFeatures = discoveryData?.featuresUsed?.length || 0;
  const totalFeatures = Object.values(HUB_CATEGORIES).reduce((acc, cat) => acc + cat.features.length, 0);
  const discoveryPercent = Math.round((completedFeatures / totalFeatures) * 100);
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎮 ZooBot Game Hub')
    .setDescription(`Welcome back, **${user.username}**!\n\nSelect a category below to explore features. Everything is just a click away - no commands to memorize!`)
    .addFields(
      {
        name: '📊 Your Quick Stats',
        value: `💰 ${formatNumber(userData.coins || 0)} Coins | 💎 ${formatNumber(userData.gems || 0)} Gems | 🦁 ${charCount} Characters`,
        inline: false
      },
      {
        name: '🗺️ Discovery Progress',
        value: `You've explored **${discoveryPercent}%** of ZooBot features! (${completedFeatures}/${totalFeatures})`,
        inline: false
      },
      {
        name: '💡 Tip for You',
        value: tip,
        inline: false
      }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Player Stage: ${stage.charAt(0).toUpperCase() + stage.slice(1)} | Use the buttons below to navigate` })
    .setTimestamp();
  
  return embed;
}

function createHubCategoryButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hub_play')
      .setLabel('Play')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('hub_rewards')
      .setLabel('Rewards')
      .setEmoji('🎁')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('hub_collection')
      .setLabel('Collection')
      .setEmoji('🦁')
      .setStyle(ButtonStyle.Primary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hub_economy')
      .setLabel('Economy')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('hub_progress')
      .setLabel('Progress')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('hub_social')
      .setLabel('Social')
      .setEmoji('🏰')
      .setStyle(ButtonStyle.Success)
  );
  
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hub_guide')
      .setLabel('Quick Start Guide')
      .setEmoji('📚')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('hub_help')
      .setLabel('All Commands')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return [row1, row2, row3];
}

function createCategoryEmbed(categoryId, user, userData) {
  const category = HUB_CATEGORIES[categoryId];
  if (!category) return null;
  
  const featureList = category.features.map(f => 
    `${f.emoji} **${f.name}**\n└ ${f.desc}`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setColor(category.color)
    .setTitle(`${category.emoji} ${category.name}`)
    .setDescription(`${category.description}\n\n${featureList}`)
    .setFooter({ text: 'Click a button below to use that feature!' })
    .setTimestamp();
  
  return embed;
}

function createCategoryButtons(categoryId) {
  const category = HUB_CATEGORIES[categoryId];
  if (!category) return [];
  
  const rows = [];
  const features = category.features;
  
  for (let i = 0; i < features.length; i += 3) {
    const row = new ActionRowBuilder();
    const slice = features.slice(i, i + 3);
    
    for (const feature of slice) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`feature_${feature.id}`)
          .setLabel(feature.name)
          .setEmoji(feature.emoji)
          .setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }
  
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hub_back')
        .setLabel('Back to Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary)
    )
  );
  
  return rows;
}

function createQuickStartEmbed(user, userData, step = 0) {
  const isNewPlayer = !userData.characters || userData.characters.length === 0;
  
  const steps = [
    {
      title: '👋 Welcome to ZooBot!',
      description: 'ZooBot is a character collection and battle game! Collect unique zoo animals, battle other players, and become the ultimate zookeeper.',
      fields: [
        { name: '🎯 Your Goal', value: 'Collect characters, level them up, battle, and climb the leaderboards!', inline: false },
        { name: '💡 How to Start', value: isNewPlayer ? 'Click **Get Started** below to receive your first character and starter bonus!' : 'You\'re all set! Click **Continue** to learn more.', inline: false }
      ],
      buttonLabel: isNewPlayer ? 'Get Started' : 'Continue'
    },
    {
      title: '🦁 Characters & Collection',
      description: 'Characters are the heart of ZooBot! Each has unique abilities and can be leveled up.',
      fields: [
        { name: '📦 Getting Characters', value: '• Open **Crates** from daily rewards, shop, or work\n• Catch **Drops** when they spawn\n• **Trade** with other players', inline: false },
        { name: '⬆️ Leveling Up', value: 'Use characters in battles to earn XP and level them up. Higher levels = stronger in battle!', inline: false }
      ],
      buttonLabel: 'Next'
    },
    {
      title: '💰 Economy Basics',
      description: 'There are several currencies in ZooBot:',
      fields: [
        { name: '💰 Coins', value: 'Main currency - earn from work, daily, battles. Buy crates and items.', inline: true },
        { name: '💎 Gems', value: 'Premium currency - rarer to get. Buy epic items and crates.', inline: true },
        { name: '🏆 Trophies', value: 'Earned from winning battles. Show off your skill!', inline: true }
      ],
      buttonLabel: 'Next'
    },
    {
      title: '⚔️ Battles',
      description: 'Challenge other players or AI to exciting turn-based battles!',
      fields: [
        { name: '🎮 PvP Battles', value: 'Challenge friends with `!battle @user` or click the Battle button', inline: false },
        { name: '🤖 AI Battles', value: 'Practice against AI: Easy, Normal, or Hard difficulty', inline: false },
        { name: '🎯 Strategy', value: 'Each character has unique abilities. Learn them to win!', inline: false }
      ],
      buttonLabel: 'Next'
    },
    {
      title: '🎉 You\'re Ready!',
      description: 'You now know the basics! Here\'s what to do every day:',
      fields: [
        { name: '📅 Daily Routine', value: '1️⃣ Claim `!daily` reward\n2️⃣ Do `!work` for coins\n3️⃣ Check `!quests` for bonus tasks\n4️⃣ Open your crates\n5️⃣ Battle for XP and trophies!', inline: false },
        { name: '🏠 Remember', value: 'Use `!hub` anytime to access this menu with all features!', inline: false }
      ],
      buttonLabel: 'Open Game Hub'
    }
  ];
  
  const currentStep = steps[step] || steps[0];
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📚 Quick Start Guide - Step ${step + 1}/${steps.length}`)
    .setDescription(`### ${currentStep.title}\n\n${currentStep.description}`)
    .addFields(currentStep.fields)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Step ${step + 1} of ${steps.length}` });
  
  return { embed, buttonLabel: currentStep.buttonLabel, isLast: step >= steps.length - 1 };
}

function createQuickStartButtons(step, isLast) {
  const row = new ActionRowBuilder();
  
  if (step > 0) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`guide_step_${step - 1}`)
        .setLabel('Previous')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  
  if (isLast) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('guide_finish')
        .setLabel('Open Game Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Success)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`guide_step_${step + 1}`)
        .setLabel(step === 0 ? 'Get Started' : 'Next')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('guide_skip')
      .setLabel('Skip to Hub')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return [row];
}

function createMinigamesEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('🎰 Minigames')
    .setDescription('Test your luck and win big! All games require a coin bet.')
    .addFields(
      { name: '🪙 Coin Duel', value: '`!coinduel <h/t> <bet>`\nFlip a coin - heads or tails!', inline: true },
      { name: '🎲 Dice Clash', value: '`!diceclash <bet>`\nRoll dice against the house', inline: true },
      { name: '🚪 Door of Fate', value: '`!dooroffate <bet>`\nChoose the right door', inline: true },
      { name: '✊ Rock Paper Scissors', value: '`!rps <r/p/s> <bet>`\nClassic game of chance', inline: true },
      { name: '🔢 Almost Win', value: '`!almostwin <bet>`\nNumber guessing game', inline: true }
    )
    .setFooter({ text: 'Gamble responsibly! All bets use your coins.' });
  
  return embed;
}

function createMinigameButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('minigame_coinduel')
      .setLabel('Coin Duel')
      .setEmoji('🪙')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('minigame_diceclash')
      .setLabel('Dice Clash')
      .setEmoji('🎲')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('minigame_rps')
      .setLabel('Rock Paper Scissors')
      .setEmoji('✊')
      .setStyle(ButtonStyle.Primary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hub_back')
      .setLabel('Back to Hub')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return [row1, row2];
}

function createAdminHubEmbed(user, serverConfig) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('⚙️ Server Admin Panel')
    .setDescription('Manage ZooBot settings for your server.')
    .addFields(
      {
        name: '📢 Channels',
        value: `Drop Channel: ${serverConfig?.dropChannel ? `<#${serverConfig.dropChannel}>` : 'Not set'}\nEvents Channel: ${serverConfig?.eventsChannel ? `<#${serverConfig.eventsChannel}>` : 'Not set'}\nUpdates Channel: ${serverConfig?.updatesChannel ? `<#${serverConfig.updatesChannel}>` : 'Not set'}`,
        inline: false
      },
      {
        name: '🎮 Game Bundle',
        value: serverConfig?.activeGame || 'Default',
        inline: true
      },
      {
        name: '👥 Bot Admins',
        value: serverConfig?.botAdmins?.length ? `${serverConfig.botAdmins.length} admins` : 'Only server owner',
        inline: true
      }
    )
    .setFooter({ text: 'Use the buttons below to configure' });
  
  return embed;
}

async function openHub(message, data, userData) {
  const discoveryData = userData.discovery || { featuresUsed: [] };
  const embed = createMainHubEmbed(message.author, userData, discoveryData);
  const buttons = createHubCategoryButtons();
  
  return message.reply({ embeds: [embed], components: buttons });
}

async function openCategory(interaction, categoryId, data, userData) {
  const embed = createCategoryEmbed(categoryId, interaction.user, userData);
  const buttons = createCategoryButtons(categoryId);
  
  if (!embed) {
    return interaction.reply({ content: 'Category not found!', ephemeral: true });
  }
  
  return interaction.update({ embeds: [embed], components: buttons });
}

async function openQuickStart(message, data, userData, step = 0) {
  const { embed, buttonLabel, isLast } = createQuickStartEmbed(message.author, userData, step);
  const buttons = createQuickStartButtons(step, isLast);
  
  return message.reply({ embeds: [embed], components: buttons });
}

async function handleGuideStep(interaction, step, data, userData) {
  const { embed, buttonLabel, isLast } = createQuickStartEmbed(interaction.user, userData, step);
  const buttons = createQuickStartButtons(step, isLast);
  
  return interaction.update({ embeds: [embed], components: buttons });
}

module.exports = {
  HUB_CATEGORIES,
  PLAYER_JOURNEY,
  getPlayerJourneyStage,
  getRandomTip,
  createMainHubEmbed,
  createHubCategoryButtons,
  createCategoryEmbed,
  createCategoryButtons,
  createQuickStartEmbed,
  createQuickStartButtons,
  createMinigamesEmbed,
  createMinigameButtons,
  createAdminHubEmbed,
  openHub,
  openCategory,
  openQuickStart,
  handleGuideStep
};
