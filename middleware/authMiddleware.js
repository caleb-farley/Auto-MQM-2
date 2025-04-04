const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Run = require('../models/Run');

// Middleware to protect routes requiring authentication
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
          message: 'User no longer exists'
        });
      }
      
      // Attach user to request object
      req.user = {
        id: user._id,
        email: user.email,
        accountType: user.accountType
      };
      
      next();
    } catch (error) {
      // Invalid token
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Middleware to restrict access to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

// Middleware for checking usage limits (both anonymous and authenticated users)
exports.checkUsageLimit = async (req, res, next) => {
  try {
    if (req.user) {
      // Authenticated user - check their specific limit
      const user = await User.findById(req.user.id);
      
      if (!user.hasRemainingUsage()) {
        return res.status(403).json({
          success: false,
          message: 'You have reached your usage limit. Please upgrade your account to continue.',
          usageLimit: {
            limit: user.getUsageLimit(),
            current: user.usageCount,
            isLimited: true
          }
        });
      }
      
      // Attach usage info to request for later use
      req.usageInfo = {
        limit: user.getUsageLimit(),
        current: user.usageCount,
        isLimited: true,
        isAuthenticated: true
      };
    } else {
      // Anonymous user - check cookie-based session
      const anonymousSessionId = req.cookies.anonymousSessionId;
      
      if (!anonymousSessionId) {
        // No session yet, they're fine to proceed
        req.usageInfo = {
          limit: User.getAnonymousLimit(),
          current: 0,
          isLimited: true,
          isAuthenticated: false
        };
        return next();
      }
      
      // Count usage
      const count = await Run.countDocuments({ anonymousSessionId });
      const limit = User.getAnonymousLimit();
      
      if (count >= limit) {
        return res.status(403).json({
          success: false,
          message: 'You have reached the anonymous usage limit. Please create an account to continue.',
          usageLimit: {
            limit,
            current: count,
            isLimited: true
          }
        });
      }
      
      // Attach usage info to request for later use
      req.usageInfo = {
        limit,
        current: count,
        isLimited: true,
        isAuthenticated: false,
        anonymousSessionId
      };
    }
    
    next();
  } catch (error) {
    console.error('Usage limit check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking usage limits'
    });
  }
};

// Middleware to track usage (increment counter)
exports.trackUsage = async (req, res, next) => {
  // Store the original send function
  const originalSend = res.send;
  
  // Override the send function
  res.send = function(body) {
    const originalBody = body;
    
    try {
      // Only track successful MQM analysis requests
      if (res.statusCode === 200 && typeof body === 'string') {
        const responseData = JSON.parse(body);
        
        if (responseData._id) { // This is a run result
          if (req.user) {
            // For authenticated users
            User.findByIdAndUpdate(
              req.user.id,
              { $inc: { usageCount: 1 } }
            ).catch(err => console.error('Error incrementing user usage count:', err));
          }
          // Usage for anonymous users is tracked via the anonymousSessionId in the Run model
        }
      }
    } catch (err) {
      console.error('Error tracking usage:', err);
    }
    
    // Call the original send
    return originalSend.call(this, originalBody);
  };
  
  next();
};

// Middleware to optionally check for authenticated user
// This doesn't require authentication but will attach user info if token exists
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
    
    // If token exists, verify and attach user
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (user) {
          req.user = {
            id: user._id,
            email: user.email,
            accountType: user.accountType
          };
        }
      } catch (err) {
        // Invalid token, but we'll proceed anyway
        console.warn('Invalid token in optional auth:', err.message);
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue anyway
  }
};