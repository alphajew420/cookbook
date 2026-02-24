const redis = require('redis');
const logger = require('./logger');

// Create Redis client
const client = redis.createClient({
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD || undefined,
});

// Error handling
client.on('error', (err) => {
  logger.error('Redis Client Error', { error: err.message });
});

client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

// Connect to Redis
(async () => {
  try {
    await client.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', { error: error.message });
  }
})();

/**
 * Cache helper functions
 */
const cache = {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value
   */
  async get(key) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error', { key, error: error.message });
      return null;
    }
  },

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 3600) {
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error: error.message });
      return false;
    }
  },

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis DEL error', { key, error: error.message });
      return false;
    }
  },

  /**
   * Delete all keys matching pattern
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('Redis DEL pattern error', { pattern, error: error.message });
      return 0;
    }
  },

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Exists status
   */
  async exists(key) {
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error: error.message });
      return false;
    }
  },
};

// Cache key generators
const cacheKeys = {
  userCookbooks: (userId) => `user:${userId}:cookbooks`,
  cookbook: (cookbookId) => `cookbook:${cookbookId}`,
  fridgeInventory: (userId) => `user:${userId}:fridge`,
  recipeMatches: (userId, cookbookId = 'all') => `user:${userId}:matches:${cookbookId}`,
  recipe: (recipeId) => `recipe:${recipeId}`,
  recommendedRecipes: (userId) => `user:${userId}:recommended`,
  hotRecipes: (cuisine) => `global:hot_recipes:${cuisine || 'all'}`,
  cuisineCategories: () => 'global:cuisine_categories',
};

// Cache TTL settings (in seconds)
const cacheTTL = {
  cookbooks: 3600, // 1 hour
  fridge: 1800, // 30 minutes
  matches: 600, // 10 minutes
  recipe: 3600, // 1 hour
  recommended: 300, // 5 minutes
  hot: 600, // 10 minutes
  categories: 3600, // 1 hour
};

module.exports = {
  client,
  cache,
  cacheKeys,
  cacheTTL,
};
