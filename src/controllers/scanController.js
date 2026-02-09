const { processCookbookImage, processFridgeImage } = require('../services/gemini');
const { uploadImage } = require('../utils/s3');
const { query, transaction } = require('../database/db');
const { cache, cacheKeys, cacheTTL } = require('../utils/redis');
const { AppError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Scan cookbook page
 */
const scanCookbook = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No image file provided', 400, 'INVALID_REQUEST');
    }
    
    const { cookbookId, cookbookName } = req.body;
    const userId = req.user.id;
    const imageBuffer = req.file.buffer;
    
    logger.info('Processing cookbook scan', {
      userId,
      cookbookId,
      imageSize: imageBuffer.length,
    });
    
    // Upload image to S3
    const imageUrl = await uploadImage(imageBuffer, 'cookbook', req.file.mimetype);
    
    // Process with Gemini
    const aiResult = await processCookbookImage(imageBuffer);
    
    // Create scan history record
    const scanId = uuidv4();
    await query(
      `INSERT INTO scan_history (id, user_id, scan_type, image_url, status, result_data, processing_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [scanId, userId, 'cookbook', imageUrl, 'completed', JSON.stringify(aiResult.data), aiResult.processingTime]
    );
    
    // Handle invalid cookbook image
    if (!aiResult.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: aiResult.error,
          message: aiResult.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Handle no recipes found
    if (aiResult.data.recipes.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          scanId,
          recipesFound: 0,
          message: 'No recipes detected on this page. Please try a different page or ensure the image is clear.',
          suggestions: [
            'Ensure the page is well-lit',
            'Avoid glare or shadows',
            'Make sure the entire recipe is visible',
          ],
          imageUrl,
        },
      });
    }
    
    // Store recipes in database
    const result = await transaction(async (client) => {
      let currentCookbookId = cookbookId;
      let cookbook = null;
      
      // Create or get cookbook
      if (!currentCookbookId) {
        const name = cookbookName || aiResult.data.bookTitle || 'My Cookbook';
        
        // Check if cookbook with this name already exists for this user
        const existingCookbook = await client.query(
          'SELECT id, name, scanned_pages, cover_image_url, created_at FROM cookbooks WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
          [userId, name]
        );
        
        if (existingCookbook.rows.length > 0) {
          // Use existing cookbook
          cookbook = existingCookbook.rows[0];
          currentCookbookId = cookbook.id;
          
          // Increment scanned pages
          await client.query(
            'UPDATE cookbooks SET scanned_pages = scanned_pages + 1, updated_at = NOW() WHERE id = $1',
            [currentCookbookId]
          );
          
          logger.info('Adding page to existing cookbook', {
            userId,
            cookbookId: currentCookbookId,
            cookbookName: name,
            previousPages: cookbook.scanned_pages,
          });
        } else {
          // Create new cookbook
          const cookbookResult = await client.query(
            `INSERT INTO cookbooks (user_id, name, scanned_pages, cover_image_url)
             VALUES ($1, $2, 1, $3)
             RETURNING id, name, scanned_pages, cover_image_url, created_at`,
            [userId, name, imageUrl]
          );
          cookbook = cookbookResult.rows[0];
          currentCookbookId = cookbook.id;
          
          logger.info('Created new cookbook', {
            userId,
            cookbookId: currentCookbookId,
            cookbookName: name,
          });
        }
      } else {
        // Verify cookbook belongs to user
        const cookbookCheck = await client.query(
          'SELECT id, name, scanned_pages, cover_image_url, created_at FROM cookbooks WHERE id = $1 AND user_id = $2',
          [currentCookbookId, userId]
        );
        
        if (cookbookCheck.rows.length === 0) {
          throw new NotFoundError('Cookbook not found');
        }
        
        cookbook = cookbookCheck.rows[0];
        
        // Increment scanned pages
        await client.query(
          'UPDATE cookbooks SET scanned_pages = scanned_pages + 1, updated_at = NOW() WHERE id = $1',
          [currentCookbookId]
        );
      }
      
      // Store recipes
      const recipes = [];
      for (const recipeData of aiResult.data.recipes) {
        // Insert recipe
        const recipeResult = await client.query(
          `INSERT INTO recipes (cookbook_id, name, prep_time, cook_time, total_time, servings, notes, page_number, original_image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, prep_time, cook_time, total_time, servings, notes`,
          [
            currentCookbookId,
            recipeData.name,
            recipeData.prepTime || null,
            recipeData.cookTime || null,
            recipeData.totalTime || null,
            recipeData.servings || null,
            recipeData.notes || null,
            aiResult.data.pageNumber || null,
            imageUrl,
          ]
        );
        
        const recipe = recipeResult.rows[0];
        
        // Insert ingredients
        const ingredients = [];
        for (let i = 0; i < recipeData.ingredients.length; i++) {
          const ing = recipeData.ingredients[i];
          const ingResult = await client.query(
            `INSERT INTO ingredients (recipe_id, name, quantity, unit, notes, order_index)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, quantity, unit, notes`,
            [recipe.id, ing.name, ing.quantity || null, ing.unit || null, ing.notes || null, i]
          );
          ingredients.push(ingResult.rows[0]);
        }
        
        // Insert instructions
        const instructions = [];
        for (let i = 0; i < recipeData.instructions.length; i++) {
          const instResult = await client.query(
            `INSERT INTO instructions (recipe_id, step_number, description)
             VALUES ($1, $2, $3)
             RETURNING id, step_number, description`,
            [recipe.id, i + 1, recipeData.instructions[i]]
          );
          instructions.push(instResult.rows[0]);
        }
        
        recipes.push({
          ...recipe,
          ingredients,
          instructions,
        });
      }
      
      return { cookbookId: currentCookbookId, cookbook, recipes };
    });
    
    // Get updated cookbook info
    const cookbookInfo = await query(
      'SELECT id, name, scanned_pages, cover_image_url, created_at, updated_at FROM cookbooks WHERE id = $1',
      [result.cookbookId]
    );
    
    // Invalidate cache
    await cache.delPattern(`user:${userId}:*`);
    
    logger.info('Cookbook scan completed', {
      userId,
      scanId,
      recipesFound: result.recipes.length,
      cookbookId: result.cookbookId,
    });
    
    res.status(200).json({
      success: true,
      data: {
        scanId,
        cookbook: {
          id: cookbookInfo.rows[0].id,
          name: cookbookInfo.rows[0].name,
          scannedPages: cookbookInfo.rows[0].scanned_pages,
          coverImageUrl: cookbookInfo.rows[0].cover_image_url,
          createdAt: cookbookInfo.rows[0].created_at,
          updatedAt: cookbookInfo.rows[0].updated_at,
        },
        recipesFound: result.recipes.length,
        recipes: result.recipes,
        processingTime: aiResult.processingTime,
        imageUrl,
        message: `Page processed successfully. ${result.recipes.length} recipe(s) found.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Scan fridge
 */
const scanFridge = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No image file provided', 400, 'INVALID_REQUEST');
    }
    
    const { replaceExisting } = req.body;
    const userId = req.user.id;
    const imageBuffer = req.file.buffer;
    
    logger.info('Processing fridge scan', {
      userId,
      imageSize: imageBuffer.length,
      replaceExisting,
    });
    
    // Upload image to S3
    const imageUrl = await uploadImage(imageBuffer, 'fridge', req.file.mimetype);
    
    // Process with Gemini
    const aiResult = await processFridgeImage(imageBuffer);
    
    // Create scan history record
    const scanId = uuidv4();
    await query(
      `INSERT INTO scan_history (id, user_id, scan_type, image_url, status, result_data, processing_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [scanId, userId, 'fridge', imageUrl, 'completed', JSON.stringify(aiResult.data), aiResult.processingTime]
    );
    
    // Handle invalid fridge image
    if (!aiResult.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: aiResult.error,
          message: aiResult.message,
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Handle empty fridge
    if (aiResult.data.items.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          scanId,
          itemsFound: 0,
          message: 'No food items detected in the image.',
          imageQuality: aiResult.data.imageQuality,
          isValidFridge: aiResult.data.isValidFridge,
          suggestions: [
            'Make sure the fridge door is fully open',
            'Ensure good lighting inside the fridge',
            'Items may be hidden behind other items',
          ],
          imageUrl,
        },
      });
    }
    
    // Store items in database
    logger.info('Saving fridge items to database', {
      userId,
      itemCount: aiResult.data.items.length,
      replaceExisting,
    });
    
    const items = await transaction(async (client) => {
      // Replace existing items if requested
      if (replaceExisting === 'true' || replaceExisting === true) {
        const deleteResult = await client.query('DELETE FROM fridge_items WHERE user_id = $1', [userId]);
        logger.info('Deleted existing fridge items', {
          userId,
          deletedCount: deleteResult.rowCount,
        });
      }
      
      const fridgeItems = [];
      for (const item of aiResult.data.items) {
        try {
          const result = await client.query(
            `INSERT INTO fridge_items (user_id, name, quantity, category, freshness, packaging, confidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, name, quantity, category, freshness, packaging, confidence, created_at`,
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
        } catch (error) {
          logger.error('Failed to insert fridge item', {
            userId,
            itemName: item.name,
            error: error.message,
          });
          throw error;
        }
      }
      
      logger.info('Fridge items saved successfully', {
        userId,
        savedCount: fridgeItems.length,
      });
      
      return fridgeItems;
    });
    
    // Invalidate all fridge inventory cache variations (different sort/category combinations)
    await cache.delPattern(`${cacheKeys.fridgeInventory(userId)}*`);
    
    // Check for warnings
    const warnings = [];
    if (aiResult.data.imageQuality === 'poor') {
      warnings.push({
        type: 'LOW_CONFIDENCE',
        message: 'Poor lighting may have affected accuracy. Some items may not have been detected.',
        suggestion: 'Turn on fridge light or use phone flashlight',
      });
    }
    
    logger.info('Fridge scan completed', {
      userId,
      scanId,
      itemsFound: items.length,
    });
    
    res.status(200).json({
      success: true,
      data: {
        scanId,
        itemsFound: items.length,
        items,
        imageQuality: aiResult.data.imageQuality,
        processingTime: aiResult.processingTime,
        imageUrl,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get scan status (for async processing)
 */
const getScanStatus = async (req, res, next) => {
  try {
    const { scanId } = req.params;
    const userId = req.user.id;
    
    const result = await query(
      `SELECT id, scan_type, status, result_data, error_message, processing_time_ms, created_at
       FROM scan_history
       WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Scan not found');
    }
    
    const scan = result.rows[0];
    
    res.status(200).json({
      success: true,
      data: {
        scanId: scan.id,
        status: scan.status,
        progress: scan.status === 'completed' ? 100 : 50,
        result: scan.result_data,
        error: scan.error_message,
        processingTime: scan.processing_time_ms,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scanCookbook,
  scanFridge,
  getScanStatus,
};
