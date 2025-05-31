const config = require('../config/hurlburt');

/**
 * Uncertainty Detector - Identifies uncertainty markers and generates appropriate responses
 * 
 * Based on DES research showing that uncertainty markers ("um", "I think", "maybe") 
 * indicate areas where users need more guidance to achieve pristine experience reporting
 */
class UncertaintyDetector {
  constructor() {
    this.config = config;
    
    // Comprehensive uncertainty markers with confidence levels
    this.uncertaintyMarkers = {
      // Verbal hesitations (highest confidence indicators)
      verbal: {
        patterns: [
          /\bум+\b|\bэм+\b|\bэээ+\b/gi,
          /\bхм+\b|\bммм+\b/gi,
          /\bну+\b(?=\s)/gi,  // "ну" at start of phrases
          /\.{3,}|…+/g        // Ellipses indicating pause
        ],
        confidence: 0.9,
        weight: 3
      },
      
      // Cognitive uncertainty (high confidence)
      cognitive: {
        patterns: [
          /не уверен|не знаю точно|трудно сказать/gi,
          /сложно описать|не могу точно|затрудняюсь/gi,
          /не помню точно|смутно помню/gi
        ],
        confidence: 0.85,
        weight: 3
      },
      
      // Epistemic uncertainty (medium-high confidence)
      epistemic: {
        patterns: [
          /я думаю|мне кажется|по-моему/gi,
          /наверное|возможно|вероятно/gi,
          /скорее всего|похоже на то/gi,
          /как будто|словно|вроде как/gi
        ],
        confidence: 0.75,
        weight: 2
      },
      
      // Approximation markers (medium confidence)
      approximation: {
        patterns: [
          /что-то вроде|типа|как бы/gi,
          /примерно|приблизительно|около/gi,
          /где-то|как-то так|в районе/gi,
          /более-менее|почти что/gi
        ],
        confidence: 0.65,
        weight: 2
      },
      
      // Tentative language (lower confidence but still relevant)
      tentative: {
        patterns: [
          /может быть|возможно что|не исключено/gi,
          /допускаю что|предполагаю/gi,
          /если не ошибаюсь|насколько помню/gi
        ],
        confidence: 0.6,
        weight: 1
      },
      
      // Qualification markers (context-dependent)
      qualification: {
        patterns: [
          /в принципе|в общем-то|в целом/gi,
          /так сказать|если можно так выразиться/gi,
          /условно говоря|образно говоря/gi
        ],
        confidence: 0.5,
        weight: 1
      }
    };
    
    // Response strategies for different uncertainty types
    this.responseStrategies = {
      verbal: {
        immediate: "Не торопитесь. Что вы помните точно?",
        probing: "Давайте разберём по частям. Начните с того, что помните чётко",
        supportive: "Это нормально - не все моменты запоминаются одинаково хорошо"
      },
      
      cognitive: {
        immediate: "Что именно трудно описать? Попробуйте начать с простого",
        probing: "Даже если не уверены - опишите первое, что приходит в голову",
        supportive: "Неуверенность - это ценная информация. Что вызывает сомнения?"
      },
      
      epistemic: {
        immediate: "Вместо 'думаю' - что вы помните или ощущали?",
        probing: "Попробуйте заменить 'кажется' на конкретное описание",
        supportive: "Доверьтесь первому впечатлению, не анализируйте"
      },
      
      approximation: {
        immediate: "Можете быть более точным? Что именно вы имеете в виду?",
        probing: "Опишите это 'что-то' максимально конкретно",
        supportive: "Приблизительность - это начало. Добавьте деталей"
      },
      
      tentative: {
        immediate: "Что заставляет вас сомневаться? Опишите уверенную часть",
        probing: "Разделите на то, что точно было, и то, в чём сомневаетесь",
        supportive: "Сомнения показывают, что вы внимательно анализируете опыт"
      },
      
      qualification: {
        immediate: "Попробуйте без оговорок - что было на самом деле?",
        probing: "Уберите 'в принципе' и опишите прямо",
        supportive: "Прямое описание часто точнее, чем с оговорками"
      }
    };
  }

  /**
   * Main uncertainty detection function
   */
  detectUncertainty(text, context = {}) {
    const analysis = {
      overallUncertaintyScore: 0,
      uncertaintyTypes: [],
      markers: [],
      recommendations: [],
      responseStrategy: null,
      confidence: 0
    };

    // Analyze each uncertainty type
    for (const [type, config] of Object.entries(this.uncertaintyMarkers)) {
      const typeAnalysis = this.analyzeUncertaintyType(text, type, config);
      
      if (typeAnalysis.found) {
        analysis.uncertaintyTypes.push(type);
        analysis.markers.push(...typeAnalysis.markers);
        analysis.overallUncertaintyScore += typeAnalysis.score;
      }
    }

    // Normalize score
    analysis.overallUncertaintyScore = Math.min(1.0, analysis.overallUncertaintyScore);
    
    // Calculate confidence in detection
    analysis.confidence = this.calculateDetectionConfidence(analysis.markers);
    
    // Generate response strategy if uncertainty detected
    if (analysis.overallUncertaintyScore > 0.2) {
      analysis.responseStrategy = this.selectResponseStrategy(analysis, context);
      analysis.recommendations = this.generateRecommendations(analysis, context);
    }

    return analysis;
  }

