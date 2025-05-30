const config = require('../config/hurlburt');
const goldenExamples = require('../config/golden-examples-config');
const crypto = require('crypto');
const { startValidation, endValidation, recordValidationError, recordAIUsage, recordCacheHit, recordCacheMiss } = require('../utils/metrics');

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('Shutting down AI Validator...');
  if (global.aiValidator) {
    global.aiValidator.cleanup();
  }
  process.exit(0);
});

/**
 * Сервис интеграции с ИИ для валидации ответов ESM
 * Поддерживает OpenAI GPT-4, Anthropic Claude, локальные модели
 */
class AIValidatorService {
  constructor() {
    this.config = config.ai;
    this.isConfigured = false;
    this.provider = null;
    this.cache = new Map(); // Кэш для экономии API запросов
    this.rateLimiter = new Map(); // Rate limiting для предотвращения злоупотреблений
    this.requestQueue = []; // Очередь запросов
    this.isProcessingQueue = false;
    
    // Настройки по умолчанию
    this.defaultSettings = {
      timeout: 30000, // 30 секунд для Claude
      maxRetries: 3,
      cacheTTL: 24 * 60 * 60 * 1000, // 24 часа
      rateLimit: {
        requests: 10,
        window: 60000 // 1 минута
      }
    };
    
    this.initializeProvider();
    this.startCacheCleanup();
  }

