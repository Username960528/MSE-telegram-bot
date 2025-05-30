const User = require('../models/User');
const DataExporter = require('../services/dataExporter');
const fs = require('fs');

module.exports = {
  command: 'export',
  description: 'Export your data for research',
  
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    
    try {
      // Проверяем пользователя
      const user = await User.findOne({ telegramId });
      if (!user) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь с помощью команды /start');
        return;
      }
      
      // Показываем опции экспорта
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 JSON (полные данные)', callback_data: 'export_json' },
              { text: '📈 CSV (таблица)', callback_data: 'export_csv' }
            ],
            [
              { text: '🔬 SPSS (для исследований)', callback_data: 'export_spss' }
            ],
            [
              { text: '❌ Отмена', callback_data: 'export_cancel' }
            ]
          ]
        }
      };
      
      await bot.sendMessage(
        chatId,
        '📤 Экспорт данных\\n\\n' +
        'Выберите формат для экспорта ваших данных:\\n\\n' +
        '• **JSON** - полные данные в структурированном формате\\n' +
        '• **CSV** - таблица для Excel/Google Sheets\\n' +
        '• **SPSS** - формат для статистического анализа\\n\\n' +
        '_Ваши данные будут анонимизированы_',
        { 
          parse_mode: 'Markdown',
          ...keyboard 
        }
      );
      
    } catch (error) {
      console.error('Export command error:', error);
      bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
  },
  
  handleCallback: async (bot, query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;
    
    if (!data.startsWith('export_')) return;
    
    await bot.answerCallbackQuery(query.id);
    
    if (data === 'export_cancel') {
      await bot.editMessageText(
        '❌ Экспорт отменён',
        { chat_id: chatId, message_id: query.message.message_id }
      );
      return;
    }
    
    // Получаем формат
    const format = data.replace('export_', '');
    
    try {
      // Находим пользователя
      const user = await User.findOne({ telegramId });
      if (!user) {
        await bot.editMessageText(
          'Ошибка: пользователь не найден',
          { chat_id: chatId, message_id: query.message.message_id }
        );
        return;
      }
      
      // Обновляем сообщение
      await bot.editMessageText(
        `⏳ Экспортирую данные в формате ${format.toUpperCase()}...`,
        { chat_id: chatId, message_id: query.message.message_id }
      );
      
      // Экспортируем данные
      const exporter = new DataExporter();
      const result = await exporter.exportUserData(user._id, format, {
        includeTraining: false,
        anonymize: true
      });
      
      if (!result.success) {
        await bot.sendMessage(chatId, `❌ Ошибка экспорта: ${result.error}`);
        return;
      }
      
      // Отправляем файл(ы)
      if (format === 'spss') {
        // SPSS возвращает два файла
        await bot.sendDocument(chatId, result.filePath.dataFile, {
          caption: '📊 Данные в формате SPSS'
        });
        await bot.sendDocument(chatId, result.filePath.syntaxFile, {
          caption: '📝 Синтаксис SPSS для импорта'
        });
      } else {
        // Отправляем файл
        await bot.sendDocument(chatId, result.filePath, {
          caption: this.getExportCaption(format, result.statistics)
        });
      }
      
      // Удаляем временные файлы
      setTimeout(() => {
        if (format === 'spss') {
          fs.unlinkSync(result.filePath.dataFile);
          fs.unlinkSync(result.filePath.syntaxFile);
        } else {
          fs.unlinkSync(result.filePath);
        }
      }, 60000); // Удаляем через минуту
      
    } catch (error) {
      console.error('Export error:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при экспорте данных.');
    }
  },
  
  getExportCaption(format, stats) {
    let caption = `✅ Экспорт завершён!\\n\\n`;
    caption += `📊 Статистика:\\n`;
    caption += `• Всего записей: ${stats.totalResponses}\\n`;
    caption += `• Средняя точность: ${stats.averageQuality}%\\n`;
    caption += `• Flow состояния: ${stats.flowPercentage}%\\n`;
    
    if (stats.dateRange.from && stats.dateRange.to) {
      const from = new Date(stats.dateRange.from).toLocaleDateString('ru-RU');
      const to = new Date(stats.dateRange.to).toLocaleDateString('ru-RU');
      caption += `• Период: ${from} - ${to}\\n`;
    }
    
    caption += `\\n_Данные анонимизированы и готовы для исследований_`;
    
    return caption;
  }
};