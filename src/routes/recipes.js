const express = require('express');
const router = express.Router();
const { getRecipe } = require('../controllers/recipeController');
const { authenticate } = require('../middleware/auth');

// Get specific recipe
router.get('/:id', authenticate, getRecipe);

module.exports = router;
