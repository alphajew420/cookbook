const { uploadImage, extractKeyFromUrl } = require('../utils/s3');
const { query } = require('../database/db');
const { AppError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { addCookbookJob, addAmazonLookupJob } = require('../services/queue');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { lookupAndStoreCookbook } = require('../services/keepaService');

/**
 * Batch cookbook scan - accepts multiple images for one cookbook
 * Supports adding pages to an existing cookbook via optional cookbookId field
 */
const scanCookbookBatch = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new AppError('No image files provided', 400, 'INVALID_REQUEST');
    }

    const { cookbookName, cookbookId: existingCookbookId } = req.body;
    const userId = req.user.id;
    const images = req.files;

    logger.info('Processing batch cookbook scan', {
      userId,
      cookbookName,
      existingCookbookId: existingCookbookId || null,
      imageCount: images.length,
    });

    // Upload all images to S3
    const imageUrls = [];
    for (let i = 0; i < images.length; i++) {
      const imageUrl = await uploadImage(images[i].buffer, 'cookbook', images[i].mimetype);
      imageUrls.push(imageUrl);

      logger.info('Image uploaded to S3', {
        index: i + 1,
        total: images.length,
        key: extractKeyFromUrl(imageUrl),
      });
    }

    let cookbookId;

    if (existingCookbookId) {
      // Adding pages to an existing cookbook
      const existing = await query(
        'SELECT id, user_id, name FROM cookbooks WHERE id = $1',
        [existingCookbookId]
      );

      if (existing.rows.length === 0) {
        throw new NotFoundError('Cookbook not found');
      }

      if (existing.rows[0].user_id !== userId) {
        throw new ForbiddenError('Not authorized to add pages to this cookbook');
      }

      cookbookId = existingCookbookId;
      logger.info('Adding pages to existing cookbook', { cookbookId, cookbookName: existing.rows[0].name });
    } else {
      // Create a new cookbook (existing behavior)
      const recentCookbook = await query(
        `SELECT id FROM cookbooks
         WHERE user_id = $1
         AND LOWER(name) = LOWER($2)
         AND created_at >= NOW() - INTERVAL '5 minutes'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, cookbookName || 'My Cookbook']
      );

      if (recentCookbook.rows.length > 0) {
        cookbookId = recentCookbook.rows[0].id;
        logger.info('Reusing existing cookbook', { cookbookId, cookbookName });
      } else {
        const cookbookResult = await query(
          `INSERT INTO cookbooks (user_id, name, scanned_pages, cover_image_url)
           VALUES ($1, $2, 0, $3)
           RETURNING id`,
          [userId, cookbookName || 'My Cookbook', imageUrls[0]]
        );
        cookbookId = cookbookResult.rows[0].id;
        logger.info('Created new cookbook', { cookbookId, cookbookName });

        // Queue Amazon book lookup via Keepa
        const amazonJobId = uuidv4();
        await query(
          `INSERT INTO amazon_lookup_jobs (id, user_id, cookbook_id, cookbook_name, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [amazonJobId, userId, cookbookId, cookbookName || 'My Cookbook']
        );
        addAmazonLookupJob({
          jobId: amazonJobId,
          userId,
          cookbookId,
          bookTitle: cookbookName || 'My Cookbook',
        }).catch((error) => {
          logger.error('Failed to queue Amazon lookup', { cookbookId, error: error.message });
        });
      }
    }

    // Create single job for all pages
    const jobId = uuidv4();
    await query(
      `INSERT INTO scan_jobs (id, user_id, scan_type, status, cookbook_id, cookbook_name, total_pages, processed_pages, image_urls)
       VALUES ($1, $2, 'cookbook', 'pending', $3, $4, $5, 0, $6)`,
      [jobId, userId, cookbookId, cookbookName || 'My Cookbook', images.length, imageUrls]
    );

    // Add to queue
    await addCookbookJob({
      jobId,
      userId,
      cookbookId,
      cookbookName: cookbookName || 'My Cookbook',
      imageUrls,
    });

    logger.info('Batch cookbook scan submitted', {
      jobId,
      userId,
      cookbookId,
      totalPages: images.length,
    });

    res.status(202).json({
      success: true,
      message: 'Cookbook scan submitted for processing',
      data: {
        jobId,
        cookbookId,
        status: 'pending',
        totalPages: images.length,
        estimatedTime: `${images.length * 30}-${images.length * 60} seconds`,
        pollUrl: `/api/scan/jobs/${jobId}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scanCookbookBatch,
};
