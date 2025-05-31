/**
 * Система мониторинга семантического анализа
 * Отслеживает производительность, точность и использование системы предотвращения дублирования
 */
class SemanticAnalysisMonitor {
  constructor() {
    this.metrics = {
      // Общие метрики
      totalAnalyses: 0,
      staticAnalyses: 0,
      aiAnalyses: 0,
      
      // Метрики производительности
      averageLatency: 0,
      p95Latency: 0,
      timeouts: 0,
      errors: 0,
      
      // Метрики точности
      questionsBlocked: 0,
      questionsAllowed: 0,
      highConfidenceDecisions: 0,
      lowConfidenceDecisions: 0,
      
      // Метрики по типам вопросов
      questionTypes: new Map(),
      
      // Метрики по пользователям
      userPatterns: new Map(),
      
      // Временные метрики
      hourlyStats: new Map()
    };
    
    this.latencyHistory = [];
    this.maxHistorySize = 1000;
    
    // Запускаем периодическую аггрегацию
    this.startAggregation();
  }

  /**
   * Записать начало анализа
   */
  startAnalysis(context = {}) {
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const analysis = {
      id: analysisId,
      startTime: Date.now(),
      context: {
        userId: context.userId,
        questionType: context.questionType,
        trainingDay: context.trainingDay,
        responseCount: context.responseCount
      }
    };
    
    return analysis;
  }

  /**
   * Записать завершение анализа
   */
  endAnalysis(analysis, result, error = null) {
    const endTime = Date.now();
    const latency = endTime - analysis.startTime;
    
    // Обновляем общие метрики
    this.metrics.totalAnalyses++;
    
    if (error) {
      this.metrics.errors++;
      this.recordError(error, analysis);
      return;
    }
    
    // Записываем метрики производительности
    this.recordLatency(latency);
    
    // Классифицируем тип анализа
    if (result.provider === 'local' || result.fromCache) {
      this.metrics.staticAnalyses++;
    } else {
      this.metrics.aiAnalyses++;
    }
    
    // Записываем решение
    if (result.shouldAsk) {
      this.metrics.questionsAllowed++;
    } else {
      this.metrics.questionsBlocked++;
    }
    
    // Записываем уверенность
    if (result.confidence >= 0.8) {
      this.metrics.highConfidenceDecisions++;
    } else if (result.confidence <= 0.5) {
      this.metrics.lowConfidenceDecisions++;
    }
    
    // Записываем метрики по типу вопроса
    this.recordQuestionType(analysis.context.questionType, result);
    
    // Записываем пользовательские паттерны
    this.recordUserPattern(analysis.context.userId, result, analysis.context);
    
    // Записываем почасовую статистику
    this.recordHourlyStats(result);
  }

  /**
   * Записать метрики задержки
   */
  recordLatency(latency) {
    this.latencyHistory.push(latency);
    
    // Ограничиваем размер истории
    if (this.latencyHistory.length > this.maxHistorySize) {
      this.latencyHistory.shift();
    }
    
    // Пересчитываем статистики
    this.calculateLatencyStats();
  }

  /**
   * Вычисление статистик задержки
   */
  calculateLatencyStats() {
    if (this.latencyHistory.length === 0) return;
    
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    
    // Среднее значение
    this.metrics.averageLatency = Math.round(
      this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length
    );
    
    // 95-й перцентиль
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.p95Latency = sorted[p95Index] || 0;
  }

  /**
   * Записать метрики по типу вопроса
   */
  recordQuestionType(questionType, result) {
    if (!questionType) return;
    
    if (!this.metrics.questionTypes.has(questionType)) {
      this.metrics.questionTypes.set(questionType, {
        total: 0,
        blocked: 0,
        allowed: 0,
        avgConfidence: 0,
        confidenceSum: 0
      });
    }
    
    const stats = this.metrics.questionTypes.get(questionType);
    stats.total++;
    stats.confidenceSum += result.confidence;
    stats.avgConfidence = stats.confidenceSum / stats.total;
    
    if (result.shouldAsk) {
      stats.allowed++;
    } else {
      stats.blocked++;
    }
  }

