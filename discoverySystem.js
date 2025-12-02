const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DISCOVERABLE_FEATURES = {
  core: {
    name: 'Core Features',
    emoji: '⭐',
    features: {
      start: { name: 'Start Game', emoji: '🚀', command: '!start', desc: 'Begin your adventure' },
      collection: { name: 'Collection', emoji: '🦁', command: '!collection', desc: 'View your characters' },
      profile: { name: 'Profile', emoji: '👤', command: '!profile', desc: 'Check your stats' },
      balance: { name: 'Balance', emoji: '💰', command: '!balance', desc: 'Check your money' },
      help: { name: 'Help', emoji: '❓', command: '!help', desc: 'Get command help' },
      hub: { name: 'Game Hub', emoji: '🏠', command: '!hub', desc: 'Main menu' }
    }
  },
  earning: {
    name: 'Earning',
    emoji: '💰',
    features: {
      daily: { name: 'Daily Reward', emoji: '📅', command: '!daily', desc: 'Claim daily bonus' },
      work: { name: 'Work', emoji: '💼', command: '!work', desc: 'Earn coins' },
      quests: { name: 'Quests', emoji: '📋', command: '!quests', desc: 'Complete tasks' },
      challenges: { name: 'Challenges', emoji: '🎯', command: '!challenges', desc: 'Weekly goals' }
    }
  },
  collection_features: {
    name: 'Collection',
    emoji: '📦',
    features: {
      crate: { name: 'Crates', emoji: '📦', command: '!crate', desc: 'View crate inventory' },
      opencrate: { name: 'Open Crate', emoji: '🎁', command: '!opencrate', desc: 'Open a crate' },
      shop: { name: 'Shop', emoji: '🛒', command: '!shop', desc: 'Buy items' },
      skins: { name: 'Skins', emoji: '🎨', command: '!skins', desc: 'Character skins' },
      char: { name: 'Character Info', emoji: '📖', command: '!char', desc: 'View character details' }
    }
  },
  battle: {
    name: 'Battle',
    emoji: '⚔️',
    features: {
      battle: { name: 'PvP Battle', emoji: '⚔️', command: '!battle', desc: 'Fight players' },
      battle_ai: { name: 'AI Battle', emoji: '🤖', command: '!b ai', desc: 'Fight AI opponents' },
      leaderboard: { name: 'Leaderboard', emoji: '📊', command: '!leaderboard', desc: 'View rankings' },
      achievements: { name: 'Achievements', emoji: '🏅', command: '!achievements', desc: 'Your badges' }
    }
  },
  economy: {
    name: 'Economy',
    emoji: '🏪',
    features: {
      trade: { name: 'Trade', emoji: '🔄', command: '!trade', desc: 'Trade with players' },
      market: { name: 'Market', emoji: '🏪', command: '!market', desc: 'Player marketplace' },
      auctions: { name: 'Auctions', emoji: '🔨', command: '!auctions', desc: 'Bid on items' },
      inventory: { name: 'Inventory', emoji: '🎒', command: '!inventory', desc: 'Your items' }
    }
  },
  social: {
    name: 'Social',
    emoji: '🏰',
    features: {
      clan: { name: 'Clan', emoji: '🏰', command: '!clan', desc: 'View your clan' },
      joinclan: { name: 'Join Clan', emoji: '🤝', command: '!joinclan', desc: 'Join a clan' },
      clanleaderboard: { name: 'Clan Rankings', emoji: '🏆', command: '!clanleaderboard', desc: 'Top clans' },
      trivia: { name: 'Trivia', emoji: '🧠', command: '!trivia', desc: 'Quiz game' }
    }
  },
  minigames: {
    name: 'Minigames',
    emoji: '🎰',
    features: {
      coinduel: { name: 'Coin Duel', emoji: '🪙', command: '!coinduel', desc: 'Coin flip game' },
      diceclash: { name: 'Dice Clash', emoji: '🎲', command: '!diceclash', desc: 'Dice game' },
      rps: { name: 'Rock Paper Scissors', emoji: '✊', command: '!rps', desc: 'RPS game' },
      dooroffate: { name: 'Door of Fate', emoji: '🚪', command: '!dooroffate', desc: 'Door game' }
    }
  },
  advanced: {
    name: 'Advanced',
    emoji: '🔧',
    features: {
      crafttool: { name: 'Craft Tool', emoji: '⚒️', command: '!crafttool', desc: 'Make tools' },
      workguide: { name: 'Work Guide', emoji: '📚', command: '!workguide', desc: 'Work system guide' },
      mail: { name: 'Mail', emoji: '📬', command: '!mail', desc: 'Check mailbox' },
      news: { name: 'News', emoji: '📰', command: '!news', desc: 'Latest updates' }
    }
  }
};

