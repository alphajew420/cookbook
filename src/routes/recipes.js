const express = require('express');
const router = express.Router();
const { getRecipe, deleteRecipe } = require('../controllers/recipeController');
const { authenticate } = require('../middleware/auth');

// Get specific recipe
router.get('/:id', authenticate, getRecipe);

// Delete specific recipe
router.delete('/:id', authenticate, deleteRecipe);

module.exports = router;
