const config = require('../config/hurlburt');
const Response = require('../models/Response');
const User = require('../models/User');

/**
 * Progressive Education System - Provides targeted education about common DES reporting errors
 * 
 * Based on Hurlburt's finding that users need progressive education to overcome:
 * - Systematic biases in self-reporting
 * - Common illusions about inner experience
 * - Confusion between experience and interpretation
 * - Temporal displacement (reporting periods instead of moments)
 */
class ProgressiveEducationSystem {
  constructor() {
    this.config = config;
    
    // Educational modules organized by learning progression
    this.educationalModules = {
      // Day 1: Basic concepts
      day1: {
        concepts: ['moment_vs_period', 'experience_vs_interpretation', 'concrete_vs_abstract'],
        lessons: {
          moment_vs_period: {
            title: "Момент vs Период",
            explanation: "Сигнал - это фотовспышка, освещающая ОДИН момент, не период времени",
            commonErrors: [
              "❌ 'Я работал за компьютером' (период)",
              "❌ 'Весь день думал о проекте' (период)",
              "❌ 'Сегодня утром читал' (период)"
            ],
            correctExamples: [
              "✅ 'Смотрел на слово 'deadline' в письме'",
              "✅ 'Видел курсор мигающий после буквы 'т''",
              "✅ 'Слышал звук клавиши при нажатии'"
            ],
            practiceExercise: "Опишите что происходило ИМЕННО в момент сигнала, как будто это фотография"
          },
          
          experience_vs_interpretation: {
            title: "Опыт vs Интерпретация",
            explanation: "Описывайте что БЫЛО, а не что вы думаете об этом",
            commonErrors: [
              "❌ 'Я думаю, что был сосредоточен'",
              "❌ 'Наверное, читал внимательно'",
              "❌ 'Кажется, был в хорошем настроении'"
            ],
            correctExamples: [
              "✅ 'Видел четко каждую букву'",
              "✅ 'Слышал тишину в комнате'",
              "✅ 'Чувствовал тепло от чашки в руке'"
            ],
            practiceExercise: "Уберите слова 'думаю', 'кажется', 'наверное' и опишите прямо"
          },
          
          concrete_vs_abstract: {
            title: "Конкретное vs Абстрактное",
            explanation: "Описывайте конкретные ощущения, а не абстрактные понятия",
            commonErrors: [
              "❌ 'Чувствовал продуктивность'",
              "❌ 'Был в состоянии концентрации'",
              "❌ 'Ощущал мотивацию'"
            ],
            correctExamples: [
              "✅ 'Пальцы быстро двигались по клавишам'",
              "✅ 'Глаза сфокусированы на экране'",
              "✅ 'Дыхание было ровным и глубоким'"
            ],
            practiceExercise: "Замените абстрактные понятия на конкретные ощущения"
          }
        }
      },
      
      // Day 2: Advanced distinctions
      day2: {
        concepts: ['inner_speech_reality', 'emotion_vs_thought', 'sensory_specificity'],
        lessons: {
          inner_speech_reality: {
            title: "Реальность внутренней речи",
            explanation: "Исследования показывают: только 26% моментов содержат внутреннюю речь",
            scientificFact: "При чтении внутренний голос есть только в 3% случаев (Hurlburt & Heavey, 2018)",
            commonIllusion: "Многие думают, что 'всегда говорят себе', но это иллюзия",
            checkQuestions: [
              "Вы действительно СЛЫШАЛИ слова или просто знали их смысл?",
              "Был ли это голос или просто понимание?",
              "Можете описать характеристики голоса (мужской/женский, громкий/тихий)?"
            ],
            practiceExercise: "При следующем чтении проверьте: есть ли внутренний голос или только понимание?"
          },
          
          emotion_vs_thought: {
            title: "Эмоция vs Мысль об эмоции",
            explanation: "Различайте физическое ощущение эмоции от мысли о ней",
            commonErrors: [
              "❌ 'Чувствовал радость' (ярлык)",
              "❌ 'Был в грустном настроении' (оценка)",
              "❌ 'Испытывал стресс' (интерпретация)"
            ],
            correctExamples: [
              "✅ 'Тепло расходилось от груди'",
              "✅ 'Тяжесть в области сердца'",
              "✅ 'Напряжение в плечах и шее'"
            ],
            practiceExercise: "Где в теле вы чувствуете эмоцию? Опишите физические ощущения"
          },
          
          sensory_specificity: {
            title: "Сенсорная специфичность",
            explanation: "Добавляйте конкретные сенсорные детали",
            senses: {
              visual: "Что именно видели? Цвет, форма, движение, свет?",
              auditory: "Что слышали? Громкость, тон, направление звука?",
              tactile: "Что чувствовали телом? Температура, текстура, давление?",
              proprioceptive: "Как располагалось тело? Поза, напряжение, движение?"
            },
            practiceExercise: "Добавьте к описанию детали от каждого органа чувств"
          }
        }
      },
      
      // Day 3: Mastery and refinement
      day3: {
        concepts: ['pristine_experience', 'emptiness_recognition', 'temporal_precision'],
        lessons: {
          pristine_experience: {
            title: "Чистый опыт",
            explanation: "Описывайте опыт без примесей интерпретации, оценки или теоретизирования",
            characteristics: [
              "Прямое описание без 'потому что'",
              "Настоящее время, не прошедшее",
              "Конкретные детали, не обобщения",
              "Сенсорные данные, не выводы"
            ],
            masteryCriteria: [
              "Отсутствие слов-паразитов ('думаю', 'кажется')",
              "Присутствие сенсорных деталей",
              "Временная точность (момент, не период)",
              "Отсутствие причинно-следственных связей"
            ]
          },
          
          emptiness_recognition: {
            title: "Признание пустоты",
            explanation: "Иногда в момент сигнала действительно 'ничего' не происходит - и это ценные данные",
            commonAvoidance: [
              "Придумывание несуществующих мыслей",
              "Описание того, что было до или после",
              "Заполнение пустоты теориями"
            ],
            correctApproach: [
              "✅ 'В тот момент не было мыслей'",
              "✅ 'Сознание было пустым'",
              "✅ 'Ничего конкретного не происходило'"
            ],
            validation: "Пустота - это тоже опыт. Не бойтесь её признавать"
          },
          
          temporal_precision: {
            title: "Временная точность",
            explanation: "Максимальная точность в определении момента",
            techniques: [
              "Техника 'стоп-кадр': представьте момент как замороженную фотографию",
              "Техника 'до-во время-после': что было именно ВО ВРЕМЯ сигнала",
              "Техника 'фокус': на чём был сфокусирован в тот момент"
            ],
            practiceExercise: "Опишите момент с точностью до секунды"
          }
        }
      }
    };
    
    // Error patterns and their educational interventions
    this.errorInterventions = {
      generalization: {
        trigger: /всегда|никогда|обычно|часто|редко/i,
        intervention: 'moment_vs_period',
        message: "Избегайте обобщений. Опишите именно ТОТ момент"
      },
      
      theorizing: {
        trigger: /думаю что|наверное|возможно|кажется/i,
        intervention: 'experience_vs_interpretation',
        message: "Опишите что БЫЛО, а не что думаете об этом"
      },
      
      temporal_displacement: {
        trigger: /сегодня|утром|вечером|весь день|до этого/i,
        intervention: 'temporal_precision',
        message: "Фокус на моменте сигнала, не на периоде времени"
      },
      
      inner_speech_overreporting: {
        trigger: /внутренний голос|проговариваю|говорю себе/i,
        intervention: 'inner_speech_reality',
        message: "Проверьте: действительно ли был голос или только понимание?"
      },
      
      emotion_labeling: {
        trigger: /чувствую радость|испытываю грусть|в хорошем настроении/i,
        intervention: 'emotion_vs_thought',
        message: "Опишите физические ощущения эмоции, а не её название"
      },
      
      abstraction: {
        trigger: /продуктивность|эффективность|концентрация|мотивация/i,
        intervention: 'concrete_vs_abstract',
        message: "Замените абстрактные понятия на конкретные ощущения"
      }
    };
  }

