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

module.exports = mongoose.model('TrainingProgress', TrainingProgressSchema);