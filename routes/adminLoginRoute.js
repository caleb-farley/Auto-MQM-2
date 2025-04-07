const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Helper function to create and sign a JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      accountType: user.accountType 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper to get cookie options
const getCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

// Special admin login route that bypasses password validation
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Only allow specific admin credentials
    if (email !== 'admin@mqm.com' || password !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
    
    // Find or create the admin user
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create admin user if it doesn't exist
      user = new User({
        email,
        password: 'admin', // This will be hashed by the pre-save hook
        name: 'Admin User',
        accountType: 'admin',
        lastLogin: new Date()
      });
      
      await user.save();
    } else {
      // Ensure user has admin privileges
      user.accountType = 'admin';
      user.lastLogin = new Date();
      await user.save();
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set token in cookie
    res.cookie('token', token, getCookieOptions());
    
    // Send response
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        usageCount: user.usageCount
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

module.exports = router;
