const Response = require('../models/Response');
const config = require('../config/hurlburt');

/**
 * Генератор итеративной обратной связи о паттернах пользователя
 * 
 * Анализирует последние ответы и предоставляет персонализированные инсайты
 */
class PatternFeedback {
  constructor() {
    this.config = config;
  }

  /**
   * Генерация обратной связи после завершения опроса
   * @param {String} userId - ID пользователя
   * @param {Object} currentResponse - Текущий ответ
   * @returns {String} - Сообщение с обратной связью
   */
  async generateIterativeFeedback(userId, currentResponse) {
    try {
      // Получаем последние 10 ответов для анализа паттернов
      const recentResponses = await Response.find({ 
        userId,
        'metadata.isTraining': { $ne: true } // Исключаем тренировочные данные
      })
      .sort({ timestamp: -1 })
      .limit(10);

      if (recentResponses.length < 3) {
        return null; // Недостаточно данных для анализа паттернов
      }

      const patterns = this.analyzePatterns(recentResponses, currentResponse);
      return this.formatFeedbackMessage(patterns);

    } catch (error) {
      console.error('Error generating pattern feedback:', error);
      return null;
    }
  }

  /**
   * Анализ паттернов в ответах
   */
  analyzePatterns(responses, currentResponse) {
    const patterns = {
      stress: this.analyzeStressPatterns(responses),
      mood: this.analyzeMoodPatterns(responses),
      flow: this.analyzeFlowPatterns(responses),
      activity: this.analyzeActivityPatterns(responses),
      phenomena: this.analyzePhenomenaPatterns(responses),
      consistency: this.analyzeConsistency(responses)
    };

    return patterns;
  }

  /**
   * Анализ паттернов стресса
   */
  analyzeStressPatterns(responses) {
    const stressLevels = responses.map(r => r.responses?.stress).filter(Boolean);
    if (stressLevels.length < 3) return null;

    const avgStress = stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length;
    const highStressCount = stressLevels.filter(s => s >= 6).length;
    const highStressPercentage = (highStressCount / stressLevels.length) * 100;

    // Ищем корреляции с активностью
    const highStressActivities = responses
      .filter(r => r.responses?.stress >= 6 && r.responses?.currentActivity)
      .map(r => r.responses.currentActivity.toLowerCase());

    const activityCounts = {};
    highStressActivities.forEach(activity => {
      const keywords = this.extractKeywords(activity);
      keywords.forEach(keyword => {
        activityCounts[keyword] = (activityCounts[keyword] || 0) + 1;
      });
    });

    const topStressActivity = Object.entries(activityCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      avgLevel: Math.round(avgStress * 10) / 10,
      highStressPercentage: Math.round(highStressPercentage),
      topStressActivity: topStressActivity ? topStressActivity[0] : null,
      trend: this.calculateTrend(stressLevels)
    };
  }

  /**
   * Анализ паттернов настроения
   */
  analyzeMoodPatterns(responses) {
    const moodLevels = responses.map(r => r.responses?.mood).filter(Boolean);
    if (moodLevels.length < 3) return null;

    const avgMood = moodLevels.reduce((a, b) => a + b, 0) / moodLevels.length;
    const variability = this.calculateVariability(moodLevels);

    return {
      avgLevel: Math.round(avgMood * 10) / 10,
      variability: variability,
      trend: this.calculateTrend(moodLevels),
      stable: variability < 1.5
    };
  }

