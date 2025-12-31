const { EmbedBuilder } = require('discord.js');
const { 
  initializeNewYearData, 
  getPuzzleDisplay, 
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

    const progressText = createProgressBar(event.points, totalMaxPoints);
    const puzzleGrid = getPuzzleDisplay(event.piecesUnlocked);
    
    const embed = new EmbedBuilder()
      .setColor('#FF4500')
      .setTitle('🎆 New Year Jigsaw Puzzle')
      .setDescription(`Complete tasks to unlock pieces and earn a **Tyrant Crate**!\n\n**Time Remaining:** \`${timeString}\` ⏳\n\n**Progress:** ${event.piecesUnlocked.length}/${PIECES_COUNT} Pieces\n${progressText}\n\n**Next Reward:** ${nextReward}\n\n**How to earn points:**\n⚔️ **Battle (AI or PvP):** +5 points\n🎁 **Catch a Drop:** +10 points\n\n**Stats:**\n⚔️ Battles: ${event.battlesCompleted}\n🎁 Drops: ${event.dropsCaught}\n✨ Total: ${event.points}/${totalMaxPoints}\n\n**Puzzle Map:**\n${puzzleGrid}`)
      .addFields({ 
        name: '🎁 Grand Reward', 
        value: 'Unlock all 9 pieces to receive 1x **Tyrant Crate**! 🔴', 
        inline: false 
      })
      .setFooter({ text: 'Unlock pieces every 50 points! Corners first.' })
      .setTimestamp();

    if (event.completed) {
      embed.addFields({ name: '✅ Status', value: 'Congratulations! You have completed the puzzle and received your Tyrant Crate!' });
    }

    // Dynamic puzzle image mapping based on pieces collected
    const puzzleImages = [
      'https://media.discordapp.net/attachments/1118111111111111111/1323583344655974461/IMG_20251231_091732_1767152907483.jpg', // 0 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583344932655114/IMG_20251231_084319_1767152907516.jpg', // 1 piece
      'https://media.discordapp.net/attachments/1118111111111111111/1323583345226121287/IMG_20251231_084349_1767152907553.jpg', // 2 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583345498886174/IMG_20251231_084420_1767152907581.jpg', // 3 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583345758928926/IMG_20251231_084447_1767152907611.jpg', // 4 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583346048335912/IMG_20251231_091253_1767152907631.jpg', // 5 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583346312447038/IMG_20251231_091355_1767152907654.jpg', // 6 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583346580918342/IMG_20251231_091428_1767152907684.jpg', // 7 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583346853675038/IMG_20251231_091507_1767152907714.jpg', // 8 pieces
      'https://media.discordapp.net/attachments/1118111111111111111/1323583347143184424/IMG_20251231_091540_1767152907746.jpg'  // 9 pieces (Full)
    ];

    const piecesCount = event.piecesUnlocked.length;
    const currentImageUrl = puzzleImages[piecesCount] || puzzleImages[puzzleImages.length - 1];

    embed.setImage(currentImageUrl);

    await message.reply({ embeds: [embed] });
  }
};
