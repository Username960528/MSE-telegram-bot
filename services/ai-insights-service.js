const config = require('../config/hurlburt');
const PatternAnalysisService = require('./pattern-analysis-service');

/**
 * AI-сервис для генерации персональных инсайтов на основе паттернов поведения
 */
class AIInsightsService {
  constructor() {
    this.config = config.ai;
    this.isConfigured = false;
    this.provider = null;
    this.cache = new Map();
    
    this.initializeProvider();
  }
  
  initializeProvider() {
    try {
      // Используем конфигурацию из того же config что и ai-validator
      if (process.env.OPENAI_API_KEY && this.config.provider === 'openai') {
        this.provider = 'openai';
        this.isConfigured = true;
      } else if (process.env.ANTHROPIC_API_KEY && this.config.provider === 'anthropic') {
        this.provider = 'anthropic';
        this.isConfigured = true;
      }
      
      if (this.isConfigured) {
        console.log(`AI Insights Service configured with ${this.provider}`);
      }
    } catch (error) {
      console.warn('AI Insights Service not configured:', error.message);
    }
  }
  
  // Генерация персональных инсайтов на основе профиля пользователя
  async generatePersonalInsights(userId) {
    try {
      const userProfile = await PatternAnalysisService.createUserProfile(userId);
      
      if (!this.isConfigured) {
        return this.generateFallbackInsights(userProfile);
      }
      
      // Проверяем кэш
      const cacheKey = `insights_${userId}_${Math.floor(Date.now() / (1000 * 60 * 60 * 6))}`; // Кэш на 6 часов
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      const prompt = this.createInsightsPrompt(userProfile);
      const aiResponse = await this.callAI(prompt);
      const insights = this.parseAIResponse(aiResponse);
      
      // Сохраняем в кэш
      this.cache.set(cacheKey, insights);
      
      return insights;
    } catch (error) {
      console.error('Error generating AI insights:', error);
      const userProfile = await PatternAnalysisService.createUserProfile(userId);
      return this.generateFallbackInsights(userProfile);
    }
  }
  
  // Генерация предиктивных инсайтов
  async generatePredictiveInsights(userId, context = {}) {
    try {
      const userProfile = await PatternAnalysisService.createUserProfile(userId);
      
      if (!this.isConfigured) {
        return this.generateFallbackPredictions(userProfile, context);
      }
      
      const prompt = this.createPredictivePrompt(userProfile, context);
      const aiResponse = await this.callAI(prompt);
      const predictions = this.parsePredictiveResponse(aiResponse);
      
      return predictions;
    } catch (error) {
      console.error('Error generating predictive insights:', error);
      const userProfile = await PatternAnalysisService.createUserProfile(userId);
      return this.generateFallbackPredictions(userProfile, context);
    }
  }
  
  // Создание промпта для генерации инсайтов
  createInsightsPrompt(userProfile) {
    const { timePatterns, activityPatterns, socialPatterns, correlations, anomalies } = userProfile;
    
    return `Ты - эксперт по анализу поведения и психологии. Проанализируй паттерны пользователя и создай персональные инсайты.

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
${JSON.stringify({
  timePatterns: timePatterns?.insufficient_data ? 'Недостаточно данных' : timePatterns,
  activityPatterns: Object.keys(activityPatterns || {}).length === 0 ? 'Недостаточно данных' : activityPatterns,
  socialPatterns: Object.keys(socialPatterns || {}).length === 0 ? 'Недостаточно данных' : socialPatterns,
  correlations: correlations?.insufficient_data ? 'Недостаточно данных' : correlations,
  anomalies: anomalies?.insufficient_data ? 'Недостаточно данных' : anomalies
}, null, 2)}

ЗАДАЧА:
Создай 3-5 персональных инсайтов в формате JSON. Каждый инсайт должен:
1. Быть основан на реальных данных
2. Быть понятным и действенным
3. Содержать конкретные рекомендации
4. Иметь эмоциональный подтекст поддержки

ФОРМАТ ОТВЕТА:
{
  "insights": [
    {
      "type": "temporal" | "activity" | "social" | "correlation" | "anomaly",
      "title": "Краткий заголовок",
      "description": "Подробное описание паттерна",
      "recommendation": "Конкретная рекомендация",
      "confidence": 0.0-1.0,
      "emoji": "подходящая эмодзи"
    }
  ]
}

Пиши на русском языке, используй дружелюбный тон.`;
  }
  
