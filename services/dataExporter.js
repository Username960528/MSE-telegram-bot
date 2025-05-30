const fs = require('fs').promises;
const path = require('path');
const Response = require('../models/Response');
const User = require('../models/User');
const PatternDetector = require('../helpers/patternDetector');
const config = require('../config/hurlburt');

/**
 * Сервис экспорта данных для исследований
 * 
 * Поддерживает экспорт в форматах:
 * - JSON (полные данные)
 * - CSV (табличный формат)
 * - SPSS (формат для статистического анализа)
 */
class DataExporter {
  constructor() {
    this.patternDetector = new PatternDetector();
  }

  /**
   * Экспорт данных пользователя
   * @param {String} userId - ID пользователя
   * @param {String} format - Формат экспорта (json, csv, spss)
   * @param {Object} options - Дополнительные опции
   * @returns {Object} - Путь к файлу и статистика
   */
  async exportUserData(userId, format = 'json', options = {}) {
    const {
      startDate = null,
      endDate = null,
      includeTraining = false,
      anonymize = true
    } = options;

    try {
      // Получаем данные пользователя
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Формируем запрос
      const query = { userId };
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }
      if (!includeTraining) {
        query['metadata.isTraining'] = { $ne: true };
      }

      // Получаем ответы
      const responses = await Response.find(query)
        .sort({ timestamp: 1 });

      // Анализируем паттерны
      const patterns = this.patternDetector.analyzeUserPatterns(responses);

      // Подготавливаем данные
      const exportData = this.prepareExportData(responses, user, patterns, anonymize);

      // Экспортируем в нужном формате
      let filePath;
      switch (format.toLowerCase()) {
        case 'csv':
          filePath = await this.exportToCSV(exportData, userId);
          break;
        case 'spss':
          filePath = await this.exportToSPSS(exportData, userId);
          break;
        case 'json':
        default:
          filePath = await this.exportToJSON(exportData, userId);
      }

      return {
        success: true,
        filePath,
        statistics: {
          totalResponses: responses.length,
          dateRange: {
            from: responses[0]?.timestamp,
            to: responses[responses.length - 1]?.timestamp
          },
          averageQuality: this.calculateAverageQuality(responses),
          flowPercentage: this.calculateFlowPercentage(responses)
        }
      };

    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Подготовка данных для экспорта
   */
  prepareExportData(responses, user, patterns, anonymize) {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        datasetVersion: '2.0',
        methodVersion: 'Hurlburt_DES_Enhanced',
        totalRecords: responses.length
      },
      participant: anonymize ? {
        id: this.hashUserId(user._id.toString()),
        registrationDate: user.createdAt,
        timezone: user.timezone || 'UTC'
      } : {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        registrationDate: user.createdAt
      },
      patterns: this.patternDetector.exportForResearch(patterns, user._id),
      responses: responses.map(r => this.formatResponseForExport(r, anonymize))
    };

