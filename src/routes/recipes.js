const express = require('express');
const router = express.Router();
const { getRecipe, deleteRecipe } = require('../controllers/recipeController');
const { getRecommendedRecipes } = require('../controllers/recommendationController');
const { getHotRecipes, getCuisineCategories } = require('../controllers/hotRecipesController');
const { authenticate } = require('../middleware/auth');

// Cuisine categories (must be before /:id)
router.get('/categories', authenticate, getCuisineCategories);

// Hot/trending recipes (must be before /:id)
router.get('/hot', authenticate, getHotRecipes);

// Recommended recipes (must be before /:id)
router.get('/recommended', authenticate, getRecommendedRecipes);

// Get specific recipe
router.get('/:id', authenticate, getRecipe);

// Delete specific recipe
router.delete('/:id', authenticate, deleteRecipe);

module.exports = router;
