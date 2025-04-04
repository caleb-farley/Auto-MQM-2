const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController');
const authMiddleware = require('../middleware/authMiddleware');

// Routes that require authentication
router.get(
  '/user',
  authMiddleware.protect,
  runController.getUserRuns
);

router.get(
  '/saved',
  authMiddleware.protect,
  runController.getSavedRuns
);

router.get(
  '/recent',
  authMiddleware.protect,
  runController.getRecentRuns
);

router.put(
  '/:runId/toggle-save',
  authMiddleware.protect,
  runController.toggleSaveRun
);

router.put(
  '/:runId/metadata',
  authMiddleware.protect,
  runController.updateRunMetadata
);

router.delete(
  '/:runId',
  authMiddleware.protect,
  runController.deleteRun
);

// Routes that use optional authentication
// Can be accessed by the owner or through anonymous session cookies
router.get(
  '/:runId',
  authMiddleware.optionalAuth,
  runController.getRunById
);

module.exports = router;