const User = require('../models/User');
const addressForms = require('../utils/addressForms');

module.exports = {
  command: 'news',
  description: 'Новости и обновления бота',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId });
      
      const newsMessage = addressForms.formatForUser(`
🔥 <b>НОВИНКА: Уведомления на часы!</b> ⌚

Теперь можно получать опросы прямо на часы Garmin, Apple Watch и Wear OS!

⌚ <b>Новая команда /pushover:</b>
• Уведомления прямо на запястье
• Высокий приоритет - пробивается через DND режим
• Настраиваемые звуки и вибрация  
• Повторные напоминания при пропуске

🚀 <b>Как подключить:</b>
1. Установи приложение Pushover
2. Используй команду /pushover в боте
3. Введи свой User Key из Pushover
4. Настрой часы для получения Pushover уведомлений

💪 <b>Никогда больше не пропустишь опросы!</b>

---

🎉 <b>Также доступно: AI-аналитика!</b>

🧠 <b>Команда /insights:</b>
• Персональные инсайты на основе твоих паттернов
• AI-анализ твоего поведения и состояний
• Предсказания настроения и энергии
• Рекомендации для улучшения самочувствия

🎮 <b>Геймификация:</b>
• Система достижений и стриков 🏆
• Анонимные рейтинги участников 📊
• Персональные прогнозы состояний 🔮

💡 <b>Попробуй новые функции прямо сейчас!</b>
Продолжай отвечать на опросы регулярно, и бот станет твоим персональным коучем по самопознанию.

🚀 <b>Это только начало!</b> 
Скоро планируем добавить еще больше умных функций для понимания себя.

<i>Команда разработки ESM бота</i> 💙`, user);

      const keyboard = {
        inline_keyboard: [
          [
            { text: '⌚ Настроить часы', callback_data: 'try_pushover' }
          ],
          [
            { text: '🧠 Попробовать инсайты', callback_data: 'try_insights' },
            { text: '🏆 Мои достижения', callback_data: 'try_achievements' }
          ],
          [
            { text: '📊 Рейтинги', callback_data: 'try_leaderboard' },
            { text: '🔔 Начать опрос', callback_data: 'try_survey' }
          ],
          [
            { text: '📚 Помощь', callback_data: 'show_help' },
            { text: '❌ Закрыть', callback_data: 'close_news' }
          ]
        ]
      };

      await bot.sendMessage(chatId, newsMessage, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in news command:', error);
      const fallbackMessage = `
🎉 <b>Крупное обновление ESM бота!</b>

Добавлена система персональной аналитики с ИИ! 🤖

🧠 Новые команды:
• /insights - персональные инсайты
• /achievements - твои достижения  
• /leaderboard - рейтинги участников

💡 Попробуй /insights после нескольких опросов!`;

      bot.sendMessage(chatId, fallbackMessage, { parse_mode: 'HTML' });
    }
  },

  // Обработчик кнопок
  handleCallback: async (bot, query) => {
    const chatId = query.message.chat.id;
    const action = query.data;

    try {
      await bot.answerCallbackQuery(query.id);

      switch (action) {
        case 'try_pushover':
          const pushoverCommand = require('./pushover');
          await pushoverCommand.execute(bot, query.message);
          break;

        case 'try_insights':
          const insightsCommand = require('./insights');
          await insightsCommand.execute(bot, query.message);
          break;

        case 'try_achievements':
          const achievementsCommand = require('./achievements');
          await achievementsCommand.execute(bot, query.message);
          break;

        case 'try_leaderboard':
          const leaderboardCommand = require('./leaderboard');
          await leaderboardCommand.execute(bot, query.message);
          break;

        case 'try_survey':
          const surveyCommand = require('./survey');
          await surveyCommand.execute(bot, query.message);
          break;

        case 'show_help':
          const helpCommand = require('./help');
          await helpCommand.execute(bot, query.message);
          break;

        case 'close_news':
          await bot.editMessageText(
            '✅ Новости закрыты. Используй /news чтобы посмотреть снова!',
            {
              chat_id: chatId,
              message_id: query.message.message_id
            }
          );
          break;

        default:
          await bot.sendMessage(chatId, 'Неизвестная команда');
      }
    } catch (error) {
      console.error('Error in news callback:', error);
      await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
    }
  }
};