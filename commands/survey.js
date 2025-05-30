const User = require('../models/User');
const Response = require('../models/Response');

const surveyStates = new Map();

const questions = [
  {
    id: 'mood',
    text: '🌈 Как вы себя чувствуете прямо сейчас?',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Очень плохо', maxLabel: 'Отлично' }
  },
  {
    id: 'energy',
    text: '⚡ Насколько вы энергичны?',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Истощён', maxLabel: 'Полон сил' }
  },
  {
    id: 'stress',
    text: '😰 Уровень стресса?',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Расслаблен', maxLabel: 'Очень напряжён' }
  },
  {
    id: 'focus',
    text: '🎯 Насколько вы сфокусированы?',
    type: 'scale',
    scale: { min: 1, max: 7, minLabel: 'Рассеян', maxLabel: 'Полностью сосредоточен' }
  },
  {
    id: 'currentThoughts',
    text: '💭 Опишите в 2-3 словах, о чём думаете прямо сейчас:',
    type: 'text'
  },
  {
    id: 'currentActivity',
    text: '📝 Что вы делаете в данный момент?',
    type: 'text'
  },
  {
    id: 'currentEmotions',
    text: '😊 Какие эмоции испытываете?',
    type: 'text'
  }
];

function createScaleKeyboard(min, max) {
  const keyboard = [];
  const row = [];
  
  for (let i = min; i <= max; i++) {
    row.push({ text: i.toString(), callback_data: `survey_scale_${i}` });
  }
  
  keyboard.push(row);
  keyboard.push([{ text: '❌ Отменить', callback_data: 'survey_cancel' }]);
  
  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

async function startSurvey(bot, chatId, telegramId, notificationId = null) {
  try {
    let user = await User.findOne({ telegramId });
    if (!user) {
      bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
      return;
    }

    const response = new Response({
      userId: user._id,
      telegramId: telegramId,
      notificationSentAt: notificationId ? new Date() : null,
      responseStartedAt: new Date(),
      responses: {}
    });

    const surveyState = {
      responseId: response._id,
      currentQuestion: 0,
      responses: {},
      startTime: Date.now()
    };

    surveyStates.set(telegramId, surveyState);
    await response.save();

    await askQuestion(bot, chatId, telegramId, 0);
  } catch (error) {
    console.error('Error starting survey:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при запуске опроса. Попробуйте позже.');
  }
}

async function askQuestion(bot, chatId, telegramId, questionIndex) {
  const state = surveyStates.get(telegramId);
  if (!state) return;

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

async function completeSurvey(bot, chatId, telegramId) {
  try {
    const state = surveyStates.get(telegramId);
    if (!state) return;

    const response = await Response.findById(state.responseId);
    if (!response) return;

    response.responses = state.responses;
    response.responseCompletedAt = new Date();
    await response.save();

    surveyStates.delete(telegramId);

    const responseCount = Object.keys(state.responses).length;
    const responseTime = Math.round((Date.now() - state.startTime) / 1000);

    await bot.sendMessage(
      chatId,
      `✅ Спасибо за участие!\n\n` +
      `📊 Вы ответили на ${responseCount} из ${questions.length} вопросов\n` +
      `⏱ Время заполнения: ${responseTime} секунд\n\n` +
      `Используйте /stats для просмотра вашей статистики.`,
      {
        reply_markup: {
          keyboard: [
            ['📚 Help', '📊 Info'],
            ['🔊 Echo', '📈 Stats']
          ],
          resize_keyboard: true
        }
      }
    );
  } catch (error) {
    console.error('Error completing survey:', error);
    bot.sendMessage(chatId, 'Произошла ошибка при сохранении ответов.');
  }
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
    
    if (data === 'survey_skip') {
      await bot.answerCallbackQuery(query.id);
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
  
  handleTextResponse: async (bot, msg, state) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const question = questions[state.currentQuestion];
    
    if (question && question.type === 'text') {
      state.responses[question.id] = msg.text;
      await bot.sendMessage(chatId, '✅ Ответ записан');
      await askQuestion(bot, chatId, telegramId, state.currentQuestion + 1);
      return true;
    }
    return false;
  }
};