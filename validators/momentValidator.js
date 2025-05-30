const config = require('../config/hurlburt');

/**
 * Валидатор моментального опыта по методу Херлберта
 * 
 * Проверяет качество самоотчётов и помогает пользователям
 * научиться точному самонаблюдению.
 */
class MomentValidator {
  constructor() {
    this.config = config.validation;
    this.phenomena = config.phenomena;
  }

  /**
   * Основная функция валидации
   * @param {string} text - Ответ пользователя
   * @param {string} validationType - Тип валидации (pristine, specific, etc.)
   * @param {Object} context - Контекст (предыдущие ответы, день обучения и т.д.)
   * @returns {Object} - { valid, feedback, score, detectedIssues, phenomena }
   */
  validate(text, validationType = 'general', context = {}) {
    const result = {
      valid: true,
      feedback: null,
      score: 100,
      detectedIssues: [],
      phenomena: [],
      suggestions: []
    };

    // Базовые проверки
    if (!text || text.trim().length === 0) {
      return {
        ...result,
        valid: false,
        feedback: '📝 Пожалуйста, опишите ваш опыт',
        score: 0
      };
    }

    const normalizedText = text.toLowerCase().trim();

    // Проверка минимальной длины
    if (normalizedText.length < 10) {
      result.detectedIssues.push('too_short');
      result.score -= 30;
      result.suggestions.push('Добавьте больше деталей');
    }

    // Проверка на мусорные паттерны
    const garbageCheck = this.checkGarbagePatterns(normalizedText);
    if (garbageCheck.found.length > 0) {
      result.detectedIssues.push(...garbageCheck.types);
      result.score -= garbageCheck.penalty;
      result.feedback = garbageCheck.feedback;
    }

    // Проверка позитивных паттернов
    const positiveCheck = this.checkPositivePatterns(normalizedText);
    result.score += positiveCheck.bonus;
    if (positiveCheck.found.length > 0) {
      result.phenomena.push(...positiveCheck.phenomena);
    }

    // Специфичная валидация
    if (validationType === 'pristine') {
      const pristineCheck = this.validatePristineExperience(normalizedText, context);
      result.score = Math.min(result.score, pristineCheck.score);
      if (pristineCheck.feedback) {
        result.feedback = pristineCheck.feedback;
      }
      result.detectedIssues.push(...pristineCheck.issues);
    }

    // Проверка на повторы из предыдущих ответов
    if (context.previousResponses) {
      const repeatCheck = this.checkForRepeats(normalizedText, context.previousResponses);
      if (repeatCheck.isRepeat) {
        result.detectedIssues.push('repeat');
        result.score -= 20;
        result.suggestions.push('Опишите именно ЭТОТ момент, не повторяйте прошлые');
      }
    }

    // Детекция феноменов Херлберта
    const phenomenaDetected = this.detectHurlburtPhenomena(normalizedText);
    result.phenomena.push(...phenomenaDetected);

    // Финальная оценка
    result.score = Math.max(0, Math.min(100, result.score));
    result.valid = result.score >= 40 || (context.trainingDay === 1 && result.score >= 30);

    // Генерация персонализированной обратной связи
    if (!result.valid && !result.feedback) {
      result.feedback = this.generateFeedback(result.detectedIssues, context);
    }

    return result;
  }

