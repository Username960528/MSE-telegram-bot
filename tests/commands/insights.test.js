const insightsCommand = require('../../commands/insights');
const User = require('../../models/User');

// Mock dependencies
jest.mock('../../models/User');

// Mock AI services
const mockAIInsightsService = {
  generatePersonalInsights: jest.fn(),
  generateQuickInsight: jest.fn()
};

const mockPredictiveAnalyticsService = {
  generatePredictions: jest.fn()
};

// Replace the real services with mocks
jest.mock('../../services/ai-insights-service', () => mockAIInsightsService);
jest.mock('../../services/predictive-analytics-service', () => mockPredictiveAnalyticsService);

describe('/insights Command', () => {
  let mockBot;
  let mockMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockBot = global.createMockBot();
    
    mockMessage = {
      chat: { id: 123456 },
      from: { id: 789012 },
      message_id: 1
    };
  });

  describe('execute', () => {
    test('should show insights for user with sufficient data', async () => {
      const mockUser = {
        ...global.createMockUser(),
        totalResponses: 20
      };

      const mockAIInsights = {
        insights: [
          {
            type: 'time_pattern',
            message: 'Ваше лучшее время для работы 14:00-16:00',
            confidence: 0.85,
            emoji: '⏰'
          },
          {
            type: 'activity_pattern',
            message: 'Программирование повышает ваше настроение',
            confidence: 0.78,
            emoji: '💻'
          }
        ],
        recommendations: [
          'Планируйте важные задачи на послеобеденное время',
          'Включайте больше программирования в свой день'
        ],
        source: 'openai'
      };

      const mockPredictions = {
        timeBased: [
          {
            time: '14:00',
            predictedMood: 8.2,
            predictedEnergy: 7.8,
            confidence: 0.82
          }
        ],
        trendBased: {
          moodTrend: 'improving',
          energyTrend: 'stable'
        }
      };

      const mockQuickInsight = {
        message: 'Ваше настроение улучшается последние дни!',
        emoji: '😊',
        confidence: 0.75
      };

      User.findOne.mockResolvedValue(mockUser);
      mockAIInsightsService.generatePersonalInsights.mockResolvedValue(mockAIInsights);
      mockPredictiveAnalyticsService.generatePredictions.mockResolvedValue(mockPredictions);
      mockAIInsightsService.generateQuickInsight.mockResolvedValue(mockQuickInsight);

      await insightsCommand.execute(mockBot, mockMessage);

      expect(User.findOne).toHaveBeenCalledWith({ telegramId: 789012 });
      expect(mockAIInsightsService.generatePersonalInsights).toHaveBeenCalledWith(mockUser._id);
      expect(mockPredictiveAnalyticsService.generatePredictions).toHaveBeenCalledWith(mockUser._id, expect.any(Object));
      expect(mockAIInsightsService.generateQuickInsight).toHaveBeenCalledWith(mockUser._id);

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      
      expect(sentMessage).toContain('🧠 Персональные инсайты');
    });

    test('should show insufficient data message for new users', async () => {
      const mockUser = {
        ...global.createMockUser(),
        totalResponses: 5 // Less than minimum required
      };

      User.findOne.mockResolvedValue(mockUser);

      await insightsCommand.execute(mockBot, mockMessage);

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      
      expect(sentMessage).toContain('🔍 Анализируем ваши паттерны поведения...');
    });

    test('should prompt registration for unregistered users', async () => {
      User.findOne.mockResolvedValue(null);

      await insightsCommand.execute(mockBot, mockMessage);

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        123456,
        '❌ Пользователь не найден. Используйте /start для регистрации.'
      );
    });

    test('should handle AI service failures gracefully', async () => {
      const mockUser = {
        ...global.createMockUser(),
        totalResponses: 20
      };

      User.findOne.mockResolvedValue(mockUser);
      AIInsightsService.generatePersonalInsights.mockRejectedValue(new Error('AI service error'));
      PredictiveAnalyticsService.generatePredictions.mockRejectedValue(new Error('Prediction error'));
      AIInsightsService.generateQuickInsight.mockRejectedValue(new Error('Quick insight error'));

      await insightsCommand.execute(mockBot, mockMessage);

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const sentMessage = mockBot.sendMessage.mock.calls[0][1];
      
      expect(sentMessage).toContain('Временные проблемы с анализом');
      expect(sentMessage).toContain('Попробуйте позже');
    });

    test('should include interactive buttons in response', async () => {
      const mockUser = {
        ...global.createMockUser(),
        totalResponses: 20
      };

      const mockAIInsights = {
        insights: [
          {
            type: 'time_pattern',
            message: 'Test insight',
            confidence: 0.85,
            emoji: '⏰'
          }
        ],
        recommendations: ['Test recommendation'],
        source: 'openai'
      };

      User.findOne.mockResolvedValue(mockUser);
      AIInsightsService.generatePersonalInsights.mockResolvedValue(mockAIInsights);
      PredictiveAnalyticsService.generatePredictions.mockResolvedValue({});
      AIInsightsService.generateQuickInsight.mockResolvedValue(null);

      await insightsCommand.execute(mockBot, mockMessage);

      expect(mockBot.sendMessage).toHaveBeenCalled();
      const options = mockBot.sendMessage.mock.calls[0][2];
      
      expect(options).toHaveProperty('reply_markup');
      expect(options.reply_markup).toHaveProperty('inline_keyboard');
      
      const keyboard = options.reply_markup.inline_keyboard;
      const buttons = keyboard.flat();
      
      expect(buttons.some(btn => btn.text.includes('Подробный анализ'))).toBe(true);
      expect(buttons.some(btn => btn.text.includes('Прогнозы'))).toBe(true);
      expect(buttons.some(btn => btn.text.includes('Обновить'))).toBe(true);
    });
  });

  describe('handleCallback', () => {
    test('should handle detailed analysis callback', async () => {
      const mockQuery = {
        id: 'callback_123',
        message: mockMessage,
        data: 'insights_detailed'
      };

      const mockUser = {
        ...global.createMockUser(),
        totalResponses: 20
      };

      User.findOne.mockResolvedValue(mockUser);
      
      // Mock detailed analysis
      jest.spyOn(insightsCommand, 'showDetailedAnalysis').mockResolvedValue();

      await insightsCommand.handleCallback(mockBot, mockQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback_123');
      expect(insightsCommand.showDetailedAnalysis).toHaveBeenCalledWith(
        mockBot, 
        mockMessage.chat.id, 
        mockUser._id
      );
    });

    test('should handle predictions callback', async () => {
      const mockQuery = {
        id: 'callback_456',
        message: mockMessage,
        data: 'insights_predictions'
      };

      const mockUser = {
        ...global.createMockUser(),
        totalResponses: 20
      };

      User.findOne.mockResolvedValue(mockUser);
      
      // Mock predictions display
      jest.spyOn(insightsCommand, 'showPredictions').mockResolvedValue();

      await insightsCommand.handleCallback(mockBot, mockQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith('callback_456');
      expect(insightsCommand.showPredictions).toHaveBeenCalledWith(
        mockBot, 
        mockMessage.chat.id, 
        mockUser._id
      );
    });

    test('should handle refresh callback', async () => {
      const mockQuery = {
        id: 'callback_789',
        message: mockMessage,
        data: 'insights_refresh'
      };

      await insightsCommand.handleCallback(mockBot, mockQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
        'callback_789', 
        { text: 'Обновляем...' }
      );
      
      // Should call execute again
      expect(mockBot.sendMessage).toHaveBeenCalled();
    });

    test('should handle unknown callback gracefully', async () => {
      const mockQuery = {
        id: 'callback_unknown',
        message: mockMessage,
        data: 'insights_unknown'
      };

      await insightsCommand.handleCallback(mockBot, mockQuery);

      expect(mockBot.answerCallbackQuery).toHaveBeenCalledWith(
        'callback_unknown', 
        { text: 'Неизвестная команда' }
      );
    });
  });

  describe('helper methods', () => {
    test('formatInsight should format insight with emoji and confidence', () => {
      const insight = {
        type: 'time_pattern',
        message: 'Test message',
        confidence: 0.85,
        emoji: '⏰'
      };

      const formatted = insightsCommand.formatInsight(insight);

      expect(formatted).toContain('⏰');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('85%'); // Confidence
    });

    test('formatPrediction should format prediction with probability', () => {
      const prediction = {
        time: '14:00',
        predictedMood: 8.2,
        predictedEnergy: 7.8,
        confidence: 0.82
      };

      const formatted = insightsCommand.formatPrediction(prediction);

      expect(formatted).toContain('14:00');
      expect(formatted).toContain('8.2');
      expect(formatted).toContain('7.8');
      expect(formatted).toContain('82%');
    });

    test('shouldShowQuickInsight should return true for frequent users', () => {
      const user = { totalResponses: 25 };
      
      const result = insightsCommand.shouldShowQuickInsight(user);

      expect(result).toBe(true);
    });

    test('shouldShowQuickInsight should return false for new users', () => {
      const user = { totalResponses: 5 };
      
      const result = insightsCommand.shouldShowQuickInsight(user);

      expect(result).toBe(false);
    });
  });
});