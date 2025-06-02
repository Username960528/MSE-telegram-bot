module.exports = {
  command: 'info',
  description: 'Show bot information',
  execute: (bot, msg) => {
    const chatId = msg.chat.id;
    
    const infoMessage = `📊 <b>MSE Telegram Bot</b>\n\n` +
      `<b>Experience Sampling Method</b> — это научный метод исследования моментального опыта.\n\n` +
      `<b>Как работает:</b>\n` +
      `• Получаешь случайные уведомления в течение дня\n` +
      `• Описываешь свой опыт в МОМЕНТ сигнала\n` +
      `• Накапливаешь данные о своих состояниях\n\n` +
      `<b>Ключевые принципы:</b>\n` +
      `• Фокус на текущем моменте (не обобщения)\n` +
      `• Регулярность ответов критически важна\n` +
      `• Детализация сенсорного опыта\n\n` +
      `<b>💡 Совет:</b> Настрой уведомления на часы (/pushover) для максимальной эффективности!\n\n` +
      `<i>Версия: 2.0.0 с AI-аналитикой</i>`;
    
    bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
  }
};