const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveDataImmediate } = require('./dataManager.js');
const { isMainServer } = require('./serverConfigManager.js');

const activeGames = new Map();

const COOLDOWNS = new Map();
const COOLDOWN_TIME = 10000; // 10 seconds between games

function applyMainServerBonus(profit, serverId) {
  if (isMainServer(serverId)) {
    return Math.floor(profit * 1.3); // 30% bonus to profit only
  }
  return profit;
}

function checkCooldown(userId, gameName) {
  const key = `${userId}_${gameName}`;
  const now = Date.now();
  
  if (COOLDOWNS.has(key)) {
    const lastPlayed = COOLDOWNS.get(key);
    const timeLeft = COOLDOWN_TIME - (now - lastPlayed);
    
    if (timeLeft > 0) {
      return { onCooldown: true, timeLeft: Math.ceil(timeLeft / 1000) };
    }
  }
  
  COOLDOWNS.set(key, now);
  return { onCooldown: false };
}

async function coinDuel(message, args, data) {
  const userId = message.author.id;
  const serverId = message.guild?.id;
  const userData = data.users[userId];
  
  const cooldown = checkCooldown(userId, 'coinduel');
  if (cooldown.onCooldown) {
    return message.reply(`⏰ Cooldown! Wait ${cooldown.timeLeft}s before playing again.`);
  }
  
  if (!args[0] || !args[1]) {
    return message.reply('Usage: `!coinduel <heads/tails> <bet amount>`\n\n**How to play:**\n• Pick heads or tails\n• Bet coins (minimum 10)\n• Win ×1.9 coins on correct guess (47% chance)\n• 2% chance of 🪙 **Golden Flip** for ×3.5 payout!');
  }
  
  const choice = args[0].toLowerCase();
  const betAmount = parseInt(args[1]);
  
  if (choice !== 'heads' && choice !== 'tails') {
    return message.reply('❌ Choose either `heads` or `tails`!');
  }
  
  if (isNaN(betAmount) || betAmount < 10) {
    return message.reply('❌ Minimum bet is 10 coins!');
  }
  
  if ((userData.coins || 0) < betAmount) {
    return message.reply(`❌ You don't have enough coins!\n💰 Your balance: ${userData.coins || 0} coins`);
  }
  
  userData.coins -= betAmount;
  
  const roll = Math.random() * 100;
  const isGoldenFlip = roll < 2; // 2% chance
  const won = roll < 49; // 47% regular + 2% golden = 49% total win chance
  // Generate coin result: if they won, it matches their choice; if lost, it's opposite
  const correctGuess = won ? choice : (choice === 'heads' ? 'tails' : 'heads');
  
  let winAmount = 0;
  let profit = 0;
  let resultEmoji = '';
  let title = '';
  
  if (won) {
    if (isGoldenFlip) {
      profit = Math.floor(betAmount * 2.5); // 3.5x total = 2.5x profit
      const mainBonus = applyMainServerBonus(profit, serverId);
      winAmount = betAmount + mainBonus;
      resultEmoji = '🪙';
      title = '🪙 GOLDEN FLIP! HUGE WIN!';
    } else {
      profit = Math.floor(betAmount * 0.9); // 1.9x total = 0.9x profit
      const mainBonus = applyMainServerBonus(profit, serverId);
      winAmount = betAmount + mainBonus;
      resultEmoji = '🎉';
      title = '🎉 YOU WON!';
    }
    userData.coins += winAmount;
  } else {
    resultEmoji = '❌';
    title = '❌ YOU LOST!';
  }
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor(won ? '#00FF00' : '#FF0000')
    .setTitle(title)
    .setDescription(`${resultEmoji} The coin landed on **${correctGuess.toUpperCase()}**!\n\nYou picked: **${choice.toUpperCase()}**\n${isGoldenFlip ? '✨ **GOLDEN FLIP BONUS!** ✨\n' : ''}\n**Bet:** ${betAmount} 💰\n**${won ? 'Won' : 'Lost'}:** ${won ? `+${winAmount - betAmount}` : betAmount} 💰\n\n💰 **New Balance:** ${userData.coins} coins`)
    .setFooter({ text: isMainServer(serverId) ? '⭐ Main Server - 30% profit bonus!' : 'Play on main server for profit bonus!' });
  
  return message.reply({ embeds: [embed] });
}

