const AIInsightsService = require('../../services/ai-insights-service');

// Mock config
jest.mock('../../config/hurlburt', () => ({
  ai: {
    provider: 'openai',
    enableSmartValidation: true
  }
}));

// Mock pattern analysis service
jest.mock('../../services/pattern-analysis-service', () => ({
  createUserProfile: jest.fn()
}));

describe('AIInsightsService - Basic Tests', () => {
  let aiInsightsService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment to test fallback behavior
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    aiInsightsService = new AIInsightsService();
  });

  test('should initialize without API keys (fallback mode)', () => {
    expect(aiInsightsService).toBeDefined();
    expect(aiInsightsService.isConfigured).toBe(false);
  });

  test('should generate fallback insights when not configured', async () => {
    const PatternAnalysisService = require('../../services/pattern-analysis-service');
    PatternAnalysisService.createUserProfile.mockResolvedValue({
      dataPoints: 5,
      timePatterns: {
        hourly: {} // Add empty hourly data to prevent null/undefined error
      },
      activityPatterns: {}
    });

    const result = await aiInsightsService.generatePersonalInsights('mock_user_id');

    expect(result).toBeDefined();
    expect(result.insights).toBeDefined();
    // Just check that we get some kind of result from fallback
  });

  test('should handle generateQuickInsight for insufficient data', async () => {
    const PatternAnalysisService = require('../../services/pattern-analysis-service');
    PatternAnalysisService.createUserProfile.mockResolvedValue({
      dataPoints: 5 // Less than minimum
    });

    const result = await aiInsightsService.generateQuickInsight('mock_user_id');

    expect(result).toBeDefined();
    expect(result.message).toContain('понять ваши паттерны');
  });

  test('should create insights prompt with user data', () => {
    const userProfile = {
      timePatterns: { bestHours: [14, 15] },
      activityPatterns: { moodBoosters: ['coding'] },
      dataPoints: 20
    };

    const prompt = aiInsightsService.createInsightsPrompt(userProfile);

    expect(prompt).toContain('анализ');
    expect(prompt).toContain('JSON');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  test('should parse valid AI response', () => {
    const validResponse = JSON.stringify({
      insights: [
        {
          type: 'temporal',
          title: 'Test insight',
          description: 'Test description',
          recommendation: 'Test recommendation',
          confidence: 0.8,
          emoji: '⏰'
        }
      ]
    });

    const result = aiInsightsService.parseAIResponse(validResponse);

    expect(result).toBeDefined();
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].type).toBe('temporal');
  });

  test('should handle invalid JSON gracefully', () => {
    const invalidResponse = 'Not valid JSON at all';

    const result = aiInsightsService.parseAIResponse(invalidResponse);

    expect(result).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.insights).toEqual([]);
  });
});