  /**
   * Provide education based on user's training day and detected errors
   */
  async provideEducation(response, user, detectedErrors = []) {
    const trainingDay = response.metadata.trainingDay || 1;
    const dayModule = this.educationalModules[`day${Math.min(trainingDay, 3)}`];
    
    if (!dayModule) return null;
    
    const education = {
      trainingDay,
      concepts: dayModule.concepts,
      lessons: [],
      interventions: [],
      practiceExercises: [],
      progressAssessment: null
    };
    
    // 1. Provide day-appropriate lessons
    if (this.shouldProvideBasicEducation(user, trainingDay)) {
      education.lessons = this.selectDayLessons(dayModule, user);
    }
    
    // 2. Provide error-specific interventions
    if (detectedErrors.length > 0) {
      education.interventions = this.generateErrorInterventions(detectedErrors);
    }
    
    // 3. Generate practice exercises
    education.practiceExercises = this.generatePracticeExercises(dayModule, detectedErrors);
    
    // 4. Assess progress
    education.progressAssessment = await this.assessProgress(user, trainingDay);
    
    return education;
  }

  /**
   * Determine if user needs basic education
   */
  shouldProvideBasicEducation(user, trainingDay) {
    // Always provide on day 1
    if (trainingDay === 1) return true;
    
    // Provide if user is struggling (low average quality)
    if (user.averageDataQuality < 50) return true;
    
    // Provide if user hasn't seen this day's content
    const seenConcepts = user.learningProgress?.conceptsUnderstood || [];
    const dayModule = this.educationalModules[`day${Math.min(trainingDay, 3)}`];
    
    return !dayModule.concepts.every(concept => seenConcepts.includes(concept));
  }

