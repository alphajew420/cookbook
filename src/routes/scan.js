const express = require('express');
const router = express.Router();
const { scanCookbook, scanFridge, getScanStatus } = require('../controllers/scanController');
const { scanCookbookBatch } = require('../controllers/batchScanController');
const { scanCookbookPdf } = require('../controllers/pdfScanController');
const { authenticate } = require('../middleware/auth');
const { upload, uploadPdf, handleUploadError } = require('../middleware/upload');
const { cookbookScanLimiter, fridgeScanLimiter } = require('../middleware/rateLimiter');

// PDF cookbook scanning
router.post(
  '/cookbook/pdf',
  authenticate,
  cookbookScanLimiter,
  uploadPdf.single('pdf'),
  handleUploadError,
  scanCookbookPdf
);

// Batch cookbook scanning (multiple images)
router.post(
  '/cookbook/batch',
  authenticate,
  cookbookScanLimiter,
  upload.array('images', 10), // Max 10 images
  handleUploadError,
  scanCookbookBatch
);

// Single cookbook scanning
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
