const GamificationService = require('../services/gamification-service');
const User = require('../models/User');

module.exports = {
  command: 'achievements',
  description: 'Посмотреть свои достижения и прогресс',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        bot.sendMessage(chatId, '❌ Пользователь не найден. Используйте /start для регистрации.');
        return;
      }
      
      const progress = user.getProgressToNextLevel();
      const progressBar = '█'.repeat(Math.floor(progress.percentage / 10)) + 
                         '░'.repeat(10 - Math.floor(progress.percentage / 10));
      
      let message = `🏆 <b>Ваши достижения</b>\n\n`;
      
      // Информация об уровне
      message += `👤 <b>Уровень:</b> ${user.level.current} - ${user.level.title}\n`;
      message += `✨ <b>Опыт:</b> ${progress.current}/${progress.needed} (${progress.percentage}%)\n`;
      message += `📊 [${progressBar}]\n\n`;
      
      // Текущие стрики
      message += `🔥 <b>Текущие стрики:</b>\n`;
      message += `📅 Ежедневный: ${user.streaks.current.daily.count} дней\n`;
      message += `🎯 Качественные: ${user.streaks.current.quality.count} ответов\n`;
      message += `🌊 Flow состояния: ${user.streaks.current.flow.count} раз\n\n`;
      
      // Рекорды
      message += `🏅 <b>Личные рекорды:</b>\n`;
      message += `📅 Макс. ежедневный: ${user.streaks.longest.daily.count} дней\n`;
      message += `🎯 Макс. качественных: ${user.streaks.longest.quality.count} ответов\n`;
      message += `🌊 Макс. Flow: ${user.streaks.longest.flow.count} раз\n\n`;
      
      // Достижения по редкости
      const achievementsByRarity = {
        legendary: [],
        epic: [],
        rare: [],
        common: []
      };
      
      user.achievements.forEach(achievement => {
        achievementsByRarity[achievement.rarity].push(achievement);
      });
      
      message += `🏆 <b>Разблокированные достижения (${user.achievements.length}):</b>\n\n`;
      
      // Показываем достижения по редкости
      const rarityEmoji = {
        legendary: '👑',
        epic: '🥇',
        rare: '🥈',
        common: '🥉'
      };
      
      const rarityNames = {
        legendary: 'Легендарные',
        epic: 'Эпические', 
        rare: 'Редкие',
        common: 'Обычные'
      };
      
      Object.entries(achievementsByRarity).forEach(([rarity, achievements]) => {
        if (achievements.length > 0) {
          message += `${rarityEmoji[rarity]} <b>${rarityNames[rarity]}:</b>\n`;
          achievements.forEach(achievement => {
            const date = achievement.unlockedAt.toLocaleDateString('ru-RU');
            message += `• ${achievement.description} <i>(${date})</i>\n`;
          });
          message += `\n`;
        }
      });
      
      if (user.achievements.length === 0) {
        message += `Пока достижений нет. Продолжайте участвовать в опросах!\n\n`;
      }
      
      // Следующие цели
      message += `🎯 <b>Ближайшие цели:</b>\n`;
      
      const dailyStreak = user.streaks.current.daily.count;
      if (dailyStreak < 7) {
        message += `• До "Ежедневного воина": ${7 - dailyStreak} дней\n`;
      } else if (dailyStreak < 30) {
        message += `• До "Чемпиона недель": ${30 - dailyStreak} дней\n`;
      }
      
      if (user.totalResponses < 100) {
        message += `• До "Клуба сотни": ${100 - user.totalResponses} ответов\n`;
      }
      
      const qualityStreak = user.streaks.current.quality.count;
      if (qualityStreak < 10) {
        message += `• До "Мастера качества": ${10 - qualityStreak} качественных ответов\n`;
      }
      
      // Подсказки для новых достижений
      message += `\n💡 <b>Подсказки:</b>\n`;
      message += `• Отвечайте каждый день для продления стрика\n`;
      message += `• Детальные ответы повышают качество\n`;
      message += `• Попробуйте достичь Flow состояния (высокий навык + вызов)\n`;
      message += `• Отвечайте рано утром или поздно вечером для специальных достижений`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Рейтинги', callback_data: 'leaderboards' },
            { text: '📈 Статистика', callback_data: 'stats' }
          ],
          [
            { text: '🔄 Обновить', callback_data: 'refresh_achievements' }
          ]
        ]
      };
      
      bot.sendMessage(chatId, message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('Error in achievements command:', error);
      bot.sendMessage(chatId, '❌ Произошла ошибка при получении достижений.');
    }
  }
};