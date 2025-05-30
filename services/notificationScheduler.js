const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/User');
const Response = require('../models/Response');

class NotificationScheduler {
    constructor(bot) {
        this.bot = bot;
        this.scheduledJobs = new Map();
    }

    /**
     * Initialize the scheduler and start all cron jobs
     */
    async initialize() {
        console.log('Initializing notification scheduler...');
        
        // Schedule daily notification planning at midnight for each timezone
        this.scheduleDaily();
        
        // Check for pending notifications every minute
        this.schedulePendingNotifications();
        
        // Plan notifications for all active users on startup
        await this.planAllUserNotifications();
        
        console.log('Notification scheduler initialized');
    }

    /**
     * Schedule daily notification planning
     */
    scheduleDaily() {
        // Run every hour to catch different timezones' midnight
        cron.schedule('0 * * * *', async () => {
            console.log('Running hourly timezone check for daily planning...');
            
            // Get all unique timezones
            const users = await User.find({ 
                isActive: true, 
                'settings.notificationsEnabled': true 
            });
            
            const timezoneGroups = {};
            users.forEach(user => {
                const tz = user.settings.timezone;
                if (!timezoneGroups[tz]) {
                    timezoneGroups[tz] = [];
                }
                timezoneGroups[tz].push(user);
            });
            
            // Check if it's midnight in any timezone
            for (const [timezone, tzUsers] of Object.entries(timezoneGroups)) {
                const now = moment().tz(timezone);
                if (now.hour() === 0 && now.minute() < 5) {
                    console.log(`Planning notifications for ${tzUsers.length} users in ${timezone}`);
                    for (const user of tzUsers) {
                        await this.planUserNotifications(user);
                    }
                }
            }
        });
    }

    /**
     * Check for pending notifications every minute
     */
    schedulePendingNotifications() {
        cron.schedule('* * * * *', async () => {
            const now = new Date();
            
            // Find users with pending notifications
            const users = await User.find({
                isActive: true,
                'settings.notificationsEnabled': true,
                nextNotificationAt: { $lte: now }
            });
            
            for (const user of users) {
                await this.sendNotification(user);
            }
        });
    }

    /**
     * Plan notifications for all active users
     */
    async planAllUserNotifications() {
        const users = await User.find({
            isActive: true,
            'settings.notificationsEnabled': true
        });
        
        console.log(`Planning notifications for ${users.length} active users`);
        
        for (const user of users) {
            await this.planUserNotifications(user);
        }
    }

    /**
     * Plan notifications for a specific user for the current day
     */
    async planUserNotifications(user) {
        const timezone = user.settings.timezone;
        const now = moment().tz(timezone);
        const startOfDay = now.clone().startOf('day');
        const endOfDay = now.clone().endOf('day');
        
        // Parse notification window times
        const [startHour, startMinute] = user.settings.notificationStartTime.split(':').map(Number);
        const [endHour, endMinute] = user.settings.notificationEndTime.split(':').map(Number);
        
        const windowStart = startOfDay.clone().hour(startHour).minute(startMinute);
        const windowEnd = startOfDay.clone().hour(endHour).minute(endMinute);
        
        // If we're already past the window end, plan for tomorrow
        if (now.isAfter(windowEnd)) {
            windowStart.add(1, 'day');
            windowEnd.add(1, 'day');
        }
        
        // Generate random times within the window
        const notificationTimes = this.generateRandomTimes(
            windowStart,
            windowEnd,
            user.settings.notificationsPerDay,
            now
        );
        
        // Set the next notification time
        if (notificationTimes.length > 0) {
            user.nextNotificationAt = notificationTimes[0].toDate();
            await user.save();
            console.log(`Planned ${notificationTimes.length} notifications for user ${user.getFullName()}`);
        }
    }

    /**
     * Generate random notification times within a window
     */
    generateRandomTimes(windowStart, windowEnd, count, currentTime) {
        const times = [];
        const windowDuration = windowEnd.diff(windowStart, 'minutes');
        const minInterval = Math.floor(windowDuration / (count + 1));
        
        // Generate evenly distributed random times
        for (let i = 0; i < count; i++) {
            const segmentStart = windowStart.clone().add(i * minInterval, 'minutes');
            const segmentEnd = windowStart.clone().add((i + 1) * minInterval, 'minutes');
            
            // Random time within this segment
            const randomMinutes = Math.floor(Math.random() * minInterval);
            const notificationTime = segmentStart.clone().add(randomMinutes, 'minutes');
            
            // Only add if it's in the future
            if (notificationTime.isAfter(currentTime)) {
                times.push(notificationTime);
            }
        }
        
        return times.sort((a, b) => a.valueOf() - b.valueOf());
    }