  // Создание промпта для предиктивной аналитики
  createPredictivePrompt(userProfile, context) {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentWeekday = currentTime.getDay();
    
    return `Ты - эксперт по предиктивной аналитике поведения. На основе паттернов пользователя предскажи его вероятное состояние.

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
${JSON.stringify(userProfile, null, 2)}

ТЕКУЩИЙ КОНТЕКСТ:
- Время: ${currentHour}:00
- День недели: ${['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][currentWeekday]}
- Дополнительный контекст: ${JSON.stringify(context)}

ЗАДАЧА:
Создай предсказания в формате JSON:

{
  "predictions": [
    {
      "type": "mood" | "energy" | "stress" | "flow_likelihood",
      "predicted_value": число от 1-7 или 0-9,
      "confidence": 0.0-1.0,
      "reasoning": "Объяснение на основе паттернов",
      "recommendation": "Что можно сделать для улучшения",
      "time_frame": "следующие 2 часа" | "сегодня" | "завтра"
    }
  ],
  "alerts": [
    {
      "type": "warning" | "opportunity",
      "message": "Предупреждение или возможность",
      "action": "Рекомендуемое действие"
    }
  ]
}

Отвечай на русском языке.`;
  }
  
  // Вызов AI API
  async callAI(prompt) {
    if (this.provider === 'openai') {
      return await this.callOpenAI(prompt);
    } else if (this.provider === 'anthropic') {
      return await this.callAnthropic(prompt);
    }
    throw new Error('No AI provider configured');
  }
  
