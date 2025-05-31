const Response = require('../models/Response');
const TrainingProgress = require('../models/TrainingProgress');
const aiValidator = require('./ai-validator-service');

/**
 * Адаптивный калькулятор длительности обучения ESM
 * 
 * Динамически определяет оптимальную длительность обучения (2-7 дней) на основе:
 * - Скорости освоения навыков пользователем
 * - Качества и консистентности ответов  
 * - Выявленных слабостей и рисков
 * - Предиктивного моделирования через ИИ
 */
class AdaptiveDurationCalculator {
  constructor() {
    this.aiService = aiValidator;
    
    // Базовые параметры длительности
    this.durationLimits = {
      minimum: 2,  // Минимум для любого пользователя
      maximum: 7,  // Максимум даже для самых сложных случаев
      standard: 3  // Стандартное значение
    };
    
    // Факторы, влияющие на длительность
    this.durationFactors = {
      // Положительные факторы (сокращают обучение)
      positive: {
        'fast_learner': { impact: -1, description: 'Быстрое освоение' },
        'high_initial_quality': { impact: -1, description: 'Высокое начальное качество' },
        'consistent_improvement': { impact: -0.5, description: 'Стабильное улучшение' },
        'no_major_illusions': { impact: -0.5, description: 'Отсутствие серьезных иллюзий' },
        'good_metacognition': { impact: -0.5, description: 'Хорошая метакогниция' },
        'minimal_resistance': { impact: -0.5, description: 'Минимальное сопротивление' }
      },
      
      // Негативные факторы (удлиняют обучение)
      negative: {
        'persistent_illusions': { impact: 1.5, description: 'Устойчивые иллюзии' },
        'low_quality_plateau': { impact: 1, description: 'Плато низкого качества' },
        'inconsistent_responses': { impact: 1, description: 'Непоследовательные ответы' },
        'avoidance_behavior': { impact: 1, description: 'Избегающее поведение' },
        'over_theorizing': { impact: 0.5, description: 'Избыточное теоретизирование' },
        'poor_moment_capture': { impact: 1, description: 'Плохой захват момента' },
        'multiple_risk_factors': { impact: 1, description: 'Множественные факторы риска' },
        'dropout_risk': { impact: 2, description: 'Риск прекращения обучения' }
      },
      
      // Нейтральные модификаторы
      contextual: {
        'analytical_personality': { impact: 0.5, description: 'Аналитический тип личности' },
        'previous_meditation': { impact: -0.3, description: 'Опыт медитации' },
        'psychology_background': { impact: 0, description: 'Психологическое образование' },
        'high_motivation': { impact: -0.3, description: 'Высокая мотивация' }
      }
    };
    
    // Пороги качества для принятия решений
    this.qualityThresholds = {
      excellent: 85,
      good: 70,
      acceptable: 55,
      poor: 40,
      unacceptable: 25
    };
    
    // Модели прогрессии для предсказания
    this.progressionModels = {
      linear: 'Равномерное улучшение',
      exponential: 'Быстрый рост после медленного старта',
      logarithmic: 'Быстрый рост в начале, затем плато',
      oscillating: 'Нестабильный прогресс с колебаниями',
      plateau: 'Достижение плато без значимых изменений'
    };
  }

