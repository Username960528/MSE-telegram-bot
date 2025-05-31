const User = require('../models/User');
const Response = require('../models/Response');

class GamificationService {
  
  // Обработка нового ответа для геймификации
  static async processResponse(user, response) {
    const achievements = [];
    let levelUp = false;
    
    // Базовые очки за ответ
    let experienceGained = 10;
    
    // Обновляем ежедневный стрик
    const dailyStreak = user.updateStreak('daily');
    
    // Проверяем качество ответа
    const isHighQuality = response.metadata?.dataQualityScore >= 70;
    if (isHighQuality) {
      experienceGained += 15;
      const qualityStreak = user.updateStreak('quality');
      
      // Достижение за качественные ответы
      if (qualityStreak === 10) {
        achievements.push(await this.unlockAchievement(user, 'quality_master', 
          '🎯 Мастер качества: 10 качественных ответов подряд!'));
      }
    }
    
    // Проверяем Flow состояние
    const isFlowState = response.metadata?.flowState === 'flow';
    if (isFlowState) {
      experienceGained += 25;
      const flowStreak = user.updateStreak('flow');
      
      // Первое flow состояние
      if (!user.achievements.find(a => a.type === 'flow_finder')) {
        achievements.push(await this.unlockAchievement(user, 'flow_finder', 
          '🌊 Первый поток: Вы достигли состояния Flow!'));
      }
      
      // Стрик flow состояний
      if (flowStreak === 5) {
        achievements.push(await this.unlockAchievement(user, 'flow_seeker', 
          '🌊 Искатель потока: 5 Flow состояний подряд!'));
      }
    }
    
    // Проверяем время ответа для специальных достижений
    const hour = response.timestamp.getHours();
    if (hour >= 22 || hour <= 5) {
      if (!user.achievements.find(a => a.type === 'night_owl')) {
        achievements.push(await this.unlockAchievement(user, 'night_owl', 
          '🦉 Ночная сова: Ответ в позднее время!'));
      }
    }
    
    if (hour >= 5 && hour <= 7) {
      if (!user.achievements.find(a => a.type === 'early_bird')) {
        achievements.push(await this.unlockAchievement(user, 'early_bird', 
          '🐦 Ранняя пташка: Ответ рано утром!'));
      }
    }
    
    // Достижения по стрикам
    if (dailyStreak === 7) {
      achievements.push(await this.unlockAchievement(user, 'daily_warrior', 
        '⚔️ Ежедневный воин: 7 дней подряд!'));
    }
    
    if (dailyStreak === 30) {
      achievements.push(await this.unlockAchievement(user, 'weekly_champion', 
        '👑 Чемпион недель: 30 дней подряд!'));
    }
    
    // Достижения по количеству ответов
    if (user.totalResponses === 100) {
      achievements.push(await this.unlockAchievement(user, 'century_club', 
        '💯 Клуб сотни: 100 ответов!'));
    }
    
    // Добавляем опыт и проверяем повышение уровня
    levelUp = user.addExperience(experienceGained);
    
    // Обновляем рейтинговые метрики
    await this.updateRankingMetrics(user, response);
    
    await user.save();
    
    return {
      achievements,
      levelUp,
      experienceGained,
      streaks: {
        daily: dailyStreak,
        quality: user.streaks.current.quality.count,
        flow: user.streaks.current.flow.count
      },
      level: user.level.current,
      progress: user.getProgressToNextLevel()
    };
  }
  
  // Разблокировка достижения
  static async unlockAchievement(user, type, description) {
    const unlocked = user.unlockAchievement(type, description);
    if (unlocked) {
      return {
        type,
        description,
        rarity: user.getAchievementRarity(type),
        isNew: true
      };
    }
    return null;
  }
  
  // Обновление метрик для рейтинга
  static async updateRankingMetrics(user, response) {
    const now = new Date();
    
    // Генерируем анонимный ID если нужно
    user.generateAnonymousId();
    
    // Обновляем еженедельные метрики
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    if (!user.rankings.lastRankingUpdate || user.rankings.lastRankingUpdate < weekStart) {
      user.rankings.weeklyScore = 0;
    }
    
    // Добавляем очки за этот ответ
    let weeklyPoints = 10; // базовые очки
    if (response.metadata?.dataQualityScore >= 70) weeklyPoints += 15;
    if (response.metadata?.flowState === 'flow') weeklyPoints += 25;
    
    user.rankings.weeklyScore += weeklyPoints;
    user.rankings.lastRankingUpdate = now;
    
    // Обновляем средние показатели
    const recentResponses = await Response.find({
      userId: user._id,
      timestamp: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
    });
    
    if (recentResponses.length > 0) {
      const qualityScores = recentResponses
        .map(r => r.metadata?.dataQualityScore)
        .filter(score => score !== undefined);
      
      if (qualityScores.length > 0) {
        user.rankings.qualityAverage = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
      }
      
      const flowCount = recentResponses.filter(r => r.metadata?.flowState === 'flow').length;
      user.rankings.flowPercentage = (flowCount / recentResponses.length) * 100;
    }
  }
  
