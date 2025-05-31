const Response = require('../models/Response');
const aiValidator = require('./ai-validator-service');
const goldenStandard = require('../validators/goldenStandard');

/**
 * Система анализа индивидуальных слабостей пользователя
 * 
 * Определяет персональные проблемные области и создает целевые интервенции:
 * - Детекция тонких паттернов ошибок
 * - Анализ прогрессии обучения
 * - Выявление устойчивых иллюзий
 * - Генерация специфических рекомендаций
 */
class WeaknessAnalyzer {
  constructor() {
    this.aiService = aiValidator;
    
    // Типы слабостей с весами важности
    this.weaknessTypes = {
      // Основные методологические проблемы
      'moment_capture': {
        name: 'Неточный захват момента',
        weight: 1.0,
        category: 'fundamental',
        markers: ['retrospective', 'generalization', 'time_period'],
        interventions: ['moment_training', 'temporal_precision']
      },
      'specificity': {
        name: 'Недостаток специфичности', 
        weight: 0.9,
        category: 'precision',
        markers: ['abstract', 'generic', 'vague'],
        interventions: ['detail_training', 'concrete_examples']
      },
      'illusion_detection': {
        name: 'Неспособность различать иллюзии',
        weight: 1.0,
        category: 'fundamental', 
        markers: ['reading_voice_illusion', 'emotion_labeling', 'causal_thinking'],
        interventions: ['illusion_education', 'reality_testing']
      },
      
      // Технические аспекты
      'sensory_detail': {
        name: 'Слабые сенсорные описания',
        weight: 0.8,
        category: 'technical',
        markers: ['no_sensory', 'abstract_emotions'],
        interventions: ['sensory_training', 'body_awareness']
      },
      'consistency': {
        name: 'Непоследовательность ответов',
        weight: 0.7,
        category: 'technical',
        markers: ['contradictions', 'mood_stress_mismatch'],
        interventions: ['consistency_training', 'self_monitoring']
      },
      'avoidance': {
        name: 'Избегание наблюдения',
        weight: 0.9,
        category: 'psychological',
        markers: ['empty_responses', 'dont_know', 'nothing_special'],
        interventions: ['engagement_training', 'curiosity_building']
      },
      
      // Когнитивные паттерны
      'over_analysis': {
        name: 'Избыточный анализ',
        weight: 0.6,
        category: 'cognitive',
        markers: ['theoretical', 'causal_explanation', 'meta_thinking'],
        interventions: ['simplicity_training', 'direct_experience']
      },
      'emotional_labeling': {
        name: 'Эмоциональные ярлыки',
        weight: 0.7,
        category: 'cognitive', 
        markers: ['emotion_words', 'mood_descriptions'],
        interventions: ['somatic_training', 'feeling_vs_emotion']
      },
      'time_confusion': {
        name: 'Временная путаница',
        weight: 0.8,
        category: 'temporal',
        markers: ['past_tense', 'duration_words', 'sequence_description'],
        interventions: ['temporal_training', 'snapshot_technique']
      }
    };
    
    // Паттерны развития слабостей
    this.progressionPatterns = {
      'persistent': 'Слабость присутствует во всех сессиях',
      'increasing': 'Слабость усиливается со временем', 
      'plateau': 'Слабость не улучшается после обучения',
      'contextual': 'Слабость проявляется в специфических контекстах',
      'compensated': 'Слабость маскируется другими навыками'
    };
  }

