const User = require('../models/User');
const AIInsightsService = require('../services/ai-insights-service');
const PredictiveAnalyticsService = require('../services/predictive-analytics-service');
const PatternAnalysisService = require('../services/pattern-analysis-service');
const addressForms = require('../utils/addressForms');

module.exports = {
  command: 'insights',
  description: 'Персональные инсайты и предсказания на основе ваших данных',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        bot.sendMessage(chatId, '❌ Пользователь не найден. Используйте /start для регистрации.');
        return;
      }
      
      // Показываем индикатор загрузки
      await bot.sendMessage(chatId, '🔍 Анализируем ваши паттерны поведения...');
      
      // Получаем все типы аналитики
      const [aiInsights, predictions, quickInsight] = await Promise.all([
        AIInsightsService.generatePersonalInsights(user._id).catch(err => {
          console.error('AI Insights error:', err);
          return { insights: [], error: 'AI temporarily unavailable' };
        }),
        PredictiveAnalyticsService.generatePredictions(user._id, {
          currentTime: new Date()
        }).catch(err => {
          console.error('Predictions error:', err);
          return { predictions: {}, error: 'Predictions temporarily unavailable' };
        }),
        AIInsightsService.generateQuickInsight(user._id).catch(err => {
          console.error('Quick insight error:', err);
          return { message: 'Продолжайте отвечать на опросы для получения инсайтов', emoji: '📊' };
        })
      ]);
      
      let message = addressForms.formatForUser(`🧠 <b>Персональные инсайты</b>\n\n`, user);
      
      // Быстрый инсайт в начале
      if (quickInsight && quickInsight.message) {
        message += `${quickInsight.emoji} <i>${quickInsight.message}</i>\n\n`;
      }
      
      // AI инсайты
      if (aiInsights.insights && aiInsights.insights.length > 0) {
        message += `🤖 <b>AI-анализ:</b>\n`;
        
        aiInsights.insights.slice(0, 3).forEach((insight, index) => {
          message += `${insight.emoji || '💡'} <b>${insight.title}</b>\n`;
          message += `${insight.description}\n`;
          if (insight.recommendation) {
            message += `💡 <i>${insight.recommendation}</i>\n`;
          }
          message += `\n`;
        });
      } else if (aiInsights.error) {
        message += `🤖 <b>AI-анализ:</b> ${aiInsights.error}\n\n`;
      }
      
      // Предсказания
      if (predictions.predictions && Object.keys(predictions.predictions).length > 0) {
        message += `🔮 <b>Прогнозы:</b>\n`;
        
        // Предсказания на основе времени
        if (predictions.predictions.timeBased && predictions.predictions.timeBased.currentHour) {
          const current = predictions.predictions.timeBased.currentHour;
          const now = new Date().getHours();
          
          message += `⏰ <b>Сейчас (${now}:00):</b>\n`;
          if (current.mood) {
            const moodEmoji = current.mood.predicted > 5 ? '😊' : current.mood.predicted > 3 ? '😐' : '😔';
            message += `${moodEmoji} Настроение: ${current.mood.predicted.toFixed(1)}/7\n`;
          }
          if (current.energy) {
            const energyEmoji = current.energy.predicted > 5 ? '⚡' : current.energy.predicted > 3 ? '🔋' : '🪫';
            message += `${energyEmoji} Энергия: ${current.energy.predicted.toFixed(1)}/7\n`;
          }
          if (current.stress) {
            const stressEmoji = current.stress.predicted > 5 ? '😰' : current.stress.predicted > 3 ? '😤' : '😌';
            message += `${stressEmoji} Стресс: ${current.stress.predicted.toFixed(1)}/7\n`;
          }
          message += `\n`;
        }
        
        // Следующий час
        if (predictions.predictions.timeBased && predictions.predictions.timeBased.nextHour) {
          const next = predictions.predictions.timeBased.nextHour;
          const nextHour = (new Date().getHours() + 1) % 24;
          
          message += `⏭ <b>Следующий час (${nextHour}:00):</b>\n`;
          if (next.mood) {
            const change = next.mood.predicted > (predictions.predictions.timeBased.currentHour?.mood?.predicted || 0) ? '📈' : '📉';
            message += `${change} Настроение: ${next.mood.predicted.toFixed(1)}/7\n`;
          }
          message += `\n`;
        }
        
        // Flow предсказания
        if (predictions.predictions.flowPrediction && predictions.predictions.flowPrediction.flowProbability > 0.3) {
          const flowProb = predictions.predictions.flowPrediction.flowProbability;
          const flowEmoji = flowProb > 0.7 ? '🌊' : flowProb > 0.5 ? '〰️' : '💧';
          message += `${flowEmoji} <b>Flow состояние:</b> ${Math.round(flowProb * 100)}% вероятность\n`;
          if (predictions.predictions.flowPrediction.recommendation) {
            message += `💡 ${predictions.predictions.flowPrediction.recommendation}\n`;
          }
          message += `\n`;
        }
      }
      
      // Рекомендации
      if (predictions.predictions && predictions.predictions.recommendations && predictions.predictions.recommendations.length > 0) {
        message += `💡 <b>Рекомендации:</b>\n`;
        predictions.predictions.recommendations.slice(0, 2).forEach(rec => {
          const emoji = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡';
          message += `${emoji} ${rec.message}\n`;
          message += `   ➡️ ${rec.action}\n\n`;
        });
      }
      
      // Алерты
      if (predictions.predictions && predictions.predictions.alerts && predictions.predictions.alerts.length > 0) {
        const importantAlerts = predictions.predictions.alerts.filter(alert => 
          alert.severity === 'high' || alert.type === 'anomaly'
        );
        
        if (importantAlerts.length > 0) {
          message += `⚠️ <b>Важные уведомления:</b>\n`;
          importantAlerts.slice(0, 2).forEach(alert => {
            message += `• ${alert.message}\n`;
            if (alert.recommendation) {
              message += `  💡 ${alert.recommendation}\n`;
            }
          });
          message += `\n`;
        }
      }
      
      // Общая уверенность в предсказаниях
      if (predictions.confidence && predictions.confidence > 0) {
        const confidenceEmoji = predictions.confidence > 0.7 ? '🎯' : predictions.confidence > 0.4 ? '🔍' : '🌱';
        message += `${confidenceEmoji} <i>Уверенность в анализе: ${Math.round(predictions.confidence * 100)}%</i>\n`;
      }
      
      // Если мало данных
      if (message.length < 200) {
        message = addressForms.formatForUser(`🧠 <b>Персональные инсайты</b>\n\n`, user);
        message += `🌱 Мы только начинаем изучать твои паттерны!\n\n`;
        message += `📊 Для качественного анализа нужно:\n`;
        message += `• Минимум 15 ответов за последние 2 недели\n`;
        message += `• Разнообразие времен дня и активностей\n`;
        message += `• Регулярные ответы (хотя бы через день)\n\n`;
        message += `💡 Продолжай отвечать на опросы, и скоро увидишь интересные закономерности!`;
      }
      
      // Добавляем время последнего анализа
      message += `\n\n<i>Анализ выполнен: ${new Date().toLocaleString('ru-RU')}</i>`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📊 Детальные паттерны', callback_data: 'insights_detailed_patterns' },
            { text: '🔮 Полные прогнозы', callback_data: 'insights_full_predictions' }
          ],
          [
            { text: '📈 Временные паттерны', callback_data: 'insights_time_patterns' },
            { text: '🎯 Активности', callback_data: 'insights_activity_patterns' }
          ],
          [
            { text: '🌊 Flow анализ', callback_data: 'insights_flow_analysis' },
            { text: '👥 Социальные паттерны', callback_data: 'insights_social_patterns' }
          ],
          [
            { text: '🔄 Обновить анализ', callback_data: 'insights_refresh' },
            { text: '⚙️ Настройки', callback_data: 'insights_settings' }
          ]
        ]
      };
      
      await bot.sendMessage(chatId, message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      
    } catch (error) {
      console.error('Error in insights command:', error);
      bot.sendMessage(chatId, 
        addressForms.formatForUser(
          '❌ Произошла ошибка при анализе твоих данных. Попробуй позже.',
          await User.findOne({ telegramId })
        )
      );
    }
  },
  
  // Обработчик callback-запросов для детальных инсайтов
  handleCallback: async (bot, query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const action = query.data;
    
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: 'Пользователь не найден' });
        return;
      }
      
      await bot.answerCallbackQuery(query.id, { text: 'Загружаем данные...' });
      
      let message = '';
      
      switch (action) {
        case 'insights_time_patterns':
          message = await this.generateTimePatternReport(user._id);
          break;
          
        case 'insights_activity_patterns':
          message = await this.generateActivityPatternReport(user._id);
          break;
          
        case 'insights_social_patterns':
          message = await this.generateSocialPatternReport(user._id);
          break;
          
        case 'insights_flow_analysis':
          message = await this.generateFlowAnalysisReport(user._id);
          break;
          
        case 'insights_full_predictions':
          message = await this.generateFullPredictionsReport(user._id);
          break;
          
        case 'insights_detailed_patterns':
          message = await this.generateDetailedPatternsReport(user._id);
          break;
          
        case 'insights_refresh':
          // Просто перезапускаем основную команду
          await this.execute(bot, query.message);
          return;
          
        case 'insights_settings':
          message = this.generateInsightsSettings();
          break;
          
        default:
          message = 'Неизвестная команда';
      }
      
      const backKeyboard = {
        inline_keyboard: [
          [{ text: '← Назад к инсайтам', callback_data: 'insights_back' }]
        ]
      };
      
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: backKeyboard
      });
      
    } catch (error) {
      console.error('Error in insights callback:', error);
      await bot.answerCallbackQuery(query.id, { text: 'Ошибка при загрузке данных' });
    }
  },
  
  // Генерация детальных отчетов
  async generateTimePatternReport(userId) {
    const patterns = await PatternAnalysisService.analyzeTimePatterns(userId, 30);
    
    if (patterns.insufficient_data) {
      return '📊 <b>Временные паттерны</b>\n\nНедостаточно данных для анализа. Продолжайте отвечать на опросы!';
    }
    
    let message = '📊 <b>Временные паттерны</b>\n\n';
    
    // Анализ по часам
    message += '⏰ <b>По времени дня:</b>\n';
    const hourlyData = Object.entries(patterns.hourly)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].mood.avg - a[1].mood.avg);
    
    if (hourlyData.length > 0) {
      message += `🌟 Лучшее время: ${hourlyData[0][0]}:00 (настроение ${hourlyData[0][1].mood.avg.toFixed(1)})\n`;
      if (hourlyData.length > 1) {
        const worst = hourlyData[hourlyData.length - 1];
        message += `😔 Сложное время: ${worst[0]}:00 (настроение ${worst[1].mood.avg.toFixed(1)})\n`;
      }
    }
    
    // Анализ по дням недели
    message += '\n📅 <b>По дням недели:</b>\n';
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const weekdayData = Object.entries(patterns.weekday)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
    weekdayData.forEach(([day, data]) => {
      const dayName = weekdays[parseInt(day)];
      const moodEmoji = data.mood.avg > 5 ? '😊' : data.mood.avg > 3 ? '😐' : '😔';
      message += `${moodEmoji} ${dayName}: ${data.mood.avg.toFixed(1)}/7\n`;
    });
    
    return message;
  },
  
  async generateActivityPatternReport(userId) {
    const patterns = await PatternAnalysisService.analyzeActivityPatterns(userId, 30);
    
    if (Object.keys(patterns).length === 0) {
      return '🎯 <b>Паттерны активности</b>\n\nНедостаточно данных об активностях. Указывайте конкретные действия в опросах!';
    }
    
    let message = '🎯 <b>Паттерны активности</b>\n\n';
    
    const sortedActivities = Object.entries(patterns)
      .sort((a, b) => b[1].mood.avg - a[1].mood.avg);
    
    message += '📈 <b>Влияние на настроение:</b>\n';
    sortedActivities.slice(0, 5).forEach(([activity, data]) => {
      const moodEmoji = data.mood.avg > 5 ? '😊' : data.mood.avg > 3 ? '😐' : '😔';
      message += `${moodEmoji} "${activity}": ${data.mood.avg.toFixed(1)}/7 (${data.count} раз)\n`;
    });
    
    // Flow активности
    const flowActivities = sortedActivities
      .filter(([_, data]) => data.flowPercentage > 20)
      .sort((a, b) => b[1].flowPercentage - a[1].flowPercentage);
    
    if (flowActivities.length > 0) {
      message += '\n🌊 <b>Активности для Flow:</b>\n';
      flowActivities.slice(0, 3).forEach(([activity, data]) => {
        message += `• "${activity}": ${Math.round(data.flowPercentage)}% времени в Flow\n`;
      });
    }
    
    return message;
  },
  
  async generateSocialPatternReport(userId) {
    const patterns = await PatternAnalysisService.analyzeSocialPatterns(userId, 30);
    
    if (Object.keys(patterns).length === 0) {
      return '👥 <b>Социальные паттерны</b>\n\nНедостаточно данных о социальном контексте.';
    }
    
    let message = '👥 <b>Социальные паттерны</b>\n\n';
    
    const sortedSocial = Object.entries(patterns)
      .sort((a, b) => b[1].mood.avg - a[1].mood.avg);
    
    message += '😊 <b>Влияние окружения на настроение:</b>\n';
    sortedSocial.forEach(([companion, data]) => {
      const moodEmoji = data.mood.avg > 5 ? '😊' : data.mood.avg > 3 ? '😐' : '😔';
      const socialEmoji = companion === 'один' ? '🧘' : '👥';
      message += `${socialEmoji}${moodEmoji} ${companion}: ${data.mood.avg.toFixed(1)}/7\n`;
    });
    
    return message;
  },
  
  async generateFlowAnalysisReport(userId) {
    const correlations = await PatternAnalysisService.findCorrelations(userId, 30);
    
    if (correlations.insufficient_data || !correlations.flowTriggers) {
      return '🌊 <b>Анализ Flow состояний</b>\n\nНедостаточно данных для анализа Flow. Отвечайте на вопросы о навыках и вызовах!';
    }
    
    let message = '🌊 <b>Анализ Flow состояний</b>\n\n';
    
    const flowTriggers = correlations.flowTriggers;
    if (flowTriggers.flowAvg) {
      message += '🎯 <b>Оптимальная зона для Flow:</b>\n';
      message += `• Вызов: ${flowTriggers.optimalZone.challengeRange[0]}-${flowTriggers.optimalZone.challengeRange[1]}/9\n`;
      message += `• Навык: ${flowTriggers.optimalZone.skillRange[0]}-${flowTriggers.optimalZone.skillRange[1]}/9\n`;
      message += `• Баланс: ±${flowTriggers.optimalZone.balance.toFixed(1)}\n\n`;
      
      message += '💡 <b>Рекомендация:</b> Стремитесь к балансу между сложностью задачи и вашими навыками в указанном диапазоне.';
    }
    
    return message;
  },
  
  async generateFullPredictionsReport(userId) {
    const predictions = await PredictiveAnalyticsService.generatePredictions(userId);
    
    let message = '🔮 <b>Полный прогноз</b>\n\n';
    
    if (predictions.predictions && Object.keys(predictions.predictions).length > 0) {
      // Тренды
      if (predictions.predictions.trendBased && !predictions.predictions.trendBased.insufficient_data) {
        message += '📈 <b>Тренды (2 недели):</b>\n';
        Object.entries(predictions.predictions.trendBased).forEach(([metric, trend]) => {
          const trendEmoji = trend.direction === 'increasing' ? '📈' : 
                           trend.direction === 'decreasing' ? '📉' : '➡️';
          message += `${trendEmoji} ${metric}: ${trend.direction}\n`;
        });
        message += '\n';
      }
      
      // Все рекомендации
      if (predictions.predictions.recommendations) {
        message += '💡 <b>Все рекомендации:</b>\n';
        predictions.predictions.recommendations.forEach(rec => {
          const emoji = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : '💡';
          message += `${emoji} ${rec.message}\n   ➡️ ${rec.action}\n\n`;
        });
      }
      
      // Уверенность
      message += `🎯 <b>Уверенность в прогнозе:</b> ${Math.round(predictions.confidence * 100)}%`;
    } else {
      message += 'Недостаточно данных для создания прогнозов. Продолжайте отвечать на опросы!';
    }
    
    return message;
  },
  
  async generateDetailedPatternsReport(userId) {
    const profile = await PatternAnalysisService.createUserProfile(userId);
    
    let message = '🔍 <b>Детальный анализ паттернов</b>\n\n';
    
    // Аномалии
    if (profile.anomalies && Array.isArray(profile.anomalies) && profile.anomalies.length > 0) {
      message += '⚠️ <b>Обнаруженные изменения:</b>\n';
      profile.anomalies.slice(0, 3).forEach(anomaly => {
        const emoji = anomaly.type === 'increase' ? '📈' : '📉';
        message += `${emoji} ${anomaly.metric}: ${anomaly.type === 'increase' ? 'повышение' : 'снижение'} `;
        message += `(сила: ${anomaly.magnitude.toFixed(1)})\n`;
      });
      message += '\n';
    }
    
    // Базовые инсайты из профиля
    if (profile.insights && profile.insights.length > 0) {
      message += '💡 <b>Основные закономерности:</b>\n';
      profile.insights.forEach(insight => {
        message += `• ${insight.message}\n`;
      });
    } else {
      message += '📊 Продолжайте собирать данные для обнаружения закономерностей.';
    }
    
    return message;
  },
  
  generateInsightsSettings() {
    return `⚙️ <b>Настройки инсайтов</b>\n\n` +
           `🤖 AI-анализ: Включен\n` +
           `🔮 Предсказания: Включены\n` +
           `📊 Анализ паттернов: Включен\n` +
           `⚠️ Уведомления об аномалиях: Включены\n\n` +
           `💡 Для более точного анализа:\n` +
           `• Отвечайте регулярно (3-5 раз в день)\n` +
           `• Указывайте конкретные активности\n` +
           `• Отмечайте социальный контекст\n` +
           `• Честно оценивайте навыки и вызовы`;
  }
};