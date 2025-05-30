/**
 * Пример итеративной обратной связи после опроса
 * 
 * Показывает, как бот анализирует паттерны и даёт персональную обратную связь
 */

// Пример данных пользователя (последние 10 ответов)
const exampleResponses = [
  {
    responses: { mood: 3, stress: 7, energy: 4, currentActivity: "работаю над проектом" },
    metadata: { flowState: "anxiety", phenomenaDetected: [{ type: "innerSpeech" }] }
  },
  {
    responses: { mood: 4, stress: 6, energy: 5, currentActivity: "читаю документацию" },
    metadata: { flowState: "worry", phenomenaDetected: [{ type: "innerSpeech" }] }
  },
  {
    responses: { mood: 6, stress: 3, energy: 6, currentActivity: "пишу код" },
    metadata: { flowState: "flow", phenomenaDetected: [{ type: "unsymbolizedThinking" }] }
  },
  {
    responses: { mood: 2, stress: 8, energy: 3, currentActivity: "на встрече с клиентом" },
    metadata: { flowState: "anxiety", phenomenaDetected: [{ type: "feeling" }] }
  },
  {
    responses: { mood: 5, stress: 4, energy: 5, currentActivity: "планирую задачи" },
    metadata: { flowState: "control", phenomenaDetected: [{ type: "innerSeeing" }] }
  }
];

// Результат анализа
const exampleFeedback = `
🔍 Ваши паттерны:
📋 Вы часто испытываете высокий стресс (60% времени)
📋 Это часто происходит при: "работе"
💭 У вас часто наблюдается: внутренняя речь
⚡ Вы иногда входите в состояние потока (20%)

❓ Это отражает ваш реальный опыт?
`;

console.log('Пример итеративной обратной связи:');
console.log(exampleFeedback);

// Пример полного сообщения после опроса
const fullMessage = `
✅ Спасибо за участие!

📊 Основные вопросы: 9 из 9
🔍 Дополнительные уточнения: 3
⏱ Время заполнения: 180 секунд
📈 Качество данных: 85%

🎓 Обучение завершено! Ваши данные теперь максимально точны.
🌟 Превосходное качество наблюдений!
😰 Задача была сложновата

🔍 Ваши паттерны:
📋 Вы часто испытываете высокий стресс (60% времени)
📋 Это часто происходит при: "работе"
💭 У вас часто наблюдается: внутренняя речь
⚡ Вы иногда входите в состояние потока (20%)

❓ Это отражает ваш реальный опыт?

🔬 Интересный факт: Только 3% моментов чтения включают внутренний голос

Используйте /stats для просмотра вашей статистики.
`;

console.log('\nПример полного сообщения:');
console.log(fullMessage);

module.exports = { exampleResponses, exampleFeedback, fullMessage };