  /**
   * Основная функция расчета адаптивной длительности
   */
  async calculateAdaptiveDuration(userId, currentProgress, context = {}) {
    try {
      console.log(`⏱️ Calculating adaptive duration for user ${userId}`);
      
      // Собираем данные для анализа
      const analysisData = await this.gatherAnalysisData(userId, currentProgress);
      
      // Анализируем факторы, влияющие на длительность
      const factorAnalysis = await this.analyzeDurationFactors(analysisData);
      
      // Предсказываем траекторию обучения
      const learningTrajectory = await this.predictLearningTrajectory(analysisData, factorAnalysis);
      
      // Рассчитываем базовую длительность
      const baseDuration = this.calculateBaseDuration(factorAnalysis);
      
      // Применяем ИИ-коррекцию если доступно
      let aiAdjustment = null;
      if (this.aiService.isConfigured && context.enableAI !== false) {
        aiAdjustment = await this.getAIAdjustment(analysisData, factorAnalysis, baseDuration);
      }
      
      // Финальный расчет с учетом всех факторов
      const finalDuration = this.calculateFinalDuration(
        baseDuration, 
        aiAdjustment, 
        learningTrajectory,
        context
      );
      
      // Создаем детальный отчет
      const durationReport = this.createDurationReport(
        finalDuration,
        factorAnalysis,
        learningTrajectory,
        aiAdjustment
      );
      
      console.log(`✅ Recommended duration: ${finalDuration} days (was ${this.durationLimits.standard})`);
      return durationReport;
      
    } catch (error) {
      console.error('Error calculating adaptive duration:', error);
      return this.createFallbackDuration(userId);
    }
  }

  /**
   * Сбор данных для анализа
   */
  async gatherAnalysisData(userId, currentProgress) {
    // Получаем ответы пользователя
    const responses = await Response.find({ userId })
      .sort({ timestamp: -1 })
      .limit(30);
    
    // Получаем данные прогресса
    const progressData = await TrainingProgress.findOne({ userId });
    
    // Анализируем качество по дням
    const dailyQuality = this.analyzeDailyQuality(responses);
    
    // Анализируем консистентность
    const consistencyMetrics = this.analyzeConsistency(responses);
    
    // Анализируем скорость обучения
    const learningVelocity = this.calculateLearningVelocity(responses);
    
    // Анализируем проблемные паттерны
    const problemPatterns = this.identifyProblemPatterns(responses);
    
    return {
      userId,
      currentDay: currentProgress?.getCurrentDay() || 1,
      totalResponses: responses.length,
      responses: responses.slice(0, 15), // Ограничиваем для анализа
      dailyQuality,
      consistencyMetrics,
      learningVelocity,
      problemPatterns,
      progressData,
      analysisDate: new Date()
    };
  }

  /**
   * Анализ факторов длительности
   */
  async analyzeDurationFactors(analysisData) {
    const detectedFactors = {
      positive: [],
      negative: [],
      contextual: []
    };
    
    const { dailyQuality, learningVelocity, consistencyMetrics, problemPatterns } = analysisData;
    
    // Анализируем позитивные факторы
    if (learningVelocity.trend === 'fast') {
      detectedFactors.positive.push('fast_learner');
    }
    
    if (dailyQuality.average > this.qualityThresholds.good) {
      detectedFactors.positive.push('high_initial_quality');
    }
    
    if (learningVelocity.consistency > 0.8) {
      detectedFactors.positive.push('consistent_improvement');
    }
    
    if (problemPatterns.majorIllusions.length === 0) {
      detectedFactors.positive.push('no_major_illusions');
    }
    
    if (consistencyMetrics.metacognitionScore > 0.7) {
      detectedFactors.positive.push('good_metacognition');
    }
    
    // Анализируем негативные факторы
    if (problemPatterns.persistentIllusions.length > 2) {
      detectedFactors.negative.push('persistent_illusions');
    }
    
    if (dailyQuality.average < this.qualityThresholds.acceptable && 
        analysisData.currentDay > 2) {
      detectedFactors.negative.push('low_quality_plateau');
    }
    
    if (consistencyMetrics.variability > 0.6) {
      detectedFactors.negative.push('inconsistent_responses');
    }
    
    if (problemPatterns.avoidanceCount > analysisData.totalResponses * 0.3) {
      detectedFactors.negative.push('avoidance_behavior');
    }
    
    if (problemPatterns.theorizingCount > analysisData.totalResponses * 0.4) {
      detectedFactors.negative.push('over_theorizing');
    }
    
    if (problemPatterns.momentCaptureIssues > analysisData.totalResponses * 0.5) {
      detectedFactors.negative.push('poor_moment_capture');
    }
    
    if (this.assessDropoutRisk(analysisData) > 0.7) {
      detectedFactors.negative.push('dropout_risk');
    }
    
    // Контекстуальные факторы (требуют дополнительных данных)
    // Эти можно добавить через профиль пользователя или анкету
    
    return {
      detectedFactors,
      factorScores: this.calculateFactorScores(detectedFactors),
      totalImpact: this.calculateTotalImpact(detectedFactors),
      riskLevel: this.assessOverallRisk(detectedFactors)
    };
  }

