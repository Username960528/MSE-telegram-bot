/**
 * Конфигурация метода Descriptive Experience Sampling (DES) по Расселу Херлберту
 * 
 * Основано на 40+ годах исследований внутреннего опыта человека.
 * Цель: получить максимально точные данные о моментальном опыте сознания.
 */

module.exports = {
  // Параметры обучения
  training: {
    DAYS: 3,
    MIN_SURVEYS_PER_DAY: 3,
    MAX_VALIDATION_ATTEMPTS: 2,
    
    // Прогрессия обучения
    progression: {
      day1: {
        focus: 'moment_capture',
        requiredAccuracy: 40
      },
      day2: {
        focus: 'specificity',
        requiredAccuracy: 60
      },
      day3: {
        focus: 'pristine_experience',
        requiredAccuracy: 70
      }
    }
  },

  // Пороги качества данных
  quality: {
    thresholds: {
      unacceptable: 30,
      poor: 40,
      acceptable: 60,
      good: 70,
      excellent: 80,
      pristine: 90
    },
    
    // Веса для расчёта качества
    weights: {
      specificity: 0.25,      // Конкретность описания
      momentFocus: 0.3,       // Фокус на моменте
      sensoryDetail: 0.2,     // Сенсорные детали
      consistency: 0.15,      // Консистентность между ответами
      brevity: 0.1            // Краткость (не додумывание)
    }
  },

  // Паттерны для валидации
  validation: {
    // Мусорные паттерны
    garbage: {
      generic: [
        'нормально', 'обычно', 'как всегда', 'ничего особенного', 
        'всё ок', 'всё хорошо', 'ничего', 'не знаю', 'не помню'
      ],
      theoretical: [
        'я думаю', 'наверное', 'должен', 'обычно я', 'всегда',
        'никогда', 'часто', 'редко', 'иногда', 'бывает'
      ],
      retrospective: [
        'сегодня', 'утром', 'вчера', 'весь день', 'последнее время',
        'раньше', 'до этого', 'после', 'потом', 'недавно'
      ],
      future: [
        'буду', 'собираюсь', 'планирую', 'хочу', 'надо',
        'нужно', 'должен буду', 'завтра', 'скоро'
      ],
      abstract: [
        'успех', 'счастье', 'смысл', 'цель', 'мотивация',
        'продуктивность', 'эффективность', 'польза', 'важность'
      ]
    },
    
    // Позитивные паттерны
    positive: {
      sensory: [
        'вижу', 'слышу', 'чувствую', 'ощущаю', 'касаюсь',
        'пахнет', 'вкус', 'холод', 'тепло', 'боль', 'свет', 'темно'
      ],
      specific: [
        'экран', 'клавиатура', 'окно', 'стол', 'телефон',
        'монитор', 'кнопка', 'текст', 'слово', 'буква'
      ],
      momentary: [
        'сейчас', 'в этот момент', 'прямо', 'именно',
        'конкретно', 'точно', 'вот'
      ]
    }
  },

  // Херлбертовские феномены внутреннего опыта
  phenomena: {
    innerSpeech: {
      name: 'Внутренняя речь',
      frequency: 0.26, // 26% выборок в исследованиях
      markers: ['говорю себе', 'слышу слова', 'внутренний голос', 'проговариваю']
    },
    innerSeeing: {
      name: 'Внутреннее видение',
      frequency: 0.34,
      markers: ['вижу образ', 'представляю', 'картинка', 'визуализирую']
    },
    unsymbolizedThinking: {
      name: 'Несимволизированное мышление',
      frequency: 0.22,
      markers: ['знаю', 'понимаю', 'чувство что', 'ощущение понимания']
    },
    feeling: {
      name: 'Чувство',
      frequency: 0.26,
      markers: ['эмоция', 'чувство', 'настроение', 'переживание']
    },
    sensoryAwareness: {
      name: 'Сенсорное осознание',
      frequency: 0.22,
      markers: ['ощущаю', 'чувствую телом', 'физическое', 'боль', 'тепло']
    }
  },

  // Flow состояния (Csikszentmihalyi)
  flow: {
    // Зоны на основе соотношения challenge/skill
    zones: {
      anxiety: { challenge: [7, 9], skill: [0, 3] },
      arousal: { challenge: [7, 9], skill: [4, 6] },
      flow: { challenge: [6, 8], skill: [6, 8] },
      control: { challenge: [4, 6], skill: [7, 9] },
      relaxation: { challenge: [0, 3], skill: [7, 9] },
      boredom: { challenge: [0, 3], skill: [4, 6] },
      apathy: { challenge: [0, 3], skill: [0, 3] },
      worry: { challenge: [4, 6], skill: [0, 3] }
    }
  },

  // Сообщения и обратная связь
  messages: {
    encouragements: [
      '✨ Отличное наблюдение!',
      '👍 Хорошая конкретика!',
      '🎯 Точно схвачен момент!',
      '💎 Ценное наблюдение!',
      '🔬 Научная точность!',
      '🎪 Чистый опыт без примесей!',
      '🌟 Херлберт бы гордился!'
    ],
    
    corrections: {
      tooGeneric: '🔍 Попробуйте описать более конкретно. Что ИМЕННО происходило?',
      theoretical: '💡 Опишите не то, что вы думаете, а что БЫЛО в тот момент',
      retrospective: '⏰ Вернитесь к МОМЕНТУ сигнала. Что было именно тогда?',
      future: '🎯 Фокус на моменте! Не на планах, а на том, что БЫЛО',
      tooLong: '✂️ Слишком много деталей. Что было ГЛАВНЫМ в тот момент?',
      abstract: '🌱 Слишком абстрактно. Опишите конкретный опыт'
    }
  },

  // Научные факты для мотивации
  scientificFacts: [
    {
      fact: "Только 3% моментов чтения включают внутренний голос",
      source: "Hurlburt & Heavey, 2018"
    },
    {
      fact: "75% людей неверно оценивают частоту своих эмоций",
      source: "Hurlburt et al., 2013"
    },
    {
      fact: "Несимволизированное мышление реально существует у 22% людей",
      source: "Heavey & Hurlburt, 2008"
    },
    {
      fact: "После 3 дней тренировки точность самоотчётов возрастает на 400%",
      source: "Hurlburt, 2011"
    },
    {
      fact: "Люди с депрессией имеют уникальные паттерны внутреннего опыта",
      source: "Hurlburt & Akhter, 2006"
    }
  ],

  // Настройки экспорта данных
  export: {
    formats: ['json', 'csv', 'spss'],
    includeMetadata: true,
    anonymize: true,
    
    // Поля для исследовательского экспорта
    researchFields: [
      'timestamp',
      'momentDescription',
      'challenge',
      'skill',
      'flowState',
      'mood',
      'energy', 
      'stress',
      'dataQuality',
      'phenomenaDetected',
      'validationAttempts',
      'responseTime'
    ]
  },

  // Интеграция с ИИ
  ai: {
    enableSmartValidation: true,
    enablePatternDetection: true,
    enablePersonalizedFeedback: true,
    
    // Минимальное количество данных для обучения персональной модели
    minDataForPersonalization: 50,
    
    // Параметры для ML
    ml: {
      qualityPredictionThreshold: 0.8,
      patternDetectionConfidence: 0.7,
      personalInsightsMinData: 100
    }
  }
};