function initializeDiscovery(userData) {
  if (!userData.discovery) {
    userData.discovery = {
      featuresUsed: [],
      firstUsed: {},
      suggestions: [],
      lastSuggestion: null,
      totalInteractions: 0
    };
  }
  return userData.discovery;
}

function trackFeatureUse(userData, featureId) {
  const discovery = initializeDiscovery(userData);
  
  if (!discovery.featuresUsed.includes(featureId)) {
    discovery.featuresUsed.push(featureId);
    discovery.firstUsed[featureId] = Date.now();
  }
  
  discovery.totalInteractions = (discovery.totalInteractions || 0) + 1;
  return discovery;
}

function getDiscoveryProgress(userData) {
  const discovery = initializeDiscovery(userData);
  let totalFeatures = 0;
  let discoveredFeatures = 0;
  const categoryProgress = {};
  
  for (const [catId, category] of Object.entries(DISCOVERABLE_FEATURES)) {
    const catFeatures = Object.keys(category.features);
    const catDiscovered = catFeatures.filter(f => discovery.featuresUsed.includes(f));
    
    totalFeatures += catFeatures.length;
    discoveredFeatures += catDiscovered.length;
    
    categoryProgress[catId] = {
      name: category.name,
      emoji: category.emoji,
      total: catFeatures.length,
      discovered: catDiscovered.length,
      percentage: Math.round((catDiscovered.length / catFeatures.length) * 100)
    };
  }
  
  return {
    total: totalFeatures,
    discovered: discoveredFeatures,
    percentage: Math.round((discoveredFeatures / totalFeatures) * 100),
    categories: categoryProgress
  };
}

function getUndiscoveredFeatures(userData, limit = 5) {
  const discovery = initializeDiscovery(userData);
  const undiscovered = [];
  
  for (const [catId, category] of Object.entries(DISCOVERABLE_FEATURES)) {
    for (const [featureId, feature] of Object.entries(category.features)) {
      if (!discovery.featuresUsed.includes(featureId)) {
        undiscovered.push({
          id: featureId,
          category: catId,
          categoryName: category.name,
          ...feature
        });
      }
    }
  }
  
  const shuffled = undiscovered.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, limit);
}

function getSuggestedFeature(userData) {
  const discovery = initializeDiscovery(userData);
  const charCount = (userData.characters || []).length;
  const undiscovered = getUndiscoveredFeatures(userData, 10);
  
  if (undiscovered.length === 0) return null;
  
  let priorities = [];
  
  if (charCount === 0 && undiscovered.find(f => f.id === 'start')) {
    return undiscovered.find(f => f.id === 'start');
  }
  
  if (!discovery.featuresUsed.includes('daily')) {
    const daily = undiscovered.find(f => f.id === 'daily');
    if (daily) priorities.push(daily);
  }
  
  if (!discovery.featuresUsed.includes('work') && charCount > 0) {
    const work = undiscovered.find(f => f.id === 'work');
    if (work) priorities.push(work);
  }
  
  if (!discovery.featuresUsed.includes('hub')) {
    const hub = undiscovered.find(f => f.id === 'hub');
    if (hub) priorities.push(hub);
  }
  
  if (priorities.length > 0) {
    return priorities[0];
  }
  
  return undiscovered[Math.floor(Math.random() * undiscovered.length)];
}

