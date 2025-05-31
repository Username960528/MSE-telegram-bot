const aiValidator = require('./ai-validator-service');
const weaknessAnalyzer = require('./weakness-analyzer');
const config = require('../config/hurlburt');

/**
 * Генератор персонализированных упражнений для ESM обучения
 * 
 * Создает целевые упражнения на основе:
 * - Индивидуальных слабостей пользователя
 * - Контекста его активности  
 * - Прогресса обучения
 * - Предпочтений к обучению
 */
class PersonalizedExerciseGenerator {
  constructor() {
    this.aiService = aiValidator;
    this.weaknessAnalyzer = weaknessAnalyzer;
    
    // Библиотека базовых упражнений по типам слабостей
    this.exerciseLibrary = {
      'moment_capture': {
        beginner: [
          {
            title: "Фотовспышка сознания",
            description: "Представьте сигнал как фотовспышку. Что застыло в кадре вашего сознания в тот момент?",
            duration: "2 минуты",
            target: "Точный захват момента",
            difficulty: 1,
            successCriteria: "Описание без слов 'был', 'была', 'делал'"
          },
          {
            title: "Стоп-кадр техника",
            description: "При сигнале мысленно крикните 'СТОП!' и заморозьте момент. Что в этом застывшем кадре?",
            duration: "1 минута",
            target: "Временная точность",
            difficulty: 1,
            successCriteria: "Использование настоящего времени"
          }
        ],
        intermediate: [
          {
            title: "Микромомент анализ",
            description: "Разбейте момент сигнала на 3 микросекунды: до, во время, после. Опишите только 'во время'.",
            duration: "3 минуты", 
            target: "Временная прецизионность",
            difficulty: 2,
            successCriteria: "Отсутствие последовательных описаний"
          },
          {
            title: "Сенсорный якорь",
            description: "Найдите одно конкретное ощущение в момент сигнала. Используйте его как якорь для описания всего опыта.",
            duration: "2 минуты",
            target: "Заземление в моменте",
            difficulty: 2,
            successCriteria: "Конкретные сенсорные детали"
          }
        ],
        advanced: [
          {
            title: "Многослойный момент",
            description: "Опишите 3 слоя момента: телесные ощущения, сенсорная информация, ментальная активность.",
            duration: "4 минуты",
            target: "Глубина момента",
            difficulty: 3,
            successCriteria: "Различение слоев опыта"
          }
        ]
      },
      
      'illusion_detection': {
        beginner: [
          {
            title: "Тест внутреннего голоса",
            description: "При чтении: остановитесь и проверьте - действительно ли вы 'слышите' слова или просто понимаете?",
            duration: "3 минуты",
            target: "Различение понимания и внутренней речи",
            difficulty: 1,
            successCriteria: "Честное признание отсутствия голоса"
          },
          {
            title: "Эмоция vs ощущение",
            description: "Вместо 'я злюсь' опишите: что происходит в груди? В животе? В плечах?",
            duration: "2 минуты",
            target: "Соматические проявления",
            difficulty: 1,
            successCriteria: "Телесные описания вместо ярлыков"
          }
        ],
        intermediate: [
          {
            title: "Детектор реконструкции",
            description: "После ответа спросите себя: 'Это было ТОГДА или я это додумал СЕЙЧАС?'",
            duration: "2 минуты",
            target: "Различение опыта и реконструкции",
            difficulty: 2,
            successCriteria: "Выявление додуманных деталей"
          },
          {
            title: "Проверка каузальности",
            description: "Уберите из ответа все 'потому что', 'поэтому', 'из-за'. Что останется?",
            duration: "3 минуты",
            target: "Чистое описание без объяснений",
            difficulty: 2,
            successCriteria: "Описание без каузальных связей"
          }
        ]
      },

      'specificity': {
        beginner: [
          {
            title: "Конкретизатор",
            description: "Замените каждое общее слово конкретным: 'работал' → 'печатал email Марии о проекте X'",
            duration: "3 минуты",
            target: "Детализация активности",
            difficulty: 1,
            successCriteria: "Отсутствие общих терминов"
          },
          {
            title: "5W техника",
            description: "Ответьте на 5 вопросов: Кто? Что? Где? Когда? Каким образом?",
            duration: "2 минуты",
            target: "Структурированная специфичность",
            difficulty: 1,
            successCriteria: "Ответы на все 5 вопросов"
          }
        ],
        intermediate: [
          {
            title: "Сенсорная детализация",
            description: "Опишите через 3 канала: что видели (цвет, форма), слышали (звук, тон), чувствовали (текстура, температура)",
            duration: "4 минуты",
            target: "Мультисенсорные детали",
            difficulty: 2,
            successCriteria: "Минимум 3 сенсорных канала"
          }
        ]
      },

      'avoidance': {
        beginner: [
          {
            title: "Любопытный исследователь",
            description: "Вместо 'ничего' станьте детективом: Что ЕСТЬ в сознании? Даже тишина - это что-то.",
            duration: "2 минуты",
            target: "Преодоление избегания",
            difficulty: 1,
            successCriteria: "Конкретное описание вместо 'ничего'"
          },
          {
            title: "Микронаблюдение",
            description: "Найдите ОДНУ крошечную деталь опыта: дыхание, звук, ощущение в пальцах.",
            duration: "1 минута",
            target: "Минимальное зацепление",
            difficulty: 1,
            successCriteria: "Хотя бы одна конкретная деталь"
          }
        ]
      }
    };

    // Контекстные модификаторы упражнений
    this.contextModifiers = {
      'reading': {
        focus: "При чтении особенно важно различать понимание и внутренний голос",
        adaptations: [
          "Добавьте проверку: 'Слышу ли я слова или просто понимаю?'",
          "Обратите внимание на визуальные образы при чтении"
        ]
      },
      'work': {
        focus: "В рабочем контексте важна специфичность активности",
        adaptations: [
          "Уточните конкретную задачу, а не общее 'работаю'",
          "Опишите физические действия: что делают руки, глаза"
        ]
      },
      'emotion': {
        focus: "При эмоциях фокус на телесных проявлениях",
        adaptations: [
          "Замените эмоциональные ярлыки описанием ощущений в теле",
          "Найдите конкретную локализацию чувства"
        ]
      }
    };

    // Прогрессивные серии упражнений
    this.exerciseSeries = {
      'moment_mastery': {
        name: "Мастерство момента",
        description: "7-дневная серия для идеального захвата момента",
        exercises: [
          { day: 1, focus: "Базовый стоп-кадр" },
          { day: 2, focus: "Временная точность" },
          { day: 3, focus: "Сенсорное заземление" },
          { day: 4, focus: "Многослойный анализ" },
          { day: 5, focus: "Проверка достоверности" },
          { day: 6, focus: "Интеграция навыков" },
          { day: 7, focus: "Мастерское исполнение" }
        ]
      },
      'illusion_buster': {
        name: "Разрушитель иллюзий", 
        description: "5-дневная программа выявления и преодоления когнитивных иллюзий",
        exercises: [
          { day: 1, focus: "Детекция внутреннего голоса" },
          { day: 2, focus: "Эмоции vs телесные ощущения" },
          { day: 3, focus: "Опыт vs интерпретация" },
          { day: 4, focus: "Настоящее vs реконструкция" },
          { day: 5, focus: "Интегрированная проверка" }
        ]
      }
    };
  }

