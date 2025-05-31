const aiValidator = require('./ai-validator-service');
const Response = require('../models/Response');
const TrainingProgress = require('../models/TrainingProgress');
const config = require('../config/hurlburt');
const { recordAIUsage } = require('../utils/metrics');

/**
 * Адаптивный ИИ-коуч для персонализации обучения ESM
 * 
 * Анализирует прогресс пользователя и адаптирует программу обучения:
 * - Динамически определяет длительность обучения (2-5 дней)
 * - Генерирует персональные упражнения и подсказки
 * - Выявляет индивидуальные слабости и создает целевые интервенции
 * - Адаптирует сложность и фокус каждого дня
 */
class AdaptiveTrainingCoach {
  constructor() {
    this.aiService = aiValidator;
    this.config = config;
    
    // Профили обучения для разных типов пользователей
    this.learningProfiles = {
      'quick_learner': { 
        minDays: 2, 
        maxDays: 3,
        qualityThreshold: 80,
        focusAreas: ['precision', 'consistency']
      },
      'analytical': { 
        minDays: 3, 
        maxDays: 4,
        qualityThreshold: 75,
        focusAreas: ['illusion_detection', 'specificity'] 
      },
      'intuitive': { 
        minDays: 2, 
        maxDays: 4,
        qualityThreshold: 70,
        focusAreas: ['moment_capture', 'sensory_detail']
      },
      'struggling': { 
        minDays: 4, 
        maxDays: 5,
        qualityThreshold: 60,
        focusAreas: ['basic_awareness', 'simple_distinction']
      }
    };
  }

  /**
   * Основная функция адаптации плана обучения
   */
  async adaptTrainingPlan(userId, currentProgress) {
    try {
      console.log(`🎯 Adapting training plan for user ${userId}`);
      
      // 1. Анализируем текущий прогресс и слабости
      const analysis = await this.analyzeUserProgress(userId, currentProgress);
      
      // 2. Определяем профиль обучения
      const learningProfile = this.identifyLearningProfile(analysis);
      
      // 3. Генерируем персональные упражнения и подсказки
      const personalizedContent = await this.generatePersonalizedContent(analysis, learningProfile);
      
      // 4. Рассчитываем оптимальную длительность
      const recommendedDuration = this.calculateOptimalDuration(analysis, learningProfile);
      
      // 5. Создаем адаптированный план
      const adaptedPlan = {
        learningProfile: learningProfile.type,
        recommendedDuration,
        currentDay: analysis.currentDay,
        personalizedExercises: personalizedContent.exercises,
        dailyFocus: personalizedContent.dailyFocus,
        customMessages: personalizedContent.messages,
        interventions: personalizedContent.interventions,
        nextSteps: personalizedContent.nextSteps,
        qualityTarget: learningProfile.qualityThreshold,
        weaknessTargets: analysis.primaryWeaknesses,
        metadata: {
          analysisDate: new Date(),
          confidence: analysis.confidence,
          adaptationReason: analysis.adaptationReason
        }
      };

      // Сохраняем план в прогрессе пользователя
      await this.saveAdaptedPlan(userId, adaptedPlan);
      
      recordAIUsage('adaptive_coaching', true);
      console.log(`✅ Training plan adapted for ${learningProfile.type} learner`);
      
      return adaptedPlan;
      
    } catch (error) {
      console.error('Error adapting training plan:', error);
      recordAIUsage('adaptive_coaching', false);
      
      // Fallback к стандартному плану
      return this.createFallbackPlan(currentProgress);
    }
  }