  /**
   * Предсказание траектории обучения
   */
  async predictLearningTrajectory(analysisData, factorAnalysis) {
    const qualityProgression = analysisData.dailyQuality.progression;
    
    // Определяем модель прогрессии
    const progressionModel = this.identifyProgressionModel(qualityProgression);
    
    // Предсказываем следующие дни
    const predictions = this.generatePredictions(qualityProgression, progressionModel, factorAnalysis);
    
    // Оцениваем время до достижения цели
    const timeToGoal = this.estimateTimeToGoal(predictions, this.qualityThresholds.good);
    
    return {
      model: progressionModel,
      predictions,
      timeToGoal,
      confidence: this.calculatePredictionConfidence(qualityProgression),
      plateauRisk: this.assessPlateauRisk(qualityProgression, factorAnalysis),
      optimalStoppingPoint: this.findOptimalStoppingPoint(predictions)
    };
  }

  /**
   * Расчет базовой длительности
   */
  calculateBaseDuration(factorAnalysis) {
    let baseDuration = this.durationLimits.standard;
    
    // Применяем влияние факторов
    baseDuration += factorAnalysis.totalImpact;
    
    // Ограничиваем пределами
    baseDuration = Math.max(this.durationLimits.minimum, baseDuration);
    baseDuration = Math.min(this.durationLimits.maximum, baseDuration);
    
    return Math.round(baseDuration);
  }

  /**
   * ИИ-коррекция длительности
   */
  async getAIAdjustment(analysisData, factorAnalysis, baseDuration) {
    if (!this.aiService.isConfigured) return null;

    const prompt = `Проанализируй данные обучения ESM и скорректируй рекомендуемую длительность:

ТЕКУЩИЕ ДАННЫЕ:
- Базовая длительность: ${baseDuration} дней
- Текущий день: ${analysisData.currentDay}
- Среднее качество: ${analysisData.dailyQuality.average}%
- Скорость обучения: ${analysisData.learningVelocity.trend}
- Консистентность: ${Math.round(analysisData.consistencyMetrics.variability * 100)}%

ВЫЯВЛЕННЫЕ ФАКТОРЫ:
Позитивные: ${factorAnalysis.detectedFactors.positive.join(', ') || 'нет'}
Негативные: ${factorAnalysis.detectedFactors.negative.join(', ') || 'нет'}

ПРОБЛЕМНЫЕ ПАТТЕРНЫ:
- Устойчивые иллюзии: ${analysisData.problemPatterns.persistentIllusions.join(', ') || 'нет'}
- Избегание: ${analysisData.problemPatterns.avoidanceCount} случаев
- Проблемы с моментом: ${analysisData.problemPatterns.momentCaptureIssues} случаев

ТРАЕКТОРИЯ КАЧЕСТВА:
${JSON.stringify(analysisData.dailyQuality.progression)}

ЗАДАЧА:
Определи оптимальную длительность обучения (2-7 дней), учитывая:

1. ИНДИВИДУАЛЬНУЮ СКОРОСТЬ ОБУЧЕНИЯ
   - Быстрые ученики могут закончить за 2-3 дня
   - Медленные требуют 5-7 дней

2. КРИТИЧЕСКИЕ ПРОБЛЕМЫ  
   - Устойчивые иллюзии требуют дополнительного времени
   - Плохой захват момента - основа всего обучения

3. ПРЕДОТВРАЩЕНИЕ ПЕРЕОБУЧЕНИЯ
   - Не растягивать без необходимости
   - Оптимизировать мотивацию

4. РИСК DROPOUT
   - Слишком долго = потеря интереса
   - Слишком быстро = недостаточное освоение

Ответь в JSON:
{
  "recommendedDuration": 3,
  "adjustment": 0,
  "reasoning": "краткое объяснение рекомендации",
  "confidence": 0.8,
  "alternatives": [
    {"duration": 2, "condition": "если быстрый прогресс продолжится"},
    {"duration": 4, "condition": "если возникнут дополнительные проблемы"}
  ],
  "keyMilestones": [
    {"day": 2, "goal": "цель второго дня"},
    {"day": 3, "goal": "цель третьего дня"}
  ],
  "stopConditions": ["условие1", "условие2"],
  "continueConditions": ["условие1", "условие2"]
}`;

    try {
      const result = await this.aiService.validate(prompt, { 
        isDurationAnalysis: true,
        userId: analysisData.userId
      });
      
      return this.parseAIAdjustmentResult(result);
      
    } catch (error) {
      console.error('AI duration adjustment failed:', error);
      return null;
    }
  }

