/**
 * Тестовый файл для проверки функциональности форм обращения
 */

const addressForms = require('./utils/addressForms');

// Тестовые сообщения
const testMessages = [
  'Привет! Как ты себя чувствуешь?',
  'Что ты делаешь сейчас?',
  'Опиши твои мысли в этот момент',
  'Твоя статистика показывает хорошие результаты',
  'Ты можешь попробовать ещё раз',
  'Если ты хочешь, можешь изменить настройки',
  'Твои данные сохранены успешно',
  'Продолжай в том же духе!',
  'Ты делаешь отличную работу',
  'Помни: описывай только то, что было в момент сигнала'
];

// Тестовые пользователи
const testUsers = [
  { preferences: { addressForm: 'informal' } },
  { preferences: { addressForm: 'formal' } },
  { preferences: {} }, // Пользователь без настройки
  null // Пользователь не найден
];

console.log('🧪 Тестирование системы форм обращения\n');

console.log('📝 Тестовые сообщения:');
testMessages.forEach((msg, index) => {
  console.log(`${index + 1}. ${msg}`);
});

console.log('\n🔄 Тестирование преобразований:\n');

testUsers.forEach((user, userIndex) => {
  const userType = user?.preferences?.addressForm || 'default/null';
  console.log(`👤 Пользователь ${userIndex + 1} (${userType}):`);
  
  testMessages.slice(0, 3).forEach((message, msgIndex) => {
    const formatted = addressForms.formatForUser(message, user);
    console.log(`  ${msgIndex + 1}. "${formatted}"`);
  });
  
  console.log('');
});

console.log('🔧 Тестирование прямых преобразований:\n');

// Тест преобразования в формальное
console.log('📤 Неформальное → Формальное:');
testMessages.slice(0, 5).forEach((message, index) => {
  const formal = addressForms.convertToFormal(message);
  console.log(`${index + 1}. "${message}" → "${formal}"`);
});

console.log('\n📥 Формальное → Неформальное:');
const formalMessages = [
  'Как Вы себя чувствуете?',
  'Что Вы делаете сейчас?',
  'Опишите Ваши мысли',
  'Ваша статистика показывает результаты',
  'Вы можете попробовать ещё раз'
];

formalMessages.forEach((message, index) => {
  const informal = addressForms.convertToInformal(message);
  console.log(`${index + 1}. "${message}" → "${informal}"`);
});

console.log('\n✅ Тестирование завершено!');

// Экспорт для использования в других тестах
module.exports = {
  testMessages,
  testUsers,
  runTests: () => {
    console.log('Запуск автоматических тестов...');
    
    // Тест 1: Проверка неформального по умолчанию
    const defaultUser = { preferences: {} };
    const result1 = addressForms.formatForUser('Как ты дела?', defaultUser);
    console.assert(result1 === 'Как ты дела?', 'Тест 1 провален: неформальное по умолчанию');
    
    // Тест 2: Проверка формального преобразования
    const formalUser = { preferences: { addressForm: 'formal' } };
    const result2 = addressForms.formatForUser('Как ты дела?', formalUser);
    console.assert(result2.includes('Вы'), 'Тест 2 провален: формальное преобразование');
    
    // Тест 3: Проверка null пользователя
    const result3 = addressForms.formatForUser('Как ты дела?', null);
    console.assert(result3 === 'Как ты дела?', 'Тест 3 провален: null пользователь');
    
    console.log('✅ Все автоматические тесты пройдены!');
  }
};