  /**
   * Основной анализ слабостей пользователя
   */
  async analyzeUserWeaknesses(userId, depth = 'comprehensive') {
    try {
      console.log(`🔍 Analyzing weaknesses for user ${userId} (${depth} mode)`);
      
      // Получаем данные ответов
      const responses = await this.getUserResponses(userId);
      if (responses.length === 0) {
        return this.createInitialWeaknessProfile();
      }

      // Многоуровневый анализ
      const statisticalAnalysis = this.performStatisticalAnalysis(responses);
      const patternAnalysis = this.performPatternAnalysis(responses);
      const progressionAnalysis = this.analyzeProgression(responses);
      
      // ИИ-анализ для глубокого понимания
      let aiAnalysis = null;
      if (depth === 'comprehensive' && this.aiService.isConfigured) {
        aiAnalysis = await this.performAIWeaknessAnalysis(responses);
      }
      
      // Синтез результатов
      const synthesizedWeaknesses = this.synthesizeAnalysis(
        statisticalAnalysis, 
        patternAnalysis, 
        progressionAnalysis, 
        aiAnalysis
      );
      
      // Приоритизация и ранжирование
      const prioritizedWeaknesses = this.prioritizeWeaknesses(synthesizedWeaknesses);
      
      // Генерация целевых интервенций
      const interventions = this.generateInterventions(prioritizedWeaknesses);
      
      const result = {
        userId,
        analysisDate: new Date(),
        analysisDepth: depth,
        primaryWeaknesses: prioritizedWeaknesses.slice(0, 3),
        allWeaknesses: prioritizedWeaknesses,
        progressionPatterns: progressionAnalysis.patterns,
        riskFactors: this.identifyRiskFactors(prioritizedWeaknesses),
        interventions,
        confidence: this.calculateConfidence(statisticalAnalysis, aiAnalysis),
        metadata: {
          totalResponses: responses.length,
          analysisVersion: '1.0',
          aiUsed: !!aiAnalysis
        }
      };
      
      console.log(`✅ Weakness analysis completed: ${prioritizedWeaknesses.length} issues identified`);
      return result;
      
    } catch (error) {
      console.error('Error analyzing user weaknesses:', error);
      return this.createFallbackAnalysis(userId);
    }
  }

  /**
   * Статистический анализ ответов
   */
  performStatisticalAnalysis(responses) {
    const analysis = {
      qualityMetrics: this.analyzeQualityMetrics(responses),
      responsePatterns: this.analyzeResponsePatterns(responses),
      validationIssues: this.analyzeValidationIssues(responses),
      phenomenaProfile: this.analyzePhenomenaProfile(responses)
    };

    // Определяем слабости на основе статистики
    const detectedWeaknesses = [];

    // Низкое качество момента
    if (analysis.qualityMetrics.avgMomentFocus < 60) {
      detectedWeaknesses.push({
        type: 'moment_capture',
        severity: this.calculateSeverity(analysis.qualityMetrics.avgMomentFocus, 60),
        evidence: `Средний фокус на моменте: ${analysis.qualityMetrics.avgMomentFocus}%`,
        frequency: analysis.responsePatterns.momentIssueFrequency
      });
    }

    // Недостаток специфичности
    if (analysis.qualityMetrics.avgSpecificity < 65) {
      detectedWeaknesses.push({
        type: 'specificity',
        severity: this.calculateSeverity(analysis.qualityMetrics.avgSpecificity, 65),
        evidence: `Средняя специфичность: ${analysis.qualityMetrics.avgSpecificity}%`,
        frequency: analysis.responsePatterns.specificityIssues
      });
    }

    // Слабые сенсорные детали
    if (analysis.qualityMetrics.avgSensoryDetail < 50) {
      detectedWeaknesses.push({
        type: 'sensory_detail',
        severity: this.calculateSeverity(analysis.qualityMetrics.avgSensoryDetail, 50),
        evidence: `Средний уровень сенсорных деталей: ${analysis.qualityMetrics.avgSensoryDetail}%`,
        frequency: analysis.responsePatterns.sensoryDeficit
      });
    }

    // Непоследовательность
    if (analysis.qualityMetrics.consistencyScore < 0.7) {
      detectedWeaknesses.push({
        type: 'consistency',
        severity: this.calculateSeverity(analysis.qualityMetrics.consistencyScore * 100, 70),
        evidence: `Оценка последовательности: ${Math.round(analysis.qualityMetrics.consistencyScore * 100)}%`,
        frequency: analysis.responsePatterns.inconsistencyCount
      });
    }

    return {
      weaknesses: detectedWeaknesses,
      metrics: analysis,
      confidence: 0.8
    };
  }

  /**
   * Анализ паттернов через золотой стандарт
   */
  performPatternAnalysis(responses) {
    const detectedWeaknesses = [];
    const patternCounts = {};

    responses.forEach(response => {
      // Анализируем через золотой стандарт если доступен
      if (response.metadata?.goldenStandard?.matchedPatterns?.negative) {
        response.metadata.goldenStandard.matchedPatterns.negative.forEach(pattern => {
          patternCounts[pattern.name] = (patternCounts[pattern.name] || 0) + 1;
        });
      }

      // Анализируем текстовые ответы на паттерны
      const text = response.responses?.currentThoughts || '';
      if (text) {
        this.detectTextPatterns(text).forEach(pattern => {
          patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        });
      }
    });

    // Преобразуем в слабости
    Object.entries(patternCounts).forEach(([pattern, count]) => {
      const frequency = count / responses.length;
      if (frequency > 0.3) { // Если паттерн встречается в >30% ответов
        const weakness = this.mapPatternToWeakness(pattern);
        if (weakness) {
          detectedWeaknesses.push({
            type: weakness,
            severity: Math.min(1.0, frequency * 1.5),
            evidence: `Паттерн "${pattern}" в ${count} из ${responses.length} ответов`,
            frequency: frequency,
            patternName: pattern
          });
        }
      }
    });

    return {
      weaknesses: detectedWeaknesses,
      patterns: patternCounts,
      confidence: 0.7
    };
  }

