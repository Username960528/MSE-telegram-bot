const config = require('../config/hurlburt');

/**
 * Система обнаружения паттернов в данных пользователей
 * 
 * Помогает выявить индивидуальные особенности внутреннего опыта
 * и предоставить персонализированные рекомендации
 */
class PatternDetector {
  constructor() {
    this.config = config;
    this.phenomena = config.phenomena;
  }

  /**
   * Анализ всех ответов пользователя для выявления паттернов
   * @param {Array} responses - Массив всех ответов пользователя
   * @returns {Object} - Обнаруженные паттерны и рекомендации
   */
  analyzeUserPatterns(responses) {
    const analysis = {
      totalResponses: responses.length,
      phenomenaFrequency: {},
      dominantPhenomena: null,
      consistencyScore: 0,
      personalInsights: [],
      recommendations: [],
      unusualPatterns: [],
      progressTrend: null
    };

    // Анализируем частоту феноменов
    this.analyzePhenomenaFrequency(responses, analysis);
    
    // Проверяем консистентность ответов
    this.analyzeConsistency(responses, analysis);
    
    // Выявляем необычные паттерны
    this.detectUnusualPatterns(responses, analysis);
    
    // Анализируем прогресс
    this.analyzeProgress(responses, analysis);
    
    // Генерируем персональные инсайты
    this.generatePersonalInsights(analysis);
    
    return analysis;
  }

  /**
   * Анализ частоты феноменов Херлберта
   */
  analyzePhenomenaFrequency(responses, analysis) {
    // Инициализируем счётчики
    Object.keys(this.phenomena).forEach(key => {
      analysis.phenomenaFrequency[key] = 0;
    });

    // Подсчитываем феномены
    responses.forEach(response => {
      if (response.metadata?.phenomenaDetected) {
        response.metadata.phenomenaDetected.forEach(phenomenon => {
          if (analysis.phenomenaFrequency[phenomenon.type] !== undefined) {
            analysis.phenomenaFrequency[phenomenon.type]++;
          }
        });
      }
    });

    // Определяем доминирующий феномен
    let maxCount = 0;
    Object.entries(analysis.phenomenaFrequency).forEach(([key, count]) => {
      if (count > maxCount) {
        maxCount = count;
        analysis.dominantPhenomena = key;
      }
    });

    // Сравниваем с нормой
    Object.entries(analysis.phenomenaFrequency).forEach(([key, count]) => {
      const percentage = responses.length > 0 ? count / responses.length : 0;
      const expectedPercentage = this.phenomena[key]?.frequency || 0;
      
      if (Math.abs(percentage - expectedPercentage) > 0.15) {
        analysis.unusualPatterns.push({
          type: 'frequency_deviation',
          phenomenon: key,
          observed: percentage,
          expected: expectedPercentage,
          message: percentage > expectedPercentage ? 
            `Вы сообщаете о ${this.phenomena[key].name} чаще обычного` :
            `Вы редко сообщаете о ${this.phenomena[key].name}`
        });
      }
    });
  }

  /**
   * Анализ консистентности ответов
   */
  analyzeConsistency(responses, analysis) {
    if (responses.length < 5) {
      analysis.consistencyScore = 0;
      return;
    }

    let consistentPairs = 0;
    let totalPairs = 0;

    // Проверяем консистентность между настроением и стрессом
    responses.forEach(response => {
      const mood = response.responses?.mood;
      const stress = response.responses?.stress;
      const energy = response.responses?.energy;

      if (mood && stress) {
        totalPairs++;
        // Высокое настроение обычно = низкий стресс
        if ((mood >= 6 && stress <= 3) || (mood <= 3 && stress >= 5)) {
          consistentPairs++;
        }
      }

      if (energy && stress) {
        totalPairs++;
        // Высокая энергия + высокий стресс = возможно, но реже
        if ((energy >= 6 && stress <= 5) || (energy <= 3 && stress <= 5)) {
          consistentPairs++;
        }
      }
    });

    analysis.consistencyScore = totalPairs > 0 ? 
      Math.round((consistentPairs / totalPairs) * 100) : 0;

    if (analysis.consistencyScore < 60) {
      analysis.unusualPatterns.push({
        type: 'low_consistency',
        message: 'Ваши эмоциональные состояния показывают необычные сочетания'
      });
    }
  }

  /**
   * Обнаружение необычных паттернов
   */
  detectUnusualPatterns(responses, analysis) {
    // Паттерн: всегда одинаковые ответы
    const moodValues = responses.map(r => r.responses?.mood).filter(Boolean);
    if (moodValues.length > 10) {
      const uniqueMoods = new Set(moodValues);
      if (uniqueMoods.size <= 2) {
        analysis.unusualPatterns.push({
          type: 'low_variability',
          field: 'mood',
          message: 'Вы часто указываете одинаковое настроение'
        });
      }
    }

    // Паттерн: очень короткие текстовые ответы
    const textLengths = responses
      .map(r => r.responses?.currentThoughts?.length || 0)
      .filter(len => len > 0);
    
    if (textLengths.length > 5) {
      const avgLength = textLengths.reduce((a, b) => a + b, 0) / textLengths.length;
      if (avgLength < 20) {
        analysis.unusualPatterns.push({
          type: 'brief_responses',
          message: 'Ваши описания очень краткие. Попробуйте добавить больше деталей'
        });
      }
    }

    // Паттерн: отсутствие сенсорных деталей
    let sensoryCount = 0;
    responses.forEach(response => {
      const text = response.responses?.currentThoughts || '';
      if (/цвет|звук|запах|вкус|холод|тепло|боль/.test(text.toLowerCase())) {
        sensoryCount++;
      }
    });

    if (responses.length > 10 && sensoryCount / responses.length < 0.1) {
      analysis.unusualPatterns.push({
        type: 'low_sensory',
        message: 'В ваших описаниях мало сенсорных деталей'
      });
    }
  }