function createDiscoveryEmbed(user, userData) {
  const progress = getDiscoveryProgress(userData);
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🗺️ Feature Discovery')
    .setDescription(`**${user.username}**, you've explored **${progress.percentage}%** of ZooBot!\n\nKeep exploring to unlock all features and become a ZooBot master!`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }));
  
  let categoryText = '';
  for (const [catId, cat] of Object.entries(progress.categories)) {
    const progressBar = createProgressBar(cat.discovered, cat.total);
    categoryText += `${cat.emoji} **${cat.name}**: ${progressBar} ${cat.discovered}/${cat.total}\n`;
  }
  
  embed.addFields({ name: '📊 Progress by Category', value: categoryText, inline: false });
  
  const suggestions = getUndiscoveredFeatures(userData, 3);
  if (suggestions.length > 0) {
    const suggestionText = suggestions.map(s => 
      `${s.emoji} **${s.name}** - ${s.desc}\n└ Try: \`${s.command}\``
    ).join('\n\n');
    
    embed.addFields({ name: '💡 Try These Next', value: suggestionText, inline: false });
  }
  
  embed.setFooter({ text: `Total interactions: ${userData.discovery?.totalInteractions || 0}` });
  
  return embed;
}

function createProgressBar(current, total, length = 10) {
  const filled = Math.round((current / total) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function createSuggestionEmbed(userData) {
  const suggestion = getSuggestedFeature(userData);
  
  if (!suggestion) {
    return new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🎉 Feature Master!')
      .setDescription('Amazing! You\'ve discovered all ZooBot features! Keep playing and having fun!');
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle('💡 Feature Suggestion')
    .setDescription(`Have you tried **${suggestion.name}** yet?`)
    .addFields(
      { name: `${suggestion.emoji} ${suggestion.name}`, value: suggestion.desc, inline: false },
      { name: '📝 How to Use', value: `Type \`${suggestion.command}\` or use the button below!`, inline: false }
    )
    .setFooter({ text: `Category: ${suggestion.categoryName}` });
  
  return embed;
}

function createNewFeatureUnlockedEmbed(featureId, userData) {
  let feature = null;
  let categoryName = '';
  
  for (const [catId, category] of Object.entries(DISCOVERABLE_FEATURES)) {
    if (category.features[featureId]) {
      feature = category.features[featureId];
      categoryName = category.name;
      break;
    }
  }
  
  if (!feature) return null;
  
  const progress = getDiscoveryProgress(userData);
  
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🎉 New Feature Discovered!')
    .setDescription(`You just discovered **${feature.name}**!`)
    .addFields(
      { name: `${feature.emoji} ${feature.name}`, value: feature.desc, inline: false },
      { name: '🗺️ Discovery Progress', value: `${progress.discovered}/${progress.total} features (${progress.percentage}%)`, inline: false }
    )
    .setFooter({ text: `Category: ${categoryName}` });
  
  return embed;
}

function shouldShowSuggestion(userData) {
  const discovery = initializeDiscovery(userData);
  const interactions = discovery.totalInteractions || 0;
  
  if (interactions < 3) return false;
  if (interactions % 10 === 0) return true;
  
  return false;
}

module.exports = {
  DISCOVERABLE_FEATURES,
  initializeDiscovery,
  trackFeatureUse,
  getDiscoveryProgress,
  getUndiscoveredFeatures,
  getSuggestedFeature,
  createDiscoveryEmbed,
  createSuggestionEmbed,
  createNewFeatureUnlockedEmbed,
  shouldShowSuggestion
};
