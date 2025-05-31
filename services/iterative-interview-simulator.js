const aiValidator = require('./ai-validator-service');
const followUpStrategy = require('../strategies/followUpStrategy');
const config = require('../config/hurlburt');

/**
 * Iterative Interview Simulator - Replicates the crucial iterative learning process 
 * that human DES interviewers provide
 * 
 * Based on Hurlburt's methodology where skilled interviewers:
 * 1. Detect vague responses and probe for specificity
 * 2. Identify uncertainty markers and explore them
 * 3. Break down illusions through targeted questioning
 * 4. Guide users toward pristine experience reporting
 */
class IterativeInterviewSimulator {
  constructor() {
    this.config = config;
    
    // Uncertainty markers that trigger follow-up
    this.uncertaintyMarkers = [
      /\bум\b|\bэм\b|\bэээ\b/i,                    // Verbal hesitations
      /я думаю|мне кажется|наверное|возможно/i,     // Uncertainty expressions
      /не уверен|не знаю точно|трудно сказать/i,   // Direct uncertainty
      /что-то вроде|типа|как бы/i,                 // Approximations
      /может быть|вроде бы|похоже на/i             // Tentative language
    ];
    
    // Vague response patterns that need probing
    this.vaguenessPatterns = [
      /работал|делал|занимался/i,                  // Generic activities
      /думал|размышлял|обдумывал/i,                // Generic thinking
      /чувствовал себя|было состояние/i,           // Generic feelings
      /как всегда|как обычно|нормально/i,          // Generic evaluations
      /ничего особенного|всё ок|всё хорошо/i       // Dismissive responses
    ];
    
    // Probing question templates for different scenarios
    this.probingTemplates = {
      uncertainty: [
        "Вы сказали '{marker}' - что именно вызывает неуверенность?",
        "Когда вы говорите '{marker}', что конкретно трудно описать?",
        "Давайте разберём это '{marker}' - что вы помните точно?"
      ],
      
      vagueness: [
        "Вы сказали '{vague}' - что ИМЕННО вы делали в тот момент?",
        "'{vague}' - это очень общо. Опишите конкретное действие",
        "Что конкретно происходило, когда вы '{vague}'?"
      ],
      
      illusion: [
        "Вы уверены, что действительно '{claim}'? Проверьте ещё раз",
        "Это было реальное ощущение или предположение о том, что должно быть?",
        "Опишите это '{claim}' максимально конкретно"
      ],
      
      specificity: [
        "Можете добавить больше деталей о том, что видели/слышали/чувствовали?",
        "Что ещё происходило в тот момент? Какие ощущения в теле?",
        "Опишите это как фотографию - что именно было в кадре?"
      ]
    };
    
    // Interview session state tracking
    this.activeSessions = new Map();
  }

  /**
   * Main interview simulation function
   */
  async conductInterview(response, context) {
    const sessionId = `${context.userId}_${Date.now()}`;
    const session = this.initializeSession(sessionId, response, context);
    
    try {
      // Phase 1: Initial response analysis
      const initialAnalysis = await this.analyzeInitialResponse(response);
      session.analysis = initialAnalysis;
      
      // Phase 2: Generate probing questions
      const probingQuestions = await this.generateProbingQuestions(initialAnalysis, context);
      session.probingQuestions = probingQuestions;
      
      // Phase 3: Simulate iterative refinement
      const refinementPlan = await this.createRefinementPlan(initialAnalysis, context);
      session.refinementPlan = refinementPlan;
      
      // Phase 4: Generate immediate follow-up if needed
      const immediateFollowUp = await this.selectImmediateFollowUp(probingQuestions, context);
      
      this.activeSessions.set(sessionId, session);
      
      return {
        sessionId,
        immediateFollowUp,
        analysis: initialAnalysis,
        refinementPlan,
        interviewComplete: false
      };
      
    } catch (error) {
      console.error('Interview simulation error:', error);
      return null;
    }
  }

