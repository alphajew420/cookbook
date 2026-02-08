const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Replace req.body with validated value
    req.body = value;
    next();
  };
};

/**
 * Validation schemas
 */
const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(2).max(255).optional(),
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  
  // Cookbook schemas
  updateCookbook: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    coverImageUrl: Joi.string().uri().optional(),
  }),
  
  // Fridge schemas
  addFridgeItems: Joi.object({
    items: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        quantity: Joi.string().optional(),
        category: Joi.string().optional(),
        expiryDate: Joi.date().optional(),
      })
    ).min(1).required(),
  }),
  
  updateFridgeItem: Joi.object({
    name: Joi.string().optional(),
    quantity: Joi.string().optional(),
    category: Joi.string().optional(),
    freshness: Joi.string().optional(),
    expiryDate: Joi.date().optional(),
  }),
  
  // Recipe matching schema
  matchRecipes: Joi.object({
    cookbookId: Joi.string().uuid().optional(),
    minMatchPercentage: Joi.number().min(0).max(100).default(50),
    includePartialMatches: Joi.boolean().default(true),
  }),
};

module.exports = {
  validate,
  schemas,
};