  /**
   * Анализ Flow состояний
   */
  analyzeFlowPatterns(responses) {
    const flowStates = responses
      .map(r => r.metadata?.flowState)
      .filter(Boolean);

    if (flowStates.length < 3) return null;

    const flowCount = flowStates.filter(s => s === 'flow').length;
    const flowPercentage = (flowCount / flowStates.length) * 100;

    const stateDistribution = {};
    flowStates.forEach(state => {
      stateDistribution[state] = (stateDistribution[state] || 0) + 1;
    });

    const dominantState = Object.entries(stateDistribution)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      flowPercentage: Math.round(flowPercentage),
      dominantState: dominantState[0],
      distribution: stateDistribution
    };
  }

  /**
   * Анализ паттернов активности
   */
  analyzeActivityPatterns(responses) {
    const activities = responses
      .map(r => r.responses?.currentActivity)
      .filter(Boolean);

    if (activities.length < 3) return null;

    const keywordCounts = {};
    activities.forEach(activity => {
      const keywords = this.extractKeywords(activity.toLowerCase());
      keywords.forEach(keyword => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
    });

    const topActivities = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    return {
      topActivities: topActivities.map(([word, count]) => ({ word, count })),
      variety: Object.keys(keywordCounts).length
    };
  }

  /**
   * Анализ паттернов феноменов
   */
  analyzePhenomenaPatterns(responses) {
    const allPhenomena = responses
      .flatMap(r => r.metadata?.phenomenaDetected || [])
      .map(p => p.type);

    if (allPhenomena.length < 2) return null;

    const phenomenaCounts = {};
    allPhenomena.forEach(type => {
      phenomenaCounts[type] = (phenomenaCounts[type] || 0) + 1;
    });

    const dominantPhenomenon = Object.entries(phenomenaCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      dominantPhenomenon: dominantPhenomenon ? dominantPhenomenon[0] : null,
      variety: Object.keys(phenomenaCounts).length,
      distribution: phenomenaCounts
    };
  }

  /**
   * Анализ консистентности
   */
  analyzeConsistency(responses) {
    let consistentPairs = 0;
    let totalPairs = 0;

    responses.forEach(r => {
      const mood = r.responses?.mood;
      const stress = r.responses?.stress;
      const energy = r.responses?.energy;

      if (mood && stress) {
        totalPairs++;
        // Ожидаем: высокое настроение = низкий стресс
        if ((mood >= 6 && stress <= 3) || (mood <= 3 && stress >= 5) || 
            (mood >= 4 && mood <= 5 && stress >= 3 && stress <= 5)) {
          consistentPairs++;
        }
      }
    });

    return {
      consistencyScore: totalPairs > 0 ? Math.round((consistentPairs / totalPairs) * 100) : 0,
      totalComparisons: totalPairs
    };
  }

  /**
   * Форматирование сообщения обратной связи
   */
  formatFeedbackMessage(patterns) {
    const messages = [];

    // Паттерны стресса
    if (patterns.stress && patterns.stress.highStressPercentage >= 50) {
      messages.push(`🔍 Паттерн: Вы часто испытываете высокий стресс (${patterns.stress.highStressPercentage}% времени)`);
      
      if (patterns.stress.topStressActivity) {
        messages.push(`📋 Это часто происходит при: "${patterns.stress.topStressActivity}"`);
      }
    }

    // Паттерны настроения
    if (patterns.mood) {
      if (patterns.mood.stable) {
        messages.push(`😌 Ваше настроение довольно стабильно (среднее: ${patterns.mood.avgLevel})`);
      } else {
        messages.push(`🎭 Ваше настроение сильно варьируется (среднее: ${patterns.mood.avgLevel})`);
      }
    }

    // Flow паттерны
    if (patterns.flow && patterns.flow.flowPercentage > 0) {
      if (patterns.flow.flowPercentage >= 30) {
        messages.push(`🌊 Отлично! Вы часто находитесь в потоке (${patterns.flow.flowPercentage}%)`);
      } else {
        messages.push(`⚡ Вы иногда входите в состояние потока (${patterns.flow.flowPercentage}%)`);
      }
    }

    // Феномены сознания
    if (patterns.phenomena && patterns.phenomena.dominantPhenomenon) {
      const phenomenonName = this.config.phenomena[patterns.phenomena.dominantPhenomenon]?.name;
      if (phenomenonName) {
        messages.push(`💭 У вас часто наблюдается: ${phenomenonName.toLowerCase()}`);
      }
    }

    // Консистентность
    if (patterns.consistency && patterns.consistency.consistencyScore < 60) {
      messages.push(`🎯 Совет: Обратите внимание на связь между настроением и стрессом`);
    }

    if (messages.length === 0) {
      return null;
    }

    return `\n\n🔍 Ваши паттерны:\n${messages.join('\n')}\n\n❓ Это отражает ваш реальный опыт?`;
  }

  /**
   * Вспомогательные методы
   */
  extractKeywords(text) {
    const stopWords = ['в', 'на', 'с', 'и', 'а', 'но', 'или', 'для', 'от', 'по', 'за', 'из'];
    return text
      .split(/[\s,.-]+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 3); // Берём только первые 3 ключевых слова
  }

  calculateTrend(values) {
    if (values.length < 3) return 'unknown';
    
    const recent = values.slice(0, Math.ceil(values.length / 2));
    const older = values.slice(Math.ceil(values.length / 2));
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  calculateVariability(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

module.exports = PatternFeedback;