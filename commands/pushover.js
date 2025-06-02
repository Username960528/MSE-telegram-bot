const User = require('../models/User');
const PushoverService = require('../services/pushover-service');
const addressForms = require('../utils/addressForms');

const pushoverStates = new Map();

module.exports = {
  command: 'pushover',
  execute: async (bot, msg, args) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
      let user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала используйте команду /start для регистрации.');
        return;
      }

      const pushoverService = new PushoverService();

      // If user provided a token as argument
      if (args && args.length > 0) {
        const userKey = args[0];
        
        if (!pushoverService.validateUserKey(userKey)) {
          const message = addressForms.formatForUser(
            `❌ Неверный формат Pushover User Key.\n\n` +
            `User Key должен содержать 30 символов (буквы и цифры).\n\n` +
            `Получи свой User Key в приложении Pushover в разделе "Settings".`,
            user
          );
          bot.sendMessage(chatId, message);
          return;
        }

        // Test the connection
        const testResult = await pushoverService.testConnection(userKey);
        
        if (testResult.success) {
          // Save the token
          user.settings.pushover.userKey = userKey;
          user.settings.pushover.enabled = true;
          await user.save();

          const message = addressForms.formatForUser(
            `✅ Pushover настроен успешно!\n\n` +
            `Теперь уведомления будут приходить на все твои устройства, включая часы.\n\n` +
            `Для настройки дополнительных параметров используй /pushover_settings.`,
            user
          );
          bot.sendMessage(chatId, message);
        } else {
          const message = addressForms.formatForUser(
            `❌ Не удалось подключиться к Pushover.\n\n` +
            `Ошибка: ${testResult.error}\n\n` +
            `Проверь правильность User Key и попробуй еще раз.`,
            user
          );
          bot.sendMessage(chatId, message);
        }
        return;
      }

      // Show main Pushover menu
      const isEnabled = user.settings.pushover.enabled && user.settings.pushover.userKey;
      const status = isEnabled ? '✅ Подключен' : '❌ Не настроен';

      const keyboard = {
        inline_keyboard: [
          [{ text: '📱 Инструкция по настройке', callback_data: 'pushover_setup_guide' }],
          ...(isEnabled ? [
            [{ text: '⚙️ Настройки уведомлений', callback_data: 'pushover_settings' }],
            [{ text: '🧪 Тест уведомления', callback_data: 'pushover_test' }],
            [{ text: '🔄 Изменить User Key', callback_data: 'pushover_change_key' }],
            [{ text: '❌ Отключить Pushover', callback_data: 'pushover_disable' }]
          ] : [
            [{ text: '🔑 Ввести User Key', callback_data: 'pushover_enter_key' }]
          ]),
          [{ text: '❌ Закрыть', callback_data: 'pushover_close' }]
        ]
      };

      const message = addressForms.formatForUser(
        `📱 *Pushover - Уведомления на часы*\n\n` +
        `Статус: ${status}\n\n` +
        `Pushover позволяет получать уведомления прямо на часы Garmin, Apple Watch, Wear OS и другие носимые устройства.\n\n` +
        `*Преимущества:*\n` +
        `• Высокий приоритет - пробивается через режим "Не беспокоить"\n` +
        `• Настраиваемые звуки и вибрация\n` +
        `• Повторные напоминания при пропуске\n` +
        `• Мгновенная доставка на все устройства\n\n` +
        `Выбери действие:`,
        user
      );

      bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      console.error('Error in pushover command:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при обработке команды. Попробуйте еще раз.');
    }
  },

  handleCallback: async (bot, callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    try {
      let user = await User.findOne({ telegramId: userId });
      const pushoverService = new PushoverService();

      switch (data) {
        case 'pushover_setup_guide':
          const setupMessage = addressForms.formatForUser(
            pushoverService.getSetupInstructions(),
            user
          );
          bot.sendMessage(chatId, setupMessage, { parse_mode: 'Markdown' });
          break;

        case 'pushover_enter_key':
          pushoverStates.set(userId, 'waiting_for_key');
          const keyMessage = addressForms.formatForUser(
            `🔑 *Введи свой Pushover User Key*\n\n` +
            `Найди его в приложении Pushover:\n` +
            `Settings → User Key\n\n` +
            `User Key выглядит так: \`abc123def456...\` (30 символов)\n\n` +
            `Просто отправь его следующим сообщением.`,
            user
          );
          bot.sendMessage(chatId, keyMessage, { parse_mode: 'Markdown' });
          break;

        case 'pushover_settings':
          await this.showPushoverSettings(bot, chatId, user);
          break;

        case 'pushover_test':
          const testResult = await pushoverService.testConnection(user.settings.pushover.userKey);
          if (testResult.success) {
            bot.sendMessage(chatId, addressForms.formatForUser('✅ Тестовое уведомление отправлено! Проверь свои устройства.', user));
          } else {
            bot.sendMessage(chatId, addressForms.formatForUser(`❌ Ошибка отправки: ${testResult.error}`, user));
          }
          break;

        case 'pushover_change_key':
          pushoverStates.set(userId, 'waiting_for_new_key');
          bot.sendMessage(chatId, addressForms.formatForUser('🔑 Введи новый Pushover User Key:', user));
          break;

        case 'pushover_disable':
          user.settings.pushover.enabled = false;
          user.settings.pushover.userKey = null;
          await user.save();
          bot.sendMessage(chatId, addressForms.formatForUser('❌ Pushover отключен.', user));
          break;

        case 'pushover_close':
          bot.deleteMessage(chatId, callbackQuery.message.message_id);
          break;

        // Settings callbacks
        case 'pushover_toggle_priority':
          await this.togglePriority(bot, callbackQuery, user);
          break;

        case 'pushover_change_sound':
          await this.showSoundSelection(bot, chatId, user);
          break;

        default:
          if (data.startsWith('pushover_sound_')) {
            const sound = data.replace('pushover_sound_', '');
            user.settings.pushover.sound = sound;
            await user.save();
            bot.sendMessage(chatId, addressForms.formatForUser(`🔊 Звук изменен на: ${sound}`, user));
            await this.showPushoverSettings(bot, chatId, user);
          }
          break;
      }

      bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('Error in pushover callback:', error);
      bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
    }
  },

  handleTextMessage: async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    const state = pushoverStates.get(userId);
    if (!state) return false;

    try {
      const user = await User.findOne({ telegramId: userId });
      const pushoverService = new PushoverService();

      if (state === 'waiting_for_key' || state === 'waiting_for_new_key') {
        const userKey = text.trim();

        if (!pushoverService.validateUserKey(userKey)) {
          bot.sendMessage(chatId, addressForms.formatForUser(
            '❌ Неверный формат User Key. Он должен содержать 30 символов (буквы и цифры).',
            user
          ));
          return true;
        }

        // Test connection
        const testResult = await pushoverService.testConnection(userKey);
        
        if (testResult.success) {
          user.settings.pushover.userKey = userKey;
          user.settings.pushover.enabled = true;
          await user.save();

          bot.sendMessage(chatId, addressForms.formatForUser(
            '✅ Pushover настроен успешно! Тестовое уведомление отправлено.',
            user
          ));
        } else {
          bot.sendMessage(chatId, addressForms.formatForUser(
            `❌ Не удалось подключиться: ${testResult.error}`,
            user
          ));
        }

        pushoverStates.delete(userId);
        return true;
      }

    } catch (error) {
      console.error('Error handling pushover text message:', error);
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз.');
    }

    return false;
  },

  showPushoverSettings: async (bot, chatId, user) => {
    const pushoverService = new PushoverService();
    const priorities = pushoverService.getPriorityLevels();
    
    const keyboard = {
      inline_keyboard: [
        [{ text: `🚨 Приоритет: ${priorities[user.settings.pushover.priority]}`, callback_data: 'pushover_toggle_priority' }],
        [{ text: `🔊 Звук: ${user.settings.pushover.sound}`, callback_data: 'pushover_change_sound' }],
        [{ text: '⬅️ Назад', callback_data: 'pushover_back' }]
      ]
    };

    const message = addressForms.formatForUser(
      `⚙️ *Настройки Pushover*\n\n` +
      `*Текущие параметры:*\n` +
      `• Приоритет: ${priorities[user.settings.pushover.priority]}\n` +
      `• Звук: ${user.settings.pushover.sound}\n\n` +
      `*Описание приоритетов:*\n` +
      Object.entries(priorities).map(([key, desc]) => `${key}: ${desc}`).join('\n'),
      user
    );

    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  togglePriority: async (bot, callbackQuery, user) => {
    const priorities = [-2, -1, 0, 1, 2];
    const currentIndex = priorities.indexOf(user.settings.pushover.priority);
    const nextIndex = (currentIndex + 1) % priorities.length;
    
    user.settings.pushover.priority = priorities[nextIndex];
    await user.save();

    await this.showPushoverSettings(bot, callbackQuery.message.chat.id, user);
  },

  showSoundSelection: async (bot, chatId, user) => {
    const pushoverService = new PushoverService();
    const sounds = pushoverService.getAvailableSounds();
    
    const keyboard = {
      inline_keyboard: sounds.slice(0, 6).map(sound => ([
        { text: sound, callback_data: `pushover_sound_${sound}` }
      ])).concat([
        [{ text: '⬅️ Назад', callback_data: 'pushover_settings' }]
      ])
    };

    bot.sendMessage(chatId, '🔊 Выбери звук для уведомлений:', {
      reply_markup: keyboard
    });
  }
};