const PredictiveAnalyticsService = require('../../services/predictive-analytics-service');
const PatternAnalysisService = require('../../services/pattern-analysis-service');
const Response = require('../../models/Response');

// Mock dependencies
jest.mock('../../services/pattern-analysis-service');
jest.mock('../../models/Response');

describe('PredictiveAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePredictions', () => {
    test('should generate comprehensive predictions with sufficient data', async () => {
      const mockTimePatterns = {
        bestHours: [14, 15, 16],
        averageMood: { '14': 8.2, '15': 8.5, '16': 8.0 },
        averageEnergy: { '14': 7.8, '15': 8.0, '16': 7.5 }
      };

      PatternAnalysisService.analyzeTimePatterns.mockResolvedValue(mockTimePatterns);
      
      // Mock trend analysis
      jest.spyOn(PredictiveAnalyticsService, 'predictByTrends').mockResolvedValue({
        moodTrend: 'improving',
        energyTrend: 'stable',
        stressTrend: 'decreasing'
      });

      // Mock activity predictions
      jest.spyOn(PredictiveAnalyticsService, 'predictByActivity').mockResolvedValue({
        recommendedActivities: ['coding', 'reading'],
        avoidActivities: ['meetings']
      });

      // Mock social predictions
      jest.spyOn(PredictiveAnalyticsService, 'predictBySocialContext').mockResolvedValue({
        optimalSocialSetting: 'alone',
        socialEnergyImpact: 0.3
      });

      // Mock flow predictions
      jest.spyOn(PredictiveAnalyticsService, 'predictFlowStates').mockResolvedValue({
        flowProbability: 0.85,
        optimalChallenge: 7,
        currentSkillLevel: 8
      });

      const result = await PredictiveAnalyticsService.generatePredictions('mock_user_id', {
        currentTime: new Date('2024-01-01T14:00:00Z'),
        currentActivity: 'coding'
      });

      expect(result).toBeDefined();
      expect(result.timeBased).toBeDefined();
      expect(result.trendBased).toBeDefined();
      expect(result.activityBased).toBeDefined();
      expect(result.socialBased).toBeDefined();
      expect(result.flowPrediction).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    test('should handle user with insufficient data', async () => {
      PatternAnalysisService.analyzeTimePatterns.mockResolvedValue({
        bestHours: [],
        averageMood: {},
        averageEnergy: {}
      });

      const result = await PredictiveAnalyticsService.generatePredictions('mock_user_id', {});

      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.message).toContain('Недостаточно данных');
    });
  });

  describe('predictByTimePatterns', () => {
    test('should predict optimal times based on historical data', async () => {
      const mockTimePatterns = {
        bestHours: [14, 15, 16],
        averageMood: { 
          '14': 8.2, '15': 8.5, '16': 8.0,
          '9': 6.0, '10': 6.5 
        },
        averageEnergy: { 
          '14': 7.8, '15': 8.0, '16': 7.5,
          '9': 5.0, '10': 5.5 
        }
      };

      PatternAnalysisService.analyzeTimePatterns.mockResolvedValue(mockTimePatterns);

      const result = await PredictiveAnalyticsService.predictByTimePatterns('mock_user_id', {
        currentTime: new Date('2024-01-01T10:00:00Z')
      });

      expect(result).toBeDefined();
      expect(result.nextOptimalHour).toBe(14);
      expect(result.currentPeriodPrediction).toBeDefined();
      expect(result.dailyForecast).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    test('should provide current hour predictions', async () => {
      const mockTimePatterns = {
        averageMood: { '14': 8.2 },
        averageEnergy: { '14': 7.8 }
      };

      PatternAnalysisService.analyzeTimePatterns.mockResolvedValue(mockTimePatterns);

      const result = await PredictiveAnalyticsService.predictByTimePatterns('mock_user_id', {
        currentTime: new Date('2024-01-01T14:30:00Z')
      });

      expect(result.currentPeriodPrediction).toBeDefined();
      expect(result.currentPeriodPrediction.predictedMood).toBeCloseTo(8.2, 1);
      expect(result.currentPeriodPrediction.predictedEnergy).toBeCloseTo(7.8, 1);
    });
  });

  describe('predictByTrends', () => {
    test('should analyze recent trends and predict future states', async () => {
      const mockResponses = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          responses: { mood: 6, energy: 5, stress: 4 }
        },
        {
          timestamp: new Date('2024-01-02T10:00:00Z'),
          responses: { mood: 7, energy: 6, stress: 3 }
        },
        {
          timestamp: new Date('2024-01-03T10:00:00Z'),
          responses: { mood: 8, energy: 7, stress: 2 }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PredictiveAnalyticsService.predictByTrends('mock_user_id');

      expect(result).toBeDefined();
      expect(result.moodTrend).toBe('improving');
      expect(result.energyTrend).toBe('improving');
      expect(result.stressTrend).toBe('improving'); // Stress is decreasing, which is improving
      expect(result.predictions).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should detect stable trends', async () => {
      const mockResponses = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          responses: { mood: 7, energy: 6, stress: 3 }
        },
        {
          timestamp: new Date('2024-01-02T10:00:00Z'),
          responses: { mood: 7, energy: 6, stress: 3 }
        },
        {
          timestamp: new Date('2024-01-03T10:00:00Z'),
          responses: { mood: 7, energy: 6, stress: 3 }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PredictiveAnalyticsService.predictByTrends('mock_user_id');

      expect(result.moodTrend).toBe('stable');
      expect(result.energyTrend).toBe('stable');
      expect(result.stressTrend).toBe('stable');
    });
  });

  describe('predictByActivity', () => {
    test('should predict optimal activities based on current context', async () => {
      PatternAnalysisService.analyzeActivityPatterns.mockResolvedValue({
        moodBoosters: ['coding', 'reading', 'walking'],
        energyDrains: ['meetings', 'emails'],
        flowActivities: ['coding', 'design'],
        activityImpact: {
          'coding': { moodChange: +1.5, energyChange: +0.5 },
          'meetings': { moodChange: -0.8, energyChange: -1.2 },
          'reading': { moodChange: +1.0, energyChange: +0.3 }
        }
      });

      const result = await PredictiveAnalyticsService.predictByActivity('mock_user_id', {
        currentMood: 6,
        currentEnergy: 5,
        timeOfDay: 14
      });

      expect(result).toBeDefined();
      expect(result.recommendedActivities).toContain('coding');
      expect(result.avoidActivities).toContain('meetings');
      expect(result.activityPredictions).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle context-specific recommendations', async () => {
      PatternAnalysisService.analyzeActivityPatterns.mockResolvedValue({
        moodBoosters: ['coding'],
        energyDrains: ['meetings'],
        flowActivities: ['coding']
      });

      const result = await PredictiveAnalyticsService.predictByActivity('mock_user_id', {
        currentMood: 4, // Low mood
        currentEnergy: 3, // Low energy
        timeOfDay: 16
      });

      expect(result.recommendedActivities).toBeDefined();
      expect(result.energyRestoreActivities).toBeDefined();
      expect(result.moodBoostActivities).toBeDefined();
    });
  });

  describe('predictBySocialContext', () => {
    test('should predict optimal social settings', async () => {
      PatternAnalysisService.analyzeSocialPatterns.mockResolvedValue({
        alonePreference: 0.7,
        socialContexts: {
          'один': { averageMood: 8.0, averageEnergy: 7.5, count: 10 },
          'коллеги': { averageMood: 6.5, averageEnergy: 6.0, count: 8 },
          'друзья': { averageMood: 8.5, averageEnergy: 8.0, count: 5 }
        }
      });

      const result = await PredictiveAnalyticsService.predictBySocialContext('mock_user_id', {
        currentMood: 7,
        currentEnergy: 6
      });

      expect(result).toBeDefined();
      expect(result.optimalSocialSetting).toBeDefined();
      expect(result.socialEnergyImpact).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('predictFlowStates', () => {
    test('should predict flow state probability', async () => {
      const mockResponses = [
        {
          metadata: { 
            challenge: 7, 
            skill: 8, 
            flowState: 'flow',
            concentration: 9
          }
        },
        {
          metadata: { 
            challenge: 6, 
            skill: 8, 
            flowState: 'flow',
            concentration: 8
          }
        },
        {
          metadata: { 
            challenge: 8, 
            skill: 6, 
            flowState: 'anxiety',
            concentration: 6
          }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PredictiveAnalyticsService.predictFlowStates('mock_user_id', {
        currentChallenge: 7,
        currentSkill: 8
      });

      expect(result).toBeDefined();
      expect(result.flowProbability).toBeDefined();
      expect(result.optimalChallenge).toBeDefined();
      expect(result.currentSkillLevel).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle insufficient flow data', async () => {
      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      const result = await PredictiveAnalyticsService.predictFlowStates('mock_user_id', {});

      expect(result.flowProbability).toBe(0);
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.recommendations).toContain('Недостаточно данных');
    });
  });

  describe('helper methods', () => {
    test('calculateTrendDirection should detect improving trend', () => {
      const values = [5, 6, 7, 8];
      
      const trend = PredictiveAnalyticsService.calculateTrendDirection(values);
      
      expect(trend).toBe('improving');
    });

    test('calculateTrendDirection should detect declining trend', () => {
      const values = [8, 7, 6, 5];
      
      const trend = PredictiveAnalyticsService.calculateTrendDirection(values);
      
      expect(trend).toBe('declining');
    });

    test('calculateTrendDirection should detect stable trend', () => {
      const values = [7, 7, 7, 7];
      
      const trend = PredictiveAnalyticsService.calculateTrendDirection(values);
      
      expect(trend).toBe('stable');
    });

    test('calculateConfidence should return appropriate confidence levels', () => {
      // High data points should give high confidence
      const highConfidence = PredictiveAnalyticsService.calculateConfidence(50, 0.9);
      expect(highConfidence).toBeGreaterThan(0.8);

      // Low data points should give low confidence
      const lowConfidence = PredictiveAnalyticsService.calculateConfidence(5, 0.9);
      expect(lowConfidence).toBeLessThan(0.5);

      // Low pattern strength should reduce confidence
      const weakPattern = PredictiveAnalyticsService.calculateConfidence(50, 0.3);
      expect(weakPattern).toBeLessThan(0.6);
    });

    test('interpolateValue should predict intermediate values', () => {
      const value = PredictiveAnalyticsService.interpolateValue(5, 9, 0.5);
      expect(value).toBe(7); // Midpoint between 5 and 9
    });

    test('formatPredictionMessage should create readable messages', () => {
      const prediction = {
        type: 'mood',
        value: 8.2,
        confidence: 0.85,
        timeframe: 'в следующий час'
      };

      const message = PredictiveAnalyticsService.formatPredictionMessage(prediction);

      expect(message).toContain('8.2');
      expect(message).toContain('85%');
      expect(message).toContain('в следующий час');
    });
  });
});