const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const emailService = require('../utils/emailService');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.accountType === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
};

// Get all users
router.get('/users', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// Get user by ID
router.get('/users/:id', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
});

// Update user
router.put('/users/:id', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    const { name, email, accountType, isVerified } = req.body;
    
    // Find user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (accountType) user.accountType = accountType;
    if (isVerified !== undefined) user.isVerified = isVerified;
    
    await user.save();
    
    res.json({ success: true, user: user.toObject({ hide: 'password' }) });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
});

// Delete user
router.delete('/users/:id', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
});

// Resend verification email
router.post('/resend-verification/:id', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    // Find user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'User is already verified' });
    }
    
    // Get origin
    const origin = req.get('origin') || `http://${req.get('host')}`;
    
    // Send verification email
    await emailService.sendVerificationEmail(user, origin);
    
    res.json({ success: true, message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ success: false, message: 'Failed to resend verification email', error: error.message });
  }
});

// Get user statistics
router.get('/stats', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const unverifiedUsers = await User.countDocuments({ isVerified: false });
    const adminUsers = await User.countDocuments({ accountType: 'admin' });
    const paidUsers = await User.countDocuments({ accountType: 'paid' });
    const freeUsers = await User.countDocuments({ accountType: 'free' });
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        adminUsers,
        paidUsers,
        freeUsers
      }
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user statistics', error: error.message });
  }
});

// Get all runs with Excel reports
router.get('/reports', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    // Find all runs that have Excel reports
    const runs = await require('../models/Run').find({ excelReportUrl: { $exists: true, $ne: null } })
      .sort('-timestamp')
      .select('_id timestamp sourceLang targetLang mqmScore wordCount title excelReportUrl user');
    
    res.json({ success: true, runs });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reports', error: error.message });
  }
});

// Get a specific run's Excel report
router.get('/reports/:id', authMiddleware.protect, isAdmin, async (req, res) => {
  try {
    const run = await require('../models/Run').findById(req.params.id);
    
    if (!run) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    if (!run.excelReportUrl || !run.excelReportKey) {
      return res.status(404).json({ success: false, message: 'Excel report not found for this run' });
    }
    
    // Get a signed URL for the report
    const s3Service = require('../utils/s3Service');
    const signedUrl = await s3Service.getSignedUrl(run.excelReportKey);
    
    res.json({ success: true, url: signedUrl });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch report', error: error.message });
  }
});

module.exports = router;
