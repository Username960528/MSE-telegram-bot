const goldenExamples = require('../config/golden-examples-config');

/**
 * Валидатор на основе золотого стандарта
 * Улучшает результаты momentValidator через сравнение с эталонными примерами
 */
class GoldenStandardValidator {
  constructor() {
    this.patterns = goldenExamples.patterns;
    this.examples = goldenExamples.examples;
    this.cache = new Map();
  }

  /**
   * Основная функция улучшения валидации
   * @param {Object} baseValidation - Результат от momentValidator
   * @param {string} text - Ответ пользователя
   * @param {Object} context - Контекст валидации
   * @returns {Object} - Улучшенный результат валидации
   */
  enhance(baseValidation, text, context = {}) {
    const goldenStandardResult = {
      score: baseValidation.score || 50,
      matchedPatterns: { positive: [], negative: [] },
      similarExamples: [],
      detectedContext: this.detectContext(text),
      qualityLevel: 'fair'
    };

    // 1. Анализируем паттерны
    const patternAnalysis = this.analyzePatterns(text);
    goldenStandardResult.matchedPatterns = patternAnalysis.patterns;
    
    // 2. Корректируем оценку на основе паттернов
    let adjustedScore = baseValidation.score || 50;
    adjustedScore += patternAnalysis.bonus;
    adjustedScore -= patternAnalysis.penalty;
    
    // 3. Ищем похожие примеры
    goldenStandardResult.similarExamples = this.findSimilarExamples(
      text, 
      goldenStandardResult.detectedContext
    );
    
    // 4. Дополнительные корректировки на основе контекста
    const contextAdjustment = this.getContextualAdjustment(
      text, 
      goldenStandardResult.detectedContext, 
      context
    );
    adjustedScore += contextAdjustment.adjustment;
    
    // 5. Финальная оценка и качество
    goldenStandardResult.score = Math.max(0, Math.min(100, adjustedScore));
    goldenStandardResult.qualityLevel = this.getQualityLevel(goldenStandardResult.score);
    
    // 6. Генерируем обратную связь
    const feedback = this.generateFeedback(goldenStandardResult, context);
    
    return {
      ...baseValidation,
      score: goldenStandardResult.score,
      quality: goldenStandardResult.qualityLevel,
      goldenStandard: goldenStandardResult,
      feedback: feedback || baseValidation.feedback,
      phenomena: [
        ...(baseValidation.phenomena || []),
        ...this.extractPhenomena(goldenStandardResult)
      ]
    };
  }

  /**
   * Определение контекста ответа
   */
  detectContext(text) {
    const textLower = text.toLowerCase();
    
    // Чтение
    if (/чита|текст|книг|статья|экран|строк|слово|буква/.test(textLower)) {
      return 'reading';
    }
    
    // Работа
    if (/работа|компьютер|клавиш|мышь|проект|код|програм|офис/.test(textLower)) {
      return 'work';
    }
    
    // Еда
    if (/ел|пил|кус|жев|глота|вкус|еда|завтрак|обед|ужин/.test(textLower)) {
      return 'eating';
    }
    
    // Эмоции
    if (/злой|радост|груст|серди|счастлив|расстроен|взволнован/.test(textLower)) {
      return 'emotion';
    }
    
    // Пустота
    if (/ничего|пуст|тишина|молчан|без мысл|провал/.test(textLower)) {
      return 'nothing';
    }
    
    return 'general';
  }

  /**
   * Анализ паттернов в тексте
   */
  analyzePatterns(text) {
    const textLower = text.toLowerCase();
    const patterns = { positive: [], negative: [] };
    let bonus = 0;
    let penalty = 0;

    // Проверяем позитивные паттерны
    for (const pattern of this.patterns.positive) {
      if (pattern.regex.test(textLower)) {
        patterns.positive.push({
          name: pattern.name,
          category: pattern.category,
          impact: `+${pattern.weight} баллов`
        });
        bonus += pattern.weight;
      }
    }

    // Проверяем негативные паттерны
    for (const pattern of this.patterns.negative) {
      if (pattern.regex.test(textLower)) {
        patterns.negative.push({
          name: pattern.name,
          category: pattern.category,
          impact: `-${pattern.penalty} баллов`,
          suggestion: pattern.suggestion
        });
        penalty += pattern.penalty;
      }
    }

    return { patterns, bonus, penalty };
  }

