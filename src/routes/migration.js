const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { runFridgeScanMigration } = require('../controllers/migrationController');

router.get('/fridge-scan-history', authenticate, runFridgeScanMigration);

module.exports = router;