  /**
   * Финальный расчет длительности
   */
  calculateFinalDuration(baseDuration, aiAdjustment, learningTrajectory, context) {
    let finalDuration = baseDuration;
    
    // Применяем ИИ-коррекцию если есть
    if (aiAdjustment?.adjustment) {
      finalDuration += aiAdjustment.adjustment;
    }
    
    // Коррекция на основе траектории
    if (learningTrajectory.plateauRisk > 0.8) {
      finalDuration += 1; // Добавляем день для преодоления плато
    }
    
    if (learningTrajectory.optimalStoppingPoint && 
        learningTrajectory.optimalStoppingPoint < finalDuration) {
      finalDuration = learningTrajectory.optimalStoppingPoint;
    }
    
    // Контекстуальные коррекции
    if (context.urgentCompletion) {
      finalDuration = Math.max(this.durationLimits.minimum, finalDuration - 1);
    }
    
    if (context.thoroughTraining) {
      finalDuration = Math.min(this.durationLimits.maximum, finalDuration + 1);
    }
    
    // Финальные ограничения
    finalDuration = Math.max(this.durationLimits.minimum, finalDuration);
    finalDuration = Math.min(this.durationLimits.maximum, finalDuration);
    
    return Math.round(finalDuration);
  }

  /**
   * Создание отчета о длительности
   */
  createDurationReport(finalDuration, factorAnalysis, learningTrajectory, aiAdjustment) {
    return {
      recommendedDuration: finalDuration,
      originalDuration: this.durationLimits.standard,
      adjustment: finalDuration - this.durationLimits.standard,
      
      rationale: {
        primaryReasons: this.extractPrimaryReasons(factorAnalysis, learningTrajectory),
        factorImpact: factorAnalysis.totalImpact,
        riskLevel: factorAnalysis.riskLevel,
        confidenceLevel: this.calculateOverallConfidence(factorAnalysis, learningTrajectory, aiAdjustment)
      },
      
      trajectory: {
        model: learningTrajectory.model,
        timeToGoal: learningTrajectory.timeToGoal,
        plateauRisk: learningTrajectory.plateauRisk,
        optimalStoppingPoint: learningTrajectory.optimalStoppingPoint
      },
      
      milestones: this.generateMilestones(finalDuration, factorAnalysis),
      
      adaptiveElements: {
        earlyCompletionCriteria: this.defineEarlyCompletionCriteria(factorAnalysis),
        extensionTriggers: this.defineExtensionTriggers(factorAnalysis),
        dailyCheckpoints: this.createDailyCheckpoints(finalDuration)
      },
      
      aiInsights: aiAdjustment,
      
      metadata: {
        calculatedAt: new Date(),
        version: '1.0',
        algorithm: 'adaptive_factor_based',
        dataQuality: this.assessDataQuality(factorAnalysis)
      }
    };
  }

