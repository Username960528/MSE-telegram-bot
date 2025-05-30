const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/User');
const Response = require('../models/Response');
const config = require('../config/hurlburt');

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
        
        // Check for missed notifications and handle escalation
        this.scheduleEscalationCheck();
        
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
        
        // Reset escalation when user responds
        await this.resetEscalation(userId);
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

    /**
     * Schedule escalation check every minute
     */
    scheduleEscalationCheck() {
        cron.schedule('* * * * *', async () => {
            await this.checkForMissedNotifications();
            await this.processEscalations();
        });
    }

    /**
     * Check for missed notifications and start escalation
     */
    async checkForMissedNotifications() {
        const now = new Date();
        const timeoutMinutes = config.escalation.responseTimeoutMinutes;
        const timeoutThreshold = new Date(now.getTime() - (timeoutMinutes * 60 * 1000));

        // Find notifications that haven't been responded to
        const missedNotifications = await Response.find({
            notificationSentAt: { $lte: timeoutThreshold },
            responseStartedAt: null,
            missedReason: null
        }).populate('userId');

        for (const response of missedNotifications) {
            const user = response.userId;
            if (user && user.isActive && user.settings.notificationsEnabled) {
                await this.startEscalation(user, response);
            }
        }
    }

    /**
     * Start escalation for a user
     */
    async startEscalation(user, missedResponse) {
        try {
            // Initialize escalation state if not already escalating
            if (!user.escalationState) {
                user.escalationState = {
                    isEscalating: false,
                    escalationLevel: 0,
                    missedNotificationsCount: 0
                };
            }

            if (!user.escalationState.isEscalating) {
                user.escalationState.isEscalating = true;
                user.escalationState.escalationLevel = 1;
                user.escalationState.escalationStartedAt = new Date();
                user.escalationState.missedNotificationsCount = 1;
                
                console.log(`Starting escalation for user ${user.getFullName()}`);
            } else {
                user.escalationState.missedNotificationsCount++;
            }

            // Mark the missed response
            missedResponse.missedReason = 'timeout_escalation';
            await missedResponse.save();

            // Schedule first escalation notification
            await this.scheduleEscalationNotification(user);
            await user.save();

        } catch (error) {
            console.error(`Error starting escalation for user ${user.telegramId}:`, error);
        }
    }

    /**
     * Process ongoing escalations
     */
    async processEscalations() {
        const now = new Date();
        
        // Find users currently in escalation with due notifications
        const escalatingUsers = await User.find({
            'escalationState.isEscalating': true,
            'escalationState.lastEscalationNotificationAt': { $lte: now }
        });

        for (const user of escalatingUsers) {
            await this.handleEscalationNotification(user);
        }
    }

    /**
     * Handle escalation notification for a specific user
     */
    async handleEscalationNotification(user) {
        try {
            // Check if escalation should continue
            if (!this.shouldContinueEscalation(user)) {
                await this.stopEscalation(user, 'timeout_reached');
                return;
            }

            // Send escalation notification
            await this.sendEscalationNotification(user);
            
            // Increase escalation level
            user.escalationState.escalationLevel = Math.min(
                user.escalationState.escalationLevel + 1,
                config.escalation.maxEscalationLevel
            );

            // Schedule next escalation notification
            await this.scheduleEscalationNotification(user);
            await user.save();

        } catch (error) {
            console.error(`Error handling escalation for user ${user.telegramId}:`, error);
        }
    }

    /**
     * Send escalation notification
     */
    async sendEscalationNotification(user) {
        try {
            const level = user.escalationState.escalationLevel;
            const levelKey = `level${level}`;
            
            // Get escalation message
            const message = config.escalation.messages[levelKey] || 
                           config.escalation.messages.level1;

            // Create response record
            const response = new Response({
                userId: user._id,
                telegramId: user.telegramId,
                notificationSentAt: new Date(),
                metadata: {
                    isEscalation: true,
                    escalationLevel: level
                }
            });
            await response.save();

            // Send notification with escalation urgency
            const keyboard = {
                inline_keyboard: [[
                    { text: '📝 Начать опрос', callback_data: `start_survey_${response._id}` },
                    { text: '🚫 Пропустить', callback_data: `skip_survey_${response._id}` }
                ]]
            };

            const fullMessage = `${message}\n\n` +
                `Это займет всего 2-3 минуты. Расскажите, как вы себя чувствуете прямо сейчас.`;

            await this.bot.sendMessage(user.telegramId, fullMessage, {
                reply_markup: keyboard
            });

            console.log(`Escalation notification (level ${level}) sent to ${user.getFullName()}`);

        } catch (error) {
            console.error(`Failed to send escalation notification to user ${user.telegramId}:`, error);
        }
    }

    /**
     * Schedule next escalation notification
     */
    async scheduleEscalationNotification(user) {
        const level = user.escalationState.escalationLevel;
        const levelKey = `level${Math.min(level, config.escalation.maxEscalationLevel)}`;
        const intervals = config.escalation.intervals[levelKey] || 
                         config.escalation.intervals.level1;

        // Generate random interval
        const randomMinutes = intervals.min + 
            Math.floor(Math.random() * (intervals.max - intervals.min + 1));

        const nextNotificationTime = new Date(Date.now() + (randomMinutes * 60 * 1000));
        user.escalationState.lastEscalationNotificationAt = nextNotificationTime;

        console.log(`Next escalation notification for ${user.getFullName()} scheduled in ${randomMinutes} minutes`);
    }

    /**
     * Check if escalation should continue
     */
    shouldContinueEscalation(user) {
        const now = new Date();
        const escalationStarted = new Date(user.escalationState.escalationStartedAt);
        const maxHours = config.escalation.stopConditions.maxEscalationHours;
        const maxTime = new Date(escalationStarted.getTime() + (maxHours * 60 * 60 * 1000));

        // Stop if max time reached
        if (now > maxTime) {
            return false;
        }

        // Stop if outside time window (if configured)
        if (config.escalation.stopConditions.respectTimeWindow) {
            const timezone = user.settings.timezone;
            const userNow = moment().tz(timezone);
            const [startHour, startMinute] = user.settings.notificationStartTime.split(':').map(Number);
            const [endHour, endMinute] = user.settings.notificationEndTime.split(':').map(Number);
            
            const windowStart = userNow.clone().hour(startHour).minute(startMinute);
            const windowEnd = userNow.clone().hour(endHour).minute(endMinute);
            
            if (!userNow.isBetween(windowStart, windowEnd)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Stop escalation for a user
     */
    async stopEscalation(user, reason = 'completed') {
        console.log(`Stopping escalation for ${user.getFullName()}: ${reason}`);
        
        user.escalationState.isEscalating = false;
        user.escalationState.escalationLevel = 0;
        user.escalationState.lastEscalationNotificationAt = null;
        
        if (reason === 'completed') {
            user.escalationState.lastResponseAt = new Date();
            user.escalationState.missedNotificationsCount = 0;
        }
        
        await user.save();
    }

    /**
     * Reset escalation when user responds
     */
    async resetEscalation(userId) {
        const user = await User.findOne({ telegramId: userId });
        if (user && user.escalationState && user.escalationState.isEscalating) {
            await this.stopEscalation(user, 'completed');
        }
    }
}

module.exports = NotificationScheduler;