async function diceClash(message, args, data) {
  const userId = message.author.id;
  const serverId = message.guild?.id;
  const userData = data.users[userId];
  
  const cooldown = checkCooldown(userId, 'diceclash');
  if (cooldown.onCooldown) {
    return message.reply(`⏰ Cooldown! Wait ${cooldown.timeLeft}s before playing again.`);
  }
  
  if (!args[0]) {
    return message.reply('Usage: `!diceclash <bet amount>`\n\n**How to play:**\n• Bet coins and roll dice\n• Roll 4-6: Win and continue with higher multiplier\n• Roll 1-3: Lose everything\n• Cash out anytime with buttons!\n• Max 5 rounds for big wins!');
  }
  
  const betAmount = parseInt(args[0]);
  
  if (isNaN(betAmount) || betAmount < 10) {
    return message.reply('❌ Minimum bet is 10 coins!');
  }
  
  if ((userData.coins || 0) < betAmount) {
    return message.reply(`❌ You don't have enough coins!\n💰 Your balance: ${userData.coins || 0} coins`);
  }
  
  userData.coins -= betAmount;
  await saveDataImmediate(data);
  
  const gameId = `${userId}_${Date.now()}`;
  activeGames.set(gameId, {
    userId,
    betAmount,
    currentMultiplier: 1.2,
    round: 1,
    serverId
  });
  
  const roll = Math.floor(Math.random() * 6) + 1;
  const won = roll >= 4;
  
  if (!won) {
    activeGames.delete(gameId);
    
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🎲 DICE CLASH - BUSTED!')
      .setDescription(`You rolled: **${roll}** 🎲\n\n❌ You needed 4-6 to win!\n\n**Lost:** ${betAmount} 💰\n💰 **Balance:** ${userData.coins} coins`)
      .setFooter({ text: 'Better luck next time!' });
    
    return message.reply({ embeds: [embed] });
  }
  
  const profit = Math.floor(betAmount * 0.2);
  const mainBonus = applyMainServerBonus(profit, serverId);
  const currentWinnings = betAmount + mainBonus;
  
  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎲 DICE CLASH - Round 1')
    .setDescription(`You rolled: **${roll}** 🎲\n\n✅ You won!\n\n**Current Winnings:** ${currentWinnings} 💰 (profit: +${mainBonus})\n**Next Multiplier:** ×1.5\n\n🎰 **Cash out now or risk it for more?**`)
    .setFooter({ text: `Round 1/5 | ${isMainServer(serverId) ? '⭐ Main Server Bonus Active!' : ''}` });
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`diceclash_continue_${gameId}`)
        .setLabel('🎲 Roll Again')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`diceclash_cashout_${gameId}`)
        .setLabel('💰 Cash Out')
        .setStyle(ButtonStyle.Success)
    );
  
  return message.reply({ embeds: [embed], components: [row] });
}

