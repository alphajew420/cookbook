const { query } = require('../database/db');
const { getSignedUrl } = require('../utils/s3');
const { cache } = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * Get popular cookbooks based on match frequency across all users,
 * falling back to recent uploads when not enough popular data exists.
 */
const getPopularCookbooks = async (req, res, next) => {
  try {
    const { limit = 10, period = '30' } = req.query;
    const parsedLimit = parseInt(limit);

    // Check cache
    const cacheKey = `global:popular_cookbooks:${period}:${parsedLimit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached });
    }

    // Step 1: Popular cookbooks by match activity
    const popularQuery = `
      SELECT
        c.id as cookbook_id,
        c.name as cookbook_name,
        c.cover_image_url,
        COUNT(DISTINCT r.id) as recipe_count,
        COUNT(rm.id) as total_matches,
        COUNT(DISTINCT mj.user_id) as unique_users
      FROM cookbooks c
      JOIN recipes r ON c.id = r.cookbook_id
      JOIN recipe_matches rm ON r.id = rm.recipe_id
      JOIN match_jobs mj ON rm.match_job_id = mj.id
      WHERE rm.created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY c.id, c.name, c.cover_image_url
      ORDER BY total_matches DESC, unique_users DESC
      LIMIT $2`;

    const popularResult = await query(popularQuery, [period, parsedLimit]);
    const popularCookbooks = popularResult.rows;
    const popularIds = popularCookbooks.map(r => r.cookbook_id);

    // Step 2: If not enough popular, fill with recent cookbooks
    let recentCookbooks = [];
    if (popularCookbooks.length < parsedLimit) {
      const remaining = parsedLimit - popularCookbooks.length;

      let recentQuery = `
        SELECT
          c.id as cookbook_id,
          c.name as cookbook_name,
          c.cover_image_url,
          COUNT(r.id) as recipe_count,
          0 as total_matches,
          0 as unique_users
        FROM cookbooks c
        LEFT JOIN recipes r ON c.id = r.cookbook_id`;

      const recentParams = [remaining];
      let paramIndex = 2;

      if (popularIds.length > 0) {
        recentQuery += ` WHERE c.id != ALL($${paramIndex}::uuid[])`;
        recentParams.push(popularIds);
        paramIndex++;
      }

      recentQuery += `
        GROUP BY c.id, c.name, c.cover_image_url
        HAVING COUNT(r.id) > 0
        ORDER BY c.created_at DESC
        LIMIT $1`;

      recentCookbooks = (await query(recentQuery, recentParams)).rows;
    }

    const allCookbooks = [...popularCookbooks, ...recentCookbooks];
    const amazonTag = process.env.AMAZON_ASSOCIATES_TAG || 'cookbookapp-20';

    // Add signed URLs and Amazon links
    const cookbooks = await Promise.all(
      allCookbooks.map(async (row) => {
        let signedCoverUrl = null;
        if (row.cover_image_url) {
          try {
            signedCoverUrl = await getSignedUrl(row.cover_image_url);
          } catch (e) {
            logger.warn('Failed to get signed URL for popular cookbook', { cookbookId: row.cookbook_id });
          }
        }
        return {
          cookbookId: row.cookbook_id,
          cookbookName: row.cookbook_name,
          coverImageUrl: signedCoverUrl,
          recipeCount: parseInt(row.recipe_count),
          totalMatches: parseInt(row.total_matches),
          uniqueUsers: parseInt(row.unique_users),
          amazonLink: `https://www.amazon.com/s?k=${encodeURIComponent(row.cookbook_name)}&tag=${amazonTag}`,
        };
      })
    );

    const responseData = { cookbooks };

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

module.exports = { getPopularCookbooks };
