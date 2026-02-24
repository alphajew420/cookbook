const { query } = require('../database/db');
const { getSignedUrl } = require('../utils/s3');
const { cache } = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * Get hot/trending recipes based on match frequency across all users
 */
const getHotRecipes = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, period = '30', cuisine, dietary } = req.query;

    // Check cache
    const cacheKey = `global:hot_recipes:${cuisine || 'all'}:${dietary || 'all'}:${period}:${limit}:${offset}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached });
    }

    // Build query with optional cuisine/dietary filters
    let hotQuery = `
      SELECT
        r.id as recipe_id,
        r.name as recipe_name,
        r.cuisine,
        r.dietary_tags,
        c.id as cookbook_id,
        c.name as cookbook_name,
        c.cover_image_url,
        COUNT(rm.id) as match_count,
        COUNT(DISTINCT mj.user_id) as unique_users,
        MAX(rm.created_at) as last_matched_at
       FROM recipe_matches rm
       JOIN match_jobs mj ON rm.match_job_id = mj.id
       JOIN recipes r ON rm.recipe_id = r.id
       JOIN cookbooks c ON r.cookbook_id = c.id
       WHERE rm.match_percentage > 0
         AND rm.created_at >= NOW() - ($1 || ' days')::INTERVAL`;

    const params = [period];
    let paramIndex = 2;

    if (cuisine) {
      hotQuery += ` AND r.cuisine = $${paramIndex}`;
      params.push(cuisine);
      paramIndex++;
    }

    if (dietary) {
      const dietaryTags = dietary.split(',').map(t => t.trim());
      hotQuery += ` AND r.dietary_tags && $${paramIndex}::text[]`;
      params.push(dietaryTags);
      paramIndex++;
    }

    hotQuery += `
       GROUP BY r.id, r.name, r.cuisine, r.dietary_tags, c.id, c.name, c.cover_image_url
       ORDER BY match_count DESC, unique_users DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const hotResult = await query(hotQuery, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT rm.recipe_id) as total
       FROM recipe_matches rm
       JOIN recipes r ON rm.recipe_id = r.id
       WHERE rm.match_percentage > 0
         AND rm.created_at >= NOW() - ($1 || ' days')::INTERVAL`;
    const countParams = [period];
    let countParamIndex = 2;

    if (cuisine) {
      countQuery += ` AND r.cuisine = $${countParamIndex}`;
      countParams.push(cuisine);
      countParamIndex++;
    }

    if (dietary) {
      const dietaryTags = dietary.split(',').map(t => t.trim());
      countQuery += ` AND r.dietary_tags && $${countParamIndex}::text[]`;
      countParams.push(dietaryTags);
      countParamIndex++;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    const amazonTag = process.env.AMAZON_ASSOCIATES_TAG || 'cookbookapp-20';

    // Add signed URLs and Amazon links
    const recipes = await Promise.all(
      hotResult.rows.map(async (row) => {
        let signedCoverUrl = null;
        if (row.cover_image_url) {
          try {
            signedCoverUrl = await getSignedUrl(row.cover_image_url);
          } catch (e) {
            logger.warn('Failed to get signed URL for hot recipe', { recipeId: row.recipe_id });
          }
        }
        return {
          recipeId: row.recipe_id,
          recipeName: row.recipe_name,
          cookbookId: row.cookbook_id,
          cookbookName: row.cookbook_name,
          coverImageUrl: signedCoverUrl,
          matchCount: parseInt(row.match_count),
          uniqueUsers: parseInt(row.unique_users),
          lastMatchedAt: row.last_matched_at,
          cuisine: row.cuisine,
          dietaryTags: row.dietary_tags,
          amazonLink: `https://www.amazon.com/s?k=${encodeURIComponent(row.cookbook_name)}&tag=${amazonTag}`,
        };
      })
    );

    const responseData = {
      recipes,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + recipes.length < total,
      },
    };

    // Cache for 10 minutes
    await cache.set(cacheKey, responseData, 600);

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get distinct cuisine categories with counts
 */
const getCuisineCategories = async (req, res, next) => {
  try {
    const cacheKey = 'global:cuisine_categories';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached });
    }

    // Get cuisine counts
    const cuisineResult = await query(
      `SELECT cuisine, COUNT(*) as count
       FROM recipes
       WHERE cuisine IS NOT NULL AND cuisine != ''
       GROUP BY cuisine
       ORDER BY count DESC`
    );

    // Get dietary tag counts (unnest the array)
    const dietaryResult = await query(
      `SELECT tag, COUNT(*) as count
       FROM recipes, unnest(dietary_tags) as tag
       WHERE dietary_tags IS NOT NULL
       GROUP BY tag
       ORDER BY count DESC`
    );

    const responseData = {
      cuisines: cuisineResult.rows.map(r => ({ name: r.cuisine, count: parseInt(r.count) })),
      dietary: dietaryResult.rows.map(r => ({ name: r.tag, count: parseInt(r.count) })),
    };

    // Cache for 1 hour
    await cache.set(cacheKey, responseData, 3600);

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHotRecipes, getCuisineCategories };
