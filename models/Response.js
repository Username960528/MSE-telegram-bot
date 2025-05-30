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
      min: 1,
      max: 7
    },
    currentThoughts: String,
    currentActivity: String,
    currentEmotions: String
  },
  metadata: {
    responseTime: Number,
    isComplete: {
      type: Boolean,
      default: false
    },
    missedReason: String
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
  
  next();
});

module.exports = mongoose.model('Response', responseSchema);