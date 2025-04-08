/**
 * User API Routes
 * Handles all endpoints related to user authentication and management
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.put('/reset-password/:token', userController.resetPassword);
router.get('/logout', userController.logout);

// Protected routes
router.get('/me', 
  authMiddleware.protect, 
  userController.getCurrentUser
);

router.put('/update-details', 
  authMiddleware.protect, 
  userController.updateUserDetails
);

router.put('/update-password', 
  authMiddleware.protect, 
  userController.updatePassword
);

router.post('/generate-api-key', 
  authMiddleware.protect, 
  userController.generateApiKey
);

module.exports = router;
