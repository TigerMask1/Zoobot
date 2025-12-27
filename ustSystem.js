const { EmbedBuilder } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');

const UST_RATES = {
  firstPlace: 50,
  secondPlace: 25,
  thirdPlace: 10,
  minimumPool: 200
};

function initializeUSTData(userData) {
  if (userData.ust === undefined) {
    userData.ust = 0;
  }
  return userData.ust;
}

async function grantUST(data, userId, amount, reason = 'Admin grant') {
  if (!data.users[userId]) {
    return {
      success: false,
      message: '❌ User not found!'
    };
  }
  
  initializeUSTData(data.users[userId]);
  data.users[userId].ust += amount;
  await saveDataImmediate(data);
  
  return {
    success: true,
    message: `✅ Granted **${amount} UST** to user!\nReason: ${reason}\nNew balance: **${data.users[userId].ust} UST**`,
    newBalance: data.users[userId].ust
  };
}

async function removeUST(data, userId, amount, reason = 'Admin removal') {
  if (!data.users[userId]) {
    return {
      success: false,
      message: '❌ User not found!'
    };
  }
  
  initializeUSTData(data.users[userId]);
  
  if (data.users[userId].ust < amount) {
    return {
      success: false,
      message: `❌ User doesn't have enough UST! Current balance: ${data.users[userId].ust} UST`
    };
  }
  
  data.users[userId].ust -= amount;
  await saveDataImmediate(data);
  
  return {
    success: true,
    message: `✅ Removed **${amount} UST** from user!\nReason: ${reason}\nNew balance: **${data.users[userId].ust} UST**`,
    newBalance: data.users[userId].ust
  };
}

function getUSTBalance(data, userId) {
  if (!data.users[userId]) {
    return null;
  }
  
  initializeUSTData(data.users[userId]);
  return data.users[userId].ust;
}

function setUSTRate(rateType, amount) {
  if (rateType in UST_RATES) {
    UST_RATES[rateType] = amount;
    return {
      success: true,
      message: `✅ Updated **${rateType}** UST rate to **${amount} UST**`,
      rates: UST_RATES
    };
  }
  
  return {
    success: false,
    message: `❌ Invalid rate type! Available: firstPlace, secondPlace, thirdPlace, minimumPool`,
    rates: UST_RATES
  };
}

function getUSTRates() {
  return {
    ...UST_RATES,
    description: 'Current UST reward rates for clan wars'
  };
}

async function distributeUSTRewards(client, data, clanRankings) {
  const ustDistribution = [
    UST_RATES.firstPlace,
    UST_RATES.secondPlace,
    UST_RATES.thirdPlace
  ];
  
  const rewards = [];
  
  for (let i = 0; i < Math.min(clanRankings.length, 3); i++) {
    const clan = clanRankings[i];
    const baseUstReward = ustDistribution[i];
    
    clan.lastWeekUSTReward = baseUstReward;
    
    const memberCount = Object.keys(clan.members).length;
    if (memberCount === 0) continue;
    
    // Total pool for this clan is based on the rank
    // Each member gets the base amount for their rank
    for (const userId in clan.members) {
      const member = clan.members[userId];
      
      // Only reward members who were active this week
      if (member.weeklyContribution === 0) continue;
      
      const ustAmount = baseUstReward;
      
      if (data.users[userId]) {
        initializeUSTData(data.users[userId]);
        data.users[userId].ust += ustAmount;
        
        rewards.push({
          userId,
          ustAmount,
          rank: i + 1,
          contribution: member.weeklyContribution
        });
        
        try {
          const user = await client.users.fetch(userId);
          const ustEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🌟 Clan Wars UST Reward!')
            .setDescription(`Your clan ranked **#${i + 1}** this week and earned **Universal Skin Tokens**!`)
            .addFields(
              { name: '🌟 UST Earned', value: `${ustAmount} UST`, inline: true },
              { name: '📊 Your Contribution', value: `${member.weeklyContribution.toLocaleString()} points`, inline: true },
              { name: '💼 Total UST Balance', value: `${data.users[userId].ust} UST`, inline: true }
            )
            .setFooter({ text: 'Use UST to buy exclusive skins and profile pictures in the shop!' })
            .setTimestamp();
          
          await user.send({ embeds: [ustEmbed] }).catch(() => {
            console.log(`Could not DM UST reward to user ${userId}`);
          });
        } catch (error) {
          console.log(`Error sending UST reward to user ${userId}:`, error.message);
        }
      }
    }
  }
  
  return rewards;
}

function formatUSTBalance(userData, username) {
  initializeUSTData(userData);
  
  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle(`🌟 ${username}'s UST Balance`)
    .setDescription(`**Universal Skin Tokens (UST)** are premium currency earned from Clan Wars!`)
    .addFields(
      { name: '💼 Your Balance', value: `**${userData.ust} UST**`, inline: false },
      { name: '🛍️ How to Use', value: 'Purchase exclusive skins and profile pictures in the shop with `!shop`', inline: false },
      { name: '🏆 How to Earn', value: 'Compete in Clan Wars! Top 3 clans earn UST based on their rank and your contribution.', inline: false }
    )
    .setFooter({ text: '🥇 1st: 100 UST | 🥈 2nd: 60 UST | 🥉 3rd: 40 UST' });
  
  return embed;
}

module.exports = {
  initializeUSTData,
  grantUST,
  removeUST,
  getUSTBalance,
  setUSTRate,
  getUSTRates,
  distributeUSTRewards,
  formatUSTBalance,
  UST_RATES
};
