module.exports = {
  command: 'help',
  description: 'Show available commands',
  execute: (bot, msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `📚 <b>Доступные команды:</b>\n\n` +
      `🚀 <b>Основные:</b>\n` +
      `/start - Регистрация в боте\n` +
      `/survey - Начать опрос\n` +
      `/stats - Ваша статистика\n` +
      `/settings - Настройки уведомлений\n\n` +
      `🎮 <b>Геймификация:</b>\n` +
      `/achievements - Ваши достижения и прогресс\n` +
      `/leaderboard - Рейтинги участников (анонимно)\n\n` +
      `ℹ️ <b>Дополнительные:</b>\n` +
      `/help - Это сообщение\n` +
      `/info - Информация о боте\n` +
      `/echo [текст] - Повторить сообщение\n` +
      `/export - Экспорт ваших данных\n\n` +
      `💡 <b>Подсказка:</b> Используйте кнопки клавиатуры для быстрого доступа!`;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
  }
};