const User = require('../models/User');
const Response = require('../models/Response');
const config = require('../config/hurlburt');
const MomentValidator = require('../validators/momentValidator');
const goldenStandard = require('../validators/goldenStandard');
const aiValidator = require('../services/ai-validator-service');
const FollowUpStrategy = require('../strategies/followUpStrategy');
const PatternFeedback = require('../helpers/patternFeedback');
const GamificationService = require('../services/gamification-service');
const { recordUserResponse, recordTrainingCompletion, recordTrainingDropout, recordIllusionDetected } = require('../utils/metrics');
const addressForms = require('../utils/addressForms');

const surveyStates = new Map();
const validator = new MomentValidator();
const momentValidator = new MomentValidator();
const followUpStrategy = new FollowUpStrategy();
const patternFeedback = new PatternFeedback();

// Получаем параметры из конфига
const TRAINING_DAYS = config.training.DAYS;

// Обучающие сообщения в стиле Херлберта
const trainingMessages = [
  {
    day: 1,
    message: `🎓 День 1: Учимся ловить момент

Представьте, что сигнал - это фотовспышка, которая освещает ваше сознание на долю секунды.

Что вы увидели в этой вспышке? Не что было до или после, а что ПРЯМО В ТОТ МОМЕНТ.

❌ Неверно: "Я работал и чувствовал усталость"
✅ Верно: "Смотрел на слово 'deadline' в письме и почувствовал сжатие в груди"`
  },
  {
    day: 2,
    message: `🎓 День 2: Различаем опыт и теории о нём

Вчера многие описывали то, что ДУМАЮТ о своём опыте. Сегодня попробуем поймать САМ опыт.

Пример из исследований чтения:
❌ "Я читал, проговаривая слова внутренним голосом"
✅ "Видел образ красного яблока, когда глаза были на слове 'яблоко'"

Помните: 97% времени при чтении НЕТ внутреннего голоса!`
  },
  {
    day: 3,
    message: `🎓 День 3: Последний день обучения

Вы уже лучше различаете момент от обобщений. Сегодня обратите внимание:

🎯 Опыт часто проще, чем мы думаем
🎯 Может быть "ничего" - и это нормально
🎯 Доверяйте первому впечатлению, не додумывайте

После сегодня ваши данные станут по-настоящему ценными!`
  }
];

// Используем паттерны из конфигурации

// Расширенные вопросы с учетом принципов Херлберта
const questions = [
  {
    id: 'moment_capture',
    text: '🎯 СТОП! Что происходило в твоём сознании ИМЕННО в момент сигнала?\n\n' +
          'Опиши не общее состояние дня, а что было ПРЯМО В ТОТ МОМЕНТ.',
    type: 'text',
    validation: 'pristine',
    priority: true
  },
  {
    id: 'challenge',
    text: '📈 В ТОТ МОМЕНТ задача была:',
    type: 'scale',
    scale: { min: 0, max: 9, minLabel: 'Очень легкой', maxLabel: 'Очень сложной' }
  },
  {
    id: 'skill',
    text: '🛠 В ТОТ МОМЕНТ твои навыки были:',
    type: 'scale',
    scale: { min: 0, max: 9, minLabel: 'Недостаточными', maxLabel: 'Более чем достаточными' }
  },
  {
    id: 'concentration',
    text: '🎯 Насколько ты был сконцентрирован В ТОТ МОМЕНТ?',
    type: 'scale',
    scale: { min: 0, max: 9, minLabel: 'Совсем не сконцентрирован', maxLabel: 'Полностью сконцентрирован' }
  },
  {
    id: 'mood',
    text: '🌈 Какое было твоё состояние В МОМЕНТ сигнала?',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Очень плохое', maxLabel: 'Отличное' }
  },
  {
    id: 'energy',
    text: '⚡ Уровень энергии В ТОТ МОМЕНТ:',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Истощён', maxLabel: 'Полон сил' }
  },
  {
    id: 'stress',
    text: '😰 Уровень стресса В ТОТ МОМЕНТ:',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Расслаблен', maxLabel: 'Очень напряжён' }
  },
  {
    id: 'currentActivity',
    text: '📝 Что КОНКРЕТНО ты делал? (не "работал", а "печатал email Ивану о проекте X")',
    type: 'text',
    validation: 'specific'
  },
  {
    id: 'currentCompanion',
    text: '👥 С кем ты был В ТОТ МОМЕНТ? (или "один")',
    type: 'text'
  }
];

// Follow-up вопросы будут генерироваться динамически через FollowUpStrategy

// Валидация через новый валидатор
function validateResponse(response, type, context = {}) {
  return validator.validate(response, type, context);
}

