const User = require('../models/User');

const settingsStates = new Map();

module.exports = {
  command: 'settings',
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
      let user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала используйте команду /start для регистрации.');
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: `🔔 Уведомления: ${user.settings.notificationsEnabled ? 'Вкл' : 'Выкл'}`, callback_data: 'settings_toggle_notifications' }],
          [{ text: `📅 Количество в день: ${user.settings.notificationsPerDay}`, callback_data: 'settings_notifications_count' }],
          [{ text: `⏰ Время начала: ${user.settings.notificationStartTime}`, callback_data: 'settings_start_time' }],
          [{ text: `⏰ Время окончания: ${user.settings.notificationEndTime}`, callback_data: 'settings_end_time' }],
          [{ text: `🌍 Часовой пояс: ${user.settings.timezone}`, callback_data: 'settings_timezone' }],
          [{ text: '❌ Закрыть', callback_data: 'settings_close' }]
        ]
      };

      const message = `⚙️ *Настройки уведомлений*\n\n` +
        `Текущие параметры:\n` +
        `• Уведомления: ${user.settings.notificationsEnabled ? 'Включены' : 'Выключены'}\n` +
        `• Количество в день: ${user.settings.notificationsPerDay}\n` +
        `• Время: ${user.settings.notificationStartTime} - ${user.settings.notificationEndTime}\n` +
        `• Часовой пояс: ${user.settings.timezone}\n\n` +
        `Выберите параметр для изменения:`;

      bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Settings error:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при загрузке настроек.');
    }
  },

  handleCallback: async (bot, query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    try {
      let user = await User.findOne({ telegramId: userId });
      if (!user) return;

      if (data === 'settings_toggle_notifications') {
        user.settings.notificationsEnabled = !user.settings.notificationsEnabled;
        await user.save();
        
        await bot.answerCallbackQuery(query.id, {
          text: `Уведомления ${user.settings.notificationsEnabled ? 'включены' : 'выключены'}`
        });
        
        // Refresh settings menu
        module.exports.execute(bot, query.message);
        
      } else if (data === 'settings_notifications_count') {
        const keyboard = {
          inline_keyboard: []
        };
        
        for (let i = 1; i <= 10; i++) {
          if (i % 5 === 1) keyboard.inline_keyboard.push([]);
          keyboard.inline_keyboard[keyboard.inline_keyboard.length - 1].push({
            text: i.toString(),
            callback_data: `settings_set_count_${i}`
          });
        }
        keyboard.inline_keyboard.push([{ text: '⬅️ Назад', callback_data: 'settings_back' }]);
        
        await bot.editMessageText('Выберите количество уведомлений в день:', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: keyboard
        });
        
      } else if (data.startsWith('settings_set_count_')) {
        const count = parseInt(data.replace('settings_set_count_', ''));
        user.settings.notificationsPerDay = count;
        await user.save();
        
        await bot.answerCallbackQuery(query.id, {
          text: `Установлено ${count} уведомлений в день`
        });
        
        // Refresh settings menu
        module.exports.execute(bot, query.message);
        
      } else if (data === 'settings_start_time') {
        settingsStates.set(userId, { type: 'start_time' });
        
        await bot.editMessageText(
          'Введите время начала уведомлений в формате ЧЧ:ММ (например, 09:00):', 
          {
            chat_id: chatId,
            message_id: query.message.message_id
          }
        );
        
      } else if (data === 'settings_end_time') {
        settingsStates.set(userId, { type: 'end_time' });
        
        await bot.editMessageText(
          'Введите время окончания уведомлений в формате ЧЧ:ММ (например, 21:00):', 
          {
            chat_id: chatId,
            message_id: query.message.message_id
          }
        );
        
      } else if (data === 'settings_timezone') {
        const keyboard = {
          inline_keyboard: [
            [{ text: 'UTC', callback_data: 'settings_tz_UTC' }],
            [{ text: 'Europe/Moscow', callback_data: 'settings_tz_Europe/Moscow' }],
            [{ text: 'Europe/London', callback_data: 'settings_tz_Europe/London' }],
            [{ text: 'Europe/Berlin', callback_data: 'settings_tz_Europe/Berlin' }],
            [{ text: 'America/New_York', callback_data: 'settings_tz_America/New_York' }],
            [{ text: 'America/Los_Angeles', callback_data: 'settings_tz_America/Los_Angeles' }],
            [{ text: 'Asia/Tokyo', callback_data: 'settings_tz_Asia/Tokyo' }],
            [{ text: 'Asia/Shanghai', callback_data: 'settings_tz_Asia/Shanghai' }],
            [{ text: '⬅️ Назад', callback_data: 'settings_back' }]
          ]
        };
        
        await bot.editMessageText('Выберите часовой пояс:', {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: keyboard
        });
        
      } else if (data.startsWith('settings_tz_')) {
        const timezone = data.replace('settings_tz_', '');
        user.settings.timezone = timezone;
        await user.save();
        
        await bot.answerCallbackQuery(query.id, {
          text: `Часовой пояс установлен: ${timezone}`
        });
        
        // Refresh settings menu
        module.exports.execute(bot, query.message);
        
      } else if (data === 'settings_back') {
        // Refresh settings menu
        module.exports.execute(bot, query.message);
        
      } else if (data === 'settings_close') {
        await bot.deleteMessage(chatId, query.message.message_id);
        await bot.answerCallbackQuery(query.id);
      }
      
    } catch (error) {
      console.error('Settings callback error:', error);
      await bot.answerCallbackQuery(query.id, {
        text: 'Произошла ошибка'
      });
    }
  },

  handleTextResponse: async (bot, msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!settingsStates.has(userId)) return false;

    const state = settingsStates.get(userId);
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

    if (!timeRegex.test(text)) {
      bot.sendMessage(chatId, 'Неверный формат времени. Используйте формат ЧЧ:ММ (например, 09:00)');
      return true;
    }

    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user) return false;

      if (state.type === 'start_time') {
        user.settings.notificationStartTime = text;
      } else if (state.type === 'end_time') {
        user.settings.notificationEndTime = text;
      }

      await user.save();
      settingsStates.delete(userId);

      bot.sendMessage(chatId, `✅ Время ${state.type === 'start_time' ? 'начала' : 'окончания'} уведомлений установлено: ${text}`);
      
      // Show settings menu again
      setTimeout(() => {
        module.exports.execute(bot, msg);
      }, 1000);

      return true;
    } catch (error) {
      console.error('Settings text response error:', error);
      bot.sendMessage(chatId, 'Произошла ошибка при сохранении настроек.');
      return true;
    }
  },

  settingsStates
};