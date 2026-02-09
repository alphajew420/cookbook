const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createMatchJob,
  getMatchJobs,
  getMatchJob,
  getMatchResults,
  deleteMatchJob,
} = require('../controllers/matchController');

router.use(authenticate);

router.post('/', createMatchJob);
router.get('/', getMatchJobs);
router.get('/:matchId', getMatchJob);
router.get('/:matchId/results', getMatchResults);
router.delete('/:matchId', deleteMatchJob);

module.exports = router;
