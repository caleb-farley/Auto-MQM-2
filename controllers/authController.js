const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Run = require('../models/Run');
const { v4: uuidv4 } = require('uuid');

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

// Register a new user
exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is already registered' 
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      name,
      accountType: 'free',
      lastLogin: new Date()
    });

    await user.save();

    // Check for any anonymous runs from this IP and associate them
    const anonymousSessionId = req.cookies.anonymousSessionId;
    if (anonymousSessionId) {
      // Associate any anonymous runs with the new user
      await Run.updateMany(
        { anonymousSessionId },
        { user: user._id, anonymousSessionId: null }
      );
    }

    // Generate JWT token
    const token = generateToken(user);

    // Set token in cookie
    res.cookie('token', token, getCookieOptions());

    // Clear anonymous session ID if exists
    if (req.cookies.anonymousSessionId) {
      res.clearCookie('anonymousSessionId');
    }

    // Send response
    res.status(201).json({
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
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await user.validatePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    // Check for any anonymous runs from this IP and associate them
    const anonymousSessionId = req.cookies.anonymousSessionId;
    if (anonymousSessionId) {
      // Associate any anonymous runs with the user
      await Run.updateMany(
        { anonymousSessionId },
        { user: user._id, anonymousSessionId: null }
      );
    }

    // Set token in cookie
    res.cookie('token', token, getCookieOptions());

    // Clear anonymous session ID if exists
    if (req.cookies.anonymousSessionId) {
      res.clearCookie('anonymousSessionId');
    }

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
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
};

// Logout user
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        usageCount: user.usageCount,
        subscriptionStatus: user.subscriptionStatus
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
};

// Get or create anonymous session ID
exports.getAnonymousSession = async (req, res) => {
  try {
    // Check if user already has an anonymous session
    let anonymousSessionId = req.cookies.anonymousSessionId;
    
    // If no session exists, create one
    if (!anonymousSessionId) {
      anonymousSessionId = uuidv4();
      res.cookie('anonymousSessionId', anonymousSessionId, {
        ...getCookieOptions(),
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    
    // Count usage for this anonymous session
    const usageCount = await Run.countDocuments({ anonymousSessionId });
    
    // Get anonymous usage limit
    const limit = User.getAnonymousLimit();
    
    res.status(200).json({
      success: true,
      anonymousSessionId,
      usageCount,
      limit,
      remaining: Math.max(0, limit - usageCount)
    });
  } catch (error) {
    console.error('Anonymous session error:', error);
    res.status(500).json({ success: false, message: 'Failed to manage anonymous session', error: error.message });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update fields
    if (name) user.name = name;
    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
      user.email = email;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accountType: user.accountType
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Validate current password
    const isMatch = await user.validatePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
};

// Social login (placeholder for integration with OAuth providers)
exports.socialLogin = async (req, res) => {
  try {
    const { provider, token, email, name, providerId } = req.body;
    
    // This would be replaced with actual OAuth verification
    // For now, we're trusting the provided data
    
    // Check if user exists with this email
    let user = await User.findOne({ email });
    
    if (user) {
      // User exists, update social login info
      const socialLogin = user.socialLogins.find(sl => sl.provider === provider);
      
      if (socialLogin) {
        // Update existing social login
        socialLogin.lastLogin = new Date();
      } else {
        // Add new social login
        user.socialLogins.push({
          provider,
          providerId,
          email,
          name,
          lastLogin: new Date()
        });
      }
    } else {
      // Create new user
      user = new User({
        email,
        name,
        accountType: 'free',
        socialLogins: [{
          provider,
          providerId,
          email,
          name,
          lastLogin: new Date()
        }],
        lastLogin: new Date()
      });
    }
    
    await user.save();
    
    // Generate JWT token
    const jwtToken = generateToken(user);
    
    // Set token in cookie
    res.cookie('token', jwtToken, getCookieOptions());
    
    // Check for any anonymous runs and associate them
    const anonymousSessionId = req.cookies.anonymousSessionId;
    if (anonymousSessionId) {
      await Run.updateMany(
        { anonymousSessionId },
        { user: user._id, anonymousSessionId: null }
      );
      res.clearCookie('anonymousSessionId');
    }
    
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
    console.error('Social login error:', error);
    res.status(500).json({ success: false, message: 'Social login failed', error: error.message });
  }
};

// Admin functions

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // Ensure requester is admin
    if (req.user.accountType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    // Get all users with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments();
    
    res.status(200).json({
      success: true,
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    // Ensure requester is admin
    if (req.user.accountType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    const { userId } = req.params;
    const { name, email, accountType } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Update fields
    if (name) user.name = name;
    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
      user.email = email;
    }
    if (accountType) user.accountType = accountType;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accountType: user.accountType
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    // Ensure requester is admin
    if (req.user.accountType !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }
    
    const { userId } = req.params;
    
    // Find and delete user
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Also delete or anonymize user's runs (depending on privacy policy)
    // Option 1: Delete all runs
    // await Run.deleteMany({ user: userId });
    
    // Option 2: Anonymize runs
    await Run.updateMany(
      { user: userId },
      { 
        user: null,
        anonymousSessionId: `deleted-user-${userId}`,
        // You might want to handle PII in sourceText/targetText based on privacy policy
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};