// Определение дня обучения пользователя
async function getUserTrainingDay(user) {
  // Получаем количество уникальных дней, когда были ответы
  const responses = await Response.find({ userId: user._id })
    .sort({ timestamp: 1 })
    .select('timestamp');

  if (responses.length === 0) return 1;

  const uniqueDays = new Set();
  responses.forEach(r => {
    const date = new Date(r.timestamp);
    uniqueDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
  });

  return Math.min(uniqueDays.size + 1, 4); // Максимум 4 (после 3 дней обучения)
}

// Расчёт качества данных через валидатор
function calculateDataQuality(responses) {
  return validator.calculateOverallQuality(responses);
}

// Модифицированная функция начала опроса
async function startSurvey(bot, chatId, telegramId, notificationId = null) {
  try {
    let user = await User.findOne({ telegramId });
    if (!user) {
      bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
      return;
    }

    // Определяем день обучения
    const trainingDay = await getUserTrainingDay(user);
    const isTraining = trainingDay <= TRAINING_DAYS;

    // Показываем обучающее сообщение если нужно
    if (isTraining && trainingMessages[trainingDay - 1]) {
      await bot.sendMessage(chatId, trainingMessages[trainingDay - 1].message);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза для прочтения
    }

    const response = new Response({
      userId: user._id,
      telegramId: telegramId,
      notificationSentAt: notificationId ? new Date() : null,
      responseStartedAt: new Date(),
      responses: {},
      metadata: {
        trainingDay: trainingDay,
        isTraining: isTraining
      }
    });

    const surveyState = {
      responseId: response._id,
      currentQuestion: 0,
      responses: {},
      startTime: Date.now(),
      validationAttempts: {},
      followUpPending: false,
      trainingDay: trainingDay,
      qualityScore: 0
    };

    surveyStates.set(telegramId, surveyState);
    await response.save();

    // Начинаем с самого важного вопроса - момент
    await askQuestion(bot, chatId, telegramId, 0);
  } catch (error) {
    console.error('Error starting survey:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при запуске опроса. Попробуйте позже.');
  }
}

// Функция для генерации follow-up вопросов через стратегию
async function getFollowUpQuestion(context) {
  return await followUpStrategy.getNextQuestion(context);
}

// Модифицированная функция для задавания вопросов
async function askQuestion(bot, chatId, telegramId, questionIndex) {
  const state = surveyStates.get(telegramId);
  if (!state) return;

  // Получаем пользователя для форматирования сообщений
  const user = await User.findOne({ telegramId });

  // Проверяем, не нужен ли follow-up вопрос
  if (!state.followUpPending && Object.keys(state.responses).length > 0) {
    const context = {
      responses: state.responses,
      currentQuestion: questionIndex,
      userId: telegramId,
      trainingDay: state.trainingDay
    };
    
    const followUpQuestion = await getFollowUpQuestion(context);
    if (followUpQuestion && !state.askedFollowUps?.includes(followUpQuestion.clarifies)) {
      state.followUpPending = true;
      state.currentFollowUp = followUpQuestion;
      if (!state.askedFollowUps) state.askedFollowUps = [];
      state.askedFollowUps.push(followUpQuestion.clarifies);
      
      await bot.sendMessage(chatId, followUpQuestion.text, {
        reply_markup: {
          inline_keyboard: [[{ text: '⏭ Пропустить', callback_data: 'survey_skip_followup' }]]
        }
      });
      return;
    }
  }

  if (questionIndex >= questions.length) {
    await completeSurvey(bot, chatId, telegramId);
    return;
  }

  const question = questions[questionIndex];
  state.currentQuestion = questionIndex;

  if (question.type === 'scale') {
    const text = addressForms.formatForUser(
      `${question.text}\n\n${question.scale.minLabel} ← → ${question.scale.maxLabel}`,
      user
    );
    const keyboardOptions = createScaleKeyboard(question.scale.min, question.scale.max);
    await bot.sendMessage(chatId, text, keyboardOptions);
  } else {
    const questionText = addressForms.formatForUser(question.text, user);
    await bot.sendMessage(chatId, questionText, {
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Пропустить', callback_data: 'survey_skip' }]]
      }
    });
  }
}

