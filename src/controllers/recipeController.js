const { query } = require('../database/db');
const { cache, cacheKeys, cacheTTL } = require('../utils/redis');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get recipe by ID
 */
const getRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Try cache first
    const cacheKey = cacheKeys.recipe(id);
    const cached = await cache.get(cacheKey);
    if (cached && cached.userId === userId) {
      logger.debug('Returning cached recipe', { recipeId: id });
      return res.status(200).json({ success: true, data: cached });
    }
    
    // Get recipe with cookbook info
    const recipeResult = await query(
      `SELECT 
        r.id, r.name, r.prep_time, r.cook_time, r.total_time, r.servings, r.notes, 
        r.original_image_url, r.created_at,
        c.id as cookbook_id, c.name as cookbook_name, c.user_id
       FROM recipes r
       JOIN cookbooks c ON r.cookbook_id = c.id
       WHERE r.id = $1`,
      [id]
    );
    
    if (recipeResult.rows.length === 0) {
      throw new NotFoundError('Recipe not found');
    }
    
    const recipe = recipeResult.rows[0];
    
    // Check ownership
    if (recipe.user_id !== userId) {
      throw new ForbiddenError('Not authorized to access this recipe');
    }
    
    // Get ingredients
    const ingredientsResult = await query(
      `SELECT id, name, quantity, unit, notes, order_index
       FROM ingredients
       WHERE recipe_id = $1
       ORDER BY order_index`,
      [id]
    );
    
    // Get instructions
    const instructionsResult = await query(
      `SELECT id, step_number, description
       FROM instructions
       WHERE recipe_id = $1
       ORDER BY step_number`,
      [id]
    );
    
    const response = {
      id: recipe.id,
      name: recipe.name,
      cookbookId: recipe.cookbook_id,
      cookbookName: recipe.cookbook_name,
      ingredients: ingredientsResult.rows,
      instructions: instructionsResult.rows,
      prepTime: recipe.prep_time,
      cookTime: recipe.cook_time,
      totalTime: recipe.total_time,
      servings: recipe.servings,
      notes: recipe.notes,
      originalImageUrl: recipe.original_image_url,
      createdAt: recipe.created_at,
      userId: recipe.user_id,
    };
    
    // Cache response
    await cache.set(cacheKey, response, cacheTTL.recipe);
    
    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecipe,
};
