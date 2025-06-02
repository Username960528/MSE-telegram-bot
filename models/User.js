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
    },
    // Pushover настройки для уведомлений на часы
    pushover: {
      enabled: {
        type: Boolean,
        default: false
      },
      userKey: {
        type: String,
        default: null
      },
      priority: {
        type: Number,
        default: 1, // High priority для часов
        min: -2,
        max: 2
      },
      sound: {
        type: String,
        default: 'persistent'
      }
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
    useAIValidation: { type: Boolean, default: true },
    addressForm: {
      type: String,
      enum: ['informal', 'formal'],
      default: 'informal'
    }
  },

  // Отслеживание просмотра новостей
  seenLatestNews: {
    type: Boolean,
    default: false
  },

  // Геймификация: стрики и прогресс
  streaks: {
    current: {
      daily: { count: { type: Number, default: 0 }, lastDate: Date },
      quality: { count: { type: Number, default: 0 }, lastDate: Date },
      flow: { count: { type: Number, default: 0 }, lastDate: Date },
      training: { count: { type: Number, default: 0 }, lastDate: Date }
    },
    longest: {
      daily: { count: { type: Number, default: 0 }, achievedAt: Date },
      quality: { count: { type: Number, default: 0 }, achievedAt: Date },
      flow: { count: { type: Number, default: 0 }, achievedAt: Date },
      training: { count: { type: Number, default: 0 }, achievedAt: Date }
    }
  },

  // Система уровней
  level: {
    current: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    title: { type: String, default: 'Новичок' }
  },

  // Статистика для рейтингов (анонимная)
  rankings: {
    anonymousId: { type: String, unique: true }, // "Участник #1247"
    weeklyScore: { type: Number, default: 0 },
    monthlyScore: { type: Number, default: 0 },
    flowPercentage: { type: Number, default: 0 },
    qualityAverage: { type: Number, default: 0 },
    lastRankingUpdate: Date
  },

  // Достижения и прогресс
  achievements: [{
    type: {
      type: String,
      enum: [
        // Основные достижения
        'first_pristine_experience',
        'illusion_breaker',
        'sensory_master',
        'emptiness_recognizer',
        'consistency_champion',
        'training_graduate',
        
        // Стрик достижения
        'daily_warrior', // 7 дней подряд
        'weekly_champion', // 30 дней подряд
        'quality_master', // 10 качественных ответов подряд
        'flow_seeker', // 5 flow состояний подряд
        
        // Количественные достижения
        'century_club', // 100 ответов
        'flow_finder', // первое flow состояние
        'diverse_explorer', // все типы феноменов
        'night_owl', // ответ после 22:00
        'early_bird', // ответ до 7:00
        
        // Социальные достижения
        'top_10_weekly', // топ 10 на неделе
        'quality_leader', // лидер по качеству
        'consistency_king' // лидер по постоянству
      ]
    },
    unlockedAt: Date,
    description: String,
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common'
    }
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

// Геймификация методы
userSchema.methods.updateStreak = function(type, isQualityResponse = false, isFlowState = false) {
  const today = new Date().toDateString();
  const streak = this.streaks.current[type];
  
  if (!streak.lastDate || streak.lastDate.toDateString() !== today) {
    // Проверяем, был ли вчера ответ для продолжения стрика
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (streak.lastDate && streak.lastDate.toDateString() === yesterday.toDateString()) {
      streak.count += 1;
    } else {
      streak.count = 1; // Начинаем новый стрик
    }
    
    streak.lastDate = new Date();
    
    // Обновляем рекорд если нужно
    if (streak.count > this.streaks.longest[type].count) {
      this.streaks.longest[type].count = streak.count;
      this.streaks.longest[type].achievedAt = new Date();
    }
  }
  
  return streak.count;
};

userSchema.methods.addExperience = function(points) {
  this.level.experience += points;
  
  // Формула прогрессии: следующий уровень = текущий * 100
  const nextLevelExp = this.level.current * 100;
  
  if (this.level.experience >= nextLevelExp) {
    this.level.current += 1;
    this.level.experience -= nextLevelExp;
    this.updateLevelTitle();
    return true; // Уровень повышен
  }
  
  return false;
};

userSchema.methods.updateLevelTitle = function() {
  const level = this.level.current;
  if (level >= 50) this.level.title = 'Мастер Сознания';
  else if (level >= 30) this.level.title = 'Исследователь Разума';
  else if (level >= 15) this.level.title = 'Наблюдатель';
  else if (level >= 5) this.level.title = 'Практикующий';
  else this.level.title = 'Новичок';
};

userSchema.methods.unlockAchievement = function(type, description) {
  const existing = this.achievements.find(a => a.type === type);
  if (existing) return false;
  
  // Определяем редкость достижения
  const rarity = this.getAchievementRarity(type);
  
  this.achievements.push({
    type,
    description,
    rarity,
    unlockedAt: new Date()
  });
  
  return true;
};

userSchema.methods.getAchievementRarity = function(type) {
  const legendaryAchievements = ['weekly_champion', 'quality_leader', 'consistency_king'];
  const epicAchievements = ['daily_warrior', 'century_club', 'diverse_explorer'];
  const rareAchievements = ['flow_finder', 'quality_master', 'flow_seeker'];
  
  if (legendaryAchievements.includes(type)) return 'legendary';
  if (epicAchievements.includes(type)) return 'epic';
  if (rareAchievements.includes(type)) return 'rare';
  return 'common';
};

userSchema.methods.getProgressToNextLevel = function() {
  const nextLevelExp = this.level.current * 100;
  return {
    current: this.level.experience,
    needed: nextLevelExp,
    percentage: Math.floor((this.level.experience / nextLevelExp) * 100)
  };
};

userSchema.methods.generateAnonymousId = function() {
  if (!this.rankings.anonymousId) {
    this.rankings.anonymousId = `Участник #${Math.floor(Math.random() * 9000) + 1000}`;
  }
  return this.rankings.anonymousId;
};

module.exports = mongoose.model('User', userSchema);