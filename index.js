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
    
    if (msg.text === '📚 Help') {
      const helpCommand = commands.get('help');
      if (helpCommand) helpCommand.execute(bot, msg);
    } else if (msg.text === '📊 Info') {
      const infoCommand = commands.get('info');
      if (infoCommand) infoCommand.execute(bot, msg);
    } else if (msg.text === '🔊 Echo') {
      bot.sendMessage(msg.chat.id, 'Please use /echo followed by your text. Example: /echo Hello World');
    } else if (msg.text === '📈 Stats') {
      const statsCommand = commands.get('stats');
      if (statsCommand) {
        statsCommand.execute(bot, msg);
      } else {
        bot.sendMessage(msg.chat.id, 'Команда /stats ещё в разработке');
      }
    } else if (msg.text === '🔔 Survey') {
      const surveyCommand = commands.get('survey');
      if (surveyCommand) {
        surveyCommand.execute(bot, msg);
      }
    } else if (!msg.text.startsWith('/') && 
               msg.text !== '📚 Help' && 
               msg.text !== '📊 Info' && 
               msg.text !== '🔊 Echo' &&
               msg.text !== '📈 Stats' &&
               msg.text !== '🔔 Survey') {
      bot.sendMessage(msg.chat.id, `You said: "${msg.text}"\n\nUse /help or the keyboard buttons to see available commands.`);
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
  
  console.log('MSE Bot is running...');
  console.log(`Loaded ${commands.size} commands`);
};

startBot().catch(console.error);