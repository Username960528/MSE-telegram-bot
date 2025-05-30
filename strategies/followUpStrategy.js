const config = require('../config/hurlburt');

/**
 * Стратегия динамических follow-up вопросов по методу Херлберта
 * 
 * Цель: разрушить иллюзии и добраться до истинного моментального опыта
 */
class FollowUpStrategy {
  constructor() {
    this.config = config;
    this.phenomena = config.phenomena;
    
    // База знаний follow-up вопросов
    this.followUpDatabase = {
      // Внутренняя речь
      innerSpeech: [
        {
          trigger: /говор|сказал|подумал|внутренний голос|проговар/i,
          questions: [
            {
              text: '🎧 Вы действительно "слышали" эти слова внутренним голосом или просто знали их смысл?',
              clarifies: 'inner_speech_illusion',
              priority: 'high'
            },
            {
              text: '🗣 Если был голос - опишите его. Мужской? Женский? Ваш? Чей-то другой?',
              clarifies: 'voice_characteristics',
              priority: 'medium'
            },
            {
              text: '📍 Где именно вы "слышали" этот голос? В голове? В ушах? В груди?',
              clarifies: 'voice_location',
              priority: 'low'
            }
          ]
        },
        {
          trigger: /думаю|размышля|обдумыва|соображ/i,
          questions: [
            {
              text: '💭 Это была мысль в словах или просто понимание/знание без слов?',
              clarifies: 'unsymbolized_thinking',
              priority: 'high'
            }
          ]
        }
      ],
      
      // Эмоции
      emotion: [
        {
          trigger: /радост|счаст|весел|довол/i,
          questions: [
            {
              text: '😊 Эта радость - это мысль "я рад" или физическое ощущение? Если ощущение - где в теле?',
              clarifies: 'emotion_vs_thought',
              priority: 'high'
            },
            {
              text: '✨ Что конкретно вы чувствовали? Тепло? Лёгкость? Расширение в груди?',
              clarifies: 'emotion_sensory',
              priority: 'medium'
            }
          ]
        },
        {
          trigger: /груст|печал|тоск|подавлен/i,
          questions: [
            {
              text: '😢 Грусть была мыслью или физическим ощущением? Опишите точнее',
              clarifies: 'emotion_vs_thought',
              priority: 'high'
            },
            {
              text: '💔 Если физическое - где именно? Тяжесть в груди? Ком в горле? Что-то ещё?',
              clarifies: 'emotion_location',
              priority: 'medium'
            }
          ]
        },
        {
          trigger: /злост|раздраж|бес|гнев/i,
          questions: [
            {
              text: '😠 Злость - это было напряжение в теле или мысли о том, что злитесь?',
              clarifies: 'anger_physical',
              priority: 'high'
            }
          ]
        },
        {
          trigger: /тревог|беспокой|волну|страх/i,
          questions: [
            {
              text: '😰 Тревога - где она была? В животе? В груди? Или это были тревожные мысли?',
              clarifies: 'anxiety_location',
              priority: 'high'
            }
          ]
        }
      ],
      
      // Чтение
      reading: [
        {
          trigger: /чита/i,
          questions: [
            {
              text: '📖 Когда читали, вы "слышали" слова, видели образы или сразу понимали смысл?',
              clarifies: 'reading_modality',
              priority: 'high'
            },
            {
              text: '👁 На какое конкретное слово смотрели в момент сигнала?',
              clarifies: 'reading_precision',
              priority: 'medium'
            }
          ]
        }
      ],
      
      // Планирование
      planning: [
        {
          trigger: /планиру|буду|собира|намерен|хочу сделать/i,
          questions: [
            {
              text: '📋 Это была мысль о будущем или вы что-то конкретно делали (писали план, визуализировали)?',
              clarifies: 'planning_vs_doing',
              priority: 'high'
            }
          ]
        }
      ],
      
      // Визуализация
      visualization: [
        {
          trigger: /вижу|представля|образ|картин|визуализ/i,
          questions: [
            {
              text: '🖼 Образ был чёткий как фотография или расплывчатый? Цветной или чёрно-белый?',
              clarifies: 'image_quality',
              priority: 'high'
            },
            {
              text: '📐 Где был этот образ? Перед глазами? В голове? Опишите "расположение"',
              clarifies: 'image_location',
              priority: 'medium'
            }
          ]
        }
      ],
      
      // Физические ощущения
      physical: [
        {
          trigger: /боль|ощуща|чувству|холод|тепл|напряж/i,
          questions: [
            {
              text: '🎯 Опишите это ощущение точнее. Острое? Тупое? Пульсирующее? Постоянное?',
              clarifies: 'sensation_quality',
              priority: 'high'
            },
            {
              text: '📍 Укажите точное место. Размер области (с монету? с ладонь?)',
              clarifies: 'sensation_precision',
              priority: 'medium'
            }
          ]
        }
      ],
      
      // Внимание
      attention: [
        {
          trigger: /смотр|слуша|внима|фокус|концентр/i,
          questions: [
            {
              text: '👁 На что ИМЕННО было направлено внимание? Один объект или несколько?',
              clarifies: 'attention_focus',
              priority: 'high'
            }
          ]
        }
      ],
      
      // Воспоминания
      memory: [
        {
          trigger: /вспомн|помн|прошл/i,
          questions: [
            {
              text: '⏰ Стоп! Вы вспоминали что-то В МОМЕНТ сигнала или вспоминаете сейчас?',
              clarifies: 'memory_timing',
              priority: 'high'
            },
            {
              text: '🎬 Если вспоминали - это был образ, слова или просто знание о прошлом?',
              clarifies: 'memory_modality',
              priority: 'medium'
            }
          ]
        }
      ]
    };
    
    // История заданных вопросов для избежания повторов
    this.askedQuestions = new Map();
  }

