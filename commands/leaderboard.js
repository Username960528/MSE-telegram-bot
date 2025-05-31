const GamificationService = require('../services/gamification-service');
const User = require('../models/User');

module.exports = {
  command: 'leaderboard',
  description: 'Посмотреть рейтинги участников (анонимно)',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        bot.sendMessage(chatId, '❌ Пользователь не найден. Используйте /start для регистрации.');
        return;
      }
      
      const leaderboards = await GamificationService.getLeaderboards();
      
      let message = `🏆 <b>Рейтинги участников</b>\n\n`;
      message += `<i>Все данные анонимизированы для защиты приватности</i>\n\n`;
      
      // Еженедельный рейтинг
      message += `📊 <b>Топ недели (по очкам):</b>\n`;
      if (leaderboards.weekly.length > 0) {
        leaderboards.weekly.slice(0, 5).forEach(entry => {
          const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : `${entry.position}.`;
          message += `${medal} ${entry.anonymousId} - ${entry.score} очков (ур.${entry.level})\n`;
        });
      } else {
        message += `Пока нет данных\n`;
      }
      message += `\n`;
      
      // Рейтинг по качеству
      message += `🎯 <b>Мастера качества:</b>\n`;
      if (leaderboards.quality.length > 0) {
        leaderboards.quality.slice(0, 5).forEach(entry => {
          const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : `${entry.position}.`;
          message += `${medal} ${entry.anonymousId} - ${entry.score}% качества\n`;
        });
      } else {
        message += `Пока нет данных\n`;
      }
      message += `\n`;
      
      // Рейтинг по Flow
      message += `🌊 <b>Мастера Flow:</b>\n`;
      if (leaderboards.flow.length > 0) {
        leaderboards.flow.slice(0, 5).forEach(entry => {
          const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : `${entry.position}.`;
          message += `${medal} ${entry.anonymousId} - ${entry.score}% времени в Flow\n`;
        });
      } else {
        message += `Пока нет данных\n`;
      }
      message += `\n`;
      
      // Рейтинг по стрикам
      message += `🔥 <b>Чемпионы постоянства:</b>\n`;
      if (leaderboards.streaks.length > 0) {
        leaderboards.streaks.slice(0, 5).forEach(entry => {
          const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : `${entry.position}.`;
          message += `${medal} ${entry.anonymousId} - ${entry.score} дней подряд\n`;
        });
      } else {
        message += `Пока нет данных\n`;
      }
      message += `\n`;
      
      // Позиция пользователя
      const userWeeklyPos = await GamificationService.getUserRanking(user._id, 'weekly');
      const userQualityPos = await GamificationService.getUserRanking(user._id, 'quality');
      const userFlowPos = await GamificationService.getUserRanking(user._id, 'flow');
      const userStreakPos = await GamificationService.getUserRanking(user._id, 'streak');
      
      message += `📍 <b>Ваши позиции:</b>\n`;
      message += `📊 Недельный рейтинг: #${userWeeklyPos}\n`;
      message += `🎯 По качеству: #${userQualityPos}\n`;
      message += `🌊 По Flow: #${userFlowPos}\n`;
      message += `🔥 По стрикам: #${userStreakPos}\n\n`;
      
      message += `<i>🔄 Рейтинги обновляются каждые 24 часа</i>`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Полный топ недели', callback_data: 'full_weekly_leaderboard' },
            { text: '🎯 Топ качества', callback_data: 'full_quality_leaderboard' }
          ],
          [
            { text: '🌊 Топ Flow', callback_data: 'full_flow_leaderboard' },
            { text: '🔥 Топ стриков', callback_data: 'full_streak_leaderboard' }
          ],
          [
            { text: '🏆 Мои достижения', callback_data: 'my_achievements' },
            { text: '🔄 Обновить', callback_data: 'refresh_leaderboard' }
          ]
        ]
      };
      
      bot.sendMessage(chatId, message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      bot.sendMessage(chatId, '❌ Произошла ошибка при получении рейтингов.');
    }
  }
};