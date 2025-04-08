/**
 * Run Model
 * Defines the schema for MQM analysis runs
 */

const mongoose = require('mongoose');

const RunSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ip: {
    type: String,
    required: true
  },
  issues: [
    {
      category: String,
      subcategory: String,
      severity: String,
      segment: String,
      explanation: String,
      suggestion: String
    }
  ],
  mqmScore: {
    type: Number,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  sourceText: {
    type: String,
    default: null
  },
  targetText: {
    type: String,
    required: true
  },
  sourceLang: {
    type: String,
    default: null
  },
  targetLang: {
    type: String,
    required: true
  },
  llmModel: {
    type: String,
    required: true
  },
  analysisMode: {
    type: String,
    enum: ['monolingual', 'bilingual'],
    default: 'bilingual',
    required: true
  },
  fileType: {
    type: String,
    enum: [null, 'tmx', 'xliff', 'excel'],
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Run', RunSchema);
