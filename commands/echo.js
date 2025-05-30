module.exports = {
  command: 'echo',
  description: 'Echo user message',
  pattern: /\/echo (.+)/,
  execute: (bot, msg, match) => {
    const chatId = msg.chat.id;
    
    if (match && match[1]) {
      bot.sendMessage(chatId, `🔊 ${match[1]}`);
    } else {
      bot.sendMessage(chatId, 'Please provide text to echo. Example: /echo Hello World');
    }
  }
};