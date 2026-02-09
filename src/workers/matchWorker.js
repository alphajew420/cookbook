require('dotenv').config();
const { matchQueue } = require('../services/queue');
const { query, transaction } = require('../database/db');
const { fuzzyMatchIngredient } = require('../utils/fuzzyMatch');
const logger = require('../utils/logger');

matchQueue.process(async (job) => {
  const { matchJobId, userId, cookbookId, fridgeScanId } = job.data;
  const startTime = Date.now();

  logger.info('Processing match job', {
    matchJobId,
    userId,
    cookbookId,
    fridgeScanId,
  });

  try {
    await query(
      `UPDATE match_jobs 
       SET status = 'processing', started_at = NOW() 
       WHERE id = $1`,
      [matchJobId]
    );

    const recipesResult = await query(
      `SELECT id, name FROM recipes WHERE cookbook_id = $1`,
      [cookbookId]
    );

    const recipes = recipesResult.rows;
    const totalRecipes = recipes.length;

    const fridgeItemsResult = await query(
      `SELECT fi.id, fi.name, fi.quantity, fi.category
       FROM fridge_items fi
       WHERE fi.user_id = $1 AND fi.scan_job_id = $2`,
      [userId, fridgeScanId]
    );

    const fridgeItems = fridgeItemsResult.rows;

    if (fridgeItems.length === 0) {
      throw new Error('No fridge items found for this scan');
    }

    let matchedRecipesCount = 0;

    for (const recipe of recipes) {
      const ingredientsResult = await query(
        `SELECT id, name, quantity, unit
         FROM ingredients
         WHERE recipe_id = $1
         ORDER BY order_index`,
        [recipe.id]
      );

      const recipeIngredients = ingredientsResult.rows;
      const totalIngredients = recipeIngredients.length;

      if (totalIngredients === 0) {
        continue;
      }

      const availableList = [];
      const missingList = [];

      for (const ingredient of recipeIngredients) {
        const matchResult = fuzzyMatchIngredient(ingredient.name, fridgeItems, 85);

        if (matchResult.matched) {
          availableList.push({
            id: ingredient.id,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        } else {
          missingList.push({
            id: ingredient.id,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          });
        }
      }

      const availableIngredients = availableList.length;
      const missingIngredients = missingList.length;
      const matchPercentage = Math.round((availableIngredients / totalIngredients) * 100);

      if (matchPercentage > 0) {
        matchedRecipesCount++;
      }

      await query(
        `INSERT INTO recipe_matches (
          match_job_id, recipe_id, recipe_name, match_percentage,
          total_ingredients, available_ingredients, missing_ingredients,
          available_ingredients_list, missing_ingredients_list
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          matchJobId,
          recipe.id,
          recipe.name,
          matchPercentage,
          totalIngredients,
          availableIngredients,
          missingIngredients,
          JSON.stringify(availableList),
          JSON.stringify(missingList),
        ]
      );
    }

    const processingTime = Date.now() - startTime;

    await query(
      `UPDATE match_jobs 
       SET status = 'completed', 
           completed_at = NOW(), 
           processing_time_ms = $1,
           total_recipes = $2,
           matched_recipes = $3
       WHERE id = $4`,
      [processingTime, totalRecipes, matchedRecipesCount, matchJobId]
    );

    logger.info('Match job completed', {
      matchJobId,
      userId,
      totalRecipes,
      matchedRecipes: matchedRecipesCount,
      processingTime,
    });

    return { success: true, totalRecipes, matchedRecipes: matchedRecipesCount };
  } catch (error) {
    logger.error('Match job failed', {
      matchJobId,
      userId,
      error: error.message,
      stack: error.stack,
    });

    await query(
      `UPDATE match_jobs 
       SET status = 'failed', 
           completed_at = NOW(), 
           error_message = $1,
           error_code = $2
       WHERE id = $3`,
      [error.message, error.code || 'UNKNOWN_ERROR', matchJobId]
    );

    throw error;
  }
});

logger.info('Match worker started');
logger.info('Listening for recipe match jobs');
