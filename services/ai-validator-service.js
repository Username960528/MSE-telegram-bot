const config = require('../config/hurlburt');
const goldenExamples = require('../config/golden-examples-config');

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
    
    this.initializeProvider();
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
   * Основная функция валидации через ИИ
   */
  async validate(text, context = {}) {
    if (!this.config.enableSmartValidation) {
      return null;
    }

    // Проверяем кэш
    const cacheKey = this.getCacheKey(text, context);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let result;
    
    try {
      switch (this.provider) {
        case 'openai':
          result = await this.validateWithOpenAI(text, context);
          break;
        case 'anthropic':
          result = await this.validateWithAnthropic(text, context);
          break;
        case 'local':
          result = await this.validateLocally(text, context);
          break;
        default:
          result = null;
      }
      
      // Кэшируем результат
      if (result) {
        this.cache.set(cacheKey, result);
        
        // Очищаем старый кэш если слишком большой
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }
      
      return result;
    } catch (error) {
      console.error('AI Validation error:', error);
      return this.validateLocally(text, context);
    }
  }

  /**
   * Валидация через OpenAI GPT-4
   */
  async validateWithOpenAI(text, context) {
    const prompt = this.constructPrompt(text, context);
    
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

    const response = completion.data.choices[0].message.content;
    return this.parseAIResponse(response);
  }

  /**
   * Валидация через Anthropic Claude
   */
  async validateWithAnthropic(text, context) {
    const prompt = this.constructPrompt(text, context);
    
    const message = await this.anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 500,
      temperature: 0.3,
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return this.parseAIResponse(message.content[0].text);
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
    return `You are an expert validator for the Experience Sampling Method (ESM) based on Russell Hurlburt's research.

Your task is to evaluate how well a person described their momentary conscious experience.

Key principles from Hurlburt:
1. MOMENT over period - response should describe a specific instant
2. SENSORY DETAILS over abstractions - what they saw/heard/felt
3. BODY doesn't lie - physical sensations are more reliable than thoughts
4. EMPTINESS is also experience - don't make things up
5. Reading inner speech exists in only 3% of samples (Hurlburt & Heavey, 2018)

Red flags:
- "usually", "always", "often" = generalization
- "interesting", "boring" = abstraction
- "all day", "morning" = not a moment
- "probably", "I think" = theorizing
- "nothing special" = avoidance

Golden signs:
- Specific moment indicated
- Sensory details present
- Bodily sensations described
- Direct speech of thoughts
- Acknowledged emptiness when it was there

Respond with a JSON object containing:
{
  "score": 0-100,
  "quality": "pristine|excellent|good|fair|poor|garbage",
  "issues": ["list", "of", "detected", "issues"],
  "suggestions": ["specific", "actionable", "suggestions"],
  "phenomena": ["detected", "Hurlburt", "phenomena"],
  "educationalValue": 0-1,
  "confidence": 0-1
}`;
  }

  /**
   * Конструирование промпта для ИИ
   */
  constructPrompt(text, context) {
    let prompt = `Evaluate this ESM response:\n\n`;
    prompt += `Response: "${text}"\n\n`;
    
    if (context.detectedContext) {
      prompt += `Context: ${context.detectedContext}\n`;
    }
    
    if (context.trainingDay) {
      prompt += `Training day: ${context.trainingDay}\n`;
    }
    
    if (context.previousResponses) {
      prompt += `Note: User has tendency to ${this.detectUserTendencies(context.previousResponses)}\n`;
    }
    
    prompt += `\nProvide detailed analysis focusing on Hurlburt's criteria.`;
    
    // Добавляем примеры из золотого стандарта для контекста
    if (context.detectedContext && goldenExamples.examples[context.detectedContext]) {
      const examples = goldenExamples.examples[context.detectedContext];
      prompt += `\n\nExcellent example for reference: "${examples.excellent[0].text}"`;
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
      // Пытаемся распарсить JSON
      const parsed = JSON.parse(response);
      
      // Валидация структуры
      const validated = {
        score: Math.max(0, Math.min(100, parsed.score || 50)),
        quality: parsed.quality || 'fair',
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        phenomena: Array.isArray(parsed.phenomena) ? parsed.phenomena : [],
        educationalValue: parsed.educationalValue || 0.5,
        confidence: parsed.confidence || 0.7
      };
      
      return validated;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return null;
    }
  }

  /**
   * Генерация follow-up вопросов через ИИ
   */
  async generateFollowUp(text, context) {
    if (!this.isConfigured || this.provider === 'local') {
      return null;
    }

    const prompt = `Based on this ESM response, generate ONE follow-up question to help the person observe their experience more accurately:

Response: "${text}"
Context: ${context.detectedContext || 'unknown'}

The question should:
- Be short (under 20 words)
- Focus on sensory experience
- Not be accusatory
- Help break through common illusions

If the response is already excellent, return null.

Respond with JSON: {"question": "..." } or {"question": null}`;

    try {
      let result;
      
      if (this.provider === 'openai') {
        const completion = await this.openai.createChatCompletion({
          model: "gpt-4-turbo-preview",
          messages: [
            { role: "system", content: "You are an expert in Descriptive Experience Sampling." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 100
        });
        result = completion.data.choices[0].message.content;
      } else if (this.provider === 'anthropic') {
        const message = await this.anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
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
    return `${text.substring(0, 50)}_${context.detectedContext || 'none'}_${context.trainingDay || 0}`;
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
        agreementRate: trainingData.filter(d => d.agreement).length / trainingData.length,
        exportDate: new Date(),
        modelVersion: this.config.ml.modelVersion || '1.0'
      }
    };
  }
}

module.exports = new AIValidatorService();