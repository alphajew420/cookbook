const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const { validate, schemas } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', authLimiter, validate(schemas.register), register);
router.post('/login', authLimiter, validate(schemas.login), login);

// Protected routes
router.get('/profile', authenticate, getProfile);

module.exports = router;