    return exportData;
  }

  /**
   * Форматирование отдельного ответа для экспорта
   */
  formatResponseForExport(response, anonymize) {
    const formatted = {
      // Временные метки
      timestamp: response.timestamp,
      responseTime: response.metadata?.responseTime,
      
      // Основные шкалы
      mood: response.responses.mood,
      energy: response.responses.energy,
      stress: response.responses.stress,
      focus: response.responses.focus,
      
      // Flow данные
      challenge: response.metadata?.challenge,
      skill: response.metadata?.skill,
      concentration: response.metadata?.concentration,
      flowState: response.metadata?.flowState,
      
      // Качество данных
      dataQuality: response.metadata?.dataQualityScore,
      trainingDay: response.metadata?.trainingDay,
      isTraining: response.metadata?.isTraining,
      
      // Феномены
      phenomena: response.metadata?.phenomenaDetected?.map(p => p.type).join(',') || '',
      phenomenaCount: response.metadata?.phenomenaDetected?.length || 0,
      
      // Валидация
      validationAttempts: response.metadata?.validationAttempts ? 
        Object.values(response.metadata.validationAttempts).reduce((a, b) => a + b, 0) : 0,
      
      // Follow-up
      hasFollowUp: response.metadata?.followUpAnswers?.length > 0,
      followUpCount: response.metadata?.followUpAnswers?.length || 0
    };

    // Добавляем текстовые данные (анонимизированные если нужно)
    if (!anonymize) {
      formatted.currentThoughts = response.responses.currentThoughts;
      formatted.currentActivity = response.responses.currentActivity;
      formatted.currentCompanion = response.metadata?.currentCompanion;
    } else {
      // Для анонимизации сохраняем только характеристики текста
      formatted.thoughtsLength = response.responses.currentThoughts?.length || 0;
      formatted.thoughtsWords = response.responses.currentThoughts?.split(/\s+/).length || 0;
      formatted.activityLength = response.responses.currentActivity?.length || 0;
      formatted.hasSensoryDetails = this.hasSensoryDetails(response.responses.currentThoughts);
      formatted.hasInnerSpeech = this.hasInnerSpeech(response.responses.currentThoughts);
    }

    return formatted;
  }

  /**
   * Экспорт в JSON
   */
  async exportToJSON(data, userId) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `hurlburt_export_${this.hashUserId(userId)}_${timestamp}.json`;
    const filePath = path.join(__dirname, '..', 'exports', filename);

    // Создаём директорию если не существует
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Сохраняем файл
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));

    return filePath;
  }

  /**
   * Экспорт в CSV
   */
  async exportToCSV(data, userId) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `hurlburt_export_${this.hashUserId(userId)}_${timestamp}.csv`;
    const filePath = path.join(__dirname, '..', 'exports', filename);

    // Создаём директорию
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Подготавливаем CSV данные
    const csvData = this.convertToCSV(data.responses);

    // Сохраняем файл
    await fs.writeFile(filePath, csvData);

    return filePath;
  }

  /**
   * Конвертация в CSV формат
   */
  convertToCSV(responses) {
    if (responses.length === 0) return '';

    // Получаем заголовки из первого объекта
    const headers = Object.keys(responses[0]);
    const csvHeaders = headers.join(',');

    // Конвертируем данные
    const csvRows = responses.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Экранируем значения с запятыми
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Экспорт в SPSS формат
   */
  async exportToSPSS(data, userId) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `hurlburt_export_${this.hashUserId(userId)}_${timestamp}_spss.csv`;
    const filePath = path.join(__dirname, '..', 'exports', filename);

    // Создаём директорию
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // SPSS требует специальный формат с метаданными
    const spssData = this.convertToSPSSFormat(data);

    // Сохраняем файл
    await fs.writeFile(filePath, spssData);

    // Создаём файл с синтаксисом SPSS
    const syntaxFilename = filename.replace('.csv', '_syntax.sps');
    const syntaxPath = path.join(path.dirname(filePath), syntaxFilename);
    await fs.writeFile(syntaxPath, this.generateSPSSSyntax(data));

    return { dataFile: filePath, syntaxFile: syntaxPath };
  }

  /**
   * Конвертация в SPSS формат
   */
  convertToSPSSFormat(data) {
    // SPSS предпочитает числовые коды для категориальных переменных
    const spssResponses = data.responses.map(r => ({
      ...r,
      // Конвертируем flowState в числовые коды
      flowState_code: this.flowStateToCode(r.flowState),
      // Конвертируем булевы значения в 0/1
      isTraining_code: r.isTraining ? 1 : 0,
      hasFollowUp_code: r.hasFollowUp ? 1 : 0,
      hasSensoryDetails_code: r.hasSensoryDetails ? 1 : 0,
      hasInnerSpeech_code: r.hasInnerSpeech ? 1 : 0
    }));

    return this.convertToCSV(spssResponses);
  }

  /**
   * Генерация SPSS синтаксиса
   */
  generateSPSSSyntax(data) {
    return `* Hurlburt DES Data Import Syntax.
* Generated: ${new Date().toISOString()}.

GET DATA /TYPE=TXT
  /FILE='${data.metadata.exportDate}_data.csv'
  /DELCASE=LINE
  /DELIMITERS=","
  /QUALIFIER='"'
  /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2
  /VARIABLES=
    timestamp A19
    responseTime F5.0
    mood F1.0
    energy F1.0
    stress F1.0
    focus F1.0
    challenge F1.0
    skill F1.0
    concentration F1.0
    flowState_code F1.0
    dataQuality F3.0
    trainingDay F2.0
    isTraining_code F1.0
    phenomenaCount F2.0
    validationAttempts F2.0
    hasFollowUp_code F1.0
    followUpCount F2.0
    thoughtsLength F5.0
    thoughtsWords F4.0
    activityLength F5.0
    hasSensoryDetails_code F1.0
    hasInnerSpeech_code F1.0.

VARIABLE LABELS
  mood 'Mood (1-7)'
  energy 'Energy Level (1-7)'
  stress 'Stress Level (1-7)'
  focus 'Focus/Concentration (0-9)'
  challenge 'Task Challenge (0-9)'
  skill 'Skill Level (0-9)'
  concentration 'Concentration (0-9)'
  flowState_code 'Flow State Code'
  dataQuality 'Data Quality Score (0-100)'
  trainingDay 'Training Day Number'
  isTraining_code 'Is Training Data (0=No, 1=Yes)'
  phenomenaCount 'Number of Phenomena Detected'
  validationAttempts 'Validation Attempts'
  hasFollowUp_code 'Has Follow-up (0=No, 1=Yes)'
  followUpCount 'Number of Follow-up Questions'
  thoughtsLength 'Thought Description Length'
  thoughtsWords 'Thought Description Word Count'
  activityLength 'Activity Description Length'
  hasSensoryDetails_code 'Has Sensory Details (0=No, 1=Yes)'
  hasInnerSpeech_code 'Has Inner Speech (0=No, 1=Yes)'.

VALUE LABELS flowState_code
  1 'Flow'
  2 'Anxiety'
  3 'Boredom'
  4 'Control'
  5 'Arousal'
  6 'Worry'
  7 'Apathy'
  8 'Relaxation'
  9 'Unknown'.

EXECUTE.`;
  }

  /**
   * Вспомогательные методы
   */
  hashUserId(userId) {
    // Простое хеширование для анонимизации
    return require('crypto')
      .createHash('sha256')
      .update(userId)
      .digest('hex')
      .substring(0, 8);
  }

  flowStateToCode(state) {
    const codes = {
      'flow': 1,
      'anxiety': 2,
      'boredom': 3,
      'control': 4,
      'arousal': 5,
      'worry': 6,
      'apathy': 7,
      'relaxation': 8
    };
    return codes[state] || 9;
  }

  hasSensoryDetails(text) {
    if (!text) return false;
    return /цвет|звук|запах|вкус|холод|тепло|свет|темн|боль/.test(text.toLowerCase());
  }

  hasInnerSpeech(text) {
    if (!text) return false;
    return /говор|сказал|слышу|голос|произн/.test(text.toLowerCase());
  }

  calculateAverageQuality(responses) {
    const qualities = responses
      .map(r => r.metadata?.dataQualityScore)
      .filter(q => q !== undefined);
    
    return qualities.length > 0 ?
      Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) : 0;
  }

  calculateFlowPercentage(responses) {
    const flowStates = responses
      .map(r => r.metadata?.flowState)
      .filter(s => s !== undefined);
    
    const flowCount = flowStates.filter(s => s === 'flow').length;
    
    return flowStates.length > 0 ?
      Math.round(flowCount / flowStates.length * 100) : 0;
  }
}

module.exports = DataExporter;