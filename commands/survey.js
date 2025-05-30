const User = require('../models/User');
const Response = require('../models/Response');
const config = require('../config/hurlburt');
const MomentValidator = require('../validators/momentValidator');
const FollowUpStrategy = require('../strategies/followUpStrategy');
const PatternFeedback = require('../helpers/patternFeedback');

const surveyStates = new Map();
const validator = new MomentValidator();
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
    text: '🎯 СТОП! Что происходило в вашем сознании ИМЕННО в момент сигнала?\n\n' +
          'Опишите не общее состояние дня, а что было ПРЯМО В ТОТ МОМЕНТ.',
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
    text: '🛠 В ТОТ МОМЕНТ ваши навыки были:',
    type: 'scale',
    scale: { min: 0, max: 9, minLabel: 'Недостаточными', maxLabel: 'Более чем достаточными' }
  },
  {
    id: 'concentration',
    text: '🎯 Насколько вы были сконцентрированы В ТОТ МОМЕНТ?',
    type: 'scale',
    scale: { min: 0, max: 9, minLabel: 'Совсем не сконцентрирован', maxLabel: 'Полностью сконцентрирован' }
  },
  {
    id: 'mood',
    text: '🌈 Какое было ваше состояние В МОМЕНТ сигнала?',
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
    text: '📝 Что КОНКРЕТНО вы делали? (не "работал", а "печатал email Ивану о проекте X")',
    type: 'text',
    validation: 'specific'
  },
  {
    id: 'currentCompanion',
    text: '👥 С кем вы были В ТОТ МОМЕНТ? (или "один")',
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
function getFollowUpQuestion(context) {
  return followUpStrategy.getNextQuestion(context);
}

// Модифицированная функция для задавания вопросов
async function askQuestion(bot, chatId, telegramId, questionIndex) {
  const state = surveyStates.get(telegramId);
  if (!state) return;

  // Проверяем, не нужен ли follow-up вопрос
  if (!state.followUpPending && Object.keys(state.responses).length > 0) {
    const context = {
      responses: state.responses,
      currentQuestion: questionIndex,
      userId: telegramId,
      trainingDay: state.trainingDay
    };
    
    const followUpQuestion = getFollowUpQuestion(context);
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
    const text = `${question.text}\n\n${question.scale.minLabel} ← → ${question.scale.maxLabel}`;
    await bot.sendMessage(chatId, text, createScaleKeyboard(question.scale.min, question.scale.max));
  } else {
    await bot.sendMessage(chatId, question.text, {
      reply_markup: {
        inline_keyboard: [[{ text: '⏭ Пропустить', callback_data: 'survey_skip' }]]
      }
    });
  }
}

// Обработка текстовых ответов с валидацией
async function handleTextResponse(bot, msg, state) {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;

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
      phenomenaDetected.push(...validator.detectHurlburtPhenomena(state.responses.moment_capture));
    }

    // Сохраняем ответы в структуру, совместимую с текущей схемой
    response.responses = {
      mood: state.responses.mood,
      energy: state.responses.energy,
      stress: state.responses.stress,
      focus: state.responses.concentration, // Мапим concentration на focus
      currentThoughts: state.responses.moment_capture,
      currentActivity: state.responses.currentActivity,
      currentEmotions: state.responses.currentCompanion || '' // Правильное поле для эмоций
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
      currentCompanion: state.responses.currentCompanion,
      responseTime: Math.round((Date.now() - state.startTime) / 1000),
      validationAttempts: state.validationAttempts
    };

    response.responseCompletedAt = new Date();
    await response.save();

    surveyStates.delete(telegramId);

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
      `\n\nИспользуйте /stats для просмотра вашей статистики.`,
      {
        reply_markup: {
          keyboard: [
            ['📚 Помощь', '📊 Памятка'],
            ['🔊 Эхо', '📈 Статистика']
          ],
          resize_keyboard: true
        }
      }
    );

    // Дополнительное сообщение для мотивации
    if (state.trainingDay === 3) {
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

  handleTextResponse
};