  /**
   * Основная функция генерации персональных упражнений
   */
  async generatePersonalizedExercises(userId, weaknessProfile, context = {}) {
    try {
      console.log(`🎯 Generating personalized exercises for user ${userId}`);
      
      // Определяем приоритетные области для упражнений
      const targetAreas = this.identifyTargetAreas(weaknessProfile);
      
      // Определяем уровень сложности для пользователя
      const difficultyLevel = this.assessUserLevel(weaknessProfile, context);
      
      // Генерируем упражнения для каждой области
      const coreExercises = await this.generateCoreExercises(targetAreas, difficultyLevel);
      
      // Добавляем контекстные адаптации
      const contextualExercises = this.addContextualAdaptations(coreExercises, context);
      
      // Генерируем ИИ-усиленные упражнения если доступно
      let aiEnhancedExercises = null;
      if (this.aiService.isConfigured && context.enableAI !== false) {
        aiEnhancedExercises = await this.generateAIEnhancedExercises(
          weaknessProfile, 
          contextualExercises, 
          context
        );
      }
      
      // Создаем прогрессивный план
      const progressivePlan = this.createProgressivePlan(
        contextualExercises, 
        aiEnhancedExercises, 
        weaknessProfile
      );
      
      // Добавляем метрики успеха и адаптивности
      const finalExercises = this.addSuccessMetrics(progressivePlan, weaknessProfile);
      
      const result = {
        userId,
        generatedAt: new Date(),
        targetAreas,
        difficultyLevel,
        exercises: finalExercises,
        adaptiveElements: this.createAdaptiveElements(weaknessProfile),
        progressionPath: this.defineProgressionPath(targetAreas),
        estimatedDuration: this.calculateTotalDuration(finalExercises),
        successCriteria: this.defineOverallSuccessCriteria(targetAreas),
        metadata: {
          version: '1.0',
          aiEnhanced: !!aiEnhancedExercises,
          contextApplied: Object.keys(context).length > 0
        }
      };
      
      console.log(`✅ Generated ${finalExercises.length} personalized exercises`);
      return result;
      
    } catch (error) {
      console.error('Error generating personalized exercises:', error);
      return this.createFallbackExercises(userId, weaknessProfile);
    }
  }