  /**
   * Глубокий анализ прогресса пользователя
   */
  async analyzeUserProgress(userId, currentProgress) {
    // Получаем историю ответов
    const responses = await Response.find({ userId })
      .sort({ timestamp: -1 })
      .limit(20);
    
    if (responses.length === 0) {
      return this.createInitialAnalysis();
    }

    // Анализируем через ИИ
    const aiAnalysis = await this.performAIAnalysis(responses, currentProgress);
    
    // Объединяем с статистическим анализом
    const statisticalAnalysis = this.performStatisticalAnalysis(responses);
    
    return {
      currentDay: currentProgress?.getCurrentDay() || 1,
      totalResponses: responses.length,
      qualityTrend: aiAnalysis.qualityTrend,
      primaryWeaknesses: aiAnalysis.weaknesses,
      strengths: aiAnalysis.strengths,
      learningVelocity: statisticalAnalysis.learningVelocity,
      consistencyScore: statisticalAnalysis.consistencyScore,
      illusionPatterns: aiAnalysis.illusionPatterns,
      phenomenaProfile: statisticalAnalysis.phenomenaProfile,
      adaptationReason: aiAnalysis.adaptationReason,
      confidence: aiAnalysis.confidence || 0.7,
      riskFactors: aiAnalysis.riskFactors || []
    };
  }

  /**
   * ИИ-анализ прогресса пользователя
   */
  async performAIAnalysis(responses, currentProgress) {
    if (!this.aiService.isConfigured) {
      return this.createFallbackAnalysis(responses);
    }

    // Подготавливаем данные для ИИ
    const analysisData = this.prepareAnalysisData(responses);
    
    const prompt = `Проанализируй прогресс обучения ESM этого пользователя и предложи адаптации:

ДАННЫЕ ОТВЕТОВ:
${JSON.stringify(analysisData, null, 2)}

ТЕКУЩЕЕ СОСТОЯНИЕ:
- День обучения: ${currentProgress?.getCurrentDay() || 1}
- Общие ответы: ${responses.length}
- Средняя оценка качества: ${this.calculateAverageQuality(responses)}

ЗАДАЧА АНАЛИЗА:
1. Определи ТОП-3 слабости пользователя
2. Выяви паттерны иллюзий и ошибок  
3. Оцени скорость обучения (медленная/нормальная/быстрая)
4. Определи риски dropout или плохого качества
5. Предложи адаптации программы

ОСОБОЕ ВНИМАНИЕ:
- Иллюзия внутреннего голоса при чтении
- Использование обобщений вместо конкретики
- Ретроспективные описания вместо момента
- Эмоциональные ярлыки вместо телесных ощущений
- Теоретизирование вместо прямого опыта

Ответь в JSON формате:
{
  "qualityTrend": "improving|stable|declining",
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "strengths": ["strength1", "strength2"],
  "learningVelocity": "slow|normal|fast",
  "illusionPatterns": ["pattern1", "pattern2"],
  "adaptationReason": "краткое объяснение почему нужна адаптация",
  "confidence": 0.8,
  "riskFactors": ["risk1", "risk2"],
  "recommendedFocus": ["area1", "area2"]
}`;

    try {
      const result = await this.aiService.validate(prompt, { 
        isMetaAnalysis: true,
        userId: responses[0]?.userId
      });
      
      // Парсим и валидируем ответ ИИ
      return this.parseAIAnalysisResult(result);
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.createFallbackAnalysis(responses);
    }
  }

  /**
   * Статистический анализ ответов
   */
  performStatisticalAnalysis(responses) {
    const qualityScores = responses
      .map(r => r.metadata?.dataQualityScore)
      .filter(Boolean);
    
    const learningVelocity = this.calculateLearningVelocity(qualityScores);
    const consistencyScore = this.calculateConsistencyScore(responses);
    const phenomenaProfile = this.analyzePhenomenaProfile(responses);
    
    return {
      learningVelocity,
      consistencyScore,
      phenomenaProfile,
      averageQuality: qualityScores.length > 0 ? 
        qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 50,
      responseFrequency: this.calculateResponseFrequency(responses),
      timePatterns: this.analyzeTimePatterns(responses)
    };
  }

