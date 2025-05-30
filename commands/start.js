const User = require('../models/User');

module.exports = {
  command: 'start',
  description: 'Start the bot and show welcome message',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const userName = msg.from.first_name || 'User';
    
    try {
      let user = await User.findOne({ telegramId });
      
      if (!user) {
        user = new User({
          telegramId,
          username: msg.from.username,
          firstName: msg.from.first_name,
          lastName: msg.from.last_name
        });
        await user.save();
      }
      
      const welcomeMessage = `Привет ${userName}! 👋\n\n` +
        `Добро пожаловать в MSE Bot - бот для Experience Sampling Method!\n\n` +
        `Я буду отправлять вам короткие опросы в течение дня, чтобы узнать о вашем состоянии.\n\n` +
        `🔔 Уведомления включены автоматически (6 раз в день с 9:00 до 21:00).\n` +
        `Используйте /settings для изменения расписания.\n\n` +
        `Команды:\n` +
        `/survey - начать опрос сейчас\n` +
        `/stats - посмотреть статистику\n` +
        `/settings - настройки уведомлений\n` +
        `/help - все команды`;
      
      const keyboard = {
        reply_markup: {
          keyboard: [
            ['📚 Help', '📊 Info'],
            ['📈 Stats', '🔔 Survey']
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      };
      
      await bot.sendMessage(chatId, welcomeMessage, keyboard);
    } catch (error) {
      console.error('Error in start command:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при регистрации. Попробуйте позже.');
    }
  }
};