  /**
   * Определение приоритетных областей для упражнений
   */
  identifyTargetAreas(weaknessProfile) {
    const primaryWeaknesses = weaknessProfile.primaryWeaknesses || [];
    const targetAreas = [];
    
    // Берем топ-3 слабости как основные области
    primaryWeaknesses.slice(0, 3).forEach(weakness => {
      targetAreas.push({
        type: weakness.type,
        severity: weakness.severity,
        priority: weakness.priority || 0.8,
        urgency: weakness.riskLevel || 'medium'
      });
    });
    
    // Добавляем вторичные области если основных мало
    if (targetAreas.length < 2) {
      targetAreas.push({
        type: 'specificity',
        severity: 0.6,
        priority: 0.6,
        urgency: 'medium'
      });
    }
    
    return targetAreas;
  }

  /**
   * Оценка уровня пользователя для подбора сложности
   */
  assessUserLevel(weaknessProfile, context) {
    const avgSeverity = this.calculateAverageSeverity(weaknessProfile);
    const trainingDay = context.trainingDay || 1;
    const hasAIInsights = weaknessProfile.primaryWeaknesses?.some(w => w.aiInsights);
    
    // Начинающий уровень
    if (trainingDay <= 2 || avgSeverity > 0.8) {
      return 'beginner';
    }
    
    // Продвинутый уровень 
    if (trainingDay > 5 && avgSeverity < 0.4 && hasAIInsights) {
      return 'advanced';
    }
    
    // Промежуточный уровень
    return 'intermediate';
  }