async function doorOfFate(message, args, data) {
  const userId = message.author.id;
  const serverId = message.guild?.id;
  const userData = data.users[userId];
  
  const cooldown = checkCooldown(userId, 'dooroffate');
  if (cooldown.onCooldown) {
    return message.reply(`⏰ Cooldown! Wait ${cooldown.timeLeft}s before playing again.`);
  }
  
  if (!args[0]) {
    return message.reply('Usage: `!dooroffate <bet amount>`\n\n**How to play:**\n• Bet coins and pick a door (1, 2, or 3)\n• 🚪 30% chance - Big Win (×1.8)\n• 🚪 40% chance - Small Win (break even)\n• 🚪 30% chance - Lose All\n• High risk, decent reward!');
  }
  
  const betAmount = parseInt(args[0]);
  
  if (isNaN(betAmount) || betAmount < 10) {
    return message.reply('❌ Minimum bet is 10 coins!');
  }
  
  if ((userData.coins || 0) < betAmount) {
    return message.reply(`❌ You don't have enough coins!\n💰 Your balance: ${userData.coins || 0} coins`);
  }
  
  userData.coins -= betAmount;
  await saveDataImmediate(data);
  
  const gameId = `${userId}_${Date.now()}`;
  activeGames.set(gameId, {
    userId,
    betAmount,
    serverId,
    doors: shuffleDoors()
  });
  
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🚪 DOOR OF FATE')
    .setDescription(`You've bet **${betAmount} 💰**\n\n**Choose your fate:**\n🚪 **Door 1** - Mystery awaits...\n🚪 **Door 2** - What's behind here?\n🚪 **Door 3** - Take the risk?\n\n**Possible outcomes:**\n✅ Big Win (×1.8)\n⚠️ Break Even (×1.0)\n❌ Lose All`)
    .setFooter({ text: 'Click a button to choose your door!' });
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`door_1_${gameId}`)
        .setLabel('🚪 Door 1')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`door_2_${gameId}`)
        .setLabel('🚪 Door 2')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`door_3_${gameId}`)
        .setLabel('🚪 Door 3')
        .setStyle(ButtonStyle.Primary)
    );
  
  return message.reply({ embeds: [embed], components: [row] });
}

