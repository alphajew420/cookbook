const { query } = require('../database/db');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get all scan jobs for user
 */
const getScanJobs = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, status, limit = 20, offset = 0 } = req.query;

    let queryText = `
      SELECT id, scan_type, status, cookbook_id, cookbook_name, total_pages, processed_pages,
             items_found, created_at, started_at, completed_at, processing_time_ms, error_message, error_code
      FROM scan_jobs
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (type && type !== 'all') {
      queryText += ` AND scan_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status && status !== 'all') {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM scan_jobs WHERE user_id = $1';
    const countParams = [userId];
    let countParamIndex = 2;

    if (type && type !== 'all') {
      countQuery += ` AND scan_type = $${countParamIndex}`;
      countParams.push(type);
      countParamIndex++;
    }

    if (status && status !== 'all') {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    // Get status counts
    const statusCounts = await query(
      `SELECT status, COUNT(*) as count 
       FROM scan_jobs 
       WHERE user_id = $1 
       GROUP BY status`,
      [userId]
    );

    const statusMap = {};
    statusCounts.rows.forEach((row) => {
      statusMap[row.status] = parseInt(row.count);
    });

    res.status(200).json({
      success: true,
      data: {
        jobs: result.rows.map((job) => ({
          id: job.id,
          scanType: job.scan_type,
          status: job.status,
          cookbookId: job.cookbook_id,
          cookbookName: job.cookbook_name,
          totalPages: job.total_pages,
          processedPages: job.processed_pages,
          itemsFound: job.items_found,
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          processingTimeMs: job.processing_time_ms,
          errorMessage: job.error_message,
          errorCode: job.error_code,
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + result.rows.length < total,
        },
        statusCounts: statusMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single scan job
 */
const getScanJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    const result = await query(
      `SELECT id, scan_type, status, cookbook_id, cookbook_name, total_pages, processed_pages,
              items_found, image_urls, result_data, created_at, started_at, completed_at, 
              processing_time_ms, error_message, error_code, retry_count
       FROM scan_jobs
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Scan job not found');
    }

    const job = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        id: job.id,
        scanType: job.scan_type,
        status: job.status,
        cookbookId: job.cookbook_id,
        cookbookName: job.cookbook_name,
        totalPages: job.total_pages,
        processedPages: job.processed_pages,
        itemsFound: job.items_found,
        imageUrls: job.image_urls,
        resultData: job.result_data,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        processingTimeMs: job.processing_time_ms,
        errorMessage: job.error_message,
        errorCode: job.error_code,
        retryCount: job.retry_count,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retry failed scan job
 */
const retryScanJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    // Get job
    const jobResult = await query(
      `SELECT id, scan_type, status, image_urls, cookbook_name, retry_count, max_retries
       FROM scan_jobs
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    if (jobResult.rows.length === 0) {
      throw new NotFoundError('Scan job not found');
    }

    const job = jobResult.rows[0];

    if (job.status !== 'failed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Only failed jobs can be retried',
        },
      });
    }

    if (job.retry_count >= job.max_retries) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MAX_RETRIES_EXCEEDED',
          message: 'Maximum retry attempts exceeded',
        },
      });
    }

    // Reset job status
    await query(
      `UPDATE scan_jobs 
       SET status = 'pending', 
           retry_count = retry_count + 1,
           error_message = NULL,
           error_code = NULL,
           started_at = NULL,
           completed_at = NULL
       WHERE id = $1`,
      [jobId]
    );

    // Re-add to queue
    const { addCookbookJob, addFridgeJob } = require('../services/queue');

    if (job.scan_type === 'cookbook') {
      await addCookbookJob({
        jobId,
        userId,
        cookbookName: job.cookbook_name,
        imageUrls: job.image_urls,
      });
    } else {
      await addFridgeJob({
        jobId,
        userId,
        imageUrl: job.image_urls[0],
      });
    }

    logger.info('Scan job retried', { jobId, userId, scanType: job.scan_type });

    res.status(200).json({
      success: true,
      message: 'Scan job requeued for processing',
      data: {
        jobId,
        status: 'pending',
        retryCount: job.retry_count + 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete scan job
 */
const deleteScanJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    // Verify ownership
    const jobResult = await query(
      'SELECT id, status FROM scan_jobs WHERE id = $1 AND user_id = $2',
      [jobId, userId]
    );

    if (jobResult.rows.length === 0) {
      throw new NotFoundError('Scan job not found');
    }

    const job = jobResult.rows[0];

    // Don't allow deleting processing jobs
    if (job.status === 'processing') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'JOB_PROCESSING',
          message: 'Cannot delete job that is currently processing',
        },
      });
    }

    await query('DELETE FROM scan_jobs WHERE id = $1', [jobId]);

    logger.info('Scan job deleted', { jobId, userId });

    res.status(200).json({
      success: true,
      message: 'Scan job deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getScanJobs,
  getScanJob,
  retryScanJob,
  deleteScanJob,
};
