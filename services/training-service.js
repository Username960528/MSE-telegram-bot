const User = require('../models/User');
const TrainingProgress = require('../models/TrainingProgress');
const config = require('../config/hurlburt');
const goldenExamples = require('../config/goldenExamples');

/**
 * Сервис управления процессом обучения по методу Херлберта
 */
class TrainingService {
  constructor() {
    this.config = config.training;
    this.learningSequences = goldenExamples.learningSequences;
  }

  /**
   * Инициализация обучения для нового пользователя
   */
  async initializeTraining(userId, telegramId) {
    // Создаём запись прогресса
    const progress = new TrainingProgress({
      userId,
      telegramId,
      dailyProgress: [],
      readinessAssessment: {
        score: 0,
        criteria: {
          consistentQuality: false,
          momentFocusAchieved: false,
          illusionsIdentified: false,
          sensoryAwareness: false
        }
      }
    });

    await progress.save();

    // Обновляем пользователя
    await User.findByIdAndUpdate(userId, {
      trainingStartDate: new Date(),
      currentTrainingDay: 1,
      trainingCompleted: false
    });

    return progress;
  }

  /**
   * Получить текущий статус обучения
   */
  async getTrainingStatus(userId) {
    const user = await User.findById(userId);
    const progress = await TrainingProgress.findOne({ userId });

    if (!user.trainingStartDate) {
      return {
        status: 'not_started',
        message: 'Обучение ещё не начато'
      };
    }

    const daysSinceStart = Math.floor(
      (Date.now() - user.trainingStartDate) / (1000 * 60 * 60 * 24)
    ) + 1;

    const currentDayProgress = progress?.dailyProgress.find(
      d => d.day === daysSinceStart
    );

    return {
      status: user.trainingCompleted ? 'completed' : 'in_progress',
      currentDay: daysSinceStart,
      totalDays: this.config.DAYS,
      todayResponses: currentDayProgress?.responsesCount || 0,
      todayQuality: currentDayProgress?.averageQuality || 0,
      requiredResponses: this.config.MIN_SURVEYS_PER_DAY,
      overallProgress: progress ? this.calculateOverallProgress(progress) : 0
    };
  }

  /**
   * Обновить прогресс после ответа
   */
  async updateProgress(userId, response) {
    const user = await User.findById(userId);
    const progress = await TrainingProgress.findOne({ userId });
    
    if (!progress) return;

    const currentDay = user.currentTrainingDay || 1;
    
    // Находим или создаём запись дня
    let dayProgress = progress.dailyProgress.find(d => d.day === currentDay);
    if (!dayProgress) {
      dayProgress = {
        day: currentDay,
        date: new Date(),
        responsesCount: 0,
        averageQuality: 0,
        skills: {},
        issues: [],
        breakthroughs: [],
        feedbackGiven: []
      };
      progress.dailyProgress.push(dayProgress);
    }

    // Обновляем статистику дня
    const prevTotal = dayProgress.responsesCount * dayProgress.averageQuality;
    dayProgress.responsesCount += 1;
    dayProgress.averageQuality = (prevTotal + response.dataQualityScore) / dayProgress.responsesCount;

    // Обновляем навыки
    this.updateSkills(dayProgress, response);

    // Проверяем на прорывы
    const breakthroughs = this.detectBreakthroughs(response, progress);
    if (breakthroughs.length > 0) {
      dayProgress.breakthroughs.push(...breakthroughs);
    }

    // Анализируем проблемы
    this.analyzeIssues(dayProgress, response);

    // Определяем тренд
    dayProgress.qualityTrend = this.calculateTrend(progress.dailyProgress);

    // Обновляем оценку готовности
    if (currentDay >= 2) {
      progress.readinessAssessment = this.assessReadiness(progress);
    }

    await progress.save();

    // Проверяем, готов ли к выпуску
    if (currentDay >= this.config.DAYS && progress.isReadyToGraduate()) {
      await this.graduateUser(user, progress);
    }

    return progress;
  }