function shuffleDoors() {
  const outcomes = ['bigwin', 'breakeven', 'lose'];
  for (let i = 0; i < 10; i++) {
    const roll = Math.random();
    if (roll < 0.3) return [shuffle(['bigwin', 'breakeven', 'lose'])];
    if (roll < 0.7) return [shuffle(['breakeven', 'lose', 'lose'])];
    return [shuffle(['bigwin', 'lose', 'lose'])];
  }
  return shuffle(['bigwin', 'breakeven', 'lose']);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function almostWinMachine(message, args, data) {
  const userId = message.author.id;
  const serverId = message.guild?.id;
  const userData = data.users[userId];
  
  const cooldown = checkCooldown(userId, 'almostwin');
  if (cooldown.onCooldown) {
    return message.reply(`⏰ Cooldown! Wait ${cooldown.timeLeft}s before playing again.`);
  }
  
  if (!args[0]) {
    return message.reply('Usage: `!almostwin <bet amount>`\n\n**How to play:**\n• Roll a number between 1-100\n• 🎯 95-100: JACKPOT! (×4)\n• 🎉 80-94: Big Win (×2)\n• ✅ 55-79: Medium Win (×1.2)\n• ⚠️ 35-54: Small Win (×0.6)\n• ❌ 1-34: Lose\n• So close... try again!');
  }
  
  const betAmount = parseInt(args[0]);
  
  if (isNaN(betAmount) || betAmount < 10) {
    return message.reply('❌ Minimum bet is 10 coins!');
  }
  
  if ((userData.coins || 0) < betAmount) {
    return message.reply(`❌ You don't have enough coins!\n💰 Your balance: ${userData.coins || 0} coins`);
  }
  
  userData.coins -= betAmount;
  
  const roll = Math.floor(Math.random() * 100) + 1;
  
  let result, color, profit, winAmount;
  
  if (roll >= 95) {
    result = '🎯 JACKPOT!!!';
    color = '#FFD700';
    profit = Math.floor(betAmount * 3); // 4x total = 3x profit
    const mainBonus = applyMainServerBonus(profit, serverId);
    winAmount = betAmount + mainBonus;
  } else if (roll >= 80) {
    result = '🎉 BIG WIN!';
    color = '#00FF00';
    profit = betAmount; // 2x total = 1x profit
    const mainBonus = applyMainServerBonus(profit, serverId);
    winAmount = betAmount + mainBonus;
  } else if (roll >= 55) {
    result = '✅ Medium Win!';
    color = '#32CD32';
    profit = Math.floor(betAmount * 0.2); // 1.2x total = 0.2x profit
    const mainBonus = applyMainServerBonus(profit, serverId);
    winAmount = betAmount + mainBonus;
  } else if (roll >= 35) {
    result = '⚠️ Small Win';
    color = '#FFA500';
    winAmount = Math.floor(betAmount * 0.6); // Partial return
    profit = -Math.floor(betAmount * 0.4); // Actually a loss
  } else {
    result = '❌ Lost!';
    color = '#FF0000';
    winAmount = 0;
    profit = -betAmount;
  }
  
  userData.coins += winAmount;
  await saveDataImmediate(data);
  
  const nearMiss = roll >= 30 && roll < 35 ? '\n\n😱 **SO CLOSE!** You were just a few numbers away!' :
                  roll >= 90 && roll < 95 ? '\n\n😱 **ALMOST JACKPOT!** You were so close!' : '';
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎰 ALMOST-WIN MACHINE')
    .setDescription(`You rolled: **${roll}/100**\n\n${result}${nearMiss}\n\n**Bet:** ${betAmount} 💰\n**${profit >= 0 ? 'Profit' : 'Lost'}:** ${profit >= 0 ? `+${profit}` : profit} 💰\n\n💰 **New Balance:** ${userData.coins} coins`)
    .setFooter({ text: isMainServer(serverId) ? '⭐ Main Server - 30% profit bonus!' : 'Try again!' });
  
  return message.reply({ embeds: [embed] });
}

async function rockPaperScissors(message, args, data) {
  const userId = message.author.id;
  const serverId = message.guild?.id;
  const userData = data.users[userId];
  
  const cooldown = checkCooldown(userId, 'rps');
  if (cooldown.onCooldown) {
    return message.reply(`⏰ Cooldown! Wait ${cooldown.timeLeft}s before playing again.`);
  }
  
  if (!args[0] || !args[1]) {
    return message.reply('Usage: `!rps <rock/paper/scissors> <bet amount>`\n\n**How to play:**\n• Choose rock, paper, or scissors\n• Bet coins\n• Win ×1.8 coins if you beat the bot\n• Tie = bet refunded\n• 3% chance for ×2.5 **Critical Win**!');
  }
  
  const choice = args[0].toLowerCase();
  const betAmount = parseInt(args[1]);
  
  if (!['rock', 'paper', 'scissors'].includes(choice)) {
    return message.reply('❌ Choose `rock`, `paper`, or `scissors`!');
  }
  
  if (isNaN(betAmount) || betAmount < 10) {
    return message.reply('❌ Minimum bet is 10 coins!');
  }
  
  if ((userData.coins || 0) < betAmount) {
    return message.reply(`❌ You don't have enough coins!\n💰 Your balance: ${userData.coins || 0} coins`);
  }
  
  userData.coins -= betAmount;
  
  const choices = ['rock', 'paper', 'scissors'];
  const botChoice = choices[Math.floor(Math.random() * 3)];
  
  const emojis = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️'
  };
  
  let result, color, winAmount = 0, profit = 0;
  const isCritical = Math.random() < 0.03;
  
  if (choice === botChoice) {
    result = '🤝 TIE!';
    color = '#FFA500';
    winAmount = betAmount;
    userData.coins += winAmount;
  } else if (
    (choice === 'rock' && botChoice === 'scissors') ||
    (choice === 'paper' && botChoice === 'rock') ||
    (choice === 'scissors' && botChoice === 'paper')
  ) {
    if (isCritical) {
      result = '⚡ CRITICAL WIN!';
      color = '#FFD700';
      profit = Math.floor(betAmount * 1.5); // 2.5x total = 1.5x profit
      const mainBonus = applyMainServerBonus(profit, serverId);
      winAmount = betAmount + mainBonus;
    } else {
      result = '🎉 YOU WIN!';
      color = '#00FF00';
      profit = Math.floor(betAmount * 0.8); // 1.8x total = 0.8x profit
      const mainBonus = applyMainServerBonus(profit, serverId);
      winAmount = betAmount + mainBonus;
    }
    userData.coins += winAmount;
  } else {
    result = '❌ YOU LOSE!';
    color = '#FF0000';
    profit = -betAmount;
  }
  
  await saveDataImmediate(data);
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎮 ROCK PAPER SCISSORS')
    .setDescription(`${emojis[choice]} You: **${choice.toUpperCase()}**\n${emojis[botChoice]} Bot: **${botChoice.toUpperCase()}**\n\n${result}${isCritical ? '\n✨ **CRITICAL HIT BONUS!** ✨' : ''}\n\n**Bet:** ${betAmount} 💰\n**${result.includes('WIN') ? 'Profit' : result.includes('TIE') ? 'Refunded' : 'Lost'}:** ${result.includes('WIN') ? `+${winAmount - betAmount}` : result.includes('TIE') ? betAmount : betAmount} 💰\n\n💰 **New Balance:** ${userData.coins} coins`)
    .setFooter({ text: isMainServer(serverId) ? '⭐ Main Server - 30% profit bonus!' : 'Play on main server for profit bonus!' });
  
  return message.reply({ embeds: [embed] });
}

