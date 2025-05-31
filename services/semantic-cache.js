const crypto = require('crypto');

/**
 * Высокоэффективная система кэширования для семантического анализа
 * Обеспечивает быстрый доступ к результатам анализа и избегает повторных вызовов ИИ
 */
class SemanticCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 300000; // 5 минут по умолчанию
    this.maxSize = options.maxSize || 1000;
    this.hitCount = 0;
    this.missCount = 0;
    this.totalRequests = 0;
    
    // Автоочистка каждые 5 минут
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Генерация ключа кэша на основе вопроса и контекста ответов
   */
  generateKey(candidateQuestion, responses, context = {}) {
    const questionSignature = `${candidateQuestion.clarifies}_${candidateQuestion.priority}`;
    
    // Создаем детерминистический хэш ответов
    const responseSignature = Object.entries(responses)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}:${this.normalizeText(value)}`)
      .join('|');
    
    const contextSignature = `${context.trainingDay || 0}_${context.userId || 'anon'}`;
    
    const fullSignature = `${questionSignature}#${responseSignature}#${contextSignature}`;
    
    return crypto.createHash('sha256')
      .update(fullSignature)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Нормализация текста для консистентного кэширования
   */
  normalizeText(text) {
    if (typeof text !== 'string') {
      return typeof text === 'object' && text.text ? text.text : String(text || '');
    }
    
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200); // Ограничиваем длину для эффективности
  }

  /**
   * Получение результата из кэша
   */
  get(candidateQuestion, responses, context) {
    this.totalRequests++;
    
    const key = this.generateKey(candidateQuestion, responses, context);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.missCount++;
      return null;
    }
    
    // Проверяем TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }
    
    this.hitCount++;
    
    // Обновляем timestamp для LRU-подобного поведения
    cached.lastAccessed = Date.now();
    
    return {
      ...cached.data,
      fromCache: true,
      cacheAge: Date.now() - cached.timestamp
    };
  }

  /**
   * Сохранение результата в кэш
   */
  set(candidateQuestion, responses, context, result) {
    const key = this.generateKey(candidateQuestion, responses, context);
    
    // Если кэш переполнен, удаляем самые старые записи
    if (this.cache.size >= this.maxSize) {
      this.evictOldEntries();
    }
    
    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      questionType: candidateQuestion.clarifies,
      responseCount: Object.keys(responses).length
    });
    
    return key;
  }

  /**
   * Удаление старых записей (LRU-подобное поведение)
   */
  evictOldEntries() {
    const entries = Array.from(this.cache.entries());
    
    // Сортируем по времени последнего доступа
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // Удаляем 20% самых старых записей
    const toDelete = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toDelete; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Периодическая очистка истекших записей
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`SemanticCache: Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Получение статистики кэша
   */
  getStats() {
    const hitRate = this.totalRequests > 0 ? (this.hitCount / this.totalRequests * 100).toFixed(2) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      totalRequests: this.totalRequests,
      hitRate: `${hitRate}%`,
      ttl: this.ttl,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Оценка использования памяти
   */
  estimateMemoryUsage() {
    const avgEntrySize = 500; // Примерный размер записи в байтах
    const totalSize = this.cache.size * avgEntrySize;
    
    if (totalSize < 1024) return `${totalSize}B`;
    if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)}KB`;
    return `${(totalSize / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Инвалидация кэша для конкретного пользователя
   */
  invalidateUser(userId) {
    let invalidated = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (key.includes(userId)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    return invalidated;
  }

  /**
   * Принудительная очистка всего кэша
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.totalRequests = 0;
    
    console.log(`SemanticCache: Cleared ${size} entries`);
    return size;
  }

  /**
   * Экспорт кэша для анализа
   */
  export() {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      questionType: value.questionType,
      responseCount: value.responseCount,
      age: Date.now() - value.timestamp,
      lastAccessed: Date.now() - value.lastAccessed,
      result: {
        shouldAsk: value.data.shouldAsk,
        confidence: value.data.confidence,
        reason: value.data.reason
      }
    }));
    
    return {
      stats: this.getStats(),
      entries: entries,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

module.exports = SemanticCache;