// Обработка текстовых ответов с полной валидацией (золотой стандарт)
async function handleTextResponseWithGoldenStandard(bot, msg, state) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const question = questions[state.currentQuestion];
  
  if (question && question.type === 'text') {
    const responseStartTime = Date.now();
    
    // Получаем контекст для валидации
    const user = await User.findOne({ telegramId });
    const context = {
      trainingDay: user.currentTrainingDay || 1,
      previousResponses: Object.values(state.responses).map(r => r.text || r.value),
      currentActivity: state.responses.currentActivity?.text,
      questionType: question.validation
    };
    
    // 1. Базовая валидация через momentValidator
    const baseValidation = momentValidator.validate(
      msg.text, 
      question.validation || 'general',
      context
    );
    
    // 2. Улучшение через золотой стандарт
    const enhancedValidation = goldenStandard.enhance(
      baseValidation,
      msg.text,
      context
    );
    
    // 3. Глубокая валидация через ИИ (если доступно и нужно)
    let aiValidation = null;
    if (config.ai && config.ai.enableSmartValidation && 
        enhancedValidation.score > 30 && 
        enhancedValidation.score < 80) {
      
      aiValidation = await aiValidator.validate(msg.text, {
        ...context,
        detectedContext: enhancedValidation.goldenStandard?.detectedContext
      });
    }
    
    // Комбинируем результаты валидации
    const finalValidation = combineValidations(
      enhancedValidation, 
      aiValidation
    );
    
    // Обрабатываем результат валидации
    const isAccepted = await processValidationResult(
      bot, 
      chatId, 
      msg.text,
      finalValidation, 
      state,
      context
    );
    
    if (isAccepted) {
      // Сохраняем полные данные ответа
      state.responses[question.id] = {
        text: msg.text,
        timestamp: new Date(),
        responseTime: Date.now() - responseStartTime,
        quality: finalValidation.quality,
        score: finalValidation.score,
        validation: {
          base: baseValidation.score,
          golden: enhancedValidation.goldenStandard?.score,
          ai: aiValidation?.score,
          final: finalValidation.score
        },
        phenomena: finalValidation.phenomena,
        goldenStandard: enhancedValidation.goldenStandard
      };
      
      // Проверяем, нужен ли follow-up вопрос
      const followUp = await checkForFollowUp(bot, chatId, state, context);
      
      if (followUp) {
        state.pendingFollowUp = followUp;
        state.expectingFollowUp = true;
        await bot.sendMessage(chatId, followUp.text);
        return true;
      }
      
      // Сбрасываем счетчик follow-up и переходим к следующему вопросу
      state.followUpCount = 0;
      await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
    }
    
    return true;
  }
  
  // Проверяем, не ответ ли это на follow-up
  if (state.expectingFollowUp && state.pendingFollowUp) {
    await handleFollowUpResponse(bot, msg, state);
    return true;
  }
  
  return false;
}

// Оригинальная обработка текстовых ответов с валидацией
async function handleTextResponse(bot, msg, state) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

  // Если включен золотой стандарт, используем улучшенную версию
  if (config.validation && config.validation.useGoldenStandard) {
    return await handleTextResponseWithGoldenStandard(bot, msg, state);
  }

  // Если это follow-up ответ
  if (state.followUpPending) {
    state.responses[`followup_${Date.now()}`] = msg.text;
    state.followUpPending = false;
    await bot.sendMessage(chatId, '✅ Спасибо за уточнение!');
    await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
    return true;
  }

  const question = questions[state.currentQuestion];

  if (question && question.type === 'text') {
    // Валидация ответа если нужна
    if (question.validation) {
      const context = {
        trainingDay: state.trainingDay,
        previousResponses: Object.values(state.responses).filter(r => typeof r === 'string')
      };
      const validation = validateResponse(msg.text, question.validation, context);

      if (!validation.valid) {
        // Увеличиваем счётчик попыток
        const attemptKey = `q_${state.currentQuestion}`;
        state.validationAttempts[attemptKey] = (state.validationAttempts[attemptKey] || 0) + 1;

        // Если слишком много неудачных попыток, принимаем ответ
        if (state.validationAttempts[attemptKey] >= 2) {
          state.responses[question.id] = msg.text;
          state.qualityScore -= 10; // Снижаем оценку качества
          await bot.sendMessage(chatId,
            '✅ Ответ записан. Продолжайте практиковаться в точном наблюдении!'
          );
          await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
        } else {
          // Просим уточнить
          await bot.sendMessage(chatId, validation.feedback);
        }
        return true;
      }
    }

    // Ответ прошёл валидацию или валидация не требуется
    state.responses[question.id] = msg.text;
    
    // Записываем метрики
    recordUserResponse(telegramId);

    // Положительная обратная связь за хороший ответ
    if (question.validation && msg.text.length > 30) {
      const encouragements = [
        '✨ Отличное наблюдение!',
        '👍 Хорошая конкретика!',
        '🎯 Точно схвачен момент!',
        '💎 Ценное наблюдение!'
      ];
      await bot.sendMessage(chatId, encouragements[Math.floor(Math.random() * encouragements.length)]);
    } else {
      await bot.sendMessage(chatId, '✅ Ответ записан');
    }

    await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
    return true;
  }
  return false;
}

