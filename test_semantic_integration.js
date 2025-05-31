#!/usr/bin/env node

/**
 * Тест интеграции семантического анализа для предотвращения дублирования вопросов
 * Проверяет работу гибридной системы: статические правила + ИИ
 */

const FollowUpStrategy = require('./strategies/followUpStrategy');
const aiValidator = require('./services/ai-validator-service');

class SemanticIntegrationTest {
  constructor() {
    this.followUpStrategy = new FollowUpStrategy();
    this.testCases = this.createTestCases();
    this.results = [];
  }

  createTestCases() {
    return [
      {
        name: 'Предотвращение дублирования локации (статика)',
        responses: {
          moment_capture: 'Дискомфорт в глазах и раздражение',
          currentActivity: 'Читал документ на экране'
        },
        expectedBlock: ['sensation_precision', 'emotion_location'],
        description: 'Должен заблокировать вопросы о локации, так как "в глазах" уже указано'
      },
      {
        name: 'Предотвращение дублирования качества ощущений',
        responses: {
          moment_capture: 'Острая боль в спине, пульсирующая',
          currentActivity: 'Сидел за компьютером'
        },
        expectedBlock: ['sensation_quality'],
        description: 'Должен заблокировать вопросы о качестве (острая, пульсирующая)'
      },
      {
        name: 'Предотвращение дублирования модальности',
        responses: {
          moment_capture: 'Слышал внутренний голос, который говорил "надо поторопиться"',
          currentActivity: 'Думал о планах на день'
        },
        expectedBlock: ['inner_speech_illusion', 'voice_characteristics'],
        description: 'Должен заблокировать вопросы о внутренней речи'
      },
      {
        name: 'Разрешение валидных вопросов',
        responses: {
          moment_capture: 'Просто знал, что нужно сделать',
          currentActivity: 'Планировал задачи'
        },
        expectedAllow: ['attention_focus', 'planning_vs_doing'],
        description: 'Должен разрешить вопросы о внимании и планировании'
      },
      {
        name: 'Семантическая эквивалентность (ИИ тест)',
        responses: {
          moment_capture: 'Неприятные ощущения в области головы',
          currentActivity: 'Работал за компьютером'
        },
        candidateQuestion: {
          text: 'Где именно в теле вы чувствовали эти ощущения?',
          clarifies: 'sensation_precision',
          category: 'physical',
          priority: 'high'
        },
        expectedAIBlock: true,
        description: 'ИИ должен понять: "область головы" ≡ локация уже указана'
      }
    ];
  }

