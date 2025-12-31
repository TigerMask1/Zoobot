const { EmbedBuilder } = require('discord.js');
const { 
  initializeNewYearData, 
  getPuzzleDisplay, 
  getPuzzleImage,
  createProgressBar, 
  PIECES_COUNT, 
  MILESTONE_POINTS,
  isEventActive
} = require('../../newYearEventSystem.js');

module.exports = {
  name: 'newyear',
  description: 'Check your New Year jigsaw puzzle progress!',
  async execute(context) {
    const { message, args, data } = context;
    if (!isEventActive()) {
      return message.reply('🎆 The New Year event has ended! Happy 2026!');
    }

    if (!data || !data.users) {
      return message.reply('❌ System error: User data not found. Please try again later.');
    }
    const user = data.users[message.author.id];
    if (!user) return;

    const event = initializeNewYearData(user);
    const totalMaxPoints = PIECES_COUNT * MILESTONE_POINTS;
    
    // Calculate time remaining
    const now = new Date();
    const endEvent = new Date(Date.UTC(2026, 0, 3, 0, 0, 0));
    const diff = endEvent - now;
    
    let timeString = 'Expired';
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeString = `${days}d ${hours}h ${minutes}m`;
    }

    // Points logic
    const pointsToNext = MILESTONE_POINTS - (event.points % MILESTONE_POINTS);
    const nextReward = event.piecesUnlocked.length < PIECES_COUNT 
      ? `🧩 **Next Puzzle Piece** (in ${pointsToNext} points)`
      : '✅ **All Pieces Collected!**';

    const puzzleGrid = getPuzzleDisplay(event.piecesUnlocked);
    const puzzleImage = getPuzzleImage(event.piecesUnlocked.length);
    
    const embed = new EmbedBuilder()
      .setColor('#FF4500')
      .setTitle('🎆 New Year Jigsaw Puzzle')
      .setImage(puzzleImage)
      .setDescription(`Complete tasks to unlock pieces and earn a **Tyrant Crate**!\n\n**Time Remaining:** \`${timeString}\` ⏳\n\n**Progress:** ${event.piecesUnlocked.length}/${PIECES_COUNT} Pieces\n${progressText}\n\n**Next Reward:** ${nextReward}\n\n**How to earn points:**\n⚔️ **Battle (AI or PvP):** +5 points\n🎁 **Catch a Drop:** +10 points\n\n**Stats:**\n⚔️ Battles: ${event.battlesCompleted}\n🎁 Drops: ${event.dropsCaught}\n✨ Total: ${event.points}/${totalMaxPoints}\n\n**Puzzle Map:**\n${puzzleGrid}`)
      .addFields(
        { 
          name: '🧩 Individual Piece Rewards', 
          value: 'Each piece unlocked grants **500 Coins** 💰 and **5 Gems** 💎!', 
          inline: false 
        },
        { 
          name: '🎁 Grand Reward', 
          value: 'Unlock all 9 pieces to receive 1x **Tyrant Crate**! 🔴', 
          inline: false 
        }
      )
      .setFooter({ text: 'Unlock pieces every 50 points! Corners first.' })
      .setTimestamp();

    if (event.completed) {
      embed.addFields({ name: '✅ Status', value: 'Congratulations! You have completed the puzzle and received your Tyrant Crate!' });
    }

    await message.reply({ embeds: [embed] });
  }
};
