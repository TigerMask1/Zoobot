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
    
    const progressText = createProgressBar(event.points, totalMaxPoints);
    const puzzleGrid = getPuzzleDisplay(event.piecesUnlocked);
    
    const embed = new EmbedBuilder()
      .setColor('#FF4500')
      .setTitle('🎆 New Year Jigsaw Puzzle')
      .setDescription(`Complete battles and catch drops to unlock pieces of the special New Year image!\n\n**Progress:** ${event.piecesUnlocked.length}/${PIECES_COUNT} Pieces\n${progressText}\n\n**Stats:**\n⚔️ Battles: ${event.battlesCompleted}\n🎁 Drops Caught: ${event.dropsCaught}\n✨ Total Points: ${event.points}/${totalMaxPoints}\n\n**Puzzle Map:**\n${puzzleGrid}`)
      .addFields({ 
        name: '🎁 Completion Reward', 
        value: 'Complete all 9 pieces to receive a **Tyrant Crate**! 🔴', 
        inline: false 
      })
      .setFooter({ text: 'Corners unlock first! Event ends in 2 days.' })
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