// Модифицированная функция завершения с анализом качества
async function completeSurvey(bot, chatId, telegramId) {
  try {
    const state = surveyStates.get(telegramId);
    if (!state) return;

    const response = await Response.findById(state.responseId);
    if (!response) return;

    // Рассчитываем качество данных
    const qualityScore = calculateDataQuality(state.responses);
    
    // Определяем Flow состояние
    let flowState = null;
    if (state.responses.challenge !== undefined && state.responses.skill !== undefined) {
      flowState = validator.detectFlowState(state.responses.challenge, state.responses.skill);
    }
    
    // Детектируем феномены Херлберта
    const phenomenaDetected = [];
    if (state.responses.moment_capture) {
      // Handle both string and object formats
      const momentCapture = state.responses.moment_capture;
      const text = typeof momentCapture === 'string' ? momentCapture : momentCapture.text;
      phenomenaDetected.push(...validator.detectHurlburtPhenomena(text));
    }

    // Сохраняем ответы в структуру, совместимую с текущей схемой
    response.responses = {
      mood: state.responses.mood,
      energy: state.responses.energy,
      stress: state.responses.stress,
      focus: state.responses.concentration, // Мапим concentration на focus
      currentThoughts: typeof state.responses.moment_capture === 'string' ? state.responses.moment_capture : state.responses.moment_capture?.text,
      currentActivity: typeof state.responses.currentActivity === 'string' ? state.responses.currentActivity : state.responses.currentActivity?.text || '',
      currentEmotions: typeof state.responses.currentCompanion === 'string' ? state.responses.currentCompanion : state.responses.currentCompanion?.text || ''
    };

    // Сохраняем дополнительные данные в metadata
    response.metadata = {
      ...response.metadata,
      // Flow данные
      challenge: state.responses.challenge,
      skill: state.responses.skill,
      flowState: flowState,
      concentration: state.responses.concentration,
      
      // Качество и обучение
      dataQualityScore: qualityScore,
      trainingDay: state.trainingDay,
      isTraining: state.trainingDay <= TRAINING_DAYS,
      
      // Феномены Херлберта
      phenomenaDetected: phenomenaDetected,
      
      // Follow-up данные
      followUpAnswers: Object.entries(state.responses)
        .filter(([key]) => key.startsWith('followup_'))
        .map(([key, value]) => ({ timestamp: key.split('_')[1], answer: value })),
      
      // Дополнительные поля
      currentCompanion: typeof state.responses.currentCompanion === 'string' ? state.responses.currentCompanion : state.responses.currentCompanion?.text || '',
      responseTime: Math.round((Date.now() - state.startTime) / 1000),
      validationAttempts: state.validationAttempts,
      
      // Required schema fields with defaults
      dataReliability: {
        reliabilityScore: qualityScore,
        junkDataFlags: [],
        excludeFromAnalysis: false
      },
      learningProgress: {
        conceptsUnderstood: [],
        illusionsBroken: [],
        skillsAcquired: [],
        breakthroughMoments: []
      }
    };

    response.responseCompletedAt = new Date();
    await response.save();

    // Геймификация: обрабатываем ответ пользователя
    const user = await User.findOne({ telegramId });
    if (user) {
      const gamificationResult = await GamificationService.processResponse(user, response);
      
      // Генерируем мотивационные сообщения
      const motivationalMessages = GamificationService.generateMotivationalMessage(user, gamificationResult);
      
      // Отправляем мотивационные сообщения отдельно
      if (motivationalMessages.length > 0) {
        setTimeout(() => {
          const gamificationMessage = motivationalMessages.join('\n');
          bot.sendMessage(chatId, gamificationMessage);
        }, 2000);
      }
      
      // Добавляем быстрый инсайт после опроса (для опытных пользователей)
      if (user.totalResponses >= 10 && state.trainingDay > TRAINING_DAYS) {
        setTimeout(async () => {
          try {
            const AIInsightsService = require('../services/ai-insights-service');
            const quickInsight = await AIInsightsService.generateQuickInsight(user._id);
            
            if (quickInsight && quickInsight.message) {
              await bot.sendMessage(chatId, 
                `💡 <b>Быстрый инсайт:</b>\n${quickInsight.emoji} ${quickInsight.message}\n\n` +
                `Для подробного анализа используйте /insights`, 
                { parse_mode: 'HTML' }
              );
            }
          } catch (error) {
            console.error('Error generating quick insight:', error);
          }
        }, 4000);
      }
    }

    surveyStates.delete(telegramId);

    // Reset escalation since user completed the survey
    if (global.notificationScheduler) {
      await global.notificationScheduler.resetEscalation(telegramId);
    }

    // Подсчитываем только основные вопросы (не follow-up)
    const mainResponses = Object.keys(state.responses).filter(key => 
      !key.startsWith('followup_')
    );
    const responseCount = mainResponses.length;
    const responseTime = Math.round((Date.now() - state.startTime) / 1000);
    
    // Считаем follow-up отдельно
    const followUpCount = Object.keys(state.responses).filter(key => 
      key.startsWith('followup_')
    ).length;

    // Персонализированная обратная связь
    let feedbackMessage = '';
    if (state.trainingDay <= TRAINING_DAYS) {
      feedbackMessage = `\n\n📚 День обучения ${state.trainingDay} из ${TRAINING_DAYS}`;
      if (qualityScore > 60) {
        feedbackMessage += '\n👍 Вы делаете отличные успехи!';
      } else {
        feedbackMessage += '\n💪 Продолжайте практиковаться в наблюдении момента';
      }
    } else {
      feedbackMessage = '\n\n🎓 Обучение завершено! Ваши данные теперь максимально точны.';
    }

    if (qualityScore >= 80) {
      feedbackMessage += '\n🌟 Превосходное качество наблюдений!';
    }
    
    // Добавляем информацию о Flow состоянии
    if (flowState) {
      const flowMessages = {
        flow: '🌊 Вы были в состоянии потока!',
        anxiety: '😰 Задача была сложновата',
        boredom: '😴 Задача была слишком лёгкой',
        control: '😎 Вы контролировали ситуацию',
        arousal: '🔥 Было интересно и вызывающе',
        worry: '😟 Немного беспокойно',
        apathy: '😐 Низкая вовлечённость',
        relaxation: '🌴 Расслабленное состояние'
      };
      if (flowMessages[flowState]) {
        feedbackMessage += `\n${flowMessages[flowState]}`;
      }
    }

    // Добавляем итеративную обратную связь о паттернах
    let patternInsights = '';
    if (state.trainingDay > TRAINING_DAYS) {
      try {
        const user = await User.findOne({ telegramId });
        if (user) {
          patternInsights = await patternFeedback.generateIterativeFeedback(user._id, response) || '';
        }
      } catch (error) {
        console.error('Error generating pattern feedback:', error);
      }
    }
    
    // Добавляем научный факт для мотивации
    let scientificFact = '';
    if (qualityScore >= 70 && state.trainingDay > TRAINING_DAYS) {
      const facts = config.scientificFacts;
      const randomFact = facts[Math.floor(Math.random() * facts.length)];
      scientificFact = `\n\n🔬 Интересный факт: ${randomFact.fact}`;
    }

    await bot.sendMessage(
      chatId,
      `✅ Спасибо за участие!\n\n` +
      `📊 Основные вопросы: ${responseCount} из ${questions.length}\n` +
      (followUpCount > 0 ? `🔍 Дополнительные уточнения: ${followUpCount}\n` : '') +
      `⏱ Время заполнения: ${responseTime} секунд\n` +
      `📈 Качество данных: ${qualityScore}%` +
      feedbackMessage +
      patternInsights +
      scientificFact +
      `\n\nИспользуйте /stats для просмотра вашей статистики.` +
      (state.trainingDay > TRAINING_DAYS && !user?.settings?.pushover?.enabled ? 
        `\n\n💡 Совет: Настрой уведомления на часы (/pushover) для более стабильной практики!` : ''),
      {
        reply_markup: {
          keyboard: [
            ['📚 Помощь', '📊 Памятка'],
            ['🏆 Достижения', '📊 Рейтинги'],
            ['🧠 Инсайты', '📰 Новости'],
            ['📈 Статистика']
          ],
          resize_keyboard: true
        }
      }
    );

    // Дополнительное сообщение для мотивации
    if (state.trainingDay === 3) {
      // Записываем метрики завершения обучения
      recordTrainingCompletion(qualityScore);
      
      setTimeout(() => {
        bot.sendMessage(chatId,
          `🎉 Поздравляем! Завтра начнётся основной сбор данных.\n\n` +
          `Вы научились различать:\n` +
          `✓ Момент от воспоминаний\n` +
          `✓ Опыт от теорий о нём\n` +
          `✓ Конкретику от обобщений\n\n` +
          `Теперь ваши данные будут действительно ценными! 💎`
        );
      }, 3000);
    }
  } catch (error) {
    console.error('Error completing survey:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при сохранении ответов.');
  }
}

