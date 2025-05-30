#!/usr/bin/env node

/**
 * Скрипт проверки здоровья системы ESM бота
 * Проверяет валидаторы, модели, конфигурацию и производительность
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Response = require('../models/Response');
const TrainingProgress = require('../models/TrainingProgress');
const config = require('../config/hurlburt');
const aiValidator = require('../services/ai-validator-service');
const goldenStandard = require('../validators/goldenStandard');
const MomentValidator = require('../validators/momentValidator');
const momentValidator = new MomentValidator();
const { metrics, getMetrics } = require('../utils/metrics');

class HealthChecker {
  constructor() {
    this.results = {
      overall: 'healthy',
      timestamp: new Date(),
      checks: {},
      warnings: [],
      errors: [],
      recommendations: []
    };
  }

  /**
   * Запуск полной проверки
   */
  async runHealthCheck() {
    console.log('🏥 ESM Bot Health Check Started...\n');

    try {
      // 1. Проверка подключения к базе данных
      await this.checkDatabase();

      // 2. Проверка моделей данных
      await this.checkModels();

      // 3. Проверка валидаторов
      await this.checkValidators();

      // 4. Проверка AI сервисов
      await this.checkAIServices();

      // 5. Проверка конфигурации
      await this.checkConfiguration();

      // 6. Проверка производительности
      await this.checkPerformance();

      // 7. Проверка метрик
      await this.checkMetrics();

      // Определяем общее состояние
      this.determineOverallHealth();

      // Выводим результаты
      this.printResults();

      return this.results;
    } catch (error) {
      this.results.overall = 'critical';
      this.results.errors.push(`Health check failed: ${error.message}`);
      console.error('❌ Health check failed:', error);
      return this.results;
    }
  }

  /**
   * Проверка подключения к базе данных
   */
  async checkDatabase() {
    console.log('📊 Checking database connection...');
    
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mse-bot');
      }

      // Проверяем, что можем выполнять операции
      const userCount = await User.countDocuments();
      const responseCount = await Response.countDocuments();

      this.results.checks.database = {
        status: 'healthy',
        connection: 'connected',
        userCount,
        responseCount,
        responseTime: await this.measureDatabaseResponseTime()
      };

      console.log(`✅ Database: ${userCount} users, ${responseCount} responses`);
    } catch (error) {
      this.results.checks.database = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Database connection failed: ${error.message}`);
      console.log('❌ Database connection failed');
    }
  }

  /**
   * Проверка моделей данных
   */
  async checkModels() {
    console.log('📋 Checking data models...');

    try {
      // Проверяем схемы моделей
      const userSchema = User.schema;
      const responseSchema = Response.schema;
      const trainingSchema = TrainingProgress.schema;

      // Проверяем наличие ключевых полей
      const userFields = Object.keys(userSchema.paths);
      const responseFields = Object.keys(responseSchema.paths);
      const trainingFields = Object.keys(trainingSchema.paths);

      const requiredUserFields = [
        'telegramId', 'trainingStartDate', 'currentTrainingDay',
        'averageDataQuality', 'qualityHistory', 'phenomenaFrequencies',
        'commonPatterns', 'preferences', 'achievements'
      ];

      const missingUserFields = requiredUserFields.filter(field => !userFields.includes(field));

      if (missingUserFields.length > 0) {
        this.results.warnings.push(`Missing user fields: ${missingUserFields.join(', ')}`);
        this.results.recommendations.push('Run user migration: node migrations/addGoldenStandardFields.js');
      }

      this.results.checks.models = {
        status: missingUserFields.length === 0 ? 'healthy' : 'warning',
        userFields: userFields.length,
        responseFields: responseFields.length,
        trainingFields: trainingFields.length,
        missingUserFields
      };

      console.log(`✅ Models: User(${userFields.length}), Response(${responseFields.length}), Training(${trainingFields.length})`);
    } catch (error) {
      this.results.checks.models = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Model check failed: ${error.message}`);
      console.log('❌ Model check failed');
    }
  }

  /**
   * Проверка валидаторов
   */
  async checkValidators() {
    console.log('🔍 Checking validators...');

    try {
      // Тестовые данные
      const testResponses = [
        'Смотрел на курсор после слова "проект". В животе лёгкое напряжение.',
        'Обычно я всегда работаю хорошо',
        'Читал книгу, проговаривая внутренним голосом каждое слово'
      ];

      const validatorResults = {
        momentValidator: [],
        goldenStandard: []
      };

      // Тестируем momentValidator
      for (const response of testResponses) {
        const result = momentValidator.validate(response, 'pristine', { trainingDay: 1 });
        validatorResults.momentValidator.push({
          text: response.substring(0, 30) + '...',
          score: result.score,
          valid: result.valid
        });
      }

      // Тестируем goldenStandard
      for (const response of testResponses) {
        const baseValidation = momentValidator.validate(response);
        const enhanced = goldenStandard.enhance(baseValidation, response, { trainingDay: 1 });
        validatorResults.goldenStandard.push({
          text: response.substring(0, 30) + '...',
          score: enhanced.score,
          quality: enhanced.quality
        });
      }

      this.results.checks.validators = {
        status: 'healthy',
        momentValidator: validatorResults.momentValidator,
        goldenStandard: validatorResults.goldenStandard,
        averageBaseScore: validatorResults.momentValidator.reduce((acc, r) => acc + r.score, 0) / testResponses.length,
        averageEnhancedScore: validatorResults.goldenStandard.reduce((acc, r) => acc + r.score, 0) / testResponses.length
      };

      console.log('✅ Validators: Working correctly');
    } catch (error) {
      this.results.checks.validators = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Validator check failed: ${error.message}`);
      console.log('❌ Validator check failed');
    }
  }

  /**
   * Проверка AI сервисов
   */
  async checkAIServices() {
    console.log('🤖 Checking AI services...');

    try {
      const aiStats = aiValidator.getUsageStats();
      const hasApiKeys = !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

      let aiStatus = 'healthy';
      if (!hasApiKeys) {
        aiStatus = 'warning';
        this.results.warnings.push('No AI API keys configured - using local validation only');
      }

      // Быстрый тест валидации
      let validationTest = null;
      try {
        validationTest = await aiValidator.validate(
          'Тестовый ответ для проверки системы',
          { userId: 'health-check', trainingDay: 1, timeout: 30000 }
        );
      } catch (error) {
        this.results.warnings.push(`AI validation test failed: ${error.message}`);
      }

      this.results.checks.aiServices = {
        status: aiStatus,
        provider: aiStats.provider,
        isConfigured: aiStats.isConfigured,
        cacheSize: aiStats.cacheSize,
        rateLimitEntries: aiStats.rateLimitEntries,
        hasApiKeys,
        validationTest: validationTest ? 'passed' : 'failed'
      };

      console.log(`✅ AI Services: ${aiStats.provider} (${aiStats.isConfigured ? 'configured' : 'local only'})`);
    } catch (error) {
      this.results.checks.aiServices = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`AI services check failed: ${error.message}`);
      console.log('❌ AI services check failed');
    }
  }

  /**
   * Проверка конфигурации
   */
  async checkConfiguration() {
    console.log('⚙️ Checking configuration...');

    try {
      const configCheck = {
        hasHurlburtConfig: !!config,
        hasValidationConfig: !!(config.validation),
        hasAIConfig: !!(config.ai),
        hasPhenomenaConfig: !!(config.phenomena),
        hasTrainingConfig: !!(config.training),
        validationEnabled: config.validation?.useGoldenStandard || false,
        aiEnabled: config.ai?.enableSmartValidation || false
      };

      let configStatus = 'healthy';
      if (!configCheck.hasValidationConfig) {
        configStatus = 'warning';
        this.results.warnings.push('Validation configuration missing');
      }

      this.results.checks.configuration = {
        status: configStatus,
        ...configCheck
      };

      console.log(`✅ Configuration: ${Object.values(configCheck).filter(Boolean).length}/${Object.keys(configCheck).length} checks passed`);
    } catch (error) {
      this.results.checks.configuration = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Configuration check failed: ${error.message}`);
      console.log('❌ Configuration check failed');
    }
  }

  /**
   * Проверка производительности
   */
  async checkPerformance() {
    console.log('⚡ Checking performance...');

    try {
      const startTime = Date.now();
      
      // Тестируем производительность валидации
      const validationStartTime = Date.now();
      const testValidation = momentValidator.validate(
        'Смотрел на экран, курсор мигал после слова "тест"', 
        'pristine'
      );
      const validationTime = Date.now() - validationStartTime;

      // Тестируем производительность обращения к БД
      const dbStartTime = Date.now();
      await User.findOne().limit(1);
      const dbTime = Date.now() - dbStartTime;

      const totalTime = Date.now() - startTime;

      const performanceCheck = {
        validationTime,
        databaseTime: dbTime,
        totalCheckTime: totalTime,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      };

      let performanceStatus = 'healthy';
      if (validationTime > 1000) {
        performanceStatus = 'warning';
        this.results.warnings.push('Validation is slow (>1s)');
      }
      if (dbTime > 500) {
        performanceStatus = 'warning';
        this.results.warnings.push('Database queries are slow (>500ms)');
      }

      this.results.checks.performance = {
        status: performanceStatus,
        ...performanceCheck
      };

      console.log(`✅ Performance: Validation ${validationTime}ms, DB ${dbTime}ms`);
    } catch (error) {
      this.results.checks.performance = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Performance check failed: ${error.message}`);
      console.log('❌ Performance check failed');
    }
  }

  /**
   * Проверка метрик
   */
  async checkMetrics() {
    console.log('📈 Checking metrics...');

    try {
      const currentMetrics = getMetrics();
      
      this.results.checks.metrics = {
        status: 'healthy',
        validationRequests: currentMetrics.validationRequests,
        averageResponseQuality: currentMetrics.computed.averageResponseQuality,
        cacheHitRate: currentMetrics.computed.cacheHitRate,
        trainingCompletions: currentMetrics.trainingCompletions,
        totalResponses: currentMetrics.totalResponses
      };

      console.log(`✅ Metrics: ${currentMetrics.validationRequests} validations, ${currentMetrics.computed.averageResponseQuality} avg quality`);
    } catch (error) {
      this.results.checks.metrics = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Metrics check failed: ${error.message}`);
      console.log('❌ Metrics check failed');
    }
  }

  /**
   * Измерение времени отклика БД
   */
  async measureDatabaseResponseTime() {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
  }

  /**
   * Определение общего состояния здоровья
   */
  determineOverallHealth() {
    const checks = Object.values(this.results.checks);
    const errorCount = checks.filter(check => check.status === 'error').length;
    const warningCount = checks.filter(check => check.status === 'warning').length;

    if (errorCount > 0) {
      this.results.overall = 'critical';
    } else if (warningCount > 2) {
      this.results.overall = 'degraded';
    } else if (warningCount > 0) {
      this.results.overall = 'warning';
    } else {
      this.results.overall = 'healthy';
    }
  }

  /**
   * Вывод результатов
   */
  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('🏥 HEALTH CHECK RESULTS');
    console.log('='.repeat(50));

    // Общее состояние
    const statusEmojis = {
      healthy: '✅',
      warning: '⚠️',
      degraded: '🟡',
      critical: '❌'
    };

    console.log(`\nOverall Status: ${statusEmojis[this.results.overall]} ${this.results.overall.toUpperCase()}\n`);

    // Детали по каждому компоненту
    Object.entries(this.results.checks).forEach(([component, check]) => {
      const emoji = statusEmojis[check.status] || '❓';
      console.log(`${emoji} ${component}: ${check.status}`);
    });

    // Предупреждения
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.results.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }

    // Ошибки
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.results.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    // Рекомендации
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(50));
  }
}

// Запуск проверки если файл выполняется напрямую
if (require.main === module) {
  const checker = new HealthChecker();
  
  checker.runHealthCheck()
    .then(results => {
      const exitCode = results.overall === 'critical' ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Health check script failed:', error);
      process.exit(1);
    });
}

module.exports = HealthChecker;