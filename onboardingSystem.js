const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ONBOARDING_STEPS = {
  welcome: {
    order: 0,
    title: '🎉 Welcome to ZooBot!',
    description: 'Hi there! I noticed you\'re new here. Would you like a quick tour to help you get started?',
    tips: [
      'ZooBot is a character collection game',
      'Collect unique animals, battle others, and become the ultimate zookeeper!',
      'Everything is designed to be fun and easy'
    ],
    action: null
  },
  starter: {
    order: 1,
    title: '🦁 Your First Character',
    description: 'Every adventure starts with a companion! Let\'s get you your first character.',
    tips: [
      'You\'ll receive a random starter character',
      'Plus bonus coins, gems, and crates to get you going!',
      'Characters can be leveled up through battles'
    ],
    action: 'start'
  },
  collection: {
    order: 2,
    title: '📦 Your Collection',
    description: 'Great! Now let\'s see your new friend!',
    tips: [
      'View all your characters anytime',
      'Each character has unique abilities',
      'Collect them all!'
    ],
    action: 'collection'
  },
  daily: {
    order: 3,
    title: '📅 Daily Rewards',
    description: 'Don\'t forget to claim free stuff every day!',
    tips: [
      'Claim once every 24 hours',
      'Streak bonuses for consecutive days',
      'Free coins, gems, and sometimes crates!'
    ],
    action: 'daily'
  },
  hub: {
    order: 4,
    title: '🏠 The Game Hub',
    description: 'This is your home base! Access everything from here.',
    tips: [
      'Use `!hub` to open this menu anytime',
      'All features organized by category',
      'No commands to memorize - just click!'
    ],
    action: 'hub'
  },
  complete: {
    order: 5,
    title: '✨ You\'re All Set!',
    description: 'You\'ve completed the tutorial! Here\'s what to remember:',
    tips: [
      '`!hub` - Open the game menu',
      '`!daily` - Claim daily rewards',
      '`!work` - Earn coins every 30 min',
      '`!battle @user` - Challenge someone',
      'Have fun! 🎮'
    ],
    action: null
  }
};

function initializeOnboarding(userData) {
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
  return userData.onboarding;
}

function shouldShowOnboarding(userData) {
  const onboarding = userData.onboarding || {};
  if (onboarding.completed) return false;
  if (!userData.characters || userData.characters.length === 0) return true;
  if (onboarding.started && !onboarding.completed) return true;
  return false;
}

function getOnboardingProgress(userData) {
  const onboarding = initializeOnboarding(userData);
  const totalSteps = Object.keys(ONBOARDING_STEPS).length;
  const completedSteps = onboarding.stepsCompleted?.length || 0;
  return {
    current: completedSteps,
    total: totalSteps,
    percentage: Math.round((completedSteps / totalSteps) * 100),
    isComplete: onboarding.completed
  };
}

function createOnboardingEmbed(user, stepId, userData) {
  const step = ONBOARDING_STEPS[stepId];
  if (!step) return null;
  
  const progress = getOnboardingProgress(userData);
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(step.title)
    .setDescription(step.description)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Tutorial Progress: ${progress.current}/${progress.total - 1}` });
  
  if (step.tips && step.tips.length > 0) {
    const tipsText = step.tips.map(tip => `• ${tip}`).join('\n');
    embed.addFields({ name: '💡 Good to Know', value: tipsText, inline: false });
  }
  
  return embed;
}

function createOnboardingButtons(stepId, userData) {
  const step = ONBOARDING_STEPS[stepId];
  const stepKeys = Object.keys(ONBOARDING_STEPS);
  const currentIndex = stepKeys.indexOf(stepId);
  const nextStep = stepKeys[currentIndex + 1];
  
  const row = new ActionRowBuilder();
  
  if (stepId === 'welcome') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('onboard_start')
        .setLabel('Start Tutorial')
        .setEmoji('🚀')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('onboard_skip')
        .setLabel('Skip Tutorial')
        .setStyle(ButtonStyle.Secondary)
    );
  } else if (stepId === 'complete') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('onboard_finish')
        .setLabel('Open Game Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Success)
    );
  } else {
    if (step.action) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`onboard_action_${step.action}`)
          .setLabel(`Try It: !${step.action}`)
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
      );
    }
    
    if (nextStep) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`onboard_next_${nextStep}`)
          .setLabel('Next Step')
          .setEmoji('➡️')
          .setStyle(ButtonStyle.Success)
      );
    }
    
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('onboard_skip')
        .setLabel('Skip Tutorial')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  
  return [row];
}

function advanceOnboarding(userData, toStep) {
  const onboarding = initializeOnboarding(userData);
  const stepKeys = Object.keys(ONBOARDING_STEPS);
  const currentIndex = stepKeys.indexOf(onboarding.currentStep);
  
  if (!onboarding.stepsCompleted.includes(onboarding.currentStep)) {
    onboarding.stepsCompleted.push(onboarding.currentStep);
  }
  
  if (toStep === 'complete') {
    onboarding.completed = true;
    onboarding.completedAt = Date.now();
  }
  
  onboarding.currentStep = toStep;
  return onboarding;
}

function startOnboarding(userData) {
  const onboarding = initializeOnboarding(userData);
  onboarding.started = true;
  onboarding.startedAt = Date.now();
  onboarding.currentStep = 'starter';
  return onboarding;
}

function skipOnboarding(userData) {
  const onboarding = initializeOnboarding(userData);
  onboarding.completed = true;
  onboarding.completedAt = Date.now();
  return onboarding;
}

async function showOnboardingPrompt(message, userData) {
  if (!shouldShowOnboarding(userData)) return null;
  
  const onboarding = initializeOnboarding(userData);
  const embed = createOnboardingEmbed(message.author, onboarding.currentStep, userData);
  const buttons = createOnboardingButtons(onboarding.currentStep, userData);
  
  if (!embed) return null;
  
  return message.reply({ embeds: [embed], components: buttons });
}

function createFirstTimeWelcome(user) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎉 Welcome to ZooBot!')
    .setDescription(`Hey **${user.username}**! I see you\'re new here!\n\nWould you like a quick interactive tutorial to learn the basics?`)
    .addFields(
      {
        name: '🎮 What is ZooBot?',
        value: 'A fun character collection and battle game! Collect unique zoo animals, battle friends, and climb the leaderboards!',
        inline: false
      },
      {
        name: '⏱️ Tutorial Length',
        value: 'About 2 minutes - and you\'ll get bonus rewards!',
        inline: true
      },
      {
        name: '🎁 Tutorial Reward',
        value: 'Bonus crates when you complete it!',
        inline: true
      }
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: 'Tip: You can always access !hub for a full menu of features' });
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('onboard_start')
      .setLabel('Start Tutorial')
      .setEmoji('🎓')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('onboard_skip')
      .setLabel('Skip, I Know How to Play')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('hub_main')
      .setLabel('Open Game Hub')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Primary)
  );
  
  return { embed, components: [row] };
}

module.exports = {
  ONBOARDING_STEPS,
  initializeOnboarding,
  shouldShowOnboarding,
  getOnboardingProgress,
  createOnboardingEmbed,
  createOnboardingButtons,
  advanceOnboarding,
  startOnboarding,
  skipOnboarding,
  showOnboardingPrompt,
  createFirstTimeWelcome
};