  /**
   * Обновление навыков на основе ответа
   */
  updateSkills(dayProgress, response) {
    const skills = dayProgress.skills;

    // Захват момента
    if (response.qualityMetrics?.momentFocus > 70) {
      skills.momentCapture = (skills.momentCapture || 0) * 0.8 + 0.2;
    }

    // Специфичность
    if (response.qualityMetrics?.specificity > 70) {
      skills.specificityLevel = (skills.specificityLevel || 0) * 0.8 + 0.2;
    }

    // Избегание обобщений
    const hasGeneralizations = response.metadata?.validationStats?.flags?.includes('generalization');
    if (!hasGeneralizations) {
      skills.avoidanceOfGeneralization = (skills.avoidanceOfGeneralization || 0) * 0.8 + 0.2;
    }

    // Сенсорные детали
    if (response.qualityMetrics?.sensoryDetail > 60) {
      skills.sensoryDetail = (skills.sensoryDetail || 0) * 0.8 + 0.2;
    }

    // Признание пустоты
    const acknowledgedEmptiness = response.metadata?.phenomena?.emptiness > 0;
    if (acknowledgedEmptiness) {
      skills.emptinessRecognition = Math.min(1, (skills.emptinessRecognition || 0) + 0.3);
    }

    // Сопротивление иллюзиям
    const hasIllusions = response.goldenStandard?.matchedPatterns?.negative?.some(
      p => p.category === 'illusion'
    );
    if (!hasIllusions) {
      skills.illusionResistance = (skills.illusionResistance || 0) * 0.8 + 0.2;
    }
  }

  /**
   * Обнаружение прорывных моментов
   */
  detectBreakthroughs(response, progress) {
    const breakthroughs = [];

    // Первый "чистый" опыт
    if (response.quality === 'pristine' && !this.hasAchievement(progress, 'first_pristine')) {
      breakthroughs.push({
        type: 'first_pristine_experience',
        description: 'Первое описание чистого опыта!',
        example: response.responses.moment_capture?.text,
        timestamp: new Date()
      });
    }

    // Разрушение иллюзии внутреннего голоса
    if (response.followUp?.analysis?.illusionBroken && 
        response.goldenStandard?.detectedContext === 'reading') {
      breakthroughs.push({
        type: 'reading_illusion_broken',
        description: 'Осознал отсутствие внутреннего голоса при чтении',
        example: response.followUp.answer,
        timestamp: new Date()
      });
    }

    // Признание пустоты
    if (response.metadata?.phenomena?.emptiness && 
        !this.hasBreakthrough(progress, 'emptiness_recognized')) {
      breakthroughs.push({
        type: 'emptiness_recognized',
        description: 'Впервые честно признал пустоту в сознании',
        timestamp: new Date()
      });
    }

    return breakthroughs;
  }

  /**
   * Анализ проблем
   */
  analyzeIssues(dayProgress, response) {
    const issues = response.goldenStandard?.matchedPatterns?.negative || [];
    
    issues.forEach(issue => {
      const existingIssue = dayProgress.issues.find(i => i.type === issue.name);
      
      if (existingIssue) {
        existingIssue.count++;
        if (existingIssue.examples.length < 3) {
          existingIssue.examples.push(
            response.responses.moment_capture?.text?.substring(0, 50) + '...'
          );
        }
      } else {
        dayProgress.issues.push({
          type: issue.name,
          count: 1,
          examples: [response.responses.moment_capture?.text?.substring(0, 50) + '...']
        });
      }
    });
  }

  /**
   * Расчёт тренда качества
   */
  calculateTrend(dailyProgress) {
    if (dailyProgress.length < 2) return 'stable';
    
    const recent = dailyProgress.slice(-3);
    if (recent.length < 2) return 'stable';
    
    const avgRecent = recent.reduce((sum, d) => sum + d.averageQuality, 0) / recent.length;
    const avgPrevious = dailyProgress.slice(-6, -3).reduce((sum, d) => sum + d.averageQuality, 0) / 3;
    
    if (avgRecent > avgPrevious + 10) return 'improving';
    if (avgRecent < avgPrevious - 10) return 'declining';
    return 'stable';
  }

  /**
   * Оценка готовности к выпуску
   */
  assessReadiness(progress) {
    const assessment = {
      score: 0,
      criteria: {
        consistentQuality: false,
        momentFocusAchieved: false,
        illusionsIdentified: false,
        sensoryAwareness: false
      }
    };

    // Проверяем последние дни
    const recentDays = progress.dailyProgress.slice(-3);
    if (recentDays.length < 3) return assessment;

    // Консистентное качество
    const avgQuality = recentDays.reduce((sum, d) => sum + d.averageQuality, 0) / 3;
    if (avgQuality >= 70) {
      assessment.criteria.consistentQuality = true;
      assessment.score += 25;
    }

    // Фокус на моменте
    const momentSkill = recentDays.reduce((sum, d) => sum + (d.skills.momentCapture || 0), 0) / 3;
    if (momentSkill >= 0.7) {
      assessment.criteria.momentFocusAchieved = true;
      assessment.score += 25;
    }

    // Идентификация иллюзий
    const illusionResistance = recentDays.reduce((sum, d) => sum + (d.skills.illusionResistance || 0), 0) / 3;
    if (illusionResistance >= 0.6) {
      assessment.criteria.illusionsIdentified = true;
      assessment.score += 25;
    }

    // Сенсорная осознанность
    const sensorySkill = recentDays.reduce((sum, d) => sum + (d.skills.sensoryDetail || 0), 0) / 3;
    if (sensorySkill >= 0.6) {
      assessment.criteria.sensoryAwareness = true;
      assessment.score += 25;
    }

    assessment.assessedAt = new Date();
    return assessment;
  }

