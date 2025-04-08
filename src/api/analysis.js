/**
 * Analysis API Routes
 * Handles all endpoints related to MQM analysis
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    console.log('File upload:', {
      originalname: file.originalname,
      extension: ext,
      mimetype: file.mimetype
    });
    // Accept files based on extension only since mimetype can be unreliable
    if (ext === 'tmx' || ext === 'xlf' || ext === 'xliff') {
      cb(null, true);
    } else {
      cb(new Error('Only TMX and XLIFF files are allowed'));
    }
  }
});
const analysisController = require('../controllers/analysisController');
const authMiddleware = require('../middleware/authMiddleware');

// Run MQM analysis on text or uploaded file
router.post('/mqm-analysis', 
  authMiddleware.optionalAuth, 
  authMiddleware.checkUsageLimit,
  authMiddleware.trackUsage,
  upload.single('file'),
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