  /**
   * Select appropriate lessons for the day
   */
  selectDayLessons(dayModule, user) {
    const lessons = [];
    const userWeaknesses = this.identifyUserWeaknesses(user);
    
    // Prioritize lessons based on user weaknesses
    for (const concept of dayModule.concepts) {
      if (userWeaknesses.includes(concept) || !this.hasUserMasteredConcept(user, concept)) {
        lessons.push({
          concept,
          ...dayModule.lessons[concept]
        });
      }
    }
    
    return lessons.slice(0, 2); // Limit to 2 lessons per session
  }

  /**
   * Generate error-specific interventions
   */
  generateErrorInterventions(detectedErrors) {
    const interventions = [];
    
    for (const error of detectedErrors) {
      const intervention = this.errorInterventions[error.type];
      if (intervention) {
        interventions.push({
          errorType: error.type,
          intervention: intervention.intervention,
          message: intervention.message,
          severity: error.severity || 'medium',
          examples: this.getInterventionExamples(intervention.intervention)
        });
      }
    }
    
    return interventions;
  }

  /**
   * Generate practice exercises
   */
  generatePracticeExercises(dayModule, detectedErrors) {
    const exercises = [];
    
    // Add concept-based exercises
    for (const concept of dayModule.concepts) {
      const lesson = dayModule.lessons[concept];
      if (lesson && lesson.practiceExercise) {
        exercises.push({
          type: 'concept',
          concept,
          exercise: lesson.practiceExercise,
          difficulty: this.getExerciseDifficulty(concept)
        });
      }
    }
    
    // Add error-specific exercises
    for (const error of detectedErrors) {
      const exercise = this.generateErrorSpecificExercise(error);
      if (exercise) {
        exercises.push(exercise);
      }
    }
    
    return exercises.slice(0, 3); // Limit to 3 exercises
  }

