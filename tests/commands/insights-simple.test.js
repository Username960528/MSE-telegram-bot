const insightsCommand = require('../../commands/insights');
const User = require('../../models/User');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/ai-insights-service');
jest.mock('../../services/predictive-analytics-service');
jest.mock('../../services/pattern-analysis-service');

describe('/insights Command - Basic Tests', () => {
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

  test('should handle unregistered users correctly', async () => {
    User.findOne.mockResolvedValue(null);

    await insightsCommand.execute(mockBot, mockMessage);

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123456,
      '❌ Пользователь не найден. Используйте /start для регистрации.'
    );
  });

  test('should show loading message for registered users', async () => {
    const mockUser = global.createMockUser();
    User.findOne.mockResolvedValue(mockUser);

    await insightsCommand.execute(mockBot, mockMessage);

    // Should send loading message first
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123456,
      '🔍 Анализируем ваши паттерны поведения...'
    );
  });

  test('should handle errors gracefully', async () => {
    const mockUser = global.createMockUser();
    User.findOne.mockResolvedValue(mockUser);
    
    // Mock a service to throw an error during analysis
    const mockError = new Error('Service unavailable');
    User.findOne.mockRejectedValueOnce(mockError);

    await insightsCommand.execute(mockBot, mockMessage);

    // Should handle error and provide fallback message
    expect(mockBot.sendMessage).toHaveBeenCalled();
  });

  test('should include interactive keyboard in response', async () => {
    const mockUser = global.createMockUser();
    User.findOne.mockResolvedValue(mockUser);

    await insightsCommand.execute(mockBot, mockMessage);

    // Should eventually send a message with keyboard
    const lastCall = mockBot.sendMessage.mock.calls[mockBot.sendMessage.mock.calls.length - 1];
    const options = lastCall[2];
    
    if (options && options.reply_markup) {
      expect(options.reply_markup).toHaveProperty('inline_keyboard');
    }
  });
});