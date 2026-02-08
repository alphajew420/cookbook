const express = require('express');
const router = express.Router();
const { getRecipe } = require('../controllers/recipeController');
const { matchRecipes } = require('../controllers/matchController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Get specific recipe
router.get('/:id', authenticate, getRecipe);

// Match recipes with fridge ingredients
router.post('/match', authenticate, validate(schemas.matchRecipes), matchRecipes);

module.exports = router;
