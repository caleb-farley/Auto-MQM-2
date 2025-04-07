const Run = require('../models/Run');
const s3Service = require('../utils/s3Service');

// Get Excel report URL for a run
exports.getExcelReport = async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Find the run
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found'
      });
    }
    
    // Check authorization - only the owner or admin can access the run
    const hasAccess = 
      (req.user && ((run.user && run.user.toString() === req.user.id) || req.user.accountType === 'admin')) ||
      (run.anonymousSessionId && req.cookies.anonymousSessionId === run.anonymousSessionId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this run'
      });
    }
    
    // Check if the run has an Excel report
    if (!run.excelReportUrl || !run.excelReportKey) {
      return res.status(404).json({
        success: false,
        message: 'Excel report not found for this run'
      });
    }
    
    // Get a signed URL for the report
    const signedUrl = await s3Service.getSignedUrl(run.excelReportKey);
    
    res.json({
      success: true,
      url: signedUrl
    });
  } catch (error) {
    console.error('Get Excel report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Excel report',
      error: error.message
    });
  }
};

// Regenerate Excel report for a run
exports.regenerateExcelReport = async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Find the run
    const run = await Run.findById(runId);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Run not found'
      });
    }
    
    // Check authorization - only the owner or admin can regenerate
    const hasAccess = 
      (req.user && ((run.user && run.user.toString() === req.user.id) || req.user.accountType === 'admin')) ||
      (run.anonymousSessionId && req.cookies.anonymousSessionId === run.anonymousSessionId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to regenerate this report'
      });
    }
    
    // Redirect to the download endpoint to regenerate the report
    res.redirect(`/api/download-report/${runId}/excel?force=true`);
  } catch (error) {
    console.error('Regenerate Excel report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate Excel report',
      error: error.message
    });
  }
};
