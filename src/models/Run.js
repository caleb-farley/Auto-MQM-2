const mongoose = require('mongoose');

// Define a schema for segments
const segmentSchema = new mongoose.Schema({
  segment_id: Number,
  source: String,
  target: String,
  sourceLang: String,
  targetLang: String,
  mqmScore: Number,
  mqmIssues: Array,
  wordCount: Number,
  summary: String
}, { _id: false });

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
  // Store segments for detailed analysis
  segments: [segmentSchema],
  // Store which LLM model was used for the assessment
  llmModel: {
    type: String,
    default: 'claude-3-sonnet-20240229'
  },
  // Store the type of file that was analyzed
  fileType: {
    type: String,
    enum: ['tmx', 'xlf', 'xliff'],
    required: false
  },
  // Store whether this is a monolingual or bilingual analysis
  analysisMode: {
    type: String,
    enum: ['monolingual', 'bilingual'],
    default: 'bilingual'
  },
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
  // File information for uploads
  fileUrl: {
    type: String,
    required: false
  },
  fileType: {
    type: String,
    enum: ['tmx', 'xliff', 'excel', null],
    required: false
  },
  fileName: {
    type: String,
    required: false
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
  notes: String,
  // S3 storage for Excel reports
  excelReportUrl: {
    type: String,
    required: false
  },
  excelReportKey: {
    type: String,
    required: false
  }
});

// Index for efficient user queries
runSchema.index({ user: 1, timestamp: -1 });
// Index for efficient anonymous session queries
runSchema.index({ anonymousSessionId: 1, timestamp: -1 });
// Index for IP address for anonymous user tracking
runSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('Run', runSchema);