async function handleDiceClashButton(interaction, data) {
  const [action, type, gameId] = interaction.customId.split('_');
  
  const game = activeGames.get(gameId);
  if (!game) {
    return interaction.reply({ content: '❌ This game has expired!', ephemeral: true });
  }
  
  if (game.userId !== interaction.user.id) {
    return interaction.reply({ content: '❌ This is not your game!', ephemeral: true });
  }
  
  const userData = data.users[game.userId];
  
  if (type === 'cashout') {
    const profit = Math.floor(game.betAmount * (game.currentMultiplier - 1));
    const mainBonus = applyMainServerBonus(profit, game.serverId);
    const currentWinnings = game.betAmount + mainBonus;
    
    userData.coins += currentWinnings;
    await saveDataImmediate(data);
    activeGames.delete(gameId);
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💰 CASHED OUT!')
      .setDescription(`Smart move! You cashed out safely.\n\n**Total:** ${currentWinnings} 💰 (profit: +${mainBonus})\n💰 **New Balance:** ${userData.coins} coins`)
      .setFooter({ text: 'Play again anytime!' });
    
    return interaction.update({ embeds: [embed], components: [] });
  }
  
  if (type === 'continue') {
    if (game.round >= 5) {
      const profit = Math.floor(game.betAmount * (game.currentMultiplier - 1));
      const mainBonus = applyMainServerBonus(profit, game.serverId);
      const finalWinnings = game.betAmount + mainBonus;
      
      userData.coins += finalWinnings;
      await saveDataImmediate(data);
      activeGames.delete(gameId);
      
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 MAX ROUNDS REACHED!')
        .setDescription(`You've reached the maximum 5 rounds!\n\n**Final Winnings:** ${finalWinnings} 💰 (profit: +${mainBonus})\n💰 **New Balance:** ${userData.coins} coins`)
        .setFooter({ text: 'Amazing run!' });
      
      return interaction.update({ embeds: [embed], components: [] });
    }
    
    const roll = Math.floor(Math.random() * 6) + 1;
    const won = roll >= 4;
    
    if (!won) {
      activeGames.delete(gameId);
      
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🎲 DICE CLASH - BUSTED!')
        .setDescription(`You rolled: **${roll}** 🎲\n\n❌ You needed 4-6 to continue!\n\n**Lost everything!**\n💰 **Balance:** ${userData.coins} coins`)
        .setFooter({ text: 'So close! Try again!' });
      
      return interaction.update({ embeds: [embed], components: [] });
    }
    
    game.round++;
    const multipliers = [1.2, 1.5, 1.9, 2.4, 3.0];
    game.currentMultiplier = multipliers[game.round - 1] || 3.0;
    
    const profit = Math.floor(game.betAmount * (game.currentMultiplier - 1));
    const mainBonus = applyMainServerBonus(profit, game.serverId);
    const currentWinnings = game.betAmount + mainBonus;
    const nextMultiplier = multipliers[game.round] || 'MAX';
    
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`🎲 DICE CLASH - Round ${game.round}`)
      .setDescription(`You rolled: **${roll}** 🎲\n\n✅ You won!\n\n**Current Winnings:** ${currentWinnings} 💰 (profit: +${mainBonus})\n**Next Multiplier:** ×${nextMultiplier}\n\n${game.round >= 5 ? '🏆 **FINAL ROUND!** Cash out or risk it all!' : '🎰 **Cash out now or risk it for more?**'}`)
      .setFooter({ text: `Round ${game.round}/5 | ${isMainServer(game.serverId) ? '⭐ Main Server Bonus Active!' : ''}` });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`diceclash_continue_${gameId}`)
          .setLabel('🎲 Roll Again')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`diceclash_cashout_${gameId}`)
          .setLabel('💰 Cash Out')
          .setStyle(ButtonStyle.Success)
      );
    
    return interaction.update({ embeds: [embed], components: [row] });
  }
}