  /**
   * Инициализация провайдера ИИ
   */
  async initializeProvider() {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const { Configuration, OpenAIApi } = require('openai');
        const configuration = new Configuration({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.openai = new OpenAIApi(configuration);
        this.provider = 'openai';
        this.isConfigured = true;
        console.log('✅ AI Validator: OpenAI GPT-4 configured');
      } catch (error) {
        console.log('⚠️ AI Validator: OpenAI not available');
      }
    }
    
    // Anthropic Claude
    if (process.env.ANTHROPIC_API_KEY && !this.isConfigured) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.provider = 'anthropic';
        this.isConfigured = true;
        console.log('✅ AI Validator: Anthropic Claude configured');
      } catch (error) {
        console.log('⚠️ AI Validator: Anthropic not available');
      }
    }
    
    // Если нет внешних API, используем упрощённую локальную валидацию
    if (!this.isConfigured) {
      this.provider = 'local';
      console.log('ℹ️ AI Validator: Using local validation only');
    }
  }

  /**
   * Основная функция валидации через ИИ с улучшенной обработкой ошибок
   */
  async validate(text, context = {}) {
    if (!this.config.enableSmartValidation) {
      return null;
    }

    // Начинаем отслеживание метрик
    const userId = context.userId || 'anonymous';
    const timerId = startValidation(userId, 'ai_validation');

    // Проверяем rate limit
    if (!this.checkRateLimit(userId)) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      const localResult = await this.validateLocally(text, context);
      endValidation(timerId, localResult);
      return localResult;
    }

    // Проверяем кэш
    const cacheKey = this.getCacheKey(text, context);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      recordCacheHit();
      endValidation(timerId, cached);
      return cached;
    }

    recordCacheMiss();
    let result;
    
    try {
      // Graceful degradation with timeout
      result = await this.validateWithRetries(text, context);
      
      // Кэшируем результат с TTL
      if (result) {
        this.setCachedResult(cacheKey, result);
      }
      
      endValidation(timerId, result);
      return result;
    } catch (error) {
      console.error('AI Validation failed, falling back to local:', error);
      recordValidationError(error, timerId);
      
      const localResult = await this.validateLocally(text, context);
      return localResult;
    }
  }

  /**
   * Валидация через OpenAI GPT-4
   */
  async validateWithOpenAI(text, context) {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }
    
    const prompt = this.constructPrompt(text, context);
    
    try {
      const completion = await this.openai.createChatCompletion({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const response = completion.data.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }
      
      recordAIUsage('openai', true);
      return this.parseAIResponse(response);
    } catch (error) {
      console.error('OpenAI API error:', error);
      recordAIUsage('openai', false);
      throw error;
    }
  }

  /**
   * Валидация через Anthropic Claude
   */
  async validateWithAnthropic(text, context) {
    if (!this.anthropic) {
      throw new Error('Anthropic not configured');
    }
    
    const prompt = this.constructPrompt(text, context);
    
    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        temperature: 0.3,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = message.content?.[0]?.text;
      if (!responseText) {
        throw new Error('Empty response from Anthropic');
      }
      
      return this.parseAIResponse(responseText);
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  /**
   * Локальная валидация (упрощённая)
   */
  async validateLocally(text, context) {
    // Используем паттерны из золотого стандарта
    const analysis = {
      score: 50,
      quality: 'fair',
      issues: [],
      suggestions: [],
      phenomena: [],
      confidence: 0.6
    };

    // Простые проверки на основе паттернов
    const textLower = text.toLowerCase();
    
    // Проверка на иллюзии
    if (context.detectedContext === 'reading' && 
        /внутренн.*голос|проговарива/i.test(text)) {
      analysis.issues.push('reading_voice_illusion');
      analysis.suggestions.push('Вероятная иллюзия: только 3% чтения включает внутренний голос');
      analysis.score -= 20;
    }

    // Проверка на специфичность
    if (text.split(/\s+/).length < 10) {
      analysis.issues.push('too_brief');
      analysis.suggestions.push('Добавьте больше конкретных деталей момента');
      analysis.score -= 10;
    }

    // Проверка на феномены Херлберта
    if (/говорю себе|слышу слова/i.test(text)) {
      analysis.phenomena.push('inner_speech');
    }
    if (/вижу образ|представляю/i.test(text)) {
      analysis.phenomena.push('inner_seeing');
    }
    if (/просто знаю|понимаю без слов/i.test(text)) {
      analysis.phenomena.push('unsymbolized_thinking');
    }

    analysis.quality = this.scoreToQuality(analysis.score);
    
    return analysis;
  }

  /**
   * Системный промпт для ИИ
   */
  getSystemPrompt() {
    return `Вы эксперт по валидации ответов для метода Experience Sampling Method (ESM) на основе исследований Рассела Херлберта.

Ваша задача - оценить, насколько хорошо человек описал свой моментальный сознательный опыт.

Ключевые принципы Херлберта:
1. МОМЕНТ, а не период - ответ должен описывать конкретный миг
2. СЕНСОРНЫЕ ДЕТАЛИ, а не абстракции - что видел/слышал/чувствовал
3. ТЕЛО не лжет - физические ощущения надежнее мыслей
4. ПУСТОТА тоже опыт - не надо придумывать
5. Внутренняя речь при чтении есть только в 3% случаев (Hurlburt & Heavey, 2018)

Красные флаги (плохо):
- "обычно", "всегда", "часто" = обобщение
- "интересно", "скучно" = абстракция  
- "весь день", "утром" = не момент
- "наверное", "думаю" = теоретизирование
- "ничего особенного" = избегание

Золотые признаки (хорошо):
- Указан конкретный момент
- Есть сенсорные детали
- Описаны телесные ощущения
- Прямая речь мыслей
- Признана пустота, если она была

ВАЖНО: Отвечайте ТОЛЬКО валидным JSON на русском языке. Не включайте никакого текста до или после JSON объекта.

Отвечайте в точно такой JSON структуре:
{
  "score": 0-100,
  "quality": "pristine|excellent|good|fair|poor|garbage",
  "issues": ["список", "обнаруженных", "проблем"],
  "suggestions": ["конкретные", "практические", "рекомендации"],
  "phenomena": ["обнаруженные", "феномены", "Херлберта"],
  "educationalValue": 0-1,
  "confidence": 0-1
}`;
  }

  /**
   * Конструирование промпта для ИИ
   */
  constructPrompt(text, context) {
    let prompt = `Оцените этот ответ ESM:\n\n`;
    prompt += `Ответ: "${text}"\n\n`;
    
    if (context.detectedContext) {
      prompt += `Контекст: ${context.detectedContext}\n`;
    }
    
    if (context.trainingDay) {
      prompt += `День обучения: ${context.trainingDay}\n`;
    }
    
    if (context.previousResponses) {
      prompt += `Примечание: У пользователя есть тенденция ${this.detectUserTendencies(context.previousResponses)}\n`;
    }
    
    prompt += `\nПроведите детальный анализ, фокусируясь на критериях Херлберта.`;
    
    // Добавляем примеры из золотого стандарта для контекста
    if (context.detectedContext && goldenExamples.examples[context.detectedContext]) {
      const examples = goldenExamples.examples[context.detectedContext];
      prompt += `\n\nПример отличного ответа для справки: "${examples.excellent[0].text}"`;
    }
    
    return prompt;
  }

  /**
   * Определение тенденций пользователя
   */
  detectUserTendencies(previousResponses) {
    const tendencies = [];
    
    const innerSpeechCount = previousResponses.filter(r => 
      /внутренн.*голос|проговарива/i.test(r)
    ).length;
    
    if (innerSpeechCount > previousResponses.length * 0.5) {
      tendencies.push('overreport inner speech');
    }
    
    const genericCount = previousResponses.filter(r =>
      /обычно|нормально|как всегда/i.test(r)
    ).length;
    
    if (genericCount > previousResponses.length * 0.3) {
      tendencies.push('give generic responses');
    }
    
    return tendencies.join(', ') || 'no clear patterns';
  }

  /**
   * Парсинг ответа ИИ
   */
  parseAIResponse(response) {
    try {
      // Очищаем ответ от лишних символов
      let cleanResponse = response.trim().replace(/```json\n?|```\n?/g, '');
      
      // Ищем JSON объект в тексте
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      // Пытаемся распарсить JSON
      const parsed = JSON.parse(cleanResponse);
      
      // Строгая валидация структуры
      const validated = {
        score: this.validateNumber(parsed.score, 0, 100, 50),
        quality: this.validateQuality(parsed.quality),
        issues: this.validateArray(parsed.issues),
        suggestions: this.validateArray(parsed.suggestions),
        phenomena: this.validateArray(parsed.phenomena),
        educationalValue: this.validateNumber(parsed.educationalValue, 0, 1, 0.5),
        confidence: this.validateNumber(parsed.confidence, 0, 1, 0.7),
        timestamp: Date.now(),
        provider: this.provider
      };
      
      return validated;
    } catch (error) {
      console.error('Failed to parse AI response:', {
        error: error.message,
        response: response?.substring(0, 200),
        provider: this.provider
      });
      return this.createFallbackResponse();
    }
  }

  /**
   * Валидация числовых значений
   */
  validateNumber(value, min, max, defaultValue) {
    const num = parseFloat(value);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
  }

  /**
   * Валидация качества
   */
  validateQuality(quality) {
    const validQualities = ['pristine', 'excellent', 'good', 'fair', 'poor', 'garbage'];
    return validQualities.includes(quality) ? quality : 'fair';
  }

  /**
   * Валидация массивов
   */
  validateArray(arr) {
    return Array.isArray(arr) ? arr.filter(item => typeof item === 'string') : [];
  }

  /**
   * Создание fallback ответа при ошибке парсинга
   */
  createFallbackResponse() {
    return {
      score: 50,
      quality: 'fair',
      issues: ['ai_parsing_error'],
      suggestions: ['Попробуйте быть более конкретным'],
      phenomena: [],
      educationalValue: 0.3,
      confidence: 0.3,
      timestamp: Date.now(),
      provider: 'fallback'
    };
  }

  /**
   * Генерация follow-up вопросов через ИИ
   */
  async generateFollowUp(text, context) {
    if (!this.isConfigured || this.provider === 'local') {
      return null;
    }

    // Проверяем лимит follow-up вопросов
    if (context.followUpCount >= 2) {
      return null; // Максимум 2 follow-up вопроса
    }

    const prompt = `На основе этого ответа ESM, сгенерируйте ОДИН уточняющий вопрос на русском языке, чтобы помочь человеку точнее наблюдать свой опыт:

Ответ: "${text}"
Контекст: ${context.detectedContext || 'неизвестен'}
Количество предыдущих уточнений: ${context.followUpCount || 0}

Вопрос должен:
- Быть коротким (до 15 слов)
- Фокусироваться на сенсорном опыте
- Не быть обвиняющим
- Помочь преодолеть иллюзии

НЕ задавайте вопрос если:
- Ответ уже содержит конкретные сенсорные детали
- Пользователь уже описал физические ощущения подробно
- Ответ содержит более 20 слов с хорошими деталями
- Пользователь раздражен или говорит "я уже сказал"

Отвечайте JSON: {"question": "..." } или {"question": null}`;

    try {
      let result;
      
      if (this.provider === 'openai') {
        const completion = await this.openai.createChatCompletion({
          model: "gpt-4-turbo-preview",
          messages: [
            { role: "system", content: "Вы эксперт по Descriptive Experience Sampling. Отвечайте только на русском языке." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 100
        });
        result = completion.data.choices[0].message.content;
      } else if (this.provider === 'anthropic') {
        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }]
        });
        result = message.content[0].text;
      }
      
      const parsed = JSON.parse(result);
      return parsed.question;
    } catch (error) {
      console.error('Failed to generate follow-up:', error);
      return null;
    }
  }

  /**
   * Анализ паттернов пользователя через ИИ
   */
  async analyzeUserPatterns(userId, responses) {
    if (!this.config.enablePatternDetection || responses.length < this.config.minDataForPersonalization) {
      return null;
    }

    // Подготавливаем данные для анализа
    const summary = responses.map(r => ({
      text: r.text,
      quality: r.quality,
      phenomena: r.phenomena || []
    }));

    const prompt = `Analyze these ESM responses for patterns and provide personalized insights:

${JSON.stringify(summary, null, 2)}

Identify:
1. Common mistakes or illusions
2. Strengths in observation
3. Specific recommendations for improvement
4. Estimated phenomena frequencies

Respond with actionable insights in JSON format.`;

    try {
      // Вызываем ИИ для анализа
      const analysis = await this.validate(prompt, { isMetaAnalysis: true });
      return analysis;
    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return null;
    }
  }

  /**
   * Получение ключа кэша
   */
  getCacheKey(text, context) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(`${text}_${context.detectedContext || 'none'}_${context.trainingDay || 0}`)
      .digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Получение результата из кэша с проверкой TTL
   */
  getCachedResult(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    
    // Проверяем TTL
    if (Date.now() - cached.timestamp > this.defaultSettings.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Сохранение результата в кэш с timestamp
   */
  setCachedResult(cacheKey, result) {
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    // Ограничиваем размер кэша
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Проверка rate limit
   */
  checkRateLimit(userId) {
    const now = Date.now();
    const userRequests = this.rateLimiter.get(userId) || [];
    
    // Очищаем старые запросы
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.defaultSettings.rateLimit.window
    );
    
    if (recentRequests.length >= this.defaultSettings.rateLimit.requests) {
      return false;
    }
    
    recentRequests.push(now);
    this.rateLimiter.set(userId, recentRequests);
    return true;
  }

  /**
   * Валидация с повторными попытками и timeout
   */
  async validateWithRetries(text, context, attempt = 1) {
    const maxRetries = this.defaultSettings.maxRetries;
    
    try {
      // Timeout обёртка
      const result = await Promise.race([
        this.validateWithProvider(text, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.defaultSettings.timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      console.warn(`AI validation attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.validateWithRetries(text, context, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Выбор провайдера для валидации
   */
  async validateWithProvider(text, context) {
    switch (this.provider) {
      case 'openai':
        return await this.validateWithOpenAI(text, context);
      case 'anthropic':
        return await this.validateWithAnthropic(text, context);
      case 'local':
        return await this.validateLocally(text, context);
      default:
        throw new Error('No valid provider configured');
    }
  }

  /**
   * Периодическая очистка кэша
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.defaultSettings.cacheTTL) {
          this.cache.delete(key);
        }
      }
      
      // Очищаем rate limiter
      for (const [userId, requests] of this.rateLimiter.entries()) {
        const recentRequests = requests.filter(
          timestamp => now - timestamp < this.defaultSettings.rateLimit.window
        );
        
        if (recentRequests.length === 0) {
          this.rateLimiter.delete(userId);
        } else {
          this.rateLimiter.set(userId, recentRequests);
        }
      }
      
      console.log(`Cache cleanup: ${this.cache.size} entries, ${this.rateLimiter.size} rate limit entries`);
    }, 60 * 60 * 1000); // Каждый час
  }

  /**
   * Преобразование оценки в качество
   */
  scoreToQuality(score) {
    if (score >= 90) return 'pristine';
    if (score >= 80) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'garbage';
  }

  /**
   * Получение статистики использования
   */
  getUsageStats() {
    return {
      cacheSize: this.cache.size,
      rateLimitEntries: this.rateLimiter.size,
      provider: this.provider,
      isConfigured: this.isConfigured,
      uptime: process.uptime(),
      lastCacheCleanup: this.lastCacheCleanup || 'never'
    };
  }

  /**
   * Экспорт данных для обучения модели
   */
  async exportTrainingData(responses) {
    const trainingData = [];
    
    for (const response of responses) {
      if (response.aiValidation) {
        trainingData.push({
          input: response.text,
          context: response.context,
          output: response.aiValidation,
          humanValidation: response.quality,
          agreement: response.aiValidation.quality === response.quality
        });
      }
    }
    
    return {
      data: trainingData,
      metadata: {
        totalSamples: trainingData.length,
        agreementRate: trainingData.length > 0 ? 
          trainingData.filter(d => d.agreement).length / trainingData.length : 0,
        exportDate: new Date(),
        modelVersion: this.config?.ml?.modelVersion || '1.0',
        provider: this.provider
      }
    };
  }

  /**
   * Очистка ресурсов при завершении
   */
  cleanup() {
    this.cache.clear();
    this.rateLimiter.clear();
    console.log('AI Validator cleanup completed');
  }
}

module.exports = new AIValidatorService();