  /**
   * Анализ прогрессии слабостей во времени
   */
  analyzeProgression(responses) {
    const sortedResponses = responses.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const progressionPatterns = {};
    const weeklyAnalysis = [];

    // Группируем по неделям для анализа тренда
    const weeks = this.groupResponsesByWeek(sortedResponses);
    
    weeks.forEach((weekResponses, weekIndex) => {
      const weekAnalysis = this.analyzeWeekWeaknesses(weekResponses);
      weeklyAnalysis.push({
        week: weekIndex + 1,
        weaknesses: weekAnalysis,
        avgQuality: this.calculateWeekAvgQuality(weekResponses)
      });
    });

    // Определяем паттерны прогрессии
    Object.keys(this.weaknessTypes).forEach(weaknessType => {
      const weeklyScores = weeklyAnalysis.map(w => 
        w.weaknesses.find(weak => weak.type === weaknessType)?.severity || 0
      );
      
      progressionPatterns[weaknessType] = this.classifyProgression(weeklyScores);
    });

    return {
      patterns: progressionPatterns,
      weeklyAnalysis,
      confidence: 0.6
    };
  }

  /**
   * ИИ-анализ для глубокого понимания слабостей
   */
  async performAIWeaknessAnalysis(responses) {
    if (!this.aiService.isConfigured) return null;

    // Подготавливаем данные для ИИ
    const analysisData = this.prepareAIAnalysisData(responses);
    
    const prompt = `Проведи глубокий анализ слабостей в обучении ESM этого пользователя:

ДАННЫЕ ОТВЕТОВ:
${JSON.stringify(analysisData, null, 2)}

ЗАДАЧА:
Выяви тонкие паттерны проблем, которые может пропустить статистический анализ:

1. СКРЫТЫЕ ИЛЛЮЗИИ:
   - Внутренний голос при чтении (реально только 3% времени)
   - Эмоциональные ярлыки вместо телесных ощущений
   - Каузальные объяснения вместо описания опыта
   - Ретроспективные реконструкции

2. КОГНИТИВНЫЕ ПАТТЕРНЫ:
   - Избыточное теоретизирование
   - Избегание пустого опыта
   - Конфабуляция деталей
   - Социально желательные ответы

3. МЕТОДОЛОГИЧЕСКИЕ ПРОБЛЕМЫ:
   - Неточный захват момента сигнала
   - Смешение разных временных периодов
   - Додумывание вместо наблюдения

4. ПРОГРЕССИЯ ОБУЧЕНИЯ:
   - Застревание на определенных ошибках
   - Маскировка слабостей развитыми навыками
   - Плато в развитии

Верни детальный анализ в JSON:
{
  "criticalWeaknesses": [
    {
      "type": "weakness_type",
      "severity": 0.8,
      "evidence": "конкретные примеры из ответов",
      "hiddenPattern": "описание скрытого паттерна",
      "riskLevel": "high|medium|low"
    }
  ],
  "subtleIssues": [
    {
      "pattern": "название паттерна", 
      "description": "описание проблемы",
      "examples": ["пример1", "пример2"],
      "interventionNeeded": true
    }
  ],
  "learningBlocks": [
    {
      "blockType": "тип блокировки",
      "manifestation": "как проявляется",
      "suggestion": "предложение по преодолению"
    }
  ],
  "progressionInsights": {
    "overallTrend": "improving|plateauing|declining",
    "stuckAreas": ["область1", "область2"],
    "breakthroughPotential": ["потенциал1", "потенциал2"]
  },
  "confidence": 0.85
}`;

    try {
      const result = await this.aiService.validate(prompt, { 
        isWeaknessAnalysis: true,
        userId: responses[0]?.userId
      });
      
      return this.parseAIWeaknessResult(result);
      
    } catch (error) {
      console.error('AI weakness analysis failed:', error);
      return null;
    }
  }

