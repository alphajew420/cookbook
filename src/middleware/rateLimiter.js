const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Cookbook scan rate limiter
 */
const cookbookScanLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: parseInt(process.env.SCAN_COOKBOOK_LIMIT) || 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many cookbook scans. Limit is 10 per hour.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip, // Rate limit per user
});

/**
 * Fridge scan rate limiter
 */
const fridgeScanLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: parseInt(process.env.SCAN_FRIDGE_LIMIT) || 20,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many fridge scans. Limit is 20 per hour.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Auth rate limiter (stricter for login/register)
 */
const authLimiter = rateLimit({
  windowMs: 900000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  cookbookScanLimiter,
  fridgeScanLimiter,
  authLimiter,
};
