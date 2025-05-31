/**
 * Миграция для добавления настройки формы обращения к существующим пользователям
 * Устанавливает неформальное обращение ("ты") по умолчанию для всех пользователей
 */

const mongoose = require('mongoose');
const User = require('../models/User');

async function addAddressFormPreference() {
  try {
    console.log('🔄 Начинаем миграцию: добавление настройки формы обращения...');
    
    // Подключаемся к базе данных если не подключены
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mse-telegram-bot');
    }
    
    // Находим всех пользователей, у которых нет настройки addressForm
    const usersToUpdate = await User.find({
      $or: [
        { 'preferences.addressForm': { $exists: false } },
        { 'preferences.addressForm': null }
      ]
    });
    
    console.log(`📊 Найдено пользователей для обновления: ${usersToUpdate.length}`);
    
    if (usersToUpdate.length === 0) {
      console.log('✅ Все пользователи уже имеют настройку формы обращения');
      return;
    }
    
    // Обновляем пользователей пакетно
    const updateResult = await User.updateMany(
      {
        $or: [
          { 'preferences.addressForm': { $exists: false } },
          { 'preferences.addressForm': null }
        ]
      },
      {
        $set: {
          'preferences.addressForm': 'informal'
        }
      }
    );
    
    console.log(`✅ Обновлено пользователей: ${updateResult.modifiedCount}`);
    
    // Проверяем результат
    const updatedUsers = await User.find({
      'preferences.addressForm': 'informal'
    }).countDocuments();
    
    console.log(`📈 Общее количество пользователей с неформальным обращением: ${updatedUsers}`);
    
    console.log('🎉 Миграция успешно завершена!');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    throw error;
  }
}

// Функция для отката миграции (если потребуется)
async function rollbackAddressFormPreference() {
  try {
    console.log('🔄 Начинаем откат миграции: удаление настройки формы обращения...');
    
    const updateResult = await User.updateMany(
      {},
      {
        $unset: {
          'preferences.addressForm': ''
        }
      }
    );
    
    console.log(`✅ Удалена настройка у пользователей: ${updateResult.modifiedCount}`);
    console.log('🎉 Откат миграции успешно завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при откате миграции:', error);
    throw error;
  }
}

// Если файл запускается напрямую
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackAddressFormPreference()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    addAddressFormPreference()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = {
  addAddressFormPreference,
  rollbackAddressFormPreference
};
