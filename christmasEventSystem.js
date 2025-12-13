const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getCollection, isMongoConnected } = require('./mongoManager.js');
const { saveDataImmediate } = require('./dataManager.js');

const EVENT_START = new Date('2025-12-15T00:00:00Z').getTime();
const EVENT_END = new Date('2025-12-25T23:59:59Z').getTime();

const CHRISTMAS_PFP_REWARD = {
  id: 'christmas_miracle_2024',
  name: 'Christmas Miracle 2024',
  url: null,
  description: 'Exclusive profile picture for achieving the Christmas Miracle milestone!'
};

const CHRISTMAS_GIFT_DROP_CHANCE = 0.12;
const CHRISTMAS_GIFT_CRATE_CHANCE = {
  bronze: 0.05,
  silver: 0.08,
  gold: 0.12,
  emerald: 0.18,
  legendary: 0.25,
  tyrant: 0.35
};

const COMMUNITY_MILESTONES = [
  { 
    id: 1, 
    giftsRequired: 500, 
    name: 'Festive Start', 
    rewards: { coins: 500, gems: 5 },
    description: 'The community begins gathering gifts!',
    imageKey: 'milestone_1'
  },
  { 
    id: 2, 
    giftsRequired: 2000, 
    name: 'Holiday Spirit', 
    rewards: { coins: 1000, gems: 15, bronzeCrates: 2 },
    description: 'The holiday spirit is growing stronger!',
    imageKey: 'milestone_2'
  },
  { 
    id: 3, 
    giftsRequired: 5000, 
    name: 'Gift Avalanche', 
    rewards: { coins: 2500, gems: 30, silverCrates: 2 },
    description: 'Gifts are piling up everywhere!',
    imageKey: 'milestone_3'
  },
  { 
    id: 4, 
    giftsRequired: 10000, 
    name: 'Winter Wonderland', 
    rewards: { coins: 5000, gems: 50, goldCrates: 1 },
    description: 'A winter wonderland of generosity!',
    imageKey: 'milestone_4'
  },
  { 
    id: 5, 
    giftsRequired: 20000, 
    name: 'Santa\'s Workshop', 
    rewards: { coins: 10000, gems: 75, emeraldCrates: 1 },
    description: 'Santa\'s elves are working overtime!',
    imageKey: 'milestone_5'
  },
  { 
    id: 6, 
    giftsRequired: 35000, 
    name: 'North Pole Magic', 
    rewards: { coins: 20000, gems: 100, legendaryCrates: 1 },
    description: 'The magic of the North Pole is here!',
    imageKey: 'milestone_6'
  },
  { 
    id: 7, 
    giftsRequired: 50000, 
    name: 'Christmas Miracle', 
    rewards: { coins: 50000, gems: 200, tyrantCrates: 1, pfpReward: true },
    description: 'A true Christmas miracle achieved by the community!',
    imageKey: 'milestone_7'
  }
];

const SERVER_MILESTONES = [
  { id: 1, giftsRequired: 50, name: 'Server Gift Box', rewards: { coins: 200, gems: 2 } },
  { id: 2, giftsRequired: 150, name: 'Server Stocking', rewards: { coins: 500, gems: 5, bronzeCrates: 1 } },
  { id: 3, giftsRequired: 400, name: 'Server Tree', rewards: { coins: 1000, gems: 10, silverCrates: 1 } },
  { id: 4, giftsRequired: 800, name: 'Server Sleigh', rewards: { coins: 2000, gems: 20, goldCrates: 1 } },
  { id: 5, giftsRequired: 1500, name: 'Server Santa', rewards: { coins: 5000, gems: 50, emeraldCrates: 1 } }
];

const PERSONAL_MILESTONES = [
  { id: 1, giftsRequired: 5, name: 'Gift Finder', rewards: { coins: 100, gems: 1 } },
  { id: 2, giftsRequired: 15, name: 'Gift Hunter', rewards: { coins: 300, gems: 3 } },
  { id: 3, giftsRequired: 30, name: 'Gift Collector', rewards: { coins: 600, gems: 6, bronzeCrates: 1 } },
  { id: 4, giftsRequired: 50, name: 'Gift Master', rewards: { coins: 1000, gems: 10, silverCrates: 1 } },
  { id: 5, giftsRequired: 100, name: 'Santa\'s Helper', rewards: { coins: 2000, gems: 20, goldCrates: 1 } }
];