  /**
   * Analyze specific uncertainty type
   */
  analyzeUncertaintyType(text, type, config) {
    const analysis = {
      found: false,
      score: 0,
      markers: [],
      positions: []
    };

    for (const pattern of config.patterns) {
      const matches = [...text.matchAll(pattern)];
      
      if (matches.length > 0) {
        analysis.found = true;
        
        matches.forEach(match => {
          analysis.markers.push({
            type,
            text: match[0],
            position: match.index,
            confidence: config.confidence,
            weight: config.weight
          });
          
          analysis.score += config.weight * config.confidence;
        });
      }
    }

    return analysis;
  }

  /**
   * Calculate confidence in uncertainty detection
   */
  calculateDetectionConfidence(markers) {
    if (markers.length === 0) return 0;
    
    // Weight by marker confidence and frequency
    const totalConfidence = markers.reduce((sum, marker) => {
      return sum + (marker.confidence * marker.weight);
    }, 0);
    
    const maxPossibleConfidence = markers.length * 3 * 0.9; // max weight * max confidence
    
    return Math.min(1.0, totalConfidence / maxPossibleConfidence);
  }

  /**
   * Select appropriate response strategy
   */
  selectResponseStrategy(analysis, context) {
    // Find dominant uncertainty type
    const typeCounts = {};
    analysis.markers.forEach(marker => {
      typeCounts[marker.type] = (typeCounts[marker.type] || 0) + marker.weight;
    });
    
    const dominantType = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    );
    
    const strategies = this.responseStrategies[dominantType];
    if (!strategies) return null;
    
