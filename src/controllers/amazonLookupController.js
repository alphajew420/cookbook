const { query } = require('../database/db');
const { NotFoundError, ForbiddenError, ValidationError, AppError } = require('../middleware/errorHandler');
const { addAmazonLookupJob } = require('../services/queue');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/cookbooks/:id/amazon-lookup
 * Trigger Amazon book lookup for a cookbook
 */
const createAmazonLookup = async (req, res, next) => {
  try {
    const { id: cookbookId } = req.params;
    const userId = req.user.id;

    // Verify cookbook ownership
    const cookbookResult = await query(
      'SELECT id, name FROM cookbooks WHERE id = $1 AND user_id = $2',
      [cookbookId, userId]
    );

    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }

    const cookbook = cookbookResult.rows[0];

    // Check if lookup already exists
    const existingJob = await query(
      `SELECT id, status, match_status FROM amazon_lookup_jobs
       WHERE cookbook_id = $1 AND status IN ('pending', 'processing', 'pending_review')
       ORDER BY created_at DESC LIMIT 1`,
      [cookbookId]
    );

    if (existingJob.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'LOOKUP_IN_PROGRESS',
          message: 'Amazon lookup already in progress for this cookbook',
          jobId: existingJob.rows[0].id,
        },
      });
    }

    // Create job record
    const jobId = uuidv4();
    await query(
      `INSERT INTO amazon_lookup_jobs (id, user_id, cookbook_id, cookbook_name, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [jobId, userId, cookbookId, cookbook.name]
    );

    // Add to queue
    await addAmazonLookupJob({
      jobId,
      userId,
      cookbookId,
      bookTitle: cookbook.name,
    });

    logger.info('Amazon lookup job created', { jobId, cookbookId, userId });

    res.status(201).json({
      success: true,
      data: {
        jobId,
        cookbookId,
        status: 'pending',
        estimatedTime: '5-10 seconds',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/cookbooks/:id/amazon-lookup
 * Get Amazon lookup status and suggestions
 */
const getAmazonLookup = async (req, res, next) => {
  try {
    const { id: cookbookId } = req.params;
    const userId = req.user.id;

    // Verify cookbook ownership
    const cookbookResult = await query(
      'SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2',
      [cookbookId, userId]
    );

    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }

    // Get latest lookup job
    const jobResult = await query(
      `SELECT id, status, match_status, match_confidence, suggestions, selected_asin,
              created_at, started_at, completed_at, error_message
       FROM amazon_lookup_jobs
       WHERE cookbook_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [cookbookId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_LOOKUP',
          message: 'No Amazon lookup found for this cookbook',
        },
      });
    }

    const job = jobResult.rows[0];

    res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        matchStatus: job.match_status,
        matchConfidence: job.match_confidence,
        suggestions: job.suggestions,
        selectedAsin: job.selected_asin,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cookbooks/:id/amazon-lookup/select
 * User selects a book from suggestions
 */
const selectAmazonBook = async (req, res, next) => {
  try {
    const { id: cookbookId } = req.params;
    const { asin } = req.body;
    const userId = req.user.id;

    if (!asin) {
      throw new ValidationError('asin is required');
    }

    // Verify cookbook ownership
    const cookbookResult = await query(
      'SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2',
      [cookbookId, userId]
    );

    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }

    // Get lookup job
    const jobResult = await query(
      `SELECT id, suggestions FROM amazon_lookup_jobs
       WHERE cookbook_id = $1 AND match_status = 'pending_review'
       ORDER BY created_at DESC LIMIT 1`,
      [cookbookId]
    );

    if (jobResult.rows.length === 0) {
      throw new NotFoundError('No pending Amazon lookup found');
    }

    const job = jobResult.rows[0];
    const suggestions = job.suggestions;

    // Find selected suggestion
    const selected = suggestions.find(s => s.asin === asin);
    if (!selected) {
      throw new ValidationError('Invalid ASIN - not in suggestions');
    }

    // Update cookbook with selected book
    await query(
      `UPDATE cookbooks
       SET amazon_asin = $1,
           amazon_image_url = $2,
           amazon_product_url = $3,
           amazon_match_confidence = $4,
           amazon_match_status = 'user_selected'
       WHERE id = $5`,
      [
        selected.asin,
        selected.imageUrl,
        selected.productUrl,
        selected.confidence,
        cookbookId,
      ]
    );

    // Update lookup job
    await query(
      `UPDATE amazon_lookup_jobs
       SET status = 'completed',
           match_status = 'user_selected',
           selected_asin = $1
       WHERE id = $2`,
      [asin, job.id]
    );

    logger.info('User selected Amazon book', {
      cookbookId,
      userId,
      asin,
      confidence: selected.confidence,
    });

    res.status(200).json({
      success: true,
      data: {
        asin: selected.asin,
        title: selected.title,
        imageUrl: selected.imageUrl,
        productUrl: selected.productUrl,
        confidence: selected.confidence,
        matchStatus: 'user_selected',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/cookbooks/:id/amazon-lookup/skip
 * User skips Amazon book selection
 */
const skipAmazonLookup = async (req, res, next) => {
  try {
    const { id: cookbookId } = req.params;
    const userId = req.user.id;

    // Verify cookbook ownership
    const cookbookResult = await query(
      'SELECT id FROM cookbooks WHERE id = $1 AND user_id = $2',
      [cookbookId, userId]
    );

    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }

    // Update lookup job
    await query(
      `UPDATE amazon_lookup_jobs
       SET status = 'completed',
           match_status = 'no_match'
       WHERE cookbook_id = $1 AND match_status = 'pending_review'`,
      [cookbookId]
    );

    // Update cookbook
    await query(
      `UPDATE cookbooks
       SET amazon_match_status = 'no_match'
       WHERE id = $1`,
      [cookbookId]
    );

    logger.info('User skipped Amazon lookup', { cookbookId, userId });

    res.status(200).json({
      success: true,
      message: 'Amazon lookup skipped',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAmazonLookup,
  getAmazonLookup,
  selectAmazonBook,
  skipAmazonLookup,
};
