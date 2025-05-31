const AIInsightsService = require('../../services/ai-insights-service');
const PatternAnalysisService = require('../../services/pattern-analysis-service');

// Mock dependencies
jest.mock('../../services/pattern-analysis-service');
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

describe('AIInsightsService', () => {
  let aiInsightsService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    aiInsightsService = new AIInsightsService();
  });

  describe('generatePersonalInsights', () => {
    beforeEach(() => {
      // Mock user profile from PatternAnalysisService
      PatternAnalysisService.createUserProfile.mockResolvedValue({
        timePatterns: {
          bestHours: [14, 15, 16],
          worstHours: [9, 10]
        },
        activityPatterns: {
          moodBoosters: ['coding', 'reading'],
          energyDrains: ['meetings']
        },
        socialPatterns: {
          alonePreference: 0.7
        }
      });
    });

    test('should generate insights successfully with OpenAI', async () => {
      // Mock OpenAI response
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insights: [
                {
                  type: 'time_pattern',
                  message: 'Ваше лучшее время для работы 14:00-16:00',
                  confidence: 0.85,
                  emoji: '⏰'
                }
              ],
              recommendations: ['Планируйте важные задачи на послеобеденное время']
            })
          }
        }]
      };

      aiInsightsService.openai = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockOpenAIResponse)
          }
        }
      };

      const result = await aiInsightsService.generatePersonalInsights('mock_user_id');

      expect(result).toBeDefined();
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].type).toBe('time_pattern');
      expect(result.insights[0].confidence).toBe(0.85);
      expect(result.recommendations).toHaveLength(1);
    });

    test('should fallback to Anthropic when OpenAI fails', async () => {
      // Mock OpenAI failure
      aiInsightsService.openai = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API error'))
          }
        }
      };

      // Mock Anthropic success
      const mockAnthropicResponse = {
        content: [{
          text: JSON.stringify({
            insights: [
              {
                type: 'energy_pattern',
                message: 'Ваша энергия падает после обеда',
                confidence: 0.75,
                emoji: '⚡'
              }
            ],
            recommendations: ['Делайте перерывы после обеда']
          })
        }]
      };

      aiInsightsService.anthropic = {
        messages: {
          create: jest.fn().mockResolvedValue(mockAnthropicResponse)
        }
      };

      const result = await aiInsightsService.generatePersonalInsights('mock_user_id');

      expect(result).toBeDefined();
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].type).toBe('energy_pattern');
    });

    test('should return fallback insights when both AI services fail', async () => {
      // Mock both services failing
      aiInsightsService.openai = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI error'))
          }
        }
      };

      aiInsightsService.anthropic = {
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Anthropic error'))
        }
      };

      const result = await aiInsightsService.generatePersonalInsights('mock_user_id');

      expect(result).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.source).toBe('fallback');
      expect(result.insights.length).toBeGreaterThan(0);
    });

    test('should handle malformed AI response gracefully', async () => {
      // Mock malformed response
      const mockMalformedResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      };

      aiInsightsService.openai = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockMalformedResponse)
          }
        }
      };

      const result = await aiInsightsService.generatePersonalInsights('mock_user_id');

      expect(result).toBeDefined();
      expect(result.source).toBe('fallback');
    });
  });

  describe('generateQuickInsight', () => {
    test('should generate quick insight for experienced user', async () => {
      PatternAnalysisService.createUserProfile.mockResolvedValue({
        recentTrends: {
          moodTrend: 'improving',
          energyTrend: 'stable'
        }
      });

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              message: 'Ваше настроение улучшается!',
              emoji: '😊',
              confidence: 0.8
            })
          }
        }]
      };

      aiInsightsService.openai = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockResponse)
          }
        }
      };

      const result = await aiInsightsService.generateQuickInsight('mock_user_id');

      expect(result).toBeDefined();
      expect(result.message).toBe('Ваше настроение улучшается!');
      expect(result.emoji).toBe('😊');
    });

    test('should return null for users with insufficient data', async () => {
      PatternAnalysisService.createUserProfile.mockResolvedValue({
        dataPoints: 5 // Less than minimum required
      });

      const result = await aiInsightsService.generateQuickInsight('mock_user_id');

      expect(result).toBeNull();
    });
  });

  describe('createInsightsPrompt', () => {
    test('should create comprehensive prompt with user data', () => {
      const userProfile = {
        timePatterns: { bestHours: [14, 15] },
        activityPatterns: { moodBoosters: ['coding'] },
        dataPoints: 50
      };

      const prompt = aiInsightsService.createInsightsPrompt(userProfile);

      expect(prompt).toContain('анализ паттернов поведения');
      expect(prompt).toContain('JSON формате');
      expect(prompt).toContain('insights');
      expect(prompt).toContain('recommendations');
    });
  });

  describe('parseAIResponse', () => {
    test('should parse valid JSON response', () => {
      const validResponse = JSON.stringify({
        insights: [{ type: 'test', message: 'test message' }],
        recommendations: ['test recommendation']
      });

      const result = aiInsightsService.parseAIResponse(validResponse);

      expect(result.insights).toHaveLength(1);
      expect(result.recommendations).toHaveLength(1);
    });

    test('should handle invalid JSON gracefully', () => {
      const invalidResponse = 'Not valid JSON';

      const result = aiInsightsService.parseAIResponse(invalidResponse);

      expect(result).toBeNull();
    });
  });

  describe('generateFallbackInsights', () => {
    test('should generate meaningful fallback insights', () => {
      const userProfile = {
        timePatterns: {
          bestHours: [14, 15, 16],
          averageMood: { '14': 7.5, '15': 8.0 }
        },
        activityPatterns: {
          moodBoosters: ['coding', 'reading']
        },
        dataPoints: 25
      };

      const result = aiInsightsService.generateFallbackInsights(userProfile);

      expect(result).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.source).toBe('fallback');
      expect(result.recommendations).toBeDefined();
    });

    test('should handle empty user profile', () => {
      const emptyProfile = { dataPoints: 0 };

      const result = aiInsightsService.generateFallbackInsights(emptyProfile);

      expect(result).toBeDefined();
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].message).toContain('Недостаточно данных');
    });
  });
});