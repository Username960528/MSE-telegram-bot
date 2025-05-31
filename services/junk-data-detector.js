const Response = require('../models/Response');
const User = require('../models/User');
const config = require('../config/hurlburt');

/**
 * Junk Data Detector - Addresses the well-documented issue that first 1-2 days of DES data are unreliable
 * 
 * Based on Hurlburt's research showing that initial DES responses contain systematic errors:
 * - Day 1: 70-80% unreliable due to misunderstanding the task
 * - Day 2: 40-50% unreliable due to learning curve
 * - Day 3+: <20% unreliable after proper training
 */
class JunkDataDetector {
  constructor() {
    this.config = config;
    
    // Reliability thresholds based on Hurlburt's research
    this.reliabilityThresholds = {
      day1: { min: 20, max: 40 },  // Day 1 is inherently unreliable
      day2: { min: 40, max: 70 },  // Day 2 shows improvement
      day3: { min: 60, max: 85 },  // Day 3+ should be reliable
      graduated: { min: 70, max: 95 }
    };
    
    // Common junk patterns from DES literature
    this.junkPatterns = {
      firstDayErrors: [
        /всегда|никогда|обычно|часто|редко/i,  // Generalizations
        /думаю что|наверное|возможно|кажется/i, // Theorizing
        /весь день|утром|вечером|сегодня/i,     // Time periods vs moments
        /хорошо|плохо|нормально|ок/i            // Evaluative responses
      ],
      
      learningCurveErrors: [
        /не помню|не знаю|ничего особенного/i,  // Avoidance
        /как всегда|как обычно/i,               // Generic responses
        /работал|делал|занимался/i              // Activities vs experiences
      ],
      
      persistentIllusions: [
        /внутренний голос.*чтени/i,             // Reading voice illusion
        /всегда думаю словами/i,                // Inner speech overreporting
        /постоянно анализирую/i                 // Meta-cognitive illusions
      ]
    };
  }

  /**
   * Main function to analyze response reliability
   */
  async analyzeReliability(response, user) {
    const analysis = {
      reliabilityScore: 50,
      flags: [],
      shouldExclude: false,
      exclusionReason: null,
      recommendations: []
    };

    // 1. Day-based reliability assessment
    const dayAnalysis = this.analyzeDayReliability(response);
    analysis.reliabilityScore = dayAnalysis.baseScore;
    analysis.flags.push(...dayAnalysis.flags);

    // 2. Pattern-based junk detection
    const patternAnalysis = this.analyzeJunkPatterns(response);
    analysis.reliabilityScore -= patternAnalysis.penalty;
    analysis.flags.push(...patternAnalysis.flags);

    // 3. Learning progression analysis
    const progressAnalysis = await this.analyzeLearningProgress(response, user);
    analysis.reliabilityScore += progressAnalysis.bonus;
    analysis.flags.push(...progressAnalysis.flags);

    // 4. Consistency check with user history
    const consistencyAnalysis = await this.analyzeConsistency(response, user);
    analysis.reliabilityScore += consistencyAnalysis.adjustment;
    analysis.flags.push(...consistencyAnalysis.flags);

    // 5. Final reliability determination
    analysis.reliabilityScore = Math.max(0, Math.min(100, analysis.reliabilityScore));
    
    // Determine if data should be excluded
    if (analysis.reliabilityScore < 30) {
      analysis.shouldExclude = true;
      analysis.exclusionReason = 'Low reliability score due to training phase errors';
    }

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.flags, response.metadata.trainingDay);