  /**
   * Определение профиля обучения
   */
  identifyLearningProfile(analysis) {
    const { learningVelocity, qualityTrend, primaryWeaknesses, riskFactors } = analysis;
    
    // Быстро обучающийся пользователь
    if (learningVelocity === 'fast' && qualityTrend === 'improving' && 
        analysis.averageQuality > 70) {
      return { 
        type: 'quick_learner', 
        ...this.learningProfiles.quick_learner,
        adaptations: ['accelerated_pace', 'advanced_concepts']
      };
    }
    
    // Аналитический тип
    if (primaryWeaknesses.includes('theoretical') || 
        primaryWeaknesses.includes('over_analysis')) {
      return { 
        type: 'analytical', 
        ...this.learningProfiles.analytical,
        adaptations: ['simplicity_focus', 'experiential_exercises']
      };
    }
    
    // Интуитивный тип
    if (primaryWeaknesses.includes('specificity') && 
        !primaryWeaknesses.includes('moment_capture')) {
      return { 
        type: 'intuitive', 
        ...this.learningProfiles.intuitive,
        adaptations: ['detail_training', 'structured_observation']
      };
    }
    
    // Struggling learner
    if (riskFactors.length > 2 || analysis.averageQuality < 50 || 
        learningVelocity === 'slow') {
      return { 
        type: 'struggling', 
        ...this.learningProfiles.struggling,
        adaptations: ['extended_practice', 'simplified_concepts', 'extra_support']
      };
    }
    
    // По умолчанию - стандартный профиль
    return { 
      type: 'analytical', 
      ...this.learningProfiles.analytical,
      adaptations: ['standard_progression']
    };
  }

  /**
   * Генерация персонализированного контента
   */
  async generatePersonalizedContent(analysis, learningProfile) {
    if (!this.aiService.isConfigured) {
      return this.createFallbackContent(analysis, learningProfile);
    }

    const prompt = `Создай персонализированную программу обучения ESM:

ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:
- Тип обучения: ${learningProfile.type}
- Основные слабости: ${analysis.primaryWeaknesses.join(', ')}
- Сильные стороны: ${analysis.strengths.join(', ')}
- Текущий день: ${analysis.currentDay}
- Паттерны иллюзий: ${analysis.illusionPatterns.join(', ')}

АДАПТАЦИИ: ${learningProfile.adaptations.join(', ')}

СОЗДАЙ:
1. Ежедневные упражнения (2-3 на день) для проработки слабостей
2. Персональные сообщения мотивации (короткие, конкретные)
3. Специальные интервенции для выявленных проблем
4. Фокус каждого дня обучения

ПРИНЦИПЫ:
- Упражнения должны быть практическими и специфичными
- Сообщения - мотивирующими, не критикующими  
- Интервенции - целенаправленными на конкретные иллюзии
- Прогрессия от простого к сложному

Ответь в JSON:
{
  "exercises": {
    "day1": [{"title": "...", "description": "...", "target": "weakness"}],
    "day2": [...],
    "day3": [...],
    "day4": [...] // если нужен
  },
  "messages": {
    "morning": ["...", "..."],
    "encouragement": ["...", "..."],
    "correction": ["...", "..."]
  },
  "interventions": [
    {"trigger": "generalization", "response": "...", "example": "..."}
  ],
  "dailyFocus": {
    "day1": "focus_area",
    "day2": "focus_area", 
    "day3": "focus_area"
  },
  "nextSteps": ["step1", "step2"]
}`;

    try {
      const result = await this.aiService.validate(prompt, { 
        isContentGeneration: true,
        learningProfile: learningProfile.type
      });
      
      return this.parsePersonalizedContent(result);
      
    } catch (error) {
      console.error('Personalized content generation failed:', error);
      return this.createFallbackContent(analysis, learningProfile);
    }
  }

