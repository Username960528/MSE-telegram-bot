const Response = require('../models/Response');
const User = require('../models/User');

class PatternAnalysisService {
  
  // Анализ временных паттернов пользователя
  static async analyzeTimePatterns(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const responses = await Response.find({
      userId,
      timestamp: { $gte: startDate },
      'metadata.isComplete': true
    }).sort({ timestamp: 1 });
    
    if (responses.length < 10) {
      return { insufficient_data: true };
    }
    
    const patterns = {
      hourly: {},        // Паттерны по часам дня
      weekday: {},       // Паттерны по дням недели
      trends: {},        // Тренды по времени
      correlations: {}   // Корреляции с временными факторами
    };
    
    // Анализ по часам дня
    responses.forEach(response => {
      const hour = response.timestamp.getHours();
      const mood = response.responses.mood || 0;
      const energy = response.responses.energy || 0;
      const stress = response.responses.stress || 0;
      const flowState = response.metadata?.flowState;
      
      if (!patterns.hourly[hour]) {
        patterns.hourly[hour] = {
          count: 0,
          mood: { sum: 0, avg: 0 },
          energy: { sum: 0, avg: 0 },
          stress: { sum: 0, avg: 0 },
          flowCount: 0
        };
      }
      
      const hourData = patterns.hourly[hour];
      hourData.count++;
      hourData.mood.sum += mood;
      hourData.energy.sum += energy;
      hourData.stress.sum += stress;
      if (flowState === 'flow') hourData.flowCount++;
    });
    
    // Вычисляем средние значения по часам
    Object.keys(patterns.hourly).forEach(hour => {
      const data = patterns.hourly[hour];
      data.mood.avg = data.mood.sum / data.count;
      data.energy.avg = data.energy.sum / data.count;
      data.stress.avg = data.stress.sum / data.count;
      data.flowPercentage = (data.flowCount / data.count) * 100;
    });
    
    // Анализ по дням недели
    responses.forEach(response => {
      const weekday = response.timestamp.getDay(); // 0 = воскресенье
      const mood = response.responses.mood || 0;
      const energy = response.responses.energy || 0;
      const stress = response.responses.stress || 0;
      const flowState = response.metadata?.flowState;
      
      if (!patterns.weekday[weekday]) {
        patterns.weekday[weekday] = {
          count: 0,
          mood: { sum: 0, avg: 0 },
          energy: { sum: 0, avg: 0 },
          stress: { sum: 0, avg: 0 },
          flowCount: 0
        };
      }
      
      const dayData = patterns.weekday[weekday];
      dayData.count++;
      dayData.mood.sum += mood;
      dayData.energy.sum += energy;
      dayData.stress.sum += stress;
      if (flowState === 'flow') dayData.flowCount++;
    });
    
    // Вычисляем средние значения по дням недели
    Object.keys(patterns.weekday).forEach(weekday => {
      const data = patterns.weekday[weekday];
      data.mood.avg = data.mood.sum / data.count;
      data.energy.avg = data.energy.sum / data.count;
      data.stress.avg = data.stress.sum / data.count;
      data.flowPercentage = (data.flowCount / data.count) * 100;
    });
    
    return patterns;
  }
  
  // Анализ активностей и их влияния на состояние
  static async analyzeActivityPatterns(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const responses = await Response.find({
      userId,
      timestamp: { $gte: startDate },
      'responses.currentActivity': { $exists: true, $ne: '' }
    });
    
    const activityImpact = {};
    const activityKeywords = this.extractActivityKeywords(responses);
    
    // Анализируем влияние различных активностей
    responses.forEach(response => {
      const activity = response.responses.currentActivity?.toLowerCase() || '';
      const mood = response.responses.mood || 0;
      const energy = response.responses.energy || 0;
      const stress = response.responses.stress || 0;
      const flowState = response.metadata?.flowState;
      
      // Ищем ключевые слова в активности
      activityKeywords.forEach(keyword => {
        if (activity.includes(keyword)) {
          if (!activityImpact[keyword]) {
            activityImpact[keyword] = {
              count: 0,
              mood: { sum: 0, avg: 0 },
              energy: { sum: 0, avg: 0 },
              stress: { sum: 0, avg: 0 },
              flowCount: 0
            };
          }
          
          const impact = activityImpact[keyword];
          impact.count++;
          impact.mood.sum += mood;
          impact.energy.sum += energy;
          impact.stress.sum += stress;
          if (flowState === 'flow') impact.flowCount++;
        }
      });
    });
    
    // Вычисляем средние значения и фильтруем значимые активности
    const significantActivities = {};
    Object.entries(activityImpact).forEach(([keyword, data]) => {
      if (data.count >= 3) { // Минимум 3 записи для статистической значимости
        data.mood.avg = data.mood.sum / data.count;
        data.energy.avg = data.energy.sum / data.count;
        data.stress.avg = data.stress.sum / data.count;
        data.flowPercentage = (data.flowCount / data.count) * 100;
        significantActivities[keyword] = data;
      }
    });
    
    return significantActivities;
  }
  
