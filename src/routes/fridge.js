const express = require('express');
const router = express.Router();
const {
  getInventory,
  addItems,
  updateItem,
  deleteItem,
  clearInventory,
} = require('../controllers/fridgeController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Get fridge inventory
router.get('/inventory', authenticate, getInventory);

// Add items manually
router.post('/inventory', authenticate, validate(schemas.addFridgeItems), addItems);

// Update specific item
router.put('/item/:id', authenticate, validate(schemas.updateFridgeItem), updateItem);

// Delete specific item
router.delete('/item/:id', authenticate, deleteItem);

// Clear entire inventory
router.delete('/inventory', authenticate, clearInventory);

module.exports = router;
