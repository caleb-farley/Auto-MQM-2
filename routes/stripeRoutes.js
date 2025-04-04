const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes that require authentication
router.post(
  '/create-checkout-session',
  authMiddleware.protect,
  stripeController.createCheckoutSession
);

router.get(
  '/subscription',
  authMiddleware.protect,
  stripeController.getSubscription
);

router.post(
  '/cancel-subscription',
  authMiddleware.protect,
  stripeController.cancelSubscription
);

router.post(
  '/resume-subscription',
  authMiddleware.protect,
  stripeController.resumeSubscription
);

router.post(
  '/update-subscription',
  authMiddleware.protect,
  stripeController.updateSubscription
);

router.post(
  '/create-portal-session',
  authMiddleware.protect,
  stripeController.createPortalSession
);

// Webhook handler - requires special middleware setup
// This route should bypass the express.json() middleware
// and use express.raw({ type: 'application/json' }) instead
router.post('/webhook', stripeController.handleWebhook);

module.exports = router;