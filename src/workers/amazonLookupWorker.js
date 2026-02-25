const { amazonLookupQueue } = require('../services/queue');
const { searchBooksWithConfidence } = require('../services/keepaService');
const { query } = require('../database/db');
const logger = require('../utils/logger');

const CONFIDENCE_THRESHOLD = parseInt(process.env.AMAZON_MATCH_CONFIDENCE_THRESHOLD) || 70;

amazonLookupQueue.process(async (job) => {
  const { jobId, userId, cookbookId, bookTitle } = job.data;
  const startTime = Date.now();

  logger.info('Processing Amazon lookup job', {
    jobId,
    cookbookId,
    bookTitle,
  });

  try {
    // Update job status to processing
    await query(
      `UPDATE amazon_lookup_jobs
       SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    // Search Keepa with confidence scoring
    const results = await searchBooksWithConfidence(bookTitle);

    if (!results || results.length === 0) {
      // No results found
      logger.info('No Amazon books found for cookbook', {
        jobId,
        cookbookId,
        bookTitle,
      });

      await query(
        `UPDATE amazon_lookup_jobs
         SET status = 'completed',
             match_status = 'no_match',
             completed_at = NOW(),
             processing_time_ms = $1
         WHERE id = $2`,
        [Date.now() - startTime, jobId]
      );

      await query(
        `UPDATE cookbooks
         SET amazon_match_status = 'no_match'
         WHERE id = $1`,
        [cookbookId]
      );

      return { success: true, matchStatus: 'no_match' };
    }

    const topResult = results[0];

    logger.info('Amazon search results', {
      jobId,
      cookbookId,
      resultCount: results.length,
      topConfidence: topResult.confidence,
      topTitle: topResult.title,
    });

    if (topResult.confidence >= CONFIDENCE_THRESHOLD) {
      // High confidence - auto-match
      await query(
        `UPDATE cookbooks
         SET amazon_asin = $1,
             amazon_image_url = $2,
             amazon_product_url = $3,
             amazon_match_confidence = $4,
             amazon_match_status = 'auto_matched'
         WHERE id = $5`,
        [
          topResult.asin,
          topResult.imageUrl,
          topResult.productUrl,
          topResult.confidence,
          cookbookId,
        ]
      );

      await query(
        `UPDATE amazon_lookup_jobs
         SET status = 'completed',
             match_status = 'auto_matched',
             match_confidence = $1,
             selected_asin = $2,
             completed_at = NOW(),
             processing_time_ms = $3
         WHERE id = $4`,
        [topResult.confidence, topResult.asin, Date.now() - startTime, jobId]
      );

      logger.info('Amazon book auto-matched', {
        jobId,
        cookbookId,
        asin: topResult.asin,
        confidence: topResult.confidence,
        title: topResult.title,
      });

      return { success: true, matchStatus: 'auto_matched', confidence: topResult.confidence };
    } else {
      // Low confidence - needs manual review
      await query(
        `UPDATE amazon_lookup_jobs
         SET status = 'pending_review',
             match_status = 'pending_review',
             match_confidence = $1,
             suggestions = $2,
             completed_at = NOW(),
             processing_time_ms = $3
         WHERE id = $4`,
        [
          topResult.confidence,
          JSON.stringify(results.slice(0, 3)),
          Date.now() - startTime,
          jobId,
        ]
      );

      await query(
        `UPDATE cookbooks
         SET amazon_match_status = 'pending_review',
             amazon_match_confidence = $1
         WHERE id = $2`,
        [topResult.confidence, cookbookId]
      );

      logger.info('Amazon book needs manual review', {
        jobId,
        cookbookId,
        topConfidence: topResult.confidence,
        suggestionCount: results.length,
        threshold: CONFIDENCE_THRESHOLD,
      });

      return { success: true, matchStatus: 'pending_review', confidence: topResult.confidence };
    }
  } catch (error) {
    logger.error('Amazon lookup job failed', {
      jobId,
      cookbookId,
      error: error.message,
      stack: error.stack,
    });

    await query(
      `UPDATE amazon_lookup_jobs
       SET status = 'failed',
           match_status = 'failed',
           error_message = $1,
           error_code = $2,
           completed_at = NOW(),
           processing_time_ms = $3
       WHERE id = $4`,
      [error.message, error.code || 'UNKNOWN_ERROR', Date.now() - startTime, jobId]
    );

    await query(
      `UPDATE cookbooks
       SET amazon_match_status = 'failed'
       WHERE id = $1`,
      [cookbookId]
    );

    throw error;
  }
});

logger.info('Amazon lookup worker started');
