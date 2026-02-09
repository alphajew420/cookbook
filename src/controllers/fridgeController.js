const { query } = require('../database/db');
const { cache, cacheKeys, cacheTTL } = require('../utils/redis');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get fridge inventory
 */
const getInventory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category, sortBy = 'created_at' } = req.query;
    
    // Try cache first
    const cacheKey = `${cacheKeys.fridgeInventory(userId)}:${category || 'all'}:${sortBy}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached fridge inventory', { userId });
      return res.status(200).json(cached);
    }
    
    // Build query
    let queryText = `
      SELECT id, name, quantity, category, freshness, packaging, confidence, expiry_date, scan_job_id, created_at, updated_at
      FROM fridge_items
      WHERE user_id = $1
    `;
    const params = [userId];
    
    if (category) {
      queryText += ' AND category = $2';
      params.push(category);
    }
    
    queryText += ` ORDER BY ${sortBy} DESC`;
    
    const result = await query(queryText, params);
    
    // Get category counts
    const categoryResult = await query(
      `SELECT category, COUNT(*) as count
       FROM fridge_items
       WHERE user_id = $1
       GROUP BY category`,
      [userId]
    );
    
    const categories = {};
    categoryResult.rows.forEach(row => {
      categories[row.category || 'uncategorized'] = parseInt(row.count);
    });
    
    const response = {
      success: true,
      data: {
        items: result.rows.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          freshness: item.freshness,
          packaging: item.packaging,
          confidence: item.confidence,
          expiryDate: item.expiry_date,
          scanJobId: item.scan_job_id,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
        totalItems: result.rows.length,
        categories,
      },
    };
    
    // Cache response
    await cache.set(cacheKey, response, cacheTTL.fridge);
    
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Add fridge items manually
 */
const addItems = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;
    
    const addedItems = [];
    
    for (const item of items) {
      const result = await query(
        `INSERT INTO fridge_items (user_id, name, quantity, category, expiry_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, quantity, category, expiry_date, created_at`,
        [userId, item.name, item.quantity || null, item.category || null, item.expiryDate || null]
      );
      addedItems.push(result.rows[0]);
    }
    
    // Invalidate cache
    await cache.delPattern(`${cacheKeys.fridgeInventory(userId)}:*`);
    
    logger.info('Fridge items added', { userId, count: addedItems.length });
    
    res.status(200).json({
      success: true,
      data: {
        itemsAdded: addedItems.length,
        items: addedItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update fridge item
 */
const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, quantity, category, freshness, expiryDate } = req.body;
    
    // Verify ownership
    const checkResult = await query(
      'SELECT user_id FROM fridge_items WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Fridge item not found');
    }
    
    if (checkResult.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to update this item');
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(quantity);
    }
    
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    
    if (freshness !== undefined) {
      updates.push(`freshness = $${paramCount++}`);
      values.push(freshness);
    }
    
    if (expiryDate !== undefined) {
      updates.push(`expiry_date = $${paramCount++}`);
      values.push(expiryDate);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'No fields to update',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE fridge_items
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING id, name, quantity, category, freshness, expiry_date, updated_at`,
      values
    );
    
    // Invalidate cache
    await cache.delPattern(`${cacheKeys.fridgeInventory(userId)}:*`);
    
    logger.info('Fridge item updated', { itemId: id, userId });
    
    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete fridge item
 */
const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Verify ownership
    const checkResult = await query(
      'SELECT user_id FROM fridge_items WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Fridge item not found');
    }
    
    if (checkResult.rows[0].user_id !== userId) {
      throw new ForbiddenError('Not authorized to delete this item');
    }
    
    await query('DELETE FROM fridge_items WHERE id = $1', [id]);
    
    // Invalidate cache
    await cache.delPattern(`${cacheKeys.fridgeInventory(userId)}:*`);
    
    logger.info('Fridge item deleted', { itemId: id, userId });
    
    res.status(200).json({
      success: true,
      message: 'Item removed from inventory',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear entire fridge inventory
 */
const clearInventory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'DELETE FROM fridge_items WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    // Invalidate cache
    await cache.delPattern(`${cacheKeys.fridgeInventory(userId)}:*`);
    
    logger.info('Fridge inventory cleared', { userId, itemsRemoved: result.rows.length });
    
    res.status(200).json({
      success: true,
      message: 'Fridge inventory cleared',
      itemsRemoved: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventory,
  addItems,
  updateItem,
  deleteItem,
  clearInventory,
};