  // Анализ социальных паттернов
  static async analyzeSocialPatterns(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const responses = await Response.find({
      userId,
      timestamp: { $gte: startDate },
      'responses.currentCompanion': { $exists: true, $ne: '' }
    });
    
    const socialImpact = {};
    
    responses.forEach(response => {
      const companion = response.responses.currentCompanion?.toLowerCase() || 'один';
      const mood = response.responses.mood || 0;
      const energy = response.responses.energy || 0;
      const stress = response.responses.stress || 0;
      const flowState = response.metadata?.flowState;
      
      // Нормализуем варианты одиночества
      const normalizedCompanion = companion.includes('один') || 
                                 companion.includes('сам') || 
                                 companion.includes('solo') ? 'один' : companion;
      
      if (!socialImpact[normalizedCompanion]) {
        socialImpact[normalizedCompanion] = {
          count: 0,
          mood: { sum: 0, avg: 0 },
          energy: { sum: 0, avg: 0 },
          stress: { sum: 0, avg: 0 },
          flowCount: 0
        };
      }
      
      const impact = socialImpact[normalizedCompanion];
      impact.count++;
      impact.mood.sum += mood;
      impact.energy.sum += energy;
      impact.stress.sum += stress;
      if (flowState === 'flow') impact.flowCount++;
    });
    
    // Вычисляем средние значения
    Object.keys(socialImpact).forEach(companion => {
      const data = socialImpact[companion];
      if (data.count >= 2) { // Минимум 2 записи
        data.mood.avg = data.mood.sum / data.count;
        data.energy.avg = data.energy.sum / data.count;
        data.stress.avg = data.stress.sum / data.count;
        data.flowPercentage = (data.flowCount / data.count) * 100;
      } else {
        delete socialImpact[companion];
      }
    });
    
    return socialImpact;
  }
  
  // Поиск корреляций между параметрами
  static async findCorrelations(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const responses = await Response.find({
      userId,
      timestamp: { $gte: startDate },
      'metadata.isComplete': true
    });
    
    if (responses.length < 15) {
      return { insufficient_data: true };
    }
    
    const correlations = {};
    
    // Корреляция между challenge и skill для Flow
    const challengeSkillData = responses
      .filter(r => r.metadata?.challenge !== undefined && r.metadata?.skill !== undefined)
      .map(r => ({
        challenge: r.metadata.challenge,
        skill: r.metadata.skill,
        isFlow: r.metadata.flowState === 'flow'
      }));
    
    if (challengeSkillData.length >= 10) {
      const flowTriggers = this.analyzeFlowTriggers(challengeSkillData);
      correlations.flowTriggers = flowTriggers;
    }
    
    // Корреляция между временем дня и настроением
    const timeEnergyData = responses.map(r => ({
      hour: r.timestamp.getHours(),
      energy: r.responses.energy || 0,
      mood: r.responses.mood || 0
    }));
    
    correlations.timeEnergy = this.calculateTimeEnergyCorrelation(timeEnergyData);
    
    return correlations;
  }
  
  // Выявление аномалий в поведении
  static async detectAnomalies(userId, days = 7) {
    const recentData = await this.getRecentData(userId, days);
    const historicalData = await this.getRecentData(userId, 30);
    
    if (recentData.length < 5 || historicalData.length < 20) {
      return { insufficient_data: true };
    }
    
    const anomalies = [];
    
    // Сравниваем средние значения за последнюю неделю с историческими
    const recentAvg = this.calculateAverages(recentData);
    const historicalAvg = this.calculateAverages(historicalData);
    
    // Проверяем значительные отклонения (более 1.5 стандартного отклонения)
    const threshold = 1.5;
    
    ['mood', 'energy', 'stress'].forEach(metric => {
      const difference = recentAvg[metric] - historicalAvg[metric];
      const stdDev = this.calculateStandardDeviation(historicalData, metric);
      
      if (Math.abs(difference) > threshold * stdDev) {
        anomalies.push({
          metric,
          type: difference > 0 ? 'increase' : 'decrease',
          magnitude: Math.abs(difference / stdDev),
          recentValue: recentAvg[metric],
          historicalValue: historicalAvg[metric]
        });
      }
    });
    
    return anomalies;
  }
  
  // Создание персонального профиля пользователя
  static async createUserProfile(userId) {
    const [timePatterns, activityPatterns, socialPatterns, correlations, anomalies] = await Promise.all([
      this.analyzeTimePatterns(userId, 30),
      this.analyzeActivityPatterns(userId, 30),
      this.analyzeSocialPatterns(userId, 30),
      this.findCorrelations(userId, 30),
      this.detectAnomalies(userId, 7)
    ]);
    
    const profile = {
      timePatterns,
      activityPatterns,
      socialPatterns,
      correlations,
      anomalies,
      insights: this.generateProfileInsights({
        timePatterns,
        activityPatterns,
        socialPatterns,
        correlations,
        anomalies
      }),
      generatedAt: new Date()
    };
    
    return profile;
  }
  