  /**
   * Initialize interview session
   */
  initializeSession(sessionId, response, context) {
    return {
      sessionId,
      userId: context.userId,
      startTime: Date.now(),
      originalResponse: response,
      context,
      iterationCount: 0,
      maxIterations: context.trainingDay <= 2 ? 4 : 3,
      responses: [response],
      analysis: null,
      probingQuestions: [],
      refinementPlan: null,
      breakthroughsAchieved: [],
      skillsTargeted: []
    };
  }

  /**
   * Analyze initial response for interview planning
   */
  async analyzeInitialResponse(response) {
    const text = this.extractResponseText(response);
    
    const analysis = {
      uncertaintyLevel: this.detectUncertaintyLevel(text),
      vaguenessLevel: this.detectVaguenessLevel(text),
      specificityScore: this.calculateSpecificityScore(text),
      illusionRisk: this.assessIllusionRisk(text),
      probingNeeds: [],
      targetAreas: []
    };
    
    // Determine what needs probing
    if (analysis.uncertaintyLevel > 0.3) {
      analysis.probingNeeds.push('uncertainty');
      analysis.targetAreas.push('confidence_building');
    }
    
    if (analysis.vaguenessLevel > 0.4) {
      analysis.probingNeeds.push('vagueness');
      analysis.targetAreas.push('specificity_training');
    }
    
    if (analysis.illusionRisk > 0.5) {
      analysis.probingNeeds.push('illusion');
      analysis.targetAreas.push('illusion_breaking');
    }
    
    if (analysis.specificityScore < 40) {
      analysis.probingNeeds.push('specificity');
      analysis.targetAreas.push('detail_enhancement');
    }
    
    return analysis;
  }