  // Получение топ пользователей (анонимно)
  static async getLeaderboards() {
    const weeklyTop = await User.find({
      'rankings.weeklyScore': { $gt: 0 }
    })
    .sort({ 'rankings.weeklyScore': -1 })
    .limit(10)
    .select('rankings level streaks');
    
    const qualityTop = await User.find({
      'rankings.qualityAverage': { $gt: 0 }
    })
    .sort({ 'rankings.qualityAverage': -1 })
    .limit(10)
    .select('rankings level');
    
    const flowTop = await User.find({
      'rankings.flowPercentage': { $gt: 0 }
    })
    .sort({ 'rankings.flowPercentage': -1 })
    .limit(10)
    .select('rankings level');
    
    const streakTop = await User.find({
      'streaks.current.daily.count': { $gt: 0 }
    })
    .sort({ 'streaks.current.daily.count': -1 })
    .limit(10)
    .select('rankings streaks level');
    
    return {
      weekly: this.formatLeaderboard(weeklyTop, 'weeklyScore'),
      quality: this.formatLeaderboard(qualityTop, 'qualityAverage'),
      flow: this.formatLeaderboard(flowTop, 'flowPercentage'),
      streaks: this.formatLeaderboard(streakTop, 'dailyStreak')
    };
  }
  
  // Форматирование лидерборда
  static formatLeaderboard(users, scoreType) {
    return users.map((user, index) => {
      let score;
      switch(scoreType) {
        case 'weeklyScore':
          score = user.rankings.weeklyScore;
          break;
        case 'qualityAverage':
          score = Math.round(user.rankings.qualityAverage);
          break;
        case 'flowPercentage':
          score = Math.round(user.rankings.flowPercentage);
          break;
        case 'dailyStreak':
          score = user.streaks.current.daily.count;
          break;
        default:
          score = 0;
      }
      
      return {
        position: index + 1,
        anonymousId: user.rankings.anonymousId,
        score,
        level: user.level.current,
        title: user.level.title
      };
    });
  }
  
  // Получение позиции пользователя в рейтинге
  static async getUserRanking(userId, type = 'weekly') {
    let sortField;
    switch(type) {
      case 'weekly':
        sortField = 'rankings.weeklyScore';
        break;
      case 'quality':
        sortField = 'rankings.qualityAverage';
        break;
      case 'flow':
        sortField = 'rankings.flowPercentage';
        break;
      case 'streak':
        sortField = 'streaks.current.daily.count';
        break;
      default:
        sortField = 'rankings.weeklyScore';
    }
    
    const userPosition = await User.countDocuments({
      [sortField]: { 
        $gt: await User.findById(userId).select(sortField).then(user => {
          switch(type) {
            case 'weekly':
              return user?.rankings?.weeklyScore || 0;
            case 'quality':
              return user?.rankings?.qualityAverage || 0;
            case 'flow':
              return user?.rankings?.flowPercentage || 0;
            case 'streak':
              return user?.streaks?.current?.daily?.count || 0;
            default:
              return 0;
          }
        })
      }
    });
    
    return userPosition + 1;
  }
  
  // Генерация мотивационного сообщения
  static generateMotivationalMessage(user, gamificationResult) {
    const messages = [];
    
    if (gamificationResult.levelUp) {
      messages.push(`🎉 Поздравляем! Новый уровень ${user.level.current} - ${user.level.title}!`);
    }
    
    if (gamificationResult.achievements.length > 0) {
      gamificationResult.achievements.forEach(achievement => {
        const rarityEmoji = {
          'common': '🥉',
          'rare': '🥈', 
          'epic': '🥇',
          'legendary': '👑'
        };
        messages.push(`${rarityEmoji[achievement.rarity]} ${achievement.description}`);
      });
    }
    
    // Мотивационные сообщения для стриков
    const dailyStreak = gamificationResult.streaks.daily;
    if (dailyStreak > 1 && dailyStreak < 7) {
      messages.push(`🔥 Стрик ${dailyStreak} дней! До награды "Ежедневный воин" осталось ${7 - dailyStreak} дней`);
    }
    
    return messages;
  }
}

module.exports = GamificationService;