  /**
   * Получить следующий follow-up вопрос
   * @param {Object} context - Контекст диалога
   * @returns {Object|null} - Вопрос или null
   */
  getNextQuestion(context) {
    const { responses, currentQuestion, userId, trainingDay } = context;
    
    // Получаем последний текстовый ответ
    const lastTextResponse = this.getLastTextResponse(responses);
    if (!lastTextResponse) return null;
    
    // Ищем подходящие вопросы
    const candidates = this.findCandidateQuestions(lastTextResponse.text, trainingDay);
    
    // Фильтруем уже заданные
    const unseenCandidates = this.filterUnseenQuestions(candidates, userId);
    
    // Выбираем лучший вопрос
    const selectedQuestion = this.selectBestQuestion(unseenCandidates, context);
    
    if (selectedQuestion) {
      this.markAsAsked(selectedQuestion, userId);
    }
    
    return selectedQuestion;
  }

  /**
   * Найти последний текстовый ответ
   */
  getLastTextResponse(responses) {
    const textFields = ['moment_capture', 'currentActivity', 'currentThoughts'];
    
    for (const field of textFields) {
      if (responses[field] && typeof responses[field] === 'string') {
        return {
          field,
          text: responses[field]
        };
      }
    }
    
    return null;
  }

  /**
   * Найти подходящие вопросы
   */
  findCandidateQuestions(text, trainingDay) {
    const candidates = [];
    
    // Проходим по всем категориям
    for (const [category, patterns] of Object.entries(this.followUpDatabase)) {
      for (const pattern of patterns) {
        if (pattern.trigger.test(text)) {
          // Добавляем все вопросы из этого паттерна
          pattern.questions.forEach(q => {
            candidates.push({
              ...q,
              category,
              matchStrength: this.calculateMatchStrength(text, pattern.trigger),
              trainingDayRelevance: this.calculateTrainingRelevance(q, trainingDay)
            });
          });
        }
      }
    }
    
    return candidates;
  }

  /**
   * Рассчитать силу совпадения
   */
  calculateMatchStrength(text, regex) {
    const matches = text.match(regex);
    if (!matches) return 0;
    
    // Чем больше совпадений, тем сильнее
    return matches.length;
  }

