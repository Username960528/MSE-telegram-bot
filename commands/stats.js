const User = require('../models/User');
const Response = require('../models/Response');
const addressForms = require('../utils/addressForms');

// Эмодзи для визуализации прогресса
const progressEmojis = {
  veryLow: '🔴',
  low: '🟠',
  medium: '🟡',
  good: '🟢',
  excellent: '🌟'
};

function getProgressEmoji(percent) {
  if (percent < 20) return progressEmojis.veryLow;
  if (percent < 40) return progressEmojis.low;
  if (percent < 60) return progressEmojis.medium;
  if (percent < 80) return progressEmojis.good;
  return progressEmojis.excellent;
}

// Визуализация прогресса
function createProgressBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function showStats(bot, chatId, telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      bot.sendMessage(chatId, 'Пользователь не найден. Используйте /start для регистрации.');
      return;
    }

    // Получаем все ответы пользователя
    const responses = await Response.find({ 
      userId: user._id 
    }).sort({ timestamp: -1 });

    if (responses.length === 0) {
      const message = addressForms.formatForUser(
        '📊 У тебя пока нет данных.\n\n' +
        'Начни с команды /survey для первого опроса!',
        user
      );
      bot.sendMessage(chatId, message);
      return;
    }

    // Группируем ответы по дням
    const responsesByDay = {};
    const dayScores = {};
    
    responses.forEach(r => {
      const date = new Date(r.timestamp);
      const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      
      if (!responsesByDay[dayKey]) {
        responsesByDay[dayKey] = [];
      }
      responsesByDay[dayKey].push(r);
      
      // Собираем оценки качества если есть
      if (r.metadata && r.metadata.dataQualityScore) {
        if (!dayScores[dayKey]) dayScores[dayKey] = [];
        dayScores[dayKey].push(r.metadata.dataQualityScore);
      }
    });

    // Считаем средние показатели
    let totalMood = 0, totalEnergy = 0, totalStress = 0;
    let countMood = 0, countEnergy = 0, countStress = 0;
    let totalQuality = 0, countQuality = 0;
    let trainingResponses = 0;

    responses.forEach(r => {
      if (r.responses) {
        if (r.responses.mood) {
          totalMood += r.responses.mood;
          countMood++;
        }
        if (r.responses.energy) {
          totalEnergy += r.responses.energy;
          countEnergy++;
        }
        if (r.responses.stress) {
          totalStress += r.responses.stress;
          countStress++;
        }
      }
      
      if (r.metadata) {
        if (r.metadata.dataQualityScore) {
          totalQuality += r.metadata.dataQualityScore;
          countQuality++;
        }
        if (r.metadata.isTraining) {
          trainingResponses++;
        }
      }
    });

    // Определяем текущий день обучения
    const uniqueDays = Object.keys(responsesByDay).length;
    const currentTrainingDay = Math.min(uniqueDays, 3);
    const isStillTraining = currentTrainingDay < 3;

    // Создаём сообщение
    let message = addressForms.formatForUser(`📊 **Твоя статистика ESM**\n\n`, user);
    
    // Статус обучения
    if (isStillTraining) {
      message += `🎓 **Статус обучения**: День ${currentTrainingDay} из 3\n`;
      message += `${getProgressEmoji(currentTrainingDay * 33)} Прогресс: ${createProgressBar(currentTrainingDay * 33)}\n\n`;
    } else {
      message += `✅ **Обучение завершено!**\n`;
      message += `Данные после 3-го дня являются основными\n\n`;
    }

    // Общая статистика
    message += `📈 **Общие показатели:**\n`;
    message += `├ Всего опросов: ${responses.length}\n`;
    message += `├ Уникальных дней: ${uniqueDays}\n`;
    message += `├ Тренировочных опросов: ${trainingResponses}\n`;
    if (countQuality > 0) {
      const avgQuality = Math.round(totalQuality / countQuality);
      message += `└ Средняя точность: ${getProgressEmoji(avgQuality)} ${avgQuality}%\n`;
    }
    message += `\n`;

    // Средние показатели
    if (countMood > 0 || countEnergy > 0 || countStress > 0) {
      message += `📊 **Средние показатели:**\n`;
      if (countMood > 0) {
        const avgMood = (totalMood / countMood).toFixed(1);
        message += `├ Настроение: ${getProgressEmoji(avgMood * 14.3)} ${avgMood}/7\n`;
      }
      if (countEnergy > 0) {
        const avgEnergy = (totalEnergy / countEnergy).toFixed(1);
        message += `├ Энергия: ${getProgressEmoji(avgEnergy * 14.3)} ${avgEnergy}/7\n`;
      }
      if (countStress > 0) {
        const avgStress = (totalStress / countStress).toFixed(1);
        const stressEmoji = getProgressEmoji(100 - avgStress * 14.3); // Инвертируем для стресса
        message += `└ Стресс: ${stressEmoji} ${avgStress}/7\n`;
      }
      message += `\n`;
    }

    // Качество данных по дням
    const sortedDays = Object.keys(dayScores).sort();
    if (sortedDays.length > 0) {
      message += `📅 **Качество данных по дням:**\n`;
      sortedDays.slice(-5).forEach((day, index) => {
        const scores = dayScores[day];
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const dayNum = index + 1;
        const label = dayNum <= 3 ? ' (обучение)' : '';
        message += `День ${dayNum}${label}: ${getProgressEmoji(avgScore)} ${avgScore}%\n`;
      });
      message += `\n`;
    }

    // Прогресс качества
    if (sortedDays.length >= 2) {
      const firstDayScores = dayScores[sortedDays[0]];
      const lastDayScores = dayScores[sortedDays[sortedDays.length - 1]];
      const firstAvg = Math.round(firstDayScores.reduce((a, b) => a + b, 0) / firstDayScores.length);
      const lastAvg = Math.round(lastDayScores.reduce((a, b) => a + b, 0) / lastDayScores.length);
      const improvement = lastAvg - firstAvg;
      
      if (improvement > 10) {
        message += `📈 Качество наблюдений улучшилось на ${improvement}%!\n\n`;
      } else if (improvement > 0) {
        message += `📊 Качество наблюдений улучшается постепенно\n\n`;
      }
    }

    // Анализ регулярности ответов
    const last7Days = responses.filter(r => {
      const daysDiff = (Date.now() - new Date(r.timestamp)) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });
    const responseRate = uniqueDays > 0 ? (responses.length / uniqueDays).toFixed(1) : 0;
    
    // Проверяем настройки Pushover
    const hasPushover = user.settings.pushover && user.settings.pushover.enabled;
    
    // Рекомендации
    let recommendations = `🎯 **Рекомендации:**\n`;

    if (isStillTraining) {
      recommendations += `• Продолжай обучение - осталось ${3 - currentTrainingDay} ${currentTrainingDay === 2 ? 'день' : 'дня'}\n`;
      recommendations += `• Фокусируйся на МОМЕНТЕ сигнала\n`;
      recommendations += `• Избегай обобщений типа "обычно", "всегда"\n`;
    } else {
      if (countQuality > 0 && totalQuality / countQuality < 60) {
        recommendations += `• Старайся описывать конкретные детали момента\n`;
        recommendations += `• Добавляй сенсорную информацию (что видел/слышал)\n`;
      } else {
        recommendations += `• Отличная работа! Продолжай в том же духе\n`;
        recommendations += `• Твои данные точно отражают моментальный опыт\n`;
      }
    }
    
    // Рекомендации по частоте ответов
    if (responseRate < 3) {
      recommendations += `\n⚠️ **Низкая частота ответов** (${responseRate}/день):\n`;
      recommendations += `• Регулярные ответы улучшают качество данных\n`;
      recommendations += `• Рекомендуется отвечать на 4-6 опросов в день\n`;
      if (!hasPushover) {
        recommendations += `• 💡 Настрой уведомления на часы (/pushover) - это повышает отзывчивость на 60%!\n`;
      }
    } else if (responseRate >= 4) {
      recommendations += `\n✅ **Отличная регулярность** (${responseRate}/день)!\n`;
      if (hasPushover) {
        recommendations += `• Pushover уведомления помогают поддерживать регулярность\n`;
      }
    }

    recommendations += `\n💬 Используй /survey для нового опроса`;

    message += addressForms.formatForUser(recommendations, user);

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    // Интересный факт для мотивации
    if (!isStillTraining && countQuality > 0 && totalQuality / countQuality > 70) {
      setTimeout(() => {
        bot.sendMessage(chatId, 
          `💡 **Знаете ли вы?**\n\n` +
          `Исследования Рассела Херлберта показали, что только 3% времени при чтении ` +
          `люди действительно "слышат" внутренний голос, хотя большинство уверены, что это происходит постоянно.\n\n` +
          `Вы научились различать реальный опыт от убеждений о нём - это редкий навык! 🌟`
        );
      }, 2000);
    }

  } catch (error) {
    console.error('Error showing stats:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при получении статистики.');
  }
}

module.exports = {
  command: 'stats',
  description: 'Показать статистику и прогресс',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    await showStats(bot, chatId, telegramId);
  }
};