async function initializeChristmasEventIndexes() {
  try {
    const collection = await getCollection('christmasEvent');
    await collection.createIndex({ eventId: 1 }, { unique: true });
    await collection.createIndex({ 'servers.serverId': 1 });
    await collection.createIndex({ 'users.userId': 1 });
    console.log('✅ Christmas Event indexes created');
  } catch (error) {
    console.error('Error creating Christmas Event indexes:', error);
  }
}

async function getEventData() {
  try {
    const collection = await getCollection('christmasEvent');
    let eventData = await collection.findOne({ eventId: 'christmas_2024' });
    
    if (!eventData) {
      eventData = {
        eventId: 'christmas_2024',
        totalGifts: 0,
        communityMilestonesReached: [],
        servers: {},
        users: {},
        milestoneImages: {},
        announcementSent: false,
        endAnnouncementSent: false,
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      await collection.insertOne(eventData);
    }
    
    return eventData;
  } catch (error) {
    console.error('Error getting event data:', error);
    return null;
  }
}

function isEventActive() {
  const now = Date.now();
  return now >= EVENT_START && now <= EVENT_END;
}

function getEventTimeRemaining() {
  const now = Date.now();
  if (now < EVENT_START) {
    const timeUntilStart = EVENT_START - now;
    return { started: false, timeRemaining: timeUntilStart };
  }
  if (now > EVENT_END) {
    return { started: true, ended: true, timeRemaining: 0 };
  }
  const timeRemaining = EVENT_END - now;
  return { started: true, ended: false, timeRemaining };
}

async function addChristmasGift(userId, serverId, source = 'drop') {
  if (!isEventActive()) {
    return { success: false, message: 'Event not active' };
  }
  
  try {
    const collection = await getCollection('christmasEvent');
    
    const result = await collection.findOneAndUpdate(
      { eventId: 'christmas_2024' },
      {
        $inc: { 
          totalGifts: 1,
          [`servers.${serverId}.gifts`]: 1,
          [`users.${userId}.gifts`]: 1
        },
        $set: { 
          lastUpdated: new Date(),
          [`servers.${serverId}.lastGift`]: new Date(),
          [`users.${userId}.lastGift`]: new Date()
        },
        $setOnInsert: {
          eventId: 'christmas_2024',
          communityMilestonesReached: [],
          milestoneImages: {},
          announcementSent: false,
          endAnnouncementSent: false,
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    const eventData = result;
    const notifications = [];
    
    const userGifts = eventData.users?.[userId]?.gifts || 1;
    const userMilestone = PERSONAL_MILESTONES.find(m => m.giftsRequired === userGifts);
    if (userMilestone) {
      notifications.push({ type: 'personal', milestone: userMilestone, rewardsPending: true });
    }
    
    const serverGifts = eventData.servers?.[serverId]?.gifts || 1;
    const serverMilestone = SERVER_MILESTONES.find(m => m.giftsRequired === serverGifts);
    if (serverMilestone) {
      notifications.push({ type: 'server', milestone: serverMilestone, serverId: serverId, rewardsPending: true });
    }
    
    const totalGifts = eventData.totalGifts || 1;
    const communityMilestone = COMMUNITY_MILESTONES.find(m => 
      m.giftsRequired === totalGifts && 
      !eventData.communityMilestonesReached?.includes(m.id)
    );
    if (communityMilestone) {
      await collection.updateOne(
        { eventId: 'christmas_2024' },
        { $push: { communityMilestonesReached: communityMilestone.id } }
      );
      notifications.push({ type: 'community', milestone: communityMilestone, rewardsPending: true });
    }
    
    return { 
      success: true, 
      totalGifts,
      userGifts,
      serverGifts,
      notifications,
      userId,
      serverId
    };
  } catch (error) {
    console.error('Error adding Christmas gift:', error);
    return { success: false, error: error.message };
  }
}

async function getUserProgress(userId) {
  try {
    const eventData = await getEventData();
    if (!eventData) return null;
    
    const userGifts = eventData.users?.[userId]?.gifts || 0;
    const currentMilestone = PERSONAL_MILESTONES.findIndex(m => userGifts < m.giftsRequired);
    const nextMilestone = currentMilestone >= 0 ? PERSONAL_MILESTONES[currentMilestone] : null;
    const completedMilestones = PERSONAL_MILESTONES.filter(m => userGifts >= m.giftsRequired);
    
    return {
      gifts: userGifts,
      currentMilestoneIndex: currentMilestone,
      nextMilestone,
      completedMilestones,
      allMilestones: PERSONAL_MILESTONES
    };
  } catch (error) {
    console.error('Error getting user progress:', error);
    return null;
  }
}

async function getServerProgress(serverId) {
  try {
    const eventData = await getEventData();
    if (!eventData) return null;
    
    const serverGifts = eventData.servers?.[serverId]?.gifts || 0;
    const currentMilestone = SERVER_MILESTONES.findIndex(m => serverGifts < m.giftsRequired);
    const nextMilestone = currentMilestone >= 0 ? SERVER_MILESTONES[currentMilestone] : null;
    const completedMilestones = SERVER_MILESTONES.filter(m => serverGifts >= m.giftsRequired);
    
    return {
      gifts: serverGifts,
      currentMilestoneIndex: currentMilestone,
      nextMilestone,
      completedMilestones,
      allMilestones: SERVER_MILESTONES
    };
  } catch (error) {
    console.error('Error getting server progress:', error);
    return null;
  }
}

async function getCommunityProgress() {
  try {
    const eventData = await getEventData();
    if (!eventData) return null;
    
    const totalGifts = eventData.totalGifts || 0;
    const currentMilestone = COMMUNITY_MILESTONES.findIndex(m => totalGifts < m.giftsRequired);
    const nextMilestone = currentMilestone >= 0 ? COMMUNITY_MILESTONES[currentMilestone] : null;
    const completedMilestones = eventData.communityMilestonesReached || [];
    
    return {
      gifts: totalGifts,
      currentMilestoneIndex: currentMilestone,
      nextMilestone,
      completedMilestones: completedMilestones.map(id => COMMUNITY_MILESTONES.find(m => m.id === id)),
      allMilestones: COMMUNITY_MILESTONES,
      milestoneImages: eventData.milestoneImages || {}
    };
  } catch (error) {
    console.error('Error getting community progress:', error);
    return null;
  }
}

function createProgressBar(current, target, length = 20) {
  const percent = Math.min(100, (current / target) * 100);
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  
  const filledChar = '🟩';
  const emptyChar = '⬜';
  
  return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)} ${percent.toFixed(1)}%`;
}

function formatRewards(rewards) {
  const parts = [];
  if (rewards.coins) parts.push(`💰 ${rewards.coins.toLocaleString()} coins`);
  if (rewards.gems) parts.push(`💎 ${rewards.gems} gems`);
  if (rewards.bronzeCrates) parts.push(`🟫 ${rewards.bronzeCrates} Bronze Crate(s)`);
  if (rewards.silverCrates) parts.push(`⚪ ${rewards.silverCrates} Silver Crate(s)`);
  if (rewards.goldCrates) parts.push(`🟡 ${rewards.goldCrates} Gold Crate(s)`);
  if (rewards.emeraldCrates) parts.push(`🟢 ${rewards.emeraldCrates} Emerald Crate(s)`);
  if (rewards.legendaryCrates) parts.push(`🟣 ${rewards.legendaryCrates} Legendary Crate(s)`);
  if (rewards.tyrantCrates) parts.push(`🔴 ${rewards.tyrantCrates} Tyrant Crate(s)`);
  if (rewards.pfpReward) parts.push(`🖼️ Exclusive Profile Picture: ${CHRISTMAS_PFP_REWARD.name}`);
  return parts.join('\n');
}

async function createEventEmbed(userId, serverId, client) {
  const communityProgress = await getCommunityProgress();
  const serverProgress = await getServerProgress(serverId);
  const userProgress = await getUserProgress(userId);
  const timeInfo = getEventTimeRemaining();
  
  let timeText = '';
  if (!timeInfo.started) {
    const days = Math.floor(timeInfo.timeRemaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeInfo.timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    timeText = `🕐 Event starts in: ${days}d ${hours}h`;
  } else if (timeInfo.ended) {
    timeText = '🏁 Event has ended!';
  } else {
    const days = Math.floor(timeInfo.timeRemaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeInfo.timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    timeText = `⏰ Time remaining: ${days}d ${hours}h`;
  }
  
  const embed = new EmbedBuilder()
    .setColor('#C41E3A')
    .setTitle('🎄 Christmas Gift Hunt 2024 🎁')
    .setDescription(`**Collect Christmas Gifts from drops and crates!**\n\n${timeText}\n\n*Gifts can be found in drops and crates with a special chance!*`);
  
  if (communityProgress) {
    let communityText = `🎁 **Total Gifts:** ${communityProgress.gifts.toLocaleString()}\n`;
    if (communityProgress.nextMilestone) {
      communityText += `\n**Next Milestone:** ${communityProgress.nextMilestone.name}\n`;
      communityText += createProgressBar(communityProgress.gifts, communityProgress.nextMilestone.giftsRequired);
      communityText += `\n${communityProgress.gifts.toLocaleString()} / ${communityProgress.nextMilestone.giftsRequired.toLocaleString()}`;
    } else {
      communityText += '\n🏆 **All milestones completed!**';
    }
    embed.addFields({ name: '🌍 Community Progress', value: communityText, inline: false });
  }
  
  if (serverProgress) {
    let serverText = `🎁 **Server Gifts:** ${serverProgress.gifts.toLocaleString()}\n`;
    if (serverProgress.nextMilestone) {
      serverText += `\n**Next:** ${serverProgress.nextMilestone.name}\n`;
      serverText += createProgressBar(serverProgress.gifts, serverProgress.nextMilestone.giftsRequired, 15);
      serverText += `\n${serverProgress.gifts.toLocaleString()} / ${serverProgress.nextMilestone.giftsRequired.toLocaleString()}`;
    } else {
      serverText += '\n🏆 **All server milestones completed!**';
    }
    embed.addFields({ name: '🏠 Server Progress', value: serverText, inline: true });
  }
  
  if (userProgress) {
    let userText = `🎁 **Your Gifts:** ${userProgress.gifts.toLocaleString()}\n`;
    if (userProgress.nextMilestone) {
      userText += `\n**Next:** ${userProgress.nextMilestone.name}\n`;
      userText += createProgressBar(userProgress.gifts, userProgress.nextMilestone.giftsRequired, 15);
      userText += `\n${userProgress.gifts.toLocaleString()} / ${userProgress.nextMilestone.giftsRequired.toLocaleString()}`;
    } else {
      userText += '\n🏆 **All personal milestones completed!**';
    }
    embed.addFields({ name: '👤 Your Progress', value: userText, inline: true });
  }
  
  embed.setFooter({ text: 'Collect gifts from drops (!c) and crates (!pickcrate) | Dec 15-25' });
  embed.setTimestamp();
  
  return embed;
}

async function createMilestonesEmbed(type = 'community') {
  const milestones = type === 'community' ? COMMUNITY_MILESTONES : 
                     type === 'server' ? SERVER_MILESTONES : 
                     PERSONAL_MILESTONES;
  
  const progress = type === 'community' ? await getCommunityProgress() :
                   type === 'server' ? await getServerProgress() :
                   await getUserProgress();
  
  const currentGifts = progress?.gifts || 0;
  const completedIds = progress?.completedMilestones?.map(m => m?.id) || [];
  
  const embed = new EmbedBuilder()
    .setColor('#C41E3A')
    .setTitle(`🎄 Christmas Event - ${type.charAt(0).toUpperCase() + type.slice(1)} Milestones`);
  
  let description = '';
  for (const milestone of milestones) {
    const isCompleted = type === 'community' 
      ? completedIds.includes(milestone.id)
      : currentGifts >= milestone.giftsRequired;
    
    const status = isCompleted ? '✅' : '⏳';
    description += `${status} **${milestone.name}** - ${milestone.giftsRequired.toLocaleString()} gifts\n`;
    description += `${formatRewards(milestone.rewards)}\n\n`;
  }
  
  embed.setDescription(description);
  embed.setFooter({ text: 'Collect gifts to unlock rewards!' });
  
  return embed;
}

function applyRewardsToUser(user, rewards) {
  if (rewards.coins) user.coins = (user.coins || 0) + rewards.coins;
  if (rewards.gems) user.gems = (user.gems || 0) + rewards.gems;
  if (rewards.bronzeCrates) user.bronzeCrates = (user.bronzeCrates || 0) + rewards.bronzeCrates;
  if (rewards.silverCrates) user.silverCrates = (user.silverCrates || 0) + rewards.silverCrates;
  if (rewards.goldCrates) user.goldCrates = (user.goldCrates || 0) + rewards.goldCrates;
  if (rewards.emeraldCrates) user.emeraldCrates = (user.emeraldCrates || 0) + rewards.emeraldCrates;
  if (rewards.legendaryCrates) user.legendaryCrates = (user.legendaryCrates || 0) + rewards.legendaryCrates;
  if (rewards.tyrantCrates) user.tyrantCrates = (user.tyrantCrates || 0) + rewards.tyrantCrates;
  
  if (rewards.pfpReward) {
    if (!user.pfp) {
      user.pfp = { ownedPfps: [], equippedPfp: null };
    }
    const existingPfp = user.pfp.ownedPfps.find(p => p.id === CHRISTMAS_PFP_REWARD.id);
    if (!existingPfp) {
      user.pfp.ownedPfps.push({
        id: CHRISTMAS_PFP_REWARD.id,
        name: CHRISTMAS_PFP_REWARD.name,
        url: CHRISTMAS_PFP_REWARD.url,
        addedAt: Date.now(),
        source: 'christmas_event_2024'
      });
    }
  }
}

async function distributeMilestoneRewards(client, data, milestone, type, targetId = null, serverMembers = null) {
  const rewards = milestone.rewards;
  
  if (type === 'community') {
    for (const userId in data.users) {
      const user = data.users[userId];
      if (user) {
        applyRewardsToUser(user, rewards);
      }
    }
    await saveDataImmediate(data);
  } else if (type === 'personal' && targetId) {
    const user = data.users[targetId];
    if (user) {
      applyRewardsToUser(user, rewards);
      await saveDataImmediate(data);
    }
  } else if (type === 'server' && serverMembers) {
    for (const userId of serverMembers) {
      const user = data.users[userId];
      if (user) {
        applyRewardsToUser(user, rewards);
      }
    }
    await saveDataImmediate(data);
  }
  
  return true;
}

async function setMilestoneImage(milestoneId, imageUrl) {
  try {
    const collection = await getCollection('christmasEvent');
    await collection.updateOne(
      { eventId: 'christmas_2024' },
      { $set: { [`milestoneImages.milestone_${milestoneId}`]: imageUrl } },
      { upsert: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error setting milestone image:', error);
    return { success: false, error: error.message };
  }
}

async function getMilestoneImage(milestoneId) {
  try {
    const eventData = await getEventData();
    return eventData?.milestoneImages?.[`milestone_${milestoneId}`] || null;
  } catch (error) {
    return null;
  }
}

async function setAnnouncementImage(imageUrl) {
  try {
    const collection = await getCollection('christmasEvent');
    await collection.updateOne(
      { eventId: 'christmas_2024' },
      { $set: { announcementBannerUrl: imageUrl } },
      { upsert: true }
    );
    return { success: true };
  } catch (error) {
    console.error('Error setting announcement image:', error);
    return { success: false, error: error.message };
  }
}

async function getAnnouncementImage() {
  try {
    const eventData = await getEventData();
    return eventData?.announcementBannerUrl || null;
  } catch (error) {
    return null;
  }
}

async function setPfpRewardImage(imageUrl) {
  try {
    const collection = await getCollection('christmasEvent');
    await collection.updateOne(
      { eventId: 'christmas_2024' },
      { $set: { pfpRewardUrl: imageUrl } },
      { upsert: true }
    );
    CHRISTMAS_PFP_REWARD.url = imageUrl;
    return { success: true };
  } catch (error) {
    console.error('Error setting PFP reward image:', error);
    return { success: false, error: error.message };
  }
}

async function getPfpRewardImage() {
  try {
    const eventData = await getEventData();
    return eventData?.pfpRewardUrl || null;
  } catch (error) {
    return null;
  }
}

async function sendEventAnnouncement(client, data) {
  const eventData = await getEventData();
  if (eventData?.announcementSent) return;
  
  const bannerUrl = await getAnnouncementImage();
  
  const embed = new EmbedBuilder()
    .setColor('#C41E3A')
    .setTitle('🎄🎁 CHRISTMAS GIFT HUNT 2025 HAS BEGUN! 🎁🎄')
    .setDescription(`**The most wonderful time of the year is here!**

From **December 15th to December 25th**, collect special **Christmas Gifts** 🎁 from drops and crates!

**🌍 Community Milestones:**
Work together as a global community to unlock rewards for EVERYONE!
7 amazing milestones with increasing rewards!

**🏠 Server Milestones:**
Each server has its own progress bar with 5 milestones!

**👤 Personal Milestones:**
Track your own gift collection with 5 personal milestones!

**How to get gifts:**
• 🎯 **Drops** - Christmas gifts appear in regular drops!
• 📦 **Crates** - Open any crate for a chance at a gift!

Use \`!christmas\` or \`!xmas\` to check progress!

**Happy Holidays! 🎅🎄**`)
    .setFooter({ text: 'Event: December 15-25, 2025' })
    .setTimestamp();
  
  if (bannerUrl) {
    embed.setImage(bannerUrl);
  }
  
  for (const guild of client.guilds.cache.values()) {
    try {
      const channel = guild.channels.cache.find(ch => 
        ch.isTextBased() && ch.permissionsFor(guild.members.me)?.has(['SendMessages'])
      );
      
      if (channel) {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {
      console.log(`Could not send announcement to ${guild.name}`);
    }
  }
  
  for (const usrId in data.users) {
    try {
      const user = await client.users.fetch(usrId).catch(() => null);
      if (user) {
        await user.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {}
  }
  
  const collection = await getCollection('christmasEvent');
  await collection.updateOne(
    { eventId: 'christmas_2024' },
    { $set: { announcementSent: true } },
    { upsert: true }
  );
}

async function checkAndTriggerAnnouncement(client, data) {
  const now = Date.now();
  
  if (now >= EVENT_START && now <= EVENT_END) {
    const eventData = await getEventData();
    if (!eventData?.announcementSent) {
      await sendEventAnnouncement(client, data);
    }
  }
}

function shouldDropChristmasGift(source = 'drop', crateType = null) {
  if (!isEventActive()) return false;
  
  if (source === 'drop') {
    return Math.random() < CHRISTMAS_GIFT_DROP_CHANCE;
  } else if (source === 'crate' && crateType) {
    const chance = CHRISTMAS_GIFT_CRATE_CHANCE[crateType] || 0.05;
    return Math.random() < chance;
  }
  
  return false;
}

async function createCommunityMilestoneAnnouncement(client, data, milestone) {
  const imageUrl = await getMilestoneImage(milestone.id);
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🎉🎄 COMMUNITY MILESTONE REACHED! 🎄🎉`)
    .setDescription(`**${milestone.name}**\n\n${milestone.description}\n\nThe community collected **${milestone.giftsRequired.toLocaleString()}** Christmas gifts!\n\n**Everyone who has started receives:**\n${formatRewards(milestone.rewards)}`)
    .setFooter({ text: 'Christmas Gift Hunt 2024' })
    .setTimestamp();
  
  if (imageUrl) {
    embed.setImage(imageUrl);
  }
  
  await distributeMilestoneRewards(client, data, milestone, 'community');
  
  for (const guild of client.guilds.cache.values()) {
    try {
      const channel = guild.channels.cache.find(ch => 
        ch.isTextBased() && ch.permissionsFor(guild.members.me)?.has(['SendMessages'])
      );
      
      if (channel) {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {}
  }
}

async function getEventLeaderboard(type = 'users', limit = 10) {
  try {
    const eventData = await getEventData();
    if (!eventData) return [];
    
    if (type === 'users') {
      const users = Object.entries(eventData.users || {})
        .map(([userId, data]) => ({ userId, gifts: data.gifts || 0 }))
        .sort((a, b) => b.gifts - a.gifts)
        .slice(0, limit);
      return users;
    } else if (type === 'servers') {
      const servers = Object.entries(eventData.servers || {})
        .map(([serverId, data]) => ({ serverId, gifts: data.gifts || 0 }))
        .sort((a, b) => b.gifts - a.gifts)
        .slice(0, limit);
      return servers;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

module.exports = {
  EVENT_START,
  EVENT_END,
  COMMUNITY_MILESTONES,
  SERVER_MILESTONES,
  PERSONAL_MILESTONES,
  CHRISTMAS_GIFT_DROP_CHANCE,
  CHRISTMAS_GIFT_CRATE_CHANCE,
  CHRISTMAS_PFP_REWARD,
  initializeChristmasEventIndexes,
  getEventData,
  isEventActive,
  getEventTimeRemaining,
  addChristmasGift,
  getUserProgress,
  getServerProgress,
  getCommunityProgress,
  createProgressBar,
  formatRewards,
  createEventEmbed,
  createMilestonesEmbed,
  distributeMilestoneRewards,
  setMilestoneImage,
  getMilestoneImage,
  setAnnouncementImage,
  getAnnouncementImage,
  setPfpRewardImage,
  getPfpRewardImage,
  sendEventAnnouncement,
  checkAndTriggerAnnouncement,
  shouldDropChristmasGift,
  createCommunityMilestoneAnnouncement,
  getEventLeaderboard
};
