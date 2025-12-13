const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  aliases: ['latency', 'pong'],
  category: 'utility',
  description: 'Check bot latency and response time',
  usage: '!ping',
  
  async execute({ message, client }) {
    const sent = await message.reply('🏓 Pinging...');
    
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    
    const embed = new EmbedBuilder()
      .setColor(latency < 200 ? 0x00FF00 : latency < 500 ? 0xFFA500 : 0xFF0000)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '⏱️ Response Time', value: `${latency}ms`, inline: true },
        { name: '💓 API Latency', value: `${apiLatency}ms`, inline: true },
        { name: '📊 Status', value: latency < 200 ? '🟢 Excellent' : latency < 500 ? '🟡 Good' : '🔴 Slow', inline: true }
      )
      .setTimestamp();
    
    await sent.edit({ content: null, embeds: [embed] });
  }
};
