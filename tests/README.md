# Test Suite for MSE Telegram Bot

## 🚀 Overview

This test suite provides comprehensive coverage for the MSE Telegram Bot, focusing on the critical components introduced in PR #18 (AI insights system).

## 📋 Test Structure

```
tests/
├── setup.js                           # Global test setup and mocks
├── commands/
│   └── insights.test.js              # /insights command integration tests
├── services/
│   ├── ai-insights-service.test.js   # AI insights service unit tests
│   ├── pattern-analysis-service.test.js # Pattern analysis unit tests
│   └── predictive-analytics-service.test.js # Predictive analytics tests
└── README.md                         # This file
```

## 🧪 Running Tests

### Install dependencies:
```bash
npm install
```

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Generate coverage report:
```bash
npm run test:coverage
```

## 📊 Test Coverage

### High Priority (PR #18 Critical Path):
- ✅ **AIInsightsService** - Tests AI integration, fallback logic, error handling
- ✅ **PatternAnalysisService** - Tests behavioral pattern detection and analysis
- ✅ **PredictiveAnalyticsService** - Tests forecasting and trend analysis
- ✅ **Insights Command** - Tests end-to-end user interaction flow

### Key Test Scenarios:

#### AI Integration Tests:
- ✅ OpenAI API success and failure scenarios
- ✅ Anthropic fallback when OpenAI fails
- ✅ Graceful degradation when both AI services fail
- ✅ Malformed AI response handling
- ✅ Rate limiting and error recovery

#### Pattern Analysis Tests:
- ✅ Time pattern detection (best/worst hours, day of week)
- ✅ Activity pattern analysis (mood boosters, energy drains)
- ✅ Social context preferences
- ✅ Correlation analysis between metrics
- ✅ Anomaly detection
- ✅ Empty data handling

#### Predictive Analytics Tests:
- ✅ Time-based predictions
- ✅ Trend analysis (improving, declining, stable)
- ✅ Activity recommendations
- ✅ Flow state predictions
- ✅ Confidence scoring
- ✅ Insufficient data scenarios

#### Command Integration Tests:
- ✅ Full user flow with sufficient data
- ✅ New user experience (insufficient data)
- ✅ Unregistered user handling
- ✅ Service failure scenarios
- ✅ Interactive button functionality

## 🔧 Test Configuration

### Environment Variables:
Tests run with mocked environment variables in `tests/setup.js`:
- `NODE_ENV=test`
- `BOT_TOKEN=test_bot_token`
- `MONGODB_URI=mongodb://localhost:27017/mse_bot_test`
- `OPENAI_API_KEY=test_openai_key`
- `ANTHROPIC_API_KEY=test_anthropic_key`

### Global Mocks:
- Console methods (to reduce test noise)
- Telegram Bot API methods
- Database models
- External AI services

### Test Helpers:
- `createMockUser()` - Creates standardized mock user objects
- `createMockResponse()` - Creates mock survey response data
- `createMockBot()` - Creates mock Telegram bot instance

## 🎯 Quality Metrics

### Expected Coverage:
- **Services**: >90% line coverage
- **Commands**: >85% line coverage
- **Critical paths**: 100% coverage

### Test Quality Standards:
- Each test focuses on a single responsibility
- Clear test names describing the scenario
- Comprehensive error scenario coverage
- Real-world data patterns in mocks
- Isolated tests with proper setup/teardown

## 🚨 Critical Test Cases

### Must-Pass Scenarios:
1. **AI Service Failures** - System must gracefully degrade
2. **Insufficient Data** - Appropriate user guidance
3. **Malformed Data** - Robust error handling
4. **Rate Limiting** - Proper retry and fallback logic
5. **User Experience** - Clear messaging and helpful responses

### Performance Considerations:
- Tests use mocked external services (no real API calls)
- Database queries are mocked for speed
- Test timeout set to 30 seconds for complex scenarios

## 📈 Continuous Improvement

### Adding New Tests:
1. Follow existing naming conventions
2. Use provided test helpers
3. Mock external dependencies
4. Include both success and failure scenarios
5. Update this README with new test descriptions

### Test Maintenance:
- Run tests before each commit
- Update tests when modifying services
- Keep mocks realistic and up-to-date
- Monitor coverage reports

## 🔍 Debugging Tests

### Common Issues:
- **Async/Await**: Ensure all async operations are properly awaited
- **Mock Cleanup**: Use `jest.clearAllMocks()` in `beforeEach`
- **Timeout Issues**: Check for unresolved promises
- **Mock Conflicts**: Verify mocks don't interfere with each other

### Debug Commands:
```bash
# Run specific test file
npm test insights.test.js

# Run with verbose output
npm test -- --verbose

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

---

This test suite ensures the reliability and robustness of the AI-powered insights system, providing confidence for production deployment and future development.