  /**
   * Вспомогательные методы анализа
   */
  
  analyzeDailyQuality(responses) {
    const qualityByDay = {};
    
    responses.forEach(response => {
      const day = response.metadata?.trainingDay || 1;
      const quality = response.metadata?.dataQualityScore || 50;
      
      if (!qualityByDay[day]) {
        qualityByDay[day] = [];
      }
      qualityByDay[day].push(quality);
    });
    
    const dailyAverages = Object.entries(qualityByDay).map(([day, scores]) => ({
      day: parseInt(day),
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length
    }));
    
    const overallAverage = dailyAverages.reduce((sum, d) => sum + d.average, 0) / dailyAverages.length;
    
    return {
      byDay: qualityByDay,
      averages: dailyAverages,
      average: overallAverage,
      progression: dailyAverages.map(d => d.average),
      trend: this.calculateQualityTrend(dailyAverages)
    };
  }

  analyzeConsistency(responses) {
    const qualities = responses.map(r => r.metadata?.dataQualityScore || 50);
    const mean = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    const variance = qualities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / qualities.length;
    const stdDev = Math.sqrt(variance);
    
    // Оценка метакогниции на основе времени ответа и попыток валидации
    const metacognitionScore = this.calculateMetacognitionScore(responses);
    
    return {
      mean,
      variance,
      standardDeviation: stdDev,
      variability: stdDev / mean, // Коэффициент вариации
      metacognitionScore
    };
  }