// Остальные функции остаются без изменений
function createScaleKeyboard(min, max) {
  const keyboard = [];
  const buttonsPerRow = max - min + 1 > 7 ? 5 : 7;
  let row = [];

  for (let i = min; i <= max; i++) {
    row.push({ text: i.toString(), callback_data: `survey_scale_${i}` });

    if (row.length === buttonsPerRow || i === max) {
      keyboard.push([...row]);
      row = [];
    }
  }

  keyboard.push([{ text: '❌ Отменить', callback_data: 'survey_cancel' }]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

module.exports = {
  command: 'survey',
  description: 'Start ESM survey',
  questions,
  surveyStates,
  askQuestion,

  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    await startSurvey(bot, chatId, telegramId);
  },

  handleCallback: async (bot, query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    const state = surveyStates.get(telegramId);
    if (!state) {
      await bot.answerCallbackQuery(query.id, { text: 'Опрос не активен' });
      return;
    }

    if (data === 'survey_cancel') {
      surveyStates.delete(telegramId);
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        '❌ Опрос отменён',
        { chat_id: chatId, message_id: query.message.message_id }
      );
      return;
    }

    if (data === 'survey_skip' || data === 'survey_skip_followup') {
      await bot.answerCallbackQuery(query.id);

      if (data === 'survey_skip_followup') {
        state.followUpPending = false;
      }

      await bot.editMessageText(
        '⏭ Вопрос пропущен',
        { chat_id: chatId, message_id: query.message.message_id }
      );
      await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
      return;
    }

    if (data.startsWith('survey_scale_')) {
      const value = parseInt(data.replace('survey_scale_', ''));
      const question = questions[state.currentQuestion];

      state.responses[question.id] = value;

      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        `${question.text}\n\n✅ Ваш ответ: ${value}`,
        { chat_id: chatId, message_id: query.message.message_id }
      );

      await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
    }
  },

  handleTextResponse,
  handleTextResponseWithGoldenStandard,
  
  // Новые функции золотого стандарта
  combineValidations,
  processValidationResult,
  sendPositiveFeedback,
  sendEducationalFeedback,
  checkForFollowUp,
  handleFollowUpResponse,
  extractPhenomena,
  calculateValidationStats,
  updateUserStats,
  sendCompletionMessage,
  getQualityEmoji,
  checkAndCelebrateProgress
};