  /**
   * Записать паттерны пользователя
   */
  recordUserPattern(userId, result, context) {
    if (!userId) return;
    
    if (!this.metrics.userPatterns.has(userId)) {
      this.metrics.userPatterns.set(userId, {
        totalQuestions: 0,
        blockedQuestions: 0,
        trainingDay: context.trainingDay,
        questionTypes: new Set(),
        avgConfidence: 0,
        confidenceSum: 0,
        lastSeen: Date.now()
      });
    }
    
    const pattern = this.metrics.userPatterns.get(userId);
    pattern.totalQuestions++;
    pattern.confidenceSum += result.confidence;
    pattern.avgConfidence = pattern.confidenceSum / pattern.totalQuestions;
    pattern.lastSeen = Date.now();
    
    if (context.questionType) {
      pattern.questionTypes.add(context.questionType);
    }
    
    if (!result.shouldAsk) {
      pattern.blockedQuestions++;
    }
  }

  /**
   * Записать почасовую статистику
   */
  recordHourlyStats(result) {
    const hour = new Date().getHours();
    
    if (!this.metrics.hourlyStats.has(hour)) {
      this.metrics.hourlyStats.set(hour, {
        total: 0,
        blocked: 0,
        allowed: 0,
        avgConfidence: 0,
        confidenceSum: 0
      });
    }
    
    const stats = this.metrics.hourlyStats.get(hour);
    stats.total++;
    stats.confidenceSum += result.confidence;
    stats.avgConfidence = stats.confidenceSum / stats.total;
    
    if (result.shouldAsk) {
      stats.allowed++;
    } else {
      stats.blocked++;
    }
  }