  /**
   * Расчет оптимальной длительности обучения
   */
  calculateOptimalDuration(analysis, learningProfile) {
    let duration = learningProfile.minDays;
    
    // Увеличиваем длительность на основе факторов риска
    if (analysis.riskFactors.length > 2) duration += 1;
    if (analysis.learningVelocity === 'slow') duration += 1;
    if (analysis.averageQuality < 50) duration += 1;
    if (analysis.consistencyScore < 0.6) duration += 1;
    
    // Уменьшаем для быстро обучающихся
    if (analysis.learningVelocity === 'fast' && analysis.averageQuality > 70) {
      duration = Math.max(learningProfile.minDays, duration - 1);
    }
    
    // Ограничиваем пределами профиля
    return Math.min(learningProfile.maxDays, Math.max(learningProfile.minDays, duration));
  }

  /**
   * Сохранение адаптированного плана
   */
  async saveAdaptedPlan(userId, adaptedPlan) {
    try {
      const progress = await TrainingProgress.findOne({ userId });
      if (progress) {
        if (!progress.adaptiveCoaching) {
          progress.adaptiveCoaching = {};
        }
        
        progress.adaptiveCoaching = {
          ...adaptedPlan,
          createdAt: new Date(),
          version: (progress.adaptiveCoaching.version || 0) + 1
        };
        
        await progress.save();
        console.log(`💾 Adaptive plan saved for user ${userId}`);
      }
    } catch (error) {
      console.error('Error saving adaptive plan:', error);
    }
  }

  /**
   * Получение текущего адаптированного плана
   */
  async getAdaptivePlan(userId) {
    try {
      const progress = await TrainingProgress.findOne({ userId });
      return progress?.adaptiveCoaching || null;
    } catch (error) {
      console.error('Error getting adaptive plan:', error);
      return null;
    }
  }

  /**
   * Обновление плана на основе нового прогресса
   */
  async updatePlanBasedOnProgress(userId, newResponse) {
    const currentPlan = await this.getAdaptivePlan(userId);
    if (!currentPlan) return null;

    // Проверяем, нужно ли адаптировать план
    const needsUpdate = await this.shouldUpdatePlan(currentPlan, newResponse);
    
    if (needsUpdate) {
      console.log(`🔄 Updating adaptive plan for user ${userId}`);
      const progress = await TrainingProgress.findOne({ userId });
      return await this.adaptTrainingPlan(userId, progress);
    }
    
    return currentPlan;
  }

  /**
   * Вспомогательные методы
   */
  
  prepareAnalysisData(responses) {
    return responses.slice(0, 10).map(r => ({
      quality: r.metadata?.dataQualityScore || 0,
      text: r.responses?.currentThoughts?.substring(0, 100) || '',
      day: r.metadata?.trainingDay || 1,
      phenomena: r.metadata?.phenomenaDetected || [],
      issues: r.metadata?.validationAttempts || {},
      mood: r.responses?.mood,
      stress: r.responses?.stress,
      timestamp: r.timestamp
    }));
  }

  calculateAverageQuality(responses) {
    const scores = responses
      .map(r => r.metadata?.dataQualityScore)
      .filter(Boolean);
    
    return scores.length > 0 ? 
      Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
  }