  /**
   * Генерация основных упражнений
   */
  async generateCoreExercises(targetAreas, difficultyLevel) {
    const exercises = [];
    
    for (const area of targetAreas) {
      const areaExercises = this.exerciseLibrary[area.type];
      if (!areaExercises) continue;
      
      const levelExercises = areaExercises[difficultyLevel] || areaExercises.beginner;
      
      // Выбираем 1-2 упражнения для каждой области
      const selectedCount = area.urgency === 'high' ? 2 : 1;
      const selected = levelExercises.slice(0, selectedCount);
      
      selected.forEach(exercise => {
        exercises.push({
          ...exercise,
          targetArea: area.type,
          priority: area.priority,
          estimatedImpact: this.calculateEstimatedImpact(exercise, area),
          adaptiveNotes: this.generateAdaptiveNotes(exercise, area)
        });
      });
    }
    
    return exercises;
  }

  /**
   * Добавление контекстных адаптаций
   */
  addContextualAdaptations(exercises, context) {
    if (!context.detectedContext) return exercises;
    
    const modifier = this.contextModifiers[context.detectedContext];
    if (!modifier) return exercises;
    
    return exercises.map(exercise => ({
      ...exercise,
      contextualFocus: modifier.focus,
      contextualAdaptations: modifier.adaptations,
      description: this.adaptDescriptionToContext(exercise.description, modifier)
    }));
  }

  /**
   * ИИ-генерация усиленных упражнений
   */
  async generateAIEnhancedExercises(weaknessProfile, baseExercises, context) {
    if (!this.aiService.isConfigured) return null;

    const prompt = `Создай персонализированные упражнения ESM для этого пользователя:

ПРОФИЛЬ СЛАБОСТЕЙ:
${JSON.stringify(weaknessProfile.primaryWeaknesses, null, 2)}

БАЗОВЫЕ УПРАЖНЕНИЯ:
${JSON.stringify(baseExercises.slice(0, 3), null, 2)}

КОНТЕКСТ:
- День обучения: ${context.trainingDay || 1}
- Детектированный контекст: ${context.detectedContext || 'общий'}
- Предыдущие проблемы: ${weaknessProfile.riskFactors?.join(', ') || 'нет данных'}

ЗАДАЧА:
Создай 2-3 НОВЫХ упражнения, специально адаптированных под этого пользователя:

1. Учти его конкретные слабости и паттерны ошибок
2. Сделай упражнения практическими и выполнимыми  
3. Включи специфические техники преодоления его иллюзий
4. Добавь проверочные вопросы для самоконтроля

ПРИНЦИПЫ ХЕРЛБЕРТА:
- Фокус на МОМЕНТЕ сигнала, не периоде
- Различение опыта и мыслей об опыте
- Внутренний голос есть только в 3% чтения
- Тело не лжет - используй сенсорные детали
- Пустота тоже валидный опыт

Ответь в JSON:
{
  "customExercises": [
    {
      "title": "Название упражнения",
      "description": "Подробное описание (2-3 предложения)",
      "targetWeakness": "конкретная слабость",
      "technique": "специальная техника",
      "selfCheckQuestions": ["вопрос1", "вопрос2"],
      "duration": "время выполнения",
      "difficulty": 1-3,
      "expectedOutcome": "ожидаемый результат"
    }
  ],
  "adaptiveNotes": [
    "адаптация1 для этого пользователя",
    "адаптация2 для этого пользователя"
  ],
  "progressionTriggers": [
    "условие для перехода к следующему уровню"
  ]
}`;

    try {
      const result = await this.aiService.validate(prompt, { 
        isExerciseGeneration: true,
        userId: context.userId
      });
      
      return this.parseAIExerciseResult(result);
      
    } catch (error) {
      console.error('AI exercise generation failed:', error);
      return null;
    }
  }

  /**
   * Создание прогрессивного плана
   */
  createProgressivePlan(baseExercises, aiExercises, weaknessProfile) {
    const allExercises = [...baseExercises];
    
    // Добавляем ИИ-упражнения если есть
    if (aiExercises?.customExercises) {
      aiExercises.customExercises.forEach(exercise => {
        allExercises.push({
          ...exercise,
          isAIGenerated: true,
          priority: 0.9 // Высокий приоритет для персональных упражнений
        });
      });
    }
    
    // Сортируем по приоритету и создаем прогрессию
    const sortedExercises = allExercises.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Группируем по дням/сессиям
    const dailyPlan = this.groupExercisesByDay(sortedExercises, weaknessProfile);
    
    return dailyPlan;
  }

