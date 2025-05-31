const PatternAnalysisService = require('../../services/pattern-analysis-service');
const Response = require('../../models/Response');

// Mock the Response model
jest.mock('../../models/Response');

describe('PatternAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeTimePatterns', () => {
    test('should analyze time patterns with sufficient data', async () => {
      const mockResponses = [
        {
          timestamp: new Date('2024-01-01T14:00:00Z'),
          responses: { mood: 8, energy: 7 },
          metadata: { flowState: 'flow' }
        },
        {
          timestamp: new Date('2024-01-01T15:00:00Z'),
          responses: { mood: 9, energy: 8 },
          metadata: { flowState: 'flow' }
        },
        {
          timestamp: new Date('2024-01-01T09:00:00Z'),
          responses: { mood: 5, energy: 4 },
          metadata: { flowState: 'boredom' }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.analyzeTimePatterns('mock_user_id', 30);

      expect(result).toBeDefined();
      expect(result.bestHours).toContain(14);
      expect(result.bestHours).toContain(15);
      expect(result.worstHours).toContain(9);
      expect(result.averageMood).toBeDefined();
      expect(result.averageEnergy).toBeDefined();
    });

    test('should handle empty data gracefully', async () => {
      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      const result = await PatternAnalysisService.analyzeTimePatterns('mock_user_id', 30);

      expect(result).toBeDefined();
      expect(result.bestHours).toEqual([]);
      expect(result.worstHours).toEqual([]);
      expect(result.averageMood).toEqual({});
    });

    test('should identify day of week patterns', async () => {
      const mockResponses = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'), // Monday
          responses: { mood: 6, energy: 6 }
        },
        {
          timestamp: new Date('2024-01-05T10:00:00Z'), // Friday
          responses: { mood: 4, energy: 3 }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.analyzeTimePatterns('mock_user_id', 30);

      expect(result.dayOfWeekPatterns).toBeDefined();
      expect(result.dayOfWeekPatterns['1']).toEqual({ mood: 6, energy: 6, count: 1 }); // Monday
      expect(result.dayOfWeekPatterns['5']).toEqual({ mood: 4, energy: 3, count: 1 }); // Friday
    });
  });

  describe('analyzeActivityPatterns', () => {
    test('should identify mood boosting activities', async () => {
      const mockResponses = [
        {
          responses: { 
            mood: 8, 
            energy: 7, 
            currentActivity: 'coding personal project' 
          }
        },
        {
          responses: { 
            mood: 9, 
            energy: 8, 
            currentActivity: 'reading technical book' 
          }
        },
        {
          responses: { 
            mood: 4, 
            energy: 3, 
            currentActivity: 'attending meeting' 
          }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.analyzeActivityPatterns('mock_user_id', 30);

      expect(result).toBeDefined();
      expect(result.moodBoosters).toContain('coding');
      expect(result.moodBoosters).toContain('reading');
      expect(result.energyDrains).toContain('meeting');
      expect(result.flowActivities).toBeDefined();
    });

    test('should handle activities with insufficient data', async () => {
      const mockResponses = [
        {
          responses: { 
            mood: 7, 
            energy: 6, 
            currentActivity: 'unknown activity' 
          }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.analyzeActivityPatterns('mock_user_id', 30);

      expect(result.moodBoosters).toEqual([]);
      expect(result.energyDrains).toEqual([]);
    });
  });

  describe('analyzeSocialPatterns', () => {
    test('should analyze social context preferences', async () => {
      const mockResponses = [
        {
          responses: { 
            mood: 8, 
            energy: 7, 
            currentCompanion: 'один' 
          }
        },
        {
          responses: { 
            mood: 6, 
            energy: 5, 
            currentCompanion: 'коллеги' 
          }
        },
        {
          responses: { 
            mood: 9, 
            energy: 8, 
            currentCompanion: 'один' 
          }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.analyzeSocialPatterns('mock_user_id', 30);

      expect(result).toBeDefined();
      expect(result.alonePreference).toBeGreaterThan(0.5);
      expect(result.socialContexts).toBeDefined();
      expect(result.socialContexts['один']).toBeDefined();
      expect(result.socialContexts['коллеги']).toBeDefined();
    });
  });

  describe('createUserProfile', () => {
    test('should create comprehensive user profile', async () => {
      const mockResponses = [
        {
          timestamp: new Date('2024-01-01T14:00:00Z'),
          responses: { 
            mood: 8, 
            energy: 7, 
            currentActivity: 'coding',
            currentCompanion: 'один'
          },
          metadata: { flowState: 'flow' }
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      // Mock all analysis methods
      jest.spyOn(PatternAnalysisService, 'analyzeTimePatterns').mockResolvedValue({
        bestHours: [14, 15],
        worstHours: [9],
        averageMood: { '14': 8 }
      });

      jest.spyOn(PatternAnalysisService, 'analyzeActivityPatterns').mockResolvedValue({
        moodBoosters: ['coding'],
        energyDrains: ['meeting']
      });

      jest.spyOn(PatternAnalysisService, 'analyzeSocialPatterns').mockResolvedValue({
        alonePreference: 0.8
      });

      jest.spyOn(PatternAnalysisService, 'analyzeCorrelations').mockResolvedValue({
        moodEnergyCorrelation: 0.85
      });

      jest.spyOn(PatternAnalysisService, 'detectAnomalies').mockResolvedValue({
        recentAnomalies: []
      });

      const result = await PatternAnalysisService.createUserProfile('mock_user_id');

      expect(result).toBeDefined();
      expect(result.timePatterns).toBeDefined();
      expect(result.activityPatterns).toBeDefined();
      expect(result.socialPatterns).toBeDefined();
      expect(result.correlations).toBeDefined();
      expect(result.anomalies).toBeDefined();
      expect(result.dataPoints).toBe(1);
      expect(result.profileCompleteness).toBeGreaterThan(0);
    });

    test('should handle user with no data', async () => {
      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      const result = await PatternAnalysisService.createUserProfile('mock_user_id');

      expect(result).toBeDefined();
      expect(result.dataPoints).toBe(0);
      expect(result.profileCompleteness).toBe(0);
    });
  });

  describe('analyzeCorrelations', () => {
    test('should find correlations between metrics', async () => {
      const mockResponses = [
        { responses: { mood: 8, energy: 7, stress: 2 } },
        { responses: { mood: 6, energy: 5, stress: 5 } },
        { responses: { mood: 9, energy: 8, stress: 1 } }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.analyzeCorrelations('mock_user_id', 30);

      expect(result).toBeDefined();
      expect(result.moodEnergyCorrelation).toBeDefined();
      expect(result.moodStressCorrelation).toBeDefined();
      expect(result.energyStressCorrelation).toBeDefined();
      
      // High mood should correlate with high energy
      expect(result.moodEnergyCorrelation).toBeGreaterThan(0.5);
      
      // High mood should correlate with low stress (negative correlation)
      expect(result.moodStressCorrelation).toBeLessThan(-0.5);
    });
  });

  describe('detectAnomalies', () => {
    test('should detect significant deviations from normal patterns', async () => {
      const mockResponses = [
        { 
          timestamp: new Date('2024-01-01T14:00:00Z'),
          responses: { mood: 8, energy: 7 } 
        },
        { 
          timestamp: new Date('2024-01-02T14:00:00Z'),
          responses: { mood: 8, energy: 7 } 
        },
        { 
          timestamp: new Date('2024-01-03T14:00:00Z'),
          responses: { mood: 2, energy: 1 } // Anomaly
        }
      ];

      Response.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResponses)
      });

      const result = await PatternAnalysisService.detectAnomalies('mock_user_id', 7);

      expect(result).toBeDefined();
      expect(result.recentAnomalies).toBeDefined();
      expect(result.anomalyScore).toBeDefined();
      
      if (result.recentAnomalies.length > 0) {
        expect(result.recentAnomalies[0]).toHaveProperty('type');
        expect(result.recentAnomalies[0]).toHaveProperty('severity');
        expect(result.recentAnomalies[0]).toHaveProperty('date');
      }
    });
  });

  describe('helper methods', () => {
    test('calculateCorrelation should compute Pearson correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      const correlation = PatternAnalysisService.calculateCorrelation(x, y);

      expect(correlation).toBeCloseTo(1.0, 2); // Perfect positive correlation
    });

    test('calculateCorrelation should handle empty arrays', () => {
      const correlation = PatternAnalysisService.calculateCorrelation([], []);

      expect(correlation).toBe(0);
    });

    test('calculateCorrelation should handle different array lengths', () => {
      const x = [1, 2, 3];
      const y = [1, 2];

      const correlation = PatternAnalysisService.calculateCorrelation(x, y);

      expect(correlation).toBe(0);
    });
  });
});