  calculateLearningVelocity(responses) {
    const sortedResponses = responses.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const qualities = sortedResponses.map(r => r.metadata?.dataQualityScore || 50);
    
    if (qualities.length < 3) {
      return { trend: 'unknown', rate: 0, consistency: 0 };
    }
    
    // Линейная регрессия для определения тренда
    const n = qualities.length;
    const sumX = n * (n + 1) / 2;
    const sumY = qualities.reduce((a, b) => a + b, 0);
    const sumXY = qualities.reduce((sum, y, i) => sum + y * (i + 1), 0);
    const sumX2 = n * (n + 1) * (2 * n + 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Оценка консистентности улучшения
    const improvements = [];
    for (let i = 1; i < qualities.length; i++) {
      improvements.push(qualities[i] - qualities[i - 1]);
    }
    
    const positiveImprovements = improvements.filter(imp => imp > 0).length;
    const consistency = positiveImprovements / improvements.length;
    
    let trend = 'stable';
    if (slope > 2) trend = 'fast';
    else if (slope > 0.5) trend = 'moderate';
    else if (slope < -2) trend = 'declining';
    
    return {
      trend,
      rate: slope,
      consistency,
      improvements
    };
  }

  identifyProblemPatterns(responses) {
    const patterns = {
      persistentIllusions: [],
      majorIllusions: [],
      avoidanceCount: 0,
      theorizingCount: 0,
      momentCaptureIssues: 0,
      specificIssues: []
    };
    
    responses.forEach(response => {
      const text = response.responses?.currentThoughts?.toLowerCase() || '';
      const validationAttempts = Object.values(response.metadata?.validationAttempts || {});
      
      // Иллюзии
      if (/внутренн.*голос|проговарива/i.test(text)) {
        patterns.persistentIllusions.push('reading_voice');
      }
      
      // Избегание
      if (/ничего|не знаю|не помню/i.test(text)) {
        patterns.avoidanceCount++;
      }
      
      // Теоретизирование
      if (/думаю|наверное|потому что/i.test(text)) {
        patterns.theorizingCount++;
      }
      
      // Проблемы с моментом
      if (/был|была|обычно|всегда/i.test(text) || validationAttempts.some(v => v > 1)) {
        patterns.momentCaptureIssues++;
      }
    });
    
    // Определяем основные иллюзии
    const illusionCounts = {};
    patterns.persistentIllusions.forEach(illusion => {
      illusionCounts[illusion] = (illusionCounts[illusion] || 0) + 1;
    });
    
    patterns.majorIllusions = Object.entries(illusionCounts)
      .filter(([illusion, count]) => count > responses.length * 0.3)
      .map(([illusion]) => illusion);
    
    return patterns;
  }

  assessDropoutRisk(analysisData) {
    let risk = 0;
    
    // Низкое качество увеличивает риск
    if (analysisData.dailyQuality.average < this.qualityThresholds.poor) {
      risk += 0.3;
    }
    
    // Отсутствие прогресса
    if (analysisData.learningVelocity.trend === 'declining' || 
        analysisData.learningVelocity.consistency < 0.3) {
      risk += 0.3;
    }
    
    // Множественные проблемы
    if (analysisData.problemPatterns.majorIllusions.length > 2) {
      risk += 0.2;
    }
    
    // Избегающее поведение
    if (analysisData.problemPatterns.avoidanceCount > analysisData.totalResponses * 0.4) {
      risk += 0.2;
    }
    
    return Math.min(1.0, risk);
  }

  calculateFactorScores(detectedFactors) {
    const scores = {};
    
    ['positive', 'negative', 'contextual'].forEach(category => {
      scores[category] = detectedFactors[category].reduce((sum, factor) => {
        const factorData = this.durationFactors[category][factor];
        return sum + (factorData?.impact || 0);
      }, 0);
    });
    
    return scores;
  }

  calculateTotalImpact(detectedFactors) {
    const scores = this.calculateFactorScores(detectedFactors);
    return scores.positive + scores.negative + scores.contextual;
  }

  assessOverallRisk(detectedFactors) {
    const negativeFactors = detectedFactors.negative.length;
    const positiveFactors = detectedFactors.positive.length;
    
    if (negativeFactors > positiveFactors + 2) return 'high';
    if (negativeFactors > positiveFactors) return 'medium';
    return 'low';
  }

  identifyProgressionModel(qualityProgression) {
    if (qualityProgression.length < 3) return 'insufficient_data';
    
    const changes = [];
    for (let i = 1; i < qualityProgression.length; i++) {
      changes.push(qualityProgression[i] - qualityProgression[i - 1]);
    }
    
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const changeVariability = this.calculateVariance(changes);
    
    if (changeVariability > 10) return 'oscillating';
    if (Math.abs(avgChange) < 1) return 'plateau';
    if (avgChange > 0 && changes.every(c => c >= 0)) return 'linear';
    if (avgChange > 0) return 'exponential';
    return 'declining';
  }

  generatePredictions(qualityProgression, model, factorAnalysis) {
    const predictions = [];
    const lastQuality = qualityProgression[qualityProgression.length - 1] || 50;
    
    // Простая модель предсказания на основе тренда
    const trend = this.calculateQualityTrend(qualityProgression.map((q, i) => ({ day: i + 1, average: q })));
    
    for (let day = 1; day <= 7; day++) {
      let predicted = lastQuality + (trend * day);
      
      // Применяем влияние факторов
      if (factorAnalysis.detectedFactors.negative.includes('persistent_illusions')) {
        predicted *= 0.95; // Медленнее растет при иллюзиях
      }
      
      if (factorAnalysis.detectedFactors.positive.includes('fast_learner')) {
        predicted *= 1.1; // Быстрее растет у быстрых учеников
      }
      
      predictions.push({
        day: qualityProgression.length + day,
        predictedQuality: Math.max(0, Math.min(100, predicted)),
        confidence: Math.max(0.1, 0.9 - day * 0.1) // Уверенность падает с расстоянием
      });
    }
    
    return predictions;
  }

  estimateTimeToGoal(predictions, goalQuality) {
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i].predictedQuality >= goalQuality) {
        return predictions[i].day;
      }
    }
    return null; // Цель не достигнута в предсказываемом периоде
  }

  findOptimalStoppingPoint(predictions) {
    // Ищем точку, где улучшение становится минимальным
    for (let i = 1; i < predictions.length; i++) {
      const improvement = predictions[i].predictedQuality - predictions[i - 1].predictedQuality;
      if (improvement < 2 && predictions[i].predictedQuality > 65) {
        return predictions[i].day;
      }
    }
    return null;
  }

  calculateQualityTrend(dailyAverages) {
    if (dailyAverages.length < 2) return 0;
    
    const first = dailyAverages[0].average;
    const last = dailyAverages[dailyAverages.length - 1].average;
    const days = dailyAverages.length;
    
    return (last - first) / days;
  }

  calculateMetacognitionScore(responses) {
    // Простая оценка на основе времени ответа и попыток валидации
    let score = 0.5; // Базовая оценка
    
    const avgValidationAttempts = responses.reduce((sum, r) => {
      const attempts = Object.values(r.metadata?.validationAttempts || {});
      return sum + attempts.reduce((a, b) => a + b, 0);
    }, 0) / responses.length;
    
    // Меньше попыток валидации = лучше метакогниция
    if (avgValidationAttempts < 1.5) score += 0.3;
    else if (avgValidationAttempts > 3) score -= 0.2;
    
    return Math.max(0, Math.min(1, score));
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  calculatePredictionConfidence(qualityProgression) {
    if (qualityProgression.length < 3) return 0.3;
    
    const variance = this.calculateVariance(qualityProgression);
    const trend = this.calculateQualityTrend(qualityProgression.map((q, i) => ({ day: i + 1, average: q })));
    
    // Высокая уверенность при стабильном тренде
    if (variance < 50 && Math.abs(trend) > 1) return 0.8;
    if (variance < 100) return 0.6;
    return 0.4;
  }

  assessPlateauRisk(qualityProgression, factorAnalysis) {
    if (qualityProgression.length < 3) return 0.3;
    
    const recentChanges = qualityProgression.slice(-3);
    const avgChange = recentChanges.reduce((sum, q, i) => {
      if (i === 0) return sum;
      return sum + Math.abs(q - recentChanges[i - 1]);
    }, 0) / (recentChanges.length - 1);
    
    let risk = avgChange < 2 ? 0.7 : 0.3;
    
    // Увеличиваем риск при негативных факторах
    if (factorAnalysis.detectedFactors.negative.includes('low_quality_plateau')) {
      risk += 0.2;
    }
    
    return Math.min(1.0, risk);
  }

  // Методы создания отчета
  
  extractPrimaryReasons(factorAnalysis, learningTrajectory) {
    const reasons = [];
    
    // Самые влиятельные факторы
    const allFactors = [
      ...factorAnalysis.detectedFactors.positive.map(f => ({ factor: f, type: 'positive' })),
      ...factorAnalysis.detectedFactors.negative.map(f => ({ factor: f, type: 'negative' }))
    ];
    
    allFactors.forEach(({ factor, type }) => {
      const factorData = this.durationFactors[type][factor];
      if (factorData && Math.abs(factorData.impact) >= 0.5) {
        reasons.push(factorData.description);
      }
    });
    
    // Траекторные причины
    if (learningTrajectory.plateauRisk > 0.7) {
      reasons.push('Высокий риск достижения плато');
    }
    
    if (learningTrajectory.timeToGoal && learningTrajectory.timeToGoal < this.durationLimits.standard) {
      reasons.push('Быстрое достижение целевого качества');
    }
    
    return reasons.slice(0, 3); // Топ-3 причины
  }

  calculateOverallConfidence(factorAnalysis, learningTrajectory, aiAdjustment) {
    let confidence = 0.5; // Базовая уверенность
    
    // Увеличиваем уверенность при наличии данных
    confidence += Math.min(0.3, factorAnalysis.detectedFactors.positive.length * 0.1);
    confidence += Math.min(0.2, learningTrajectory.confidence || 0);
    
    if (aiAdjustment?.confidence) {
      confidence = confidence * 0.7 + aiAdjustment.confidence * 0.3;
    }
    
    return Math.min(1.0, confidence);
  }

  generateMilestones(duration, factorAnalysis) {
    const milestones = [];
    
    for (let day = 1; day <= duration; day++) {
      let goal = '';
      
      switch (day) {
        case 1:
          goal = 'Базовый захват момента';
          break;
        case 2:
          goal = 'Улучшение специфичности';
          break;
        case 3:
          goal = 'Детекция основных иллюзий';
          break;
        case 4:
          goal = 'Консистентность качества';
          break;
        case 5:
          goal = 'Преодоление сложных иллюзий';
          break;
        default:
          goal = 'Закрепление навыков';
      }
      
      milestones.push({
        day,
        goal,
        qualityTarget: Math.min(95, 40 + day * 10)
      });
    }
    
    return milestones;
  }

  defineEarlyCompletionCriteria(factorAnalysis) {
    return [
      'Качество > 80% в течение 2 дней подряд',
      'Отсутствие основных иллюзий',
      'Консистентность > 85%'
    ];
  }

  defineExtensionTriggers(factorAnalysis) {
    return [
      'Качество < 50% после 3 дня',
      'Устойчивые иллюзии не преодолены',
      'Высокий риск dropout'
    ];
  }

  createDailyCheckpoints(duration) {
    const checkpoints = [];
    
    for (let day = 1; day <= duration; day++) {
      checkpoints.push({
        day,
        checkCriteria: [
          'Проверить среднее качество дня',
          'Оценить прогресс по основным навыкам',
          'Выявить новые проблемные паттерны'
        ],
        adaptiveActions: [
          'Скорректировать фокус следующего дня',
          'Изменить сложность упражнений',
          'Добавить целевые интервенции'
        ]
      });
    }
    
    return checkpoints;
  }

  assessDataQuality(factorAnalysis) {
    const factorCount = factorAnalysis.detectedFactors.positive.length + 
                       factorAnalysis.detectedFactors.negative.length;
    
    if (factorCount > 5) return 'high';
    if (factorCount > 2) return 'medium';
    return 'low';
  }

  parseAIAdjustmentResult(result) {
    try {
      const fallback = {
        recommendedDuration: this.durationLimits.standard,
        adjustment: 0,
        reasoning: 'AI анализ недоступен',
        confidence: 0.5,
        alternatives: [],
        keyMilestones: [],
        stopConditions: [],
        continueConditions: []
      };

      if (result && typeof result === 'object') {
        return {
          ...fallback,
          ...result,
          adjustment: (result.recommendedDuration || this.durationLimits.standard) - this.durationLimits.standard
        };
      }
      
      return fallback;
    } catch (error) {
      console.error('Error parsing AI adjustment result:', error);
      return {
        recommendedDuration: this.durationLimits.standard,
        adjustment: 0,
        reasoning: 'Ошибка парсинга AI результата',
        confidence: 0.3
      };
    }
  }

  createFallbackDuration(userId) {
    return {
      recommendedDuration: this.durationLimits.standard,
      originalDuration: this.durationLimits.standard,
      adjustment: 0,
      rationale: {
        primaryReasons: ['Fallback to standard duration'],
        factorImpact: 0,
        riskLevel: 'unknown',
        confidenceLevel: 0.3
      },
      trajectory: {
        model: 'unknown',
        timeToGoal: null,
        plateauRisk: 0.5,
        optimalStoppingPoint: null
      },
      metadata: {
        calculatedAt: new Date(),
        isFallback: true
      }
    };
  }
}

module.exports = new AdaptiveDurationCalculator();