const User = require('../models/User');
const addressForms = require('../utils/addressForms');

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
      
      const welcomeMessage = addressForms.formatForUser(
        `Привет ${userName}! 👋\n\n` +
        `Добро пожаловать в MSE Bot - бот для исследования внутреннего опыта!\n\n` +
        `Я буду отправлять тебе короткие опросы в случайные моменты дня, чтобы помочь изучить твои мысли, чувства и переживания в реальном времени.\n\n` +
        `🔔 Уведомления включены автоматически (6 раз в день с 9:00 до 21:00).\n` +
        `Используй /settings для изменения расписания.\n\n` +
        `⌚ <b>Новинка:</b> /pushover - настрой уведомления на часы Garmin/Apple Watch!\n\n` +
        `Команды:\n` +
        `/survey - начать опрос сейчас\n` +
        `/stats - посмотреть статистику\n` +
        `/settings - настройки уведомлений\n` +
        `/pushover - уведомления на часы 🆕\n` +
        `/help - все команды\n\n` +
        `💡 По умолчанию я обращаюсь на "ты". Если предпочитаешь "Вы", используй /settings`,
        user
      );
      
      const keyboard = {
        reply_markup: {
          keyboard: [
            ['📚 Помощь', '📊 Памятка'],
            ['📈 Статистика', '🔔 Опрос']
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      };
      
      await bot.sendMessage(chatId, welcomeMessage, { ...keyboard, parse_mode: 'HTML' });
      
      // Для новых пользователей показываем новости о последних обновлениях
      if (!user.seenLatestNews) {
        setTimeout(async () => {
          const newsCommand = require('./news');
          await newsCommand.execute(bot, msg);
          
          // Отмечаем, что пользователь видел новости
          user.seenLatestNews = true;
          await user.save();
        }, 3000);
      }
    } catch (error) {
      console.error('Error in start command:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при регистрации. Попробуйте позже.');
    }
  }
};