/**
 * Authentication Middleware
 * Handles user authentication, authorization, and usage tracking
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Run = require('../models/Run');
const ActionLog = require('../models/ActionLog');

/**
 * Middleware to protect routes requiring authentication
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from cookie
    if (req.cookies.token) {
      token = req.cookies.token;
    }
    // Alternatively check Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // If no token, user is not authenticated
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in to access this resource.'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user still exists
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'The user associated with this token no longer exists.'
        });
      }
      
      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

/**
 * Middleware to restrict access to specific roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }
    
    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }
    
    next();
  };
};

/**
 * Middleware for checking usage limits (both anonymous and authenticated users)
 */
exports.checkUsageLimit = async (req, res, next) => {
  try {
    // Get IP address
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    // If user is authenticated, check their subscription tier
    if (req.user) {
      // Admin users have unlimited usage
      if (req.user.accountType === 'admin') {
        return next();
      }
      
      // Get user's current usage count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const usageCount = await Run.countDocuments({
        user: req.user._id,
        timestamp: { $gte: today }
      });
      
      // Check against user's tier limit
      let limit = 5; // Default free tier
      
      if (req.user.subscription && req.user.subscription.tier) {
        switch (req.user.subscription.tier) {
          case 'pro':
            limit = 50;
            break;
          case 'enterprise':
            limit = 1000;
            break;
          default:
            limit = 5;
        }
      }
      
      if (usageCount >= limit) {
        return res.status(429).json({
          success: false,
          message: `You have reached your daily limit of ${limit} analyses. Please upgrade your plan for more.`,
          limit,
          used: usageCount
        });
      }
    } else {
      // Anonymous user - check IP-based limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const usageCount = await Run.countDocuments({
        ip,
        timestamp: { $gte: today }
      });
      
      // Anonymous users get 3 free analyses per day
      const limit = 3;
      
      if (usageCount >= limit) {
        return res.status(429).json({
          success: false,
          message: `You have reached the daily limit of ${limit} analyses for anonymous users. Please sign up for more.`,
          limit,
          used: usageCount
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Usage limit check error:', error);
    // Continue anyway to avoid blocking users due to internal errors
    next();
  }
};

/**
 * Middleware to track usage (increment counter)
 */
exports.trackUsage = async (req, res, next) => {
  try {
    // Get IP address
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    // Log the action
    await ActionLog.create({
      user: req.user ? req.user._id : null,
      ip,
      action: req.originalUrl,
      method: req.method,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });
    
    next();
  } catch (error) {
    console.error('Usage tracking error:', error);
    // Continue anyway to avoid blocking users due to internal errors
    next();
  }
};

/**
 * Middleware to optionally check for authenticated user
 * This doesn't require authentication but will attach user info if token exists
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    // Get token from cookie
    if (req.cookies.token) {
      token = req.cookies.token;
    }
    // Alternatively check Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // If no token, continue as anonymous user
    if (!token) {
      return next();
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user exists
      const user = await User.findById(decoded.id);
      if (user) {
        // Attach user to request object
        req.user = user;
      }
      
      next();
    } catch (error) {
      // Invalid token, but continue as anonymous user
      next();
    }
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Continue as anonymous user
    next();
  }
};
