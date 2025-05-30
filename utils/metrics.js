/**
 * Простая система метрик для мониторинга качества ESM данных
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      // Валидация
      validationRequests: 0,
      validationErrors: 0,
      validationTimeouts: 0,
      averageValidationTime: 0,
      
      // Качество данных
      responseQualityScores: [],
      phenomenaDetected: {},
      illusionsDetected: 0,
      
      // Обучение
      trainingCompletions: 0,
      trainingDropouts: 0,
      averageTrainingQuality: 0,
      
      // AI использование
      aiProviderUsage: {},
      aiCacheHits: 0,
      aiCacheMisses: 0,
      
      // Пользователи
      activeUsers: 0,
      totalResponses: 0,
      
      // Система
      uptime: process.uptime(),
      lastReset: new Date()
    };
    
    this.timers = new Map();
    this.isCollecting = true;
  }

  /**
   * Запуск валидации - начинаем таймер
   */
  startValidation(userId, validationType) {
    const timerId = `validation_${userId}_${Date.now()}`;
    this.timers.set(timerId, {
      start: Date.now(),
      userId,
      type: validationType
    });
    
    this.metrics.validationRequests++;
    return timerId;
  }

  /**
   * Завершение валидации - записываем время
   */
  endValidation(timerId, result) {
    const timer = this.timers.get(timerId);
    if (!timer) return;
    
    const duration = Date.now() - timer.start;
    this.updateAverageValidationTime(duration);
    
    if (result?.score) {
      this.metrics.responseQualityScores.push(result.score);
      
      // Ограничиваем размер массива
      if (this.metrics.responseQualityScores.length > 1000) {
        this.metrics.responseQualityScores = this.metrics.responseQualityScores.slice(-500);
      }
    }
    
    if (result?.phenomena) {
      result.phenomena.forEach(phenomenon => {
        this.metrics.phenomenaDetected[phenomenon] = 
          (this.metrics.phenomenaDetected[phenomenon] || 0) + 1;
      });
    }
    
    this.timers.delete(timerId);
  }

  /**
   * Ошибка валидации
   */
  recordValidationError(error, timerId) {
    this.metrics.validationErrors++;
    
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      this.metrics.validationTimeouts++;
    }
    
    if (timerId) {
      this.timers.delete(timerId);
    }
  }

  /**
   * Использование AI провайдера
   */
  recordAIUsage(provider, success = true) {
    if (!this.metrics.aiProviderUsage[provider]) {
      this.metrics.aiProviderUsage[provider] = { success: 0, error: 0 };
    }
    
    if (success) {
      this.metrics.aiProviderUsage[provider].success++;
    } else {
      this.metrics.aiProviderUsage[provider].error++;
    }
  }

  /**
   * Попадание в кэш
   */
  recordCacheHit() {
    this.metrics.aiCacheHits++;
  }

  /**
   * Промах кэша
   */
  recordCacheMiss() {
    this.metrics.aiCacheMisses++;
  }

  /**
   * Завершение обучения
   */
  recordTrainingCompletion(qualityScore) {
    this.metrics.trainingCompletions++;
    
    // Обновляем среднее качество обучения
    const currentAvg = this.metrics.averageTrainingQuality;
    const count = this.metrics.trainingCompletions;
    this.metrics.averageTrainingQuality = 
      (currentAvg * (count - 1) + qualityScore) / count;
  }

  /**
   * Dropout из обучения
   */
  recordTrainingDropout() {
    this.metrics.trainingDropouts++;
  }

  /**
   * Обнаружение иллюзии
   */
  recordIllusionDetected(illusionType) {
    this.metrics.illusionsDetected++;
  }

  /**
   * Новый ответ пользователя
   */
  recordUserResponse(userId) {
    this.metrics.totalResponses++;
  }

  /**
   * Обновление среднего времени валидации
   */
  updateAverageValidationTime(duration) {
    const currentAvg = this.metrics.averageValidationTime;
    const count = this.metrics.validationRequests;
    this.metrics.averageValidationTime = 
      (currentAvg * (count - 1) + duration) / count;
  }

  /**
   * Получение текущих метрик
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      
      // Вычисляемые метрики
      computed: {
        validationSuccessRate: this.metrics.validationRequests > 0 ? 
          ((this.metrics.validationRequests - this.metrics.validationErrors) / this.metrics.validationRequests * 100).toFixed(2) + '%' : '0%',
        
        averageResponseQuality: this.metrics.responseQualityScores.length > 0 ?
          (this.metrics.responseQualityScores.reduce((a, b) => a + b, 0) / this.metrics.responseQualityScores.length).toFixed(1) : 0,
        
        cacheHitRate: (this.metrics.aiCacheHits + this.metrics.aiCacheMisses) > 0 ?
          (this.metrics.aiCacheHits / (this.metrics.aiCacheHits + this.metrics.aiCacheMisses) * 100).toFixed(2) + '%' : '0%',
        
        trainingCompletionRate: (this.metrics.trainingCompletions + this.metrics.trainingDropouts) > 0 ?
          (this.metrics.trainingCompletions / (this.metrics.trainingCompletions + this.metrics.trainingDropouts) * 100).toFixed(2) + '%' : '0%',
        
        topPhenomena: Object.entries(this.metrics.phenomenaDetected)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([phenomenon, count]) => ({ phenomenon, count }))
      }
    };
  }

  /**
   * Сброс метрик
   */
  reset() {
    this.metrics = {
      validationRequests: 0,
      validationErrors: 0,
      validationTimeouts: 0,
      averageValidationTime: 0,
      responseQualityScores: [],
      phenomenaDetected: {},
      illusionsDetected: 0,
      trainingCompletions: 0,
      trainingDropouts: 0,
      averageTrainingQuality: 0,
      aiProviderUsage: {},
      aiCacheHits: 0,
      aiCacheMisses: 0,
      activeUsers: 0,
      totalResponses: 0,
      uptime: process.uptime(),
      lastReset: new Date()
    };
    
    this.timers.clear();
    console.log('📊 Metrics reset completed');
  }

  /**
   * Экспорт метрик для внешних систем мониторинга
   */
  exportForMonitoring() {
    const metrics = this.getMetrics();
    
    return {
      // Prometheus-style metrics
      esm_validation_requests_total: metrics.validationRequests,
      esm_validation_errors_total: metrics.validationErrors,
      esm_validation_timeouts_total: metrics.validationTimeouts,
      esm_validation_duration_avg_ms: metrics.averageValidationTime,
      esm_response_quality_avg: metrics.computed.averageResponseQuality,
      esm_training_completions_total: metrics.trainingCompletions,
      esm_training_dropouts_total: metrics.trainingDropouts,
      esm_illusions_detected_total: metrics.illusionsDetected,
      esm_cache_hits_total: metrics.aiCacheHits,
      esm_cache_misses_total: metrics.aiCacheMisses,
      esm_responses_total: metrics.totalResponses,
      
      // Metadata
      timestamp: new Date().toISOString(),
      uptime_seconds: metrics.uptime
    };
  }

  /**
   * Логирование метрик в консоль
   */
  logStats() {
    const metrics = this.getMetrics();
    
    console.log('\n📊 ESM Metrics Summary:');
    console.log('======================');
    console.log(`⚡ Validations: ${metrics.validationRequests} (${metrics.computed.validationSuccessRate} success)`);
    console.log(`📈 Avg Quality: ${metrics.computed.averageResponseQuality}/100`);
    console.log(`🎓 Training: ${metrics.trainingCompletions} completed (${metrics.computed.trainingCompletionRate} rate)`);
    console.log(`🧠 AI Cache: ${metrics.computed.cacheHitRate} hit rate`);
    console.log(`🔍 Illusions: ${metrics.illusionsDetected} detected`);
    console.log(`👥 Responses: ${metrics.totalResponses} total`);
    
    if (metrics.computed.topPhenomena.length > 0) {
      console.log('\n🎯 Top Phenomena:');
      metrics.computed.topPhenomena.forEach(({ phenomenon, count }) => {
        console.log(`   ${phenomenon}: ${count}`);
      });
    }
    
    console.log(`\n⏱ Uptime: ${Math.round(metrics.uptime / 60)} minutes\n`);
  }

  /**
   * Периодическое логирование статистики
   */
  startPeriodicLogging(intervalMinutes = 60) {
    if (!this.isCollecting) return;
    
    setInterval(() => {
      this.logStats();
    }, intervalMinutes * 60 * 1000);
    
    console.log(`📊 Started periodic metrics logging every ${intervalMinutes} minutes`);
  }

  /**
   * Остановка сбора метрик
   */
  stop() {
    this.isCollecting = false;
    console.log('📊 Metrics collection stopped');
  }
}

// Глобальный экземпляр метрик
const metrics = new MetricsCollector();

// Экспорт удобных функций
module.exports = {
  metrics,
  
  // Shortcuts
  startValidation: (userId, type) => metrics.startValidation(userId, type),
  endValidation: (timerId, result) => metrics.endValidation(timerId, result),
  recordValidationError: (error, timerId) => metrics.recordValidationError(error, timerId),
  recordAIUsage: (provider, success) => metrics.recordAIUsage(provider, success),
  recordCacheHit: () => metrics.recordCacheHit(),
  recordCacheMiss: () => metrics.recordCacheMiss(),
  recordTrainingCompletion: (quality) => metrics.recordTrainingCompletion(quality),
  recordTrainingDropout: () => metrics.recordTrainingDropout(),
  recordIllusionDetected: (type) => metrics.recordIllusionDetected(type),
  recordUserResponse: (userId) => metrics.recordUserResponse(userId),
  
  getMetrics: () => metrics.getMetrics(),
  logStats: () => metrics.logStats(),
  resetMetrics: () => metrics.reset(),
  
  MetricsCollector
};

// Graceful shutdown
process.on('SIGINT', () => {
  metrics.logStats();
  metrics.stop();
});