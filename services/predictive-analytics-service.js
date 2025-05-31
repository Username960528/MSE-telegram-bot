const Response = require('../models/Response');
const PatternAnalysisService = require('./pattern-analysis-service');

/**
 * Сервис предиктивной аналитики для прогнозирования состояний пользователя
 */
class PredictiveAnalyticsService {
  
  // Главный метод для получения предсказаний
  static async generatePredictions(userId, context = {}) {
    const predictions = {};
    
    try {
      // Получаем различные типы предсказаний
      const [
        timeBased,
        trendBased,
        activityBased,
        socialBased,
        flowPrediction
      ] = await Promise.all([
        this.predictByTimePatterns(userId, context),
        this.predictByTrends(userId),
        this.predictByActivity(userId, context),
        this.predictBySocialContext(userId, context),
        this.predictFlowStates(userId, context)
      ]);
      
      predictions.timeBased = timeBased;
      predictions.trendBased = trendBased;
      predictions.activityBased = activityBased;
      predictions.socialBased = socialBased;
      predictions.flowPrediction = flowPrediction;
      
      // Создаем общий прогноз, комбинируя все источники
      predictions.combined = this.combineAllPredictions([
        timeBased, trendBased, activityBased, socialBased
      ]);
      
      // Генерируем рекомендации на основе предсказаний
      predictions.recommendations = this.generateRecommendations(predictions);
      
      // Алерты о потенциальных проблемах или возможностях
      predictions.alerts = await this.generateAlerts(userId, predictions);
      
      return {
        predictions,
        generatedAt: new Date(),
        confidence: this.calculateOverallConfidence(predictions),
        source: 'predictive_analytics'
      };
      
    } catch (error) {
      console.error('Error in predictive analytics:', error);
      return {
        predictions: {},
        error: error.message,
        generatedAt: new Date(),
        source: 'predictive_analytics'
      };
    }
  }
  
  // Предсказания на основе временных паттернов
  static async predictByTimePatterns(userId, context) {
    const timePatterns = await PatternAnalysisService.analyzeTimePatterns(userId, 30);
    
    if (timePatterns.insufficient_data) {
      return { insufficient_data: true };
    }
    
    const now = context.currentTime || new Date();
    const currentHour = now.getHours();
    const currentWeekday = now.getDay();
    const nextHour = (currentHour + 1) % 24;
    const predictions = {};
    
    // Предсказание на текущий час
    if (timePatterns.hourly[currentHour]) {
      const hourData = timePatterns.hourly[currentHour];
      predictions.currentHour = {
        mood: {
          predicted: hourData.mood.avg,
          confidence: Math.min(0.9, hourData.count / 10)
        },
        energy: {
          predicted: hourData.energy.avg,
          confidence: Math.min(0.9, hourData.count / 10)
        },
        stress: {
          predicted: hourData.stress.avg,
          confidence: Math.min(0.9, hourData.count / 10)
        },
        flowProbability: hourData.flowPercentage / 100
      };
    }
    
    // Предсказание на следующий час
    if (timePatterns.hourly[nextHour]) {
      const nextHourData = timePatterns.hourly[nextHour];
      predictions.nextHour = {
        mood: {
          predicted: nextHourData.mood.avg,
          confidence: Math.min(0.8, nextHourData.count / 10)
        },
        energy: {
          predicted: nextHourData.energy.avg,
          confidence: Math.min(0.8, nextHourData.count / 10)
        },
        stress: {
          predicted: nextHourData.stress.avg,
          confidence: Math.min(0.8, nextHourData.count / 10)
        }
      };
    }
    
    // Предсказание на завтра (тот же час)
    const tomorrowWeekday = (currentWeekday + 1) % 7;
    if (timePatterns.weekday[tomorrowWeekday]) {
      const tomorrowData = timePatterns.weekday[tomorrowWeekday];
      predictions.tomorrow = {
        mood: {
          predicted: tomorrowData.mood.avg,
          confidence: Math.min(0.7, tomorrowData.count / 5)
        },
        energy: {
          predicted: tomorrowData.energy.avg,
          confidence: Math.min(0.7, tomorrowData.count / 5)
        },
        stress: {
          predicted: tomorrowData.stress.avg,
          confidence: Math.min(0.7, tomorrowData.count / 5)
        }
      };
    }
    
    return predictions;
  }
  
