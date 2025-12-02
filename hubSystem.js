const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { formatNumber } = require('./utils/shared.js');

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
    ],
    allCommands: [
      { cmd: '!battle @user', desc: 'Challenge another player to a battle' },
      { cmd: '!b easy/normal/hard', desc: 'Battle against AI opponents' },
      { cmd: '!work', desc: 'Perform your assigned job for rewards' },
      { cmd: '!workguide', desc: 'View the complete work system guide' },
      { cmd: '!crafttool <tool> [level]', desc: 'Craft tools to boost work efficiency' },
      { cmd: '!upgrade / !upgradehouse', desc: 'Upgrade your Caretaking House' },
      { cmd: '!coinduel <h/t> <bet>', desc: 'Flip a coin - heads or tails gambling' },
      { cmd: '!diceclash <bet>', desc: 'Roll dice against the house' },
      { cmd: '!dooroffate <bet>', desc: 'Choose the right door to win' },
      { cmd: '!rps <r/p/s> <bet>', desc: 'Rock Paper Scissors with betting' },
      { cmd: '!almostwin <bet>', desc: 'Number guessing slot machine game' }
    ]
  },
  rewards: {
    emoji: '🎁',
    name: 'Rewards',
    description: 'Daily rewards, crates, quests, keys, and mail',
    color: 0xF39C12,
    features: [
      { id: 'daily', emoji: '📅', name: 'Daily', desc: 'Claim daily reward', command: '!daily' },
      { id: 'crates', emoji: '📦', name: 'Crates', desc: 'Open your crates', command: '!crate' },
      { id: 'charkeys', emoji: '🔑', name: 'Character Keys', desc: 'Collect keys to unlock characters', command: '!charkeys' },
      { id: 'quests', emoji: '📋', name: 'Quests', desc: 'Complete tasks for rewards', command: '!quests' },
      { id: 'mail', emoji: '📬', name: 'Mail', desc: 'Check your mailbox', command: '!mail' }
    ],
    allCommands: [
      { cmd: '!daily', desc: 'Claim your daily reward (24h cooldown)' },
      { cmd: '!crate [type]', desc: 'View or buy crates' },
      { cmd: '!pickcrate <type>', desc: 'Select a crate to open' },
      { cmd: '!opencrate <type>', desc: 'Open a specific crate type' },
      { cmd: '!bulkopen <type> [qty]', desc: 'Open multiple crates at once' },
      { cmd: '!charkeys', desc: 'View your character key collection and progress' },
      { cmd: '!keyunlock <character>', desc: 'Unlock a character using 750 keys' },
      { cmd: '!convertkeys', desc: 'Convert excess character keys to tokens' },
      { cmd: '!keyrush', desc: 'Activate Key Rush event (ZooAdmin, 250 gems, 1 hour)' },
      { cmd: '!keyrushstatus', desc: 'Check if Key Rush is active' },
      { cmd: '!quests [page]', desc: 'View available quests' },
      { cmd: '!quest <id>', desc: 'View quest details' },
      { cmd: '!claim <quest_id>', desc: 'Claim completed quest rewards' },
      { cmd: '!claimall', desc: 'Claim all completed quest rewards' },
      { cmd: '!mail [page]', desc: 'View your mailbox' },
      { cmd: '!claimmail <#>', desc: 'Claim rewards from mail' },
      { cmd: '!clearmail', desc: 'Clear claimed mail' },
      { cmd: '!keys', desc: 'View your cage keys' },
      { cmd: '!unlock <character>', desc: 'Unlock a character with keys' },
      { cmd: '!cage', desc: 'Open a random cage' },
      { cmd: '!giveaway', desc: 'View active giveaway info' },
      { cmd: '!lottery', desc: 'View lottery info' },
      { cmd: '!lottery join <tickets>', desc: 'Join the lottery' }
    ]
  },
  collection: {
    emoji: '🦁',
    name: 'Collection',
    description: 'Your characters, skins, and customization',
    color: 0x3498DB,
    features: [
      { id: 'collection', emoji: '🦁', name: 'Characters', desc: 'View your collection', command: '!collection' },
      { id: 'skins', emoji: '🎨', name: 'Skins', desc: 'Customize your characters', command: '!skins' },
      { id: 'charinfo', emoji: '📖', name: 'Character Info', desc: 'Learn about characters', command: '!char' }
    ],
    allCommands: [
      { cmd: '!start', desc: 'Begin your ZooBot adventure!' },
      { cmd: '!select <character>', desc: 'Choose your starter character' },
      { cmd: '!collection', desc: 'View all your collected characters' },
      { cmd: '!char <name>', desc: 'View detailed character info (owned)' },
      { cmd: '!info <name>', desc: 'View any character info (no ownership needed)' },
      { cmd: '!I <name>', desc: 'View battle stats for owned character' },
      { cmd: '!levelup <name>', desc: 'Level up a character using tokens' },
      { cmd: '!release <name>', desc: 'Release a character (Level 10+)' },
      { cmd: '!equipskin <char> <skin>', desc: 'Equip a character skin' },
      { cmd: '!skins', desc: 'View your owned skins' },
      { cmd: '!c <code>', desc: 'Catch a drop using its code' },
      { cmd: '!submit <data>', desc: 'Submit a character for review' },
      { cmd: '!mysubmissions', desc: 'View your character submissions' }
    ]
  },
  economy: {
    emoji: '💰',
    name: 'Economy',
    description: 'Shop, trade, marketplace, and currency',
    color: 0xFFD700,
    features: [
      { id: 'balance', emoji: '💰', name: 'Balance', desc: 'Check your money', command: '!balance' },
      { id: 'shop', emoji: '🛒', name: 'Shop', desc: 'Buy items and crates', command: '!shop' },
      { id: 'trade', emoji: '🔄', name: 'Trade', desc: 'Trade with players', command: '!trade' },
      { id: 'market', emoji: '🏪', name: 'Market', desc: 'Player marketplace', command: '!market' },
      { id: 'inventory', emoji: '🎒', name: 'Inventory', desc: 'View your items', command: '!inventory' }
    ],
    allCommands: [
      { cmd: '!balance', desc: 'Check your coins, gems, and trophies' },
      { cmd: '!shop', desc: 'Browse the main shop' },
      { cmd: '!t @user / !trade @user', desc: 'Initiate a trade with another player' },
      { cmd: '!market', desc: 'Browse the player marketplace' },
      { cmd: '!market sell <item> <price>', desc: 'List an item for sale' },
      { cmd: '!market buy <id>', desc: 'Buy an item from market' },
      { cmd: '!market cancel <id>', desc: 'Cancel your listing' },
      { cmd: '!auctions', desc: 'View active auctions' },
      { cmd: '!auction create', desc: 'Create a new auction' },
      { cmd: '!inventory / !inv', desc: 'View your ores, wood, tools, items' },
      { cmd: '!ust / !ustbalance', desc: 'View your Universal Skin Token balance' },
      { cmd: '!ustshop / !skinshop', desc: 'Browse the UST cosmetics shop' },
      { cmd: '!shards', desc: 'View ST Booster info' },
      { cmd: '!craft', desc: 'Craft an ST booster' },
      { cmd: '!boost <character>', desc: 'Use an ST booster (risky!)' }
    ]
  },
  progress: {
    emoji: '🏆',
    name: 'Progress',
    description: 'Profile, achievements, leaderboards, and challenges',
    color: 0x9B59B6,
    features: [
      { id: 'profile', emoji: '👤', name: 'Profile', desc: 'Your stats and info', command: '!profile' },
      { id: 'achievements', emoji: '🏅', name: 'Achievements', desc: 'Your badges', command: '!achievements' },
      { id: 'leaderboard', emoji: '📊', name: 'Leaderboard', desc: 'Server rankings', command: '!leaderboard' },
      { id: 'challenges', emoji: '🎯', name: 'Challenges', desc: 'Weekly challenges', command: '!challenges' }
    ],
    allCommands: [
      { cmd: '!profile [page]', desc: 'View your full profile stats' },
      { cmd: '!myprofile', desc: 'Quick profile view' },
      { cmd: '!setpfp <name>', desc: 'Set your profile picture' },
      { cmd: '!pfps', desc: 'List your owned profile pictures' },
      { cmd: '!addpfp <name> (with image)', desc: 'Upload a custom profile picture' },
      { cmd: '!achievements / !badges', desc: 'View your achievement badges' },
      { cmd: '!leaderboard <type>', desc: 'View rankings (coins/gems/battles/collection/trophies)' },
      { cmd: '!globalboard [type]', desc: 'View global leaderboards across all servers' },
      { cmd: '!challenges', desc: 'View weekly challenges' },
      { cmd: '!claimchallenge <id>', desc: 'Claim challenge rewards' },
      { cmd: '!seasonpass / !sp', desc: 'View Season Pass progress' },
      { cmd: '!seasontasks / !stasks', desc: 'View daily season tasks' },
      { cmd: '!seasonrewards / !srewards', desc: 'View all season rewards' },
      { cmd: '!taskclaimall', desc: 'Claim all completed task rewards' },
      { cmd: '!seasonclaimall', desc: 'Claim all season pass rewards' },
      { cmd: '!event', desc: 'View current event details' },
      { cmd: '!eventleaderboard', desc: 'View event rankings' }
    ]
  },
  social: {
    emoji: '🏰',
    name: 'Social',
    description: 'Clans, trivia, and community features',
    color: 0x2ECC71,
    features: [
      { id: 'clan', emoji: '🏰', name: 'Clan', desc: 'Join or view clan', command: '!clan' },
      { id: 'clanleaderboard', emoji: '🏆', name: 'Clan Rankings', desc: 'Top clans', command: '!clans' },
      { id: 'trivia', emoji: '🧠', name: 'Trivia', desc: 'Test your knowledge', command: '!trivia' }
    ],
    allCommands: [
      { cmd: '!clan', desc: 'View your clan info' },
      { cmd: '!joinclan <name>', desc: 'Join a clan' },
      { cmd: '!leaveclan', desc: 'Leave your current clan' },
      { cmd: '!donate <type> <amount>', desc: 'Donate resources to your clan' },
      { cmd: '!clans / !clanleaderboard', desc: 'View the clan leaderboard' },
      { cmd: '!trivia', desc: 'Start a trivia session' },
      { cmd: '!a <answer>', desc: 'Answer a trivia question' },
      { cmd: '!q <keyword>', desc: 'Search the Q&A database' },
      { cmd: '!submitqa ...', desc: 'Submit a Q&A for admin review' },
      { cmd: '!news', desc: 'View latest bot news and updates' }
    ]
  }
};

