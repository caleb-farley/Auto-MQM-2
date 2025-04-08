/**
 * Analysis API Routes
 * Handles all endpoints related to MQM analysis
 */

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const authMiddleware = require('../middleware/auth');

// Run MQM analysis on text or uploaded file
router.post('/mqm-analysis', 
  authMiddleware.optionalAuth, 
  authMiddleware.checkUsageLimit,
  authMiddleware.trackUsage,
  analysisController.runMqmAnalysis
);

// Check source/target alignment
router.post('/check-alignment', 
  authMiddleware.optionalAuth,
  analysisController.checkAlignment
);

// Download analysis report as Excel
router.get('/download-report/:id/excel', 
  authMiddleware.optionalAuth, 
  analysisController.downloadExcelReport
);

// Download analysis report as PDF
router.get('/download-report/:id/pdf', 
  authMiddleware.optionalAuth, 
  analysisController.downloadPdfReport
);

// Download template for Excel upload
router.get('/download-template', 
  authMiddleware.optionalAuth, 
  analysisController.downloadTemplate
);

module.exports = router;
