const config = require('../config/hurlburt');
const aiValidator = require('../services/ai-validator-service');

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
   * @returns {Promise<Object|null>} - Вопрос или null
   */
  async getNextQuestion(context) {
    const { responses, currentQuestion, userId, trainingDay } = context;
    
    // Получаем последний текстовый ответ
    const lastTextResponse = this.getLastTextResponse(responses);
    if (!lastTextResponse) return null;
    
    // Ищем подходящие вопросы
    const candidates = this.findCandidateQuestions(lastTextResponse.text, trainingDay);
    
    // Фильтруем уже заданные (теперь асинхронно)
    const unseenCandidates = await this.filterUnseenQuestions(candidates, userId, context);
    
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
   * Отфильтровать уже заданные вопросы (гибридный подход: статические правила + ИИ)
   */
  async filterUnseenQuestions(candidates, userId, context) {
    const userQuestions = this.askedQuestions.get(userId) || new Set();
    const questionMapping = this.getQuestionSemanticMapping();
    
    // Этап 1: Быстрая фильтрация статическими правилами
    const staticFiltered = candidates.filter(q => {
      const questionId = `${q.category}_${q.clarifies}`;
      
      // Проверяем, не задавался ли уже этот вопрос
      if (userQuestions.has(questionId)) {
        return false;
      }
      
      // Статическая проверка семантических концепций
      if (context && context.responses) {
        const semanticConcept = questionMapping[q.clarifies];
        
        if (semanticConcept) {
          // Проверяем, была ли уже раскрыта эта семантическая концепция
          if (this.hasConceptMentioned(semanticConcept, context.responses)) {
            return false;
          }
        }
      }
      
      return true;
    });

    // Если нет кандидатов после статической фильтрации, возвращаем пустой массив
    if (staticFiltered.length === 0) {
      return staticFiltered;
    }

    // Этап 2: ИИ-фильтрация для сложных случаев (асинхронно)
    if (config.ai && config.ai.enableSmartValidation && context && context.responses) {
      return await this.filterWithAI(staticFiltered, context);
    }

    return staticFiltered;
  }

  /**
   * Дополнительная фильтрация с помощью ИИ
   */
  async filterWithAI(candidates, context) {
    try {
      const aiFilteredCandidates = [];

      // Обрабатываем каждого кандидата через ИИ (но не более 3 для производительности)
      const candidatesToCheck = candidates.slice(0, 3);
      
      for (const candidate of candidatesToCheck) {
        try {
          const aiAnalysis = await aiValidator.analyzeSemanticSimilarity(
            candidate, 
            context.responses, 
            { userId: context.userId, trainingDay: context.trainingDay }
          );

          // Добавляем результат ИИ к кандидату для логирования
          candidate.aiAnalysis = aiAnalysis;

          // Если ИИ говорит, что нужно задать вопрос, добавляем его
          if (aiAnalysis.shouldAsk && aiAnalysis.confidence > 0.6) {
            aiFilteredCandidates.push(candidate);
          } else {
            console.log(`AI filtered out question: ${candidate.clarifies} (confidence: ${aiAnalysis.confidence}, reason: ${aiAnalysis.reason})`);
          }
        } catch (error) {
          console.warn(`AI analysis failed for question ${candidate.clarifies}:`, error.message);
          // При ошибке ИИ добавляем кандидата (fail-safe)
          aiFilteredCandidates.push(candidate);
        }
      }

      // Добавляем оставшихся кандидатов без ИИ-проверки для производительности
      if (candidates.length > 3) {
        aiFilteredCandidates.push(...candidates.slice(3));
      }

      return aiFilteredCandidates;
    } catch (error) {
      console.error('AI filtering failed, falling back to static filtering:', error);
      return candidates; // Fallback к статической фильтрации
    }
  }

  /**
   * Извлечь упомянутые части тела из текста
   */
  extractBodyParts(text) {
    const bodyParts = [
      'глаз', 'глазах', 'глазу', 'глаза',
      'голов', 'голове', 'голову', 'голова',
      'груд', 'груди', 'грудь', 'грудью',
      'живот', 'животе', 'живота',
      'рук', 'руке', 'руки', 'руку', 'рука',
      'ног', 'ноге', 'ноги', 'ногу', 'нога',
      'спин', 'спине', 'спина', 'спину',
      'шее', 'шея', 'шею',
      'горле', 'горло', 'горла',
      'плеч', 'плече', 'плечо', 'плеча',
      'лице', 'лицо', 'лица',
      'затылк', 'затылке', 'затылок',
      'лбу', 'лоб', 'лба'
    ];
    
    const foundParts = [];
    const lowerText = text.toLowerCase();
    
    for (const part of bodyParts) {
      if (lowerText.includes(part)) {
        foundParts.push(part);
      }
    }
    
    return foundParts;
  }

  /**
   * Проверить, была ли уже упомянута локация тела
   */
  hasBodyLocationMentioned(responses) {
    const allResponses = Object.values(responses).join(' ');
    const bodyParts = this.extractBodyParts(allResponses);
    return bodyParts.length > 0;
  }

  /**
   * Семантический анализатор для определения уже раскрытых концепций
   */
  getSemanticConcepts() {
    return {
      // Расположение (уже реализовано выше)
      location: {
        patterns: [
          /в\s+(глаз|голов|груд|живот|рук|ног|спин|шее|горле|плеч|лице|затылк|лбу)/i,
          /на\s+(лице|руке|ноге|спине)/i,
          /(слева|справа|сверху|снизу|внутри|снаружи)/i
        ],
        checker: (responses) => this.hasBodyLocationMentioned(responses)
      },
      
      // Качество ощущений
      quality: {
        patterns: [
          /(острое|тупое|пульсирующее|постоянное|ноющее|режущее|давящее|жгучее)/i,
          /(сильное|слабое|умеренное|интенсивное)/i,
          /(холодное|теплое|горячее|прохладное)/i
        ],
        checker: (responses) => this.hasQualityMentioned(responses)
      },
      
      // Модальность восприятия  
      modality: {
        patterns: [
          /(слышал|видел|чувствовал|ощущал|понимал|знал)/i,
          /(голос|звук|образ|картин|визуализ)/i,
          /(внутренний\s+голос|внутренняя\s+речь)/i
        ],
        checker: (responses) => this.hasModalityMentioned(responses)
      },
      
      // Временные характеристики
      timing: {
        patterns: [
          /(в\s+момент|именно\s+тогда|прямо\s+сейчас|в\s+тот\s+момент)/i,
          /(сначала|потом|после|до\s+того|одновременно)/i,
          /(мгновенно|постепенно|резко|медленно)/i
        ],
        checker: (responses) => this.hasTimingMentioned(responses)
      },
      
      // Эмоциональные vs физические проявления
      emotion_vs_physical: {
        patterns: [
          /(физическое|телесное|ощущение|чувство\s+в\s+теле)/i,
          /(мысль|эмоция|переживание|состояние)/i,
          /(отличить|различить|разделить)/i
        ],
        checker: (responses) => this.hasEmotionDistinctionMentioned(responses)
      },
      
      // Характеристики внимания/фокуса
      attention: {
        patterns: [
          /(сконцентрирован|сфокусирован|внимание\s+на)/i,
          /(один\s+объект|несколько\s+объектов|рассеянно)/i,
          /(четко|размыто|ясно|неясно)/i
        ],
        checker: (responses) => this.hasAttentionMentioned(responses)
      }
    };
  }

  /**
   * Проверка упоминания качества ощущений
   */
  hasQualityMentioned(responses) {
    const allText = Object.values(responses).join(' ').toLowerCase();
    const qualityWords = [
      'острое', 'острая', 'острый', 'остро',
      'тупое', 'тупая', 'тупой', 'тупо',
      'пульсирующее', 'пульсирующая', 'пульсирующий', 'пульсирует',
      'постоянное', 'постоянная', 'постоянный', 'постоянно',
      'ноющее', 'ноющая', 'ноющий', 'ноет',
      'режущее', 'режущая', 'режущий', 'режет',
      'давящее', 'давящая', 'давящий', 'давит',
      'жгучее', 'жгучая', 'жгучий', 'жжет',
      'сильное', 'сильная', 'сильный', 'сильно',
      'слабое', 'слабая', 'слабый', 'слабо',
      'умеренное', 'умеренная', 'умеренный', 'умеренно',
      'интенсивное', 'интенсивная', 'интенсивный', 'интенсивно',
      'холодное', 'холодная', 'холодный', 'холодно',
      'теплое', 'теплая', 'теплый', 'тепло',
      'горячее', 'горячая', 'горячий', 'горячо',
      'прохладное', 'прохладная', 'прохладный', 'прохладно'
    ];
    return qualityWords.some(word => allText.includes(word));
  }

  /**
   * Проверка упоминания модальности
   */
  hasModalityMentioned(responses) {
    const allText = Object.values(responses).join(' ').toLowerCase();
    const modalityWords = ['слышал', 'видел', 'чувствовал', 'ощущал', 'понимал', 'знал', 'голос', 'звук', 'образ', 'картин', 'визуализ'];
    return modalityWords.some(word => allText.includes(word));
  }

  /**
   * Проверка упоминания временных характеристик
   */
  hasTimingMentioned(responses) {
    const allText = Object.values(responses).join(' ').toLowerCase();
    const timingWords = ['в момент', 'именно тогда', 'прямо сейчас', 'в тот момент', 'сначала', 'потом', 'после', 'до того', 'одновременно', 'мгновенно', 'постепенно', 'резко', 'медленно'];
    return timingWords.some(phrase => allText.includes(phrase));
  }

  /**
   * Проверка различения эмоций и физических проявлений
   */
  hasEmotionDistinctionMentioned(responses) {
    const allText = Object.values(responses).join(' ').toLowerCase();
    const distinctionWords = ['физическое', 'телесное', 'ощущение', 'мысль', 'эмоция', 'переживание', 'отличить', 'различить', 'разделить'];
    return distinctionWords.some(word => allText.includes(word));
  }

  /**
   * Проверка упоминания характеристик внимания
   */
  hasAttentionMentioned(responses) {
    const allText = Object.values(responses).join(' ').toLowerCase();
    const attentionWords = ['сконцентрирован', 'сфокусирован', 'внимание на', 'один объект', 'несколько объектов', 'рассеянно', 'четко', 'размыто', 'ясно', 'неясно'];
    return attentionWords.some(phrase => allText.includes(phrase));
  }

  /**
   * Проверить, была ли уже раскрыта определенная концепция
   */
  hasConceptMentioned(conceptName, responses) {
    const concepts = this.getSemanticConcepts();
    const concept = concepts[conceptName];
    
    if (!concept || !concept.checker) {
      return false;
    }
    
    return concept.checker(responses);
  }

  /**
   * Получить маппинг типов вопросов к семантическим концепциям
   */
  getQuestionSemanticMapping() {
    return {
      // Вопросы о расположении
      'sensation_precision': 'location',
      'emotion_location': 'location', 
      'voice_location': 'location',
      'image_location': 'location',
      'anxiety_location': 'location',
      
      // Вопросы о качестве ощущений
      'sensation_quality': 'quality',
      'emotion_sensory': 'quality',
      
      // Вопросы о модальности восприятия
      'reading_modality': 'modality',
      'inner_speech_illusion': 'modality',
      'unsymbolized_thinking': 'modality',
      'voice_characteristics': 'modality',
      'memory_modality': 'modality',
      'image_quality': 'modality',
      
      // Вопросы о времени
      'memory_timing': 'timing',
      'reading_precision': 'timing',
      
      // Вопросы о различении эмоций и физических проявлений
      'emotion_vs_thought': 'emotion_vs_physical',
      'anger_physical': 'emotion_vs_physical',
      
      // Вопросы о внимании
      'attention_focus': 'attention',
      
      // Вопросы о планировании (не блокируем, так как могут быть разные аспекты)
      'planning_vs_doing': null
    };
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