  /**
   * Выпуск пользователя из обучения
   */
  async graduateUser(user, progress) {
    user.trainingCompleted = true;
    progress.graduationDate = new Date();
    progress.graduationQuality = progress.getAverageQuality();

    // Генерируем персонализированные рекомендации
    progress.personalizedGuidance = this.generatePersonalizedGuidance(progress);

    await user.save();
    await progress.save();

    return {
      graduated: true,
      quality: progress.graduationQuality,
      guidance: progress.personalizedGuidance
    };
  }

  /**
   * Генерация персонализированных рекомендаций
   */
  generatePersonalizedGuidance(progress) {
    const guidance = {
      strengths: [],
      weaknesses: [],
      recommendations: [],
      customTips: []
    };

    // Анализируем сильные стороны
    const lastDay = progress.dailyProgress[progress.dailyProgress.length - 1];
    
    if (lastDay.skills.momentCapture >= 0.8) {
      guidance.strengths.push('Отличный захват момента');
    }
    if (lastDay.skills.sensoryDetail >= 0.8) {
      guidance.strengths.push('Богатые сенсорные описания');
    }
    if (lastDay.skills.illusionResistance >= 0.8) {
      guidance.strengths.push('Хорошее различение иллюзий');
    }

    // Анализируем слабости
    const allIssues = progress.dailyProgress.flatMap(d => d.issues);
    const issueFrequency = {};
    
    allIssues.forEach(issue => {
      issueFrequency[issue.type] = (issueFrequency[issue.type] || 0) + issue.count;
    });

    Object.entries(issueFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([issue, count]) => {
        if (count > 5) {
          guidance.weaknesses.push(this.getIssueName(issue));
        }
      });

    // Генерируем рекомендации
    if (guidance.weaknesses.includes('Обобщения')) {
      guidance.recommendations.push({
        priority: 'high',
        recommendation: 'Продолжайте фокусироваться на конкретных деталях момента',
        rationale: 'У вас есть тенденция к обобщениям'
      });
    }

    // Добавляем персональные советы
    if (progress.illusionStats?.readingVoice?.persistent) {
      guidance.customTips.push(
        'Обратите особое внимание при чтении - вероятно, внутреннего голоса нет!'
      );
    }

    return guidance;
  }

  /**
   * Получить сообщение дня для обучения
   */
  async getDailyMessage(userId, day) {
    const messages = {
      1: {
        morning: '🌅 День 1 обучения! Сегодня учимся ловить момент. Помните: описывайте что происходило ИМЕННО в момент сигнала.',
        evening: '🌙 Как прошёл первый день? Завтра будем добавлять сенсорные детали.'
      },
      2: {
        morning: '🌅 День 2! Сегодня фокус на сенсорных деталях. Что видели? Слышали? Чувствовали телом?',
        evening: '🌙 Отличная работа! Завтра последний день обучения.'
      },
      3: {
        morning: '🌅 День 3 - финальный! Сегодня учимся различать опыт и мысли об опыте.',
        evening: '🌙 Поздравляем! Вы прошли обучение. Теперь ваши данные будут максимально точными!'
      }
    };

    const timeOfDay = new Date().getHours() < 18 ? 'morning' : 'evening';
    return messages[day]?.[timeOfDay] || '';
  }

  /**
   * Вспомогательные методы
   */
  
  hasAchievement(progress, type) {
    return progress.dailyProgress.some(d => 
      d.breakthroughs.some(b => b.type === type)
    );
  }

  hasBreakthrough(progress, type) {
    return progress.dailyProgress.some(d =>
      d.breakthroughs.some(b => b.type === type)
    );
  }

  calculateOverallProgress(progress) {
    const totalDays = this.config.DAYS;
    const completedDays = progress.dailyProgress.length;
    const dayProgress = (completedDays / totalDays) * 50;
    
    const qualityProgress = progress.readinessAssessment.score * 0.5;
    
    return Math.min(100, dayProgress + qualityProgress);
  }

  getIssueName(issueType) {
    const names = {
      'generalization': 'Обобщения',
      'abstraction': 'Абстракции',
      'time_period': 'Временные периоды вместо момента',
      'theorizing': 'Теоретизирование',
      'avoidance': 'Избегание наблюдения'
    };
    return names[issueType] || issueType;
  }
}

module.exports = new TrainingService();