  /**
   * Записать ошибку
   */
  recordError(error, analysis) {
    console.error('Semantic Analysis Error:', {
      analysisId: analysis.id,
      error: error.message,
      context: analysis.context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Получить текущие метрики
   */
  getMetrics() {
    const blockingRate = this.metrics.totalAnalyses > 0 
      ? (this.metrics.questionsBlocked / this.metrics.totalAnalyses * 100).toFixed(1)
      : 0;
    
    const aiUsageRate = this.metrics.totalAnalyses > 0
      ? (this.metrics.aiAnalyses / this.metrics.totalAnalyses * 100).toFixed(1)
      : 0;
    
    const errorRate = this.metrics.totalAnalyses > 0
      ? (this.metrics.errors / this.metrics.totalAnalyses * 100).toFixed(1)
      : 0;
    
    const highConfidenceRate = this.metrics.totalAnalyses > 0
      ? (this.metrics.highConfidenceDecisions / this.metrics.totalAnalyses * 100).toFixed(1)
      : 0;
    
    return {
      summary: {
        totalAnalyses: this.metrics.totalAnalyses,
        blockingRate: `${blockingRate}%`,
        aiUsageRate: `${aiUsageRate}%`,
        errorRate: `${errorRate}%`,
        highConfidenceRate: `${highConfidenceRate}%`
      },
      performance: {
        averageLatency: `${this.metrics.averageLatency}ms`,
        p95Latency: `${this.metrics.p95Latency}ms`,
        timeouts: this.metrics.timeouts,
        errors: this.metrics.errors
      },
      decisions: {
        questionsBlocked: this.metrics.questionsBlocked,
        questionsAllowed: this.metrics.questionsAllowed,
        highConfidence: this.metrics.highConfidenceDecisions,
        lowConfidence: this.metrics.lowConfidenceDecisions
      },
      breakdown: {
        staticAnalyses: this.metrics.staticAnalyses,
        aiAnalyses: this.metrics.aiAnalyses
      }
    };
  }

  /**
   * Получить детальную статистику по типам вопросов
   */
  getQuestionTypeStats() {
    const stats = {};
    
    for (const [type, data] of this.metrics.questionTypes.entries()) {
      const blockingRate = data.total > 0 ? (data.blocked / data.total * 100).toFixed(1) : 0;
      
      stats[type] = {
        total: data.total,
        blocked: data.blocked,
        allowed: data.allowed,
        blockingRate: `${blockingRate}%`,
        avgConfidence: data.avgConfidence.toFixed(3)
      };
    }
    
    return stats;
  }

  /**
   * Получить статистику по пользователям (анонимизированную)
   */
  getUserStats() {
    const stats = [];
    
    for (const [userId, data] of this.metrics.userPatterns.entries()) {
      const blockingRate = data.totalQuestions > 0 
        ? (data.blockedQuestions / data.totalQuestions * 100).toFixed(1) 
        : 0;
      
      stats.push({
        userId: userId.substring(0, 8) + '...', // Анонимизация
        totalQuestions: data.totalQuestions,
        blockingRate: `${blockingRate}%`,
        avgConfidence: data.avgConfidence.toFixed(3),
        trainingDay: data.trainingDay,
        uniqueQuestionTypes: data.questionTypes.size,
        daysSinceLastSeen: Math.floor((Date.now() - data.lastSeen) / (1000 * 60 * 60 * 24))
      });
    }
    
    return stats.sort((a, b) => b.totalQuestions - a.totalQuestions);
  }

  /**
   * Получить почасовую статистику
   */
  getHourlyStats() {
    const stats = {};
    
    for (let hour = 0; hour < 24; hour++) {
      const data = this.metrics.hourlyStats.get(hour) || {
        total: 0, blocked: 0, allowed: 0, avgConfidence: 0
      };
      
      const blockingRate = data.total > 0 ? (data.blocked / data.total * 100).toFixed(1) : 0;
      
      stats[hour] = {
        total: data.total,
        blockingRate: `${blockingRate}%`,
        avgConfidence: data.avgConfidence.toFixed(3)
      };
    }
    
    return stats;
  }

  /**
   * Генерировать отчет для анализа
   */
  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      overview: this.getMetrics(),
      questionTypes: this.getQuestionTypeStats(),
      users: this.getUserStats().slice(0, 10), // Топ 10 пользователей
      hourlyDistribution: this.getHourlyStats(),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Генерировать рекомендации на основе метрик
   */
  generateRecommendations() {
    const recommendations = [];
    const metrics = this.getMetrics();
    
    // Анализ частоты блокировки
    const blockingRate = parseFloat(metrics.summary.blockingRate);
    if (blockingRate > 50) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Высокая частота блокировки вопросов (${blockingRate}%). Возможно, стоит пересмотреть пороги уверенности.`
      });
    } else if (blockingRate < 10) {
      recommendations.push({
        type: 'effectiveness',
        priority: 'low',
        message: `Низкая частота блокировки (${blockingRate}%). Система может быть слишком консервативной.`
      });
    }
    
    // Анализ использования ИИ
    const aiUsageRate = parseFloat(metrics.summary.aiUsageRate);
    if (aiUsageRate > 80) {
      recommendations.push({
        type: 'cost',
        priority: 'high',
        message: `Высокое использование ИИ (${aiUsageRate}%). Рассмотрите улучшение статических правил для снижения затрат.`
      });
    }
    
    // Анализ задержки
    const avgLatency = parseInt(metrics.performance.averageLatency);
    if (avgLatency > 2000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Высокая задержка (${avgLatency}ms). Рассмотрите оптимизацию или увеличение кэширования.`
      });
    }
    
    // Анализ ошибок
    const errorRate = parseFloat(metrics.summary.errorRate);
    if (errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'critical',
        message: `Высокий уровень ошибок (${errorRate}%). Требуется срочное исследование причин.`
      });
    }
    
    return recommendations;
  }

  /**
   * Запуск периодической аггрегации данных
   */
  startAggregation() {
    // Каждые 10 минут выводим краткую статистику
    setInterval(() => {
      const metrics = this.getMetrics();
      console.log('Semantic Analysis Stats:', {
        totalAnalyses: metrics.summary.totalAnalyses,
        blockingRate: metrics.summary.blockingRate,
        avgLatency: metrics.performance.averageLatency
      });
    }, 10 * 60 * 1000);
    
    // Каждый час выводим рекомендации
    setInterval(() => {
      const recommendations = this.generateRecommendations();
      if (recommendations.length > 0) {
        console.log('Semantic Analysis Recommendations:', recommendations);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Экспорт данных для внешнего анализа
   */
  exportData() {
    return {
      metrics: this.metrics,
      latencyHistory: this.latencyHistory,
      report: this.generateReport()
    };
  }

  /**
   * Сброс всех метрик
   */
  reset() {
    this.metrics = {
      totalAnalyses: 0,
      staticAnalyses: 0,
      aiAnalyses: 0,
      averageLatency: 0,
      p95Latency: 0,
      timeouts: 0,
      errors: 0,
      questionsBlocked: 0,
      questionsAllowed: 0,
      highConfidenceDecisions: 0,
      lowConfidenceDecisions: 0,
      questionTypes: new Map(),
      userPatterns: new Map(),
      hourlyStats: new Map()
    };
    
    this.latencyHistory = [];
  }
}

module.exports = SemanticAnalysisMonitor;