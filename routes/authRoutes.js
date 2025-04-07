const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/social-login', authController.socialLogin);
router.get('/anonymous-session', authController.getAnonymousSession);
router.get('/status', authMiddleware.optionalAuth, authController.getAuthStatus);
router.get('/verify-email', authController.verifyEmail);

// Password reset routes
router.post('/forgot-password', authController.requestPasswordReset);
router.get('/validate-reset-token', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);

// Protected routes (require authentication)
router.get(
  '/me',
  authMiddleware.protect,
  authController.getCurrentUser
);

router.put(
  '/profile',
  authMiddleware.protect,
  authController.updateProfile
);

router.put(
  '/change-password',
  authMiddleware.protect,
  authController.changePassword
);

// Admin routes
router.get(
  '/users',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  authController.getAllUsers
);

router.put(
  '/users/:userId',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  authController.updateUser
);

router.delete(
  '/users/:userId',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  authController.deleteUser
);

module.exports = router;