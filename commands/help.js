const User = require('../models/User');
const addressForms = require('../utils/addressForms');

module.exports = {
  command: 'help',
  description: 'Show available commands',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId });

      const helpMessage = addressForms.formatForUser(
        `📚 <b>Доступные команды:</b>\n\n` +
        `🚀 <b>Основные:</b>\n` +
        `/start - Регистрация в боте\n` +
        `/survey - Начать опрос\n` +
        `/stats - Твоя статистика\n` +
        `/settings - Настройки уведомлений\n\n` +
        `🎮 <b>Геймификация:</b>\n` +
        `/achievements - Твои достижения и прогресс\n` +
        `/leaderboard - Рейтинги участников (анонимно)\n\n` +
        `🧠 <b>Персональная аналитика:</b>\n` +
        `/insights - Персональные инсайты и прогнозы\n\n` +
        `ℹ️ <b>Дополнительные:</b>\n` +
        `/help - Это сообщение\n` +
        `/news - Новости и обновления бота 🆕\n` +
        `/info - Информация о боте\n` +
        `/echo [текст] - Повторить сообщение\n` +
        `/export - Экспорт твоих данных\n\n` +
        `💡 <b>Подсказка:</b> Используй кнопки клавиатуры для быстрого доступа!`,
        user
      );

      bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error in help command:', error);
      // Fallback to informal address if user not found
      const helpMessage = `📚 <b>Доступные команды:</b>\n\n` +
        `🚀 <b>Основные:</b>\n` +
        `/start - Регистрация в боте\n` +
        `/survey - Начать опрос\n` +
        `/stats - Твоя статистика\n` +
        `/settings - Настройки уведомлений\n\n` +
        `🎮 <b>Геймификация:</b>\n` +
        `/achievements - Твои достижения и прогресс\n` +
        `/leaderboard - Рейтинги участников (анонимно)\n\n` +
        `🧠 <b>Персональная аналитика:</b>\n` +
        `/insights - Персональные инсайты и прогнозы\n\n` +
        `ℹ️ <b>Дополнительные:</b>\n` +
        `/help - Это сообщение\n` +
        `/news - Новости и обновления бота 🆕\n` +
        `/info - Информация о боте\n` +
        `/echo [текст] - Повторить сообщение\n` +
        `/export - Экспорт твоих данных\n\n` +
        `💡 <b>Подсказка:</b> Используй кнопки клавиатуры для быстрого доступа!`;

      bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
    }
  }
};