/**
 * Функции золотого стандарта
 */

/**
 * Комбинирование результатов валидации
 */
function combineValidations(enhanced, ai) {
  if (!ai) return enhanced;
  
  // Взвешенное комбинирование с учётом уверенности ИИ
  const aiWeight = ai.confidence || 0.5;
  const baseWeight = 1 - aiWeight;
  
  const combinedScore = Math.round(
    enhanced.score * baseWeight + 
    ai.score * aiWeight
  );
  
  return {
    ...enhanced,
    score: combinedScore,
    quality: goldenStandard.getQualityLevel ? goldenStandard.getQualityLevel(combinedScore) : 'unknown',
    phenomena: [...new Set([
      ...enhanced.phenomena || [],
      ...(ai.phenomena || [])
    ])],
    aiInsights: ai.suggestions,
    aiConfidence: ai.confidence
  };
}

/**
 * Обработка результата валидации
 */
async function processValidationResult(bot, chatId, text, validation, state, context) {
  const attemptKey = `q_${state.currentQuestion}`;
  state.validationAttempts[attemptKey] = (state.validationAttempts[attemptKey] || 0) + 1;
  
  // Определяем пороги в зависимости от дня обучения
  const acceptanceThreshold = context.trainingDay <= 2 ? 30 : 40;
  const maxAttempts = context.trainingDay <= 2 ? 3 : 2;
  
  // Если качество приемлемое - принимаем
  if (validation.score >= acceptanceThreshold) {
    await sendPositiveFeedback(bot, chatId, validation, context);
    return true;
  }
  
  // Если превышены попытки - принимаем с оговоркой
  if (state.validationAttempts[attemptKey] >= maxAttempts) {
    await bot.sendMessage(
      chatId,
      '📝 Записано. ' + (validation.feedback || 'Продолжайте практиковаться!')
    );
    return true;
  }
  
  // Показываем обучающую обратную связь
  await sendEducationalFeedback(bot, chatId, validation, context);
  
  // Если есть похожие примеры - показываем
  if (validation.goldenStandard?.similarExamples?.length > 0 && 
      context.trainingDay <= 2) {
    
    const example = validation.goldenStandard.similarExamples[0];
    if (example.quality === 'excellent' || example.quality === 'good') {
      await bot.sendMessage(
        chatId,
        `💡 Пример ${example.quality === 'excellent' ? 'отличного' : 'хорошего'} ответа:\n` +
        `"${example.text}"\n\n` +
        `Попробуйте ещё раз с большей конкретикой.`
      );
    }
  }
  
  return false;
}

/**
 * Отправка позитивной обратной связи
 */