  /**
   * Группировка упражнений по дням
   */
  groupExercisesByDay(exercises, weaknessProfile) {
    const daysCount = this.calculateOptimalDays(weaknessProfile);
    const dailyPlan = [];
    
    for (let day = 1; day <= daysCount; day++) {
      const dayExercises = this.selectExercisesForDay(exercises, day, daysCount);
      
      dailyPlan.push({
        day,
        focus: this.getDayFocus(day, daysCount, weaknessProfile),
        exercises: dayExercises,
        estimatedTime: this.calculateDayTime(dayExercises),
        goals: this.defineDayGoals(day, dayExercises)
      });
    }
    
    return dailyPlan;
  }

  /**
   * Добавление метрик успеха
   */
  addSuccessMetrics(exercisePlan, weaknessProfile) {
    return exercisePlan.map(day => ({
      ...day,
      exercises: day.exercises.map(exercise => ({
        ...exercise,
        successMetrics: this.defineExerciseMetrics(exercise),
        adaptiveTriggers: this.defineAdaptiveTriggers(exercise),
        fallbackStrategy: this.defineFallbackStrategy(exercise)
      }))
    }));
  }

  /**
   * Создание адаптивных элементов
   */
  createAdaptiveElements(weaknessProfile) {
    return {
      difficultyAdjustment: {
        trigger: 'success_rate < 0.6',
        action: 'reduce_difficulty',
        description: 'Упростить упражнения при низком успехе'
      },
      focusShift: {
        trigger: 'plateau_detected',
        action: 'shift_focus_area', 
        description: 'Сменить фокус при достижении плато'
      },
      intensification: {
        trigger: 'rapid_progress',
        action: 'add_advanced_exercises',
        description: 'Добавить сложные упражнения при быстром прогрессе'
      },
      personalization: {
        trigger: 'specific_error_pattern',
        action: 'generate_targeted_exercise',
        description: 'Создать упражнение для конкретной ошибки'
      }
    };
  }

  /**
   * Вспомогательные методы
   */
  
  calculateAverageSeverity(weaknessProfile) {
    const severities = weaknessProfile.primaryWeaknesses?.map(w => w.severity) || [0.5];
    return severities.reduce((a, b) => a + b, 0) / severities.length;
  }

  calculateEstimatedImpact(exercise, area) {
    return area.severity * exercise.difficulty * 0.3; // Примерная формула
  }

  generateAdaptiveNotes(exercise, area) {
    return [
      `Фокус на ${area.type}`,
      `Уровень важности: ${area.urgency}`,
      `Ожидаемое улучшение: ${Math.round(area.severity * 100)}% → ${Math.round((area.severity * 0.7) * 100)}%`
    ];
  }

  adaptDescriptionToContext(description, modifier) {
    return `${description}\n\n💡 ${modifier.focus}`;
  }

  calculateOptimalDays(weaknessProfile) {
    const avgSeverity = this.calculateAverageSeverity(weaknessProfile);
    const riskFactorsCount = weaknessProfile.riskFactors?.length || 0;
    
    if (avgSeverity > 0.8 || riskFactorsCount > 2) return 5;
    if (avgSeverity > 0.6 || riskFactorsCount > 1) return 4;
    return 3;
  }

  selectExercisesForDay(exercises, day, totalDays) {
    const exercisesPerDay = Math.max(1, Math.floor(exercises.length / totalDays));
    const startIndex = (day - 1) * exercisesPerDay;
    const endIndex = day === totalDays ? exercises.length : startIndex + exercisesPerDay;
    
    return exercises.slice(startIndex, endIndex);
  }