  calculateLearningVelocity(qualityScores) {
    if (qualityScores.length < 3) return 'normal';
    
    const firstHalf = qualityScores.slice(-Math.ceil(qualityScores.length / 2));
    const secondHalf = qualityScores.slice(0, Math.floor(qualityScores.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const improvement = firstAvg - secondAvg;
    
    if (improvement > 20) return 'fast';
    if (improvement < 5) return 'slow';
    return 'normal';
  }

  calculateConsistencyScore(responses) {
    // Анализируем консистентность между настроением, стрессом и качеством ответов
    let consistentPairs = 0;
    let totalPairs = 0;
    
    responses.forEach(r => {
      const mood = r.responses?.mood;
      const stress = r.responses?.stress;
      const quality = r.metadata?.dataQualityScore;
      
      if (mood && stress && quality) {
        totalPairs++;
        
        // Высокое качество должно коррелировать с балансом mood/stress
        const isBalanced = Math.abs(mood - (8 - stress)) < 2;
        const isHighQuality = quality > 60;
        
        if ((isBalanced && isHighQuality) || (!isBalanced && !isHighQuality)) {
          consistentPairs++;
        }
      }
    });
    
    return totalPairs > 0 ? consistentPairs / totalPairs : 0.5;
  }

  analyzePhenomenaProfile(responses) {
    const phenomena = {};
    
    responses.forEach(r => {
      const detected = r.metadata?.phenomenaDetected || [];
      detected.forEach(p => {
        phenomena[p.type] = (phenomena[p.type] || 0) + 1;
      });
    });
    
    return phenomena;
  }

  calculateResponseFrequency(responses) {
    if (responses.length < 2) return 'unknown';
    
    const times = responses.map(r => new Date(r.timestamp).getTime());
    const intervals = [];
    
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i-1] - times[i]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const hours = avgInterval / (1000 * 60 * 60);
    
    if (hours < 2) return 'very_frequent';
    if (hours < 6) return 'frequent';
    if (hours < 12) return 'normal';
    return 'infrequent';
  }

  analyzeTimePatterns(responses) {
    const hours = responses.map(r => new Date(r.timestamp).getHours());
    const timeDistribution = {};
    
    hours.forEach(hour => {
      const period = hour < 6 ? 'night' : 
                   hour < 12 ? 'morning' :
                   hour < 18 ? 'afternoon' : 'evening';
      timeDistribution[period] = (timeDistribution[period] || 0) + 1;
    });
    
    return timeDistribution;
  }

  parseAIAnalysisResult(result) {
    // Базовая структура с fallback значениями
    const fallback = {
      qualityTrend: 'stable',
      weaknesses: ['specificity', 'moment_focus'],
      strengths: ['engagement'],
      learningVelocity: 'normal',
      illusionPatterns: [],
      adaptationReason: 'Standard adaptation',
      confidence: 0.5,
      riskFactors: []
    };

    try {
      if (result && typeof result === 'object') {
        return {
          ...fallback,
          ...result,
          confidence: Math.min(1, Math.max(0, result.confidence || 0.5))
        };
      }
      
      // Попытка парсинга JSON из текста
      if (typeof result === 'string') {
        const parsed = JSON.parse(result);
        return { ...fallback, ...parsed };
      }
      
      return fallback;
    } catch (error) {
      console.error('Error parsing AI analysis result:', error);
      return fallback;
    }
  }

  parsePersonalizedContent(result) {
    const fallback = this.createFallbackContent({}, { type: 'analytical' });
    
    try {
      if (result && typeof result === 'object') {
        return {
          exercises: result.exercises || fallback.exercises,
          messages: result.messages || fallback.messages,
          interventions: result.interventions || fallback.interventions,
          dailyFocus: result.dailyFocus || fallback.dailyFocus,
          nextSteps: result.nextSteps || fallback.nextSteps
        };
      }
      
      return fallback;
    } catch (error) {
      console.error('Error parsing personalized content:', error);
      return fallback;
    }
  }

  createInitialAnalysis() {
    return {
      currentDay: 1,
      totalResponses: 0,
      qualityTrend: 'unknown',
      primaryWeaknesses: ['moment_capture', 'specificity'],
      strengths: [],
      learningVelocity: 'normal',
      consistencyScore: 0.5,
      illusionPatterns: [],
      phenomenaProfile: {},
      adaptationReason: 'Initial assessment',
      confidence: 0.3,
      riskFactors: [],
      averageQuality: 50
    };
  }

  createFallbackAnalysis(responses) {
    const avgQuality = this.calculateAverageQuality(responses);
    
    return {
      currentDay: responses.length > 0 ? 
        (responses[0].metadata?.trainingDay || 1) : 1,
      totalResponses: responses.length,
      qualityTrend: avgQuality > 60 ? 'improving' : 'stable',
      primaryWeaknesses: avgQuality < 50 ? 
        ['moment_capture', 'specificity', 'consistency'] :
        ['specificity', 'sensory_detail'],
      strengths: ['engagement'],
      learningVelocity: 'normal',
      consistencyScore: 0.6,
      illusionPatterns: ['generalization'],
      phenomenaProfile: {},
      adaptationReason: 'Fallback analysis due to AI unavailability',
      confidence: 0.4,
      riskFactors: avgQuality < 40 ? ['low_quality', 'inconsistency'] : [],
      averageQuality: avgQuality
    };
  }

  createFallbackContent(analysis, learningProfile) {
    return {
      exercises: {
        day1: [
          {
            title: "Упражнение на захват момента",
            description: "Поставьте таймер на 5 минут. Каждые 2 минуты останавливайтесь и записывайте: что ИМЕННО сейчас в сознании?",
            target: "moment_capture"
          }
        ],
        day2: [
          {
            title: "Детализация опыта",
            description: "При следующем сигнале опишите 3 сенсорные детали: что видели, слышали, чувствовали телом.",
            target: "sensory_detail"
          }
        ],
        day3: [
          {
            title: "Различение опыта и интерпретации",
            description: "Опишите ваш опыт, затем отдельно - что вы думаете об этом опыте. В чем разница?",
            target: "pure_experience"
          }
        ]
      },
      messages: {
        morning: [
          "🌅 Сегодня фокусируйтесь на моменте сигнала!",
          "💡 Помните: описывайте ТО, что было, не то, что обычно бывает"
        ],
        encouragement: [
          "👍 Вы делаете прогресс в точном наблюдении!",
          "🎯 Каждый ответ приближает вас к мастерству"
        ],
        correction: [
          "🔍 Попробуйте быть более конкретным в следующий раз",
          "⏰ Вернитесь к моменту сигнала - что было ТОГДА?"
        ]
      },
      interventions: [
        {
          trigger: "generalization",
          response: "Заметили обобщение! Что конкретно было в ТОТ момент?",
          example: "Вместо 'обычно думаю' → 'видел слово Херлберт на экране'"
        }
      ],
      dailyFocus: {
        day1: "moment_capture",
        day2: "sensory_detail", 
        day3: "pure_experience"
      },
      nextSteps: [
        "Продолжайте практиковать точное наблюдение",
        "Обращайте внимание на различие между опытом и мыслями об опыте"
      ]
    };
  }

  createFallbackPlan(currentProgress) {
    return {
      learningProfile: 'standard',
      recommendedDuration: 3,
      currentDay: currentProgress?.getCurrentDay() || 1,
      personalizedExercises: this.createFallbackContent({}, { type: 'analytical' }).exercises,
      dailyFocus: { day1: 'moment_capture', day2: 'specificity', day3: 'consistency' },
      customMessages: this.createFallbackContent({}, { type: 'analytical' }).messages,
      interventions: this.createFallbackContent({}, { type: 'analytical' }).interventions,
      nextSteps: ['Continue standard training progression'],
      qualityTarget: 70,
      weaknessTargets: ['specificity', 'moment_focus'],
      metadata: {
        analysisDate: new Date(),
        confidence: 0.3,
        adaptationReason: 'Fallback due to analysis failure',
        isFallback: true
      }
    };
  }

  shouldUpdatePlan(currentPlan, newResponse) {
    // Обновляем план если:
    // 1. Качество значительно изменилось
    // 2. Обнаружены новые паттерны
    // 3. Прошло больше 24 часов с последнего обновления
    
    const hoursSinceUpdate = (Date.now() - new Date(currentPlan.metadata.analysisDate)) / (1000 * 60 * 60);
    const qualityChange = Math.abs((newResponse.metadata?.dataQualityScore || 50) - (currentPlan.qualityTarget || 70));
    
    return hoursSinceUpdate > 24 || qualityChange > 30;
  }
}

module.exports = new AdaptiveTrainingCoach();