    // Select strategy based on training day and uncertainty level
    if (context.trainingDay <= 1) {
      return {
        type: 'supportive',
        message: strategies.supportive,
        dominantUncertaintyType: dominantType
      };
    } else if (analysis.overallUncertaintyScore > 0.6) {
      return {
        type: 'probing',
        message: strategies.probing,
        dominantUncertaintyType: dominantType
      };
    } else {
      return {
        type: 'immediate',
        message: strategies.immediate,
        dominantUncertaintyType: dominantType
      };
    }
  }

  /**
   * Generate specific recommendations
   */
  generateRecommendations(analysis, context) {
    const recommendations = [];
    
    // General recommendations based on uncertainty level
    if (analysis.overallUncertaintyScore > 0.7) {
      recommendations.push({
        priority: 'high',
        type: 'technique',
        suggestion: 'Попробуйте технику "стоп-кадр": представьте момент как фотографию'
      });
    }
    
    if (analysis.overallUncertaintyScore > 0.5) {
      recommendations.push({
        priority: 'medium',
        type: 'approach',
        suggestion: 'Начните с того, что помните точно, затем добавляйте детали'
      });
    }
    
    // Specific recommendations for uncertainty types
    const hasVerbalUncertainty = analysis.uncertaintyTypes.includes('verbal');
    const hasCognitiveUncertainty = analysis.uncertaintyTypes.includes('cognitive');
    const hasEpistemicUncertainty = analysis.uncertaintyTypes.includes('epistemic');
    
    if (hasVerbalUncertainty) {
      recommendations.push({
        priority: 'high',
        type: 'behavioral',
        suggestion: 'Не торопитесь с ответом. Сделайте паузу и вспомните момент'
      });
    }
    
    if (hasCognitiveUncertainty) {
      recommendations.push({
        priority: 'medium',
        type: 'cognitive',
        suggestion: 'Разделите опыт на части: что видели, что слышали, что чувствовали'
      });
    }
    
    if (hasEpistemicUncertainty) {
      recommendations.push({
        priority: 'medium',
        type: 'linguistic',
        suggestion: 'Замените "думаю/кажется" на прямое описание: "видел/слышал/чувствовал"'
      });
    }
    
    // Training-specific recommendations
    if (context.trainingDay <= 2) {
      recommendations.push({
        priority: 'low',
        type: 'educational',
        suggestion: 'Неуверенность нормальна в начале обучения. Продолжайте практиковаться'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate follow-up question based on uncertainty
   */
  generateFollowUpQuestion(analysis, originalResponse) {
    if (!analysis.responseStrategy) return null;
    
    const dominantType = analysis.responseStrategy.dominantUncertaintyType;
    const uncertaintyLevel = analysis.overallUncertaintyScore;
    
    // Extract specific uncertain phrases for targeted questioning
    const uncertainPhrases = analysis.markers
      .filter(m => m.confidence > 0.7)
      .map(m => m.text)
      .slice(0, 2); // Focus on top 2 most uncertain phrases
    
    let question = analysis.responseStrategy.message;
    
    // Customize question with specific uncertain phrases
    if (uncertainPhrases.length > 0) {
      const phrase = uncertainPhrases[0];
      question = question.replace(/это|то/, `"${phrase}"`);
    }
    
    return {
      text: question,
      type: 'uncertainty_clarification',
      targetUncertaintyType: dominantType,
      uncertaintyLevel: uncertaintyLevel,
      priority: uncertaintyLevel > 0.6 ? 'high' : 'medium'
    };
  }

  /**
   * Analyze uncertainty reduction after follow-up
   */
  analyzeUncertaintyReduction(originalText, followUpText) {
    const originalAnalysis = this.detectUncertainty(originalText);
    const followUpAnalysis = this.detectUncertainty(followUpText);
    
    const reduction = originalAnalysis.overallUncertaintyScore - followUpAnalysis.overallUncertaintyScore;
    
    return {
      uncertaintyReduction: reduction,
      improvementPercentage: originalAnalysis.overallUncertaintyScore > 0 ? 
        (reduction / originalAnalysis.overallUncertaintyScore) * 100 : 0,
      remainingUncertaintyTypes: followUpAnalysis.uncertaintyTypes,
      successfullyAddressed: originalAnalysis.uncertaintyTypes.filter(
        type => !followUpAnalysis.uncertaintyTypes.includes(type)
      ),
      newUncertainties: followUpAnalysis.uncertaintyTypes.filter(
        type => !originalAnalysis.uncertaintyTypes.includes(type)
      )
    };
  }

  /**
   * Get uncertainty statistics for user progress tracking
   */
  calculateUncertaintyStats(responses) {
    const stats = {
      averageUncertainty: 0,
      uncertaintyTrend: [],
      mostCommonTypes: {},
      improvementRate: 0
    };
    
    if (responses.length === 0) return stats;
    
    let totalUncertainty = 0;
    const typeFrequency = {};
    
    responses.forEach((response, index) => {
      const text = this.extractResponseText(response);
      const analysis = this.detectUncertainty(text);
      
      totalUncertainty += analysis.overallUncertaintyScore;
      stats.uncertaintyTrend.push({
        index,
        score: analysis.overallUncertaintyScore,
        types: analysis.uncertaintyTypes
      });
      
      analysis.uncertaintyTypes.forEach(type => {
        typeFrequency[type] = (typeFrequency[type] || 0) + 1;
      });
    });
    
    stats.averageUncertainty = totalUncertainty / responses.length;
    stats.mostCommonTypes = typeFrequency;
    
    // Calculate improvement rate (comparing first half to second half)
    if (responses.length >= 4) {
      const firstHalf = stats.uncertaintyTrend.slice(0, Math.floor(responses.length / 2));
      const secondHalf = stats.uncertaintyTrend.slice(Math.floor(responses.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.score, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.score, 0) / secondHalf.length;
      
      stats.improvementRate = firstHalfAvg > 0 ? 
        ((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100 : 0;
    }
    
    return stats;
  }

  /**
   * Extract text from response object
   */
  extractResponseText(response) {
    const texts = [];
    if (response.responses?.currentThoughts) texts.push(response.responses.currentThoughts);
    if (response.responses?.currentActivity) texts.push(response.responses.currentActivity);
    if (response.responses?.currentEmotions) texts.push(response.responses.currentEmotions);
    
    // Include follow-up answers
    if (response.metadata?.followUpAnswers) {
      response.metadata.followUpAnswers.forEach(followUp => {
        if (followUp.answer) texts.push(followUp.answer);
      });
    }
    
    return texts.join(' ');
  }

  /**
   * Check if uncertainty is appropriate (some uncertainty can be valid)
   */
  isAppropriateUncertainty(analysis, context) {
    // Some uncertainty is appropriate when:
    // 1. Describing genuinely ambiguous experiences
    // 2. Acknowledging limits of memory
    // 3. Distinguishing between clear and unclear aspects
    
    const appropriateTypes = ['cognitive']; // "I'm not sure about X but clear about Y"
    const inappropriateTypes = ['epistemic', 'approximation']; // "I think", "sort of"
    
    const hasAppropriate = analysis.uncertaintyTypes.some(type => appropriateTypes.includes(type));
    const hasInappropriate = analysis.uncertaintyTypes.some(type => inappropriateTypes.includes(type));
    
    return hasAppropriate && !hasInappropriate && analysis.overallUncertaintyScore < 0.4;
  }
}

module.exports = new UncertaintyDetector();