async function sendPositiveFeedback(bot, chatId, validation, context) {
  let message = '';
  
  if (validation.quality === 'pristine' || validation.quality === 'excellent') {
    message = '🌟 Превосходно! ';
    
    // Объясняем почему это хорошо в дни обучения
    if (context.trainingDay <= 3) {
      const patterns = validation.goldenStandard?.matchedPatterns?.positive || [];
      if (patterns.length > 0) {
        const patternNames = patterns.slice(0, 3).map(p => p.name).join(', ');
        message += `\n\nЧто делает ваш ответ отличным: ${patternNames}`;
      }
    }
  } else if (validation.quality === 'good') {
    message = '✅ Хорошее наблюдение!';
  } else {
    message = '👍 Записано.';
  }
  
  // Добавляем мотивирующий факт
  if (Math.random() < 0.3 && validation.score > 70 && config.scientificFacts) {
    const fact = config.scientificFacts[
      Math.floor(Math.random() * config.scientificFacts.length)
    ];
    if (fact && fact.fact) {
      message += `\n\n💡 Интересный факт: ${fact.fact}`;
    }
  }
  
  await bot.sendMessage(chatId, message);
}

/**
 * Отправка обучающей обратной связи
 */
async function sendEducationalFeedback(bot, chatId, validation, context) {
  let message = validation.feedback || 
    '🔍 Попробуйте описать более конкретно. Что ИМЕННО происходило?';
  
  // Добавляем специфичные подсказки на основе обнаруженных проблем
  if (validation.goldenStandard?.matchedPatterns?.negative?.length > 0) {
    const mainIssue = validation.goldenStandard.matchedPatterns.negative[0];
    
    // Добавляем иллюстрацию проблемы
    switch (mainIssue.category) {
      case 'garbage':
        message += '\n\n❌ Избегайте: обобщений и оценок';
        message += '\n✅ Опишите: конкретный момент';
        break;
      case 'illusion':
        if (mainIssue.name === 'reading_voice_illusion') {
          message += '\n\n📊 Факт: исследования показывают, что 97% чтения происходит БЕЗ внутреннего голоса!';
        }
        break;
    }
  }
  
  await bot.sendMessage(chatId, message);
}

/**
 * Проверка необходимости follow-up вопроса
 */
async function checkForFollowUp(bot, chatId, state, context) {
  // Используем стратегию follow-up
  const followUp = await followUpStrategy.getNextQuestion({
    responses: state.responses,
    currentQuestion: state.currentQuestion,
    userId: state.userId,
    trainingDay: context.trainingDay
  });
  
  // Если стратегия не дала вопрос, пробуем ИИ
  if (!followUp && config.ai && config.ai.enableSmartValidation && aiValidator.generateFollowUp) {
    const lastResponse = Object.values(state.responses).pop();
    if (lastResponse?.text) {
      // Инициализируем счетчик follow-up если его нет
      if (!state.followUpCount) state.followUpCount = 0;
      
      const aiFollowUp = await aiValidator.generateFollowUp(
        lastResponse.text,
        {
          detectedContext: lastResponse.goldenStandard?.detectedContext,
          quality: lastResponse.quality,
          followUpCount: state.followUpCount
        }
      );
      
      if (aiFollowUp) {
        state.followUpCount++; // Увеличиваем счетчик
        return {
          text: aiFollowUp,
          source: 'ai',
          clarifies: 'ai_generated'
        };
      }
    }
  }
  
  return followUp;
}

/**
 * Обработка ответа на follow-up вопрос
 */
async function handleFollowUpResponse(bot, msg, state) {
  const chatId = msg.chat.id;
  const followUp = state.pendingFollowUp;
  
  // Анализируем ответ
  const analysis = followUpStrategy.analyzeFollowUpResponse(
    msg.text,
    followUp,
    { responses: state.responses }
  );
  
  // Сохраняем follow-up ответ
  const lastQuestionId = Object.keys(state.responses).pop();
  if (state.responses[lastQuestionId]) {
    state.responses[lastQuestionId].followUp = {
      question: followUp.text,
      answer: msg.text,
      analysis: analysis
    };
  }
  
  // Даём обратную связь
  if (analysis.illusionBroken) {
    await bot.sendMessage(
      chatId,
      '💡 Отлично! Вы заметили разницу. ' + 
      (analysis.recommendations?.[0] || '')
    );
  } else if (analysis.insightGained) {
    await bot.sendMessage(chatId, '✅ Хорошее уточнение!');
  } else {
    await bot.sendMessage(chatId, '👍 Понятно, спасибо за уточнение.');
  }
  
  // Сбрасываем флаги и продолжаем
  state.expectingFollowUp = false;
  state.pendingFollowUp = null;
  state.followUpCount = 0; // Сбрасываем счетчик для следующего вопроса
  
  // Переходим к следующему вопросу
  const telegramId = msg.from.id;
  await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
}

/**
 * Вспомогательные функции
 */

