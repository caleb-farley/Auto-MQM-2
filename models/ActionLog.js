const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  actionType: {
    type: String,
    enum: ['qa', 'translate'],
    required: true
  },
  // User information
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for anonymous users
  },
  anonymousSessionId: {
    type: String,
    required: false
  },
  ip: String,
  // Action details
  sourceLang: String,
  targetLang: String,
  sourceTextLength: Number,
  targetTextLength: Number,
  // For translation actions
  engineUsed: String,
  llmModel: String,
  // For QA actions
  analysisMode: {
    type: String,
    enum: ['monolingual', 'bilingual'],
    default: 'bilingual'
  },
  // Reference to the run if this was a QA action
  run: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Run',
    required: false
  },
  // Additional metadata
  location: {
    city: String,
    region: String,
    country: String,
    org: String
  },
  // File information for uploads
  fileType: {
    type: String,
    enum: ['tmx', 'xliff', 'excel', null],
    required: false
  },
  fileUrl: {
    type: String,
    required: false
  }
});

// Indexes for efficient querying
actionLogSchema.index({ actionType: 1, timestamp: -1 });
actionLogSchema.index({ user: 1, timestamp: -1 });
actionLogSchema.index({ anonymousSessionId: 1, timestamp: -1 });
actionLogSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('ActionLog', actionLogSchema);