    /**
     * Send a notification to a user
     */
    async sendNotification(user) {
        try {
            // Create a new response record
            const response = new Response({
                userId: user._id,
                telegramId: user.telegramId,
                notificationSentAt: new Date()
            });
            await response.save();
            
            // Send the notification
            const keyboard = {
                inline_keyboard: [[
                    { text: '📝 Начать опрос', callback_data: `start_survey_${response._id}` },
                    { text: '🚫 Пропустить', callback_data: `skip_survey_${response._id}` }
                ]]
            };
            
            const message = `🔔 Время для короткого опроса!\n\n` +
                `Это займет всего 2-3 минуты. Расскажите, как вы себя чувствуете прямо сейчас.`;
            
            await this.bot.sendMessage(user.telegramId, message, {
                reply_markup: keyboard
            });
            
            console.log(`Notification sent to ${user.getFullName()}`);
            
            // Plan next notification
            await this.planNextNotification(user);
            
        } catch (error) {
            console.error(`Failed to send notification to user ${user.telegramId}:`, error);
        }
    }

    /**
     * Plan the next notification for a user
     */
    async planNextNotification(user) {
        const timezone = user.settings.timezone;
        const now = moment().tz(timezone);
        
        // Get today's notification window
        const [startHour, startMinute] = user.settings.notificationStartTime.split(':').map(Number);
        const [endHour, endMinute] = user.settings.notificationEndTime.split(':').map(Number);
        
        const windowEnd = now.clone().hour(endHour).minute(endMinute);
        
        // Count today's notifications
        const startOfDay = now.clone().startOf('day');
        const endOfDay = now.clone().endOf('day');
        
        const todayNotifications = await Response.countDocuments({
            userId: user._id,
            notificationSentAt: {
                $gte: startOfDay.toDate(),
                $lte: endOfDay.toDate()
            }
        });
        
        // If we haven't reached the daily limit and we're still within today's window
        if (todayNotifications < user.settings.notificationsPerDay && now.isBefore(windowEnd)) {
            // Calculate remaining notifications for today
            const remainingToday = user.settings.notificationsPerDay - todayNotifications;
            const remainingMinutes = windowEnd.diff(now, 'minutes');
            
            if (remainingMinutes > 30) { // At least 30 minutes left in window
                // Schedule next notification today
                const minInterval = Math.max(30, Math.floor(remainingMinutes / (remainingToday + 1)));
                const randomDelay = 15 + Math.floor(Math.random() * (minInterval - 15));
                
                user.nextNotificationAt = now.clone().add(randomDelay, 'minutes').toDate();
            } else {
                // Schedule for tomorrow
                await this.scheduleForTomorrow(user);
            }
        } else {
            // Schedule for tomorrow
            await this.scheduleForTomorrow(user);
        }
        
        await user.save();
    }

    /**
     * Schedule the first notification for tomorrow
     */
    async scheduleForTomorrow(user) {
        const timezone = user.settings.timezone;
        const tomorrow = moment().tz(timezone).add(1, 'day').startOf('day');
        
        const [startHour, startMinute] = user.settings.notificationStartTime.split(':').map(Number);
        const [endHour, endMinute] = user.settings.notificationEndTime.split(':').map(Number);
        
        const windowStart = tomorrow.clone().hour(startHour).minute(startMinute);
        const windowEnd = tomorrow.clone().hour(endHour).minute(endMinute);
        
        // Generate all notifications for tomorrow
        const notificationTimes = this.generateRandomTimes(
            windowStart,
            windowEnd,
            user.settings.notificationsPerDay,
            moment().tz(timezone)
        );
        
        if (notificationTimes.length > 0) {
            user.nextNotificationAt = notificationTimes[0].toDate();
        }
    }

    /**
     * Handle survey start callback
     */
    async handleSurveyStart(responseId, userId) {
        const response = await Response.findById(responseId);
        if (response) {
            response.responseStartedAt = new Date();
            await response.save();
        }
    }

    /**
     * Handle survey skip callback
     */
    async handleSurveySkip(responseId, userId, reason = 'user_skipped') {
        const response = await Response.findById(responseId);
        if (response) {
            response.missedReason = reason;
            response.isComplete = false;
            await response.save();
        }
    }
}

module.exports = NotificationScheduler;