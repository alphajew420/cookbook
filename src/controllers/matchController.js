const { query } = require('../database/db');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const createMatchJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { cookbookId, fridgeScanId } = req.body;

    if (!cookbookId || !fridgeScanId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'cookbookId and fridgeScanId are required',
        },
      });
    }

    const cookbookResult = await query(
      'SELECT id, name FROM cookbooks WHERE id = $1 AND user_id = $2',
      [cookbookId, userId]
    );

    if (cookbookResult.rows.length === 0) {
      throw new NotFoundError('Cookbook not found');
    }

    const cookbook = cookbookResult.rows[0];

    const scanResult = await query(
      'SELECT id, status FROM scan_jobs WHERE id = $1 AND user_id = $2 AND scan_type = $3',
      [fridgeScanId, userId, 'fridge']
    );

    if (scanResult.rows.length === 0) {
      throw new NotFoundError('Fridge scan not found');
    }

    const scan = scanResult.rows[0];

    if (scan.status !== 'completed') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'SCAN_NOT_COMPLETED',
          message: 'Fridge scan must be completed before matching',
        },
      });
    }

    const recipeCountResult = await query(
      'SELECT COUNT(*) as count FROM recipes WHERE cookbook_id = $1',
      [cookbookId]
    );

    const recipeCount = parseInt(recipeCountResult.rows[0].count);

    if (recipeCount === 0) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'NO_RECIPES',
          message: 'Cookbook must have at least one recipe',
        },
      });
    }

    const matchJobId = uuidv4();

    const result = await query(
      `INSERT INTO match_jobs (id, user_id, cookbook_id, cookbook_name, fridge_scan_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, cookbook_id, cookbook_name, fridge_scan_id, status, total_recipes, matched_recipes, created_at`,
      [matchJobId, userId, cookbookId, cookbook.name, fridgeScanId, 'pending']
    );

    const { addMatchJob } = require('../services/queue');
    await addMatchJob({
      matchJobId,
      userId,
      cookbookId,
      fridgeScanId,
    });

    logger.info('Match job created', { matchJobId, userId, cookbookId, fridgeScanId });

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        cookbookId: result.rows[0].cookbook_id,
        cookbookName: result.rows[0].cookbook_name,
        fridgeScanId: result.rows[0].fridge_scan_id,
        status: result.rows[0].status,
        totalRecipes: result.rows[0].total_recipes,
        matchedRecipes: result.rows[0].matched_recipes,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMatchJobs = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    let queryText = `
      SELECT id, cookbook_id, cookbook_name, fridge_scan_id, status, total_recipes, matched_recipes,
             created_at, started_at, completed_at, processing_time_ms, error_message, error_code
      FROM match_jobs
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    let countQuery = 'SELECT COUNT(*) FROM match_jobs WHERE user_id = $1';
    const countParams = [userId];

    if (status && status !== 'all') {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.status(200).json({
      success: true,
      data: {
        jobs: result.rows.map((job) => ({
          id: job.id,
          cookbookId: job.cookbook_id,
          cookbookName: job.cookbook_name,
          fridgeScanId: job.fridge_scan_id,
          status: job.status,
          totalRecipes: job.total_recipes,
          matchedRecipes: job.matched_recipes,
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
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMatchJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;

    const result = await query(
      `SELECT id, cookbook_id, cookbook_name, fridge_scan_id, status, total_recipes, matched_recipes,
              created_at, started_at, completed_at, processing_time_ms, error_message, error_code
       FROM match_jobs
       WHERE id = $1 AND user_id = $2`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Match job not found');
    }

    const job = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        id: job.id,
        cookbookId: job.cookbook_id,
        cookbookName: job.cookbook_name,
        fridgeScanId: job.fridge_scan_id,
        status: job.status,
        totalRecipes: job.total_recipes,
        matchedRecipes: job.matched_recipes,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        processingTimeMs: job.processing_time_ms,
        errorMessage: job.error_message,
        errorCode: job.error_code,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMatchResults = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;

    const jobResult = await query(
      `SELECT id, cookbook_name, status, created_at
       FROM match_jobs
       WHERE id = $1 AND user_id = $2`,
      [matchId, userId]
    );

    if (jobResult.rows.length === 0) {
      throw new NotFoundError('Match job not found');
    }

    const job = jobResult.rows[0];

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'JOB_NOT_COMPLETED',
          message: 'Match job has not completed yet',
        },
      });
    }

    const matchesResult = await query(
      `SELECT recipe_id, recipe_name, match_percentage, total_ingredients, available_ingredients,
              missing_ingredients, available_ingredients_list, missing_ingredients_list
       FROM recipe_matches
       WHERE match_job_id = $1
       ORDER BY match_percentage DESC`,
      [matchId]
    );

    res.status(200).json({
      success: true,
      data: {
        matchJob: {
          id: job.id,
          cookbookName: job.cookbook_name,
          status: job.status,
          createdAt: job.created_at,
        },
        matches: matchesResult.rows.map((match) => ({
          recipeId: match.recipe_id,
          recipeName: match.recipe_name,
          matchPercentage: match.match_percentage,
          totalIngredients: match.total_ingredients,
          availableIngredients: match.available_ingredients,
          missingIngredients: match.missing_ingredients,
          availableIngredientsList: match.available_ingredients_list,
          missingIngredientsList: match.missing_ingredients_list,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteMatchJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;

    const jobResult = await query(
      'SELECT id FROM match_jobs WHERE id = $1 AND user_id = $2',
      [matchId, userId]
    );

    if (jobResult.rows.length === 0) {
      throw new NotFoundError('Match job not found');
    }

    await query('DELETE FROM match_jobs WHERE id = $1', [matchId]);

    logger.info('Match job deleted', { matchId, userId });

    res.status(200).json({
      success: true,
      message: 'Match job deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMatchJob,
  getMatchJobs,
  getMatchJob,
  getMatchResults,
  deleteMatchJob,
};
