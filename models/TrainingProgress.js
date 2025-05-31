const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TrainingProgressSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true,
    index: true
  },

  // Прогресс по дням
  dailyProgress: [{
    day: Number,
    date: Date,
    responsesCount: Number,
    averageQuality: Number,

    // Специфичные навыки по Херлберту
    skills: {
      momentCapture: { type: Number, default: 0 }, // 0-1
      specificityLevel: { type: Number, default: 0 },
      avoidanceOfGeneralization: { type: Number, default: 0 },
      sensoryDetail: { type: Number, default: 0 },
      emptinessRecognition: { type: Number, default: 0 },
      illusionResistance: { type: Number, default: 0 }
    },

    // Обнаруженные проблемы
    issues: [{
      type: String,
      count: Number,
      examples: [String]
    }],

    // Breakthrough моменты
    breakthroughs: [{
      type: String,
      description: String,
      example: String,
      timestamp: Date
    }],

    // Обратная связь
    feedbackGiven: [{
      type: String,
      response: String,
      helpful: Boolean
    }],

    improvementNoted: Boolean,
    qualityTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining']
    }
  }],

  // Итоговая оценка готовности
  readinessAssessment: {
    score: { type: Number, default: 0 }, // 0-100
    criteria: {
      consistentQuality: Boolean,
      momentFocusAchieved: Boolean,
      illusionsIdentified: Boolean,
      sensoryAwareness: Boolean
    },
    assessedAt: Date
  },

  // Дата выпуска из обучения
  graduationDate: Date,
  graduationQuality: Number,

  // Персонализированные рекомендации
  personalizedGuidance: {
    strengths: [String],
    weaknesses: [String],
    recommendations: [{
      priority: {
        type: String,
        enum: ['high', 'medium', 'low']
      },
      recommendation: String,
      rationale: String
    }],
    customTips: [String]
  },

  // Статистика иллюзий
  illusionStats: {
    readingVoice: {
      encountered: Number,
      corrected: Number,
      persistent: Boolean
    },
    emotionLabeling: {
      encountered: Number,
      corrected: Number,
      persistent: Boolean
    },
    generalization: {
      encountered: Number,
      corrected: Number,
      persistent: Boolean
    }
  },

  // Адаптивное обучение
  adaptiveCoaching: {
    learningProfile: String,  // 'quick_learner', 'analytical', 'intuitive', 'struggling'
    recommendedDuration: Number,
    currentDay: Number,
    personalizedExercises: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    dailyFocus: {
      type: Map,
      of: String
    },
    customMessages: {
      morning: [String],
      encouragement: [String],
      correction: [String]
    },
    interventions: [{
      targetWeakness: String,
      interventionType: String,
      urgency: String,
      specificActions: [String],
      estimatedDuration: Number,
      successMetrics: String,
      fallbackStrategy: String
    }],
    nextSteps: [String],
    qualityTarget: Number,
    weaknessTargets: [String],
    
    // Метаданные адаптации
    metadata: {
      analysisDate: Date,
      confidence: Number,
      adaptationReason: String,
      version: {
        type: Number,
        default: 1
      },
      aiEnhanced: {
        type: Boolean,
        default: false
      }
    },
    
    // История адаптаций
    adaptationHistory: [{
      date: Date,
      trigger: String,
      changes: mongoose.Schema.Types.Mixed,
      reason: String
    }],
    
    // Результаты анализа слабостей
    weaknessAnalysis: {
      analysisDate: Date,
      primaryWeaknesses: [{
        type: String,
        severity: Number,
        evidence: String,
        frequency: Number,
        aiInsights: String,
        riskLevel: String
      }],
      riskFactors: [String],
      confidence: Number
    },
    
    // Персональные упражнения
    exercisePlan: {
      generatedAt: Date,
      targetAreas: [String],
      difficultyLevel: String,
      exercises: [{
        day: Number,
        focus: String,
        exercises: [{
          title: String,
          description: String,
          targetArea: String,
          priority: Number,
          estimatedImpact: Number,
          isAIGenerated: {
            type: Boolean,
            default: false
          }
        }],
        estimatedTime: Number,
        goals: [String]
      }],
      estimatedDuration: {
        totalMinutes: Number,
        totalDays: Number,
        averagePerDay: Number
      }
    },
    
    // Адаптивная длительность
    durationAnalysis: {
      calculatedAt: Date,
      recommendedDuration: Number,
      originalDuration: Number,
      adjustment: Number,
      rationale: {
        primaryReasons: [String],
        factorImpact: Number,
        riskLevel: String,
        confidenceLevel: Number
      },
      trajectory: {
        model: String,
        timeToGoal: Number,
        plateauRisk: Number,
        optimalStoppingPoint: Number
      },
      milestones: [{
        day: Number,
        goal: String,
        qualityTarget: Number
      }]
    }
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Индексы для эффективности
TrainingProgressSchema.index({ userId: 1, 'dailyProgress.day': 1 });

// Методы
TrainingProgressSchema.methods.getCurrentDay = function() {
  return this.dailyProgress.length;
};

TrainingProgressSchema.methods.getAverageQuality = function() {
  if (this.dailyProgress.length === 0) return 0;

  const sum = this.dailyProgress.reduce((acc, day) => acc + day.averageQuality, 0);
  return sum / this.dailyProgress.length;
};

TrainingProgressSchema.methods.isReadyToGraduate = function() {
  if (this.dailyProgress.length < 3) return false;

  // Проверяем последние 3 дня
  const lastThreeDays = this.dailyProgress.slice(-3);
  const avgQuality = lastThreeDays.reduce((acc, d) => acc + d.averageQuality, 0) / 3;

  return avgQuality >= 70 && this.readinessAssessment.score >= 80;
};

// Новые методы для адаптивного обучения

TrainingProgressSchema.methods.getAdaptiveProfile = function() {
  return this.adaptiveCoaching?.learningProfile || 'standard';
};

TrainingProgressSchema.methods.getRecommendedDuration = function() {
  return this.adaptiveCoaching?.recommendedDuration || 3;
};

TrainingProgressSchema.methods.getQualityTarget = function() {
  return this.adaptiveCoaching?.qualityTarget || 70;
};

TrainingProgressSchema.methods.getCurrentWeaknesses = function() {
  return this.adaptiveCoaching?.weaknessAnalysis?.primaryWeaknesses || [];
};

TrainingProgressSchema.methods.isAdaptiveGraduationReady = function() {
  // Проверяем адаптивные критерии если они есть
  if (!this.adaptiveCoaching) {
    return this.isReadyToGraduate();
  }

  const currentDay = this.getCurrentDay();
  const recommendedDuration = this.getRecommendedDuration();
  const qualityTarget = this.getQualityTarget();
  const currentQuality = this.getAverageQuality();

  // Минимальная длительность достигнута
  if (currentDay < recommendedDuration) {
    return false;
  }

  // Качество достигло цели
  if (currentQuality < qualityTarget) {
    return false;
  }

  // Проверяем решение критических слабостей
  const criticalWeaknesses = this.getCurrentWeaknesses().filter(w => 
    w.severity > 0.7 && w.riskLevel === 'high'
  );

  return criticalWeaknesses.length === 0;
};

TrainingProgressSchema.methods.getAdaptiveStatus = function() {
  if (!this.adaptiveCoaching) {
    return {
      isAdaptive: false,
      profile: 'standard',
      progress: this.calculateStandardProgress()
    };
  }

  const currentDay = this.getCurrentDay();
  const recommendedDuration = this.getRecommendedDuration();
  const currentQuality = this.getAverageQuality();
  const qualityTarget = this.getQualityTarget();

  return {
    isAdaptive: true,
    profile: this.getAdaptiveProfile(),
    progress: {
      dayProgress: Math.round((currentDay / recommendedDuration) * 100),
      qualityProgress: Math.round((currentQuality / qualityTarget) * 100),
      overallProgress: Math.round(
        ((currentDay / recommendedDuration) * 0.6 + 
         (currentQuality / qualityTarget) * 0.4) * 100
      )
    },
    recommendations: this.getActiveRecommendations()
  };
};

TrainingProgressSchema.methods.calculateStandardProgress = function() {
  const currentDay = this.getCurrentDay();
  const totalDays = 3; // стандартное значение
  return Math.round((currentDay / totalDays) * 100);
};

TrainingProgressSchema.methods.getActiveRecommendations = function() {
  if (!this.adaptiveCoaching?.interventions) {
    return [];
  }

  return this.adaptiveCoaching.interventions
    .filter(intervention => intervention.urgency === 'high')
    .slice(0, 3)
    .map(intervention => ({
      target: intervention.targetWeakness,
      action: intervention.specificActions?.[0] || 'Общее улучшение',
      urgency: intervention.urgency
    }));
};

TrainingProgressSchema.methods.updateAdaptiveData = function(adaptiveData) {
  if (!this.adaptiveCoaching) {
    this.adaptiveCoaching = {};
  }
  
  // Сохраняем историю изменений
  if (this.adaptiveCoaching.metadata?.version) {
    if (!this.adaptiveCoaching.adaptationHistory) {
      this.adaptiveCoaching.adaptationHistory = [];
    }
    
    this.adaptiveCoaching.adaptationHistory.push({
      date: new Date(),
      trigger: 'manual_update',
      changes: adaptiveData,
      reason: 'Updated adaptive data'
    });
  }
  
  // Обновляем данные
  Object.assign(this.adaptiveCoaching, adaptiveData);
  
  // Обновляем метаданные
  if (!this.adaptiveCoaching.metadata) {
    this.adaptiveCoaching.metadata = {};
  }
  
  this.adaptiveCoaching.metadata.version = (this.adaptiveCoaching.metadata.version || 0) + 1;
  this.adaptiveCoaching.metadata.analysisDate = new Date();
  
  this.updatedAt = new Date();
};

TrainingProgressSchema.methods.getTodayFocus = function() {
  const currentDay = this.getCurrentDay();
  
  if (this.adaptiveCoaching?.dailyFocus) {
    return this.adaptiveCoaching.dailyFocus.get(`day${currentDay}`) || 'general_development';
  }
  
  // Fallback фокус для стандартного обучения
  const standardFocus = {
    1: 'moment_capture',
    2: 'sensory_detail', 
    3: 'illusion_detection'
  };
  
  return standardFocus[currentDay] || 'skill_integration';
};

TrainingProgressSchema.methods.getPersonalizedExercises = function(day) {
  if (!this.adaptiveCoaching?.exercisePlan?.exercises) {
    return [];
  }
  
  const dayExercises = this.adaptiveCoaching.exercisePlan.exercises.find(e => e.day === day);
  return dayExercises?.exercises || [];
};

TrainingProgressSchema.methods.hasWeakness = function(weaknessType) {
  return this.getCurrentWeaknesses().some(w => w.type === weaknessType);
};

TrainingProgressSchema.methods.getWeaknessSeverity = function(weaknessType) {
  const weakness = this.getCurrentWeaknesses().find(w => w.type === weaknessType);
  return weakness?.severity || 0;
};

TrainingProgressSchema.methods.exportAdaptiveData = function() {
  return {
    userId: this.userId,
    profile: this.getAdaptiveProfile(),
    currentDay: this.getCurrentDay(),
    recommendedDuration: this.getRecommendedDuration(),
    currentQuality: this.getAverageQuality(),
    qualityTarget: this.getQualityTarget(),
    weaknesses: this.getCurrentWeaknesses().map(w => ({
      type: w.type,
      severity: w.severity,
      riskLevel: w.riskLevel
    })),
    adaptiveStatus: this.getAdaptiveStatus(),
    todayFocus: this.getTodayFocus(),
    isReady: this.isAdaptiveGraduationReady(),
    exportDate: new Date()
  };
};

module.exports = mongoose.model('TrainingProgress', TrainingProgressSchema);