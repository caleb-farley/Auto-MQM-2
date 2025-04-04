const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  sourceText: String,
  targetText: String,
  sourceLang: String,
  targetLang: String,
  mqmScore: Number,
  issues: Array,
  ip: String,
  summary: String,
  wordCount: Number,
  location: {
    city: String,
    region: String,
    country: String,
    org: String
  },
  // User association - for registered users
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for anonymous users
  },
  // Anonymous session tracking - for non-registered users
  anonymousSessionId: {
    type: String,
    required: false
  },
  // Flag to indicate if this run has been saved by the user
  isSaved: {
    type: Boolean,
    default: false
  },
  // Additional metadata fields
  title: {
    type: String,
    default: function() {
      // Generate default title based on languages and date
      const date = new Date(this.timestamp).toLocaleDateString('en-US');
      return `${this.sourceLang} → ${this.targetLang} (${date})`;
    }
  },
  tags: [String],
  notes: String
});

// Index for efficient user queries
runSchema.index({ user: 1, timestamp: -1 });
// Index for efficient anonymous session queries
runSchema.index({ anonymousSessionId: 1, timestamp: -1 });
// Index for IP address for anonymous user tracking
runSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('Run', runSchema);