const ADMIN_CATEGORIES = {
  hierarchy: {
    emoji: '📊',
    name: 'Role Hierarchy',
    description: 'View and manage bot roles and permissions',
    color: 0xFFD700,
    commands: [
      { cmd: '!hierarchy', desc: 'View the complete role hierarchy and permissions' },
      { cmd: '!myrole', desc: 'Check your current role and what you can do' },
      { cmd: '!admins', desc: 'View all bot admins (super, global, server)' },
      { cmd: '!addbotadmin @user', desc: 'Add a global bot admin (Super Admin only)' },
      { cmd: '!removebotadmin @user', desc: 'Remove a global bot admin (Super Admin only)' },
      { cmd: '!addserveradmin @user', desc: 'Add a server admin (Owner/Bot Admin)' },
      { cmd: '!removeserveradmin @user', desc: 'Remove a server admin (Owner/Bot Admin)' },
      { cmd: '!setzoorole <name>', desc: 'Set the ZooAdmin role name for this server' }
    ]
  },
  settings: {
    emoji: '🔧',
    name: 'Server Settings',
    description: 'Configure features and notifications for your server',
    color: 0x3498DB,
    commands: [
      { cmd: '!settings', desc: 'View all current server settings' },
      { cmd: '!toggle <feature>', desc: 'Toggle a feature on/off (see list below)' },
      { cmd: '!toggle pingdrops', desc: 'Toggle ping on character drops' },
      { cmd: '!toggle pingevents', desc: 'Toggle ping on events' },
      { cmd: '!toggle pinggiveaways', desc: 'Toggle ping on giveaways' },
      { cmd: '!toggle battles', desc: 'Toggle battle system' },
      { cmd: '!toggle minigames', desc: 'Toggle minigames' },
      { cmd: '!setpingrole <type> @role', desc: 'Set which role gets pinged (drops/events/giveaways/lottery/updates)' }
    ]
  },
  server: {
    emoji: '⚙️',
    name: 'Server Setup',
    description: 'Configure ZooBot channels and game selection',
    color: 0xFF6B6B,
    commands: [
      { cmd: '!setup', desc: 'Start the interactive server setup wizard' },
      { cmd: '!setdropchannel #channel', desc: 'Set the channel for character drops' },
      { cmd: '!seteventschannel #channel', desc: 'Set the channel for event announcements' },
      { cmd: '!setupdateschannel #channel', desc: 'Set the channel for bot updates' },
      { cmd: '!paydrops', desc: 'Activate drops (costs 100 gems for 3 hours)' },
      { cmd: '!dropstatus', desc: 'Check the drop timer status' },
      { cmd: '!revive / !revivedrops', desc: 'Reactivate drops after inactivity' },
      { cmd: '!setgame <name>', desc: 'Set the active game/bundle for this server' },
      { cmd: '!gameinfo [name]', desc: 'View game/bundle information' },
      { cmd: '!bundlechars <name>', desc: 'List characters in a game bundle' }
    ]
  },
  moderation: {
    emoji: '🛡️',
    name: 'Moderation',
    description: 'Manage users and maintain order',
    color: 0xE67E22,
    commands: [
      { cmd: '!warn @user [reason]', desc: 'Issue a warning to a user (ZooAdmin+)' },
      { cmd: '!warnings [@user]', desc: 'View warnings for a user' },
      { cmd: '!clearwarnings @user', desc: 'Clear all warnings for a user (Server Admin+)' },
      { cmd: '!botban @user [reason]', desc: 'Ban user from bot in this server (Server Admin+)' },
      { cmd: '!unbotban @user', desc: 'Unban a user from bot commands (Server Admin+)' },
      { cmd: '!mute @user [duration] [reason]', desc: 'Mute user from bot commands (ZooAdmin+)' },
      { cmd: '!unmute @user', desc: 'Unmute a user (ZooAdmin+)' },
      { cmd: '!clear <count> [@user]', desc: 'Purge messages from the channel' },
      { cmd: '!announce <message>', desc: 'Send a server announcement' },
      { cmd: '!modlogs', desc: 'View moderation action logs' },
      { cmd: '!modstats', desc: 'View moderation statistics' }
    ]
  },
  management: {
    emoji: '👑',
    name: 'Bot Management',
    description: 'Server Owner and Admin controls',
    color: 0x9B59B6,
    commands: [
      { cmd: '!addadmin @user', desc: 'Add a server admin (legacy command)' },
      { cmd: '!removeadmin @user', desc: 'Remove a server admin (legacy command)' },
      { cmd: '!setemoji <char> <emoji>', desc: 'Set custom character emoji' },
      { cmd: '!setchestgif <type> <url>', desc: 'Set custom crate opening GIF' },
      { cmd: '!serverstats / !stats', desc: 'View server analytics' },
      { cmd: '!startgiveaway <mins>', desc: 'Start a manual giveaway' },
      { cmd: '!endgiveaway', desc: 'End the current giveaway' },
      { cmd: '!autogiveaway enable/disable', desc: 'Manage automatic giveaways' },
      { cmd: '!startlottery <duration> <fee> <currency>', desc: 'Start a manual lottery' },
      { cmd: '!stoplottery', desc: 'Stop the current lottery' },
      { cmd: '!autolottery enable/disable <fee> <currency>', desc: 'Manage automatic lottery' }
    ]
  },
  trivia: {
    emoji: '🧠',
    name: 'Trivia & Q&A',
    description: 'Manage trivia and Q&A content',
    color: 0x3498DB,
    commands: [
      { cmd: '!addtrivia ...', desc: 'Add a trivia question' },
      { cmd: '!removetrivia <id>', desc: 'Remove a trivia question' },
      { cmd: '!listtrivia', desc: 'View all trivia questions' },
      { cmd: '!qadd <key> | <message>', desc: 'Add a Q&A entry' },
      { cmd: '!qedit <key> | <message>', desc: 'Edit a Q&A entry' },
      { cmd: '!qdel <key>', desc: 'Delete a Q&A entry' },
      { cmd: '!pendingqa', desc: 'View pending Q&A submissions' },
      { cmd: '!approveqa <ID>', desc: 'Approve a Q&A submission (Bot Admin+)' },
      { cmd: '!rejectqa <ID> [reason]', desc: 'Reject a Q&A submission (Bot Admin+)' }
    ]
  }
};