  /**
   * Анализ прогресса пользователя
   */
  analyzeProgress(responses, analysis) {
    if (responses.length < 10) {
      analysis.progressTrend = 'insufficient_data';
      return;
    }

    // Сравниваем качество первых и последних ответов
    const sortedResponses = responses.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const firstThird = sortedResponses.slice(0, Math.floor(responses.length / 3));
    const lastThird = sortedResponses.slice(-Math.floor(responses.length / 3));

    const avgQualityFirst = this.calculateAverageQuality(firstThird);
    const avgQualityLast = this.calculateAverageQuality(lastThird);

    const improvement = avgQualityLast - avgQualityFirst;

    if (improvement > 20) {
      analysis.progressTrend = 'significant_improvement';
      analysis.personalInsights.push('🎯 Отличный прогресс! Качество ваших наблюдений значительно улучшилось');
    } else if (improvement > 10) {
      analysis.progressTrend = 'moderate_improvement';
      analysis.personalInsights.push('📈 Вы делаете успехи в точности самонаблюдения');
    } else if (improvement < -10) {
      analysis.progressTrend = 'declining';
      analysis.recommendations.push('💡 Попробуйте вернуться к базовым принципам наблюдения момента');
    } else {
      analysis.progressTrend = 'stable';
    }
  }

  /**
   * Расчёт среднего качества для группы ответов
   */
  calculateAverageQuality(responses) {
    if (responses.length === 0) return 0;
    
    const qualities = responses
      .map(r => r.metadata?.dataQualityScore || 50)
      .filter(q => q > 0);
    
    return qualities.length > 0 ? 
      qualities.reduce((a, b) => a + b, 0) / qualities.length : 50;
  }

  /**
   * Генерация персональных инсайтов
   */
  generatePersonalInsights(analysis) {
    // Инсайты на основе доминирующего феномена
    if (analysis.dominantPhenomena) {
      const phenomenon = this.phenomena[analysis.dominantPhenomena];
      if (phenomenon) {
        analysis.personalInsights.push(
          `💭 У вас часто встречается ${phenomenon.name.toLowerCase()}`
        );
      }
    }

    // Инсайты на основе необычных паттернов
    analysis.unusualPatterns.forEach(pattern => {
      if (pattern.type === 'frequency_deviation' && pattern.observed > pattern.expected) {
        analysis.recommendations.push(
          `🔍 Обратите внимание: возможно, вы принимаете за ${
            this.phenomena[pattern.phenomenon].name.toLowerCase()
          } что-то другое`
        );
      }
    });

    // Рекомендации по улучшению
    if (analysis.consistencyScore < 70) {
      analysis.recommendations.push(
        '🎯 Старайтесь точнее оценивать связь между эмоциями и физическим состоянием'
      );
    }

    // Мотивационные сообщения
    if (analysis.totalResponses > 50 && analysis.progressTrend === 'significant_improvement') {
      analysis.personalInsights.push(
        '🏆 Вы входите в топ наблюдателей! Ваши данные особенно ценны для исследований'
      );
    }
  }

  /**
   * Определение типа личности по паттернам внутреннего опыта
   */
  detectExperienceType(analysis) {
    const types = {
      verbal: {
        name: 'Вербальный тип',
        description: 'Часто думаете словами и внутренней речью',
        markers: ['innerSpeech']
      },
      visual: {
        name: 'Визуальный тип',
        description: 'Мыслите образами и картинками',
        markers: ['innerSeeing']
      },
      abstract: {
        name: 'Абстрактный тип',
        description: 'Часто испытываете несимволизированное мышление',
        markers: ['unsymbolizedThinking']
      },
      sensory: {
        name: 'Сенсорный тип',
        description: 'Хорошо осознаёте телесные ощущения',
        markers: ['sensoryAwareness']
      },
      emotional: {
        name: 'Эмоциональный тип',
        description: 'Богатый эмоциональный внутренний мир',
        markers: ['feeling']
      }
    };

    let maxScore = 0;
    let detectedType = null;

    Object.entries(types).forEach(([key, type]) => {
      let score = 0;
      type.markers.forEach(marker => {
        score += analysis.phenomenaFrequency[marker] || 0;
      });
      
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    });

    return detectedType;
  }

  /**
   * Экспорт паттернов для исследований
   */
  exportForResearch(analysis, userId) {
    return {
      userId: userId,
      timestamp: new Date().toISOString(),
      sampleSize: analysis.totalResponses,
      phenomenaDistribution: analysis.phenomenaFrequency,
      dominantPhenomenon: analysis.dominantPhenomena,
      consistencyScore: analysis.consistencyScore,
      unusualPatterns: analysis.unusualPatterns.map(p => ({
        type: p.type,
        details: p.message
      })),
      progressTrend: analysis.progressTrend,
      experienceType: this.detectExperienceType(analysis)?.name || 'undefined'
    };
  }
}

module.exports = PatternDetector;