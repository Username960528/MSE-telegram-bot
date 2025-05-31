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
🎉 <b>Крупное обновление ESM бота!</b>

Мы добавили революционную систему персональной аналитики с искусственным интеллектом! 🤖

🧠 <b>Новая команда /insights:</b>
• Персональные инсайты на основе твоих паттернов
• AI-анализ твоего поведения и состояний
• Предсказания настроения и энергии
• Рекомендации для улучшения самочувствия

🔮 <b>Что теперь умеет бот:</b>

📊 <b>Анализ паттернов:</b>
• Найдет твое лучшее время дня для работы
• Покажет, какие активности повышают настроение
• Определит влияние социального окружения
• Выявит необычные изменения в поведении

🤖 <b>AI-инсайты:</b>
• "Твое настроение лучше всего в 14:00"
• "Похоже, у тебя снижается энергия в пятницу"
• "Высокая вероятность Flow состояния - сосредоточься!"

🎮 <b>Также добавлено:</b>
• Система достижений и стриков 🏆
• Анонимные рейтинги участников 📊
• Персональные прогнозы состояний 🔮
• Умные рекомендации и алерты ⚠️

💡 <b>Как попробовать:</b>
1. Ответь на несколько опросов (минимум 10-15)
2. Используй /insights для получения анализа
3. Изучи свои достижения через /achievements
4. Посмотри рейтинги в /leaderboard

🌟 <b>Чем больше данных - тем точнее анализ!</b>
Продолжай отвечать на опросы регулярно, и бот станет твоим персональным коучем по самопознанию.

🚀 <b>Это только начало!</b> 
Скоро планируем добавить еще больше умных функций для понимания себя.

<i>Команда разработки ESM бота</i> 💙`, user);

      const keyboard = {
        inline_keyboard: [
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