const SUPER_ADMIN_COMMANDS = {
  economy: {
    name: '💰 Economy Management',
    commands: [
      { cmd: '!grant @user <coins/gems/tokens> [amount]', desc: 'Grant resources to a user' },
      { cmd: '!grantust @user <amount>', desc: 'Grant UST to a user' },
      { cmd: '!removeust @user <amount>', desc: 'Remove UST from a user' },
      { cmd: '!setustrate ...', desc: 'Configure UST exchange rates' },
      { cmd: '!ustrates / !viewustrates', desc: 'View current UST rates' }
    ]
  },
  characters: {
    name: '🦁 Character Management',
    commands: [
      { cmd: '!grantchar @user <char> [ST]', desc: 'Grant a character to a user' },
      { cmd: '!grantkeys @user <char> <amount>', desc: 'Grant character keys to a user' },
      { cmd: '!forcerelease @user <char>', desc: 'Force release a character from user' },
      { cmd: '!grantkeyrush [serverID]', desc: 'Grant free Key Rush to a server' },
      { cmd: '!createchar / !addchar', desc: 'Create a new character' },
      { cmd: '!editchar <name> <field> <value>', desc: 'Edit character details' },
      { cmd: '!removechar <name>', desc: 'Delete a character permanently' },
      { cmd: '!listchars', desc: 'List all characters in database' },
      { cmd: '!setability ...', desc: 'Set character ability' },
      { cmd: '!setmove ...', desc: 'Set character special move' },
      { cmd: '!effecttypes', desc: 'View available ability effect types' }
    ]
  },
  skins: {
    name: '🎨 Skin Management',
    commands: [
      { cmd: '!addskin ...', desc: 'Add a skin to the shop' },
      { cmd: '!updateskin <char> <skin> [url]', desc: 'Update skin image' },
      { cmd: '!grantskin @user <char> <skin>', desc: 'Grant a skin to user' },
      { cmd: '!revokeskin @user <char> <skin>', desc: 'Revoke a skin from user' },
      { cmd: '!deleteskin <char> <skin>', desc: 'Delete a skin from shop' },
      { cmd: '!uploadskin <char> <skin> <rarity> [cost] [url]', desc: 'Upload skin to UST shop' },
      { cmd: '!uploadpfp <name> <rarity> [cost] [url]', desc: 'Upload PFP to shop' },
      { cmd: '!grantpfp <name> @user', desc: 'Grant a PFP to user' },
      { cmd: '!grantpfptoclan <name>', desc: 'Grant PFP to entire clan' },
      { cmd: '!listpfps', desc: 'List all available PFPs' }
    ]
  },
  games: {
    name: '🎮 Game Bundle Management',
    commands: [
      { cmd: '!assigngame <char> <game>', desc: 'Assign character to a game bundle' },
      { cmd: '!bulkassign <game> <char1> <char2> ...', desc: 'Bulk assign characters to game' },
      { cmd: '!importchars <source> <target> [chars...]', desc: 'Import characters between games' },
      { cmd: '!backfillgames', desc: 'Re-apply game data to all characters' },
      { cmd: '!togglegame <name>', desc: 'Toggle game active status' },
      { cmd: '!gamestats', desc: 'View statistics for all games' }
    ]
  },
  work: {
    name: '💼 Work System Management',
    commands: [
      { cmd: '!setworkimage <job> <url>', desc: 'Set custom job image' },
      { cmd: '!showwork <job>', desc: 'View job images' },
      { cmd: '!assignwork @user <job>', desc: 'Assign a job to a user' }
    ]
  },
  anticheat: {
    name: '🛡️ Anti-Cheat & Security',
    commands: [
      { cmd: '!flags @user', desc: 'View anti-cheat flags for user' },
      { cmd: '!clearflags @user', desc: 'Clear user anti-cheat flags' },
      { cmd: '!suspicious [threshold]', desc: 'View users with high flag counts' },
      { cmd: '!transactions @user', desc: 'View user transaction history' },
      { cmd: '!anticheatstats', desc: 'View anti-cheat system statistics' }
    ]
  },
  system: {
    name: '⚙️ System Controls',
    commands: [
      { cmd: '!delete @user [reason]', desc: 'Delete a user account permanently' },
      { cmd: '!postupdate <message>', desc: 'Post an update to all servers' },
      { cmd: '!servers', desc: 'List all servers the bot is in' },
      { cmd: '!removeserver <id>', desc: 'Remove bot from a server' },
      { cmd: '!reset', desc: 'Reset all bot data (DANGEROUS!)' }
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
      .setLabel('Quick Start')
      .setEmoji('📚')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('hub_help')
      .setLabel('All Commands')
      .setEmoji('❓')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('hub_admin')
      .setLabel('Server Admin')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Danger)
  );
  
  return [row1, row2, row3];
}

