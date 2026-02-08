const { query } = require('../database/db');
const { cache, cacheKeys, cacheTTL } = require('../utils/redis');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Normalize ingredient name for matching
 * @param {string} name - Ingredient name
 * @returns {string} Normalized name
 */
function normalizeIngredientName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/s$/, ''); // Remove trailing 's' for plurals
}

/**
 * Calculate match between recipe and fridge items
 * @param {Array} recipeIngredients - Recipe ingredients
 * @param {Array} fridgeItems - Fridge items
 * @returns {Object} Match result
 */
function calculateMatch(recipeIngredients, fridgeItems) {
  const normalizedFridge = fridgeItems.map(item => ({
    original: item.name,
    normalized: normalizeIngredientName(item.name),
  }));
  
  let matchCount = 0;
  const available = [];
  const missing = [];
  
  for (const ingredient of recipeIngredients) {
    const normalized = normalizeIngredientName(ingredient.name);
    
    // Check for exact or partial match
    const match = normalizedFridge.find(fridgeItem => {
      // Exact match
      if (fridgeItem.normalized === normalized) return true;
      
      // Partial match (one contains the other)
      if (fridgeItem.normalized.includes(normalized) || normalized.includes(fridgeItem.normalized)) {
        return true;
      }
      
      return false;
    });
    
    if (match) {
      matchCount++;
      available.push(ingredient);
    } else {
      missing.push(ingredient);
    }
  }
  
  const matchPercentage = recipeIngredients.length > 0
    ? Math.round((matchCount / recipeIngredients.length) * 100)
    : 0;
  
  return {
    matchPercentage,
    availableIngredients: available,
    missingIngredients: missing,
    canMakeNow: matchPercentage === 100,
  };
}

/**
 * Match recipes with available ingredients
 */
const matchRecipes = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { cookbookId, minMatchPercentage = 50, includePartialMatches = true } = req.body;
    
    // Try cache first
    const cacheKey = cacheKeys.recipeMatches(userId, cookbookId || 'all');
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached recipe matches', { userId });
      return res.status(200).json(cached);
    }
    
    // Get fridge inventory
    const fridgeResult = await query(
      'SELECT name FROM fridge_items WHERE user_id = $1',
      [userId]
    );
    
    if (fridgeResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_FRIDGE',
          message: 'Your fridge inventory is empty. Please scan your fridge first.',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    const fridgeItems = fridgeResult.rows;
    
    // Get recipes
    let recipesQuery = `
      SELECT 
        r.id, r.name, r.prep_time, r.cook_time, r.servings,
        c.id as cookbook_id, c.name as cookbook_name
      FROM recipes r
      JOIN cookbooks c ON r.cookbook_id = c.id
      WHERE c.user_id = $1
    `;
    const params = [userId];
    
    if (cookbookId) {
      recipesQuery += ' AND c.id = $2';
      params.push(cookbookId);
    }
    
    const recipesResult = await query(recipesQuery, params);
    
    if (recipesResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_COOKBOOKS',
          message: "You haven't scanned any cookbooks yet. Please scan a cookbook first.",
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Calculate matches for each recipe
    const matches = [];
    
    for (const recipe of recipesResult.rows) {
      // Get recipe ingredients
      const ingredientsResult = await query(
        `SELECT id, name, quantity, unit
         FROM ingredients
         WHERE recipe_id = $1
         ORDER BY order_index`,
        [recipe.id]
      );
      
      const recipeIngredients = ingredientsResult.rows;
      
      // Calculate match
      const match = calculateMatch(recipeIngredients, fridgeItems);
      
      // Filter by minimum match percentage
      if (match.matchPercentage >= minMatchPercentage || (match.canMakeNow && includePartialMatches)) {
        matches.push({
          recipe: {
            id: recipe.id,
            name: recipe.name,
            cookbookId: recipe.cookbook_id,
            cookbookName: recipe.cookbook_name,
            prepTime: recipe.prep_time,
            cookTime: recipe.cook_time,
            servings: recipe.servings,
            ingredients: recipeIngredients,
          },
          matchPercentage: match.matchPercentage,
          availableIngredients: match.availableIngredients,
          missingIngredients: match.missingIngredients,
          canMakeNow: match.canMakeNow,
        });
      }
    }
    
    // Sort by match percentage (descending)
    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    // Count perfect and partial matches
    const perfectMatches = matches.filter(m => m.canMakeNow).length;
    const partialMatches = matches.filter(m => !m.canMakeNow).length;
    
    const response = {
      success: true,
      data: {
        matches,
        totalMatches: matches.length,
        perfectMatches,
        partialMatches,
      },
    };
    
    // Cache response
    await cache.set(cacheKey, response, cacheTTL.matches);
    
    logger.info('Recipe matching completed', {
      userId,
      totalMatches: matches.length,
      perfectMatches,
      partialMatches,
    });
    
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  matchRecipes,
};
