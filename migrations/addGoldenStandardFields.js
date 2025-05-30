const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Миграция для добавления полей золотого стандарта к существующим пользователям
 */
class GoldenStandardMigration {
  constructor() {
    this.migrationName = 'addGoldenStandardFields';
    this.version = '1.0.0';
  }

  /**
   * Основная функция миграции
   */
  async migrate() {
    console.log(`🔄 Starting migration: ${this.migrationName}`);
    
    try {
      const stats = await this.addMissingFields();
      console.log(`✅ Migration completed successfully:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ Migration failed:`, error);
      throw error;
    }
  }

  /**
   * Добавление недостающих полей к пользователям
   */
  async addMissingFields() {
    const stats = {
      totalUsers: 0,
      usersUpdated: 0,
      usersSkipped: 0,
      errors: 0
    };

    // Получаем всех пользователей без новых полей
    const usersToUpdate = await User.find({
      $or: [
        { trainingStartDate: { $exists: false } },
        { currentTrainingDay: { $exists: false } },
        { averageDataQuality: { $exists: false } },
        { qualityHistory: { $exists: false } },
        { phenomenaFrequencies: { $exists: false } },
        { commonPatterns: { $exists: false } },
        { preferences: { $exists: false } },
        { achievements: { $exists: false } }
      ]
    });

    stats.totalUsers = usersToUpdate.length;
    console.log(`Found ${stats.totalUsers} users to update`);

    for (const user of usersToUpdate) {
      try {
        await this.updateUserFields(user);
        stats.usersUpdated++;
        
        if (stats.usersUpdated % 100 === 0) {
          console.log(`Progress: ${stats.usersUpdated}/${stats.totalUsers} users updated`);
        }
      } catch (error) {
        console.error(`Error updating user ${user.telegramId}:`, error);
        stats.errors++;
      }
    }

    stats.usersSkipped = stats.totalUsers - stats.usersUpdated - stats.errors;
    return stats;
  }

  /**
   * Обновление полей конкретного пользователя
   */
  async updateUserFields(user) {
    const updates = {};

    // Поля обучения
    if (!user.trainingStartDate) {
      updates.trainingStartDate = null;
    }
    
    if (!user.currentTrainingDay) {
      updates.currentTrainingDay = 0;
    }
    
    if (!user.trainingCompleted) {
      updates.trainingCompleted = false;
    }

    // Метрики качества
    if (!user.averageDataQuality) {
      updates.averageDataQuality = 0;
    }
    
    if (!user.qualityHistory) {
      updates.qualityHistory = [];
    }

    // Частоты феноменов
    if (!user.phenomenaFrequencies) {
      updates.phenomenaFrequencies = {
        innerSpeech: 0,
        innerSeeing: 0,
        unsymbolizedThinking: 0,
        feeling: 0,
        sensoryAwareness: 0
      };
    }

    // Паттерны пользователя
    if (!user.commonPatterns) {
      updates.commonPatterns = {
        usesInnerSpeech: null,
        tendencyToGeneralize: 0,
        introspectiveAccuracy: 0,
        preferredResponseLength: 0,
        readingVoiceIllusion: null,
        emotionAsThought: null,
        sensoryDetailRichness: 0,
        momentCaptureAbility: 0,
        emptinessRecognition: 0
      };
    }

    // Настройки персонализации
    if (!user.preferences) {
      updates.preferences = {
        receiveQualityFeedback: true,
        showExamples: true,
        adaptiveQuestions: true,
        trainingReminders: true,
        useAIValidation: true
      };
    }

    // Достижения
    if (!user.achievements) {
      updates.achievements = [];
    }

    // Применяем обновления если есть что обновлять
    if (Object.keys(updates).length > 0) {
      await User.updateOne(
        { _id: user._id },
        { $set: updates }
      );
    }
  }

  /**
   * Откат миграции (если потребуется)
   */
  async rollback() {
    console.log(`🔄 Rolling back migration: ${this.migrationName}`);
    
    try {
      const result = await User.updateMany(
        {},
        {
          $unset: {
            trainingStartDate: "",
            currentTrainingDay: "",
            trainingCompleted: "",
            averageDataQuality: "",
            qualityHistory: "",
            phenomenaFrequencies: "",
            commonPatterns: "",
            preferences: "",
            achievements: ""
          }
        }
      );

      console.log(`✅ Rollback completed. ${result.modifiedCount} users updated`);
      return result;
    } catch (error) {
      console.error(`❌ Rollback failed:`, error);
      throw error;
    }
  }

  /**
   * Проверка состояния миграции
   */
  async checkMigrationStatus() {
    const stats = {
      totalUsers: 0,
      migratedUsers: 0,
      pendingUsers: 0
    };

    stats.totalUsers = await User.countDocuments();
    
    stats.migratedUsers = await User.countDocuments({
      trainingStartDate: { $exists: true },
      currentTrainingDay: { $exists: true },
      averageDataQuality: { $exists: true },
      qualityHistory: { $exists: true },
      phenomenaFrequencies: { $exists: true },
      commonPatterns: { $exists: true },
      preferences: { $exists: true },
      achievements: { $exists: true }
    });

    stats.pendingUsers = stats.totalUsers - stats.migratedUsers;

    return stats;
  }
}

module.exports = GoldenStandardMigration;

// Запуск миграции если файл выполняется напрямую
if (require.main === module) {
  const mongoose = require('mongoose');
  
  async function runMigration() {
    try {
      // Подключение к базе данных
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mse-bot');
      console.log('Connected to MongoDB');

      const migration = new GoldenStandardMigration();
      
      // Проверяем текущее состояние
      const statusBefore = await migration.checkMigrationStatus();
      console.log('Migration status before:', statusBefore);
      
      // Запускаем миграцию
      const result = await migration.migrate();
      
      // Проверяем результат
      const statusAfter = await migration.checkMigrationStatus();
      console.log('Migration status after:', statusAfter);
      
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Migration script failed:', error);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  runMigration();
}