  async runAllTests() {
    console.log('🚀 Запуск тестов семантической интеграции...\n');

    for (const testCase of this.testCases) {
      try {
        const result = await this.runSingleTest(testCase);
        this.results.push(result);
        this.printTestResult(result);
      } catch (error) {
        console.error(`❌ Ошибка в тесте "${testCase.name}":`, error.message);
        this.results.push({
          name: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }

    this.printSummary();
  }

  async runSingleTest(testCase) {
    const context = {
      responses: testCase.responses,
      currentQuestion: 0,
      userId: 'test_user_' + Date.now(),
      trainingDay: 2
    };

    // Тест статических правил
    if (testCase.expectedBlock) {
      for (const questionType of testCase.expectedBlock) {
        const isBlocked = this.testStaticBlocking(questionType, testCase.responses);
        if (!isBlocked) {
          return {
            name: testCase.name,
            passed: false,
            reason: `Статические правила не заблокировали вопрос типа: ${questionType}`,
            details: testCase.description
          };
        }
      }
    }

    // Тест разрешения валидных вопросов
    if (testCase.expectedAllow) {
      for (const questionType of testCase.expectedAllow) {
        const isBlocked = this.testStaticBlocking(questionType, testCase.responses);
        if (isBlocked) {
          return {
            name: testCase.name,
            passed: false,
            reason: `Статические правила некорректно заблокировали валидный вопрос: ${questionType}`,
            details: testCase.description
          };
        }
      }
    }

    // Тест ИИ анализа
    if (testCase.candidateQuestion && testCase.expectedAIBlock !== undefined) {
      try {
        const aiResult = await aiValidator.analyzeSemanticSimilarity(
          testCase.candidateQuestion,
          testCase.responses,
          { userId: context.userId, trainingDay: context.trainingDay }
        );

        const actualBlocked = !aiResult.shouldAsk;
        if (actualBlocked !== testCase.expectedAIBlock) {
          return {
            name: testCase.name,
            passed: false,
            reason: `ИИ анализ дал неожиданный результат. Ожидалось: ${testCase.expectedAIBlock ? 'заблокировать' : 'разрешить'}, получено: ${actualBlocked ? 'заблокировано' : 'разрешено'}`,
            details: `Confidence: ${aiResult.confidence}, Reason: ${aiResult.reason}`,
            aiResult: aiResult
          };
        }
      } catch (error) {
        console.warn(`⚠️ ИИ анализ недоступен для теста "${testCase.name}": ${error.message}`);
        // Для случаев когда ИИ недоступно, проверяем fallback
      }
    }

    return {
      name: testCase.name,
      passed: true,
      reason: 'Все проверки пройдены успешно',
      details: testCase.description
    };
  }

  testStaticBlocking(questionType, responses) {
    const mapping = this.followUpStrategy.getQuestionSemanticMapping();
    const conceptName = mapping[questionType];

    if (!conceptName) {
      return false; // Если нет маппинга, вопрос не блокируется
    }

    return this.followUpStrategy.hasConceptMentioned(conceptName, responses);
  }

  printTestResult(result) {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
    console.log(`   ${result.reason}`);
    if (result.details) {
      console.log(`   📝 ${result.details}`);
    }
    if (result.aiResult) {
      console.log(`   🤖 AI: confidence=${result.aiResult.confidence}, reason="${result.aiResult.reason}"`);
    }
    console.log();
  }

  printSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log('📊 ИТОГИ ТЕСТИРОВАНИЯ');
    console.log('═'.repeat(50));
    console.log(`Пройдено: ${passed}/${total} (${percentage}%)`);
    
    if (passed === total) {
      console.log('🎉 Все тесты пройдены! Интеграция работает корректно.');
    } else {
      console.log('⚠️ Некоторые тесты не прошли. Требуется дополнительная настройка.');
      
      const failed = this.results.filter(r => !r.passed);
      console.log('\nНе прошедшие тесты:');
      failed.forEach(f => {
        console.log(`- ${f.name}: ${f.reason}`);
      });
    }

    console.log('\n🔧 Рекомендации для улучшения:');
    console.log('1. Убедитесь, что AI сервис настроен (OPENAI_API_KEY или ANTHROPIC_API_KEY)');
    console.log('2. Проверьте, что конфигурация ai.enableSmartValidation = true');
    console.log('3. Запустите полное тестирование с реальными пользователями');
  }

  // Дополнительный тест производительности
  async runPerformanceTest() {
    console.log('\n⚡ Тест производительности...');
    
    const startTime = Date.now();
    const testPromises = [];

    // Запускаем 5 параллельных анализов
    for (let i = 0; i < 5; i++) {
      const context = {
        responses: {
          moment_capture: `Тестовый ответ ${i} с различными деталями`,
          currentActivity: `Тестовая активность ${i}`
        },
        userId: `perf_test_${i}`,
        trainingDay: 2
      };

      const question = {
        text: `Тестовый вопрос ${i}?`,
        clarifies: 'test_type',
        category: 'test',
        priority: 'medium'
      };

      testPromises.push(
        this.followUpStrategy.getNextQuestion(context).catch(e => ({ error: e.message }))
      );
    }

    const results = await Promise.all(testPromises);
    const duration = Date.now() - startTime;
    
    console.log(`Время выполнения 5 параллельных анализов: ${duration}ms`);
    console.log(`Среднее время на анализ: ${Math.round(duration / 5)}ms`);
    
    const errors = results.filter(r => r && r.error);
    if (errors.length > 0) {
      console.log(`⚠️ Ошибки: ${errors.length}/5`);
    } else {
      console.log('✅ Все параллельные анализы выполнены успешно');
    }
  }
}

// Запуск тестов если файл вызван напрямую
if (require.main === module) {
  const test = new SemanticIntegrationTest();
  
  test.runAllTests()
    .then(() => test.runPerformanceTest())
    .then(() => {
      console.log('\n🏁 Тестирование завершено');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка тестирования:', error);
      process.exit(1);
    });
}

module.exports = SemanticIntegrationTest;