  async callOpenAI(prompt) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Ты эксперт по анализу поведения и персональной аналитике. Отвечай только в формате JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }),
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  async callAnthropic(prompt) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      }),
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  // Парсинг ответа AI для инсайтов
  parseAIResponse(response) {
    try {
      const parsed = JSON.parse(response);
      
      // Валидация структуры
      if (!parsed.insights || !Array.isArray(parsed.insights)) {
        throw new Error('Invalid response structure');
      }
      
      // Дополнительная обработка инсайтов
      parsed.insights = parsed.insights.map(insight => ({
        ...insight,
        id: this.generateInsightId(insight),
        generated_at: new Date().toISOString(),
        source: 'ai'
      }));
      
      return parsed;
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return { insights: [], error: 'Failed to parse AI response' };
    }
  }
  
  // Парсинг ответа AI для предсказаний
  parsePredictiveResponse(response) {
    try {
      const parsed = JSON.parse(response);
      
      // Валидация структуры
      if (!parsed.predictions || !Array.isArray(parsed.predictions)) {
        throw new Error('Invalid prediction response structure');
      }
      
      return {
        ...parsed,
        generated_at: new Date().toISOString(),
        source: 'ai'
      };
    } catch (error) {
      console.error('Error parsing predictive response:', error);
      return { predictions: [], alerts: [], error: 'Failed to parse prediction response' };
    }
  }
  
  // Fallback инсайты на случай недоступности AI
  generateFallbackInsights(userProfile) {
    const insights = [];
    const { timePatterns, activityPatterns, socialPatterns, anomalies } = userProfile;
    
    // Временные паттерны
    if (timePatterns && !timePatterns.insufficient_data) {
      const hourlyData = timePatterns.hourly;
      let bestHour = null;
      let bestMood = 0;
      
      Object.entries(hourlyData).forEach(([hour, data]) => {
        if (data.count >= 2 && data.mood.avg > bestMood) {
          bestMood = data.mood.avg;
          bestHour = hour;
        }
      });
      
      if (bestHour) {
        insights.push({
          type: 'temporal',
          title: 'Лучшее время дня',
          description: `Ваше настроение лучше всего в ${bestHour}:00 (среднее: ${bestMood.toFixed(1)})`,
          recommendation: `Планируйте важные дела на ${bestHour}:00 для максимальной эффективности`,
          confidence: 0.8,
          emoji: '⏰',
          source: 'rule_based'
        });
      }
    }
    
    // Паттерны активности
    if (activityPatterns && Object.keys(activityPatterns).length > 0) {
      const activities = Object.entries(activityPatterns)
        .sort((a, b) => b[1].mood.avg - a[1].mood.avg)
        .slice(0, 2);
      
      if (activities.length > 0) {
        const [bestActivity, data] = activities[0];
        insights.push({
          type: 'activity',
          title: 'Любимая активность',
          description: `Активность "${bestActivity}" повышает ваше настроение (среднее: ${data.mood.avg.toFixed(1)})`,
          recommendation: `Уделяйте больше времени активности "${bestActivity}" для улучшения настроения`,
          confidence: 0.7,
          emoji: '🎯',
          source: 'rule_based'
        });
      }
    }
    
    // Аномалии
    if (anomalies && Array.isArray(anomalies) && anomalies.length > 0) {
      anomalies.forEach(anomaly => {
        insights.push({
          type: 'anomaly',
          title: anomaly.type === 'increase' ? 'Улучшение показателей' : 'Изменение в поведении',
          description: `Заметно ${anomaly.type === 'increase' ? 'повышение' : 'снижение'} ${anomaly.metric} за последнюю неделю`,
          recommendation: anomaly.type === 'decrease' ? 
            'Обратите внимание на факторы, которые могли повлиять на это изменение' :
            'Отлично! Попробуйте понять, что способствовало этому улучшению',
          confidence: 0.6,
          emoji: anomaly.type === 'increase' ? '📈' : '📉',
          source: 'rule_based'
        });
      });
    }
    
    // Если нет данных
    if (insights.length === 0) {
      insights.push({
        type: 'general',
        title: 'Начало анализа',
        description: 'Продолжайте отвечать на опросы для получения персональных инсайтов',
        recommendation: 'Отвечайте на 3-5 опросов в день для качественного анализа ваших паттернов',
        confidence: 1.0,
        emoji: '🌱',
        source: 'rule_based'
      });
    }
    
    return { insights };
  }
  
  // Fallback предсказания
  generateFallbackPredictions(userProfile, context) {
    const currentHour = new Date().getHours();
    const predictions = [];
    const alerts = [];
    
    // Простые правила на основе времени
    if (currentHour >= 14 && currentHour <= 16) {
      predictions.push({
        type: 'energy',
        predicted_value: 4,
        confidence: 0.6,
        reasoning: 'Послеобеденное время часто связано со снижением энергии',
        recommendation: 'Сделайте короткую прогулку или выпейте воды',
        time_frame: 'следующие 2 часа'
      });
    }
    
    if (currentHour >= 18) {
      alerts.push({
        type: 'opportunity',
        message: 'Хорошее время для рефлексии',
        action: 'Потратьте 5 минут на анализ прошедшего дня'
      });
    }
    
    return { predictions, alerts, source: 'rule_based' };
  }
  
  // Генерация уникального ID для инсайта
  generateInsightId(insight) {
    const content = `${insight.type}_${insight.title}_${insight.description}`;
    return require('crypto').createHash('md5').update(content).digest('hex').substring(0, 8);
  }
  
  // Получение краткого статуса для быстрого показа
  async generateQuickInsight(userId) {
    try {
      const anomalies = await PatternAnalysisService.detectAnomalies(userId, 3);
      const timePatterns = await PatternAnalysisService.analyzeTimePatterns(userId, 7);
      
      const currentHour = new Date().getHours();
      
      // Быстрая оценка на основе текущего времени
      if (timePatterns && !timePatterns.insufficient_data) {
        const currentHourData = timePatterns.hourly[currentHour];
        if (currentHourData && currentHourData.count >= 2) {
          const expectedMood = currentHourData.mood.avg;
          return {
            type: 'quick',
            message: `В это время ваше настроение обычно ${expectedMood > 5 ? 'хорошее' : expectedMood > 3 ? 'нормальное' : 'ниже среднего'}`,
            emoji: expectedMood > 5 ? '😊' : expectedMood > 3 ? '😐' : '😔',
            confidence: 0.7
          };
        }
      }
      
      return {
        type: 'quick',
        message: 'Продолжайте отмечать свои состояния для персональных инсайтов',
        emoji: '📊',
        confidence: 1.0
      };
    } catch (error) {
      console.error('Error generating quick insight:', error);
      return {
        type: 'quick',
        message: 'Каждый ответ помогает лучше понять ваши паттерны',
        emoji: '🎯',
        confidence: 1.0
      };
    }
  }
}

module.exports = AIInsightsService;