const express = require('express');
const router = express.Router();
const { scanCookbook, scanFridge, getScanStatus } = require('../controllers/scanController');
const { authenticate } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { cookbookScanLimiter, fridgeScanLimiter } = require('../middleware/rateLimiter');

// Cookbook scanning
router.post(
  '/cookbook',
  authenticate,
  cookbookScanLimiter,
  upload.single('image'),
  handleUploadError,
  scanCookbook
);

// Fridge scanning
router.post(
  '/fridge',
  authenticate,
  fridgeScanLimiter,
  upload.single('image'),
  handleUploadError,
  scanFridge
);

// Get scan status
router.get('/cookbook/:scanId/status', authenticate, getScanStatus);
router.get('/fridge/:scanId/status', authenticate, getScanStatus);

module.exports = router;