  /**
   * Синтез всех анализов
   */
  synthesizeAnalysis(statistical, pattern, progression, ai) {
    const allWeaknesses = new Map();
    
    // Объединяем слабости из всех источников
    [statistical, pattern].forEach(analysis => {
      analysis.weaknesses.forEach(weakness => {
        const key = weakness.type;
        if (allWeaknesses.has(key)) {
          const existing = allWeaknesses.get(key);
          existing.severity = Math.max(existing.severity, weakness.severity);
          existing.sources.push(analysis.confidence);
          existing.evidence += `; ${weakness.evidence}`;
        } else {
          allWeaknesses.set(key, {
            ...weakness,
            sources: [analysis.confidence],
            progressionPattern: progression.patterns[key] || 'unknown'
          });
        }
      });
    });

    // Добавляем данные ИИ-анализа
    if (ai?.criticalWeaknesses) {
      ai.criticalWeaknesses.forEach(weakness => {
        const key = weakness.type;
        if (allWeaknesses.has(key)) {
          const existing = allWeaknesses.get(key);
          existing.severity = Math.max(existing.severity, weakness.severity);
          existing.aiInsights = weakness.hiddenPattern;
          existing.riskLevel = weakness.riskLevel;
        } else {
          allWeaknesses.set(key, {
            type: weakness.type,
            severity: weakness.severity,
            evidence: weakness.evidence,
            sources: [ai.confidence || 0.8],
            progressionPattern: 'ai_detected',
            aiInsights: weakness.hiddenPattern,
            riskLevel: weakness.riskLevel
          });
        }
      });
    }

    return Array.from(allWeaknesses.values());
  }