  /**
   * Рассчитать релевантность для дня обучения
   */
  calculateTrainingRelevance(question, trainingDay) {
    // В первые дни задаём более простые вопросы
    if (trainingDay === 1) {
      return question.priority === 'high' ? 1 : 0.5;
    } else if (trainingDay === 2) {
      return question.priority === 'medium' ? 1 : 0.7;
    } else {
      return 1; // После обучения все вопросы релевантны
    }
  }

  /**
   * Отфильтровать уже заданные вопросы
   */
  filterUnseenQuestions(candidates, userId) {
    const userQuestions = this.askedQuestions.get(userId) || new Set();
    
    return candidates.filter(q => {
      const questionId = `${q.category}_${q.clarifies}`;
      return !userQuestions.has(questionId);
    });
  }

  /**
   * Выбрать лучший вопрос
   */
  selectBestQuestion(candidates, context) {
    if (candidates.length === 0) return null;
    
    // Сортируем по приоритету
    candidates.sort((a, b) => {
      // Сначала по приоритету
      const priorityScore = {
        high: 3,
        medium: 2,
        low: 1
      };
      
      const scoreA = priorityScore[a.priority] * a.trainingDayRelevance * a.matchStrength;
      const scoreB = priorityScore[b.priority] * b.trainingDayRelevance * b.matchStrength;
      
      return scoreB - scoreA;
    });
    
    // Добавляем вариативность - иногда выбираем не самый приоритетный
    const randomFactor = Math.random();
    if (randomFactor < 0.8) {
      return candidates[0]; // 80% времени выбираем лучший
    } else if (candidates.length > 1) {
      return candidates[1]; // 20% времени второй по приоритету
    }
    
    return candidates[0];
  }

  /**
   * Отметить вопрос как заданный
   */
  markAsAsked(question, userId) {
    if (!this.askedQuestions.has(userId)) {
      this.askedQuestions.set(userId, new Set());
    }
    
    const questionId = `${question.category}_${question.clarifies}`;
    this.askedQuestions.get(userId).add(questionId);
  }

  /**
   * Анализ ответа на follow-up вопрос
   */
  analyzeFollowUpResponse(response, question, context) {
    const analysis = {
      insightGained: false,
      phenomenaDetected: [],
      illusionBroken: false,
      recommendations: []
    };
    
    // Анализируем в зависимости от типа уточнения
    switch (question.clarifies) {
      case 'inner_speech_illusion':
        if (response.toLowerCase().includes('знал') || response.toLowerCase().includes('понимал')) {
          analysis.illusionBroken = true;
          analysis.phenomenaDetected.push('unsymbolized_thinking');
          analysis.recommendations.push('Отлично! Вы различили мысль от внутренней речи');
        }
        break;
        
      case 'emotion_vs_thought':
        if (response.match(/тел|физ|ощущ|груд|живот|горл/i)) {
          analysis.insightGained = true;
          analysis.phenomenaDetected.push('embodied_emotion');
        }
        break;
        
      case 'reading_modality':
        if (response.toLowerCase().includes('понимал') || response.toLowerCase().includes('знал')) {
          analysis.illusionBroken = true;
          analysis.recommendations.push('Да! Большинство чтения происходит без внутреннего голоса');
        }
        break;
    }
    
    return analysis;
  }

  /**
   * Получить персонализированные инсайты
   */
  getPersonalizedInsights(userId, allResponses) {
    const insights = [];
    
    // Анализируем паттерны пользователя
    const innerSpeechCount = allResponses.filter(r => 
      r.metadata?.phenomena?.includes('innerSpeech')
    ).length;
    
    const totalCount = allResponses.length;
    
    if (innerSpeechCount / totalCount > 0.5) {
      insights.push({
        type: 'pattern',
        message: '🎯 Вы часто сообщаете о внутренней речи. Попробуйте обратить внимание - это действительно "голос" или просто знание?',
        confidence: 0.8
      });
    }
    
    // Добавляем другие инсайты на основе паттернов
    
    return insights;
  }

  /**
   * Сброс истории для пользователя (например, после завершения обучения)
   */
  resetUserHistory(userId) {
    this.askedQuestions.delete(userId);
  }
}

module.exports = FollowUpStrategy;