const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  telegramId: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  notificationSentAt: Date,
  responseStartedAt: Date,
  responseCompletedAt: Date,
  responses: {
    // Основные шкалы (совместимость с текущей схемой)
    mood: {
      type: Number,
      min: 1,
      max: 7
    },
    energy: {
      type: Number,
      min: 1,
      max: 7
    },
    stress: {
      type: Number,
      min: 1,
      max: 7
    },
    focus: {
      type: Number,
      min: 0,
      max: 9
    },
    // Текстовые поля
    currentThoughts: String,
    currentActivity: String,
    currentEmotions: String
  },
  metadata: {
    // Базовые метаданные
    responseTime: Number,
    isComplete: {
      type: Boolean,
      default: false
    },
    missedReason: String,
    
    // Новые поля для метода Херлберта
    challenge: {
      type: Number,
      min: 0,
      max: 9
    },
    skill: {
      type: Number,
      min: 0,
      max: 9
    },
    concentration: {
      type: Number,
      min: 0,
      max: 9
    },
    flowState: {
      type: String,
      enum: ['flow', 'anxiety', 'boredom', 'control', 'arousal', 'worry', 'apathy', 'relaxation', null],
      default: null
    },
    
    // Качество данных и обучение
    dataQualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    trainingDay: {
      type: Number,
      min: 1
    },
    isTraining: {
      type: Boolean,
      default: true
    },
    
    // Феномены Херлберта
    phenomenaDetected: [{
      type: String,
      name: String,
      confidence: Number
    }],
    
    // Follow-up данные
    followUpAnswers: [{
      timestamp: String,
      answer: String
    }],
    
    // Дополнительные данные
    currentCompanion: String,
    validationAttempts: {
      type: Map,
      of: Number
    },
    
    // Гибкое хранилище для будущих расширений
    additionalData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }
});

responseSchema.index({ userId: 1, timestamp: -1 });
responseSchema.index({ telegramId: 1, timestamp: -1 });

responseSchema.methods.calculateResponseTime = function() {
  if (this.notificationSentAt && this.responseCompletedAt) {
    return Math.round((this.responseCompletedAt - this.notificationSentAt) / 1000);
  }
  return null;
};

// Новые методы для метода Херлберта
responseSchema.methods.isHighQuality = function() {
  return this.metadata?.dataQualityScore >= 70;
};

responseSchema.methods.hasFlowState = function() {
  return this.metadata?.flowState === 'flow';
};

responseSchema.methods.getPhenomena = function() {
  return this.metadata?.phenomenaDetected || [];
};

responseSchema.methods.getTrainingStatus = function() {
  if (!this.metadata?.trainingDay) return 'unknown';
  if (this.metadata.isTraining) {
    return `training_day_${this.metadata.trainingDay}`;
  }
  return 'graduated';
};

// Метод для экспорта данных
responseSchema.methods.exportForResearch = function() {
  return {
    timestamp: this.timestamp,
    // Основные данные
    mood: this.responses.mood,
    energy: this.responses.energy,
    stress: this.responses.stress,
    focus: this.responses.focus,
    
    // Flow данные
    challenge: this.metadata?.challenge,
    skill: this.metadata?.skill,
    concentration: this.metadata?.concentration,
    flowState: this.metadata?.flowState,
    
    // Качество
    dataQuality: this.metadata?.dataQualityScore,
    trainingDay: this.metadata?.trainingDay,
    
    // Феномены
    phenomena: this.metadata?.phenomenaDetected?.map(p => p.type) || [],
    
    // Текстовые данные (анонимизированные)
    thoughtsLength: this.responses.currentThoughts?.length || 0,
    activityLength: this.responses.currentActivity?.length || 0,
    
    // Метаданные
    responseTime: this.metadata?.responseTime,
    followUpCount: this.metadata?.followUpAnswers?.length || 0
  };
};

responseSchema.pre('save', function(next) {
  if (this.responseCompletedAt && this.notificationSentAt) {
    this.metadata.responseTime = this.calculateResponseTime();
  }
  
  const hasQuantitative = this.responses.mood || this.responses.energy || 
                         this.responses.stress || this.responses.focus;
  const hasQualitative = this.responses.currentThoughts || 
                        this.responses.currentActivity || 
                        this.responses.currentEmotions;
  
  this.metadata.isComplete = !!(hasQuantitative || hasQualitative);
  
  // Определяем Flow состояние если есть данные
  if (this.metadata?.challenge !== undefined && this.metadata?.skill !== undefined && !this.metadata.flowState) {
    const challenge = this.metadata.challenge;
    const skill = this.metadata.skill;
    
    // Простая логика определения Flow
    if (Math.abs(challenge - skill) <= 1 && challenge >= 5 && skill >= 5) {
      this.metadata.flowState = 'flow';
    } else if (challenge > skill + 2) {
      this.metadata.flowState = challenge > 6 ? 'anxiety' : 'worry';
    } else if (skill > challenge + 2) {
      this.metadata.flowState = skill > 6 ? 'relaxation' : 'boredom';
    } else if (challenge >= 7 && skill >= 4 && skill <= 6) {
      this.metadata.flowState = 'arousal';
    } else if (skill >= 7 && challenge >= 4 && challenge <= 6) {
      this.metadata.flowState = 'control';
    } else if (challenge <= 3 && skill <= 3) {
      this.metadata.flowState = 'apathy';
    }
  }
  
  next();
});

// Статические методы для анализа
responseSchema.statics.getFlowStatistics = async function(userId, limit = 100) {
  const responses = await this.find({ 
    userId, 
    'metadata.flowState': { $exists: true } 
  })
  .sort({ timestamp: -1 })
  .limit(limit);
  
  const flowCounts = {};
  responses.forEach(r => {
    const state = r.metadata.flowState;
    flowCounts[state] = (flowCounts[state] || 0) + 1;
  });
  
  return {
    total: responses.length,
    distribution: flowCounts,
    flowPercentage: responses.length > 0 ? 
      Math.round((flowCounts.flow || 0) / responses.length * 100) : 0
  };
};

responseSchema.statics.getQualityTrend = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const responses = await this.find({
    userId,
    timestamp: { $gte: startDate },
    'metadata.dataQualityScore': { $exists: true }
  })
  .sort({ timestamp: 1 });
  
  return responses.map(r => ({
    date: r.timestamp,
    quality: r.metadata.dataQualityScore,
    isTraining: r.metadata.isTraining
  }));
};

module.exports = mongoose.model('Response', responseSchema);