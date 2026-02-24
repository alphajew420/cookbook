require('dotenv').config();
const { cookbookQueue, fridgeQueue } = require('../services/queue');
const { processCookbookImage, processFridgeImage } = require('../services/gemini');
const { query, transaction } = require('../database/db');
const { cache, cacheKeys } = require('../utils/redis');
const { s3, BUCKET_NAME, extractKeyFromUrl } = require('../utils/s3');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Process cookbook scan job
 */
cookbookQueue.process(async (job) => {
  const { jobId, userId, cookbookId, cookbookName, imageUrls } = job.data;
  const startTime = Date.now();

  logger.info('Processing cookbook job', {
    jobId,
    userId,
    cookbookId,
    cookbookName,
    imageCount: imageUrls.length,
  });

  try {
    // Update job status to processing
    await query(
      `UPDATE scan_jobs 
       SET status = 'processing', started_at = NOW() 
       WHERE id = $1`,
      [jobId]
    );

    let totalRecipes = 0;

    // Process each image
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];

      // Update progress
      const progress = Math.round(((i + 1) / imageUrls.length) * 100);
      job.progress(progress);

      logger.info('Processing page', {
        jobId,
        page: i + 1,
        total: imageUrls.length,
        progress: `${progress}%`,
      });

      // Download image from R2/S3
      const key = extractKeyFromUrl(imageUrl);
      logger.info('Downloading image from R2', { jobId, key, bucket: BUCKET_NAME, originalUrl: imageUrl });

      let imageBuffer;
      try {
        const imageData = await s3.getObject({ Bucket: BUCKET_NAME, Key: key }).promise();
        imageBuffer = imageData.Body;
        logger.info('Image downloaded from R2', { jobId, key, size: imageBuffer.length });
      } catch (s3Error) {
        logger.error('R2 download failed', { jobId, key, bucket: BUCKET_NAME, error: s3Error.message, code: s3Error.code });
        throw s3Error;
      }

      // Process with Gemini
      logger.info('Sending image to Gemini AI', { jobId, page: i + 1, imageSize: imageBuffer.length });
      const aiResult = await processCookbookImage(imageBuffer);
      logger.info('Gemini AI response', { jobId, page: i + 1, success: aiResult.success, recipesFound: aiResult.data?.recipes?.length || 0 });

      if (!aiResult.success || aiResult.data.recipes.length === 0) {
        logger.warn('No recipes found in image', { jobId, imageIndex: i + 1, aiSuccess: aiResult.success, aiMessage: aiResult.message });
        
        // Update processed pages even if no recipes found
        await query(
          `UPDATE scan_jobs SET processed_pages = $1 WHERE id = $2`,
          [i + 1, jobId]
        );
        continue;
      }

      // Store recipes in database
      await transaction(async (client) => {
        // Update cookbook scanned_pages
        await client.query(
          'UPDATE cookbooks SET scanned_pages = scanned_pages + 1, updated_at = NOW() WHERE id = $1',
          [cookbookId]
        );

        // Store recipes
        for (const recipeData of aiResult.data.recipes) {
          // Sanitize servings
          let servings = null;
          if (recipeData.servings) {
            if (typeof recipeData.servings === 'number') {
              servings = recipeData.servings;
            } else if (typeof recipeData.servings === 'string') {
              const match = recipeData.servings.match(/\d+/);
              servings = match ? parseInt(match[0]) : null;
            }
          }

          const recipeResult = await client.query(
            `INSERT INTO recipes (cookbook_id, name, prep_time, cook_time, total_time, servings, notes, page_number, original_image_url, cuisine, dietary_tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
              cookbookId,
              recipeData.name,
              recipeData.prepTime || null,
              recipeData.cookTime || null,
              recipeData.totalTime || null,
              servings,
              recipeData.notes || null,
              i + 1,
              imageUrl,
              recipeData.cuisine || null,
              recipeData.dietaryTags && recipeData.dietaryTags.length > 0 ? recipeData.dietaryTags : null,
            ]
          );

          const recipeId = recipeResult.rows[0].id;

          // Insert ingredients
          for (let idx = 0; idx < recipeData.ingredients.length; idx++) {
            const ing = recipeData.ingredients[idx];
            await client.query(
              `INSERT INTO ingredients (recipe_id, name, quantity, unit, notes, order_index)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [recipeId, ing.name, ing.quantity || null, ing.unit || null, ing.notes || null, idx]
            );
          }

          // Insert instructions
          for (let idx = 0; idx < recipeData.instructions.length; idx++) {
            await client.query(
              `INSERT INTO instructions (recipe_id, step_number, description)
               VALUES ($1, $2, $3)`,
              [recipeId, idx + 1, recipeData.instructions[idx]]
            );
          }

          totalRecipes++;
        }
      });

      // Update processed pages after each image
      await query(
        `UPDATE scan_jobs SET processed_pages = $1 WHERE id = $2`,
        [i + 1, jobId]
      );

      logger.info('Page processed', {
        jobId,
        page: i + 1,
        total: imageUrls.length,
        recipesFound: aiResult.data.recipes.length,
      });
    }

    const processingTime = Date.now() - startTime;

    // Update job to completed
    await query(
      `UPDATE scan_jobs 
       SET status = 'completed', 
           completed_at = NOW(), 
           processing_time_ms = $1,
           result_data = $2
       WHERE id = $3`,
      [
        processingTime,
        JSON.stringify({ recipesFound: totalRecipes, cookbookId }),
        jobId,
      ]
    );

    // Invalidate cache
    await cache.delPattern(`user:${userId}:*`);

    logger.info('Cookbook job completed', {
      jobId,
      userId,
      recipesFound: totalRecipes,
      processingTime,
    });

    return { success: true, recipesFound: totalRecipes, cookbookId };
  } catch (error) {
    logger.error('Cookbook job failed', {
      jobId,
      userId,
      error: error.message,
      stack: error.stack,
    });

    // Update job to failed
    await query(
      `UPDATE scan_jobs 
       SET status = 'failed', 
           completed_at = NOW(), 
           error_message = $1,
           error_code = $2
       WHERE id = $3`,
      [error.message, error.code || 'UNKNOWN_ERROR', jobId]
    );

    throw error;
  }
});