function extractPhenomena(responses) {
  const phenomena = [];
  
  Object.values(responses).forEach(r => {
    if (r.phenomena) {
      phenomena.push(...r.phenomena);
    }
  });
  
  // Подсчитываем частоты
  const counts = {};
  phenomena.forEach(p => {
    counts[p] = (counts[p] || 0) + 1;
  });
  
  return counts;
}

function calculateValidationStats(responses) {
  const stats = {
    averageScore: 0,
    averageResponseTime: 0,
    validationAttempts: 0,
    followUpsCompleted: 0
  };
  
  let scoreSum = 0;
  let timeSum = 0;
  let count = 0;
  
  Object.values(responses).forEach(r => {
    if (r.score !== undefined) {
      scoreSum += r.score;
      count++;
    }
    if (r.responseTime) {
      timeSum += r.responseTime;
    }
    if (r.followUp) {
      stats.followUpsCompleted++;
    }
  });
  
  stats.averageScore = count > 0 ? Math.round(scoreSum / count) : 0;
  stats.averageResponseTime = count > 0 ? Math.round(timeSum / count) : 0;
  
  return stats;
}

async function updateUserStats(user, response) {
  if (!user || !response) return;
  
  // Обновляем качество
  const newQualityEntry = {
    date: new Date(),
    score: response.dataQualityScore || 0,
    responsesCount: Object.keys(response.responses || {}).length
  };
  
  if (!user.qualityHistory) user.qualityHistory = [];
  user.qualityHistory.push(newQualityEntry);
  
  // Обновляем среднее качество
  const recentScores = user.qualityHistory
    .slice(-10)
    .map(h => h.score);
  
  if (recentScores.length > 0) {
    user.averageDataQuality = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  }
  
  user.totalResponses = (user.totalResponses || 0) + 1;
  
  // Обновляем паттерны если есть ИИ анализ
  if (config.ai && config.ai.enablePatternDetection && user.totalResponses >= 10 && aiValidator.analyzeUserPatterns) {
    try {
      const patterns = await aiValidator.analyzeUserPatterns(
        user._id,
        user.qualityHistory.slice(-20)
      );
      
      if (patterns) {
        user.commonPatterns = patterns;
      }
    } catch (error) {
      console.error('Error analyzing user patterns:', error);
    }
  }
  
  await user.save();
}

async function sendCompletionMessage(bot, chatId, state, quality, recommendations) {
  const responseCount = Object.keys(state.responses).length;
  const responseTime = Math.round((Date.now() - state.startTime) / 1000);
  
  let message = `✅ Спасибо за участие!\n\n`;
  message += `📊 Статистика:\n`;
  message += `├ Ответов: ${responseCount} из ${questions.length}\n`;
  message += `├ Время: ${responseTime} сек\n`;
  message += `└ Качество: ${getQualityEmoji(quality)} ${Math.round(quality)}%\n\n`;
  
  // Персонализированная обратная связь
  if (quality >= 80) {
    message += `🌟 Превосходное качество наблюдений!\n`;
  } else if (quality >= 60) {
    message += `👍 Хорошая работа! Продолжайте совершенствоваться.\n`;
  } else {
    message += `📚 Есть куда расти. Практика - ключ к мастерству!\n`;
  }
  
  // Рекомендации
  if (recommendations && recommendations.length > 0) {
    message += `\n💡 Рекомендации:\n`;
    recommendations.slice(0, 2).forEach(rec => {
      message += `• ${rec.suggestion || rec}\n`;
    });
  }
  
  message += `\nИспользуйте /stats для детальной статистики.`;
  
  await bot.sendMessage(chatId, message, {
    reply_markup: {
      keyboard: [
        ['📚 Помощь', '📊 Памятка'],
        ['🔊 Эхо', '📈 Статистика']
      ],
      resize_keyboard: true
    }
  });
}

function getQualityEmoji(score) {
  if (score >= 80) return '🌟';
  if (score >= 60) return '✅';
  if (score >= 40) return '🟡';
  return '🔴';
}

async function checkAndCelebrateProgress(bot, chatId, user) {
  // Сравниваем с предыдущими днями
  if (!user.qualityHistory || user.qualityHistory.length < 2) return;
  
  const today = user.qualityHistory.slice(-1)[0];
  const yesterday = user.qualityHistory.slice(-2, -1)[0];
  
  const improvement = today.score - yesterday.score;
  
  if (improvement > 20) {
    setTimeout(() => {
      bot.sendMessage(
        chatId,
        `🎉 Вау! Качество ваших наблюдений улучшилось на ${Math.round(improvement)}%!\n\n` +
        `Вы действительно начинаете различать моментальный опыт от мыслей о нём. ` +
        `Это редкий навык! 🌟`
      );
    }, 2000);
  }
}