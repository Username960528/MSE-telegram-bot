const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: String,
  firstName: String,
  lastName: String,
  registeredAt: {
    type: Date,
    default: Date.now
  },
  settings: {
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    notificationStartTime: {
      type: String,
      default: '09:00'
    },
    notificationEndTime: {
      type: String,
      default: '21:00'
    },
    notificationsPerDay: {
      type: Number,
      default: 6,
      min: 1,
      max: 10
    },
    timezone: {
      type: String,
      default: 'Europe/Moscow'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSurveyAt: Date,
  nextNotificationAt: Date,
  
  // Escalation system fields
  escalationState: {
    isEscalating: {
      type: Boolean,
      default: false
    },
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    lastEscalationNotificationAt: Date,
    missedNotificationsCount: {
      type: Number,
      default: 0
    },
    lastResponseAt: Date,
    escalationStartedAt: Date
  },
  
  // Поля для отслеживания обучения по Херлберту
  trainingStartDate: {
    type: Date,
    default: null
  },
  currentTrainingDay: {
    type: Number,
    default: 0
  },
  trainingCompleted: {
    type: Boolean,
    default: false
  },

  // Метрики качества данных
  averageDataQuality: {
    type: Number,
    default: 0
  },
  totalResponses: {
    type: Number,
    default: 0
  },
  qualityHistory: [{
    date: Date,
    score: Number,
    responsesCount: Number,
    dayNumber: Number
  }],

  // Обнаруженные паттерны и феномены Херлберта
  phenomenaFrequencies: {
    innerSpeech: { type: Number, default: 0 },
    innerSeeing: { type: Number, default: 0 },
    unsymbolizedThinking: { type: Number, default: 0 },
    feeling: { type: Number, default: 0 },
    sensoryAwareness: { type: Number, default: 0 }
  },

  // Паттерны ответов для персонализации
  commonPatterns: {
    usesInnerSpeech: { type: Boolean, default: null },
    tendencyToGeneralize: { type: Number, default: 0 }, // 0-1
    introspectiveAccuracy: { type: Number, default: 0 }, // 0-1
    preferredResponseLength: { type: Number, default: 0 },

    // Специфичные иллюзии
    readingVoiceIllusion: { type: Boolean, default: null },
    emotionAsThought: { type: Boolean, default: null },

    // Сильные стороны
    sensoryDetailRichness: { type: Number, default: 0 }, // 0-1
    momentCaptureAbility: { type: Number, default: 0 }, // 0-1
    emptinessRecognition: { type: Number, default: 0 } // 0-1
  },

  // Настройки персонализации
  preferences: {
    receiveQualityFeedback: { type: Boolean, default: true },
    showExamples: { type: Boolean, default: true },
    adaptiveQuestions: { type: Boolean, default: true },
    trainingReminders: { type: Boolean, default: true },
    useAIValidation: { type: Boolean, default: true }
  },

  // Достижения и прогресс
  achievements: [{
    type: {
      type: String,
      enum: [
        'first_pristine_experience',
        'illusion_breaker',
        'sensory_master',
        'emptiness_recognizer',
        'consistency_champion',
        'training_graduate'
      ]
    },
    unlockedAt: Date,
    description: String
  }]
});

userSchema.methods.getFullName = function() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ') || this.username || 'User';
};

userSchema.methods.shouldReceiveNotification = function() {
  if (!this.settings.notificationsEnabled || !this.isActive) {
    return false;
  }
  
  const now = new Date();
  const [startHour, startMinute] = this.settings.notificationStartTime.split(':').map(Number);
  const [endHour, endMinute] = this.settings.notificationEndTime.split(':').map(Number);
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  return currentTime >= startTime && currentTime <= endTime;
};

module.exports = mongoose.model('User', userSchema);