  getDayFocus(day, totalDays, weaknessProfile) {
    const focuses = ['Захват момента', 'Специфичность', 'Детекция иллюзий', 'Консистентность', 'Интеграция'];
    return focuses[Math.min(day - 1, focuses.length - 1)];
  }

  calculateDayTime(dayExercises) {
    const durations = dayExercises.map(e => this.parseDuration(e.duration));
    return durations.reduce((a, b) => a + b, 0);
  }

  parseDuration(durationStr) {
    if (!durationStr) return 3;
    const minutes = durationStr.match(/(\d+)/);
    return minutes ? parseInt(minutes[1]) : 3;
  }

  defineDayGoals(day, exercises) {
    return exercises.map(e => e.target).filter((v, i, a) => a.indexOf(v) === i);
  }

  defineExerciseMetrics(exercise) {
    return {
      completionCriteria: exercise.successCriteria || 'Выполнение всех шагов',
      qualityIndicators: ['Специфичность ответа', 'Временная точность', 'Сенсорные детали'],
      improvementTarget: `Улучшение на 20% в области: ${exercise.targetArea}`
    };
  }

  defineAdaptiveTriggers(exercise) {
    return {
      repeat: 'Если качество < 60%',
      advance: 'Если качество > 80% в 2 попытках',
      modify: 'Если повторяющиеся ошибки'
    };
  }

  defineFallbackStrategy(exercise) {
    return {
      simplify: 'Упростить до базового уровня',
      support: 'Добавить примеры и подсказки',
      alternative: 'Предложить альтернативное упражнение'
    };
  }

  defineProgressionPath(targetAreas) {
    return targetAreas.map((area, index) => ({
      stage: index + 1,
      focus: area.type,
      milestone: `Улучшение ${area.type} до приемлемого уровня`,
      estimatedTime: `${Math.ceil(area.severity * 7)} дней`
    }));
  }

  calculateTotalDuration(exercisePlan) {
    const totalMinutes = exercisePlan.reduce((sum, day) => {
      return sum + this.calculateDayTime(day.exercises);
    }, 0);
    
    return {
      totalMinutes,
      totalDays: exercisePlan.length,
      averagePerDay: Math.round(totalMinutes / exercisePlan.length)
    };
  }

  defineOverallSuccessCriteria(targetAreas) {
    return targetAreas.map(area => ({
      area: area.type,
      criteria: `Снижение серьезности с ${Math.round(area.severity * 100)}% до <30%`,
      measurement: 'Оценка качества ответов ESM'
    }));
  }

  parseAIExerciseResult(result) {
    try {
      const fallback = {
        customExercises: [],
        adaptiveNotes: [],
        progressionTriggers: []
      };

      if (result && typeof result === 'object') {
        return {
          customExercises: result.customExercises || [],
          adaptiveNotes: result.adaptiveNotes || [],
          progressionTriggers: result.progressionTriggers || []
        };
      }
      
      return fallback;
    } catch (error) {
      console.error('Error parsing AI exercise result:', error);
      return {
        customExercises: [],
        adaptiveNotes: [],
        progressionTriggers: []
      };
    }
  }

  createFallbackExercises(userId, weaknessProfile) {
    const basicExercises = [{
      day: 1,
      focus: 'Базовая тренировка',
      exercises: [{
        title: "Упражнение на захват момента",
        description: "При сигнале опишите что происходило ИМЕННО в тот момент",
        target: "moment_capture",
        duration: "2 минуты",
        difficulty: 1,
        successMetrics: { completionCriteria: 'Описание без обобщений' }
      }],
      estimatedTime: 2
    }];

    return {
      userId,
      generatedAt: new Date(),
      exercises: basicExercises,
      adaptiveElements: {},
      progressionPath: [],
      estimatedDuration: { totalMinutes: 2, totalDays: 1 },
      metadata: { isFallback: true }
    };
  }
}

module.exports = new PersonalizedExerciseGenerator();