  /**
   * Assess user's learning progress
   */
  async assessProgress(user, trainingDay) {
    const assessment = {
      overallProgress: 0,
      conceptMastery: {},
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
    
    // Get recent responses for analysis
    const recentResponses = await Response.find({
      userId: user._id,
      'metadata.trainingDay': { $lte: trainingDay }
    }).sort({ timestamp: -1 }).limit(10);
    
    if (recentResponses.length === 0) return assessment;
    
    // Analyze concept mastery
    const allConcepts = Object.values(this.educationalModules)
      .flatMap(module => module.concepts);
    
    for (const concept of allConcepts) {
      assessment.conceptMastery[concept] = this.assessConceptMastery(concept, recentResponses);
    }
    
    // Calculate overall progress
    const masteryScores = Object.values(assessment.conceptMastery);
    assessment.overallProgress = masteryScores.length > 0 ? 
      masteryScores.reduce((a, b) => a + b, 0) / masteryScores.length : 0;
    
    // Identify strengths and weaknesses
    assessment.strengths = Object.keys(assessment.conceptMastery)
      .filter(concept => assessment.conceptMastery[concept] > 0.7);
    
    assessment.weaknesses = Object.keys(assessment.conceptMastery)
      .filter(concept => assessment.conceptMastery[concept] < 0.4);
    
    // Generate recommendations
    assessment.recommendations = this.generateProgressRecommendations(assessment, trainingDay);
    
    return assessment;
  }

  /**
   * Assess mastery of specific concept
   */
  assessConceptMastery(concept, responses) {
    let masteryScore = 0;
    let relevantResponses = 0;
    
    for (const response of responses) {
      const text = this.extractResponseText(response);
      const conceptScore = this.evaluateConceptInResponse(concept, text);
      
      if (conceptScore !== null) {
        masteryScore += conceptScore;
        relevantResponses++;
      }
    }
    
    return relevantResponses > 0 ? masteryScore / relevantResponses : 0;
  }

  /**
   * Evaluate how well a concept is demonstrated in response
   */
  evaluateConceptInResponse(concept, text) {
    switch (concept) {
      case 'moment_vs_period':
        // Check for present tense and moment-specific language
        const presentTense = /вижу|делаю|слышу|чувствую/i.test(text);
        const momentLanguage = /в момент|именно тогда|прямо сейчас/i.test(text);
        const periodLanguage = /весь день|утром|сегодня|всегда/i.test(text);
        
        if (presentTense && momentLanguage && !periodLanguage) return 1.0;
        if (presentTense && !periodLanguage) return 0.7;
        if (!periodLanguage) return 0.5;
        return 0.2;
        
      case 'experience_vs_interpretation':
        const directDescription = !/думаю|кажется|наверное/i.test(text);
        const concreteDetails = /вижу|слышу|чувствую|ощущаю/i.test(text);
        
        if (directDescription && concreteDetails) return 1.0;
        if (directDescription) return 0.6;
        return 0.3;
        
      case 'concrete_vs_abstract':
        const abstractTerms = /продуктивность|эффективность|концентрация/i.test(text);
        const concreteTerms = /экран|клавиатура|рука|глаз|звук/i.test(text);
        
        if (concreteTerms && !abstractTerms) return 1.0;
        if (!abstractTerms) return 0.6;
        return 0.2;
        
      default:
        return null;
    }
  }

  /**
   * Generate progress-based recommendations
   */
  generateProgressRecommendations(assessment, trainingDay) {
    const recommendations = [];
    
    if (assessment.overallProgress < 0.4) {
      recommendations.push({
        priority: 'high',
        type: 'extension',
        message: 'Рекомендуется продлить обучение на 1-2 дня для лучшего усвоения'
      });
    }
    
    if (assessment.weaknesses.length > 2) {
      recommendations.push({
        priority: 'medium',
        type: 'focus',
        message: `Сосредоточьтесь на: ${assessment.weaknesses.slice(0, 2).join(', ')}`
      });
    }
    
    if (assessment.strengths.length > 0) {
      recommendations.push({
        priority: 'low',
        type: 'encouragement',
        message: `Отличный прогресс в: ${assessment.strengths.join(', ')}`
      });
    }
    
    return recommendations;
  }

  /**
   * Helper methods
   */
  identifyUserWeaknesses(user) {
    // Analyze user's common patterns to identify weaknesses
    const commonPatterns = user.commonPatterns || [];
    const weaknesses = [];
    
    if (commonPatterns.includes('generalization')) weaknesses.push('moment_vs_period');
    if (commonPatterns.includes('theorizing')) weaknesses.push('experience_vs_interpretation');
    if (commonPatterns.includes('abstraction')) weaknesses.push('concrete_vs_abstract');
    
    return weaknesses;
  }

  hasUserMasteredConcept(user, concept) {
    const understoodConcepts = user.learningProgress?.conceptsUnderstood || [];
    return understoodConcepts.includes(concept);
  }

  getInterventionExamples(interventionType) {
    const dayModule = Object.values(this.educationalModules)
      .find(module => module.concepts.includes(interventionType));
    
    if (dayModule && dayModule.lessons[interventionType]) {
      return {
        correct: dayModule.lessons[interventionType].correctExamples || [],
        incorrect: dayModule.lessons[interventionType].commonErrors || []
      };
    }
    
    return { correct: [], incorrect: [] };
  }

  getExerciseDifficulty(concept) {
    const difficulties = {
      moment_vs_period: 'beginner',
      experience_vs_interpretation: 'intermediate',
      concrete_vs_abstract: 'beginner',
      inner_speech_reality: 'advanced',
      emotion_vs_thought: 'intermediate',
      sensory_specificity: 'intermediate',
      pristine_experience: 'advanced',
      emptiness_recognition: 'advanced',
      temporal_precision: 'advanced'
    };
    
    return difficulties[concept] || 'intermediate';
  }

  generateErrorSpecificExercise(error) {
    const exercises = {
      generalization: {
        type: 'error_correction',
        exercise: 'Перепишите ваш ответ, убрав слова "всегда", "обычно", "часто"',
        difficulty: 'beginner'
      },
      theorizing: {
        type: 'error_correction',
        exercise: 'Замените "думаю", "кажется" на прямое описание того, что было',
        difficulty: 'intermediate'
      },
      inner_speech_overreporting: {
        type: 'verification',
        exercise: 'Проверьте: действительно ли вы СЛЫШАЛИ слова или только понимали смысл?',
        difficulty: 'advanced'
      }
    };
    
    return exercises[error.type] || null;
  }

  extractResponseText(response) {
    const texts = [];
    if (response.responses?.currentThoughts) texts.push(response.responses.currentThoughts);
    if (response.responses?.currentActivity) texts.push(response.responses.currentActivity);
    if (response.responses?.currentEmotions) texts.push(response.responses.currentEmotions);
    return texts.join(' ');
  }
}

module.exports = new ProgressiveEducationSystem();
