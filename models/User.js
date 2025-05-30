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
  nextNotificationAt: Date
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