  /**
   * Проверка на мусорные паттерны
   */
  checkGarbagePatterns(text) {
    const found = [];
    const types = [];
    let penalty = 0;
    let feedback = null;

    // Проверяем каждый тип мусорных паттернов
    for (const [type, patterns] of Object.entries(this.config.garbage)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          found.push(pattern);
          if (!types.includes(type)) {
            types.push(type);
          }
        }
      }
    }

    // Расчёт штрафа и обратной связи
    if (types.includes('generic')) {
      penalty += 20;
      feedback = config.messages.corrections.tooGeneric;
    }
    if (types.includes('theoretical')) {
      penalty += 25;
      feedback = config.messages.corrections.theoretical;
    }
    if (types.includes('retrospective')) {
      penalty += 30;
      feedback = config.messages.corrections.retrospective;
    }
    if (types.includes('future')) {
      penalty += 30;
      feedback = config.messages.corrections.future;
    }
    if (types.includes('abstract')) {
      penalty += 15;
      feedback = config.messages.corrections.abstract;
    }

    return { found, types, penalty, feedback };
  }

  /**
   * Проверка позитивных паттернов
   */
  checkPositivePatterns(text) {
    const found = [];
    const phenomena = [];
    let bonus = 0;

    for (const [type, patterns] of Object.entries(this.config.positive)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          found.push(pattern);
          
          switch(type) {
            case 'sensory':
              bonus += 10;
              phenomena.push('sensory_awareness');
              break;
            case 'specific':
              bonus += 8;
              break;
            case 'momentary':
              bonus += 12;
              break;
          }
        }
      }
    }

    return { found, phenomena, bonus };
  }

  /**
   * Валидация "чистого" опыта (pristine experience)
   */
  validatePristineExperience(text, context) {
    const issues = [];
    let score = 100;
    let feedback = null;

    // Проверка на интерпретацию вместо описания
    const interpretationWords = ['потому что', 'так как', 'поэтому', 'значит', 'следовательно'];
    if (interpretationWords.some(word => text.includes(word))) {
      issues.push('interpretation');
      score -= 15;
    }

    // Проверка на оценочные суждения
    const judgmentWords = ['хорошо', 'плохо', 'правильно', 'неправильно', 'должен'];
    if (judgmentWords.some(word => text.includes(word))) {
      issues.push('judgment');
      score -= 10;
    }

    // Проверка временной специфичности
    const pastWords = ['был', 'была', 'было', 'были'];
    const presentWords = ['есть', 'нахожусь', 'делаю', 'вижу', 'слышу'];
    
    const pastCount = pastWords.filter(word => text.includes(word)).length;
    const presentCount = presentWords.filter(word => text.includes(word)).length;
    
    if (pastCount > presentCount * 2) {
      issues.push('past_tense');
      score -= 20;
      feedback = '⏰ Используйте настоящее время - опишите момент как фотографию';
    }

    // Проверка на слишком длинное описание (признак додумывания)
    if (text.length > 300) {
      issues.push('too_long');
      score -= 10;
      feedback = config.messages.corrections.tooLong;
    }

    return { score, feedback, issues };
  }

  /**
   * Проверка на повторы
   */
  checkForRepeats(text, previousResponses) {
    // Простая проверка на схожесть с предыдущими ответами
    const threshold = 0.7; // 70% схожести
    
    // Безопасная обработка массива
    if (!previousResponses || !Array.isArray(previousResponses)) {
      return { isRepeat: false };
    }
    
    for (const prev of previousResponses.slice(-5)) { // Проверяем последние 5
      // Пропускаем невалидные элементы
      if (!prev || typeof prev !== 'string') {
        continue;
      }
      
      const similarity = this.calculateSimilarity(text, prev);
      if (similarity > threshold) {
        return { isRepeat: true, similarity };
      }
    }
    
    return { isRepeat: false };
  }

  /**
   * Простой расчёт схожести текстов
   */
  calculateSimilarity(text1, text2) {
    // Безопасная проверка входных данных
    if (!text1 || !text2 || typeof text1 !== 'string' || typeof text2 !== 'string') {
      return 0;
    }
    
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Детекция феноменов Херлберта
   */
  detectHurlburtPhenomena(text) {
    const detected = [];

    for (const [key, phenomenon] of Object.entries(this.phenomena)) {
      for (const marker of phenomenon.markers) {
        if (text.includes(marker)) {
          detected.push({
            type: key,
            name: phenomenon.name,
            confidence: 0.7 // Можно улучшить с ML
          });
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Генерация персонализированной обратной связи
   */
  generateFeedback(issues, context) {
    // Приоритет проблем
    const priority = ['retrospective', 'future', 'theoretical', 'generic', 'abstract', 'too_short'];
    
    for (const issue of priority) {
      if (issues.includes(issue)) {
        return config.messages.corrections[issue] || config.messages.corrections.tooGeneric;
      }
    }

    // Обратная связь в зависимости от дня обучения
    if (context.trainingDay === 1) {
      return '💡 Помните: опишите что было ПРЯМО В МОМЕНТ сигнала';
    } else if (context.trainingDay === 2) {
      return '🔍 Добавьте конкретные детали - что именно вы видели/слышали/чувствовали?';
    } else {
      return '🎯 Сфокусируйтесь на чистом опыте без интерпретаций';
    }
  }

  /**
   * Расчёт общего качества данных для набора ответов
   */
  calculateOverallQuality(responses) {
    const weights = config.quality.weights;
    let totalScore = 0;

    // Специфичность
    const specificityScore = this.calculateSpecificity(responses);
    totalScore += specificityScore * weights.specificity;

    // Фокус на моменте
    const momentFocusScore = this.calculateMomentFocus(responses);
    totalScore += momentFocusScore * weights.momentFocus;

    // Сенсорные детали
    const sensoryScore = this.calculateSensoryDetail(responses);
    totalScore += sensoryScore * weights.sensoryDetail;

    // Консистентность
    const consistencyScore = this.calculateConsistency(responses);
    totalScore += consistencyScore * weights.consistency;

    // Краткость
    const brevityScore = this.calculateBrevity(responses);
    totalScore += brevityScore * weights.brevity;

    return Math.round(totalScore);
  }

  /**
   * Вспомогательные методы для расчёта качества
   */
  calculateSpecificity(responses) {
    // Анализируем конкретность описаний
    let totalSpecificity = 0;
    let count = 0;

    for (const [key, value] of Object.entries(responses)) {
      if (typeof value === 'string' && value.length > 10) {
        const specific = this.config.positive.specific;
        const matches = specific.filter(word => value.toLowerCase().includes(word)).length;
        totalSpecificity += Math.min(100, matches * 20);
        count++;
      }
    }

    return count > 0 ? totalSpecificity / count : 50;
  }

  calculateMomentFocus(responses) {
    // Проверяем фокус на настоящем моменте
    if (!responses.moment_capture) return 50;
    
    const text = responses.moment_capture.toLowerCase();
    const momentWords = this.config.positive.momentary;
    const retroWords = this.config.garbage.retrospective;
    
    const momentScore = momentWords.filter(w => text.includes(w)).length * 15;
    const retroPenalty = retroWords.filter(w => text.includes(w)).length * 20;
    
    return Math.max(0, Math.min(100, 50 + momentScore - retroPenalty));
  }

  calculateSensoryDetail(responses) {
    // Оцениваем наличие сенсорных деталей
    let sensoryCount = 0;
    let totalResponses = 0;

    for (const [key, value] of Object.entries(responses)) {
      if (typeof value === 'string' && value.length > 10) {
        const sensory = this.config.positive.sensory;
        if (sensory.some(word => value.toLowerCase().includes(word))) {
          sensoryCount++;
        }
        totalResponses++;
      }
    }

    return totalResponses > 0 ? (sensoryCount / totalResponses) * 100 : 50;
  }

  calculateConsistency(responses) {
    // Проверяем консистентность между шкалами и текстом
    const mood = responses.mood;
    const stress = responses.stress;
    const energy = responses.energy;
    const text = (responses.moment_capture || '').toLowerCase();

    let consistencyScore = 100;

    // Несоответствие настроения и стресса
    if (mood >= 6 && stress >= 6) {
      consistencyScore -= 20; // Высокое настроение + высокий стресс = подозрительно
    }

    // Несоответствие энергии и текста
    if (energy <= 2 && !text.match(/устал|утомлен|изможден|сонн/)) {
      consistencyScore -= 15;
    }

    // Проверка Flow состояния
    if (responses.challenge && responses.skill) {
      const flowState = this.detectFlowState(responses.challenge, responses.skill);
      if (flowState === 'flow' && stress >= 6) {
        consistencyScore -= 15; // В потоке обычно низкий стресс
      }
    }

    return Math.max(0, consistencyScore);
  }

  calculateBrevity(responses) {
    // Оцениваем краткость (не перегруженность деталями)
    const momentText = responses.moment_capture || '';
    const activityText = responses.currentActivity || '';
    
    const totalLength = momentText.length + activityText.length;
    
    if (totalLength < 50) return 60; // Слишком кратко
    if (totalLength > 500) return 40; // Слишком много
    if (totalLength > 300) return 70; // Многовато
    return 100; // Оптимально
  }

  /**
   * Определение Flow состояния
   */
  detectFlowState(challenge, skill) {
    const zones = config.flow.zones;
    
    for (const [zone, ranges] of Object.entries(zones)) {
      if (challenge >= ranges.challenge[0] && challenge <= ranges.challenge[1] &&
          skill >= ranges.skill[0] && skill <= ranges.skill[1]) {
        return zone;
      }
    }
    
    // Если не попали ни в одну зону, используем простую логику
    const diff = Math.abs(challenge - skill);
    if (diff <= 1 && challenge >= 5 && skill >= 5) return 'flow';
    if (challenge > skill + 2) return 'anxiety';
    if (skill > challenge + 2) return 'boredom';
    return 'neutral';
  }
}

module.exports = MomentValidator;