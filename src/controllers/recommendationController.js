const { query } = require('../database/db');
const { fuzzyMatchIngredient } = require('../utils/fuzzyMatch');
const { getSignedUrl } = require('../utils/s3');
const { cache } = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * Get recommended recipes based on user's fridge items
 * Matches against ALL recipes in the database (excludes user's own cookbooks)
 */
const getRecommendedRecipes = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, minMatch = 30, cuisine, dietary } = req.query;

    // Check cache
    const cacheKey = `user:${userId}:recommended:${cuisine || 'all'}:${dietary || 'all'}:${limit}:${offset}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached });
    }

    // Get user's fridge items
    const fridgeResult = await query(
      `SELECT id, name, quantity, category
       FROM fridge_items
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    if (fridgeResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          recipes: [],
          message: 'Scan your fridge first to get recipe recommendations',
          fridgeItemCount: 0,
        },
      });
    }

    const fridgeItems = fridgeResult.rows;

    // Build query for recipes from OTHER users' cookbooks
    let recipesQuery = `
      SELECT r.id, r.name, r.cookbook_id, r.cuisine, r.dietary_tags,
             c.name as cookbook_name, c.cover_image_url
       FROM recipes r
       JOIN cookbooks c ON r.cookbook_id = c.id
       WHERE c.user_id != $1`;
    const params = [userId];
    let paramIndex = 2;

    if (cuisine) {
      recipesQuery += ` AND r.cuisine = $${paramIndex}`;
      params.push(cuisine);
      paramIndex++;
    }

    if (dietary) {
      const dietaryTags = dietary.split(',').map(t => t.trim());
      recipesQuery += ` AND r.dietary_tags && $${paramIndex}::text[]`;
      params.push(dietaryTags);
      paramIndex++;
    }

    recipesQuery += ` ORDER BY r.created_at DESC LIMIT 500`;

    const recipesResult = await query(recipesQuery, params);

    const recommendations = [];

    for (const recipe of recipesResult.rows) {
      const ingredientsResult = await query(
        `SELECT name FROM ingredients WHERE recipe_id = $1`,
        [recipe.id]
      );

      const recipeIngredients = ingredientsResult.rows;
      if (recipeIngredients.length === 0) continue;

      let availableCount = 0;
      for (const ingredient of recipeIngredients) {
        const matchResult = fuzzyMatchIngredient(ingredient.name, fridgeItems, 85);
        if (matchResult.matched) availableCount++;
      }

      const matchPercentage = Math.round((availableCount / recipeIngredients.length) * 100);

      if (matchPercentage >= parseInt(minMatch)) {
        recommendations.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          cookbookId: recipe.cookbook_id,
          cookbookName: recipe.cookbook_name,
          coverImageUrl: recipe.cover_image_url,
          matchPercentage,
          totalIngredients: recipeIngredients.length,
          availableIngredients: availableCount,
          missingIngredients: recipeIngredients.length - availableCount,
          cuisine: recipe.cuisine,
          dietaryTags: recipe.dietary_tags,
        });
      }
    }

    // Sort by match percentage descending
    recommendations.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // Paginate
    const paged = recommendations.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Add signed URLs and Amazon links
    const amazonTag = process.env.AMAZON_ASSOCIATES_TAG || 'cookbookapp-20';
    const withUrls = await Promise.all(
      paged.map(async (rec) => {
        let signedCoverUrl = null;
        if (rec.coverImageUrl) {
          try {
            signedCoverUrl = await getSignedUrl(rec.coverImageUrl);
          } catch (e) {
            logger.warn('Failed to get signed URL for recommendation', { recipeId: rec.recipeId });
          }
        }
        return {
          ...rec,
          coverImageUrl: signedCoverUrl,
          amazonLink: `https://www.amazon.com/s?k=${encodeURIComponent(rec.cookbookName)}&tag=${amazonTag}`,
        };
      })
    );

    const responseData = {
      recipes: withUrls,
      fridgeItemCount: fridgeItems.length,
      totalRecommendations: recommendations.length,
      pagination: {
        total: recommendations.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < recommendations.length,
      },
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, responseData, 300);

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getRecommendedRecipes };