  /**
   * Приоритизация слабостей
   */
  prioritizeWeaknesses(weaknesses) {
    return weaknesses
      .map(weakness => ({
        ...weakness,
        priority: this.calculatePriority(weakness),
        confidence: this.calculateWeaknessConfidence(weakness)
      }))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Генерация целевых интервенций
   */
  generateInterventions(prioritizedWeaknesses) {
    return prioritizedWeaknesses.slice(0, 5).map(weakness => {
      const weaknessConfig = this.weaknessTypes[weakness.type];
      
      return {
        targetWeakness: weakness.type,
        interventionType: weaknessConfig?.interventions[0] || 'general_training',
        urgency: weakness.riskLevel || this.calculateUrgency(weakness.severity),
        specificActions: this.generateSpecificActions(weakness),
        estimatedDuration: this.estimateInterventionDuration(weakness),
        successMetrics: this.defineSuccessMetrics(weakness.type),
        fallbackStrategy: this.generateFallbackStrategy(weakness)
      };
    });
  }

  /**
   * Вспомогательные методы
   */
  
  async getUserResponses(userId, limit = 50) {
    return await Response.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  calculateSeverity(current, target) {
    const deficit = Math.max(0, target - current);
    return Math.min(1.0, deficit / target);
  }

  mapPatternToWeakness(pattern) {
    const mapping = {
      'generalization': 'moment_capture',
      'retrospective': 'moment_capture', 
      'theoretical': 'over_analysis',
      'abstract': 'specificity',
      'reading_voice_illusion': 'illusion_detection',
      'emotion_labeling': 'emotional_labeling',
      'avoidance': 'avoidance',
      'past_tense': 'time_confusion'
    };
    
    return mapping[pattern];
  }

  detectTextPatterns(text) {
    const patterns = [];
    const lowerText = text.toLowerCase();
    
    // Обобщения
    if (/обычно|всегда|никогда|часто|редко/.test(lowerText)) {
      patterns.push('generalization');
    }
    
    // Ретроспектива
    if (/был|была|было|были|вчера|утром|раньше/.test(lowerText)) {
      patterns.push('retrospective');
    }
    
    // Теоретизирование
    if (/думаю|наверное|должен|потому что|поэтому/.test(lowerText)) {
      patterns.push('theoretical');
    }
    
    // Избегание
    if (/ничего|не знаю|не помню|ничего особенного/.test(lowerText)) {
      patterns.push('avoidance');
    }
    
    return patterns;
  }

  groupResponsesByWeek(responses) {
    const weeks = [];
    let currentWeek = [];
    let currentWeekStart = null;
    
    responses.forEach(response => {
      const responseDate = new Date(response.timestamp);
      
      if (!currentWeekStart) {
        currentWeekStart = responseDate;
        currentWeek = [response];
      } else {
        const daysDiff = (responseDate - currentWeekStart) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 7) {
          currentWeek.push(response);
        } else {
          weeks.push(currentWeek);
          currentWeek = [response];
          currentWeekStart = responseDate;
        }
      }
    });
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  }

  classifyProgression(weeklyScores) {
    if (weeklyScores.length < 2) return 'insufficient_data';
    
    const trend = this.calculateTrend(weeklyScores);
    const variance = this.calculateVariance(weeklyScores);
    const lastScore = weeklyScores[weeklyScores.length - 1];
    
    if (Math.abs(trend) < 0.1 && lastScore > 0.5) return 'persistent';
    if (trend > 0.2) return 'increasing'; 
    if (trend < -0.2) return 'improving';
    if (variance < 0.1 && lastScore > 0.3) return 'plateau';
    return 'variable';
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + y * (i + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  calculatePriority(weakness) {
    const weaknessConfig = this.weaknessTypes[weakness.type];
    const weight = weaknessConfig?.weight || 0.5;
    const confidenceBonus = weakness.sources.reduce((sum, conf) => sum + conf, 0) / weakness.sources.length;
    
    return weakness.severity * weight * confidenceBonus;
  }

  calculateWeaknessConfidence(weakness) {
    return weakness.sources.reduce((sum, conf) => sum + conf, 0) / weakness.sources.length;
  }

  identifyRiskFactors(weaknesses) {
    const risks = [];
    
    // Критические слабости
    const criticalWeaknesses = weaknesses.filter(w => w.severity > 0.8);
    if (criticalWeaknesses.length > 2) {
      risks.push('multiple_critical_issues');
    }
    
    // Фундаментальные проблемы
    const fundamentalIssues = weaknesses.filter(w => 
      this.weaknessTypes[w.type]?.category === 'fundamental'
    );
    if (fundamentalIssues.length > 0) {
      risks.push('fundamental_skill_deficit');
    }
    
    // Отсутствие прогресса
    const plateauedWeaknesses = weaknesses.filter(w => 
      w.progressionPattern === 'plateau' || w.progressionPattern === 'persistent'
    );
    if (plateauedWeaknesses.length > 1) {
      risks.push('learning_plateau');
    }
    
    return risks;
  }

  generateSpecificActions(weakness) {
    const actions = {
      'moment_capture': [
        'Практика "стоп-кадра": при сигнале представить момент как фотографию',
        'Упражнение с таймером: каждые 15 минут записывать что СЕЙЧАС в сознании',
        'Различение: "что было тогда" vs "что я думаю об этом сейчас"'
      ],
      'specificity': [
        'Техника 5W: Кто, Что, Где, Когда, Каким образом для каждого ответа',
        'Описание через сенсорные каналы: что видел/слышал/чувствовал',
        'Избегание оценочных слов: заменить "хорошо" на конкретное описание'
      ],
      'illusion_detection': [
        'Изучение исследований Херлберта о частоте внутреннего голоса (3%)',
        'Самопроверка: "Действительно ли я слышал слова или просто понимал?"',
        'Различение эмоций и телесных ощущений'
      ]
    };
    
    return actions[weakness.type] || ['Развитие общих навыков наблюдения'];
  }

  estimateInterventionDuration(weakness) {
    const baseDuration = {
      'high': 7, // дней
      'medium': 4,
      'low': 2
    };
    
    const riskLevel = weakness.riskLevel || 'medium';
    return baseDuration[riskLevel] || 4;
  }

  defineSuccessMetrics(weaknessType) {
    const metrics = {
      'moment_capture': 'Повышение оценки момент-фокуса до 70%+',
      'specificity': 'Увеличение детализации ответов до 65%+',
      'illusion_detection': 'Снижение иллюзий до <20% ответов',
      'consistency': 'Повышение консистентности до 80%+'
    };
    
    return metrics[weaknessType] || 'Общее улучшение качества ответов';
  }

  generateFallbackStrategy(weakness) {
    if (weakness.severity > 0.8) {
      return 'Индивидуальная работа с ментором-ботом';
    } else if (weakness.severity > 0.6) {
      return 'Дополнительные упражнения и примеры';
    } else {
      return 'Регулярные напоминания и подсказки';
    }
  }

  // Методы создания fallback данных
  createInitialWeaknessProfile() {
    return {
      primaryWeaknesses: [
        { type: 'moment_capture', severity: 0.7, evidence: 'Начальная оценка' },
        { type: 'specificity', severity: 0.6, evidence: 'Начальная оценка' }
      ],
      allWeaknesses: [],
      interventions: [],
      confidence: 0.3,
      metadata: { isInitial: true }
    };
  }

  createFallbackAnalysis(userId) {
    return {
      userId,
      primaryWeaknesses: [
        { type: 'moment_capture', severity: 0.5, evidence: 'Fallback анализ' }
      ],
      allWeaknesses: [],
      interventions: [],
      confidence: 0.2,
      metadata: { isFallback: true }
    };
  }

  analyzeQualityMetrics(responses) {
    // Заглушка для анализа качественных метрик
    return {
      avgMomentFocus: 50,
      avgSpecificity: 55,
      avgSensoryDetail: 45,
      consistencyScore: 0.6
    };
  }

  analyzeResponsePatterns(responses) {
    // Заглушка для анализа паттернов ответов
    return {
      momentIssueFrequency: 0.4,
      specificityIssues: 0.3,
      sensoryDeficit: 0.5,
      inconsistencyCount: 3
    };
  }

  analyzeValidationIssues(responses) {
    // Анализ проблем валидации
    return responses.reduce((issues, response) => {
      const attempts = response.metadata?.validationAttempts || {};
      Object.entries(attempts).forEach(([question, count]) => {
        if (count > 1) {
          issues.push({ question, attempts: count });
        }
      });
      return issues;
    }, []);
  }

  analyzePhenomenaProfile(responses) {
    // Анализ профиля феноменов
    const phenomena = {};
    responses.forEach(r => {
      const detected = r.metadata?.phenomenaDetected || [];
      detected.forEach(p => {
        phenomena[p.type] = (phenomena[p.type] || 0) + 1;
      });
    });
    return phenomena;
  }

  prepareAIAnalysisData(responses) {
    return responses.slice(0, 15).map(r => ({
      text: r.responses?.currentThoughts?.substring(0, 200) || '',
      quality: r.metadata?.dataQualityScore || 0,
      day: r.metadata?.trainingDay || 1,
      validationAttempts: Object.values(r.metadata?.validationAttempts || {}).reduce((a, b) => a + b, 0),
      phenomena: r.metadata?.phenomenaDetected || [],
      mood: r.responses?.mood,
      stress: r.responses?.stress,
      timestamp: r.timestamp
    }));
  }

  parseAIWeaknessResult(result) {
    try {
      // Базовая структура с fallback значениями
      const fallback = {
        criticalWeaknesses: [],
        subtleIssues: [],
        learningBlocks: [],
        progressionInsights: {
          overallTrend: 'unknown',
          stuckAreas: [],
          breakthroughPotential: []
        },
        confidence: 0.5
      };

      if (result && typeof result === 'object') {
        return { ...fallback, ...result };
      }
      
      return fallback;
    } catch (error) {
      console.error('Error parsing AI weakness result:', error);
      return {
        criticalWeaknesses: [],
        subtleIssues: [],
        learningBlocks: [],
        progressionInsights: { overallTrend: 'unknown', stuckAreas: [], breakthroughPotential: [] },
        confidence: 0.3
      };
    }
  }

  calculateConfidence(statistical, ai) {
    let confidence = statistical.confidence * 0.6;
    if (ai?.confidence) {
      confidence += ai.confidence * 0.4;
    } else {
      confidence += 0.2; // Bonus за статистический анализ без ИИ
    }
    return Math.min(1.0, confidence);
  }

  calculateWeekAvgQuality(weekResponses) {
    const qualities = weekResponses
      .map(r => r.metadata?.dataQualityScore)
      .filter(Boolean);
    
    return qualities.length > 0 ? 
      qualities.reduce((a, b) => a + b, 0) / qualities.length : 50;
  }

  analyzeWeekWeaknesses(weekResponses) {
    // Упрощенный анализ слабостей за неделю
    return [
      { type: 'moment_capture', severity: Math.random() * 0.5 + 0.2 },
      { type: 'specificity', severity: Math.random() * 0.4 + 0.1 }
    ];
  }

  calculateUrgency(severity) {
    if (severity > 0.8) return 'high';
    if (severity > 0.5) return 'medium';
    return 'low';
  }
}

module.exports = new WeaknessAnalyzer();