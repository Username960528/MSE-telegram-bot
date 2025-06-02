const pushover = require('pushover-notifications');

class PushoverService {
    constructor() {
        this.appToken = process.env.PUSHOVER_APP_TOKEN;
        if (!this.appToken) {
            console.warn('PUSHOVER_APP_TOKEN not set. Pushover notifications will be disabled.');
        }
    }

    /**
     * Send Pushover notification to user's watch/devices
     */
    async sendNotification(user, message, options = {}) {
        // Check if Pushover is enabled for this user
        if (!this.isEnabled(user)) {
            return { success: false, reason: 'pushover_disabled' };
        }

        try {
            const client = new pushover({
                user: user.settings.pushover.userKey,
                token: this.appToken
            });

            const notification = {
                message: message,
                title: options.title || '🔔 Время опроса',
                priority: user.settings.pushover.priority,
                sound: user.settings.pushover.sound,
                retry: options.retry || 30, // Repeat every 30 seconds
                expire: options.expire || 300, // Stop after 5 minutes
                url: options.url,
                url_title: options.urlTitle
            };

            // For high priority notifications, ensure they get through
            if (user.settings.pushover.priority === 2) {
                notification.retry = 30;
                notification.expire = 600; // 10 minutes for emergency notifications
            }

            const result = await new Promise((resolve, reject) => {
                client.send(notification, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });

            console.log(`Pushover notification sent to ${user.getFullName()}: ${result.status}`);
            return { 
                success: true, 
                result,
                receipt: result.receipt // For tracking emergency notifications
            };

        } catch (error) {
            console.error(`Failed to send Pushover notification to ${user.getFullName()}:`, error);
            return { 
                success: false, 
                error: error.message,
                reason: 'send_failed'
            };
        }
    }

    /**
     * Send survey notification specifically formatted for watches
     */
    async sendSurveyNotification(user, responseId, options = {}) {
        const message = 'Время для короткого опроса! Это займет всего 2-3 минуты. Расскажи, как ты себя чувствуешь прямо сейчас.';
        
        const notificationOptions = {
            title: '🔔 MSE Опрос',
            url: `https://t.me/${process.env.BOT_USERNAME}`,
            urlTitle: 'Открыть бота',
            ...options
        };

        return await this.sendNotification(user, message, notificationOptions);
    }

    /**
     * Send escalation notification with higher priority
     */
    async sendEscalationNotification(user, escalationMessage, level, responseId) {
        const message = `${escalationMessage}\n\nЭто займет всего 2-3 минуты. Пожалуйста, ответьте как можно скорее.`;
        
        // Increase priority for escalations
        const originalPriority = user.settings.pushover.priority;
        const escalationPriority = Math.min(originalPriority + 1, 2);

        const options = {
            title: `🚨 Срочно: Опрос (уровень ${level})`,
            priority: escalationPriority,
            retry: 15, // More frequent for escalations
            expire: 900, // 15 minutes
            url: `https://t.me/${process.env.BOT_USERNAME}`,
            urlTitle: 'Ответить сейчас'
        };

        return await this.sendNotification(user, message, options);
    }

    /**
     * Test Pushover connection with user's token
     */
    async testConnection(userKey) {
        if (!this.appToken) {
            return { success: false, error: 'App token not configured' };
        }

        try {
            const client = new pushover({
                user: userKey,
                token: this.appToken
            });

            const result = await new Promise((resolve, reject) => {
                client.send({
                    message: 'Тест подключения Pushover успешен! 🎉',
                    title: 'MSE Bot - Тест',
                    priority: 0
                }, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });

            return { success: true, result };

        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    /**
     * Check if Pushover is properly configured and enabled for user
     */
    isEnabled(user) {
        return this.appToken && 
               user.settings.pushover.enabled && 
               user.settings.pushover.userKey;
    }

    /**
     * Get Pushover setup instructions for user
     */
    getSetupInstructions() {
        return `📱 Настройка уведомлений на часы через Pushover:

1. Установите приложение Pushover на телефон
2. Зарегистрируйтесь и получите User Key
3. Настройте пересылку на ваши часы (Garmin/Apple Watch/Wear OS)
4. Введите команду /pushover_setup [ваш_user_key]

Преимущества:
✅ Уведомления приходят прямо на часы
✅ Высокий приоритет - пробивается через DND
✅ Настраиваемые звуки и вибрация
✅ Повторные напоминания при пропуске

Стоимость: ~ за iOS/Android`;
    }

    /**
     * Validate Pushover user key format
     */
    validateUserKey(userKey) {
        // Pushover user keys are 30 characters long, alphanumeric
        const keyRegex = /^[a-zA-Z0-9]{30}$/;
        return keyRegex.test(userKey);
    }

    /**
     * Get available sounds for Pushover notifications
     */
    getAvailableSounds() {
        return [
            'pushover', 'bike', 'bugle', 'cashregister', 'classical', 
            'cosmic', 'falling', 'gamelan', 'incoming', 'intermission',
            'magic', 'mechanical', 'pianobar', 'siren', 'spacealarm',
            'tugboat', 'alien', 'climb', 'persistent', 'echo', 'updown', 'none'
        ];
    }

    /**
     * Get priority levels with descriptions
     */
    getPriorityLevels() {
        return {
            '-2': 'Тихие (без звука)',
            '-1': 'Обычные (без звука если телефон в беззвучном режиме)',
            '0': 'Обычные (со звуком)',
            '1': 'Высокий приоритет (пробивается через DND)',
            '2': 'Экстренные (требуют подтверждения)'
        };
    }
}

module.exports = PushoverService;