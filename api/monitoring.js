const express = require('express');
const aiValidator = require('../services/ai-validator-service');

const router = express.Router();

/**
 * API для мониторинга семантического анализа
 * Предоставляет метрики производительности, статистику кэша и рекомендации
 */

/**
 * GET /api/monitoring/metrics
 * Получить текущие метрики производительности
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = aiValidator.monitor.getMetrics();
    const cacheStats = aiValidator.semanticCache.getStats();
    
    res.json({
      success: true,
      data: {
        performance: metrics,
        cache: cacheStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      details: error.message
    });
  }
});

/**
 * GET /api/monitoring/report
 * Получить полный отчет с рекомендациями
 */
router.get('/report', (req, res) => {
  try {
    const report = aiValidator.monitor.generateReport();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
      details: error.message
    });
  }
});

/**
 * GET /api/monitoring/question-types
 * Получить статистику по типам вопросов
 */
router.get('/question-types', (req, res) => {
  try {
    const questionTypeStats = aiValidator.monitor.getQuestionTypeStats();
    
    res.json({
      success: true,
      data: questionTypeStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve question type stats',
      details: error.message
    });
  }
});

/**
 * GET /api/monitoring/hourly
 * Получить почасовую статистику
 */
router.get('/hourly', (req, res) => {
  try {
    const hourlyStats = aiValidator.monitor.getHourlyStats();
    
    res.json({
      success: true,
      data: hourlyStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve hourly stats',
      details: error.message
    });
  }
});

/**
 * GET /api/monitoring/cache/export
 * Экспорт данных кэша для анализа
 */
router.get('/cache/export', (req, res) => {
  try {
    const cacheData = aiValidator.semanticCache.export();
    
    res.json({
      success: true,
      data: cacheData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to export cache data',
      details: error.message
    });
  }
});

/**
 * POST /api/monitoring/cache/clear
 * Очистка кэша (для отладки)
 */
router.post('/cache/clear', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'CLEAR_CACHE') {
      return res.status(400).json({
        success: false,
        error: 'Cache clear requires confirmation with "CLEAR_CACHE"'
      });
    }
    
    const clearedEntries = aiValidator.semanticCache.clear();
    
    res.json({
      success: true,
      data: {
        message: `Cleared ${clearedEntries} cache entries`,
        clearedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

/**
 * POST /api/monitoring/reset
 * Сброс всех метрик (для отладки)
 */
router.post('/reset', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'RESET_METRICS') {
      return res.status(400).json({
        success: false,
        error: 'Metrics reset requires confirmation with "RESET_METRICS"'
      });
    }
    
    aiValidator.monitor.reset();
    
    res.json({
      success: true,
      data: {
        message: 'All metrics reset successfully',
        resetAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics',
      details: error.message
    });
  }
});

/**
 * GET /api/monitoring/health
 * Проверка здоровья системы семантического анализа
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      checks: {
        aiProvider: {
          status: aiValidator.isConfigured ? 'ok' : 'warning',
          provider: aiValidator.provider,
          message: aiValidator.isConfigured ? 'AI provider configured' : 'Using local validation only'
        },
        cache: {
          status: 'ok',
          size: aiValidator.semanticCache.cache.size,
          hitRate: aiValidator.semanticCache.getStats().hitRate
        },
        monitor: {
          status: 'ok',
          totalAnalyses: aiValidator.monitor.metrics.totalAnalyses,
          errorRate: aiValidator.monitor.getMetrics().summary.errorRate
        }
      },
      timestamp: new Date().toISOString()
    };
    
    // Определяем общий статус здоровья
    const hasWarnings = Object.values(health.checks).some(check => check.status === 'warning');
    const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
    
    if (hasErrors) {
      health.status = 'unhealthy';
    } else if (hasWarnings) {
      health.status = 'degraded';
    }
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * GET /api/monitoring/test
 * Тестирование семантического анализа
 */
router.post('/test', async (req, res) => {
  try {
    const { candidateQuestion, previousResponses, context } = req.body;
    
    if (!candidateQuestion || !previousResponses) {
      return res.status(400).json({
        success: false,
        error: 'candidateQuestion and previousResponses are required'
      });
    }
    
    const startTime = Date.now();
    const result = await aiValidator.analyzeSemanticSimilarity(
      candidateQuestion,
      previousResponses,
      context || {}
    );
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        result,
        performance: {
          duration: `${duration}ms`,
          fromCache: result.fromCache || false
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
});

module.exports = router;