  // Предсказания на основе трендов
  static async predictByTrends(userId, days = 14) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const responses = await Response.find({
      userId,
      timestamp: { $gte: startDate },
      'metadata.isComplete': true
    }).sort({ timestamp: 1 });
    
    if (responses.length < 7) {
      return { insufficient_data: true };
    }
    
    // Группируем данные по дням
    const dailyData = this.groupResponsesByDay(responses);
    const trends = {};
    
    ['mood', 'energy', 'stress'].forEach(metric => {
      const values = dailyData.map(day => day[metric]).filter(v => v !== null);
      
      if (values.length >= 5) {
        const trend = this.calculateTrend(values);
        const nextValue = this.predictNextValue(values, trend);
        
        trends[metric] = {
          trend: trend.direction, // 'increasing', 'decreasing', 'stable'
          rate: trend.rate,
          predicted: Math.max(1, Math.min(7, nextValue)),
          confidence: trend.confidence
        };
      }
    });
    
    return trends;
  }
  
  // Предсказания на основе активности
  static async predictByActivity(userId, context) {
    const activityPatterns = await PatternAnalysisService.analyzeActivityPatterns(userId, 30);
    
    if (Object.keys(activityPatterns).length === 0) {
      return { insufficient_data: true };
    }
    
    const currentActivity = context.currentActivity || context.plannedActivity;
    
    if (!currentActivity) {
      return { no_activity_context: true };
    }
    
    // Ищем подходящие активности
    const relevantPatterns = Object.entries(activityPatterns)
      .filter(([keyword, _]) => 
        currentActivity.toLowerCase().includes(keyword)
      );
    
    if (relevantPatterns.length === 0) {
      return { no_matching_activity: true };
    }
    
    // Усредняем предсказания по найденным активностям
    const predictions = { mood: [], energy: [], stress: [], flow: [] };
    
    relevantPatterns.forEach(([keyword, data]) => {
      predictions.mood.push({
        value: data.mood.avg,
        weight: data.count
      });
      predictions.energy.push({
        value: data.energy.avg,
        weight: data.count
      });
      predictions.stress.push({
        value: data.stress.avg,
        weight: data.count
      });
      predictions.flow.push({
        value: data.flowPercentage,
        weight: data.count
      });
    });
    
    return {
      mood: this.weightedAverage(predictions.mood),
      energy: this.weightedAverage(predictions.energy),
      stress: this.weightedAverage(predictions.stress),
      flowProbability: this.weightedAverage(predictions.flow) / 100,
      basedOnActivities: relevantPatterns.map(([keyword, _]) => keyword),
      confidence: Math.min(0.8, relevantPatterns.length / 3)
    };
  }
  
  // Предсказания на основе социального контекста
  static async predictBySocialContext(userId, context) {
    const socialPatterns = await PatternAnalysisService.analyzeSocialPatterns(userId, 30);
    
    if (Object.keys(socialPatterns).length === 0) {
      return { insufficient_data: true };
    }
    
    const currentCompanion = context.currentCompanion || context.plannedCompanion || 'один';
    const normalizedCompanion = currentCompanion.toLowerCase().includes('один') ? 'один' : currentCompanion.toLowerCase();
    
    if (socialPatterns[normalizedCompanion]) {
      const data = socialPatterns[normalizedCompanion];
      return {
        mood: {
          predicted: data.mood.avg,
          confidence: Math.min(0.8, data.count / 5)
        },
        energy: {
          predicted: data.energy.avg,
          confidence: Math.min(0.8, data.count / 5)
        },
        stress: {
          predicted: data.stress.avg,
          confidence: Math.min(0.8, data.count / 5)
        },
        flowProbability: data.flowPercentage / 100,
        basedOnCompanion: normalizedCompanion
      };
    }
    
    return { no_matching_social_context: true };
  }
  
  // Предсказания Flow состояний
  static async predictFlowStates(userId, context) {
    const correlations = await PatternAnalysisService.findCorrelations(userId, 30);
    
    if (correlations.insufficient_data || !correlations.flowTriggers) {
      return { insufficient_data: true };
    }
    
    const flowTriggers = correlations.flowTriggers;
    const currentChallenge = context.challenge;
    const currentSkill = context.skill;
    
    if (currentChallenge !== undefined && currentSkill !== undefined) {
      // Рассчитываем вероятность Flow на основе текущих challenge и skill
      const optimalZone = flowTriggers.optimalZone;
      
      const challengeInZone = currentChallenge >= optimalZone.challengeRange[0] && 
                             currentChallenge <= optimalZone.challengeRange[1];
      const skillInZone = currentSkill >= optimalZone.skillRange[0] && 
                         currentSkill <= optimalZone.skillRange[1];
      
      let flowProbability = 0;
      
      if (challengeInZone && skillInZone) {
        flowProbability = 0.8; // Высокая вероятность
      } else if (challengeInZone || skillInZone) {
        flowProbability = 0.4; // Средняя вероятность
      } else {
        const balanceDiff = Math.abs(currentChallenge - currentSkill);
        if (balanceDiff <= 2) {
          flowProbability = 0.6; // Хороший баланс
        } else {
          flowProbability = 0.1; // Низкая вероятность
        }
      }
      
      return {
        flowProbability,
        challenge: currentChallenge,
        skill: currentSkill,
        optimalZone,
        recommendation: this.getFlowRecommendation(currentChallenge, currentSkill, optimalZone)
      };
    }
    
    return { no_challenge_skill_context: true };
  }
  
  // Комбинирование всех предсказаний
  static combineAllPredictions(allPredictions) {
    const validPredictions = allPredictions.filter(p => 
      p && !p.insufficient_data && !p.no_activity_context && !p.no_matching_activity
    );
    
    if (validPredictions.length === 0) {
      return { insufficient_data: true };
    }
    
    const combined = {};
    ['mood', 'energy', 'stress'].forEach(metric => {
      const values = [];
      let totalConfidence = 0;
      
      validPredictions.forEach(prediction => {
        if (prediction[metric] && typeof prediction[metric].predicted === 'number') {
          const confidence = prediction[metric].confidence || 0.5;
          values.push({
            value: prediction[metric].predicted,
            weight: confidence
          });
          totalConfidence += confidence;
        }
      });
      
      if (values.length > 0) {
        combined[metric] = {
          predicted: this.weightedAverage(values),
          confidence: totalConfidence / values.length,
          sources: values.length
        };
      }
    });
    
    return combined;
  }
  
  // Генерация рекомендаций
  static generateRecommendations(predictions) {
    const recommendations = [];
    
    // Анализируем комбинированные предсказания
    if (predictions.combined && !predictions.combined.insufficient_data) {
      const { mood, energy, stress } = predictions.combined;
      
      if (mood && mood.predicted < 4) {
        recommendations.push({
          type: 'mood_warning',
          message: 'Ожидается снижение настроения',
          action: 'Запланируйте приятную активность или отдых',
          priority: 'high'
        });
      }
      
      if (energy && energy.predicted < 3) {
        recommendations.push({
          type: 'energy_warning',
          message: 'Прогнозируется низкий уровень энергии',
          action: 'Убедитесь, что высыпаетесь и правильно питаетесь',
          priority: 'medium'
        });
      }
      
      if (stress && stress.predicted > 5) {
        recommendations.push({
          type: 'stress_warning',
          message: 'Возможно повышение стресса',
          action: 'Подготовьте техники релаксации или сделайте перерыв',
          priority: 'high'
        });
      }
    }
    
    // Рекомендации по Flow
    if (predictions.flowPrediction && predictions.flowPrediction.flowProbability > 0.7) {
      recommendations.push({
        type: 'flow_opportunity',
        message: 'Высокая вероятность достижения Flow состояния',
        action: 'Сосредоточьтесь на текущей задаче и уберите отвлекающие факторы',
        priority: 'low'
      });
    }
    
    return recommendations;
  }
  
  // Генерация алертов
  static async generateAlerts(userId, predictions) {
    const alerts = [];
    
    // Проверяем аномалии
    const anomalies = await PatternAnalysisService.detectAnomalies(userId, 3);
    
    if (anomalies && Array.isArray(anomalies)) {
      anomalies.forEach(anomaly => {
        if (anomaly.magnitude > 2) { // Серьезные аномалии
          alerts.push({
            type: 'anomaly',
            severity: 'high',
            message: `Значительное ${anomaly.type === 'increase' ? 'повышение' : 'снижение'} ${anomaly.metric}`,
            value: anomaly.recentValue,
            change: anomaly.type
          });
        }
      });
    }
    
    // Предупреждения на основе времени
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 22 || hour <= 6) {
      alerts.push({
        type: 'time_warning',
        severity: 'low',
        message: 'Поздний час может влиять на качество ответов',
        recommendation: 'Отвечайте на опросы в дневное время для лучшей точности'
      });
    }
    
    return alerts;
  }
  
  // Вспомогательные методы
  static groupResponsesByDay(responses) {
    const dailyData = {};
    
    responses.forEach(response => {
      const date = response.timestamp.toDateString();
      
      if (!dailyData[date]) {
        dailyData[date] = {
          mood: [],
          energy: [],
          stress: [],
          count: 0
        };
      }
      
      if (response.responses.mood) {
        dailyData[date].mood.push(response.responses.mood);
        dailyData[date].energy.push(response.responses.energy || 0);
        dailyData[date].stress.push(response.responses.stress || 0);
        dailyData[date].count++;
      }
    });
    
    // Вычисляем средние значения по дням
    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      mood: data.mood.length > 0 ? data.mood.reduce((a, b) => a + b, 0) / data.mood.length : null,
      energy: data.energy.length > 0 ? data.energy.reduce((a, b) => a + b, 0) / data.energy.length : null,
      stress: data.stress.length > 0 ? data.stress.reduce((a, b) => a + b, 0) / data.stress.length : null,
      count: data.count
    })).filter(day => day.mood !== null);
  }
  
  static calculateTrend(values) {
    if (values.length < 3) {
      return { direction: 'stable', rate: 0, confidence: 0 };
    }
    
    // Простая линейная регрессия
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let direction = 'stable';
    if (Math.abs(slope) > 0.1) {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    // Коэффициент детерминации для оценки уверенности
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + (sumY - slope * sumX) / n;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = totalSumSquares !== 0 ? 1 - (residualSumSquares / totalSumSquares) : 0;
    
    return {
      direction,
      rate: slope,
      confidence: Math.max(0, Math.min(1, rSquared))
    };
  }
  
  static predictNextValue(values, trend) {
    const lastValue = values[values.length - 1];
    return lastValue + trend.rate;
  }
  
  static weightedAverage(valuesWithWeights) {
    if (valuesWithWeights.length === 0) return 0;
    
    const totalWeight = valuesWithWeights.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = valuesWithWeights.reduce((sum, item) => sum + item.value * item.weight, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  static getFlowRecommendation(challenge, skill, optimalZone) {
    if (challenge < optimalZone.challengeRange[0] && skill > optimalZone.skillRange[1]) {
      return 'Попробуйте усложнить задачу для достижения Flow состояния';
    } else if (challenge > optimalZone.challengeRange[1] && skill < optimalZone.skillRange[0]) {
      return 'Задача слишком сложная - разбейте её на более простые этапы';
    } else if (Math.abs(challenge - skill) > 2) {
      return 'Стремитесь к балансу между вызовом и навыками';
    } else {
      return 'Условия благоприятны для Flow состояния';
    }
  }
  
  static calculateOverallConfidence(predictions) {
    const confidenceValues = [];
    
    if (predictions.timeBased && predictions.timeBased.currentHour) {
      confidenceValues.push(predictions.timeBased.currentHour.mood.confidence);
    }
    
    if (predictions.trendBased && !predictions.trendBased.insufficient_data) {
      Object.values(predictions.trendBased).forEach(trend => {
        if (trend.confidence !== undefined) {
          confidenceValues.push(trend.confidence);
        }
      });
    }
    
    if (predictions.activityBased && predictions.activityBased.confidence) {
      confidenceValues.push(predictions.activityBased.confidence);
    }
    
    if (predictions.socialBased && predictions.socialBased.mood) {
      confidenceValues.push(predictions.socialBased.mood.confidence);
    }
    
    return confidenceValues.length > 0 ? 
      confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length : 0;
  }
}

module.exports = PredictiveAnalyticsService;