    return analysis;
  }

  /**
   * Day-based reliability assessment
   */
  analyzeDayReliability(response) {
    const trainingDay = response.metadata.trainingDay || 1;
    const flags = [];
    let baseScore = 50;

    switch (trainingDay) {
      case 1:
        baseScore = 25; // Day 1 is inherently unreliable
        flags.push({
          type: 'first_day_unreliable',
          severity: 'high',
          description: 'Day 1 responses are systematically unreliable per DES research'
        });
        break;
        
      case 2:
        baseScore = 45; // Day 2 shows improvement but still learning
        flags.push({
          type: 'learning_curve',
          severity: 'medium',
          description: 'Day 2 responses show learning curve effects'
        });
        break;
        
      case 3:
        baseScore = 65; // Day 3 should be more reliable
        break;
        
      default:
        baseScore = 75; // Post-training should be reliable
    }

    return { baseScore, flags };
  }

  /**
   * Pattern-based junk detection
   */
  analyzeJunkPatterns(response) {
    const text = this.extractAllText(response);
    const flags = [];
    let penalty = 0;

    // Check for first day errors
    this.junkPatterns.firstDayErrors.forEach(pattern => {
      if (pattern.test(text)) {
        flags.push({
          type: 'pattern_inconsistency',
          severity: 'medium',
          description: 'Contains generalization or theorizing patterns'
        });
        penalty += 15;
      }
    });

    // Check for learning curve errors
    this.junkPatterns.learningCurveErrors.forEach(pattern => {
      if (pattern.test(text)) {
        flags.push({
          type: 'learning_curve',
          severity: 'medium',
          description: 'Shows avoidance or generic response patterns'
        });
        penalty += 10;
      }
    });

    // Check for persistent illusions
    this.junkPatterns.persistentIllusions.forEach(pattern => {
      if (pattern.test(text)) {
        flags.push({
          type: 'illusion_detected',
          severity: 'high',
          description: 'Contains known DES illusions (e.g., reading voice)'
        });
        penalty += 20;
      }
    });

    return { penalty, flags };
  }

  /**
   * Learning progression analysis
   */
  async analyzeLearningProgress(response, user) {
    const flags = [];
    let bonus = 0;

    // Check for breakthrough moments
    const text = this.extractAllText(response);
    const breakthroughs = this.detectBreakthroughs(text);
    
    if (breakthroughs.length > 0) {
      flags.push({
        type: 'breakthrough_detected',
        severity: 'low',
        description: `Breakthrough detected: ${breakthroughs.join(', ')}`
      });
      bonus += breakthroughs.length * 10;
    }

    // Check for skill acquisition
    const skills = this.detectSkillAcquisition(text, response.metadata.trainingDay);
    if (skills.length > 0) {
      bonus += skills.length * 5;
    }

    return { bonus, flags };
  }

  /**
   * Consistency analysis with user history
   */
  async analyzeConsistency(response, user) {
    const flags = [];
    let adjustment = 0;

    try {
      // Get recent responses for comparison
      const recentResponses = await Response.find({
        userId: user._id,
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      }).sort({ timestamp: -1 }).limit(10);

      if (recentResponses.length < 3) {
        return { adjustment: 0, flags: [] };
      }

      // Check for dramatic quality changes
      const qualityScores = recentResponses.map(r => r.metadata.dataQualityScore || 50);
      const currentQuality = response.metadata.dataQualityScore || 50;
      const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;

      if (Math.abs(currentQuality - avgQuality) > 30) {
        flags.push({
          type: 'pattern_inconsistency',
          severity: 'medium',
          description: 'Significant deviation from user\'s typical response quality'
        });
        adjustment -= 10;
      }

      // Check for learning progression
      if (currentQuality > avgQuality + 15 && response.metadata.trainingDay >= 2) {
        adjustment += 10; // Reward improvement
      }

    } catch (error) {
      console.error('Error in consistency analysis:', error);
    }

    return { adjustment, flags };
  }

  /**
   * Extract all text from response for analysis
   */
  extractAllText(response) {
    const texts = [];
    
    if (response.responses.currentThoughts) texts.push(response.responses.currentThoughts);
    if (response.responses.currentActivity) texts.push(response.responses.currentActivity);
    if (response.responses.currentEmotions) texts.push(response.responses.currentEmotions);
    
    // Include follow-up answers
    if (response.metadata.followUpAnswers) {
      response.metadata.followUpAnswers.forEach(followUp => {
        if (followUp.answer) texts.push(followUp.answer);
      });
    }
    
    return texts.join(' ').toLowerCase();
  }

  /**
   * Detect breakthrough moments in responses
   */
  detectBreakthroughs(text) {
    const breakthroughs = [];
    
    // Moment awareness breakthrough
    if (/именно в тот момент|прямо тогда|в момент сигнала/i.test(text)) {
      breakthroughs.push('moment_awareness');
    }
    
    // Sensory detail breakthrough
    if (/вижу.*конкретно|слышу.*именно|чувствую.*где/i.test(text)) {
      breakthroughs.push('sensory_specificity');
    }
    
    // Emptiness recognition breakthrough
    if (/ничего не было|пустота|отсутствие мыслей/i.test(text)) {
      breakthroughs.push('emptiness_recognition');
    }
    
    // Illusion breaking breakthrough
    if (/на самом деле не было|думал что слышу|оказалось что/i.test(text)) {
      breakthroughs.push('illusion_breaking');
    }
    
    return breakthroughs;
  }

  /**
   * Detect skill acquisition
   */
  detectSkillAcquisition(text, trainingDay) {
    const skills = [];
    
    if (trainingDay >= 2) {
      // Specificity skill
      if (text.split(' ').length > 20 && /конкретно|именно|точно/i.test(text)) {
        skills.push('specificity');
      }
      
      // Present moment skill
      if (/сейчас|в этот момент|прямо/i.test(text)) {
        skills.push('present_focus');
      }
    }
    
    return skills;
  }

  /**
   * Generate recommendations based on detected issues
   */
  generateRecommendations(flags, trainingDay) {
    const recommendations = [];
    
    const hasFirstDayIssues = flags.some(f => f.type === 'first_day_unreliable');
    const hasIllusions = flags.some(f => f.type === 'illusion_detected');
    const hasLearningIssues = flags.some(f => f.type === 'learning_curve');
    
    if (hasFirstDayIssues) {
      recommendations.push('Provide additional training on moment vs. period distinction');
      recommendations.push('Emphasize concrete sensory details over evaluations');
    }
    
    if (hasIllusions) {
      recommendations.push('Target specific illusion breaking exercises');
      recommendations.push('Provide counter-examples from DES research');
    }
    
    if (hasLearningIssues) {
      recommendations.push('Extend training period by 1-2 days');
      recommendations.push('Increase follow-up question frequency');
    }
    
    return recommendations;
  }

  /**
   * Apply junk data flags to response
   */
  async flagResponse(response, analysis) {
    response.metadata.dataReliability = {
      reliabilityScore: analysis.reliabilityScore,
      junkDataFlags: analysis.flags,
      excludeFromAnalysis: analysis.shouldExclude,
      exclusionReason: analysis.exclusionReason
    };
    
    await response.save();
    return response;
  }

  /**
   * Get clean dataset excluding junk data
   */
  async getCleanDataset(userId, options = {}) {
    const query = {
      userId,
      'metadata.dataReliability.excludeFromAnalysis': { $ne: true }
    };
    
    if (options.minReliability) {
      query['metadata.dataReliability.reliabilityScore'] = { $gte: options.minReliability };
    }
    
    if (options.excludeTrainingDays) {
      query['metadata.trainingDay'] = { $gt: 3 };
    }
    
    return await Response.find(query).sort({ timestamp: -1 });
  }
}

module.exports = new JunkDataDetector();
