const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function() {
      // Password is required unless using social login
      return !this.socialLogins || this.socialLogins.length === 0;
    },
  },
  name: {
    type: String,
    trim: true,
  },
  accountType: {
    type: String,
    enum: ['free', 'paid', 'admin'],
    default: 'free',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  socialLogins: [{
    provider: {
      type: String,
      enum: ['google', 'facebook', 'github'],
    },
    providerId: String,
    email: String,
    name: String,
    lastLogin: Date,
  }],
  usageCount: {
    type: Number,
    default: 0,
  },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  subscriptionStatus: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'unpaid', null],
    default: null,
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  savedRuns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
  }],
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to validate password
userSchema.methods.validatePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Return usage limit based on account type
userSchema.methods.getUsageLimit = function() {
  if (this.accountType === 'admin' || this.accountType === 'paid') {
    return Infinity; // No limit for admin and paid users
  } else if (this.accountType === 'free') {
    return 25; // Free account limit
  }
  return 0; // Default case (should not happen)
};

// Check if user has remaining usage
userSchema.methods.hasRemainingUsage = function() {
  const limit = this.getUsageLimit();
  return limit === Infinity || this.usageCount < limit;
};

// Static method to get anonymous user limit
userSchema.statics.getAnonymousLimit = function() {
  return 5; // Anonymous user limit
};

module.exports = mongoose.model('User', userSchema);