const express = require('express');
const router = express.Router();
const {
  getCookbooks,
  getCookbook,
  getCookbookRecipes,
  updateCookbook,
  deleteCookbook,
} = require('../controllers/cookbookController');
const { getPopularCookbooks } = require('../controllers/popularCookbooksController');
const {
  createAmazonLookup,
  getAmazonLookup,
  selectAmazonBook,
  skipAmazonLookup,
} = require('../controllers/amazonLookupController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Popular cookbooks across all users (must be before /:id)
router.get('/popular', authenticate, getPopularCookbooks);

// Get all cookbooks
router.get('/', authenticate, getCookbooks);

// Get specific cookbook
router.get('/:id', authenticate, getCookbook);

// Get cookbook recipes
router.get('/:id/recipes', authenticate, getCookbookRecipes);

// Amazon lookup routes
router.post('/:id/amazon-lookup', authenticate, createAmazonLookup);
router.get('/:id/amazon-lookup', authenticate, getAmazonLookup);
router.post('/:id/amazon-lookup/select', authenticate, selectAmazonBook);
router.post('/:id/amazon-lookup/skip', authenticate, skipAmazonLookup);

// Update cookbook
router.put('/:id', authenticate, validate(schemas.updateCookbook), updateCookbook);

// Delete cookbook
router.delete('/:id', authenticate, deleteCookbook);

module.exports = router;
