const { uploadImage } = require('../utils/s3');
const { query } = require('../database/db');
const { AppError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { addCookbookJob } = require('../services/queue');
const { extractPagesAsImages, getPdfPageCount } = require('../services/pdfProcessor');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Scan cookbook from PDF upload
 * Extracts pages as images, uploads to R2, queues for Gemini processing
 */
const scanCookbookPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No PDF file provided', 400, 'INVALID_REQUEST');
    }

    const { cookbookName, cookbookId: existingCookbookId } = req.body;
    const userId = req.user.id;
    const pdfBuffer = req.file.buffer;

    logger.info('Processing PDF cookbook scan', {
      userId,
      cookbookName,
      existingCookbookId: existingCookbookId || null,
      pdfSize: pdfBuffer.length,
    });

    // Validate page count
    const pageCount = await getPdfPageCount(pdfBuffer);

    if (pageCount === 0) {
      throw new AppError('PDF has no pages', 400, 'INVALID_PDF');
    }

    if (pageCount > 50) {
      throw new AppError('PDF exceeds maximum of 50 pages', 400, 'PDF_TOO_LARGE');
    }

    // Extract pages as images
    const imageBuffers = await extractPagesAsImages(pdfBuffer);

    // Upload all page images to R2
    const imageUrls = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const imageUrl = await uploadImage(imageBuffers[i], 'cookbook', 'image/jpeg');
      imageUrls.push(imageUrl);
      logger.info('PDF page uploaded to R2', { page: i + 1, total: imageBuffers.length });
    }

    // Create or reuse cookbook (same logic as batchScanController)
    let cookbookId;

    if (existingCookbookId) {
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
    } else {
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
      } else {
        const cookbookResult = await query(
          `INSERT INTO cookbooks (user_id, name, scanned_pages, cover_image_url)
           VALUES ($1, $2, 0, $3)
           RETURNING id`,
          [userId, cookbookName || 'My Cookbook', imageUrls[0]]
        );
        cookbookId = cookbookResult.rows[0].id;
      }
    }

    // Create scan job
    const jobId = uuidv4();
    await query(
      `INSERT INTO scan_jobs (id, user_id, scan_type, status, cookbook_id, cookbook_name, total_pages, processed_pages, image_urls)
       VALUES ($1, $2, 'cookbook', 'pending', $3, $4, $5, 0, $6)`,
      [jobId, userId, cookbookId, cookbookName || 'My Cookbook', imageBuffers.length, imageUrls]
    );

    // Queue for processing (reuses existing cookbook worker)
    await addCookbookJob({
      jobId,
      userId,
      cookbookId,
      cookbookName: cookbookName || 'My Cookbook',
      imageUrls,
    });

    logger.info('PDF cookbook scan submitted', {
      jobId,
      userId,
      cookbookId,
      totalPages: imageBuffers.length,
    });

    res.status(202).json({
      success: true,
      message: 'PDF cookbook scan submitted for processing',
      data: {
        jobId,
        cookbookId,
        status: 'pending',
        totalPages: imageBuffers.length,
        estimatedTime: `${imageBuffers.length * 30}-${imageBuffers.length * 60} seconds`,
        pollUrl: `/api/scan/jobs/${jobId}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { scanCookbookPdf };
