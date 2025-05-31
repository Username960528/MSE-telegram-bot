// Jest setup file for MSE Telegram Bot tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = 'test_bot_token';
process.env.MONGODB_URI = 'mongodb://localhost:27017/mse_bot_test';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.ANTHROPIC_API_KEY = 'test_anthropic_key';

// Mock console.log to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test helpers
global.createMockUser = () => ({
  _id: 'mock_user_id',
  telegramId: 123456789,
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  totalResponses: 15,
  registeredAt: new Date('2024-01-01'),
  preferences: {
    addressForm: 'informal'
  }
});

global.createMockResponse = () => ({
  _id: 'mock_response_id',
  userId: 'mock_user_id',
  responses: {
    mood: 7,
    energy: 6,
    stress: 3,
    focus: 8,
    currentThoughts: 'Thinking about the test',
    currentActivity: 'Writing code'
  },
  metadata: {
    challenge: 7,
    skill: 8,
    flowState: 'flow',
    dataQualityScore: 85
  },
  timestamp: new Date()
});

// Mock Telegram bot
global.createMockBot = () => ({
  sendMessage: jest.fn().mockResolvedValue({}),
  editMessageText: jest.fn().mockResolvedValue({}),
  answerCallbackQuery: jest.fn().mockResolvedValue({})
});