  /**
   * Detect uncertainty level in response
   */
  detectUncertaintyLevel(text) {
    let uncertaintyCount = 0;
    let totalMarkers = 0;
    
    this.uncertaintyMarkers.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        uncertaintyCount += matches.length;
        totalMarkers++;
      }
    });
    
    // Normalize by text length
    const textLength = text.split(/\s+/).length;
    return Math.min(1.0, (uncertaintyCount * 10) / textLength);
  }

  /**
   * Detect vagueness level in response
   */
  detectVaguenessLevel(text) {
    let vaguenessCount = 0;
    
    this.vaguenessPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        vaguenessCount++;
      }
    });
    
    return Math.min(1.0, vaguenessCount / 5);
  }

  /**
   * Calculate specificity score
   */
  calculateSpecificityScore(text) {
    const words = text.split(/\s+/);
    let specificityScore = 0;
    
    // Concrete nouns boost score
    const concreteNouns = /экран|клавиатура|стол|окно|рука|глаз|звук|свет/i;
    const concreteMatches = text.match(concreteNouns);
    if (concreteMatches) specificityScore += concreteMatches.length * 10;
    
    // Sensory details boost score
    const sensoryWords = /вижу|слышу|чувствую|ощущаю|касаюсь|пахнет/i;
    const sensoryMatches = text.match(sensoryWords);
    if (sensoryMatches) specificityScore += sensoryMatches.length * 15;
    
    // Present tense boosts score
    const presentTense = /вижу|делаю|нахожусь|смотрю|слушаю/i;
    const presentMatches = text.match(presentTense);
    if (presentMatches) specificityScore += presentMatches.length * 8;
    
    // Length penalty for too short responses
    if (words.length < 10) specificityScore -= 20;
    
    return Math.max(0, Math.min(100, specificityScore));
  }

  /**
   * Assess illusion risk
   */
  assessIllusionRisk(text) {
    let riskScore = 0;
    
    // Reading voice illusion
    if (/чита.*внутренн.*голос|проговарива.*чтени/i.test(text)) {
      riskScore += 0.8;
    }
    
    // Constant inner speech illusion
    if (/всегда.*говорю.*себе|постоянно.*внутренн.*речь/i.test(text)) {
      riskScore += 0.6;
    }
    
    // Emotion labeling instead of experience
    if (/чувствую.*радость|испытываю.*грусть/i.test(text)) {
      riskScore += 0.4;
    }
    
    return Math.min(1.0, riskScore);
  }

  /**
   * Generate probing questions based on analysis
   */
  async generateProbingQuestions(analysis, context) {
    const questions = [];
    
    for (const need of analysis.probingNeeds) {
      const templates = this.probingTemplates[need];
      if (templates) {
        // Select appropriate template based on context
        const template = this.selectTemplate(templates, context);
        const question = await this.customizeQuestion(template, analysis, context);
        
        questions.push({
          type: need,
          question,
          priority: this.calculateQuestionPriority(need, analysis),
          expectedOutcome: this.defineExpectedOutcome(need)
        });
      }
    }
    
    // Sort by priority
    return questions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Select appropriate template based on context
   */
  selectTemplate(templates, context) {
    // For training days, use gentler language
    if (context.trainingDay <= 2) {
      return templates[0]; // Usually the gentlest option
    }
    
    // For advanced users, can be more direct
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Customize question based on specific response content
   */
  async customizeQuestion(template, analysis, context) {
    // Use AI to customize if available
    if (this.config.ai?.enableSmartValidation && aiValidator.customizeQuestion) {
      try {
        return await aiValidator.customizeQuestion(template, analysis, context);
      } catch (error) {
        console.warn('AI question customization failed, using template');
      }
    }
    
    // Fallback to template substitution
    return template.replace(/\{[^}]+\}/g, '...');
  }

  /**
   * Calculate question priority
   */
  calculateQuestionPriority(questionType, analysis) {
    const priorities = {
      illusion: 10,      // Highest priority - breaks false beliefs
      uncertainty: 8,    // High priority - builds confidence
      vagueness: 6,      // Medium priority - improves specificity
      specificity: 4     // Lower priority - refinement
    };
    
    return priorities[questionType] || 1;
  }

  /**
   * Define expected outcome for question type
   */
  defineExpectedOutcome(questionType) {
    const outcomes = {
      uncertainty: 'Increased confidence and clarity in reporting',
      vagueness: 'More specific and concrete descriptions',
      illusion: 'Recognition and breaking of false assumptions',
      specificity: 'Enhanced sensory and temporal detail'
    };
    
    return outcomes[questionType] || 'Improved response quality';
  }

  /**
   * Create refinement plan for multi-iteration interview
   */
  async createRefinementPlan(analysis, context) {
    const plan = {
      totalIterations: Math.min(analysis.targetAreas.length + 1, 4),
      iterations: []
    };
    
    // Plan each iteration
    for (let i = 0; i < plan.totalIterations; i++) {
      const iteration = {
        number: i + 1,
        focus: this.selectIterationFocus(analysis.targetAreas, i),
        techniques: this.selectTechniques(analysis.targetAreas, i),
        successCriteria: this.defineSuccessCriteria(analysis.targetAreas, i)
      };
      
      plan.iterations.push(iteration);
    }
    
    return plan;
  }

  /**
   * Select immediate follow-up question
   */
  async selectImmediateFollowUp(probingQuestions, context) {
    if (probingQuestions.length === 0) {
      return null;
    }
    
    // Select highest priority question
    const selectedQuestion = probingQuestions[0];
    
    return {
      text: selectedQuestion.question,
      type: selectedQuestion.type,
      expectedOutcome: selectedQuestion.expectedOutcome,
      interviewTechnique: 'probing'
    };
  }

  /**
   * Process follow-up response in interview context
   */
  async processFollowUpResponse(sessionId, followUpResponse) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    session.iterationCount++;
    session.responses.push(followUpResponse);
    
    // Analyze improvement
    const improvement = await this.analyzeImprovement(session);
    
    // Determine if interview should continue
    const shouldContinue = this.shouldContinueInterview(session, improvement);
    
    if (shouldContinue && session.iterationCount < session.maxIterations) {
      // Generate next question
      const nextQuestion = await this.generateNextQuestion(session, improvement);
      return {
        continueInterview: true,
        nextQuestion,
        improvement,
        sessionId
      };
    } else {
      // Complete interview
      const summary = await this.completeInterview(session, improvement);
      this.activeSessions.delete(sessionId);
      
      return {
        continueInterview: false,
        interviewComplete: true,
        summary,
        improvement
      };
    }
  }

  /**
   * Extract response text for analysis
   */
  extractResponseText(response) {
    const texts = [];
    if (response.responses?.currentThoughts) texts.push(response.responses.currentThoughts);
    if (response.responses?.currentActivity) texts.push(response.responses.currentActivity);
    if (response.responses?.currentEmotions) texts.push(response.responses.currentEmotions);
    return texts.join(' ');
  }

  /**
   * Helper methods for iteration planning
   */
  selectIterationFocus(targetAreas, iterationIndex) {
    const focusMap = {
      0: 'uncertainty_reduction',
      1: 'specificity_enhancement', 
      2: 'illusion_breaking',
      3: 'detail_refinement'
    };
    
    return focusMap[iterationIndex] || 'general_improvement';
  }

  selectTechniques(targetAreas, iterationIndex) {
    // Return appropriate techniques for each iteration
    return ['probing_questions', 'specificity_training', 'illusion_detection'];
  }

  defineSuccessCriteria(targetAreas, iterationIndex) {
    return {
      minSpecificityScore: 60 + (iterationIndex * 10),
      maxUncertaintyLevel: 0.3 - (iterationIndex * 0.1),
      requiredElements: ['present_tense', 'sensory_details']
    };
  }

  async analyzeImprovement(session) {
    // Compare latest response with original
    const original = session.responses[0];
    const latest = session.responses[session.responses.length - 1];
    
    const originalText = this.extractResponseText(original);
    const latestText = this.extractResponseText(latest);
    
    return {
      specificityImprovement: this.calculateSpecificityScore(latestText) - this.calculateSpecificityScore(originalText),
      uncertaintyReduction: this.detectUncertaintyLevel(originalText) - this.detectUncertaintyLevel(latestText),
      vaguenessReduction: this.detectVaguenessLevel(originalText) - this.detectVaguenessLevel(latestText),
      lengthIncrease: latestText.length - originalText.length
    };
  }

  shouldContinueInterview(session, improvement) {
    // Continue if there's still room for improvement
    const latestResponse = session.responses[session.responses.length - 1];
    const latestText = this.extractResponseText(latestResponse);
    
    const currentSpecificity = this.calculateSpecificityScore(latestText);
    const currentUncertainty = this.detectUncertaintyLevel(latestText);
    
    return currentSpecificity < 70 || currentUncertainty > 0.2;
  }

  async generateNextQuestion(session, improvement) {
    // Generate next question based on current state and improvement
    const latestResponse = session.responses[session.responses.length - 1];
    const analysis = await this.analyzeInitialResponse(latestResponse);
    
    const questions = await this.generateProbingQuestions(analysis, session.context);
    return questions[0] || null;
  }

  async completeInterview(session, improvement) {
    return {
      sessionId: session.sessionId,
      totalIterations: session.iterationCount,
      finalImprovement: improvement,
      breakthroughsAchieved: session.breakthroughsAchieved,
      skillsTargeted: session.skillsTargeted,
      interviewDuration: Date.now() - session.startTime,
      finalQuality: this.calculateFinalQuality(session)
    };
  }

  calculateFinalQuality(session) {
    const finalResponse = session.responses[session.responses.length - 1];
    const finalText = this.extractResponseText(finalResponse);
    return this.calculateSpecificityScore(finalText);
  }
}

module.exports = new IterativeInterviewSimulator();