async function handleDoorButton(interaction, data) {
  const parts = interaction.customId.split('_');
  const doorNumber = parseInt(parts[1]);
  const gameId = parts[2];
  
  const game = activeGames.get(gameId);
  if (!game) {
    return interaction.reply({ content: '❌ This game has expired!', ephemeral: true });
  }
  
  if (game.userId !== interaction.user.id) {
    return interaction.reply({ content: '❌ This is not your game!', ephemeral: true });
  }
  
  const userData = data.users[game.userId];
  const outcome = game.doors[doorNumber - 1];
  
  let result, color, profit, winAmount;
  
  if (outcome === 'bigwin') {
    result = '🎉 BIG WIN!';
    color = '#FFD700';
    profit = Math.floor(game.betAmount * 0.8); // 1.8x total = 0.8x profit
    const mainBonus = applyMainServerBonus(profit, game.serverId);
    winAmount = game.betAmount + mainBonus;
  } else if (outcome === 'breakeven') {
    result = '⚠️ Break Even';
    color = '#FFA500';
    winAmount = game.betAmount;
    profit = 0;
  } else {
    result = '❌ LOSE ALL!';
    color = '#FF0000';
    winAmount = 0;
    profit = -game.betAmount;
  }
  
  userData.coins += winAmount;
  await saveDataImmediate(data);
  activeGames.delete(gameId);
  
  const doorEmojis = ['🚪', '🚪', '🚪'];
  doorEmojis[doorNumber - 1] = outcome === 'bigwin' ? '💎' : outcome === 'breakeven' ? '💰' : '💀';
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🚪 DOOR OF FATE - REVEALED!')
    .setDescription(`You chose Door ${doorNumber}!\n\n${doorEmojis[0]} | ${doorEmojis[1]} | ${doorEmojis[2]}\n\n${result}\n\n**Bet:** ${game.betAmount} 💰\n**${profit >= 0 ? 'Profit' : 'Lost'}:** ${profit >= 0 && profit > 0 ? `+${profit}` : profit === 0 ? '±0' : profit} 💰\n\n💰 **New Balance:** ${userData.coins} coins`)
    .setFooter({ text: isMainServer(game.serverId) ? '⭐ Main Server - 30% profit bonus!' : 'Try your luck again!' });
  
  return interaction.update({ embeds: [embed], components: [] });
}

module.exports = {
  coinDuel,
  diceClash,
  doorOfFate,
  almostWinMachine,
  rockPaperScissors,
  handleDiceClashButton,
  handleDoorButton
};