function createCategoryEmbed(categoryId, user, userData) {
  const category = HUB_CATEGORIES[categoryId];
  if (!category) return null;
  
  const featureList = category.features.map(f => 
    `${f.emoji} **${f.name}**\n└ ${f.desc}${f.command ? ` — \`${f.command}\`` : ''}`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setColor(category.color)
    .setTitle(`${category.emoji} ${category.name}`)
    .setDescription(`${category.description}\n\n${featureList}`)
    .addFields({
      name: '📖 Want More Info?',
      value: 'Click **Know More** below to see ALL commands for this category!',
      inline: false
    })
    .setFooter({ text: 'Click a button below to use that feature or learn more!' })
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
        .setCustomId(`knowmore_${categoryId}`)
        .setLabel('Know More')
        .setEmoji('📖')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('hub_back')
        .setLabel('Back to Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary)
    )
  );
  
  return rows;
}

function createKnowMoreEmbed(categoryId) {
  const category = HUB_CATEGORIES[categoryId];
  if (!category || !category.allCommands) return null;
  
  const commandList = category.allCommands.map(c => 
    `\`${c.cmd}\`\n└ ${c.desc}`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setColor(category.color)
    .setTitle(`📖 ${category.emoji} ${category.name} — Complete Command List`)
    .setDescription(`Here are ALL the commands for **${category.name}**:\n\n${commandList}`)
    .setFooter({ text: `Total: ${category.allCommands.length} commands | Type any command in chat to use it!` })
    .setTimestamp();
  
  return embed;
}

