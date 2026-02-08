const express = require('express');
const router = express.Router();
const {
  getCookbooks,
  getCookbook,
  getCookbookRecipes,
  updateCookbook,
  deleteCookbook,
} = require('../controllers/cookbookController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Get all cookbooks
router.get('/', authenticate, getCookbooks);

// Get specific cookbook
router.get('/:id', authenticate, getCookbook);

// Get cookbook recipes
router.get('/:id/recipes', authenticate, getCookbookRecipes);

// Update cookbook
router.put('/:id', authenticate, validate(schemas.updateCookbook), updateCookbook);

// Delete cookbook
router.delete('/:id', authenticate, deleteCookbook);

module.exports = router;
