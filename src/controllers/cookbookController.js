const { query } = require('../database/db');
const { cache, cacheKeys, cacheTTL } = require('../utils/redis');
const { NotFoundError, ForbiddenError, ValidationError } = require('../middleware/errorHandler');
const { addSignedUrlsToRecipes } = require('../utils/s3');
const logger = require('../utils/logger');

/**
 * Get all cookbooks for user
 */
const getCookbooks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, sortBy = 'created_at', order = 'desc' } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Try cache first
    const cacheKey = `${cacheKeys.userCookbooks(userId)}:${page}:${limit}:${sortBy}:${order}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached cookbooks', { userId });
      return res.status(200).json(cached);
    }
    
    // Get cookbooks with recipe count
    const result = await query(
      `SELECT 
        c.id, c.name, c.cover_image_url, c.scanned_pages, c.created_at, c.updated_at,
        COUNT(r.id) as recipe_count
       FROM cookbooks c
       LEFT JOIN recipes r ON c.id = r.cookbook_id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.${sortBy} ${order}
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM cookbooks WHERE user_id = $1',
      [userId]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    const response = {
      success: true,
      data: {
        cookbooks: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          coverImageUrl: row.cover_image_url,
          scannedPages: row.scanned_pages,
          recipeCount: parseInt(row.recipe_count),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
        },
      },
    };
    
    // Cache response
    await cache.set(cacheKey, response, cacheTTL.cookbooks);
    
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get cookbook by ID
 */
const getCookbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Try cache first
    const cacheKey = cacheKeys.cookbook(id);
    const cached = await cache.get(cacheKey);
    if (cached && cached.userId === userId) {
      logger.debug('Returning cached cookbook', { cookbookId: id });
      return res.status(200).json({ success: true, data: cached });
    }
    
    // Get cookbook
    const cookbookResult = await query(
      `SELECT id, user_id, name, cover_image_url, scanned_pages, created_at, updated_at
       FROM cookbooks
       WHERE id = $1`,
      [id]
    );
    
    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }
    
    const cookbook = cookbookResult.rows[0];
    
    // Check ownership
    if (cookbook.user_id !== userId) {
      throw new ForbiddenError('Not authorized to access this cookbook');
    }
    
    // Get recipes summary
    const recipesResult = await query(
      `SELECT 
        r.id, r.name, r.prep_time, r.cook_time, r.servings,
        COUNT(i.id) as ingredient_count
       FROM recipes r
       LEFT JOIN ingredients i ON r.id = i.recipe_id
       WHERE r.cookbook_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [id]
    );
    
    const response = {
      id: cookbook.id,
      name: cookbook.name,
      coverImageUrl: cookbook.cover_image_url,
      scannedPages: cookbook.scanned_pages,
      createdAt: cookbook.created_at,
      updatedAt: cookbook.updated_at,
      recipes: recipesResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        prepTime: r.prep_time,
        cookTime: r.cook_time,
        servings: r.servings,
        ingredientCount: parseInt(r.ingredient_count),
      })),
      userId: cookbook.user_id,
    };
    
    // Cache response
    await cache.set(cacheKey, response, cacheTTL.cookbooks);
    
    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recipes from cookbook
 */
const getCookbookRecipes = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Verify cookbook ownership
    const cookbookResult = await query(
      'SELECT user_id FROM cookbooks WHERE id = $1',
      [id]
    );
    
    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }
    
    if (cookbookResult.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to access this cookbook');
    }
    
    // Get recipes with ingredients and instructions
    const recipesResult = await query(
      `SELECT 
        r.id, r.name, r.prep_time, r.cook_time, r.total_time, r.servings, r.notes, r.original_image_url, r.created_at
       FROM recipes r
       WHERE r.cookbook_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );
    
    const recipes = [];
    for (const recipe of recipesResult.rows) {
      // Get ingredients
      const ingredientsResult = await query(
        `SELECT id, name, quantity, unit, notes
         FROM ingredients
         WHERE recipe_id = $1
         ORDER BY order_index`,
        [recipe.id]
      );
      
      // Get instructions
      const instructionsResult = await query(
        `SELECT id, step_number, description
         FROM instructions
         WHERE recipe_id = $1
         ORDER BY step_number`,
        [recipe.id]
      );
      
      recipes.push({
        id: recipe.id,
        name: recipe.name,
        prepTime: recipe.prep_time,
        cookTime: recipe.cook_time,
        totalTime: recipe.total_time,
        servings: recipe.servings,
        notes: recipe.notes,
        originalImageUrl: recipe.original_image_url,
        ingredients: ingredientsResult.rows,
        instructions: instructionsResult.rows,
        createdAt: recipe.created_at,
      });
    }
    
    // Add signed URLs to all recipes
    const recipesWithSignedUrls = await addSignedUrlsToRecipes(recipes);
    
    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM recipes WHERE cookbook_id = $1',
      [id]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data: {
        recipes: recipesWithSignedUrls,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update cookbook
 */
const updateCookbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, coverImageUrl } = req.body;
    
    // Verify ownership
    const checkResult = await query(
      'SELECT user_id FROM cookbooks WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }
    
    if (checkResult.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to update this cookbook');
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (coverImageUrl) {
      updates.push(`cover_image_url = $${paramCount++}`);
      values.push(coverImageUrl);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'No fields to update',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE cookbooks
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING id, name, cover_image_url, updated_at`,
      values
    );
    
    // Invalidate cache
    await cache.del(cacheKeys.cookbook(id));
    await cache.delPattern(`user:${userId}:cookbooks:*`);
    
    logger.info('Cookbook updated', { cookbookId: id, userId });
    
    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete cookbook
 */
const deleteCookbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verify ownership
    const checkResult = await query(
      'SELECT user_id FROM cookbooks WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }
    
    if (checkResult.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to delete this cookbook');
    }
    
    // Delete cookbook (cascades to recipes, ingredients, instructions)
    await query('DELETE FROM cookbooks WHERE id = $1', [id]);
    
    // Invalidate cache
    await cache.del(cacheKeys.cookbook(id));
    await cache.delPattern(`user:${userId}:*`);
    
    logger.info('Cookbook deleted', { cookbookId: id, userId });
    
    res.status(200).json({
      success: true,
      message: 'Cookbook deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCookbooks,
  getCookbook,
  getCookbookRecipes,
  updateCookbook,
  deleteCookbook,
};