function createKnowMoreButtons(categoryId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hub_${categoryId}`)
        .setLabel(`Back to ${HUB_CATEGORIES[categoryId]?.name || 'Category'}`)
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hub_back')
        .setLabel('Back to Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createAdminHubEmbed(user, serverConfig) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B6B)
    .setTitle('⚙️ Server Owner & ZooAdmin Panel')
    .setDescription('Welcome to the admin panel! Use these tools to configure and manage ZooBot for your server.\n\n**Note:** These commands require the **ZooAdmin** role or server ownership.')
    .addFields(
      {
        name: '📢 Current Channel Settings',
        value: `🎯 **Drop Channel:** ${serverConfig?.dropChannel ? `<#${serverConfig.dropChannel}>` : '❌ Not set'}\n📣 **Events Channel:** ${serverConfig?.eventsChannel ? `<#${serverConfig.eventsChannel}>` : '❌ Not set'}\n📰 **Updates Channel:** ${serverConfig?.updatesChannel ? `<#${serverConfig.updatesChannel}>` : '❌ Not set'}`,
        inline: false
      },
      {
        name: '🎮 Active Game Bundle',
        value: serverConfig?.activeGame || 'Default (All Characters)',
        inline: true
      },
      {
        name: '👥 Bot Admins',
        value: serverConfig?.botAdmins?.length ? `${serverConfig.botAdmins.length} admin(s)` : 'None (Server owner only)',
        inline: true
      },
      {
        name: '💎 Drops Status',
        value: serverConfig?.dropsActive ? '✅ Active' : '❌ Inactive',
        inline: true
      }
    )
    .setFooter({ text: 'Select a category below to view commands' })
    .setTimestamp();
  
  return embed;
}

function createAdminCategoryButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_server')
      .setLabel('Server Setup')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin_moderation')
      .setLabel('Moderation')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('admin_management')
      .setLabel('Bot Management')
      .setEmoji('👑')
      .setStyle(ButtonStyle.Secondary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_trivia')
      .setLabel('Trivia & Q&A')
      .setEmoji('🧠')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin_superadmin')
      .setLabel('Super Admin')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );
  
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hub_back')
      .setLabel('Back to Hub')
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return [row1, row2, row3];
}

function createAdminCategoryEmbed(categoryId) {
  const category = ADMIN_CATEGORIES[categoryId];
  if (!category) return null;
  
  const commandList = category.commands.map(c => 
    `\`${c.cmd}\`\n└ ${c.desc}`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setColor(category.color)
    .setTitle(`${category.emoji} ${category.name}`)
    .setDescription(`${category.description}\n\n${commandList}`)
    .setFooter({ text: `Total: ${category.commands.length} commands | Requires ZooAdmin role or server owner` })
    .setTimestamp();
  
  return embed;
}

