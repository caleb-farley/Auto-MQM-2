/**
 * Translation API Routes
 * Handles all endpoints related to translation services
 */

const express = require('express');
const router = express.Router();
const translationController = require('../controllers/translationController');
const authMiddleware = require('../middleware/authMiddleware');

// Translate text using configured translation service
router.post('/translate', 
  authMiddleware.optionalAuth, 
  translationController.translateText
);

// Detect language of text
router.post('/detect-language',
  authMiddleware.optionalAuth,
  translationController.detectLanguage
);

module.exports = router;
