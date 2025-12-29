const { EmbedBuilder } = require('discord.js');
const { 
  initializeNewYearData, 
  getPuzzleDisplay, 
  createProgressBar, 
  PIECES_COUNT, 
  MILESTONE_POINTS 
} = require('../../newYearEventSystem.js');

module.exports = {
  name: 'newyear',
  description: 'Check your New Year jigsaw puzzle progress!',
  async execute(message, args, data) {
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

    // Attach the actual image as a thumbnail or large image if desired
    // For now, we use the puzzle grid to show progress visually
    embed.setImage('https://media.discordapp.net/attachments/1118111111111111111/1322849824862093445/IMG_20251229_075718_1766976143584.jpg');

    await message.reply({ embeds: [embed] });
  }
};