function createAdminCategoryBackButtons(categoryId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hub_admin')
        .setLabel('Back to Admin Panel')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hub_back')
        .setLabel('Back to Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createSuperAdminEmbed() {
  let description = '🔒 **Super Admin Commands** are only available to bot owners/super admins.\n\nThese commands manage the entire bot across all servers.\n\n';
  
  for (const [key, section] of Object.entries(SUPER_ADMIN_COMMANDS)) {
    description += `**${section.name}**\n`;
    description += section.commands.slice(0, 3).map(c => `\`${c.cmd}\``).join(', ');
    description += ` *...and ${Math.max(0, section.commands.length - 3)} more*\n\n`;
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🔒 Super Admin Commands')
    .setDescription(description)
    .addFields({
      name: '⚠️ Warning',
      value: 'These commands can permanently affect user data and bot functionality. Use with extreme caution.',
      inline: false
    })
    .setFooter({ text: 'Select a category below for full command list' })
    .setTimestamp();
  
  return embed;
}

function createSuperAdminCategoryButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('superadmin_economy')
      .setLabel('Economy')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('superadmin_characters')
      .setLabel('Characters')
      .setEmoji('🦁')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('superadmin_skins')
      .setLabel('Skins')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Danger)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('superadmin_games')
      .setLabel('Game Bundles')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('superadmin_work')
      .setLabel('Work System')
      .setEmoji('💼')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('superadmin_anticheat')
      .setLabel('Anti-Cheat')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Danger)
  );
  
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('superadmin_system')
      .setLabel('System')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('hub_admin')
      .setLabel('Back')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return [row1, row2, row3];
}

function createSuperAdminCategoryEmbed(categoryId) {
  const category = SUPER_ADMIN_COMMANDS[categoryId];
  if (!category) return null;
  
  const commandList = category.commands.map(c => 
    `\`${c.cmd}\`\n└ ${c.desc}`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`🔒 ${category.name}`)
    .setDescription(`**Super Admin Only**\n\n${commandList}`)
    .setFooter({ text: `Total: ${category.commands.length} commands | SUPER ADMIN ONLY` })
    .setTimestamp();
  
  return embed;
}

function createSuperAdminBackButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_superadmin')
        .setLabel('Back to Super Admin')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('hub_admin')
        .setLabel('Admin Panel')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('hub_back')
        .setLabel('Hub')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
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
  ADMIN_CATEGORIES,
  SUPER_ADMIN_COMMANDS,
  PLAYER_JOURNEY,
  getPlayerJourneyStage,
  getRandomTip,
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
  openHub,
  openCategory,
  openQuickStart,
  handleGuideStep
};
