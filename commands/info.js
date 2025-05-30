module.exports = {
  command: 'info',
  description: 'Show bot information',
  execute: (bot, msg) => {
    const chatId = msg.chat.id;
    
    const infoMessage = `📊 <b>MSE Telegram Bot</b>\n\n` +
      `Version: 1.0.0\n` +
      `Platform: Node.js\n` +
      `Library: node-telegram-bot-api\n\n` +
      `Created with ❤️ for MSE`;
    
    bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
  }
};