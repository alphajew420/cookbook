require('dotenv').config();
const { cookbookQueue, fridgeQueue } = require('../services/queue');
const { processCookbookImage, processFridgeImage } = require('../services/gemini');
const { query, transaction } = require('../database/db');
const { cache, cacheKeys } = require('../utils/redis');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Process cookbook scan job
 */
cookbookQueue.process(async (job) => {
  const { jobId, userId, cookbookName, imageUrls } = job.data;
  const startTime = Date.now();

  logger.info('Processing cookbook job', {
    jobId,
    userId,
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

    let cookbookId = null;
    let totalRecipes = 0;

    // Process each image
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];

      // Update progress
      job.progress((i / imageUrls.length) * 100);

      // Download image from S3 and process
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });

      // Extract S3 key from URL
      const urlParts = imageUrl.split('.com/')[1].split('?')[0];
      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: urlParts,
      };

      const imageData = await s3.getObject(s3Params).promise();
      const imageBuffer = imageData.Body;

      // Process with Gemini
      const aiResult = await processCookbookImage(imageBuffer);

      if (!aiResult.success || aiResult.data.recipes.length === 0) {
        logger.warn('No recipes found in image', { jobId, imageIndex: i });
        continue;
      }

      // Store recipes in database
      const result = await transaction(async (client) => {
        let currentCookbookId = cookbookId;

        // Create or get cookbook
        if (!currentCookbookId) {
          const existingCookbook = await client.query(
            'SELECT id FROM cookbooks WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
            [userId, cookbookName]
          );

          if (existingCookbook.rows.length > 0) {
            currentCookbookId = existingCookbook.rows[0].id;
          } else {
            const cookbookResult = await client.query(
              `INSERT INTO cookbooks (user_id, name, scanned_pages, cover_image_url)
               VALUES ($1, $2, 1, $3)
               RETURNING id`,
              [userId, cookbookName, imageUrl]
            );
            currentCookbookId = cookbookResult.rows[0].id;
          }
        } else {
          await client.query(
            'UPDATE cookbooks SET scanned_pages = scanned_pages + 1, updated_at = NOW() WHERE id = $1',
            [currentCookbookId]
          );
        }

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
            `INSERT INTO recipes (cookbook_id, name, prep_time, cook_time, total_time, servings, notes, page_number, original_image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              currentCookbookId,
              recipeData.name,
              recipeData.prepTime || null,
              recipeData.cookTime || null,
              recipeData.totalTime || null,
              servings,
              recipeData.notes || null,
              i + 1,
              imageUrl,
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

        return currentCookbookId;
      });

      cookbookId = result;

      // Update processed pages
      await query(
        `UPDATE scan_jobs 
         SET processed_pages = $1, cookbook_id = $2 
         WHERE id = $3`,
        [i + 1, cookbookId, jobId]
      );
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
  });

  try {
    // Update job status to processing
    await query(
      `UPDATE scan_jobs 
       SET status = 'processing', started_at = NOW() 
       WHERE id = $1`,
      [jobId]
    );

    // Download image from S3
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const urlParts = imageUrl.split('.com/')[1].split('?')[0];
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: urlParts,
    };

    const imageData = await s3.getObject(s3Params).promise();
    const imageBuffer = imageData.Body;

    // Process with Gemini
    const aiResult = await processFridgeImage(imageBuffer);

    if (!aiResult.success) {
      throw new Error(aiResult.message || 'Failed to process fridge image');
    }

    // Store items in database
    const items = await transaction(async (client) => {
      if (replaceExisting) {
        await client.query('DELETE FROM fridge_items WHERE user_id = $1', [userId]);
      }

      const fridgeItems = [];
      for (const item of aiResult.data.items) {
        const result = await client.query(
          `INSERT INTO fridge_items (user_id, name, quantity, category, freshness, packaging, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            userId,
            item.name,
            item.quantity || null,
            item.category || null,
            item.freshness || null,
            item.packaging || null,
            item.confidence || 'medium',
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

logger.info('Scan worker started');
logger.info('Listening for cookbook and fridge scan jobs');