  // Вспомогательные методы
  static extractActivityKeywords(responses) {
    const allActivities = responses
      .map(r => r.responses.currentActivity?.toLowerCase() || '')
      .filter(activity => activity.length > 0);
    
    const wordCounts = {};
    allActivities.forEach(activity => {
      // Извлекаем значимые слова (исключаем предлоги, союзы и т.д.)
      const words = activity.split(/\s+/)
        .filter(word => word.length > 2)
        .filter(word => !['что', 'как', 'это', 'для', 'при', 'без', 'над', 'под'].includes(word));
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });
    
    // Возвращаем слова, которые встречаются минимум 3 раза
    return Object.entries(wordCounts)
      .filter(([_, count]) => count >= 3)
      .map(([word, _]) => word);
  }
  
  static analyzeFlowTriggers(challengeSkillData) {
    const flowData = challengeSkillData.filter(d => d.isFlow);
    const nonFlowData = challengeSkillData.filter(d => !d.isFlow);
    
    if (flowData.length < 3) {
      return { insufficient_data: true };
    }
    
    const flowAvg = {
      challenge: flowData.reduce((sum, d) => sum + d.challenge, 0) / flowData.length,
      skill: flowData.reduce((sum, d) => sum + d.skill, 0) / flowData.length
    };
    
    const optimalZone = {
      challengeRange: [
        Math.max(0, flowAvg.challenge - 1),
        Math.min(9, flowAvg.challenge + 1)
      ],
      skillRange: [
        Math.max(0, flowAvg.skill - 1),
        Math.min(9, flowAvg.skill + 1)
      ],
      balance: Math.abs(flowAvg.challenge - flowAvg.skill)
    };
    
    return { flowAvg, optimalZone };
  }
  
  static calculateTimeEnergyCorrelation(timeEnergyData) {
    // Группируем по часам и вычисляем средние значения
    const hourlyData = {};
    timeEnergyData.forEach(({ hour, energy, mood }) => {
      if (!hourlyData[hour]) {
        hourlyData[hour] = { energy: [], mood: [] };
      }
      hourlyData[hour].energy.push(energy);
      hourlyData[hour].mood.push(mood);
    });
    
    const patterns = {};
    Object.entries(hourlyData).forEach(([hour, data]) => {
      if (data.energy.length >= 2) {
        patterns[hour] = {
          avgEnergy: data.energy.reduce((a, b) => a + b, 0) / data.energy.length,
          avgMood: data.mood.reduce((a, b) => a + b, 0) / data.mood.length,
          count: data.energy.length
        };
      }
    });
    
    return patterns;
  }
  
  static async getRecentData(userId, days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await Response.find({
      userId,
      timestamp: { $gte: startDate },
      'metadata.isComplete': true
    });
  }
  
  static calculateAverages(responses) {
    const sums = { mood: 0, energy: 0, stress: 0 };
    let count = 0;
    
    responses.forEach(response => {
      if (response.responses.mood) {
        sums.mood += response.responses.mood;
        sums.energy += response.responses.energy || 0;
        sums.stress += response.responses.stress || 0;
        count++;
      }
    });
    
    return count > 0 ? {
      mood: sums.mood / count,
      energy: sums.energy / count,
      stress: sums.stress / count
    } : { mood: 0, energy: 0, stress: 0 };
  }
  
  static calculateStandardDeviation(responses, metric) {
    const values = responses
      .map(r => r.responses[metric])
      .filter(v => v !== undefined && v !== null);
    
    if (values.length < 2) return 1;
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(variance);
  }
  
  static generateProfileInsights(profileData) {
    const insights = [];
    
    // Анализ временных паттернов
    if (profileData.timePatterns && !profileData.timePatterns.insufficient_data) {
      const hourlyPatterns = profileData.timePatterns.hourly;
      
      // Находим лучшее время дня для настроения
      let bestMoodHour = -1;
      let bestMoodScore = 0;
      let worstMoodHour = -1;
      let worstMoodScore = 10;
      
      Object.entries(hourlyPatterns).forEach(([hour, data]) => {
        if (data.count >= 2) {
          if (data.mood.avg > bestMoodScore) {
            bestMoodScore = data.mood.avg;
            bestMoodHour = hour;
          }
          if (data.mood.avg < worstMoodScore) {
            worstMoodScore = data.mood.avg;
            worstMoodHour = hour;
          }
        }
      });
      
      if (bestMoodHour !== -1) {
        insights.push({
          type: 'time_pattern',
          category: 'best_mood_time',
          hour: bestMoodHour,
          score: bestMoodScore,
          message: `Ваше настроение лучше всего в ${bestMoodHour}:00`
        });
      }
      
      if (worstMoodHour !== -1 && worstMoodScore < 4) {
        insights.push({
          type: 'time_pattern',
          category: 'challenging_time',
          hour: worstMoodHour,
          score: worstMoodScore,
          message: `В ${worstMoodHour}:00 настроение обычно снижается`
        });
      }
    }
    
    return insights;
  }
}

module.exports = PatternAnalysisService;