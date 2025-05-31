require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { connectDB } = require('./services/database');
const NotificationScheduler = require('./services/notificationScheduler');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('Error: BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
let notificationScheduler;

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.set(command.command, command);
  
  if (command.pattern) {
    bot.onText(command.pattern, (msg, match) => {
      command.execute(bot, msg, match);
    });
  } else {
    bot.onText(new RegExp(`\/${command.command}`), (msg, match) => {
      command.execute(bot, msg, match);
    });
  }
}

bot.on('message', async (msg) => {
  if (msg.text) {
    const telegramId = msg.from.id;
    const surveyCommand = commands.get('survey');
    const settingsCommand = commands.get('settings');
    
    if (surveyCommand && surveyCommand.surveyStates && surveyCommand.surveyStates.has(telegramId)) {
      const state = surveyCommand.surveyStates.get(telegramId);
      const handled = await surveyCommand.handleTextResponse(bot, msg, state);
      if (handled) return;
    }
    
    if (settingsCommand && settingsCommand.settingsStates && settingsCommand.settingsStates.has(telegramId)) {
      const handled = await settingsCommand.handleTextResponse(bot, msg);
      if (handled) return;
    }
    
    if (msg.text === '📚 Помощь') {
      const helpCommand = commands.get('help');
      if (helpCommand) helpCommand.execute(bot, msg);
    } else if (msg.text === '📊 Памятка') {
      const infoCommand = commands.get('info');
      if (infoCommand) infoCommand.execute(bot, msg);
    } else if (msg.text === '🔊 Эхо') {
      bot.sendMessage(msg.chat.id, 'Используйте /echo с текстом. Пример: /echo Привет мир');
    } else if (msg.text === '📈 Статистика') {
      const statsCommand = commands.get('stats');
      if (statsCommand) {
        statsCommand.execute(bot, msg);
      } else {
        bot.sendMessage(msg.chat.id, 'Команда /stats ещё в разработке');
      }
    } else if (msg.text === '🏆 Достижения') {
      const achievementsCommand = commands.get('achievements');
      if (achievementsCommand) {
        achievementsCommand.execute(bot, msg);
      }
    } else if (msg.text === '📊 Рейтинги') {
      const leaderboardCommand = commands.get('leaderboard');
      if (leaderboardCommand) {
        leaderboardCommand.execute(bot, msg);
      }
    } else if (msg.text === '🧠 Инсайты') {
      const insightsCommand = commands.get('insights');
      if (insightsCommand) {
        insightsCommand.execute(bot, msg);
      }
    } else if (msg.text === '🔔 Опрос') {
      const surveyCommand = commands.get('survey');
      if (surveyCommand) {
        surveyCommand.execute(bot, msg);
      }
    } else if (!msg.text.startsWith('/') && 
               msg.text !== '📚 Помощь' && 
               msg.text !== '📊 Памятка' && 
               msg.text !== '🔊 Эхо' &&
               msg.text !== '📈 Статистика' &&
               msg.text !== '🏆 Достижения' &&
               msg.text !== '📊 Рейтинги' &&
               msg.text !== '🧠 Инсайты' &&
               msg.text !== '🔔 Опрос') {
      bot.sendMessage(msg.chat.id, `Вы написали: "${msg.text}"\n\nИспользуйте /help или кнопки клавиатуры для просмотра доступных команд.`);
    }
  }
});

bot.on('callback_query', async (query) => {
  if (query.data.startsWith('survey_')) {
    const surveyCommand = commands.get('survey');
    if (surveyCommand && surveyCommand.handleCallback) {
      await surveyCommand.handleCallback(bot, query);
    }
  } else if (query.data.startsWith('settings_')) {
    const settingsCommand = commands.get('settings');
    if (settingsCommand && settingsCommand.handleCallback) {
      await settingsCommand.handleCallback(bot, query);
    }
  } else if (query.data.startsWith('start_survey_')) {
    const responseId = query.data.replace('start_survey_', '');
    await notificationScheduler.handleSurveyStart(responseId, query.from.id);
    
    const surveyCommand = commands.get('survey');
    if (surveyCommand) {
      await bot.answerCallbackQuery(query.id, { text: 'Начинаем опрос...' });
      surveyCommand.execute(bot, query.message);
    }
  } else if (query.data.startsWith('skip_survey_')) {
    const responseId = query.data.replace('skip_survey_', '');
    await notificationScheduler.handleSurveySkip(responseId, query.from.id);
    
    await bot.answerCallbackQuery(query.id, { text: 'Опрос пропущен' });
    await bot.sendMessage(query.message.chat.id, 
      'Опрос пропущен. Я напомню вам позже! 👍'
    );
  } else if (query.data.startsWith('export_')) {
    const exportCommand = commands.get('export');
    if (exportCommand && exportCommand.handleCallback) {
      await exportCommand.handleCallback(bot, query);
    }
  } else if (query.data.startsWith('leaderboards') || query.data.includes('leaderboard')) {
    const leaderboardCommand = commands.get('leaderboard');
    if (leaderboardCommand) {
      await bot.answerCallbackQuery(query.id);
      await leaderboardCommand.execute(bot, query.message);
    }
  } else if (query.data.startsWith('my_achievements') || query.data.includes('achievements')) {
    const achievementsCommand = commands.get('achievements');
    if (achievementsCommand) {
      await bot.answerCallbackQuery(query.id);
      await achievementsCommand.execute(bot, query.message);
    }
  } else if (query.data.startsWith('stats')) {
    const statsCommand = commands.get('stats');
    if (statsCommand) {
      await bot.answerCallbackQuery(query.id);
      await statsCommand.execute(bot, query.message);
    }
  } else if (query.data.startsWith('insights_') || query.data === 'insights_back') {
    const insightsCommand = commands.get('insights');
    if (insightsCommand) {
      if (query.data === 'insights_back') {
        await bot.answerCallbackQuery(query.id);
        await insightsCommand.execute(bot, query.message);
      } else if (insightsCommand.handleCallback) {
        await insightsCommand.handleCallback(bot, query);
      }
    }
  } else if (query.data.startsWith('refresh_')) {
    // Обновление различных разделов
    if (query.data === 'refresh_achievements') {
      const achievementsCommand = commands.get('achievements');
      if (achievementsCommand) {
        await bot.answerCallbackQuery(query.id, { text: 'Обновлено!' });
        await achievementsCommand.execute(bot, query.message);
      }
    } else if (query.data === 'refresh_leaderboard') {
      const leaderboardCommand = commands.get('leaderboard');
      if (leaderboardCommand) {
        await bot.answerCallbackQuery(query.id, { text: 'Обновлено!' });
        await leaderboardCommand.execute(bot, query.message);
      }
    }
  }
});

bot.on('polling_error', (error) => {
  console.error('ППPolling error:', error);
});

const startBot = async () => {
  await connectDB();
  
  // Initialize notification scheduler
  notificationScheduler = new NotificationScheduler(bot);
  await notificationScheduler.initialize();
  
  // Make scheduler globally accessible for survey completion
  global.notificationScheduler = notificationScheduler;
  
  console.log('MSE Bot is running...');
  console.log(`Loaded ${commands.size} commands`);
};

startBot().catch(console.error);