  /**
   * Поиск похожих примеров
   */
  findSimilarExamples(text, context, limit = 3) {
    const contextExamples = this.examples[context] || this.examples.general;
    const allExamples = [];

    // Собираем все примеры из контекста
    ['excellent', 'good', 'poor'].forEach(quality => {
      if (contextExamples[quality]) {
        contextExamples[quality].forEach(example => {
          allExamples.push({
            ...example,
            quality,
            similarity: this.calculateSimilarity(text, example.text),
            educationalValue: this.calculateEducationalValue(example, quality)
          });
        });
      }
    });

    // Сортируем по релевантности
    return allExamples
      .sort((a, b) => {
        // Приоритет: образовательная ценность, затем схожесть
        const aScore = a.educationalValue * 0.7 + a.similarity * 0.3;
        const bScore = b.educationalValue * 0.7 + b.similarity * 0.3;
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  /**
   * Расчёт схожести текстов
   */
  calculateSimilarity(text1, text2) {
    const words1 = this.tokenize(text1);
    const words2 = this.tokenize(text2);
    
    // Простой Jaccard коэффициент
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Токенизация текста
   */
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\wа-яё\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Расчёт образовательной ценности примера
   */
  calculateEducationalValue(example, quality) {
    let value = 0;
    
    // Базовая ценность по качеству
    switch(quality) {
      case 'excellent': value = 0.9; break;
      case 'good': value = 0.7; break;
      case 'poor': value = 0.5; break;
      default: value = 0.3;
    }
    
    // Бонус за специальные теги
    const tags = example.tags || [];
    if (tags.includes('high_educational_value')) value += 0.1;
    if (tags.includes('pristine')) value += 0.1;
    if (tags.includes('common_mistake') && quality === 'poor') value += 0.2;
    
    return Math.min(1.0, value);
  }

  /**
   * Контекстуальные корректировки
   */
  getContextualAdjustment(text, detectedContext, context) {
    let adjustment = 0;
    const reasons = [];

    // Корректировки для чтения
    if (detectedContext === 'reading') {
      if (/внутренн.*голос|проговарива/i.test(text)) {
        adjustment -= 25;
        reasons.push('Вероятная иллюзия внутреннего голоса при чтении');
      }
      
      if (/образ|картин|вижу|представля/i.test(text)) {
        adjustment += 15;
        reasons.push('Хорошее описание визуальных образов');
      }
    }

    // Корректировки для эмоций
    if (detectedContext === 'emotion') {
      if (/в груди|в животе|сердце|дыхан/i.test(text)) {
        adjustment += 20;
        reasons.push('Отличное описание телесных проявлений эмоции');
      }
      
      if (/чувствую|испытываю.*радость|был.*злой/i.test(text)) {
        adjustment -= 10;
        reasons.push('Ярлыки эмоций вместо описания опыта');
      }
    }

    // Корректировки в зависимости от дня обучения
    if (context.trainingDay <= 2) {
      // В первые дни более снисходительно
      if (adjustment < 0) {
        adjustment *= 0.7;
        reasons.push('Скидка для дня обучения');
      }
    }

    return { adjustment, reasons };
  }

  /**
   * Определение уровня качества по баллам
   */
  getQualityLevel(score) {
    if (score >= 90) return 'pristine';
    if (score >= 80) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'garbage';
  }

  /**
   * Извлечение феноменов из анализа
   */
  extractPhenomena(goldenStandardResult) {
    const phenomena = [];
    
    // На основе позитивных паттернов
    goldenStandardResult.matchedPatterns.positive.forEach(pattern => {
      switch(pattern.category) {
        case 'sensory':
          phenomena.push('sensory_awareness');
          break;
        case 'somatic':
          phenomena.push('body_awareness');
          break;
        case 'emptiness':
          phenomena.push('acknowledged_emptiness');
          break;
        case 'thought':
          phenomena.push('inner_speech');
          break;
      }
    });
    
    return [...new Set(phenomena)]; // Убираем дубликаты
  }

  /**
   * Генерация обратной связи
   */
  generateFeedback(goldenStandardResult, context) {
    const { score, matchedPatterns, detectedContext } = goldenStandardResult;
    
    // Если качество высокое, позитивная обратная связь
    if (score >= 70) {
      const positivePatterns = matchedPatterns.positive;
      if (positivePatterns.length > 0) {
        const mainPattern = positivePatterns[0];
        return `🌟 Отлично! Особенно хорошо: ${this.getPatternDescription(mainPattern.name)}`;
      }
      return '✅ Хорошее описание момента!';
    }
    
    // Если есть серьёзные проблемы, показываем главную
    const negativePatterns = matchedPatterns.negative;
    if (negativePatterns.length > 0) {
      const mainIssue = negativePatterns[0];
      return mainIssue.suggestion || 'Попробуйте быть более конкретным';
    }
    
    // Контекстуальные подсказки
    return this.getContextualHint(detectedContext, context);
  }

  /**
   * Описания паттернов для обратной связи
   */
  getPatternDescription(patternName) {
    const descriptions = {
      'present_moment': 'фокус на настоящем моменте',
      'visual_details': 'конкретные визуальные детали',
      'body_awareness': 'осознанность телесных ощущений',
      'specific_objects': 'специфичность описания',
      'acknowledged_emptiness': 'честное признание пустоты'
    };
    
    return descriptions[patternName] || 'точность наблюдения';
  }

  /**
   * Контекстуальные подсказки
   */
  getContextualHint(detectedContext, context) {
    const hints = {
      'reading': 'При чтении обратите внимание: есть ли внутренний голос или только образы?',
      'work': 'Опишите конкретно: на что смотрели, что делали руками?',
      'emotion': 'Как эмоция проявлялась в теле? Что конкретно чувствовали?',
      'eating': 'Какие были вкусы, текстуры, ощущения во рту?',
      'nothing': 'Даже "ничего" - это опыт. Что именно было в сознании?',
      'general': 'Добавьте больше конкретных деталей момента'
    };
    
    return hints[detectedContext] || hints.general;
  }

  /**
   * Получение персонализированных рекомендаций
   */
  getPersonalizedRecommendations(userHistory) {
    const recommendations = [];
    
    if (!userHistory || userHistory.length === 0) {
      return [{
        type: 'general',
        priority: 'medium',
        suggestion: 'Фокусируйтесь на конкретных деталях момента'
      }];
    }
    
    // Анализируем паттерны пользователя
    const allPatterns = userHistory.flatMap(response => 
      response.goldenStandard?.matchedPatterns?.negative || []
    );
    
    // Группируем по типам проблем
    const issueFrequency = {};
    allPatterns.forEach(pattern => {
      issueFrequency[pattern.name] = (issueFrequency[pattern.name] || 0) + 1;
    });
    
    // Генерируем рекомендации на основе частых проблем
    Object.entries(issueFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([issue, frequency]) => {
        if (frequency >= 3) {
          recommendations.push(this.getRecommendationForIssue(issue, frequency));
        }
      });
    
    return recommendations.length > 0 ? recommendations : [{
      type: 'general',
      priority: 'low', 
      suggestion: 'Продолжайте развивать навыки точного наблюдения'
    }];
  }

  /**
   * Рекомендации для конкретных проблем
   */
  getRecommendationForIssue(issue, frequency) {
    const recommendations = {
      'generalization': {
        type: 'focus',
        priority: 'high',
        suggestion: 'Избегайте слов "обычно", "всегда". Описывайте именно ТОТ момент'
      },
      'reading_voice_illusion': {
        type: 'education',
        priority: 'high', 
        suggestion: 'При чтении проверьте: действительно ли есть внутренний голос или только понимание?'
      },
      'abstraction': {
        type: 'specificity',
        priority: 'medium',
        suggestion: 'Заменяйте оценки ("хорошо", "плохо") на конкретные описания'
      },
      'avoidance': {
        type: 'engagement',
        priority: 'high',
        suggestion: 'Что-то ВСЕГДА происходит в сознании. Попробуйте наблюдать внимательнее'
      }
    };
    
    return recommendations[issue] || {
      type: 'general',
      priority: 'medium',
      suggestion: 'Продолжайте практиковать точное наблюдение'
    };
  }

  /**
   * Кэширование для производительности
   */
  getCacheKey(text, context) {
    return `${text.substring(0, 30)}_${context}`;
  }
}

module.exports = new GoldenStandardValidator();