/**
 * Process fridge scan job
 */
fridgeQueue.process(async (job) => {
  const { jobId, userId, imageUrl, replaceExisting } = job.data;
  const startTime = Date.now();

  logger.info('Processing fridge job', {
    jobId,
    userId,
    imageUrl,
    replaceExisting,
  });

  try {
    // Update job status to processing
    await query(
      `UPDATE scan_jobs
       SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    // Download image from R2/S3
    const key = extractKeyFromUrl(imageUrl);
    logger.info('Downloading fridge image from R2', { jobId, key, bucket: BUCKET_NAME, originalUrl: imageUrl });

    let imageBuffer;
    try {
      const imageData = await s3.getObject({ Bucket: BUCKET_NAME, Key: key }).promise();
      imageBuffer = imageData.Body;
      logger.info('Fridge image downloaded from R2', { jobId, key, size: imageBuffer.length });
    } catch (s3Error) {
      logger.error('R2 download failed for fridge image', { jobId, key, bucket: BUCKET_NAME, error: s3Error.message, code: s3Error.code });
      throw s3Error;
    }

    // Process with Gemini
    logger.info('Sending fridge image to Gemini AI', { jobId, imageSize: imageBuffer.length });
    const aiResult = await processFridgeImage(imageBuffer);
    logger.info('Gemini AI fridge response', { jobId, success: aiResult.success, itemsFound: aiResult.data?.items?.length || 0 });

    if (!aiResult.success) {
      logger.error('Gemini AI failed for fridge scan', { jobId, message: aiResult.message });
      throw new Error(aiResult.message || 'Failed to process fridge image');
    }

    // Store items in database
    logger.info('Storing fridge items in database', { jobId, itemCount: aiResult.data.items.length, replaceExisting });
    const items = await transaction(async (client) => {
      if (replaceExisting) {
        logger.info('Replacing existing fridge items', { jobId, userId });
        await client.query('DELETE FROM fridge_items WHERE user_id = $1', [userId]);
      }

      const fridgeItems = [];
      for (const item of aiResult.data.items) {
        const result = await client.query(
          `INSERT INTO fridge_items (user_id, name, quantity, category, freshness, packaging, confidence, scan_job_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            userId,
            item.name,
            item.quantity || null,
            item.category || null,
            item.freshness || null,
            item.packaging || null,
            item.confidence || 'medium',
            jobId,
          ]
        );
        fridgeItems.push(result.rows[0]);
      }

      return fridgeItems;
    });

    const processingTime = Date.now() - startTime;

    // Update job to completed
    await query(
      `UPDATE scan_jobs 
       SET status = 'completed', 
           completed_at = NOW(), 
           processing_time_ms = $1,
           items_found = $2,
           result_data = $3
       WHERE id = $4`,
      [processingTime, items.length, JSON.stringify({ itemsFound: items.length }), jobId]
    );

    // Invalidate cache
    await cache.delPattern(`${cacheKeys.fridgeInventory(userId)}*`);

    logger.info('Fridge job completed', {
      jobId,
      userId,
      itemsFound: items.length,
      processingTime,
    });

    return { success: true, itemsFound: items.length };
  } catch (error) {
    logger.error('Fridge job failed', {
      jobId,
      userId,
      error: error.message,
      stack: error.stack,
    });

    // Update job to failed
    await query(
      `UPDATE scan_jobs 
       SET status = 'failed', 
           completed_at = NOW(), 
           error_message = $1,
           error_code = $2
       WHERE id = $3`,
      [error.message, error.code || 'UNKNOWN_ERROR', jobId]
    );

    throw error;
  }
});

require('./matchWorker');

logger.info('Scan worker started');
logger.info('Listening for cookbook, fridge scan, and recipe match jobs');
