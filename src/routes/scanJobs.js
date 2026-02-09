const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getScanJobs,
  getScanJob,
  getScanJobItems,
  retryScanJob,
  deleteScanJob,
} = require('../controllers/scanJobsController');

// All routes require authentication
router.use(authenticate);

// Get all scan jobs for user
router.get('/', getScanJobs);

// Get single scan job
router.get('/:jobId', getScanJob);

// Get items from a specific scan job
router.get('/:jobId/items', getScanJobItems);

// Retry failed scan job
router.post('/:jobId/retry', retryScanJob);

// Delete scan job
router.delete('/:jobId', deleteScanJob);

module.exports = router;
